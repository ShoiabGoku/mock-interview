/** Core domain types for the mock interview platform. */

export type Category =
  | "aerodynamics"
  | "structures"
  | "propulsion"
  | "cfd"
  | "flight-mechanics"
  | "controls"
  | "thermal"
  | "coding"
  | "system-design"
  | "ml-ai"
  | "data-science"
  | "quant"
  | "case-study"
  | "product"
  | "behavioral"
  | "hr"
  | "resume"
  | "research"
  | "project"
  | "rapid-fire";

export type Difficulty =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "senior"
  | "principal"
  | "research-scientist";

export type Mood = "neutral" | "pleased" | "impressed" | "skeptical" | "concerned";

export interface Interviewer {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  /** One-line personality used in prompts and UI. */
  personality: string;
  /** Question categories this panelist owns. */
  focus: Category[];
  /** Speaking style hint for the AI / scripted phrasing. */
  style: "warm" | "skeptical" | "rapid" | "formal" | "curious";
}

export interface Company {
  id: string;
  name: string;
  emoji: string;
  domain: string;
  /** Panel of interviewers for this company. */
  panel: Interviewer[];
  /** Roles commonly hired for. */
  roles: string[];
}

export interface RoleDef {
  id: string;
  name: string;
  /** Categories emphasised for this role, in priority order. */
  focus: Category[];
}

export interface BankQuestion {
  id: string;
  category: Category;
  question: string;
  followUps: string[];
  /** Concepts a strong answer should touch — drives scripted evaluation. */
  keywords: string[];
  ideal: string;
  difficulty: "easy" | "medium" | "hard";
  /**
   * Company ids this question is specifically true to (real, researched
   * questions those panels actually ask). Untagged questions are generic and
   * may appear for any company. Selection prefers company-tagged questions
   * when the interview's company is known.
   */
  companies?: string[];
}

/** Per-answer evaluation, stored silently during the interview. */
export interface AnswerEval {
  questionIdx: number;
  technical: number;      // 0-10
  communication: number;  // 0-10
  confidence: number;     // 0-10
  depth: number;          // 0-10
  structure: number;      // 0-10
  notes: string;
  missing: string[];
}

export interface TranscriptEntry {
  speaker: string; // interviewer id or "you"
  interviewerName?: string;
  text: string;
  /** Set when this entry is a panelist interruption. */
  interruption?: boolean;
  ts: number;
}

export interface SessionConfig {
  companyId: string;
  roleId: string;
  mode: string;
  difficulty: Difficulty;
  durationMin: number;
  resume?: string;
  jobDescription?: string;
}

export interface QuestionFeedback {
  question: string;
  answer: string;
  idealAnswer: string;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  betterAnswer: string;
  confidence: number; // 0-10
}

export interface Report {
  overall: number;         // 0-100
  technical: number;
  communication: number;
  confidence: number;
  problemSolving: number;
  behavioral: number;
  depth: number;
  structure: number;
  companyReadiness: number;
  roleReadiness: number;
  /** AI estimate only — clearly not a real hiring prediction. */
  hiringProbability: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  perQuestion: QuestionFeedback[];
  coach: {
    topicsToRevise: string[];
    resources: { title: string; type: string }[];
    studyPlan: string[];
  };
}

export interface InterviewSession {
  id: string;
  config: SessionConfig;
  companyName: string;
  roleName: string;
  startedAt: number;
  endedAt?: number;
  transcript: TranscriptEntry[];
  evals: AnswerEval[];
  report?: Report;
  usedAI: boolean;
}
