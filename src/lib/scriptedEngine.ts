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
} from "./types";
import { buildQuestionSet } from "@/data/questionBank";
import { categoriesFor } from "@/data/roles";
import { modeById, questionCountFor } from "@/data/modes";
import { answerQuality, avg, scoreAnswer } from "./scoring";
import { bandFor, closer, interruption, opener, reactionTo, transition } from "./dialogue";
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

  constructor(
    private config: SessionConfig,
    company: Company,
    role: RoleDef
  ) {
    this.company = company;
    const mode = modeById(config.mode);
    const cats = categoriesFor(role.focus, mode?.categories ?? null);
    const count = questionCountFor(config.durationMin);
    const bank = buildQuestionSet(cats.length ? cats : (["behavioral"] as Category[]), count);
    this.plan = {
      items: bank.map((bankQ) => ({
        bankQ,
        interviewer: pickInterviewer(company.panel, bankQ.category),
        followUpsAsked: 0,
        retries: 0,
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
    const raw = scoreAnswer(answer, item.bankQ);
    this.lastRaw = raw;
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

    // How the interviewer reacts to what was actually said.
    const { text: reaction, band } = reactionTo(raw, quality, item.interviewer, this.config.difficulty);

    // A one-line answer gets pushed on rather than accepted — like a real panel.
    if (band === "punt" && item.retries < 1) {
      item.retries++;
      return { interviewer: item.interviewer, text: reaction, interruption: false, done: false };
    }

    // Decide: ask a follow-up, or move on.
    const wantFollowUp =
      item.followUpsAsked < followUpBudget &&
      item.bankQ.followUps.length > item.followUpsAsked &&
      (quality < 0.62 || (hardMode && quality < 0.85 && item.followUpsAsked === 0));

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

    // Move to the next question (or finish).
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
    const next = this.plan.items[this.idx];
    const sameInterviewer = next.interviewer.id === item.interviewer.id;
    return {
      interviewer: next.interviewer,
      text: `${reaction} ${transition(sameInterviewer, next.interviewer, next.bankQ.question)}`,
      interruption: false,
      done: false,
    };
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
    const raw = this.lastRaw;
    const q = answerQuality(raw);
    const covered = Math.round(raw.coverage * 100);
    notes[item.interviewer.id] =
      q > 0.7
        ? `Strong — hit ${covered}% of key points.`
        : q > 0.45
        ? `Partial (${covered}%); probing further.`
        : raw.missing.length
        ? `Gap: ${raw.missing[0]}.`
        : "Thin answer; flagged.";
    return notes;
  }

  mood(): Record<string, string> {
    const m: Record<string, string> = {};
    if (!this.lastRaw) return m;
    const item = this.plan.items[Math.min(this.idx, this.plan.items.length - 1)];
    const q = answerQuality(this.lastRaw);
    m[item.interviewer.id] = q > 0.7 ? "impressed" : q > 0.5 ? "pleased" : q > 0.35 ? "neutral" : "skeptical";
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

function pickInterviewer(panel: Interviewer[], category: Category, excludeId?: string): Interviewer {
  const owners = panel.filter((p) => p.focus.includes(category) && p.id !== excludeId);
  if (owners.length) return pick(owners);
  const others = panel.filter((p) => p.id !== excludeId);
  return others.length ? pick(others) : panel[0];
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
};
function labelFor(c: Category): string {
  return LABELS[c] ?? c;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
