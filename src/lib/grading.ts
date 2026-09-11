import type { AnswerCheck, BankQuestion } from "./types";

/**
 * Exact grading for questions that have ONE right answer — the numericals and
 * multiple-choice questions imported from the Myplacement test banks.
 *
 * Keyword coverage (scoring.ts) is the right tool for open discussion
 * questions, but it is the wrong tool here: "4.8 hours" either is or isn't the
 * answer, and an MCQ is decided by the option picked, not by vocabulary. So:
 *
 *   numeric — pull every number the candidate said (digits, spoken words,
 *             fractions, percentages, "2.2 lakh", "3 × 10^5") and accept one
 *             within tolerance of the key.
 *   choice  — find the option they named ("B", "option c", "the second one")
 *             or, failing that, the option their wording matches best, with
 *             distractors acting as negative examples.
 *
 * A verdict of "unclear" means they never committed (no number, no option) —
 * the panel asks them to commit rather than marking them wrong.
 */

export type GradeVerdict = "correct" | "partial" | "wrong" | "unclear";

export interface Grade {
  verdict: GradeVerdict;
  /** 0-1: how much working/justification they showed, beyond the bare answer. */
  reasoning: number;
  /** What they committed to, in words the panel can echo back ("4.8", "B"). */
  said?: string;
  /** Option indices picked (choice questions). */
  picked?: number[];
}

const LETTERS = "ABCDEFGH";

/**
 * Labels for reading options out. Normally A, B, C…; but when the options are
 * themselves letters ("D / P / T / Z" in a series question), "it's D" would be
 * ambiguous — so those are numbered instead.
 */
export function optionLabels(options: string[]): string[] {
  const letterOptions = options.length > 0 && options.every((o) => /^[A-Za-z]$/.test(o.trim()));
  return options.map((_, i) => (letterOptions ? String(i + 1) : LETTERS[i]));
}

/* ------------------------------------------------------------------ numbers */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1e3, k: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5,
  million: 1e6, crore: 1e7, crores: 1e7, cr: 1e7, billion: 1e9,
};

const isUnit = (w: string | undefined): w is string => w !== undefined && Object.hasOwn(UNITS, w);
const isScale = (w: string | undefined): w is string => w !== undefined && Object.hasOwn(SCALES, w);

/** "four point eight" -> "4.8", "two thousand two hundred" -> "2200". */
function wordsToDigits(s: string): string {
  const toks = s.split(/\s+/);
  const out: string[] = [];
  let i = 0;
  while (i < toks.length) {
    const w = toks[i];
    const startsNumber = isUnit(w) || (w === "a" && isScale(toks[i + 1]) && toks[i + 1] !== "k" && toks[i + 1] !== "cr");
    if (!startsNumber) {
      out.push(w);
      i++;
      continue;
    }
    let total = 0;
    let current = 0;
    let decimals = "";
    let inDecimal = false;
    let j = i;
    for (; j < toks.length; j++) {
      const t = toks[j];
      if (inDecimal) {
        if (isUnit(t) && UNITS[t] < 10) {
          decimals += String(UNITS[t]);
          continue;
        }
        break;
      }
      if (isUnit(t)) current += UNITS[t];
      else if (t === "a" && isScale(toks[j + 1])) current = current || 1;
      else if (t === "hundred") current = (current || 1) * 100;
      else if (isScale(t) && t !== "k" && t !== "cr") {
        total += (current || 1) * SCALES[t];
        current = 0;
      } else if (t === "and" && toks[j + 1] === "a" && toks[j + 2] === "half") {
        current += 0.5;
        j += 2;
      } else if (t === "and" && isUnit(toks[j + 1])) continue;
      else if (t === "point" && isUnit(toks[j + 1])) inDecimal = true;
      else break;
    }
    const value = total + current;
    out.push(decimals ? `${Math.trunc(value)}.${decimals}` : String(value));
    i = j;
  }
  return out.join(" ");
}

const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
};
const SUBSCRIPT: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "ₙ": "n",
};
/** Greek letters as they're said, so "gamma over 2" can match "γ/2". */
const GREEK: Record<string, string> = {
  α: "alpha", β: "beta", γ: "gamma", δ: "delta", Δ: "delta", ε: "epsilon", η: "eta", θ: "theta",
  λ: "lambda", μ: "mu", ν: "nu", ρ: "rho", σ: "sigma", τ: "tau", φ: "phi", ω: "omega", Ω: "omega",
};

/** Lower-case, strip separators, spell out symbols — shared by both graders. */
function prep(text: string): string {
  return text
    .replace(/[αβγδΔεηθλμνρστφωΩ]/g, (c) => ` ${GREEK[c]} `)
    .replace(/[₀-₉ₙ]/g, (c) => SUBSCRIPT[c] ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/−/g, "-")
    .replace(/[–—]/g, " - ")
    .replace(/10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, sup: string) => "10^" + [...sup].map((c) => SUPERSCRIPT[c] ?? "").join(""))
    // thousands and Indian lakh grouping: 3,466 and 1,00,000
    .replace(/(\d),(?=\d{2,3}(?:\D|$))/g, "$1")
    .replace(/₹/g, " ")
    .replace(/\brs\.?(?=\s|\d)/g, " ")
    .replace(/×/g, " x ");
}

interface Num {
  value: number;
  /** Other readings of the same token: the mantissa of 2.7e-7, 2.2 lakh as 2.2, 25% as 0.25. */
  alts: number[];
  /** Position in numberText(), for looking at the words around it. */
  index: number;
  end: number;
}

/** The answer with spoken numbers turned into digits — what numbersSaid() scans. */
function numberText(text: string): string {
  return wordsToDigits(prep(text).replace(/(\d)\s+point\s+(\d)/g, "$1.$2")).replace(/\b(minus|negative)\s+(?=\d)/g, "-");
}

const NUM_RE =
  /(-?\d+(?:\.\d+)?)(\s*(?:x|\*|times)\s*10\s*(?:\^|\*\*)?\s*(-?\d+)|e(-?\d+))?(\s*(?:\/|by|over)\s*(\d+(?:\.\d+)?))?(\s*(?:%|percent|per cent))?(\s*(hundred|thousand|lakhs?|lacs?|million|crores?|billion|k|cr)\b)?/g;

/** Every number the candidate said, with the readings a listener would accept. */
export function numbersSaid(text: string): Num[] {
  const t = numberText(text);
  const nums: Num[] = [];
  for (const m of t.matchAll(NUM_RE)) {
    const base = Number(m[1]);
    if (Number.isNaN(base)) continue;
    const alts: number[] = [];
    let value = base;
    const exp = m[3] ?? m[4];
    if (exp !== undefined) {
      value = base * Math.pow(10, Number(exp));
      alts.push(base);
    }
    if (m[6] !== undefined) {
      const den = Number(m[6]);
      if (den) {
        alts.push(value, den);
        value = value / den;
      }
    }
    if (m[7]) alts.push(value / 100);
    if (m[9]) alts.push(value * (SCALES[m[9]] ?? 1));
    nums.push({ value, alts, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return nums;
}

function toleranceFor(check: { value: number; tolerance: number }): number {
  const v = Math.abs(check.value);
  if (check.tolerance > 0) return Math.max(check.tolerance, v * 0.001);
  // Tolerance 0 on an integer means an exact count — 719 is not 720.
  if (Number.isInteger(check.value)) return 1e-9;
  return Math.max(v * 0.005, 1e-9);
}

const CONCLUSION = /(=|\bis|\bare|\bequals|\bequal to|\bgives|\bget|\bgot|\bcomes to|\bcomes out|\banswer|\bso|\btherefore|\bhence|\babout|\bapproximately|\broughly|\baround|\bnearly)\s*$/;
/** Phrases that announce a final answer, not a step. */
const FINAL_ANSWER =
  /(=|\banswer\b.{0,12}|\bequals|\bcomes (to|out( to)?)|\bi get|\bi got|\bwe get|\bthat gives|\bgives|\btherefore|\bhence|\bfinal\b.{0,12}|\bwhich is|\bits|\bit is)\s*$/;
const NEGATIVE_CUE = /\b(decrease|decreases|decreased|loss|lose|less|lower|drop|drops|fall|falls|fell|minus|negative|below|down|reduc\w*)\b/;

export function gradeNumeric(answer: string, check: { value: number; tolerance: number }, question: string): Grade {
  const nums = numbersSaid(answer);
  const reasoning = reasoningShown(answer, question);
  if (!nums.length) return { verdict: "unclear", reasoning };

  const tol = toleranceFor(check);
  const v = check.value;
  const percentQ = /%|percent|percentage/i.test(question);
  const negativeOk = v < 0 && NEGATIVE_CUE.test(answer.toLowerCase());
  const matches = (x: number) =>
    Math.abs(x - v) <= tol ||
    (negativeOk && Math.abs(Math.abs(x) - Math.abs(v)) <= tol) ||
    (percentQ && (Math.abs(x * 100 - v) <= tol || Math.abs(x / 100 - v) <= tol));

  const stemValues = numbersSaid(question).map((n) => n.value);
  const inStem = (x: number) => stemValues.some((s) => Math.abs(Math.abs(s) - Math.abs(x)) < 1e-9);
  const t = numberText(answer);

  const stated = (n: Num) => CONCLUSION.test(t.slice(Math.max(0, n.index - 24), n.index).trim());
  const hits = nums.filter((n) => [n.value, ...n.alts].some(matches));
  for (const h of hits) {
    // If the key is also a number from the question itself, repeating the
    // question back isn't an answer — count it only when stated as the result.
    const isLast = h === nums[nums.length - 1];
    if (!inStem(v) || isLast || stated(h)) {
      return { verdict: "correct", reasoning, said: formatNumber(h.value, v) };
    }
  }

  // Only numbers from the question, none stated as a result ("6 and 8 minus
  // 12"): they're still setting up, not answering. "I get 4" is an answer,
  // even when 4 also appears in the question.
  const own = nums.filter((n) => !inStem(n.value) || stated(n));
  // A number that's followed by more arithmetic ("1.4 times cost, then 25%
  // off") is working, not a final answer — ask them to finish rather than
  // mark it wrong.
  const midWorking = (n: Num) =>
    /^\s*([x×*/+=-]|(times|of|off|minus|plus|divided|multiplied|over|into|then|and then|to get)\b)/.test(t.slice(n.end)) ||
    // ...and so is the right-hand side of an unevaluated sum ("1.4 times 0.75").
    /([x×*/+]|\b(times|minus|plus|into|over|divided by|multiplied by))\s*$/.test(t.slice(Math.max(0, n.index - 16), n.index));
  // A final answer is either announced ("I get 15", "the answer is 15", "=
  // 15") or where they stopped talking ("...so 15 percent"). "Take cost as
  // 100, so the marked price is 140, then..." is steps, not an answer.
  const last = nums[nums.length - 1];
  const wordsAfter = (n: Num) => t.slice(n.end).split(/\s+/).filter(Boolean).length;
  const concluded = (n: Num) =>
    (n === last && wordsAfter(n) <= 4) || FINAL_ANSWER.test(t.slice(Math.max(0, n.index - 24), n.index).trim());
  const committed = own.filter((n) => concluded(n) && !midWorking(n));
  if (!committed.length) return { verdict: "unclear", reasoning };
  return { verdict: "wrong", reasoning, said: formatNumber(committed[committed.length - 1].value) };
}

function formatNumber(x: number, like?: number): string {
  const ref = like ?? x;
  if (Number.isInteger(ref) && Math.abs(x - Math.round(x)) < 1e-6) return Math.round(x).toLocaleString("en-IN");
  return String(Number(x.toPrecision(6)));
}

/* ------------------------------------------------------------------ choices */

const STOP = new Set(
  (
    "a an the is are was were be been being of to in on for and or it its this that these those with as by at from so " +
    "i im me my we you your think thought would will should could can answer option options choice correct right " +
    "because since which one ones go going with say said id pick choose select guess sure maybe probably " +
    "do does did yes if then than very really just also both all any some there here what why how let about hmm"
  ).split(" ")
);

function stem(w: string): string {
  if (/^\d/.test(w)) return w;
  let s = w;
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ies")) s = s.slice(0, -3) + "y";
  else if (s.length > 4 && s.endsWith("ied")) s = s.slice(0, -3) + "y";
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  if (s.length > 4 && s.endsWith("ly")) s = s.slice(0, -2);
  if (s.length > 4 && s.endsWith("e")) s = s.slice(0, -1);
  return s;
}

/** Language names that punctuation-stripping would otherwise collapse into "c". */
function langs(text: string): string {
  return text.replace(/c\+\+/g, " cpp ").replace(/c#/g, " csharp ");
}

/** Content words: stemmed, stopwords removed. */
function words(text: string): string[] {
  return wordsToDigits(
    langs(prep(text))
      .replace(/√/g, " sqrt ")
      .replace(/π/g, " pi ")
      .replace(/²/g, " squared ")
      .replace(/³/g, " cubed ")
      .replace(/(\d)\s*%/g, "$1 percent")
      .replace(/[^a-z0-9.\s]/g, " ")
      .replace(/\.(?!\d)/g, " ")
  )
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

/**
 * Words plus adjacent pairs, both order-free ("decreases by 4" matches "4%
 * decrease") and ordered (so "log n" and "n log n" stay different). `drop`
 * removes words every option shares (the "O" in O(log n)) before pairing, so
 * they neither score nor break pairs.
 */
function tokens(text: string, drop?: Set<string>): string[] {
  const ws = words(text).filter((w) => !drop?.has(w));
  const out = [...ws];
  for (let i = 0; i + 1 < ws.length; i++) {
    out.push([ws[i], ws[i + 1]].sort().join("_"), `${ws[i]}>${ws[i + 1]}`);
  }
  return out;
}

function flat(text: string): string {
  return langs(prep(text))
    .replace(/²/g, " squared ")
    .replace(/³/g, " cubed ")
    .replace(/[^a-z0-9.%\s]/g, " ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Picks {
  /** Options named on their own ("it's B"). */
  single: number[];
  /** Options named as a list ("A, B and D"). */
  listed: number[];
}

/**
 * Options the candidate referred to explicitly — "B", "option c", "(d)",
 * "I'd go with b", "the second one", "A, B and D" — minus ones they ruled
 * out ("not a").
 */
function explicitPicks(answer: string, options: string[]): Picks {
  const n = options.length;
  const t = " " + langs(answer.toLowerCase()).replace(/[’']/g, "").replace(/\s+/g, " ").trim() + " ";
  const refs: { idx: number; pos: number }[] = [];
  // With numbered labels the options ARE letters, so a letter the candidate
  // says is the option's content ("it's D"), and "(2)"/"option 2" is a label.
  const numbered = optionLabels(options)[0] === "1";
  const letters = numbered ? options.map((o) => o.trim().toLowerCase()).join("") : "abcdefgh".slice(0, n);
  if (numbered) {
    const labelRefs =
      /\b(?:option|number|choice|its|it is|id say|i think|i pick|i choose|go with|going with|pick|choose|select|answer is|thats|that is)\s*\(?([1-8])\)?(?![0-9])|\(([1-8])\)|^\s*([1-8])(?=\s*(?:$|[).,:;!?\-–—]|because\b|since\b|as\b))/g;
    for (const m of t.matchAll(labelRefs)) {
      const d = Number(m[1] ?? m[2] ?? m[3]) - 1;
      if (d < n) refs.push({ idx: d, pos: m.index ?? 0 });
    }
  }

  // Lists of letters: "a, b and d", "(a) & (c)". A run needs two or more.
  const listed: number[] = [];
  const parts = [...t.matchAll(/\(?([a-h])\)?(?![a-z0-9])|(,|&|\/|\band\b)|([^\s,&/]+)/g)];
  let run: number[] = [];
  let expectLetter = true;
  const flush = () => {
    if (run.length >= 2) listed.push(...run);
    run = [];
    expectLetter = true;
  };
  for (const p of parts) {
    if (p[1] && expectLetter && letters.includes(p[1])) {
      run.push(letters.indexOf(p[1]));
      expectLetter = false;
    } else if (p[2] && !expectLetter) {
      expectLetter = true;
    } else {
      flush();
      if (p[1] && letters.includes(p[1])) {
        run.push(letters.indexOf(p[1]));
        expectLetter = false;
      }
    }
  }
  flush();

  // "a" is also an English article, so it only counts as an option when
  // nothing but punctuation or a justification follows it.
  const accept = (ch: string, after: string) =>
    ch === "a"
      ? /^\s*($|[).,:;!?\-–—]|because\b|since\b|as\b)/.test(after)
      : !/^[+#a-z0-9]/.test(after);
  const add = (ch: string, pos: number, end: number) => {
    const i = letters.indexOf(ch);
    if (i >= 0 && accept(ch, t.slice(end))) refs.push({ idx: i, pos });
  };

  // Answer that opens with the letter: "B", "b) because", "c - the..."
  const lead = t.match(/^\s*\(?([a-h])\)?/);
  if (lead) add(lead[1], lead.index ?? 0, (lead.index ?? 0) + lead[0].length);
  // "option b", "choice (c)", "answer is d"
  for (const m of t.matchAll(/\b(?:option|choice|answer|ans)\s*(?:is\s*|would be\s*|should be\s*)?\(?([a-h])\)?/g)) {
    add(m[1], m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  // "(b)" anywhere
  for (const m of t.matchAll(/\(([a-h])\)/g)) add(m[1], m.index ?? 0, (m.index ?? 0) + m[0].length);
  // "it's b", "i'd go with c", "that's d", "i'll pick a."
  for (const m of t.matchAll(
    /\b(?:its|it is|it should be|it must be|it has to be|id say|i would say|i say|i think|i guess|i pick|i choose|ill pick|ill go with|id go with|go with|going with|pick|choose|select|thats|that is|would be|should be|must be|has to be|clearly|definitely)\s+\(?([a-h])\)?/g
  )) {
    add(m[1], m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  // Ordinals: "the second one", "option three", "the last option"
  const ord: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, one: 0, two: 1, three: 2, four: 3, five: 4 };
  for (const m of t.matchAll(/\b(first|second|third|fourth|fifth|last)\s+(?:one|option|choice)\b|\boption\s+(one|two|three|four|five)\b/g)) {
    const word = m[1] ?? m[2];
    const idx = word === "last" ? n - 1 : ord[word];
    if (idx !== undefined && idx < n) refs.push({ idx, pos: m.index ?? 0 });
  }

  // A bare letter straight after a self-correction: "c... actually no, b".
  for (const m of t.matchAll(/\b(?:actually|no|wait|sorry|i mean|correction|rather|make that|scratch that)[\s,.:;!-]+\(?([a-h])\)?/g)) {
    add(m[1], m.index ?? 0, (m.index ?? 0) + m[0].length);
  }

  const negated = (pos: number) =>
    /\b(not|isnt|rather than|instead of|except|eliminate|eliminating|rule out|ruled out|ruling out|never)\s*(option\s*)?\(?\s*$/.test(
      t.slice(Math.max(0, pos - 24), pos + 1)
    );
  const kept = refs.filter((r) => !negated(r.pos)).sort((a, b) => a.pos - b.pos);

  // "b... actually no, c" — a self-correction wins.
  const cue = [...t.matchAll(/\b(actually|no wait|wait|sorry|i mean|correction|scratch that|on second thought)\b/g)].pop();
  const cueAt = cue?.index ?? -1;
  const final = cue && kept.some((r) => r.pos > cueAt) ? kept.filter((r) => r.pos > cueAt) : kept;
  return { single: [...new Set(final.map((r) => r.idx))], listed: [...new Set(listed)] };
}

/** √2 -> 1.41421, 1/√2 -> 0.70711, "root 2" -> 1.41421 — so numeric options compare by value. */
function evalRoots(s: string): string {
  return s
    .replace(/(?:square\s+)?root\s+(?:of\s+)?(\d+(?:\.\d+)?)/gi, "√$1")
    .replace(/(\d+(?:\.\d+)?)?\s*\/\s*√\s*(\d+(?:\.\d+)?)/g, (_, a: string | undefined, b: string) =>
      String((a ? Number(a) : 1) / Math.sqrt(Number(b)))
    )
    .replace(/√\s*(\d+(?:\.\d+)?)/g, (_, b: string) => String(Math.sqrt(Number(b))));
}

/**
 * For options that are just numbers ("4 / 8 / 16 / 32", "1 and 3", "√2"),
 * pick by value: "I'd say 8" means the 8. Returns [] if the options aren't
 * numeric or the answer fits more than one.
 */
function numericOptionPick(answer: string, options: string[]): number[] {
  const numericish = options.every((o) => o.replace(/[\d.\s,/√−\-+×^()%²³]|\band\b|\bor\b/g, "").length <= 3);
  if (!numericish) return [];
  const optVals = options.map((o) => numbersSaid(evalRoots(o)).map((n) => n.value));
  if (optVals.some((v) => !v.length)) return [];

  const said = numbersSaid(evalRoots(answer));
  const ans = said.flatMap((n) => [n.value, ...n.alts]);
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-3);
  const fits = optVals.map((vals) => {
    const pool = [...ans];
    return vals.every((v) => {
      const k = pool.findIndex((a) => near(a, v));
      if (k < 0) return false;
      pool.splice(k, 1);
      return true;
    });
  });
  let idx = fits.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  if (idx.length > 1) {
    // "2" fits both "2" and "2 and 2": prefer the option that uses more of what they said.
    const most = Math.max(...idx.map((i) => optVals[i].length));
    idx = idx.filter((i) => optVals[i].length === most);
  }
  if (idx.length > 1 && said.length) {
    // "2 times 4 is 8, so 8": the number they finished on.
    const last = said[said.length - 1].value;
    idx = idx.filter((i) => optVals[i].length === 1 && near(last, optVals[i][0]));
  }
  return idx.length === 1 ? idx : [];
}

/**
 * Options quoted verbatim. Where one quoted option sits inside another ("O(n)"
 * inside "O(n log n)"), only the longer one counts.
 */
function quotedOptions(answer: string, options: string[]): number[] {
  const a = " " + flat(answer) + " ";
  const flats = options.map(flat);
  const hits = flats.map((f, i) => ({ f, i })).filter(({ f }) => f.length >= 2 && a.includes(" " + f + " "));
  return hits
    .filter(({ f, i }) => !hits.some((h) => h.i !== i && h.f.length > f.length && h.f.includes(f)))
    .map(({ i }) => i);
}

/**
 * How well the answer's wording matches each option. A word counts for an
 * option in proportion to how distinctive it is (shared by two options, it's
 * worth half), words every option shares are ignored, and words that belong
 * only to OTHER options count against — "log n" is evidence against "O(n)".
 * Returns the score and the raw supporting evidence per option.
 */
function optionScores(answer: string, options: string[]): { score: number; support: number }[] {
  const n = options.length;
  const wordDf = new Map<string, number>();
  for (const o of options) for (const w of new Set(words(o))) wordDf.set(w, (wordDf.get(w) ?? 0) + 1);
  const common = new Set([...wordDf].filter(([, c]) => c === n && n > 1).map(([w]) => w));

  const optToks = options.map((o) => new Set(tokens(o, common)));
  const df = new Map<string, number>();
  for (const ts of optToks) for (const tk of ts) df.set(tk, (df.get(tk) ?? 0) + 1);
  const ans = new Set(tokens(answer, common));

  return optToks.map((ts) => {
    let total = 0;
    let support = 0;
    let contra = 0;
    for (const tk of ts) {
      const w = 1 / (df.get(tk) ?? 1);
      total += w;
      if (ans.has(tk)) support += w;
    }
    for (const tk of ans) if (df.has(tk) && !ts.has(tk)) contra += 1 / (df.get(tk) ?? 1);
    return { score: total ? (support - 0.5 * contra) / total : 0, support };
  });
}

export function gradeChoice(answer: string, check: { options: string[]; correct: number[] }, question: string): Grade {
  const multi = check.correct.length > 1;
  const reasoning = reasoningShown(answer, question, check.options);
  const refs = explicitPicks(answer, check.options);

  let picked: number[] = [];
  if (multi) {
    picked = [...new Set([...refs.listed, ...refs.single])];
  } else if (refs.single.length) {
    picked = [refs.single[0]];
  } else if (refs.listed.length === 1) {
    picked = refs.listed;
  } else if (refs.listed.length > 1) {
    // "Somewhere between A and C" isn't a commitment.
    return { verdict: "unclear", reasoning };
  }

  if (!picked.length && !multi) picked = numericOptionPick(answer, check.options);

  if (!picked.length) {
    const quoted = quotedOptions(answer, check.options);
    if (multi && quoted.length) picked = quoted;
    else if (quoted.length === 1) picked = quoted;
  }

  if (!picked.length) {
    const scored = optionScores(answer, check.options).map((s, i) => ({ ...s, i }));
    const order = [...scored].sort((x, y) => y.score - x.score);
    if (multi) {
      picked = order.filter((o) => o.score >= 0.5 && o.support >= 1).map((o) => o.i);
    } else {
      const [best, second] = order;
      // Needs real evidence — two distinctive words, or one distinctive pair,
      // or the whole of an option that is itself one distinctive word ("n
      // squared" for O(n²)) — not a word that happens to appear in an option.
      const evidence = best.support >= 1.25 || (best.score >= 0.99 && best.support >= 1);
      if (best.score >= 0.2 && evidence && best.score - (second?.score ?? 0) >= 0.12) picked = [best.i];
    }
  }
  if (!picked.length) return { verdict: "unclear", reasoning };

  const labels = optionLabels(check.options);
  const said = picked.map((i) => (labels[0] === "1" ? check.options[i].trim() : labels[i])).join(" and ");
  const want = new Set(check.correct);
  const got = new Set(picked);
  if (!multi) {
    return { verdict: got.size === 1 && want.has(picked[0]) ? "correct" : "wrong", reasoning, said, picked };
  }
  const allRight = [...got].every((i) => want.has(i));
  if (allRight && got.size === want.size) return { verdict: "correct", reasoning, said, picked };
  if (allRight) return { verdict: "partial", reasoning, said, picked };
  return { verdict: "wrong", reasoning, said, picked };
}

/* ---------------------------------------------------------------- reasoning */

const REASON_MARKERS =
  /\b(because|since|so|therefore|hence|which means|that gives|gives|equals|first|then|next|finally|using|formula|rate|ratio|per|times|divided|multiply|multiplied|subtract|add|total|net|lcm|hcf|assume|if)\b|[=×*/+]/g;

/**
 * 0-1: did they show their working? Length of the explanation beyond a bare
 * answer, reasoning connectives, and whether they brought in any quantity or
 * idea that isn't simply repeated from the question.
 */
function reasoningShown(answer: string, question: string, options: string[] = []): number {
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const lengthPart = Math.min(1, Math.max(0, (wordCount - 4) / 30));
  const markers = (answer.toLowerCase().match(REASON_MARKERS) ?? []).length;
  const markerPart = Math.min(1, markers / 4);
  const known = new Set([...tokens(question), ...options.flatMap((o) => tokens(o))]);
  const fresh = words(answer).filter((w) => !known.has(w)).length;
  const freshPart = Math.min(1, fresh / 6);
  return Math.min(1, lengthPart * 0.45 + markerPart * 0.3 + freshPart * 0.25);
}

/* ------------------------------------------------------------------- entry */

export function gradeAnswer(answer: string, q: BankQuestion): Grade {
  const check = q.check as AnswerCheck;
  return check.kind === "numeric" ? gradeNumeric(answer, check, q.question) : gradeChoice(answer, check, q.question);
}

/** The key, written the way the report should show it. */
export function describeKey(check: AnswerCheck): string {
  if (check.kind === "numeric") return formatNumber(check.value) + (check.tolerance ? ` (±${check.tolerance})` : "");
  const labels = optionLabels(check.options);
  return check.correct.map((i) => `(${labels[i]}) ${check.options[i]}`).join("; ");
}
