import type { BankQuestion, Category } from "@/lib/types";

/**
 * Interview question bank. Each question carries follow-ups (asked adaptively),
 * keywords (a strong answer should touch these — used by the scripted engine to
 * score), and an ideal answer sketch (shown only in the post-interview report).
 *
 * To extend: append questions to any category array. The scripted engine and
 * the AI engine both draw seeds from here.
 */

const Q = (
  id: string,
  category: Category,
  question: string,
  followUps: string[],
  keywords: string[],
  ideal: string,
  difficulty: BankQuestion["difficulty"] = "medium"
): BankQuestion => ({ id, category, question, followUps, keywords, ideal, difficulty });

export const QUESTION_BANK: BankQuestion[] = [
  // ---------------- Aerodynamics ----------------
  Q("aero-1", "aerodynamics",
    "Walk me through what physically generates lift on a wing. I don't want 'equal transit time'.",
    ["How does circulation relate to lift?", "What breaks down at high angle of attack?", "How does this change in compressible flow?"],
    ["pressure difference", "circulation", "kutta", "downwash", "newton", "bernoulli", "angle of attack"],
    "Lift comes from the net pressure difference produced when the wing turns the flow (Newton) — quantified by circulation via the Kutta–Joukowski theorem (L' = ρV∞Γ). The Kutta condition fixes circulation so flow leaves the trailing edge smoothly. Both the pressure and momentum views are consistent. Stall occurs when the boundary layer separates at high α, destroying circulation.",
    "medium"),
  Q("aero-2", "aerodynamics",
    "Why do transport aircraft use swept wings, and what does sweep cost you?",
    ["What is the drag-divergence Mach number?", "Why does sweep cause tip stall?", "How would you mitigate tip stall?"],
    ["mach", "drag divergence", "cos", "normal component", "tip stall", "wave drag", "washout"],
    "Only the velocity component normal to the leading edge drives compressibility, so sweep Λ reduces the effective Mach by cosΛ, delaying drag divergence and wave drag. Costs: lower CLmax, spanwise flow that promotes tip stall (mitigated by washout, fences, vortilons), heavier structure, and reduced low-speed performance.",
    "medium"),
  Q("aero-3", "aerodynamics",
    "Air at Mach 2 (γ=1.4) — what's the stagnation-to-static temperature ratio, and derive it.",
    ["What about stagnation pressure ratio?", "Why is T0 conserved across a shock but p0 isn't?"],
    ["1.8", "energy", "1 + 0.2", "adiabatic", "isentropic", "gamma"],
    "T0/T = 1 + ((γ−1)/2)M² = 1 + 0.2·4 = 1.8, from steady adiabatic energy conservation (h0 = h + V²/2). T0 is conserved across a shock (adiabatic) but p0 drops because a shock is irreversible — entropy rises.",
    "easy"),
  Q("aero-4", "aerodynamics",
    "Explain induced drag from first principles and how aspect ratio changes it.",
    ["Why do winglets help?", "What's the elliptical lift distribution about?"],
    ["tip vortices", "downwash", "cl squared", "aspect ratio", "oswald", "elliptical", "pi e ar"],
    "Finite wings shed tip vortices; the induced downwash tilts the local lift vector rearward, producing a drag component. CDi = CL²/(πeAR), so higher aspect ratio and an elliptical (e→1) loading minimize it. Winglets act as a partial end-plate, weakening the tip vortex.",
    "medium"),

  // ---------------- CFD ----------------
  Q("cfd-1", "cfd",
    "You run a RANS simulation and the lift is 15% off from wind-tunnel data. Walk me through how you'd debug it.",
    ["How would you check mesh independence?", "Which turbulence model would you suspect first and why?", "How do you know your y+ is right?"],
    ["mesh independence", "y+", "turbulence model", "boundary conditions", "convergence", "separation", "validation"],
    "Systematic: verify convergence (residuals + monitored quantities flat), then boundary conditions and domain size, then mesh independence via refinement, then y+ appropriate to the wall treatment, then the turbulence model (SA/k-ω SST handle adverse pressure gradients and separation differently). Compare pressure distributions, not just integrated lift, to localize the discrepancy.",
    "hard"),
  Q("cfd-2", "cfd",
    "What does y+ mean and why do I care about it?",
    ["When would you use wall functions vs resolving the viscous sublayer?", "What y+ do you target for SST?"],
    ["wall", "viscous sublayer", "wall function", "boundary layer", "first cell", "y plus"],
    "y+ is the non-dimensional wall distance of the first cell. To resolve the viscous sublayer you need y+≈1; with wall functions you place the first cell in the log layer (y+≈30–300). SST k-ω is designed for low-y+ near-wall resolution, which matters for separation prediction.",
    "medium"),

  // ---------------- Structures ----------------
  Q("str-1", "structures",
    "In a semi-monocoque fuselage, which components carry which loads?",
    ["What buckling modes worry you in the skin?", "How do you size a stringer?", "What's the role of frames?"],
    ["skin", "shear", "stringers", "axial", "bending", "frames", "buckling", "shear flow"],
    "Skin carries shear flow (torsion + transverse), stringers/longerons carry axial loads from bending, frames maintain cross-section shape and redistribute concentrated loads and prevent general instability. Skin buckling is allowed in tension-field design; stringers are sized against column and crippling buckling.",
    "medium"),
  Q("str-2", "structures",
    "A thin-walled pressure vessel, r=0.5 m, t=10 mm, p=2 MPa. Give me the hoop and axial stresses and which fails first.",
    ["What if it's a sphere instead?", "Where would a crack propagate fastest?"],
    ["hoop", "pr/t", "100", "axial", "pr/2t", "50", "twice"],
    "Hoop σ = pr/t = 100 MPa; axial σ = pr/2t = 50 MPa. Hoop is twice axial, so a longitudinal (axial) crack driven by hoop stress opens first — cylinders split lengthwise. A sphere has σ = pr/2t everywhere, so it's more efficient.",
    "easy"),
  Q("str-3", "structures",
    "How does the Euler buckling load of a column change if I double its length?",
    ["What about changing end conditions?", "When does Euler stop being valid?"],
    ["pi squared", "ei", "l squared", "quarter", "slenderness", "johnson", "yield"],
    "Pcr = π²EI/(KL)², so doubling L drops the critical load to a quarter. End conditions change K (pinned 1, fixed-free 2, fixed-fixed 0.5). Euler is only valid for slender columns; short columns fail by yielding/crippling (Johnson parabola region).",
    "easy"),

  // ---------------- Propulsion ----------------
  Q("prop-1", "propulsion",
    "Why are high-bypass turbofans more efficient than turbojets at subsonic cruise?",
    ["Derive propulsive efficiency.", "Why not just make bypass ratio infinite?"],
    ["propulsive efficiency", "bypass", "exhaust velocity", "mass flow", "momentum", "2/(1+ve/v0)"],
    "For a given thrust ṁΔV, kinetic-energy loss scales with ΔV², so accelerating a large mass of air slightly (high bypass) wastes less energy than a small mass a lot. ηp = 2/(1 + Ve/V0), maximized as Ve→V0. You can't make bypass infinite: fan weight, drag, and diminishing returns limit it.",
    "medium"),
  Q("prop-2", "propulsion",
    "A rocket has exhaust velocity 2500 m/s and mass ratio 4. What's the ideal Δv, and why do we stage?",
    ["What limits a single stage to orbit?", "How does Isp relate to exhaust velocity?"],
    ["tsiolkovsky", "ln", "3466", "delta v", "staging", "dead mass", "structural"],
    "Δv = Ve·ln(m0/mf) = 2500·ln4 ≈ 3466 m/s. We stage because dead structural mass in mf strangles the logarithm; dropping empty tanks mid-flight effectively multiplies the achievable Δv. SSTO is marginal with chemical propellants precisely because of this. Isp = Ve/g0.",
    "medium"),

  // ---------------- Thermal / Heat Transfer ----------------
  Q("therm-1", "thermal",
    "When is the lumped-capacitance assumption valid, and what does the Biot number tell you?",
    ["What's the physical meaning of a small Biot number?", "How would you estimate a convection coefficient?"],
    ["biot", "hl/k", "0.1", "internal resistance", "uniform temperature", "convection"],
    "Lumped capacitance is valid when Bi = hLc/k < 0.1 — internal conduction resistance is negligible versus surface convection, so the body has near-uniform temperature. Small Bi means the body behaves as one 'lump.' h comes from a Nusselt correlation for the geometry and flow regime.",
    "medium"),
  Q("therm-2", "thermal",
    "Estimate the equilibrium temperature of a flat plate in space facing the sun. Talk me through your assumptions.",
    ["What changes with a selective coating?", "How does this scale with distance from the sun?"],
    ["stefan boltzmann", "absorptivity", "emissivity", "solar constant", "radiation", "balance", "1361"],
    "Balance absorbed solar (αGs·A_proj) against radiated (εσT⁴·A_rad). For a plate radiating one side, T = (αGs/εσ)^0.25 with Gs≈1361 W/m². Selective coatings tune α/ε to control temperature. Solar flux scales as 1/r², so T scales as r^(−1/2).",
    "hard"),

  // ---------------- Flight Mechanics ----------------
  Q("fm-1", "flight-mechanics",
    "What load factor does a coordinated level turn at 60° bank pull, and why does stall speed change in a turn?",
    ["Derive the turn radius.", "What's the corner speed?"],
    ["load factor", "1/cos", "2g", "stall speed", "sqrt n", "turn radius"],
    "n = 1/cosφ = 2 at 60°. Stall speed rises as √n because you need more lift; Vs_turn = Vs·√n. Turn radius R = V²/(g·tanφ). Corner speed is where the structural limit load and aerodynamic (stall) limit meet — the tightest instantaneous turn.",
    "medium"),
  Q("fm-2", "flight-mechanics",
    "Explain the phugoid and short-period modes. Which one would you feel as a pilot?",
    ["What determines short-period damping?", "Why is the phugoid lightly damped?"],
    ["phugoid", "short period", "long period", "angle of attack", "speed", "altitude", "damping"],
    "Short period: fast, well-damped oscillation in angle of attack at nearly constant speed — you feel it immediately. Phugoid: slow exchange of kinetic and potential energy (speed↔altitude) at nearly constant α, lightly damped, long period — a lazy porpoising you can ride out. Short-period damping is set by pitch damping derivatives and static margin.",
    "hard"),

  // ---------------- Controls ----------------
  Q("ctrl-1", "controls",
    "For a system s³ + 3s² + 3s + (1+K) = 0, find the K range for stability.",
    ["What does a row of zeros in Routh mean?", "How would gain margin relate to this?"],
    ["routh", "hurwitz", "stability", "k < 8", "characteristic", "first column"],
    "Routh array: stability needs all first-column terms positive. The s¹ row gives (9−(1+K))/3 > 0 ⇒ K < 8, and the constant term gives K > −1. So −1 < K < 8. A row of zeros signals symmetric roots (imaginary-axis crossing) — the marginal-stability gain.",
    "hard"),
  Q("ctrl-2", "controls",
    "For G(s)=ωn²/(s²+2ζωn s+ωn²), what do ζ and ωn control, and what ζ would you design for?",
    ["What's the overshoot at ζ=0.7?", "What's the trade-off in picking ζ?"],
    ["damping ratio", "natural frequency", "overshoot", "settling", "0.7", "second order"],
    "ωn sets speed/bandwidth; ζ sets damping and overshoot. ζ≈0.7 is the classic choice — ~5% overshoot with fast settling, near-optimal ITAE. Lower ζ is faster but oscillatory; higher ζ is sluggish. The trade-off is rise time vs overshoot vs settling time.",
    "medium"),

  // ---------------- Coding ----------------
  Q("cod-1", "coding",
    "Given an array of integers, find the maximum sum of a contiguous subarray. Walk me through your approach and complexity.",
    ["What if all numbers are negative?", "Can you do it in O(1) space?", "How would you also return the subarray indices?"],
    ["kadane", "dynamic programming", "o(n)", "current sum", "max", "linear"],
    "Kadane's algorithm: track best-ending-here (cur = max(x, cur+x)) and global best in one O(n) pass, O(1) space. For all-negative arrays, initialize best to −∞ rather than 0 so you return the largest single element. Track start/end indices by recording where cur resets.",
    "medium"),
  Q("cod-2", "coding",
    "How would you detect a cycle in a linked list? Give me the optimal approach.",
    ["Prove Floyd's algorithm terminates.", "How do you find the cycle's start node?", "What's the space complexity of a hash-set approach?"],
    ["floyd", "slow fast", "tortoise hare", "two pointers", "o(1) space", "meeting point"],
    "Floyd's tortoise-and-hare: slow moves 1, fast moves 2; if they meet, there's a cycle — O(n) time, O(1) space. To find the start, reset one pointer to head and advance both by 1; they meet at the cycle entry. A hash-set works but costs O(n) space.",
    "medium"),
  Q("cod-3", "coding",
    "Design a function to check if two strings are anagrams. Discuss trade-offs.",
    ["What about Unicode?", "Which is better for many repeated calls: sort or count?"],
    ["hash map", "count", "sort", "o(n)", "frequency", "character count"],
    "Count character frequencies in one string, decrement with the other, check all zero — O(n) time, O(k) space (k = alphabet). Sorting is O(n log n) but simpler and no alphabet assumption. For repeated calls or fixed ASCII, the counting array wins. Unicode needs code-point-aware counting.",
    "easy"),
  Q("cod-4", "coding",
    "Explain the time complexity of common operations on a hash map and when it degrades.",
    ["What causes worst-case O(n)?", "How does resizing work?", "How would you handle collisions?"],
    ["o(1)", "average", "collision", "load factor", "resize", "worst case", "chaining"],
    "Average O(1) insert/lookup with a good hash and bounded load factor; worst case O(n) when everything collides (bad hash or adversarial keys). Resizing (doubling) keeps the load factor bounded — amortized O(1). Collisions are handled by chaining or open addressing.",
    "medium"),

  // ---------------- System Design ----------------
  Q("sd-1", "system-design",
    "Design a URL shortener like bit.ly. Start with requirements.",
    ["How do you generate short keys without collisions?", "How do you handle 100k reads/sec?", "How would you add analytics?"],
    ["requirements", "hash", "base62", "key generation", "cache", "database", "read heavy", "scale"],
    "Clarify scale (reads≫writes), then: generate keys via base62 of an auto-increment ID or a hash with collision check; store mapping in a KV store; cache hot URLs (read-heavy); use a CDN/edge for redirects; shard the DB by key; add async analytics via a message queue. Discuss consistency, TTL, and custom aliases.",
    "hard"),
  Q("sd-2", "system-design",
    "How would you design a rate limiter for an API?",
    ["Token bucket vs sliding window — trade-offs?", "How does it work in a distributed setting?"],
    ["token bucket", "sliding window", "leaky bucket", "redis", "distributed", "counter"],
    "Token bucket allows bursts up to bucket size while enforcing an average rate; sliding-window log is precise but memory-heavy; fixed-window counters are cheap but allow edge bursts. Distributed: centralize counters in Redis with atomic ops (or use a consistent-hash-sharded limiter), accepting a small accuracy/latency trade-off.",
    "hard"),

  // ---------------- ML / AI ----------------
  Q("ml-1", "ml-ai",
    "Explain the bias–variance trade-off and how you'd diagnose which one is hurting your model.",
    ["What does a learning curve tell you?", "How does regularization move you along this trade-off?"],
    ["bias", "variance", "overfitting", "underfitting", "learning curve", "regularization", "generalization"],
    "High bias = underfitting (train and val error both high, close together); high variance = overfitting (low train, high val, big gap). Diagnose with learning curves. Reduce variance with more data, regularization (L1/L2, dropout), or simpler models; reduce bias with more capacity or better features.",
    "medium"),
  Q("ml-2", "ml-ai",
    "Your classifier has 95% accuracy but the business is unhappy. What's likely going on and what do you look at?",
    ["When is accuracy the wrong metric?", "Explain precision vs recall in this context.", "How would you pick a threshold?"],
    ["class imbalance", "precision", "recall", "f1", "confusion matrix", "roc", "threshold", "accuracy paradox"],
    "Likely class imbalance — 95% accuracy can mean predicting the majority class. Look at the confusion matrix, precision/recall/F1 per class, and PR/ROC curves. Choose the operating threshold from the business cost of false positives vs false negatives, not from accuracy.",
    "medium"),
  Q("ml-3", "ml-ai",
    "Walk me through how a transformer's self-attention works and why it beat RNNs.",
    ["Why the scaling by sqrt(dk)?", "What's the computational cost with sequence length?", "What is multi-head attention buying you?"],
    ["attention", "query key value", "softmax", "parallel", "sqrt dk", "quadratic", "multi head", "positional"],
    "Self-attention computes softmax(QKᵀ/√dk)V — every token attends to every other, weighting by learned query-key similarity. Scaling by √dk keeps softmax gradients healthy. It beat RNNs by being parallelizable (no sequential dependency) and modeling long-range dependencies directly, at O(n²) cost in sequence length. Multi-head lets it attend to different subspaces.",
    "hard"),

  // ---------------- Data Science ----------------
  Q("dsci-1", "data-science",
    "You're asked whether a new feature increased user engagement. How do you design the experiment and analyze it?",
    ["How do you pick sample size?", "What's a p-value actually telling you?", "How do you handle novelty effects?"],
    ["a/b test", "hypothesis", "control", "sample size", "p-value", "significance", "confidence interval", "power"],
    "A/B test: define the metric and hypothesis, randomize users to control/treatment, power the sample size for a target effect, run long enough to avoid novelty/weekly seasonality, then compare with a significance test and report a confidence interval and effect size — not just a p-value. Check for peeking and multiple-comparison issues.",
    "medium"),
  Q("dsci-2", "data-science",
    "Explain the difference between correlation and causation, and how you'd try to establish causation from observational data.",
    ["What's a confounder?", "What can an instrumental variable do for you?"],
    ["confounder", "causation", "randomized", "instrumental variable", "regression", "controlled", "counterfactual"],
    "Correlation is co-movement; causation means intervening on X changes Y. The gold standard is randomization. From observational data you control for confounders (regression, matching, propensity scores), use natural experiments/instrumental variables, or difference-in-differences — always reasoning about the counterfactual.",
    "medium"),

  // ---------------- Quant ----------------
  Q("quant-1", "quant",
    "You flip a fair coin until you get heads. What's the expected number of flips? Now what's the expected number of flips to get two heads in a row?",
    ["Set up the recurrence for two-in-a-row.", "What's the variance of the first one?"],
    ["geometric", "expected value", "2", "recurrence", "6", "states"],
    "First heads: geometric, E = 1/p = 2. Two-in-a-row (HH): set up states by current streak. E = 6 flips, from E = 1 + 0.5·E1 + 0.5·E, E1 = 1 + 0.5·E, solving to E = 6. The key is defining states and writing the expectation recurrence.",
    "medium"),
  Q("quant-2", "quant",
    "Three fair dice are rolled. What's the probability all three show different values?",
    ["What's the probability of exactly two matching?", "Expected number of distinct values?"],
    ["6/9", "5/9", "0.5556", "combinatorics", "counting", "120/216"],
    "First die anything, second must differ (5/6), third must differ from both (4/6): (5/6)(4/6) = 20/36 = 5/9 ≈ 0.556. Exactly two matching = 1 − P(all different) − P(all same) = 1 − 5/9 − 1/36 = 15/36. Clean counting beats formulas here.",
    "medium"),

  // ---------------- Case Study ----------------
  Q("case-1", "case-study",
    "A regional airline's profits fell 20% last year while revenue stayed flat. Our client wants to know why. How do you approach this?",
    ["What would you look at first — costs or revenue mix?", "How would you size the fuel-cost impact?", "What's your hypothesis?"],
    ["structure", "profit", "revenue", "cost", "framework", "hypothesis", "fuel", "segment", "mece"],
    "Structure first: profit = revenue − cost, and revenue flat means cost rose or mix shifted. Break costs into fuel, labor, maintenance, fees; break revenue into routes/segments and yield/load factor. State a hypothesis (e.g. fuel spike), then size it with data and test. Stay MECE and drive to a recommendation.",
    "hard"),

  // ---------------- Product ----------------
  Q("prod-1", "product",
    "How would you improve Google Maps for a user in a city they've never visited?",
    ["Who's the user and what's their goal?", "How would you prioritize the features you listed?", "What metric would you move?"],
    ["user", "pain point", "prioritize", "metric", "goal", "segment", "trade-off"],
    "Clarify the user and goal (tourist orienting vs commuter), enumerate pain points (unfamiliar transit, safety, discovery), brainstorm solutions, prioritize by impact × effort, and tie to a north-star metric (e.g. successful navigations, session depth). Close with what you'd A/B test first and why.",
    "medium"),

  // ---------------- Behavioral ----------------
  Q("beh-1", "behavioral",
    "Tell me about a time you failed at something technical. What happened and what did you do?",
    ["What would you do differently now?", "How did you communicate the failure to your team?", "What did you learn about yourself?"],
    ["star", "situation", "action", "result", "ownership", "learned", "recovery"],
    "Use STAR with a real failure you owned. Situation and task briefly, then most of the answer on your specific actions to diagnose and recover, then a quantified result and a concrete lesson. Show ownership (no blame), honest reflection, and a behavior change you actually made.",
    "medium"),
  Q("beh-2", "behavioral",
    "Describe a conflict you had with a teammate and how you resolved it.",
    ["What was the other person's perspective?", "What would you do if it happened again?"],
    ["conflict", "perspective", "listen", "data", "compromise", "resolution", "empathy"],
    "Pick a real disagreement, show you understood the other side, and describe moving from opinions to evidence (benchmark, data, or a trial). Emphasize listening, finding shared goals, and a concrete resolution that shipped — plus what you learned about collaboration. Never blame the teammate.",
    "medium"),
  Q("beh-3", "behavioral",
    "Tell me about a time you led something without formal authority.",
    ["How did you get buy-in?", "What resistance did you face?"],
    ["leadership", "influence", "initiative", "buy-in", "ownership", "result"],
    "Show initiative and influence-without-authority: identify a gap, rally people around a shared goal, coordinate the work, handle resistance with persuasion and evidence, and deliver a measurable outcome. Highlight how you brought others along, not just what you personally did.",
    "medium"),

  // ---------------- HR ----------------
  Q("hr-1", "hr",
    "Why do you want to work here, specifically, and not a competitor?",
    ["What do you know about our recent work?", "Where do you see yourself in five years?"],
    ["motivation", "specific", "mission", "research", "role", "team", "fit"],
    "Tie three of their specific needs/projects to your proofs — name real work of theirs, not generic praise. Show you researched the team and role, connect it to your trajectory, and be concrete about what you'd contribute in the first six months. Avoid answers that would fit any company.",
    "easy"),
  Q("hr-2", "hr",
    "What's your greatest weakness?",
    ["What are you doing to improve it?", "Give an example of it showing up."],
    ["weakness", "self-awareness", "improvement", "specific", "honest", "growth"],
    "Name a real, non-fatal weakness (not central to the role), give a concrete example, and show the specific steps you're taking with evidence of progress. Authenticity plus a visible improvement plan is what's assessed. Avoid 'I work too hard' — interviewers discount it instantly.",
    "easy"),

  // ---------------- Resume ----------------
  Q("res-1", "resume",
    "Pick the project on your resume you're proudest of and tell me the single hardest technical decision you made.",
    ["What alternatives did you consider?", "How did you validate the choice?", "What would you change now?"],
    ["trade-off", "decision", "alternatives", "validation", "reasoning", "ownership"],
    "Choose a genuine trade-off (e.g. solver choice, model architecture, mesh strategy). State the options, the constraints, how you estimated/prototyped, why you committed, and how you validated. Decisions demonstrate engineering maturity better than success stories — and end with an honest 'what I'd change.'",
    "medium"),

  // ---------------- Research ----------------
  Q("resr-1", "research",
    "Explain your thesis to me as if I'm a smart engineer outside your field, in about a minute.",
    ["What's the one result you're proudest of?", "What's the biggest limitation of your approach?", "What would you do with six more months?"],
    ["problem", "significance", "approach", "contribution", "limitation", "impact", "clear"],
    "Everyday analogy → the problem and why it matters → your specific contribution → the impact — one clean minute. Research interviewers use this to test whether you understand it, so lead with significance and be honest about limitations. Have a crisp 'proudest result' and a realistic next step ready.",
    "medium"),
  Q("resr-2", "research",
    "A reviewer says your key result contradicts their intuition and pushes back hard. Walk me through how you respond.",
    ["What if you actually don't know the answer?", "How do you defend without being defensive?"],
    ["data", "validation", "conditions", "honest", "limiting cases", "evidence", "intellectual honesty"],
    "Restate their concern to show you understood it, present the validation (grid convergence, experimental comparison, limiting cases), and — crucially — state the conditions under which they'd be right. If you don't know, say so and outline how you'd test it. Intellectual honesty under pressure is exactly what's being probed.",
    "hard"),

  // ---------------- Project ----------------
  Q("proj-1", "project",
    "Walk me through the architecture of your most complex project and where it could break.",
    ["What was the bottleneck?", "How did you test it?", "If you 10×'d the load, what fails first?"],
    ["architecture", "bottleneck", "testing", "trade-off", "failure mode", "scale"],
    "Top-down: the problem, the system at block level, then dive where they probe. Name the real bottleneck, how you tested/validated, and the honest failure modes. Showing you know where your own system breaks — and why — signals maturity far more than claiming it's flawless.",
    "medium"),

  // ---------------- Rapid Fire ----------------
  Q("rf-1", "rapid-fire",
    "Quick: what's the speed of sound at sea level, roughly, and why does it drop with altitude?",
    [],
    ["340", "343", "temperature", "sqrt", "gamma r t", "decreases"],
    "≈340 m/s at sea level. a = √(γRT), so it depends only on temperature — as temperature falls with altitude (troposphere), the speed of sound drops.",
    "easy"),
  Q("rf-2", "rapid-fire",
    "Quick: time complexity of binary search, and the one precondition it needs?",
    [],
    ["log n", "sorted", "halving"],
    "O(log n); the array must be sorted. Each comparison halves the search space.",
    "easy"),
  Q("rf-3", "rapid-fire",
    "Quick: what does a positive static margin mean for an aircraft?",
    [],
    ["stable", "cg", "neutral point", "ahead", "longitudinal"],
    "The CG is ahead of the neutral point, so the aircraft is longitudinally statically stable — a disturbance produces a restoring pitching moment.",
    "easy"),
  Q("rf-4", "rapid-fire",
    "Quick: L1 vs L2 regularization — one-line difference?",
    [],
    ["sparse", "l1", "feature selection", "l2", "shrink", "ridge", "lasso"],
    "L1 (lasso) drives weights to exactly zero (sparse, feature-selecting); L2 (ridge) shrinks weights smoothly toward zero without eliminating them.",
    "easy"),
];

/** Questions in a category, hardest last. */
export function questionsIn(category: Category): BankQuestion[] {
  return QUESTION_BANK.filter((q) => q.category === category);
}

/**
 * Build an ordered question set for a session: draw from the requested
 * categories in priority order, round-robin, up to `count`.
 */
export function buildQuestionSet(categories: Category[], count: number): BankQuestion[] {
  const pools = categories.map((c) => shuffle(questionsIn(c)));
  const out: BankQuestion[] = [];
  let idx = 0;
  while (out.length < count && pools.some((p) => p.length > 0)) {
    const pool = pools[idx % pools.length];
    if (pool.length > 0) out.push(pool.shift()!);
    idx++;
    if (idx > count * pools.length + 50) break; // safety
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
