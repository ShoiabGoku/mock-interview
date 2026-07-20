import type { Difficulty, Interviewer } from "./types";
import type { RawScore } from "./scoring";

/**
 * Natural interviewer speech for the offline engine.
 *
 * Two rules drive everything here:
 *
 * 1. PRAISE SPECIFICS, PROBE VAGUELY. Naming a concept the candidate *did*
 *    cover is good feedback. Naming a concept they MISSED hands them the
 *    answer, which a real interviewer never does mid-interview — so gap
 *    probes stay deliberately non-specific.
 *
 * 2. "I DON'T KNOW" IS A NORMAL ANSWER. Real interviewers acknowledge it,
 *    maybe offer a steer, then move on. They never demand you "expand on"
 *    not knowing something, and never scold you for missing a keyword.
 */

type Band = "strong" | "ok" | "weak" | "unsure" | "punt";

/** Detect an explicit admission of not knowing, as opposed to a bad answer. */
export function isUnsure(answer: string): boolean {
  const t = answer.toLowerCase().replace(/[’']/g, "").trim();
  if (t.split(/\s+/).length > 40) return false; // a long answer isn't a punt
  return [
    "i dont know", "i do not know", "dont know", "no idea", "not sure",
    "im not sure", "i am not sure", "not really sure", "cant recall",
    "cannot recall", "i forget", "i forgot", "no clue", "havent studied",
    "have not studied", "not familiar", "pass on this", "skip this",
    "draw a blank", "blanking",
  ].some((p) => t.includes(p));
}

/**
 * Detect a candidate asking about the QUESTION rather than answering it —
 * "I didn't understand", "what do you mean?", "who is the other person?".
 *
 * Distinct from isUnsure(): that is "I don't know the answer", this is "I
 * don't know what you're asking". Conceding knowledge earns a steer and a
 * move on; asking for clarification must earn an actual clarification, or
 * the panel talks straight past the candidate.
 */
export function isConfused(answer: string): boolean {
  const t = answer.toLowerCase().replace(/[’']/g, "").trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 25) return false; // a long reply is an attempt, not a query

  const explicit = [
    "didnt understand", "did not understand", "dont understand", "do not understand",
    "what do you mean", "what does that mean", "not sure what you are asking",
    "not sure what youre asking", "what are you asking", "can you repeat",
    "could you repeat", "can you rephrase", "could you rephrase", "say that again",
    "come again", "can you clarify", "could you clarify", "clarify the question",
    "didnt get the question", "dont get the question", "which one do you mean",
    "what exactly do you want", "what do you want me to say",
  ];
  if (explicit.some((p) => t.includes(p))) return true;

  // A short interrogative aimed back at the panel ("Who is the other person?").
  if (words.length <= 12 && /\?\s*$/.test(answer.trim())) {
    return /^(who|what|which|where|when|how|why|can|could|do|does|are|is|sorry)\b/.test(t);
  }
  return false;
}

/** How to reframe an ask, by topic — says what KIND of answer is wanted, never the answer. */
const FRAMING: Partial<Record<string, string>> = {
  aerodynamics: "I'm after the physical picture and the reasoning, not a number.",
  structures: "Talk me through the load path — what carries what.",
  propulsion: "A qualitative walk-through of the process is fine.",
  cfd: "I want your setup reasoning — assumptions, models, why.",
  thermal: "Describe the mechanism and what balances what.",
  "flight-mechanics": "Reason it out from the forces involved.",
  controls: "Tell me what the system does and why it behaves that way.",
  coding: "Talk me through your approach before any code.",
  "system-design": "Start from the requirements and work outward.",
  "ml-ai": "Explain the intuition first, the maths second.",
  "data-science": "Tell me how you'd approach it and what you'd check.",
  quant: "Set up the problem out loud — I care about the reasoning.",
  "case-study": "Structure it however you like; just think out loud.",
  behavioral: "A specific situation from your own experience is what I'm after.",
  hr: "Just tell me honestly, in your own words.",
  resume: "Anything from your own CV — pick one and talk me through it.",
  project: "Pick a project of yours and walk me through your part in it.",
  research: "Your own reasoning matters more than the literature here.",
};

/**
 * Answer a request for clarification: acknowledge, reframe what's being
 * asked, and put the SAME question again. Never moves on, never leaks.
 */
export function clarify(question: string, category: string, asked: number): string {
  const ack = pickFresh([
    "Sure, let me put that another way.",
    "Fair enough — let me rephrase.",
    "No problem, I'll re-frame it.",
    "Of course. Let me be clearer.",
  ]);
  const frame = FRAMING[category] ?? "Just talk me through how you'd think about it.";
  // If they're still lost after one rephrase, strip it right back.
  if (asked >= 1) {
    return `${ack} Forget the phrasing for a moment — ${frame} Take it slowly: ${question}`;
  }
  return `${ack} ${frame} So: ${question}`;
}

export function bandFor(quality: number, raw: RawScore, answer: string): Band {
  if (isUnsure(answer)) return "unsure";
  if (raw.words < 6) return "punt";
  if (quality >= 0.72) return "strong";
  if (quality >= 0.45) return "ok";
  return "weak";
}

/** Turn a bank keyword into something an interviewer would actually say. */
export function pretty(keyword: string): string {
  const map: Record<string, string> = {
    "pr/t": "the hoop stress formula",
    "pr/2t": "the axial stress",
    "cl squared": "the CL-squared dependence",
    "pi e ar": "the πeAR term",
    "1/cos": "the 1/cos φ relation",
    "sqrt n": "the √n scaling",
    "hl/k": "the hL/k grouping",
    "o(1)": "constant-time behaviour",
    "o(n)": "the linear case",
    "log n": "the logarithmic complexity",
    ln: "the natural log",
    "y+": "y-plus",
    star: "the STAR structure",
    mece: "keeping it MECE",
    isp: "specific impulse",
    "p-value": "the p-value",
    "a/b test": "an A/B test",
    "query key value": "the query/key/value mechanism",
    "stefan boltzmann": "the Stefan–Boltzmann law",
    tsiolkovsky: "the rocket equation",
    kutta: "the Kutta condition",
    routh: "the Routh criterion",
    kadane: "Kadane's algorithm",
    floyd: "Floyd's cycle detection",
    biot: "the Biot number",
    oswald: "the Oswald factor",
    "l/d": "the L/D ratio",
    "t/c": "thickness-to-chord",
    "w/s": "wing loading",
    "y plus": "y-plus",
    "k-omega": "the k-ω model",
    "k omega": "the k-ω model",
    rans: "RANS",
    sst: "the SST model",
    "2am": "the enclosed-area term",
    "t/2am": "the Bredt–Batho relation",
  };
  return map[keyword.toLowerCase()] ?? keyword;
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/**
 * Recently-spoken lines, so the panel doesn't repeat the same sentence turn
 * after turn — the fastest way to sound like a bot.
 */
const recent: string[] = [];
const RECENT_MEMORY = 6;

/**
 * Fingerprint a line by its opening words. Two lines from different pools can
 * share an opening without being equal — "That's fine, honestly." followed by
 * "That's fine, let's move on." reads as a stutter even though the strings
 * differ — so freshness is judged on the opening, not the whole sentence.
 */
function headWords(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

/**
 * Pick a continuation that doesn't echo the opening it will be appended to.
 * These come from separate pools, so nothing else stops "That's fine, honestly."
 * being followed by "That's fine, let's move on."
 */
function follow(open: string, options: string[]): string {
  const head = headWords(open);
  const ok = options.filter((o) => headWords(o) !== head);
  return pick(ok.length ? ok : options);
}

/** Pick a phrase that hasn't been used in the last few turns, if possible. */
function pickFresh(options: string[]): string {
  const seen = new Set(recent.map(headWords));
  const fresh = options.filter((o) => !recent.includes(o) && !seen.has(headWords(o)));
  // Fall back to plain string-freshness, then to anything, so a small pool
  // never deadlocks just because every option shares an opening.
  const pool = fresh.length ? fresh : options.filter((o) => !recent.includes(o));
  const choice = pick(pool.length ? pool : options);
  recent.push(choice);
  if (recent.length > RECENT_MEMORY) recent.shift();
  return choice;
}

/* ---------- reactions, by interviewer style and answer quality ---------- */

const REACT: Record<Interviewer["style"], Record<Band, string[]>> = {
  warm: {
    strong: ["That's a really clear answer.", "Yes — nicely put.", "Good, that's the thinking I was hoping for.", "I like that. You explained it well."],
    ok: ["Okay, that's a reasonable start.", "Right, you're heading the right way.", "That's part of it, yes.", "Mm-hm — and there's a bit more to it."],
    weak: ["Okay — let's slow down a second.", "Hmm, I think we're not quite there.", "Let me help you get to it.", "Not quite what I was after."],
    unsure: ["That's completely fine — it's a hard one.", "No problem at all.", "That's okay, it happens.", "Fair enough — I'd rather you say so than guess."],
    punt: ["Take your time — have a proper go at it.", "That's very brief. Talk me through your thinking.", "Don't worry about being perfect — just reason out loud."],
  },
  skeptical: {
    strong: ["Alright, that holds up.", "Fine — you clearly know it.", "Good. I was ready to push, but that's right.", "Correct."],
    ok: ["Partly. You're glossing over something.", "That's the textbook line — but do you understand it?", "Hmm. Half an answer.", "You're circling it without landing on it."],
    weak: ["No, I don't think that's right.", "That's hand-wavy. Be precise.", "I'm not convinced.", "That doesn't follow."],
    unsure: ["Alright — at least you're honest about it.", "Fine. Better than bluffing.", "Okay. I'd rather hear that than waffle.", "Noted."],
    punt: ["That's not an answer. Give me something.", "You'll need to do better than that.", "Say more — I can't assess silence."],
  },
  formal: {
    strong: ["Correct.", "That is the right treatment, yes.", "Acceptable — well reasoned.", "Precisely."],
    ok: ["Partially correct.", "You have the outline. The detail is missing.", "That is acceptable as far as it goes.", "Reasonable, though incomplete."],
    weak: ["That is not correct.", "Let us be precise — that reasoning does not hold.", "I am afraid that is not right.", "No. Go back to first principles."],
    unsure: ["Very well — that is an acceptable thing to say.", "Understood. Honesty is preferable to a guess.", "That is noted, and it is not a problem.", "Fine."],
    punt: ["Please attempt the question properly.", "I need a complete answer.", "Elaborate."],
  },
  curious: {
    strong: ["Oh, nice — you went straight to it.", "Yes! And that's exactly why it matters.", "Good, that's the interesting part.", "Right — I like how you got there."],
    ok: ["Interesting. But I want to dig into that.", "Okay — say more about that.", "Hmm, partly. Keep pulling on that thread.", "You're close. What else?"],
    weak: ["Hmm, I don't think that's quite the mechanism.", "Let's back up — what's actually happening physically?", "That doesn't sound right to me.", "I'd challenge that."],
    unsure: ["That's alright — nobody knows everything.", "No worries. It's a fair thing to not have met before.", "That's fine, honestly.", "Okay — happens to all of us."],
    punt: ["Come on — think out loud, I want to hear the reasoning.", "Even a guess, if you reason it through.", "What's your instinct?"],
  },
  rapid: {
    strong: ["Good. Next.", "Correct.", "Yep, that's it.", "Right."],
    ok: ["Partly. Moving on.", "Okay, half marks.", "Close enough — tighten it."],
    weak: ["No.", "Not quite.", "That's not it."],
    unsure: ["Fine — moving on.", "Okay, no problem.", "Right, skip it."],
    punt: ["Quickly — answer.", "I need something.", "Come on."],
  },
};

/**
 * A steer offered after the candidate says they don't know. Deliberately
 * generic — it restarts their thinking without handing over the answer.
 */
const STEERS = [
  "Try it from first principles — what related thing do you know?",
  "Don't worry about the exact result. What's the physical picture?",
  "Have a go at reasoning it out loud, even if you land in the wrong place.",
  "What would you check first if you had to work it out?",
  "Give me your instinct and the reasoning behind it — that's what I'm assessing.",
];

const MOVE_ON = [
  "Let's not dwell on it.",
  "We'll leave that one.",
  "No matter — let's keep going.",
  "That's fine, let's move on.",
];

function creditLine(raw: RawScore): string | null {
  if (!raw.matched.length) return null;
  const c = pretty(pick(raw.matched));
  return pick([
    `You got to ${c}, which is the key bit.`,
    `Good that you mentioned ${c}.`,
    `${c.charAt(0).toUpperCase() + c.slice(1)} — yes, that's central.`,
  ]);
}

/**
 * Probe toward what's missing WITHOUT naming it — naming it would hand the
 * candidate the answer mid-interview.
 */
function gapProbe(band: Band): string | null {
  if (band === "strong") {
    return Math.random() < 0.35
      ? pickFresh(["There's one more piece I'd have liked in there.", "Anything you'd add to that?"])
      : null;
  }
  // Only probe some of the time — constant probing reads as nagging.
  if (Math.random() < 0.3) return null;
  return pickFresh([
    "There's something important you haven't touched on yet.",
    "You're missing a piece — what else is going on?",
    "What haven't you considered?",
    "There's more to it than that.",
    "Keep going — that's not the whole picture.",
    "What else would you need to account for?",
  ]);
}

const PRESSURE = [
  "Convince me you understand this rather than remember it.",
  "I'm going to push on that.",
  "Take it from first principles for me.",
];

const EXPAND = [
  "Can you expand on that?",
  "Go deeper for me.",
  "Walk me through the reasoning, not just the result.",
];

/**
 * Verdicts used when the panel is about to change topic. These CLOSE the
 * question instead of opening a new thread — see the willWait note below.
 */
const CLOSING_VERDICT = [
  "There was more to that one, but let's keep moving.",
  "I'd have wanted a bit more there.",
  "Okay — I've got what I need on that.",
  "We'll leave it there.",
];

export interface Reaction {
  text: string;
  band: Band;
  /** True when the panel should stay on this question and let them retry. */
  retry: boolean;
}

/**
 * The interviewer's reaction to an answer, before the next question.
 *
 * `willWait` says whether the panel is about to pause for a reply. It must be
 * false whenever the caller will append a different question, because an open
 * probe ("what else is going on?") glued to a topic change reads as the panel
 * asking something and abandoning it mid-breath — the single most artificial
 * thing the offline engine used to do. When we aren't waiting, the reaction
 * closes the question instead of opening a thread.
 */
export function reactionTo(
  raw: RawScore,
  quality: number,
  interviewer: Interviewer,
  difficulty: Difficulty,
  answer: string,
  unsureAlready: boolean,
  willWait: boolean
): Reaction {
  const band = bandFor(quality, raw, answer);
  // Several reaction openers are themselves questions ("Let's back up — what's
  // actually happening physically?"). When nobody is waiting for a reply those
  // dangle exactly like a gap probe does, so the pool is narrowed to lines
  // that close rather than open.
  const allOpeners = REACT[interviewer.style][band];
  const closing = allOpeners.filter((l) => !l.includes("?"));
  const open = pickFresh(willWait || !closing.length ? allOpeners : closing);

  // "I don't know" — acknowledge, offer one steer, then let it go.
  if (band === "unsure") {
    if (!unsureAlready) {
      return { text: `${open} ${follow(open, STEERS)}`, band, retry: true };
    }
    return { text: `${open} ${follow(open, MOVE_ON)}`, band, retry: false };
  }

  // A one-liner that isn't an admission of ignorance — push for substance.
  if (band === "punt") {
    return { text: `${open} ${follow(open, EXPAND)}`, band, retry: true };
  }

  const parts = [open];
  const credit = band === "strong" || band === "ok" ? creditLine(raw) : null;
  if (credit && Math.random() < 0.7) parts.push(credit);

  // Only open a thread if someone is going to wait for the answer.
  if (willWait) {
    const probe = gapProbe(band);
    if (probe) parts.push(probe);
    const hard = ["senior", "principal", "research-scientist"].includes(difficulty);
    if (hard && band === "weak" && Math.random() < 0.3) parts.push(pick(PRESSURE));
  } else if (band === "weak" && Math.random() < 0.3) {
    // Kept occasional — the caller usually adds a bridge and a handoff after
    // this, and three stacked clauses reads as padding.
    parts.push(follow(parts[parts.length - 1], CLOSING_VERDICT));
  }

  return { text: parts.join(" "), band, retry: false };
}

/**
 * Bridge into the next question by referencing what the candidate actually
 * said. Without this the panel visibly ignores the answer it just heard.
 */
export function bridge(concept: string | null, sameTopic: boolean): string | null {
  if (!concept) return null;
  const c = pretty(concept);
  return sameTopic
    ? pick([`Staying with that — you brought up ${c}.`, `Let's stay on ${c} for a moment.`])
    : pick([`You mentioned ${c} — I want to come at this from another angle.`, `Picking up from ${c}.`]);
}

/** Handing over to the next question, in this interviewer's voice. */
export function transition(sameInterviewer: boolean, next: Interviewer, question: string): string {
  if (sameInterviewer) {
    return `${pick(["Let's move on.", "Next one.", "Okay, different topic.", "Moving on.", "Right —"])} ${question}`;
  }
  // Never name the next panelist twice, and never "hand over" to yourself.
  return `${pick([
    "Let me bring in a colleague.",
    "I'll hand over from here.",
    "I'll pass you across.",
  ])} — ${next.name} here, ${next.role}. ${question}`;
}

/** A second panelist cutting in. */
export function interruption(speaker: Interviewer, followUp: string): string {
  return `${pick([
    "Sorry, can I jump in —",
    "If I may —",
    "Let me interrupt there.",
    "Quick one from me —",
  ])} ${speaker.name} here. ${followUp}`;
}

/** Opening line of the interview. */
export function opener(lead: Interviewer, difficulty: Difficulty, company: string, question: string): string {
  const greet: Record<Difficulty, string> = {
    beginner: `Hi, welcome — thanks for coming in. I'm ${lead.name}, ${lead.role} here at ${company}. Relax, there are no trick questions today; just think out loud.`,
    intermediate: `Good to meet you. I'm ${lead.name}, ${lead.role} at ${company}. We'll cover a few areas — talk me through your reasoning as you go.`,
    advanced: `Thanks for joining. ${lead.name}, ${lead.role}. I'll warn you now: I'll push on your answers, so be ready to defend them.`,
    senior: `Hello — ${lead.name}, ${lead.role}. At this level we're assessing judgement as much as knowledge, so tell me how you'd decide, not just what you know.`,
    principal: `${lead.name} here, ${lead.role}. These will be deliberately open-ended. Structure your thinking out loud — that's most of what I'm listening for.`,
    "research-scientist": `${lead.name}, ${lead.role}. I'll expect first-principles reasoning and I'll challenge essentially every claim you make. Ready?`,
  };
  return `${greet[difficulty]} Let's start: ${question}`;
}

/** Closing line. */
export function closer(band: Band, company: string): string {
  const warm = pick(["That's all the time we have.", "Right, I think that's us done.", "Okay, we'll stop there."]);
  const sign =
    band === "strong"
      ? "Thanks — that was a good discussion."
      : band === "unsure"
      ? "Thanks for being straight with me where you weren't sure."
      : "Thanks for taking the time.";
  return `${warm} ${sign} We'll be in touch through ${company} recruitment. Your full report is ready now.`;
}
