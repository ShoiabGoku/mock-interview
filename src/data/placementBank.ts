import type { BankQuestion, Category } from "@/lib/types";
import { optionLabels } from "@/lib/grading";
import type { Question } from "./placement/types";
import { AEROSPACE_QUESTIONS } from "./placement/aerospace";
import { MECHANICS_QUESTIONS } from "./placement/mechanics";
import { RESUME_QUESTIONS } from "./placement/resume";
import { NON_CORE_QUESTIONS } from "./placement/nonCore";
import { CODING_QUESTIONS } from "./placement/coding";
import { APTITUDE_QUESTIONS } from "./placement/aptitude";
import { INTERVIEW_QUESTIONS } from "./placement/interview";
import { ALREADY_IN_BANK, GRADED_CATEGORY, OPEN_CONVERSIONS } from "./placementCurated";

/**
 * Every question from the Myplacement prep app, turned into something a panel
 * can ask out loud.
 *
 *   numericals (NAT)  -> asked as-is, graded on the number within tolerance
 *   MCQ / multiselect -> asked with the options read out, graded on the pick
 *   interview/resume  -> hand-converted to open questions (placementCurated.ts)
 *
 * The round a question lands in comes from its Myplacement topic: aptitude
 * feeds the Analytical round, aerospace/mechanics feed the core technical
 * categories, and so on (TOPIC_CATEGORY below). To pull in new Myplacement
 * questions, run `node scripts/sync-placement.mjs` and rebuild.
 */

const BANKS: Question[] = [
  ...AEROSPACE_QUESTIONS,
  ...MECHANICS_QUESTIONS,
  ...RESUME_QUESTIONS,
  ...NON_CORE_QUESTIONS,
  ...CODING_QUESTIONS,
  ...APTITUDE_QUESTIONS,
  ...INTERVIEW_QUESTIONS,
];

/** Myplacement topic -> interview category. */
const TOPIC_CATEGORY: Record<string, Category> = {
  // Core aerospace
  Aerodynamics: "aerodynamics",
  "Compressible Flow": "aerodynamics",
  "Gas Dynamics": "aerodynamics",
  "Fluid Mechanics": "aerodynamics",
  "Flight Mechanics": "flight-mechanics",
  "Space Mechanics": "flight-mechanics",
  Propulsion: "propulsion",
  Thermodynamics: "thermal",
  "Heat Transfer": "thermal",
  "Strength of Materials": "structures",
  "Aircraft Structures": "structures",
  "Theory of Elasticity": "structures",
  "Engineering Mechanics": "structures",
  "Machine Design": "structures",
  Manufacturing: "structures",
  Vibrations: "structures",
  "Control Systems": "controls",
  Signals: "controls",
  "Basic Electrical": "controls",
  "Engineering Mathematics": "engineering-maths",
  "Numerical Methods": "engineering-maths",
  "Probability & Statistics": "engineering-maths",
  // Role tracks
  "Machine Learning": "ml-ai",
  "Computer Vision": "ml-ai",
  "Generative AI": "ml-ai",
  "Data Analytics": "data-science",
  "Quantitative Finance": "quant",
  "Investment Banking": "quant",
  "Consulting & Strategy": "case-study",
  "Software Architecture": "system-design",
  // CS fundamentals vs DSA
  OOP: "cs-fundamentals",
  Python: "cs-fundamentals",
  "C++": "cs-fundamentals",
  Java: "cs-fundamentals",
  SQL: "cs-fundamentals",
  DBMS: "cs-fundamentals",
  "Operating Systems": "cs-fundamentals",
  "Computer Networks": "cs-fundamentals",
  // Analytical round
  "Quantitative Aptitude": "aptitude",
  "Logical Reasoning": "reasoning",
  "Analytical Reasoning": "reasoning",
  "Puzzle Solving": "reasoning",
  "Critical Thinking": "reasoning",
  "Data Interpretation": "reasoning",
  "Verbal Ability": "verbal",
  "English Grammar": "verbal",
};

/** Myplacement company names -> interview company ids (unlisted names are dropped). */
const COMPANY_ID: Record<string, string> = {
  ISRO: "isro",
  DRDO: "drdo",
  HAL: "hal",
  Airbus: "airbus",
  Boeing: "boeing",
  SpaceX: "spacex",
  "Blue Origin": "blueorigin",
  "GE Aviation": "ge-aero",
  "Rolls-Royce": "rolls-royce",
  Honeywell: "honeywell",
  "Mercedes-Benz R&D": "mercedes",
  Bosch: "bosch",
  Qualcomm: "qualcomm",
  "Texas Instruments": "ti",
  NVIDIA: "nvidia",
  Google: "google",
  Microsoft: "microsoft",
  Meta: "meta",
  Amazon: "amazon",
  Apple: "apple",
  OpenAI: "openai",
  Anthropic: "anthropic",
  "Goldman Sachs": "goldman",
  JPMorgan: "jpmorgan",
  McKinsey: "mckinsey",
  BCG: "bcg",
  Bain: "bain",
  Deloitte: "deloitte",
  "Deloitte-style": "deloitte",
  Accenture: "accenture",
  TCS: "tcs",
  "TCS-style": "tcs",
  Infosys: "infosys",
  Wipro: "wipro",
};

function categoryOf(q: Question): Category | null {
  if (GRADED_CATEGORY[q.id]) return GRADED_CATEGORY[q.id];
  if (TOPIC_CATEGORY[q.topic]) return TOPIC_CATEGORY[q.topic];
  // Everything else in the DSA bank (Graphs, DP, Trees, ...) is coding.
  if (q.id.startsWith("cod-")) return "coding";
  return null;
}

function difficultyOf(q: Question): BankQuestion["difficulty"] {
  if (q.difficulty === "easy") return "easy";
  if (q.difficulty === "hard" || q.difficulty === "gate") return "hard";
  return "medium";
}

function companiesOf(q: Question): string[] | undefined {
  const ids = [...new Set((q.companies ?? []).map((c) => COMPANY_ID[c]).filter(Boolean))];
  return ids.length ? ids : undefined;
}

/** Strip test-UI instructions that make no sense spoken aloud. */
function spoken(text: string): string {
  return text
    .replace(/\s*\((?:decimal allowed|select all that apply)\.?\)/gi, "")
    .replace(/\s*Decimal allowed\.?/gi, "")
    .trim();
}

/** A multiple-choice stem with its options read out, the way a panel asks one. */
function withOptions(q: Question): string {
  const multi = (q.correct?.length ?? 0) > 1;
  const stem = spoken(q.text);
  const labels = optionLabels(q.options ?? []);
  const opts = (q.options ?? []).map((o, i) => `(${labels[i]}) ${o.replace(/[.\s]+$/, "")}`).join("; ");
  return `${stem} ${opts}. ${multi ? "Pick all that apply, and tell me why." : "Which one, and why?"}`;
}

/**
 * The model answer for the report: the working and the idea behind it. The
 * key itself is shown separately ("Correct answer"), from `check`.
 */
function idealFor(q: Question): string {
  const steps = q.solution.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const extras = [
    `Key idea: ${q.solution.concept}`,
    q.solution.formula ? `Formula: ${q.solution.formula}` : "",
    q.solution.commonMistakes?.length ? `Common mistake: ${q.solution.commonMistakes[0]}` : "",
  ].filter(Boolean);
  return `${steps}\n\n${extras.join("\n")}`;
}

function toGraded(q: Question, category: Category): BankQuestion {
  const followUps = ["Walk me through how you got that."];
  if (q.solution.commonMistakes?.length) followUps.push("Where do people usually slip up on this one?");
  if (q.solution.altMethod) followUps.push("Is there a quicker way to get there?");
  return {
    id: `mp-${q.id}`,
    category,
    question: q.type === "nat" ? spoken(q.text) : withOptions(q),
    followUps,
    keywords: [],
    ideal: idealFor(q),
    difficulty: difficultyOf(q),
    companies: companiesOf(q),
    check:
      q.type === "nat"
        ? { kind: "numeric", value: q.answer?.value ?? 0, tolerance: q.answer?.tolerance ?? 0 }
        : { kind: "choice", options: q.options ?? [], correct: q.correct ?? [] },
    solution: {
      steps: q.solution.steps,
      concept: q.solution.concept,
      formula: q.solution.formula,
      commonMistakes: q.solution.commonMistakes,
    },
    source: `myplacement:${q.id}`,
  };
}

function toOpen(q: Question): BankQuestion {
  const conv = OPEN_CONVERSIONS[q.id];
  const best = (q.correct ?? []).map((i) => q.options?.[i]).filter(Boolean).join("; ");
  return {
    id: `mp-${q.id}`,
    category: conv.category,
    question: conv.question,
    followUps: conv.followUps,
    keywords: conv.keywords,
    ideal: `${best}. ${q.solution.steps.join(" ")}`,
    difficulty: difficultyOf(q),
    companies: companiesOf(q),
    solution: { steps: q.solution.steps, concept: q.solution.concept, commonMistakes: q.solution.commonMistakes },
    source: `myplacement:${q.id}`,
  };
}

/** Questions that couldn't be placed in any round — surfaced by the bank checks. */
export const UNPLACED: string[] = [];

export const PLACEMENT_QUESTIONS: BankQuestion[] = BANKS.flatMap((q): BankQuestion[] => {
  if (ALREADY_IN_BANK[q.id]) return [];
  if (OPEN_CONVERSIONS[q.id]) return [toOpen(q)];
  const category = categoryOf(q);
  if (!category) {
    UNPLACED.push(q.id);
    return [];
  }
  return [toGraded(q, category)];
});
