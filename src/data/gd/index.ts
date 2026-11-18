import type { GDCategory, GDDifficulty, GDModerator, GDPersona, GDTopic } from "@/lib/gd/types";
import { TOPICS_A } from "./topicsA";
import { TOPICS_B } from "./topicsB";
import { companyById } from "@/data/companies";
import { hashOf } from "@/lib/people";

export const GD_TOPICS: GDTopic[] = [...TOPICS_A, ...TOPICS_B];

export const GD_CATEGORIES: { id: GDCategory; name: string; emoji: string }[] = [
  { id: "tech", name: "Technology & AI", emoji: "🤖" },
  { id: "business", name: "Business & Work", emoji: "💼" },
  { id: "economy", name: "Economy & Policy", emoji: "📈" },
  { id: "society", name: "Education & Society", emoji: "🎓" },
  { id: "environment", name: "Energy & Environment", emoji: "🌱" },
  { id: "aerospace", name: "Aerospace & Defence", emoji: "🚀" },
  { id: "abstract", name: "Abstract", emoji: "🌀" },
  { id: "case", name: "Case-based", emoji: "🧩" },
];

export function topicById(id: string): GDTopic | undefined {
  return GD_TOPICS.find((t) => t.id === id);
}

/** Which kinds of topic a company's GD round tends to use. */
const COMPANY_CATEGORIES: Record<string, GDCategory[]> = {
  isro: ["aerospace", "environment", "society"],
  drdo: ["aerospace", "economy", "tech"],
  hal: ["aerospace", "economy", "business"],
  airbus: ["aerospace", "environment", "business"],
  boeing: ["aerospace", "environment", "business"],
  spacex: ["aerospace", "tech"],
  blueorigin: ["aerospace", "tech"],
  "ge-aero": ["aerospace", "environment"],
  "rolls-royce": ["aerospace", "environment"],
  honeywell: ["aerospace", "tech"],
  tesla: ["environment", "tech", "business"],
  mercedes: ["environment", "business"],
  bosch: ["environment", "tech", "business"],
  mckinsey: ["case", "economy", "business"],
  bcg: ["case", "economy", "business"],
  bain: ["case", "business", "economy"],
  deloitte: ["case", "business", "tech"],
  accenture: ["business", "tech", "case"],
  goldman: ["economy", "business", "case"],
  jpmorgan: ["economy", "business", "case"],
  tcs: ["business", "tech", "abstract", "society"],
  infosys: ["business", "tech", "abstract", "society"],
  wipro: ["business", "tech", "abstract", "society"],
};

/** A topic suited to the company, avoiding ones done recently. */
export function suggestTopic(companyId: string, recent: string[] = []): GDTopic {
  const cats = COMPANY_CATEGORIES[companyId];
  const fresh = (list: GDTopic[]) => list.filter((t) => !recent.includes(t.id));
  let pool = cats ? fresh(GD_TOPICS.filter((t) => cats.includes(t.category))) : [];
  if (!pool.length) pool = fresh(GD_TOPICS);
  if (!pool.length) pool = GD_TOPICS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------------- People ---------------- */

export const GD_PERSONAS: GDPersona[] = [
  { id: "gd-karan", name: "Karan Malhotra", style: "initiator", talk: 1.5, length: 3, blurb: "Jumps in first and speaks with conviction; can dominate." },
  { id: "gd-ishita", name: "Ishita Sharma", style: "analyst", talk: 1.1, length: 2, blurb: "Brings data and facts; structured and precise." },
  { id: "gd-rohan", name: "Rohan Kulkarni", style: "contrarian", talk: 1.1, length: 2, blurb: "Plays devil's advocate and pushes back." },
  { id: "gd-ananya", name: "Ananya Bose", style: "harmoniser", talk: 1.0, length: 2, blurb: "Builds consensus, brings quiet people in, summarises." },
  { id: "gd-siddharth", name: "Siddharth Joshi", style: "quiet", talk: 0.45, length: 2, blurb: "Speaks rarely, but thoughtfully." },
  { id: "gd-zoya", name: "Zoya Qureshi", style: "storyteller", talk: 0.9, length: 2, blurb: "Uses real examples and the human angle." },
  { id: "gd-manav", name: "Manav Gupta", style: "drifter", talk: 0.8, length: 2, blurb: "Means well, but drifts off topic." },
  { id: "gd-tanvi", name: "Tanvi Desai", style: "structurer", talk: 0.9, length: 2, blurb: "Frames the discussion and keeps it balanced." },
  { id: "gd-aakash", name: "Aakash Verma", style: "aggressor", talk: 1.4, length: 3, blurb: "Aggressive; interrupts and repeats his point." },
  { id: "gd-neha", name: "Neha Pillai", style: "polite", talk: 0.7, length: 1, blurb: "Polite, brief, agrees easily." },
];

export function personaById(id: string): GDPersona | undefined {
  return GD_PERSONAS.find((p) => p.id === id);
}

/**
 * Choose the other participants. The core four (initiator, analyst,
 * contrarian, harmoniser) are always there; difficulty decides the rest — a
 * friendly group has polite, quiet members, an aggressive one has a second
 * dominant voice and nobody who makes room for you.
 */
export function pickGroup(groupSize: number, difficulty: GDDifficulty, seed: string): GDPersona[] {
  const others = Math.max(3, Math.min(7, groupSize - 1));
  const order: Record<GDDifficulty, string[]> = {
    friendly: ["gd-karan", "gd-ishita", "gd-ananya", "gd-rohan", "gd-neha", "gd-zoya", "gd-siddharth", "gd-tanvi"],
    competitive: ["gd-karan", "gd-ishita", "gd-rohan", "gd-ananya", "gd-tanvi", "gd-zoya", "gd-manav", "gd-siddharth"],
    aggressive: ["gd-karan", "gd-aakash", "gd-rohan", "gd-ishita", "gd-ananya", "gd-manav", "gd-zoya", "gd-tanvi"],
  };
  const chosen = order[difficulty].slice(0, others).map((id) => personaById(id)!);
  // Seat them in a stable but session-specific order.
  return chosen
    .map((p) => ({ p, k: hashOf(seed + p.id) }))
    .sort((a, b) => a.k - b.k)
    .map(({ p }) => p);
}

const CAMPUS_MODERATORS: GDModerator[] = [
  { id: "mod-kavitha", name: "Dr. Kavitha Rao", role: "Placement Officer" },
  { id: "mod-joseph", name: "Joseph D'Souza", role: "Talent Acquisition" },
];

/**
 * Assessors: the company's HR person plus one manager/technical panelist,
 * or the placement cell for a generic campus GD.
 */
export function moderatorsFor(companyId: string): GDModerator[] {
  const c = companyById(companyId);
  if (!c) return CAMPUS_MODERATORS;
  const hr = c.panel.find((p) => p.focus.includes("hr")) ?? c.panel[c.panel.length - 1];
  const lead = c.panel.find((p) => p.id !== hr.id && p.focus.some((f) => f === "behavioral" || f === "case-study")) ??
    c.panel.find((p) => p.id !== hr.id) ?? c.panel[0];
  return [hr, lead].map((p) => ({ id: p.id, name: p.name, role: p.role }));
}
