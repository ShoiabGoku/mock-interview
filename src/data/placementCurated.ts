import type { Category } from "@/lib/types";

/**
 * Hand conversions for Myplacement questions that make better OPEN interview
 * questions than quizzes.
 *
 * The interview-prep bank (int-*) writes questions like `Interviewer: "Why
 * do airliners have winglets?" The best core answer is:` and the resume bank
 * (res-*) asks "why/how" about specific CV claims. Reading four options aloud
 * would turn a good viva question into a guessing game, so these are asked
 * the way a panel would ask them and scored on keywords like the rest of the
 * open bank. The model answer in the report is still Myplacement's correct
 * option plus its worked solution.
 *
 * Numericals from these banks (res-005, res-013, ...) are NOT here — they
 * stay exactly graded. See placementBank.ts.
 */

export interface OpenConversion {
  category: Category;
  question: string;
  followUps: string[];
  keywords: string[];
}

export const OPEN_CONVERSIONS: Record<string, OpenConversion> = {
  // ---------------- Interview-prep bank: technical ----------------
  "int-001": {
    category: "aerodynamics",
    question: "Why do modern airliners have winglets? What are they actually doing to the flow?",
    followUps: ["Roughly how much fuel does that buy you in cruise?", "Why not just extend the span instead?", "What does a winglet cost you?"],
    keywords: ["tip vortices", "induced drag", "downwash", "fuel", "span", "pressure"],
  },
  "int-003": {
    category: "aerodynamics",
    question: "What does the Whitcomb area rule say, and where would I see it on a real aircraft?",
    followUps: ["Why does it only really matter near Mach 1?", "What happens to wave drag if you ignore it?"],
    keywords: ["cross sectional area", "wave drag", "transonic", "smooth", "coke bottle", "fuselage"],
  },
  "int-005": {
    category: "flight-mechanics",
    question: "What's the 'coffin corner' of a high-altitude aircraft, and why does it exist?",
    followUps: ["Why does true stall speed rise with altitude?", "What sets the high-speed boundary up there?", "How would a designer open the corner up?"],
    keywords: ["stall speed", "critical mach", "altitude", "buffet", "density", "converge"],
  },
  "int-006": {
    category: "propulsion",
    question: "Why are rockets built in multiple stages? Argue it from the rocket equation.",
    followUps: ["So why is single-stage-to-orbit so hard with chemical propellants?", "Why not use ten stages, then?"],
    keywords: ["tsiolkovsky", "delta v", "mass ratio", "dead mass", "ln", "staging"],
  },
  "int-007": {
    category: "cs-fundamentals",
    question: "What happens when you type a URL into a browser and press Enter? Take me through it in order.",
    followUps: ["Why can't the TCP handshake happen before DNS?", "Where does TLS come in, and what does it protect?", "What gets cached along the way?"],
    keywords: ["dns", "ip address", "tcp", "handshake", "tls", "http", "render"],
  },
  "int-008": {
    category: "cs-fundamentals",
    question: "What is polymorphism? Give me a concrete example.",
    followUps: ["What's the difference between compile-time and runtime polymorphism?", "How does the runtime actually pick the right method to call?"],
    keywords: ["interface", "override", "overload", "runtime", "base class", "subclass"],
  },
  "int-021": {
    category: "case-study",
    question: "Estimate how many aircraft are airborne over India right now. Walk me through it.",
    followUps: ["Which assumption is your answer most sensitive to?", "How would you sanity-check that number?"],
    keywords: ["assumptions", "flights per day", "flight duration", "airports", "sanity check", "structure"],
  },
  "int-023": {
    category: "system-design",
    question:
      "Here's an open-ended one: design a system that tracks every vehicle moving on an airport apron. Before any design — what's the very first thing you do?",
    followUps: ["What would you ask me about scale?", "Which edge cases would change the design the most?"],
    keywords: ["requirements", "clarify", "constraints", "scale", "edge cases", "assumptions"],
  },
  "int-024": {
    category: "structures",
    question: "A slender column keeps buckling. Would switching to a higher-strength alloy fix it?",
    followUps: ["So what would you change instead?", "At what slenderness does material strength start to matter again?"],
    keywords: ["euler", "modulus", "moment of inertia", "effective length", "geometry", "yield"],
  },
  "int-025": {
    category: "propulsion",
    question: "Why does a cryogenic upper stage give a higher specific impulse than a solid booster?",
    followUps: ["So why use solids at all?", "What does liquid hydrogen's low density cost you?"],
    keywords: ["exhaust velocity", "molecular weight", "chamber temperature", "hydrogen", "isp", "sqrt"],
  },

  // ---------------- Interview-prep bank: people rounds ----------------
  "int-010": {
    category: "behavioral",
    question: "Tell me about a time you took the initiative on something nobody had asked you to do.",
    followUps: ["What was the measurable result?", "What exactly was your part, as opposed to the team's?", "What would you do differently now?"],
    keywords: ["star", "situation", "action", "result", "initiative", "outcome"],
  },
  "int-013": {
    category: "hr",
    question: "Tell me about yourself.",
    followUps: ["Why this role, and why now?", "What's the one achievement you'd want this panel to remember?"],
    keywords: ["currently", "project", "achievement", "experience", "role", "career goal"],
  },
  "int-020": {
    category: "behavioral",
    question: "What do you do when an interviewer asks you something you genuinely don't know?",
    followUps: ["Give me an example of when that actually happened.", "Where's the line between reasoning out loud and bluffing?"],
    keywords: ["honest", "admit", "reason", "first principles", "related", "bluff"],
  },

  // ---------------- Resume bank: thesis / seminar / publication ----------------
  "res-001": {
    category: "research",
    question:
      "Your thesis estimates stagnation-point heating. In the Fay–Riddell correlation, how does peak heat flux scale with nose radius — and what does that tell a designer?",
    followUps: ["If I double the nose radius, roughly how much does heating drop?", "So why isn't every re-entry vehicle blunt?", "Does the same scaling hold for radiative heating?"],
    keywords: ["inverse square root", "nose radius", "velocity gradient", "blunt", "heat flux", "drag"],
  },
  "res-002": {
    category: "research",
    question: "Your future work lists non-unity Lewis-number effects. What does the Lewis number physically compare, and why does it matter at the wall?",
    followUps: ["How is it different from the Prandtl and Schmidt numbers?", "Roughly how big is the effect on heat flux?"],
    keywords: ["thermal diffusivity", "mass diffusivity", "species", "dissociation", "recombination", "heat flux"],
  },
  "res-003": {
    category: "research",
    question: "You plan to model wall catalycity. How does a fully catalytic wall compare with a non-catalytic one for heat flux — and why?",
    followUps: ["What did the Shuttle do about this?", "How would you bound the effect if the catalycity is unknown?"],
    keywords: ["higher", "recombination", "dissociation energy", "atoms", "surface", "coating"],
  },
  "res-004": {
    category: "research",
    question:
      "You simulated Mach 8 with 5-species finite-rate chemistry. Compared with a calorically perfect gas, what does real-gas modelling do to the post-shock temperature and the shock standoff?",
    followUps: ["Why does the density ratio across the shock go up?", "Does pressure change as much as temperature? Why not?"],
    keywords: ["lower temperature", "smaller standoff", "vibration", "dissociation", "density ratio", "energy"],
  },
  "res-006": {
    category: "research",
    question: "You ran Fluent with a density-based solver for the hypersonic case. Why is that the right choice there?",
    followUps: ["When would you use the pressure-based solver instead?", "Which flux scheme did you use for the shocks, and why?"],
    keywords: ["coupled", "density", "momentum", "energy", "shock", "compressible"],
  },
  "res-007": {
    category: "research",
    question:
      "Finite-rate chemistry matters when the Damköhler number is order one. What do the two limits — Da going to infinity and Da going to zero — represent?",
    followUps: ["Where do typical re-entry conditions sit?", "What goes wrong if you assume equilibrium at high altitude?"],
    keywords: ["equilibrium", "frozen", "residence time", "reaction time", "fast", "slow"],
  },
  "res-008": {
    category: "research",
    question: "In your seminar on the Meshless Finite Difference Method — how are the derivative operators actually built on scattered nodes?",
    followUps: ["Why does that give an overdetermined system?", "How is that different from finite elements?"],
    keywords: ["taylor", "neighbours", "cloud", "least squares", "weighted", "no mesh"],
  },
  "res-009": {
    category: "research",
    question: "Why is the least-squares system in GFDM weighted rather than plain?",
    followUps: ["Which weight functions would you pick?", "What does a badly chosen weight do to you?"],
    keywords: ["nearer", "distance", "truncation error", "local", "gaussian", "accuracy"],
  },
  "res-010": {
    category: "research",
    question: "Your seminar noted stability issues in GFDM. Where does ill-conditioning usually come from, and how do you fix it?",
    followUps: ["Would simply adding more nodes help?", "How would you detect a bad node cloud automatically?"],
    keywords: ["node distribution", "collinear", "one sided", "ill conditioned", "neighbours", "quadrant"],
  },
  "res-011": {
    category: "research",
    question: "Your takeaway was that meshless methods suit complex geometries and moving boundaries. Why, specifically — and what's the catch?",
    followUps: ["Why are boundary conditions harder in a meshless method?", "Would you use it for a steady external-aero case?"],
    keywords: ["connectivity", "remeshing", "large deformation", "moving nodes", "cost per node", "boundary conditions"],
  },
  "res-014": {
    category: "research",
    question: "Your Elsevier chapter used a banana–glass–banana hybrid layup. What's the engineering rationale for hybridising a natural fibre with glass?",
    followUps: ["Why put the natural fibre on the outer faces?", "Where would you NOT use this material?"],
    keywords: ["glass", "load", "weight", "cost", "sustainability", "trade-off"],
  },
  "res-017": {
    category: "research",
    question: "What are the weaknesses of banana-fibre composites? Critique your own material.",
    followUps: ["How would you improve the fibre–matrix adhesion?", "Would you trust it in a primary structure?"],
    keywords: ["moisture", "adhesion", "treatment", "scatter", "durability", "variability"],
  },
  "res-033": {
    category: "research",
    question:
      "For your hypersonic hemisphere, why is near-wall resolution — y-plus — especially critical when you're after heat flux rather than lift or drag?",
    followUps: ["What y-plus did you target?", "Why do integrated forces tolerate a coarser mesh?"],
    keywords: ["temperature gradient", "first cell", "y+", "integrated", "cancel", "fine mesh"],
  },
  "res-037": {
    category: "research",
    question:
      "You first-authored an Elsevier chapter on banana-fibre composites. What was YOUR specific contribution versus your co-authors', and what would you do differently now?",
    followUps: ["What's the weakest part of the methodology?", "How would you make the results more statistically robust?"],
    keywords: ["my contribution", "experiments", "analysis", "collaborative", "differently", "sample size"],
  },

  // ---------------- Resume bank: course / B.Tech projects ----------------
  "res-012": {
    category: "project",
    question: "Your B.Tech project studied stacking sequence and low-velocity impact. Why does the sequence matter when the ply count and material don't change?",
    followUps: ["Which matrix in laminate theory captures that?", "Where does delamination start, and why there?"],
    keywords: ["bending stiffness", "mid plane", "distance", "delamination", "interface", "orientation"],
  },
  "res-015": {
    category: "project",
    question: "You made your laminates by compression moulding. What does that buy you over hand layup?",
    followUps: ["Why does void content matter for your impact results?", "How would you measure void content?"],
    keywords: ["pressure", "fibre volume fraction", "voids", "repeatable", "resin", "consistency"],
  },
  "res-016": {
    category: "project",
    question: "In low-velocity impact on laminates, why is barely visible impact damage such a serious concern?",
    followUps: ["How does certification deal with it?", "How would you actually detect it?"],
    keywords: ["delamination", "internal", "compression after impact", "invisible", "buckling", "allowables"],
  },
  "res-019": {
    category: "project",
    question: "Your compressor project generated free-vortex blades. What defines a free-vortex design, and what does it force on the blade shape?",
    followUps: ["Why is the work uniform along the span?", "What other swirl distributions could you use?"],
    keywords: ["swirl", "radius", "constant", "radial equilibrium", "uniform work", "twist"],
  },
  "res-020": {
    category: "project",
    question: "Why does an axial compressor need many stages with modest pressure ratios, while one turbine stage can drive several compressor stages?",
    followUps: ["What happens if you push one compressor stage too hard?", "What's a typical per-stage pressure ratio?"],
    keywords: ["adverse pressure gradient", "favourable pressure gradient", "diffusion", "separation", "stall", "boundary layer"],
  },
  "res-022": {
    category: "project",
    question: "You computed your G-550 drag polar with VSPAERO. What's the fundamental limitation of a panel method, and how did you compensate?",
    followUps: ["Which drag components does it get right?", "How did you check the result against Piano-X?"],
    keywords: ["inviscid", "potential flow", "skin friction", "separation", "component build up", "induced drag"],
  },
  "res-023": {
    category: "project",
    question: "You estimated parasite drag at Mach 0.8. Which extra drag component shows up there that's absent at low speed?",
    followUps: ["What sets the drag-divergence Mach number?", "How would you estimate it early in design?"],
    keywords: ["wave drag", "shock", "transonic", "locally supersonic", "separation", "drag divergence"],
  },
  "res-024": {
    category: "project",
    question: "You modelled crack growth in the JAL 123 investigation with Paris' law. Which regime of crack growth does it actually describe?",
    followUps: ["What happens near threshold and near final fracture?", "How would you get C and m for a material?"],
    keywords: ["region ii", "stable", "intermediate", "log log", "straight line", "threshold"],
  },
  "res-026": {
    category: "project",
    question: "In the JAL 123 failure, what counted as one fatigue cycle for the rear pressure bulkhead?",
    followUps: ["Why do short-haul aircraft age faster than long-haul ones?", "What was wrong with the repair?"],
    keywords: ["one flight", "pressurisation", "climb", "descent", "hoop stress", "cycles"],
  },
  "res-027": {
    category: "project",
    question: "The stress intensity factor is K = Yσ√(πa). What does it physically represent?",
    followUps: ["How is K different from K_IC?", "Why can't you just use the stress at the crack tip?"],
    keywords: ["singular", "crack tip", "stress field", "amplitude", "fracture toughness", "geometry"],
  },
  "res-028": {
    category: "project",
    question: "You list Cryogenic Engineering I and II. Why is liquid hydrogen so much harder to store than liquid oxygen?",
    followUps: ["How does tank size make it worse?", "How would you insulate an LH2 tank for a long mission?"],
    keywords: ["20 k", "boiling point", "latent heat", "density", "boil off", "insulation"],
  },
  "res-029": {
    category: "project",
    question: "Why must hydrogen be pre-cooled before Joule–Thomson expansion can liquefy it?",
    followUps: ["Roughly what's the inversion temperature for helium?", "Why don't nitrogen and oxygen need this?"],
    keywords: ["inversion temperature", "205 k", "heats", "joule thomson coefficient", "liquid nitrogen", "throttling"],
  },

  // ---------------- Resume bank: internship / CV defence ----------------
  "res-030": {
    category: "resume",
    question:
      "Your IIT Bhubaneswar internship designed an endplate–aerofoil mount to cut tip-vortex effects. What's the aerodynamic purpose of the endplates?",
    followUps: ["Why does that matter when you compare with published aerofoil data?", "How would you check the endplates were working?"],
    keywords: ["spanwise flow", "two dimensional", "tip vortices", "induced drag", "downwash", "aerofoil data"],
  },
  "res-031": {
    category: "resume",
    question: "In sub-scale wind-tunnel testing you usually can't match both Reynolds and Mach number. Why does that matter, and how do people work around it?",
    followUps: ["Which one would you match for a transonic test?", "How does a cryogenic tunnel help?"],
    keywords: ["reynolds", "mach", "boundary layer", "transition", "separation", "trip"],
  },
  "res-032": {
    category: "resume",
    question: "Your internship ran CFD validation. What's the difference between verification and validation?",
    followUps: ["Give me an example of each from your own work.", "Can a perfectly verified simulation still be wrong?"],
    keywords: ["verification", "validation", "mathematical", "experiment", "grid convergence", "physical model"],
  },
  "res-035": {
    category: "resume",
    question:
      "Your CV lists Ansys Fluent, OpenVSP, SolidWorks, Python, LaTeX and more. I'm going to pick the one you've used least — which is it, and what exactly did you do with it?",
    followUps: ["What are its limitations?", "Where is your depth actually real?"],
    keywords: ["honest", "specific", "scope", "depth", "limitation", "project"],
  },
  "res-036": {
    category: "resume",
    question:
      "You've been a TA, Sports Councillor, Interview Coordinator and a club convener. Pick ONE leadership example and walk me through it.",
    followUps: ["What was the obstacle, and what did YOU do about it?", "What number would you put on the result?"],
    keywords: ["situation", "obstacle", "action", "result", "quantified", "ownership"],
  },
};

/**
 * Myplacement questions the interview bank already asks, near word for word.
 * Importing them again would only let the same question come up twice; the
 * existing entry keeps its follow-ups and keyword scoring.
 */
export const ALREADY_IN_BANK: Record<string, string> = {
  "int-002": "aero-2", // why swept wings
  "int-026": "aero-2", // why sweep, and what it costs
  "int-004": "prop-1", // high-bypass turbofan efficiency
  "int-009": "cod-10", // process vs thread
  "int-011": "hr-2", // greatest weakness
  "int-012": "isro-proj-1", // walk me through your M.Tech project
  "int-014": "hr-6", // why should we hire you
  "int-015": "hr-5", // salary expectations
  "int-016": "hr-7", // any questions for us
  "int-017": "beh-1", // a time you failed
  "int-018": "beh-2", // conflict with a teammate
  "int-019": "beh-3", // led without formal authority
  "int-022": "res-3", // deep question on a CV tool (res-035 is the CV-specific version)
  "res-034": "resr-1", // explain your thesis to a non-specialist
};

/**
 * Category overrides for exactly-graded questions whose Myplacement topic
 * doesn't say which interview round they belong to — the resume bank's
 * numericals are drawn from specific CV items.
 */
export const GRADED_CATEGORY: Record<string, Category> = {
  "res-005": "research", // thesis: Mach 8 stagnation temperature
  "res-013": "project", // B.Tech composites: rule of mixtures
  "res-018": "project", // compressor course project: Euler work
  "res-021": "project", // G-550 drag polar
  "res-025": "project", // JAL 123: Paris law
};
