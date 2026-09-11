import type {
  AnswerEval,
  BankQuestion,
  Category,
  Company,
  Difficulty,
  Interviewer,
  QuestionFeedback,
  Report,
  RoleDef,
  SessionConfig,
  Verdict,
} from "./types";
import { buildQuestionSet } from "@/data/questionBank";
import { planCategories } from "@/data/roles";
import { modeById, questionCountFor } from "@/data/modes";
import { answerQuality, avg, gradedScore, scoreAnswer } from "./scoring";
import { describeKey, gradeAnswer } from "./grading";
import {
  bandFor,
  bridge,
  clarify,
  closer,
  gradedCommit,
  gradedCorrect,
  gradedPartial,
  gradedRecheck,
  gradedUncommittedFinal,
  gradedUnsure,
  gradedWrongFinal,
  interruption,
  isConfused,
  isUnsure,
  movesOn,
  opener,
  reactionTo,
  transition,
  workingAck,
  type Band,
} from "./dialogue";
import { RESOURCES } from "@/data/resources";

/**
 * Offline interview brain. Deterministic, no network. Produces the panel's
 * lines, picks follow-ups by answer quality, occasionally interrupts with a
 * second panelist, and writes the final report from accumulated evaluations.
 *
 * The AI engine (aiEngine.ts) mirrors this interface so the room UI is
 * agnostic to which brain is running.
 */

export interface PlannedItem {
  bankQ: BankQuestion;
  interviewer: Interviewer;
  /** Follow-ups already asked for this question. */
  followUpsAsked: number;
  /** Times the panel pushed back on a one-line answer. */
  retries: number;
  /** Times the candidate said they don't know this one. */
  unsureCount: number;
  /** Times they asked for the question to be clarified. */
  clarifyCount: number;
  /** Graded questions: answers given, and times asked to commit to one. */
  attempts: number;
  unclearCount: number;
  /** Graded questions: the panel asked how they got a right answer. */
  awaitingWorking: boolean;
  /** Graded questions: most working shown across their turns, 0-1. */
  bestReasoning: number;
}

export interface EnginePlan {
  items: PlannedItem[];
}

export interface NextLine {
  interviewer: Interviewer;
  text: string;
  interruption: boolean;
  /** True once the whole interview is over. */
  done: boolean;
}

export class ScriptedEngine {
  plan: EnginePlan;
  private company: Company;
  private idx = 0;
  private started = false;
  private evals: AnswerEval[] = [];
  private lastRaw: ReturnType<typeof scoreAnswer> | null = null;
  /** Verdict of the last graded answer (null after an open question). */
  private lastVerdict: Verdict | null = null;
  /** Who asked the question that was just answered — notes and mood belong to them. */
  private lastAskerId: string | null = null;

  constructor(
    private config: SessionConfig,
    company: Company,
    role: RoleDef
  ) {
    this.company = company;
    const mode = modeById(config.mode);
    const { categories: cats, weights } = planCategories(role, mode);
    const count = questionCountFor(config.durationMin);
    const bank = buildQuestionSet(cats.length ? cats : (["behavioral"] as Category[]), count, company.id, weights);
    this.plan = {
      items: bank.map((bankQ) => ({
        bankQ,
        interviewer: pickInterviewer(company.panel, bankQ.category),
        followUpsAsked: 0,
        retries: 0,
        unsureCount: 0,
        clarifyCount: 0,
        attempts: 0,
        unclearCount: 0,
        awaitingWorking: false,
        bestReasoning: 0,
      })),
    };
  }

  get total(): number {
    return this.plan.items.length;
  }
  get currentIndex(): number {
    return this.idx;
  }

  /** The opening line from the lead interviewer. */
  start(): NextLine {
    this.started = true;
    const first = this.plan.items[0];
    const lead = first.interviewer;
    return {
      interviewer: lead,
      text: opener(lead, this.config.difficulty, this.company.name, first.bankQ.question),
      interruption: false,
      done: false,
    };
  }

  /**
   * Process the candidate's answer to the current question and return the
   * panel's next line (a follow-up, an interruption, or the next question).
   */
  submitAnswer(answer: string): NextLine {
    const item = this.plan.items[this.idx];

    // The candidate is asking about the question, not answering it. Rephrase
    // and wait — scoring this as a bad answer and changing topic is how the
    // panel ends up talking straight past someone who is simply lost.
    if (isConfused(answer) && item.clarifyCount < 2) {
      item.clarifyCount++;
      return {
        interviewer: item.interviewer,
        text: clarify(item.bankQ.question, item.bankQ.category, item.clarifyCount - 1, item.bankQ.check?.kind),
        interruption: false,
        done: false,
      };
    }

    // Numericals and MCQs have one right answer — grade that, not keywords.
    if (item.bankQ.check) return this.submitGraded(item, answer);

    const raw = scoreAnswer(answer, item.bankQ);
    this.lastRaw = raw;
    this.lastVerdict = null;
    this.lastAskerId = item.interviewer.id;
    const quality = answerQuality(raw);

    // Record/merge the evaluation for this question.
    const existing = this.evals.find((e) => e.questionIdx === this.idx);
    const noteBits: string[] = [];
    if (raw.matched.length) noteBits.push(`covered: ${raw.matched.slice(0, 4).join(", ")}`);
    if (raw.missing.length) noteBits.push(`missed: ${raw.missing.slice(0, 4).join(", ")}`);
    const evalRec: AnswerEval = {
      questionIdx: this.idx,
      technical: raw.technical,
      communication: raw.communication,
      confidence: raw.confidence,
      depth: raw.depth,
      structure: raw.structure,
      notes: noteBits.join(" · "),
      missing: raw.missing,
    };
    if (existing) Object.assign(existing, evalRec);
    else this.evals.push(evalRec);

    const hardMode = ["advanced", "senior", "principal", "research-scientist"].includes(this.config.difficulty);
    const followUpBudget = hardMode ? 2 : 1;

    // Decide the SHAPE of this turn before writing any words, so the reaction
    // can be told whether anyone is going to wait for a reply. Generating an
    // open probe and then appending a different question is what made the
    // panel look like it was reading from a script.
    const provisional = bandFor(quality, raw, answer);
    const wantFollowUp =
      provisional !== "unsure" &&
      item.followUpsAsked < followUpBudget &&
      item.bankQ.followUps.length > item.followUpsAsked &&
      (quality < 0.62 || (hardMode && quality < 0.85 && item.followUpsAsked === 0));
    const mayRetry = provisional === "unsure" || provisional === "punt";
    const willWait = wantFollowUp || (mayRetry && item.retries < 1);

    const { text: reaction, band, retry } = reactionTo(
      raw,
      quality,
      item.interviewer,
      this.config.difficulty,
      answer,
      item.unsureCount > 0,
      willWait
    );
    if (band === "unsure") item.unsureCount++;

    // Stay on this question when the panel offered a steer or asked them to
    // expand — a real interviewer gives you a second go before moving on.
    if (retry && item.retries < 1) {
      item.retries++;
      return { interviewer: item.interviewer, text: reaction, interruption: false, done: false };
    }

    if (wantFollowUp) {
      const fu = item.bankQ.followUps[item.followUpsAsked];
      item.followUpsAsked++;
      // ~28% chance a different panelist cuts in with the follow-up.
      const interrupt = Math.random() < 0.28;
      const speaker = interrupt
        ? pickInterviewer(this.company.panel, item.bankQ.category, item.interviewer.id)
        : item.interviewer;
      const text = interrupt ? interruption(speaker, fu) : `${reaction} ${fu}`;
      return { interviewer: speaker, text, interruption: interrupt, done: false };
    }

    return this.advance(item, reaction, band, answer, raw.matched);
  }

  /**
   * Close the current question with `reaction` and hand over to the next one
   * (or wrap up the interview).
   */
  private advance(item: PlannedItem, reaction: string, band: Band, answer: string, matched: string[]): NextLine {
    this.idx++;
    if (this.idx >= this.plan.items.length) {
      const closing = this.company.panel.find((p) => p.style === "warm") ?? item.interviewer;
      return {
        interviewer: closing,
        text: `${reaction} ${closer(band, this.company.name)}`,
        interruption: false,
        done: true,
      };
    }

    // Let what they just said steer where we go next, so the interview reads
    // as a thread rather than a fixed list being read out in order. (Not after
    // a numerical: "the train takes 12 seconds" shouldn't pull the next train
    // problem forward.)
    if (!item.bankQ.check) this.promoteRelevant(answer, matched);

    const next = this.plan.items[this.idx];
    const sameInterviewer = next.interviewer.id === item.interviewer.id;
    const link =
      matched.length && Math.random() < 0.55
        ? bridge(matched[0], next.bankQ.category === item.bankQ.category)
        : null;
    const parts = [reaction, link, transition(sameInterviewer, next.interviewer, next.bankQ.question, movesOn(reaction))];
    return {
      interviewer: next.interviewer,
      text: parts.filter(Boolean).join(" "),
      interruption: false,
      done: false,
    };
  }

  /**
   * A question with one right answer (imported numerical or MCQ). The panel
   * behaves like a real analytical round: confirms a right answer, often asks
   * how you got it, gives ONE chance to re-check a wrong answer without
   * hinting at the key, and asks you to commit if you only talked around it.
   */
  private submitGraded(item: PlannedItem, answer: string): NextLine {
    const q = item.bankQ;
    const kind = q.check!.kind;
    const iv = item.interviewer;
    const stay = (text: string): NextLine => ({ interviewer: iv, text, interruption: false, done: false });

    // They were asked how they got a right answer: credit the working, move on.
    if (item.awaitingWorking) {
      item.awaitingWorking = false;
      const g = gradeAnswer(answer, q);
      item.bestReasoning = Math.max(item.bestReasoning, g.reasoning);
      this.recordGraded(item, answer, "correct");
      return this.advance(item, workingAck(g.reasoning), "strong", answer, []);
    }

    if (isUnsure(answer)) {
      item.unsureCount++;
      this.recordGraded(item, answer, "skipped");
      if (item.unsureCount === 1) return stay(gradedUnsure(iv, kind, true));
      return this.advance(item, gradedUnsure(iv, kind, false), "unsure", answer, []);
    }

    const g = gradeAnswer(answer, q);
    item.attempts++;
    item.bestReasoning = Math.max(item.bestReasoning, g.reasoning);
    this.recordGraded(item, answer, g.verdict);

    if (g.verdict === "correct") {
      const line = gradedCorrect(iv, g.said);
      const askChance = ASK_WORKING[this.config.difficulty] ?? 0.75;
      if (item.bestReasoning < 0.3 && item.followUpsAsked < 1 && q.followUps.length && Math.random() < askChance) {
        item.awaitingWorking = true;
        item.followUpsAsked++;
        return stay(`${line} ${q.followUps[0]}`);
      }
      return this.advance(item, line, "strong", answer, []);
    }

    if (g.verdict === "wrong" || g.verdict === "partial") {
      if (item.retries < 1) {
        item.retries++;
        return stay(g.verdict === "partial" ? gradedPartial() : gradedRecheck(iv, kind));
      }
      return this.advance(item, gradedWrongFinal(iv), "weak", answer, []);
    }

    // Talked around it without committing to a number or an option.
    if (item.unclearCount < 1) {
      item.unclearCount++;
      return stay(gradedCommit(kind));
    }
    return this.advance(item, gradedUncommittedFinal(), "ok", answer, []);
  }

  /** Store the evaluation of a graded answer (later turns on the same question update it). */
  private recordGraded(item: PlannedItem, answer: string, verdict: Verdict): void {
    const raw = gradedScore(answer, verdict, item.bestReasoning, item.attempts);
    this.lastRaw = raw;
    this.lastVerdict = verdict;
    this.lastAskerId = item.interviewer.id;
    const evalRec: AnswerEval = {
      questionIdx: this.idx,
      technical: raw.technical,
      communication: raw.communication,
      confidence: raw.confidence,
      depth: raw.depth,
      structure: raw.structure,
      notes: VERDICT_NOTE[verdict],
      missing: [],
      verdict,
    };
    const existing = this.evals.find((e) => e.questionIdx === this.idx);
    if (!existing) {
      this.evals.push(evalRec);
      return;
    }
    // Explaining a right answer shouldn't lower how it was delivered.
    Object.assign(existing, {
      ...evalRec,
      communication: Math.max(existing.communication, evalRec.communication),
      structure: Math.max(existing.structure, evalRec.structure),
    });
  }

  /**
   * Reorder the remaining questions so the next one connects to what the
   * candidate actually talked about. The plan is fixed up front, but the
   * ORDER doesn't have to be — following the thread is most of what makes an
   * interviewer feel like they were listening.
   */
  private promoteRelevant(answer: string, matched: string[]): void {
    const rest = this.plan.items.slice(this.idx);
    if (rest.length < 2) return;

    const vocab = new Set(
      `${answer} ${matched.join(" ")}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4)
    );
    if (!vocab.size) return;

    const relevance = (it: PlannedItem): number => {
      const terms = [...it.bankQ.keywords, it.bankQ.question]
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4);
      if (!terms.length) return 0;
      return terms.filter((t) => vocab.has(t)).length / Math.sqrt(terms.length);
    };

    let bestI = 0;
    let best = relevance(rest[0]);
    for (let i = 1; i < rest.length; i++) {
      const r = relevance(rest[i]);
      if (r > best) { best = r; bestI = i; }
    }
    // Only reorder on a real connection — otherwise keep the planned order.
    if (bestI > 0 && best > 0.35) {
      const [chosen] = rest.splice(bestI, 1);
      rest.unshift(chosen);
      this.plan.items = [...this.plan.items.slice(0, this.idx), ...rest];
    }
  }

  /** The current bank question (for the report and hints). */
  currentQuestion(): BankQuestion | null {
    return this.plan.items[this.idx]?.bankQ ?? null;
  }

  /** Panelist notes for the live UI, reflecting the last answer. */
  liveNotes(): Record<string, string> {
    const notes: Record<string, string> = {};
    if (!this.lastRaw) return notes;
    const item = this.plan.items[Math.min(this.idx, this.plan.items.length - 1)];
    const asker = this.lastAskerId ?? item.interviewer.id;
    if (this.lastVerdict) {
      // Says whether it was right, never what the right answer is.
      notes[asker] =
        this.lastVerdict === "correct" && this.lastRaw.depth >= 8 ? "Correct, with clear working." : VERDICT_NOTE[this.lastVerdict];
      return notes;
    }
    const raw = this.lastRaw;
    const q = answerQuality(raw);
    const covered = Math.round(raw.coverage * 100);
    // Notes are visible to the candidate, so they must not name the concepts
    // that were missed — that would give the answer away mid-interview.
    notes[asker] =
      q > 0.7
        ? `Strong — hit ${covered}% of key points.`
        : q > 0.45
        ? `Partial (${covered}%); probing further.`
        : "Gaps here; flagged for review.";
    return notes;
  }

  mood(): Record<string, string> {
    const m: Record<string, string> = {};
    if (!this.lastRaw) return m;
    const item = this.plan.items[Math.min(this.idx, this.plan.items.length - 1)];
    const q = answerQuality(this.lastRaw);
    m[this.lastAskerId ?? item.interviewer.id] = q > 0.7 ? "impressed" : q > 0.5 ? "pleased" : q > 0.35 ? "neutral" : "skeptical";
    return m;
  }

  /** Build the final report from accumulated per-answer evaluations. */
  buildReport(answersByIdx: Record<number, string>): Report {
    const evals = this.evals;
    const technical = round(avg(evals.map((e) => e.technical)) * 10);
    const communication = round(avg(evals.map((e) => e.communication)) * 10);
    const confidence = round(avg(evals.map((e) => e.confidence)) * 10);
    const depth = round(avg(evals.map((e) => e.depth)) * 10);
    const structure = round(avg(evals.map((e) => e.structure)) * 10);
    const problemSolving = round((technical + depth) / 2);

    const behavioralIdxs = this.plan.items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => ["behavioral", "hr", "resume", "project"].includes(it.bankQ.category));
    const behavioral = behavioralIdxs.length
      ? round(avg(behavioralIdxs.map(({ i }) => (this.evals.find((e) => e.questionIdx === i)?.communication ?? 5) * 10)))
      : communication;

    const codingIdxs = this.plan.items.filter((it) => it.bankQ.category === "coding");
    const coding = codingIdxs.length
      ? round(avg(this.plan.items.map((it, i) => (it.bankQ.category === "coding" ? (this.evals.find((e) => e.questionIdx === i)?.technical ?? 5) * 10 : NaN)).filter((x) => !Number.isNaN(x))))
      : technical;

    const overall = round(technical * 0.35 + communication * 0.2 + depth * 0.2 + confidence * 0.15 + structure * 0.1);
    const companyReadiness = clampPct(overall - hardnessPenalty(this.config.difficulty));
    const roleReadiness = clampPct(round((technical + depth) / 2));
    // Explicitly an AI estimate, wide and conservative.
    const hiringProbability = clampPct(round(overall * 0.85 - hardnessPenalty(this.config.difficulty)));

    const perQuestion: QuestionFeedback[] = this.plan.items.map((it, i) => {
      const e = this.evals.find((ev) => ev.questionIdx === i);
      const answer = answersByIdx[i] ?? "(no answer recorded)";
      if (it.bankQ.check) return gradedFeedback(it.bankQ, answer, e);
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      if (e) {
        if (e.technical >= 7) strengths.push("Solid technical grasp of the core concept.");
        if (e.structure >= 7) strengths.push("Well-structured, easy to follow.");
        if (e.confidence >= 7) strengths.push("Delivered with confidence.");
        if (e.technical < 5) weaknesses.push("Missed key technical points.");
        if (e.depth < 5) weaknesses.push("Answer stayed at the surface — needed depth.");
        if (e.communication < 5) weaknesses.push("Communication could be clearer and better paced.");
        if (e.confidence < 5) weaknesses.push("Hesitant delivery — sounded unsure.");
      }
      if (!strengths.length) strengths.push("Attempted the question.");
      if (!weaknesses.length) weaknesses.push("Minor gaps only — tighten and add a concrete example.");
      return {
        question: it.bankQ.question,
        answer,
        idealAnswer: it.bankQ.ideal,
        strengths,
        weaknesses,
        missingConcepts: e?.missing.slice(0, 5) ?? [],
        betterAnswer: betterAnswerHint(it.bankQ),
        confidence: e ? Math.round(answerQuality(e) * 10) : 4,
      };
    });

    const weakCats = weakestCategories(this.plan.items, this.evals);
    const strongCats = strongestCategories(this.plan.items, this.evals);

    return {
      overall,
      technical,
      communication,
      confidence,
      problemSolving,
      behavioral,
      depth,
      structure,
      companyReadiness,
      roleReadiness,
      hiringProbability,
      summary: buildSummary(overall, strongCats, weakCats, this.company.name),
      strengths: strongCats.map((c) => `Strong on ${labelFor(c)}.`),
      weaknesses: weakCats.map((c) => `Needs work on ${labelFor(c)}.`),
      perQuestion,
      coach: {
        topicsToRevise: weakCats.map(labelFor),
        resources: weakCats.flatMap((c) => RESOURCES[c] ?? []).slice(0, 6),
        studyPlan: buildStudyPlan(weakCats),
      },
    };
  }
}

// ---------------- helpers ----------------

/** How often a right-but-bare answer gets "how did you get that?" — rises with difficulty. */
const ASK_WORKING: Partial<Record<Difficulty, number>> = { beginner: 0.35, intermediate: 0.55 };

/** What the live panel note says after a graded answer. */
const VERDICT_NOTE: Record<Verdict, string> = {
  correct: "Correct answer.",
  partial: "Partly right.",
  wrong: "Incorrect — noted.",
  unclear: "No final answer yet.",
  skipped: "Skipped.",
};

/** Report feedback for a question with one right answer. */
function gradedFeedback(q: BankQuestion, answer: string, e: AnswerEval | undefined): QuestionFeedback {
  const verdict = e?.verdict;
  const showedWorking = (e?.depth ?? 0) >= 8;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (verdict === "correct") {
    strengths.push("Got the right answer.");
    if (showedWorking) strengths.push("Showed clear working.");
    else weaknesses.push("Say how you got there — panels score the method as much as the number.");
  } else if (verdict === "partial") {
    strengths.push("Some of the right options.");
    weaknesses.push("Missed part of the full set.");
  } else if (verdict === "wrong") {
    weaknesses.push("Final answer was incorrect.");
    if ((e?.depth ?? 0) >= 4) strengths.push("The approach had the right shape.");
  } else if (verdict === "unclear") {
    weaknesses.push("Never committed to a final answer.");
  } else if (verdict === "skipped") {
    weaknesses.push("Skipped — revise this one.");
  }
  if (!strengths.length) strengths.push(e ? "Attempted the question." : "Not reached in the time available.");
  return {
    question: q.question,
    answer,
    idealAnswer: q.ideal,
    strengths,
    weaknesses,
    missingConcepts: [],
    betterAnswer: gradedHint(q),
    confidence: e ? Math.round(answerQuality(e) * 10) : 4,
    verdict,
    correctAnswer: q.check ? describeKey(q.check) : undefined,
  };
}

function gradedHint(q: BankQuestion): string {
  const s = q.solution;
  const setup = s?.formula ? ` Name the relation you're using (${s.formula}).` : "";
  const trap = s?.commonMistakes?.length ? ` Watch for the classic trap: ${lowerFirst(s.commonMistakes[0])}.` : "";
  const commit =
    q.check?.kind === "choice"
      ? "Commit to one option out loud, then say in a sentence why it beats the others."
      : "State the final number clearly, with units.";
  return `${commit}${setup} Then give the one or two steps that get you there — the method is scored as much as the answer.${trap}`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1).replace(/[.\s]+$/, "");
}

/**
 * People-facing categories an HR/recruiting panelist can credibly ask about.
 * Verbal ability sits here too — HR asking a word-usage question is normal.
 */
const PEOPLE_CATEGORIES: Category[] = ["hr", "behavioral", "resume", "project", "verbal"];

/**
 * Adjacent topics used to find a credible asker when nobody on the panel
 * explicitly owns a category — so a rapid-fire coding question goes to an
 * engineer rather than the HR manager.
 */
const ASKER_FALLBACK: Partial<Record<Category, Category[]>> = {
  "rapid-fire": ["coding", "aerodynamics", "propulsion", "controls", "quant", "system-design"],
  coding: ["system-design", "ml-ai", "controls"],
  "system-design": ["coding", "ml-ai"],
  "ml-ai": ["data-science", "coding", "research"],
  "data-science": ["ml-ai", "quant"],
  quant: ["case-study", "data-science", "coding"],
  "case-study": ["quant", "product"],
  product: ["case-study", "behavioral"],
  research: ["aerodynamics", "cfd", "ml-ai", "project"],
  cfd: ["aerodynamics", "thermal"],
  aerodynamics: ["cfd", "flight-mechanics"],
  thermal: ["propulsion", "cfd"],
  propulsion: ["thermal", "aerodynamics"],
  structures: ["aerodynamics", "project"],
  "flight-mechanics": ["controls", "aerodynamics"],
  controls: ["flight-mechanics", "coding"],
  resume: ["behavioral", "hr", "project"],
  project: ["behavioral", "research"],
  behavioral: ["hr", "project"],
  hr: ["behavioral"],
  aptitude: ["reasoning", "quant", "rapid-fire", "engineering-maths", "case-study", "data-science", "coding"],
  reasoning: ["aptitude", "quant", "rapid-fire", "case-study", "coding"],
  verbal: ["hr", "behavioral"],
  "engineering-maths": ["aptitude", "flight-mechanics", "cfd", "structures", "controls", "quant", "coding"],
  "cs-fundamentals": ["coding", "system-design", "ml-ai"],
};

/**
 * Choose who asks a question. Technical questions must not land on an
 * HR/recruiting panelist — an HR manager asking about binary search
 * immediately breaks the illusion.
 */
function pickInterviewer(panel: Interviewer[], category: Category, excludeId?: string): Interviewer {
  const available = panel.filter((p) => p.id !== excludeId);
  if (!available.length) return panel[0];

  const isPeopleTopic = PEOPLE_CATEGORIES.includes(category);
  // Someone whose focus is purely people-facing shouldn't ask technical questions.
  const credible = isPeopleTopic
    ? available
    : available.filter((p) => !p.focus.every((f) => PEOPLE_CATEGORIES.includes(f)));
  const pool = credible.length ? credible : available;

  const owners = pool.filter((p) => p.focus.includes(category));
  if (owners.length) return pick(owners);

  for (const alt of ASKER_FALLBACK[category] ?? []) {
    const near = pool.filter((p) => p.focus.includes(alt));
    if (near.length) return pick(near);
  }
  return pick(pool);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function round(n: number): number {
  return Math.round(n);
}
function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}
function hardnessPenalty(d: Difficulty): number {
  return { beginner: -5, intermediate: 0, advanced: 4, senior: 7, principal: 10, "research-scientist": 12 }[d];
}

function weakestCategories(items: PlannedItem[], evals: AnswerEval[]): Category[] {
  return categoryScores(items, evals)
    .filter((c) => c.score < 6)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((c) => c.cat);
}
function strongestCategories(items: PlannedItem[], evals: AnswerEval[]): Category[] {
  return categoryScores(items, evals)
    .filter((c) => c.score >= 6.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.cat);
}
function categoryScores(items: PlannedItem[], evals: AnswerEval[]): { cat: Category; score: number }[] {
  const byCat = new Map<Category, number[]>();
  items.forEach((it, i) => {
    const e = evals.find((ev) => ev.questionIdx === i);
    if (!e) return;
    const arr = byCat.get(it.bankQ.category) ?? [];
    arr.push((e.technical + e.depth) / 2);
    byCat.set(it.bankQ.category, arr);
  });
  return [...byCat.entries()].map(([cat, arr]) => ({ cat, score: avg(arr) }));
}

function betterAnswerHint(q: BankQuestion): string {
  const kws = q.keywords.slice(0, 5).join(", ");
  return `Lead with the core idea, then explicitly hit: ${kws}. Give one concrete example or a quick derivation, state a trade-off, and close with the limiting case or when it breaks.`;
}

function buildSummary(overall: number, strong: Category[], weak: Category[], company: string): string {
  const band = overall >= 75 ? "strong" : overall >= 60 ? "solid" : overall >= 45 ? "developing" : "early-stage";
  const s = strong.length ? `You were strongest on ${strong.map(labelFor).join(", ")}.` : "";
  const w = weak.length ? ` The clearest areas to improve are ${weak.map(labelFor).join(", ")}.` : "";
  return `Overall this was a ${band} performance for a ${company} panel. ${s}${w} The scores below are an AI estimate of your interview performance, not a hiring decision.`;
}

function buildStudyPlan(weak: Category[]): string[] {
  const base = [
    "Do 2 focused mock interviews this week in your weakest area.",
    "For each weak topic, write a one-page cheat sheet from memory, then check it.",
    "Record yourself answering 5 questions out loud; review for filler words and pacing.",
  ];
  const topic = weak.length
    ? [`Deep-dive ${labelFor(weak[0])}: work 10 problems and re-derive the key results.`]
    : ["Keep breadth up — rotate through all categories weekly."];
  return [...topic, ...base];
}

const LABELS: Record<Category, string> = {
  aerodynamics: "Aerodynamics", structures: "Structures", propulsion: "Propulsion", cfd: "CFD",
  "flight-mechanics": "Flight Mechanics", controls: "Control Systems", thermal: "Heat Transfer",
  coding: "Coding / DSA", "system-design": "System Design", "ml-ai": "Machine Learning",
  "data-science": "Data Science", quant: "Quantitative", "case-study": "Case Study", product: "Product",
  behavioral: "Behavioral", hr: "HR / Motivation", resume: "Resume Depth", research: "Research",
  project: "Project Discussion", "rapid-fire": "Rapid Fire",
  aptitude: "Quantitative Aptitude", reasoning: "Logical Reasoning", verbal: "Verbal Ability",
  "engineering-maths": "Engineering Maths", "cs-fundamentals": "CS Fundamentals",
};
function labelFor(c: Category): string {
  return LABELS[c] ?? c;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
