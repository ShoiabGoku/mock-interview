import type { Category, Difficulty } from "@/lib/types";

export interface InterviewMode {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Categories this mode draws from; null = follow the role's focus (Mixed). */
  categories: Category[] | null;
}

export const MODES: InterviewMode[] = [
  { id: "technical", name: "Technical Interview", emoji: "🔬", description: "Core subject and role fundamentals, probed in depth.", categories: null },
  { id: "hr", name: "HR Interview", emoji: "🤝", description: "Motivation, fit, expectations, relocation.", categories: ["hr", "resume", "behavioral"] },
  { id: "behavioral", name: "Behavioral Interview", emoji: "💬", description: "Leadership, conflict, ownership — STAR stories.", categories: ["behavioral"] },
  { id: "resume", name: "Resume Deep Dive", emoji: "📄", description: "Line-by-line grilling on everything you claimed.", categories: ["resume", "project"] },
  { id: "project", name: "Project Discussion", emoji: "🛠️", description: "Your thesis / projects, defended under questioning.", categories: ["project", "research"] },
  { id: "coding", name: "Coding Interview", emoji: "💻", description: "DSA and problem-solving, thinking out loud.", categories: ["coding"] },
  { id: "system-design", name: "System Design", emoji: "🏗️", description: "Design a system; trade-offs, scale, bottlenecks.", categories: ["system-design"] },
  { id: "case-study", name: "Case Study", emoji: "📊", description: "Consulting case: structure, hypotheses, math.", categories: ["case-study", "quant"] },
  { id: "research", name: "Research Interview", emoji: "🔭", description: "Depth of research, methodology, contributions.", categories: ["research"] },
  { id: "rapid-fire", name: "Rapid Fire", emoji: "⚡", description: "Fast conceptual questions, little time to think.", categories: ["rapid-fire"] },
  { id: "mixed", name: "Mixed Interview", emoji: "🎲", description: "Everything — the realistic full-panel experience.", categories: null },
  { id: "committee", name: "Final Hiring Committee", emoji: "⚖️", description: "The whole panel, hardest questions, maximum pressure.", categories: null },
];

export function modeById(id: string): InterviewMode | undefined {
  return MODES.find((m) => m.id === id);
}

export const DIFFICULTIES: { id: Difficulty; name: string; description: string }[] = [
  { id: "beginner", name: "Beginner", description: "Gentle; forgiving of gaps, encouraging tone." },
  { id: "intermediate", name: "Intermediate", description: "Standard campus / new-grad bar." },
  { id: "advanced", name: "Advanced", description: "Sharp follow-ups; expects depth and precision." },
  { id: "senior", name: "Senior Engineer", description: "Trade-offs, judgment, and leadership under scrutiny." },
  { id: "principal", name: "Principal Engineer", description: "Ambiguous, open-ended, systems-level thinking." },
  { id: "research-scientist", name: "Research Scientist", description: "First-principles rigor; defend every claim." },
];

/** Rough number of questions given a duration. */
export function questionCountFor(durationMin: number): number {
  if (durationMin <= 15) return 5;
  if (durationMin <= 30) return 8;
  if (durationMin <= 45) return 11;
  return 14;
}
