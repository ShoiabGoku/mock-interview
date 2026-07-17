import type { BankQuestion } from "./types";

const HEDGES = ["um", "uh", "like", "i guess", "maybe", "sort of", "kind of", "i think", "probably", "not sure", "i don't know"];
const STRUCTURE_MARKERS = ["first", "second", "third", "then", "next", "finally", "because", "therefore", "so that", "trade-off", "tradeoff", "for example", "on the other hand", "however", "step"];
const CONFIDENCE_MARKERS = ["clearly", "definitely", "the key", "specifically", "in fact", "precisely", "i led", "i built", "i designed", "i decided", "i verified"];

export interface RawScore {
  technical: number;      // 0-10 keyword coverage
  communication: number;  // 0-10
  confidence: number;     // 0-10
  depth: number;          // 0-10
  structure: number;      // 0-10
  matched: string[];
  missing: string[];
}

/** How many of the ideal keywords the answer covers (substring, tolerant). */
export function keywordCoverage(answer: string, keywords: string[]): { matched: string[]; missing: string[] } {
  const lc = answer.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) {
    if (lc.includes(k.toLowerCase())) matched.push(k);
    else missing.push(k);
  }
  return { matched, missing };
}

/** Heuristic per-answer scoring used by the scripted engine. */
export function scoreAnswer(answer: string, q: BankQuestion): RawScore {
  const text = answer.trim();
  const lc = text.toLowerCase();
  const words = text ? text.split(/\s+/).length : 0;
  const { matched, missing } = keywordCoverage(text, q.keywords);

  // Technical: fraction of keywords hit, scaled; empty answer floors near zero.
  const coverage = q.keywords.length ? matched.length / q.keywords.length : 0.5;
  const technical = clamp(Math.round(coverage * 10 + (words > 12 ? 1 : 0)), 0, 10);

  // Depth: coverage plus length reward, capped.
  const lengthDepth = words < 10 ? 0 : words < 30 ? 2 : words < 70 ? 4 : 5;
  const depth = clamp(Math.round(coverage * 5 + lengthDepth), 0, 10);

  // Structure: presence of structure markers + reasonable length.
  const structureHits = STRUCTURE_MARKERS.filter((m) => lc.includes(m)).length;
  const structure = clamp(Math.round(3 + structureHits * 1.4 + (words > 40 ? 1 : 0)), 0, 10);

  // Confidence: assertive markers up, hedges down.
  const confHits = CONFIDENCE_MARKERS.filter((m) => lc.includes(m)).length;
  const hedgeHits = HEDGES.filter((m) => lc.includes(m)).length;
  const confidence = clamp(Math.round(6 + confHits * 1.2 - hedgeHits * 1.3), 0, 10);

  // Communication: length in a good band, low filler, decent structure.
  const band = words >= 25 && words <= 160 ? 2 : words < 8 ? -3 : 0;
  const communication = clamp(Math.round(6 + band + structureHits * 0.8 - hedgeHits * 1.0), 0, 10);

  return { technical, communication, confidence, depth, structure, matched, missing };
}

/** Overall quality 0-1 used to pick the panel's reaction. */
export function answerQuality(s: RawScore): number {
  return (s.technical * 0.4 + s.depth * 0.25 + s.communication * 0.2 + s.confidence * 0.15) / 10;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
