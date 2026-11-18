/** Group-discussion domain types. */

export type GDCategory = "tech" | "business" | "economy" | "society" | "environment" | "aerospace" | "abstract" | "case";
export type GDSide = "for" | "against" | "neutral";

export interface GDPoint {
  id: string;
  side: GDSide;
  /** Short handle others can refer to: "job displacement in BPOs". */
  label: string;
  /** The point, as a participant would say it. */
  say: string;
  /** Concepts that show the candidate made this point (scored like interview keywords). */
  keys: string[];
  /** A supporting fact or example. */
  fact?: string;
  /** What someone on the other side says back. */
  counter?: string;
}

export interface GDTopic {
  id: string;
  title: string;
  category: GDCategory;
  kind: "factual" | "abstract" | "case";
  /** One or two lines the moderator reads out. */
  brief: string;
  sides?: { for: string; against: string };
  points: GDPoint[];
  /** How an initiator frames the discussion. */
  openers: string[];
  /** A balanced closing synthesis — the model summary in the report. */
  conclusion: string;
}

export type GDStyle =
  | "initiator" | "analyst" | "contrarian" | "harmoniser" | "quiet"
  | "storyteller" | "drifter" | "structurer" | "aggressor" | "polite";

export interface GDPersona {
  id: string;
  name: string;
  style: GDStyle;
  /** Relative chance of taking the floor. */
  talk: number;
  /** Sentences in a typical turn. */
  length: number;
  blurb: string;
}

export interface GDModerator {
  id: string;
  name: string;
  role: string;
}

export type GDDifficulty = "friendly" | "competitive" | "aggressive";

export interface GDConfig {
  /** A company id, or "campus" for a generic placement-cell GD. */
  companyId: string;
  topicId: string;
  /** Total group size, including the candidate. */
  groupSize: number;
  difficulty: GDDifficulty;
  durationMin: number;
  prepSec: number;
  /** AI mode only: a topic not in the bank. */
  customTopic?: string;
}

export type TurnKind =
  | "moderator" | "initiate" | "point" | "counter" | "build" | "invite" | "summary"
  | "drift" | "redirect" | "react" | "rehash" | "answer" | "close" | "you";

export interface GDTurn {
  speakerId: string;
  text: string;
  kind: TurnKind;
  pointId?: string;
  /** Someone asked by name to speak next ("user" for the candidate). */
  addressed?: string;
  /** Speak only this many sentences, then get cut off by the next speaker. */
  cutAfter?: number;
}

/** What the candidate's contribution contained. */
export interface UserAnalysis {
  words: number;
  points: string[];
  onTopic: boolean;
  facts: number;
  examples: number;
  refs: string[];
  agreeWith?: string;
  disagreeWith?: string;
  invited: string[];
  structured: boolean;
  summarised: boolean;
  redirected: boolean;
  polite: boolean;
  rude: boolean;
  question: boolean;
  hedges: number;
  sides: GDSide[];
}

export interface GDRecord {
  speakerId: string;
  name: string;
  text: string;
  kind: TurnKind;
  atSec: number;
  pointIds: string[];
  /** This turn was cut off part-way. */
  cutOff?: boolean;
  /** The candidate spoke over someone. */
  interrupted?: string;
  analysis?: UserAnalysis;
  /** Spoken in the closing summary round. */
  summaryRound?: boolean;
}

export interface GDContributionFeedback {
  text: string;
  atSec: number;
  tags: string[];
  tip?: string;
}

export interface GDReport {
  overall: number;
  scores: {
    initiation: number;
    participation: number;
    content: number;
    listening: number;
    leadership: number;
    communication: number;
    conduct: number;
    summary: number | null;
  };
  airtime: { id: string; name: string; share: number; turns: number }[];
  yourShare: number;
  fairShare: number;
  contributions: number;
  firstSpokeAtSec: number | null;
  initiated: boolean;
  pointsYouMade: string[];
  pointsMissed: { label: string; side: GDSide; say: string }[];
  factsUsed: number;
  examplesUsed: number;
  builtOnOthers: number;
  invitedOthers: number;
  interruptions: number;
  offTopic: number;
  perContribution: GDContributionFeedback[];
  strengths: string[];
  improvements: string[];
  summary: string;
  /** Rough estimate only — never a real selection decision. */
  selectionEstimate: number;
  modelPoints: { side: GDSide; label: string; say: string }[];
  conclusion: string;
  aiFeedback?: string;
}

export interface GDSession {
  id: string;
  config: GDConfig;
  topic: { id: string; title: string; category: GDCategory };
  companyName: string;
  participants: { id: string; name: string }[];
  startedAt: number;
  endedAt: number;
  transcript: GDRecord[];
  report?: GDReport;
  usedAI: boolean;
}
