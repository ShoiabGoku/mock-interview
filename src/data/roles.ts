import type { Category, RoleDef } from "@/lib/types";
import type { InterviewMode } from "./modes";

/** Role library. `focus` orders the categories the panel emphasises. */
export const ROLES: RoleDef[] = [
  { id: "swe", name: "Software Engineer", focus: ["coding", "system-design", "cs-fundamentals", "behavioral", "project"] },
  { id: "ds", name: "Data Scientist", focus: ["data-science", "ml-ai", "coding", "behavioral"] },
  { id: "ml", name: "AI / ML Engineer", focus: ["ml-ai", "coding", "system-design", "research"] },
  { id: "research", name: "Research Engineer / Scientist", focus: ["research", "ml-ai", "aerodynamics", "behavioral"] },
  { id: "aero", name: "Aerodynamics Engineer", focus: ["aerodynamics", "cfd", "flight-mechanics", "behavioral"] },
  { id: "cfd-eng", name: "CFD Engineer", focus: ["cfd", "aerodynamics", "thermal", "project"] },
  { id: "structures", name: "Structures Engineer", focus: ["structures", "project", "behavioral"] },
  { id: "propulsion", name: "Propulsion Engineer", focus: ["propulsion", "thermal", "behavioral"] },
  { id: "thermal", name: "Thermal Engineer", focus: ["thermal", "cfd", "project"] },
  { id: "gnc", name: "Control Systems / GNC Engineer", focus: ["controls", "flight-mechanics", "coding"] },
  { id: "mech", name: "Mechanical Engineer", focus: ["structures", "thermal", "project", "behavioral"] },
  { id: "embedded", name: "Embedded / Firmware Engineer", focus: ["coding", "controls", "cs-fundamentals", "project"] },
  { id: "consultant", name: "Consultant", focus: ["case-study", "behavioral", "quant"] },
  { id: "ba", name: "Business Analyst", focus: ["case-study", "quant", "reasoning", "behavioral"] },
  { id: "pm", name: "Product Manager", focus: ["product", "behavioral", "system-design"] },
  { id: "quant-analyst", name: "Quant Analyst", focus: ["quant", "coding", "reasoning", "behavioral"] },
  { id: "get", name: "Graduate Engineer Trainee", focus: ["aerodynamics", "structures", "engineering-maths", "hr", "behavioral"] },
  { id: "scientist", name: "Scientist / Engineer (Govt)", focus: ["propulsion", "aerodynamics", "structures", "engineering-maths", "hr"] },
  { id: "phd", name: "PhD Interview", focus: ["research", "aerodynamics", "engineering-maths", "behavioral"] },
  { id: "ms", name: "MS Interview", focus: ["research", "coding", "behavioral"] },
];

export function roleById(id: string): RoleDef | undefined {
  return ROLES.find((r) => r.id === id);
}

/** People-facing categories — everything else counts as technical. */
const NON_TECHNICAL: Category[] = ["hr", "behavioral", "resume", "project"];

/**
 * What a session should draw from, in priority order: the mode's own
 * categories if it has them, otherwise the role's focus (only its technical
 * part, for a technical round).
 */
export function planCategories(
  role: RoleDef,
  mode?: InterviewMode
): { categories: Category[]; weights?: number[] } {
  if (mode?.categories) return { categories: mode.categories, weights: mode.weights };
  if (mode?.technicalOnly) {
    const technical = role.focus.filter((c) => !NON_TECHNICAL.includes(c));
    if (technical.length) return { categories: technical };
  }
  return { categories: role.focus };
}
