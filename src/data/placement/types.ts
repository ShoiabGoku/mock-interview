/**
 * Shape of a question in the Myplacement prep app's banks (ShoiabGoku/Myplacement,
 * src/lib/types.ts). The bank files in this folder are copied verbatim from that
 * repo by `scripts/sync-placement.mjs`; only their type import is rewritten to
 * point here. `placementBank.ts` converts them into interview questions.
 */

export type ModuleId = "aerospace" | "coding" | "aptitude" | "interview";

export type Difficulty = "easy" | "medium" | "hard" | "gate" | "interview";

export type QuestionType = "mcq" | "multiselect" | "nat";

export interface Solution {
  steps: string[];
  concept: string;
  formula?: string;
  altMethod?: string;
  commonMistakes?: string[];
  memoryTrick?: string;
  related?: string;
}

export interface Question {
  id: string;
  module: ModuleId;
  topic: string;
  subtopic?: string;
  type: QuestionType;
  difficulty: Difficulty;
  companies?: string[];
  tags?: string[];
  text: string;
  /** Present for mcq / multiselect. */
  options?: string[];
  /** Correct option indices (single entry for mcq). */
  correct?: number[];
  /** Present for nat: accepted value with +/- tolerance. */
  answer?: { value: number; tolerance?: number };
  marks: number;
  negative?: number;
  estTimeSec: number;
  hints?: string[];
  source?: string;
  solution: Solution;
}
