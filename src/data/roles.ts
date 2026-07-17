import type { Category, RoleDef } from "@/lib/types";

/** Role library. `focus` orders the categories the panel emphasises. */
export const ROLES: RoleDef[] = [
  { id: "swe", name: "Software Engineer", focus: ["coding", "system-design", "behavioral", "project"] },
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
  { id: "embedded", name: "Embedded / Firmware Engineer", focus: ["coding", "controls", "project"] },
  { id: "consultant", name: "Consultant", focus: ["case-study", "behavioral", "quant"] },
  { id: "ba", name: "Business Analyst", focus: ["case-study", "quant", "behavioral"] },
  { id: "pm", name: "Product Manager", focus: ["product", "behavioral", "system-design"] },
  { id: "quant-analyst", name: "Quant Analyst", focus: ["quant", "coding", "behavioral"] },
  { id: "get", name: "Graduate Engineer Trainee", focus: ["aerodynamics", "structures", "hr", "behavioral"] },
  { id: "scientist", name: "Scientist / Engineer (Govt)", focus: ["propulsion", "aerodynamics", "structures", "hr"] },
  { id: "phd", name: "PhD Interview", focus: ["research", "aerodynamics", "behavioral"] },
  { id: "ms", name: "MS Interview", focus: ["research", "coding", "behavioral"] },
];

export function roleById(id: string): RoleDef | undefined {
  return ROLES.find((r) => r.id === id);
}

/** Categories a role/company blend should draw from, in priority order. */
export function categoriesFor(roleFocus: Category[], modeCategories: Category[] | null): Category[] {
  if (modeCategories) return modeCategories;
  return roleFocus;
}
