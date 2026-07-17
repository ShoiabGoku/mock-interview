import type { Category } from "@/lib/types";

/** Learning resources surfaced by the AI coach for weak topics. */
export const RESOURCES: Record<Category, { title: string; type: string }[]> = {
  aerodynamics: [
    { title: "Anderson — Fundamentals of Aerodynamics", type: "Book" },
    { title: "MIT 16.100 Aerodynamics (OCW)", type: "Course" },
  ],
  cfd: [
    { title: "Versteeg & Malalasekera — Intro to CFD", type: "Book" },
    { title: "Lorena Barba — 12 Steps to Navier-Stokes", type: "Tutorial" },
  ],
  structures: [
    { title: "Megson — Aircraft Structures for Engineering Students", type: "Book" },
    { title: "Hibbeler — Mechanics of Materials", type: "Book" },
  ],
  propulsion: [
    { title: "Hill & Peterson — Mechanics & Thermodynamics of Propulsion", type: "Book" },
    { title: "Sutton — Rocket Propulsion Elements", type: "Book" },
  ],
  thermal: [
    { title: "Incropera — Fundamentals of Heat and Mass Transfer", type: "Book" },
    { title: "MIT 2.51 Thermal-Fluids (OCW)", type: "Course" },
  ],
  "flight-mechanics": [
    { title: "Nelson — Flight Stability and Automatic Control", type: "Book" },
    { title: "Etkin — Dynamics of Flight", type: "Book" },
  ],
  controls: [
    { title: "Ogata — Modern Control Engineering", type: "Book" },
    { title: "Brian Douglas — Control Systems Lectures (YouTube)", type: "Video" },
  ],
  coding: [
    { title: "NeetCode 150", type: "Problem Set" },
    { title: "Cracking the Coding Interview", type: "Book" },
    { title: "LeetCode — Top Interview 150", type: "Problem Set" },
  ],
  "system-design": [
    { title: "System Design Interview — Alex Xu (Vol 1 & 2)", type: "Book" },
    { title: "ByteByteGo (YouTube)", type: "Video" },
  ],
  "ml-ai": [
    { title: "Chip Huyen — Designing ML Systems", type: "Book" },
    { title: "Stanford CS229 (notes)", type: "Course" },
    { title: "The Illustrated Transformer — Jay Alammar", type: "Article" },
  ],
  "data-science": [
    { title: "Trustworthy Online Controlled Experiments (Kohavi)", type: "Book" },
    { title: "StatQuest (YouTube)", type: "Video" },
  ],
  quant: [
    { title: "A Practical Guide to Quantitative Finance Interviews (Zhou)", type: "Book" },
    { title: "Fifty Challenging Problems in Probability", type: "Book" },
  ],
  "case-study": [
    { title: "Case in Point — Cosentino", type: "Book" },
    { title: "Victor Cheng — Case Interview Secrets", type: "Book" },
  ],
  product: [
    { title: "Decode and Conquer — Lewis Lin", type: "Book" },
    { title: "Exponent — PM Interview Course", type: "Course" },
  ],
  behavioral: [
    { title: "STAR method guide", type: "Article" },
    { title: "Amazon Leadership Principles (practice stories)", type: "Guide" },
  ],
  hr: [{ title: "Common HR questions — prepare 10 crisp answers", type: "Guide" }],
  resume: [{ title: "Prune your resume — defend every bullet for 10 minutes", type: "Guide" }],
  research: [
    { title: "The Craft of Research", type: "Book" },
    { title: "How to give a research talk (Simon Peyton Jones)", type: "Video" },
  ],
  project: [{ title: "Structure project talks: problem → approach → result → impact", type: "Guide" }],
  "rapid-fire": [{ title: "Formula & concept flashcards — spaced repetition", type: "Guide" }],
};
