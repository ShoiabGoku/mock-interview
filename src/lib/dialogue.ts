import type { BankQuestion, Difficulty, Interviewer } from "./types";
import type { RawScore } from "./scoring";

/**
 * Natural interviewer speech for the offline engine.
 *
 * The goal is that a line should sound like a person who actually listened:
 * it reacts to *what the candidate said* (naming a concept they covered or
 * one they skipped), it varies with the interviewer's personality, and it
 * pushes back when an answer is thin — rather than emitting one of four
 * canned acknowledgements.
 */

type Band = "strong" | "ok" | "weak" | "punt";

export function bandFor(quality: number, raw: RawScore): Band {
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
  };
  return map[keyword.toLowerCase()] ?? keyword;
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/* ---------- reactions, by interviewer style and answer quality ---------- */

const REACT: Record<Interviewer["style"], Record<Band, string[]>> = {
  warm: {
    strong: ["That's a really clear answer.", "Yes — nicely put.", "Good, that's the thinking I was hoping for.", "I like that. You explained it well."],
    ok: ["Okay, that's a reasonable start.", "Right, you're heading the right way.", "That's part of it, yes.", "Mm-hm, and there's a bit more to it."],
    weak: ["Okay — let's slow down a second.", "I think we're missing something here.", "Hmm. Let me help you get there.", "Not quite what I was after."],
    punt: ["Take your time — have a proper go at it.", "That's very brief. Talk me through your thinking.", "Don't worry about being perfect — just reason out loud."],
  },
  skeptical: {
    strong: ["Alright, that holds up.", "Fine — you clearly know it.", "Good. I was ready to push, but that's right.", "Correct. Let's see if it holds under pressure."],
    ok: ["Partly. You're glossing over something.", "That's the textbook line — but do you understand it?", "Hmm. Half an answer.", "You're circling it without landing on it."],
    weak: ["No, I don't think that's right.", "That's hand-wavy. Be precise.", "I'm not convinced at all.", "That doesn't follow. Try again."],
    punt: ["That's not an answer. Give me something.", "You'll need to do better than that.", "Say more — I can't assess silence."],
  },
  formal: {
    strong: ["Correct.", "That is the right treatment, yes.", "Acceptable — well reasoned.", "Precisely. Good."],
    ok: ["Partially correct.", "You have the outline. The detail is missing.", "That is acceptable as far as it goes.", "Reasonable, though incomplete."],
    weak: ["That is not correct.", "Let us be precise — that reasoning does not hold.", "I am afraid that is wrong.", "No. Go back to first principles."],
    punt: ["Please attempt the question properly.", "I need a complete answer.", "Elaborate."],
  },
  curious: {
    strong: ["Oh, nice — you went straight to it.", "Yes! And that's exactly why it matters.", "Good, that's the interesting part.", "Right — I like how you got there."],
    ok: ["Interesting. But I want to dig into that.", "Okay — say more about that.", "Hmm, that's partly it. Keep pulling on that thread.", "You're close. What else?"],
    weak: ["Hmm, I don't think that's quite the mechanism.", "Let's back up — what's actually happening physically?", "That doesn't sound right to me. Think again.", "I'd challenge that."],
    punt: ["Come on — think out loud, I want to hear the reasoning.", "Even a guess, if you reason it through.", "What's your instinct?"],
  },
  rapid: {
    strong: ["Good. Next.", "Correct.", "Yep, that's it.", "Right."],
    ok: ["Partly. Moving on.", "Okay, half marks.", "Close enough — but tighten it."],
    weak: ["No.", "Wrong. Think.", "That's not it."],
    punt: ["Quickly — answer.", "I need something.", "Come on."],
  },
};

/* ---------- content-aware follow-on remarks ---------- */

function creditLine(raw: RawScore): string | null {
  if (!raw.matched.length) return null;
  const c = pretty(pick(raw.matched));
  return pick([
    `You got to ${c}, which is the key bit.`,
    `Good that you mentioned ${c}.`,
    `${c.charAt(0).toUpperCase() + c.slice(1)} — yes, that's central.`,
  ]);
}

function gapLine(raw: RawScore, band: Band): string | null {
  if (!raw.missing.length) return null;
  const c = pretty(raw.missing[0]);
  if (band === "strong") {
    return pick([`One thing you didn't touch: ${c}.`, `I'd have liked to hear ${c} in there too.`]);
  }
  return pick([
    `You haven't mentioned ${c} at all — that's what I'm listening for.`,
    `What about ${c}?`,
    `I notice ${c} is missing from your answer.`,
    `Where does ${c} come into this?`,
  ]);
}

const PRESSURE = [
  "Convince me you actually understand this rather than remembering it.",
  "I'm going to push on that.",
  "Be careful — I've seen people get this wrong confidently.",
  "Take it from first principles for me.",
];

const EXPAND = [
  "Can you expand on that?",
  "Go deeper for me.",
  "Walk me through the reasoning, not just the result.",
  "Give me the why, not just the what.",
];

/**
 * The interviewer's reaction to an answer, before the next question.
 * `hard` adds pressure lines at senior/principal/research difficulties.
 */
export function reactionTo(
  raw: RawScore,
  quality: number,
  interviewer: Interviewer,
  difficulty: Difficulty
): { text: string; band: Band } {
  const band = bandFor(quality, raw);
  const parts: string[] = [pick(REACT[interviewer.style][band])];

  if (band === "punt") {
    parts.push(pick(EXPAND));
    return { text: parts.join(" "), band };
  }

  const credit = band === "strong" || band === "ok" ? creditLine(raw) : null;
  const gap = gapLine(raw, band);

  if (credit && Math.random() < 0.75) parts.push(credit);
  if (gap && (band !== "strong" || Math.random() < 0.4)) parts.push(gap);

  const hard = ["senior", "principal", "research-scientist"].includes(difficulty);
  if (hard && band !== "strong" && Math.random() < 0.35) parts.push(pick(PRESSURE));

  return { text: parts.join(" "), band };
}

/** Handing over to the next question, in this interviewer's voice. */
export function transition(sameInterviewer: boolean, next: Interviewer, question: string): string {
  if (sameInterviewer) {
    return `${pick(["Let's move on.", "Next one.", "Okay, different topic.", "Moving on.", "Right —"])} ${question}`;
  }
  return `${pick([
    `I'll hand over to my colleague.`,
    `Let me bring in ${next.name}.`,
    `${next.name}, do you want to take it from here?`,
  ])} — ${next.name} here, ${next.role}. ${question}`;
}

/** A second panelist cutting in. */
export function interruption(speaker: Interviewer, followUp: string): string {
  return `${pick([
    `Sorry, can I jump in —`,
    `If I may —`,
    `Let me interrupt there.`,
    `Quick one from me —`,
  ])} ${speaker.name} here. ${followUp}`;
}

/** Opening line of the interview. */
export function opener(lead: Interviewer, difficulty: Difficulty, company: string, question: string): string {
  const greet: Record<Difficulty, string> = {
    beginner: `Hi, welcome — thanks for coming in. I'm ${lead.name}, ${lead.role} here at ${company}. Relax, there are no trick questions today; just think out loud.`,
    intermediate: `Good to meet you. I'm ${lead.name}, ${lead.role} at ${company}. We'll cover a few areas — talk me through your reasoning as you go.`,
    advanced: `Thanks for joining. ${lead.name}, ${lead.role}. I'll warn you now: I'll push on your answers, so be ready to defend them.`,
    senior: `Hello — ${lead.name}, ${lead.role}. At this level we're assessing judgement as much as knowledge, so tell me how you'd decide, not just what you know.`,
    principal: `${lead.name} here, ${lead.role}. These will be deliberately open-ended and ambiguous. Structure your thinking out loud — that's most of what I'm listening for.`,
    "research-scientist": `${lead.name}, ${lead.role}. I'll expect first-principles reasoning and I'll challenge essentially every claim you make. Ready?`,
  };
  return `${greet[difficulty]} Let's start: ${question}`;
}

/** Closing line. */
export function closer(band: Band, company: string): string {
  const warm = pick([
    "That's all the time we have.",
    "Right, I think that's us done.",
    "Okay, we'll stop there.",
  ]);
  const sign = band === "strong"
    ? "Thanks — that was a good discussion."
    : band === "ok"
    ? "Thanks for taking the time."
    : "Thanks for coming in.";
  return `${warm} ${sign} We'll be in touch through ${company} recruitment. Your full report is ready now.`;
}
