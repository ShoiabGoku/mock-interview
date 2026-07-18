import type { BankQuestion } from "./types";

/**
 * Answer evaluation for the offline engine.
 *
 * The first version matched a question's keywords as raw substrings, which
 * failed constantly on correct answers: saying "natural log" when the keyword
 * was "ln", "3,466" when it was "3466", or "tip vortices" when it was
 * "tip vortex". This version normalizes text, expands each keyword into
 * accepted variants (synonyms, plural/singular, punctuation-free), matches
 * numbers with tolerance, and falls back to token-subset matching for
 * multi-word concepts.
 */

const HEDGES = ["um", "uh", "erm", "i guess", "maybe", "sort of", "kind of", "probably", "not sure", "i don't know", "no idea", "i forget"];
const STRUCTURE_MARKERS = ["first", "second", "third", "then", "next", "finally", "because", "therefore", "so that", "trade-off", "tradeoff", "for example", "on the other hand", "however", "step", "which means", "that gives", "in other words"];
const CONFIDENCE_MARKERS = ["clearly", "definitely", "the key", "specifically", "in fact", "precisely", "i led", "i built", "i designed", "i decided", "i verified", "we found", "which gives", "so the answer"];

/**
 * Accepted phrasings for concepts that candidates express many ways.
 * Key is the canonical keyword used in the question bank (normalized).
 */
const SYNONYMS: Record<string, string[]> = {
  ln: ["ln", "natural log", "natural logarithm", "log base e", "log of"],
  "log n": ["log n", "logarithmic", "log time", "logn", "base 2 log"],
  sqrt: ["sqrt", "square root", "root of", "under root"],
  "o(1)": ["o 1", "constant time", "constant"],
  "o(n)": ["o n", "linear time", "linear"],
  kutta: ["kutta", "kutta condition", "kutta joukowski", "joukowski"],
  "tip vortices": ["tip vortices", "tip vortex", "wingtip vortices", "wingtip vortex", "trailing vortices"],
  downwash: ["downwash", "induced angle", "induced downwash"],
  "drag divergence": ["drag divergence", "divergence mach", "critical mach", "wave drag onset"],
  "wave drag": ["wave drag", "shock drag", "compressibility drag"],
  "angle of attack": ["angle of attack", "aoa", "alpha", "incidence"],
  "aspect ratio": ["aspect ratio", "ar", "span loading"],
  oswald: ["oswald", "efficiency factor", "span efficiency"],
  "cl squared": ["cl squared", "cl 2", "lift coefficient squared", "cl^2"],
  "pi e ar": ["pi e ar", "pi ear", "pi times e times ar", "pi e a r"],
  bernoulli: ["bernoulli", "pressure velocity", "total pressure"],
  newton: ["newton", "third law", "momentum", "reaction"],
  "pressure difference": ["pressure difference", "pressure differential", "delta p", "suction", "lower pressure"],
  circulation: ["circulation", "gamma", "vortex strength", "bound vortex"],
  "shear flow": ["shear flow", "shear", "torsion", "shear stress"],
  "pr/t": ["pr/t", "pr t", "p r over t", "hoop formula"],
  "pr/2t": ["pr/2t", "pr 2t", "p r over 2 t", "half the hoop"],
  hoop: ["hoop", "circumferential", "tangential stress"],
  axial: ["axial", "longitudinal", "meridional"],
  buckling: ["buckling", "buckle", "instability", "crippling"],
  slenderness: ["slenderness", "slenderness ratio", "l over r", "radius of gyration"],
  "propulsive efficiency": ["propulsive efficiency", "froude efficiency", "eta p", "propulsion efficiency"],
  bypass: ["bypass", "bypass ratio", "bpr", "fan"],
  "exhaust velocity": ["exhaust velocity", "jet velocity", "ve", "exit velocity"],
  "mass flow": ["mass flow", "mdot", "m dot", "mass flow rate"],
  tsiolkovsky: ["tsiolkovsky", "rocket equation", "ideal rocket"],
  staging: ["staging", "stages", "multi stage", "drop tanks", "stage"],
  "dead mass": ["dead mass", "structural mass", "dry mass", "empty mass", "inert mass"],
  isp: ["isp", "specific impulse"],
  biot: ["biot", "bi", "biot number"],
  "hl/k": ["hl/k", "h l over k", "hlc/k", "h lc k"],
  "internal resistance": ["internal resistance", "conduction resistance", "internal conduction"],
  "uniform temperature": ["uniform temperature", "lumped", "same temperature", "isothermal"],
  "stefan boltzmann": ["stefan boltzmann", "stefan", "sigma t4", "t to the fourth", "t^4"],
  absorptivity: ["absorptivity", "alpha", "absorption"],
  emissivity: ["emissivity", "epsilon", "emission"],
  "solar constant": ["solar constant", "1361", "1367", "1360", "solar flux"],
  "load factor": ["load factor", "n", "g loading", "gs"],
  "1/cos": ["1/cos", "1 over cos", "one over cosine", "sec", "secant"],
  "stall speed": ["stall speed", "vs", "stalling speed"],
  "sqrt n": ["sqrt n", "square root of n", "root n", "square root of the load factor"],
  phugoid: ["phugoid", "long period", "speed altitude exchange"],
  "short period": ["short period", "fast mode", "pitch oscillation"],
  routh: ["routh", "routh hurwitz", "hurwitz", "routh array"],
  "damping ratio": ["damping ratio", "zeta", "damping"],
  "natural frequency": ["natural frequency", "omega n", "wn", "undamped frequency"],
  overshoot: ["overshoot", "peak overshoot", "os"],
  kadane: ["kadane", "kadanes", "maximum subarray", "running sum"],
  "dynamic programming": ["dynamic programming", "dp", "memoization", "subproblems"],
  floyd: ["floyd", "floyds", "tortoise", "hare", "cycle detection"],
  "slow fast": ["slow fast", "two pointer", "two pointers", "fast and slow", "slow and fast"],
  "hash map": ["hash map", "hashmap", "hash table", "dictionary", "map", "set"],
  "collision": ["collision", "collisions", "hash collision"],
  "load factor hash": ["load factor", "fill ratio"],
  bias: ["bias", "underfit", "underfitting"],
  variance: ["variance", "overfit", "overfitting"],
  regularization: ["regularization", "l1", "l2", "dropout", "weight decay", "ridge", "lasso"],
  "class imbalance": ["class imbalance", "imbalanced", "skewed classes", "majority class"],
  precision: ["precision", "positive predictive"],
  recall: ["recall", "sensitivity", "true positive rate"],
  "confusion matrix": ["confusion matrix", "false positives", "false negatives"],
  attention: ["attention", "self attention", "scaled dot product"],
  "query key value": ["query key value", "qkv", "queries keys values", "q k v"],
  softmax: ["softmax", "normalized weights"],
  parallel: ["parallel", "parallelizable", "parallelism", "no recurrence"],
  quadratic: ["quadratic", "n squared", "o n2", "n^2"],
  "a/b test": ["a/b test", "ab test", "split test", "randomized experiment", "controlled experiment"],
  "sample size": ["sample size", "power", "powered", "mde"],
  "p-value": ["p value", "p-value", "significance", "statistically significant"],
  confounder: ["confounder", "confounding", "lurking variable", "common cause"],
  causation: ["causation", "causal", "cause"],
  randomized: ["randomized", "randomisation", "randomization", "rct", "random assignment"],
  "expected value": ["expected value", "expectation", "mean", "e of x"],
  geometric: ["geometric", "geometric distribution"],
  recurrence: ["recurrence", "recursive equation", "states"],
  combinatorics: ["combinatorics", "counting", "combinations", "permutations"],
  structure: ["structure", "framework", "break it down", "buckets", "segments"],
  mece: ["mece", "mutually exclusive", "collectively exhaustive", "no overlap"],
  hypothesis: ["hypothesis", "hypothesise", "hypothesize", "my guess is"],
  star: ["star", "situation task action result", "situation", "sitation"],
  ownership: ["ownership", "i owned", "i took responsibility", "my fault", "i was responsible"],
  "trade-off": ["trade off", "tradeoff", "trade-off", "compromise", "at the cost of"],
  bottleneck: ["bottleneck", "limiting factor", "constraint"],
  "mesh independence": ["mesh independence", "grid independence", "grid convergence", "mesh convergence", "mesh refinement"],
  "y+": ["y+", "y plus", "yplus", "wall spacing", "first cell height"],
  "turbulence model": ["turbulence model", "k omega", "k epsilon", "sst", "spalart", "rans model"],
  "boundary conditions": ["boundary conditions", "bcs", "inlet outlet", "far field"],
  convergence: ["convergence", "converged", "residuals"],
  validation: ["validation", "validate", "experimental data", "wind tunnel", "benchmark"],
  "wall function": ["wall function", "wall functions", "log law"],
  "viscous sublayer": ["viscous sublayer", "sublayer", "laminar sublayer"],
  skin: ["skin", "skins", "panel"],
  stringers: ["stringers", "stringer", "longerons", "longeron", "stiffeners"],
  frames: ["frames", "frame", "formers", "bulkheads", "ribs"],
  bending: ["bending", "bending moment", "flexure"],
};

export interface RawScore {
  technical: number;
  communication: number;
  confidence: number;
  depth: number;
  structure: number;
  matched: string[];
  missing: string[];
  words: number;
  /** 0-1 fraction of expected concepts covered. */
  coverage: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    // "3,466" -> "3466" before commas become separators
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    // "delta-v" -> "delta v", "pr/t" -> "pr t" so token matching works
    .replace(/[-/]/g, " ")
    .replace(/[^a-z0-9.+^ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  return w;
}

function numbersIn(s: string): number[] {
  const out: number[] = [];
  // strip thousands separators first: 3,466 -> 3466
  const cleaned = s.replace(/(\d),(?=\d{3}\b)/g, "$1");
  for (const m of cleaned.matchAll(/-?\d+(?:\.\d+)?/g)) {
    const n = Number(m[0]);
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

/**
 * Synonym table re-keyed through the same normalization the answers get, so a
 * key like "pr/t" is still found once slashes have become spaces.
 */
const SYN_INDEX: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [k, list] of Object.entries(SYNONYMS)) {
    out[normalize(k)] = list.map(normalize);
  }
  return out;
})();

/** Variants that should all count as expressing the same keyword. */
function variantsOf(keyword: string): string[] {
  const k = normalize(keyword);
  const set = new Set<string>([k]);
  for (const s of SYN_INDEX[k] ?? []) set.add(s);
  // punctuation-free and separator-swapped forms
  set.add(k.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim());
  set.add(k.replace(/[-/]/g, " "));
  set.add(k.replace(/\s/g, ""));
  return [...set].filter(Boolean);
}

/** Does the answer express this keyword? */
function matchesKeyword(
  answerNorm: string,
  answerStems: Set<string>,
  answerNums: number[],
  keyword: string
): boolean {
  const variants = variantsOf(keyword);

  // Pure-number keywords (e.g. "3466", "1.8"): accept within 2% or 0.05 abs.
  const kwNums = numbersIn(normalize(keyword));
  const kwIsNumeric = /^[\d.,\s]+$/.test(keyword.trim()) && kwNums.length > 0;
  if (kwIsNumeric) {
    const target = kwNums[0];
    return answerNums.some((n) => {
      const tol = Math.max(Math.abs(target) * 0.02, 0.05);
      return Math.abs(n - target) <= tol;
    });
  }

  for (const v of variants) {
    if (!v) continue;
    if (answerNorm.includes(v)) return true;
    // multi-word: accept if every (stemmed) word appears somewhere
    const words = v.split(" ").filter((w) => w.length > 1);
    if (words.length > 1 && words.every((w) => answerStems.has(stem(w)))) return true;
    // single word: stem match
    if (words.length === 1 && answerStems.has(stem(words[0]))) return true;
  }
  return false;
}

export function keywordCoverage(answer: string, keywords: string[]): { matched: string[]; missing: string[] } {
  const answerNorm = normalize(answer);
  const answerStems = new Set(answerNorm.split(" ").map(stem));
  const answerNums = numbersIn(answerNorm);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) {
    if (matchesKeyword(answerNorm, answerStems, answerNums, k)) matched.push(k);
    else missing.push(k);
  }
  return { matched, missing };
}

/** Per-answer scoring. Curves are deliberately forgiving of phrasing. */
export function scoreAnswer(answer: string, q: BankQuestion): RawScore {
  const text = answer.trim();
  const norm = normalize(text);
  const words = text ? text.split(/\s+/).length : 0;
  const { matched, missing } = keywordCoverage(text, q.keywords);
  const coverage = q.keywords.length ? matched.length / q.keywords.length : 0.5;

  const said = (list: string[]) => list.filter((m) => norm.includes(m)).length;
  const hedgeHits = said(HEDGES);
  const structureHits = said(STRUCTURE_MARKERS);
  const confHits = said(CONFIDENCE_MARKERS);

  // An explicit "I don't know" is honest but scores low technically.
  const punted = /\b(i (do not|dont|don t) know|no idea|not sure at all)\b/.test(norm) && words < 25;

  // Technical: concave curve so partial-but-correct coverage is rewarded.
  // 50% coverage ≈ 6.2/10, 70% ≈ 7.8, 100% = 10.
  const technical = punted
    ? 1
    : clamp(Math.round(10 * Math.pow(coverage, 0.62) + (words > 60 ? 0.5 : 0)), 0, 10);

  // Depth: coverage plus substance, but a short precise answer isn't punished hard.
  const lengthDepth = words < 8 ? 0 : words < 25 ? 2.5 : words < 60 ? 4 : words < 140 ? 5 : 4.5;
  const depth = punted ? 1 : clamp(Math.round(coverage * 5 + lengthDepth), 0, 10);

  const structure = clamp(Math.round(4 + structureHits * 1.3 + (words > 45 ? 1.2 : 0)), 0, 10);
  const confidence = clamp(Math.round(6.5 + confHits * 1.1 - hedgeHits * 1.6 - (punted ? 3 : 0)), 0, 10);

  const band = words >= 20 && words <= 220 ? 2 : words < 6 ? -3.5 : 0;
  const communication = clamp(Math.round(6 + band + structureHits * 0.7 - hedgeHits * 1.1), 0, 10);

  return { technical, communication, confidence, depth, structure, matched, missing, words, coverage };
}

/** Overall quality 0-1 used to pick the panel's reaction. */
export function answerQuality(s: { technical: number; depth: number; communication: number; confidence: number }): number {
  return (s.technical * 0.45 + s.depth * 0.25 + s.communication * 0.17 + s.confidence * 0.13) / 10;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
