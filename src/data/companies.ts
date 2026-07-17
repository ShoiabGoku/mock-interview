import type { Company, Interviewer } from "@/lib/types";

/**
 * Panel templates per industry. Companies reference a template so new
 * companies can be added in one line; add or override interviewers freely.
 */
const P = (
  id: string,
  name: string,
  role: string,
  department: string,
  avatar: string,
  personality: string,
  focus: Interviewer["focus"],
  style: Interviewer["style"]
): Interviewer => ({ id, name, role, department, avatar, personality, focus, style });

const TECH_PANEL: Interviewer[] = [
  P("t1", "Priya Nair", "Senior SWE", "Engineering", "👩‍💻", "Precise and methodical; probes edge cases relentlessly.", ["coding"], "skeptical"),
  P("t2", "Daniel Cho", "Staff Engineer", "Infrastructure", "👨‍💼", "Big-picture thinker; cares about trade-offs and scale.", ["system-design"], "curious"),
  P("t3", "Sara Alvi", "Engineering Manager", "Product Eng", "👩‍💼", "Warm but sharp; listens for ownership and collaboration.", ["behavioral", "project"], "warm"),
  P("t4", "Marcus Webb", "Bar Raiser", "Hiring Committee", "🧐", "Deliberately challenging; interrupts to test composure.", ["coding", "behavioral", "rapid-fire"], "rapid"),
  P("t5", "Anita Rao", "HR Partner", "People Ops", "🙂", "Friendly; evaluates culture fit and clarity of motivation.", ["hr", "resume"], "warm"),
];

const AI_PANEL: Interviewer[] = [
  P("a1", "Dr. Elena Sorokin", "Research Scientist", "ML Research", "👩‍🔬", "Asks 'why' three times; allergic to hand-waving.", ["ml-ai", "research"], "curious"),
  P("a2", "Rohit Menon", "ML Engineer", "Applied AI", "👨‍💻", "Practical; wants working systems, not just theory.", ["ml-ai", "coding"], "skeptical"),
  P("a3", "Grace Liu", "Data Science Lead", "Analytics", "📊", "Loves metrics; asks how you'd measure everything.", ["data-science"], "formal"),
  P("a4", "James Okafor", "Hiring Manager", "AI Platform", "👔", "Evaluates judgment and communication under ambiguity.", ["behavioral", "project"], "warm"),
  P("a5", "Nisha Patel", "HR Partner", "People", "🙂", "Checks motivation, expectations and team fit.", ["hr", "resume"], "warm"),
];

const AEROSPACE_PANEL: Interviewer[] = [
  P("ae1", "Dr. Hélène Moreau", "Aerodynamics Lead", "Aero Dept", "🌀", "Rigorous; expects equations and physical intuition together.", ["aerodynamics", "cfd"], "formal"),
  P("ae2", "Stefan Krause", "Structures Engineer", "Airframe", "🏗️", "Detail-obsessed; asks about failure modes and margins.", ["structures"], "skeptical"),
  P("ae3", "Meera Iyer", "Flight Mechanics Engineer", "Flight Physics", "✈️", "Enjoys performance and stability puzzles.", ["flight-mechanics", "controls"], "curious"),
  P("ae4", "Tom Bradley", "Engineering Manager", "Design Office", "👔", "Wants clear thinking and teamwork stories.", ["behavioral", "project"], "warm"),
  P("ae5", "Lucia Femia", "HR Business Partner", "People", "🙂", "Assesses mobility, motivation and long-term fit.", ["hr", "resume"], "warm"),
];

const ISRO_PANEL: Interviewer[] = [
  P("is1", "Dr. K. Raghavan", "Propulsion Scientist", "LPSC", "🚀", "Old-school rigor; starts from fundamentals and digs.", ["propulsion", "thermal"], "formal"),
  P("is2", "Dr. S. Lakshmi", "Aerodynamics Expert", "VSSC", "🌀", "Quietly incisive; loves compressible flow.", ["aerodynamics", "cfd"], "curious"),
  P("is3", "A. Venkatesh", "Structures Scientist", "Structures Entity", "🏗️", "Asks about loads, vibrations and materials.", ["structures"], "skeptical"),
  P("is4", "Dr. P. Unnikrishnan", "Mathematics Expert", "Applied Math", "📐", "Rapid-fire numericals; checks first-principles maths.", ["rapid-fire", "flight-mechanics"], "rapid"),
  P("is5", "R. Devi", "Admin Officer", "HR", "🙂", "Formal but kind; motivation and commitment questions.", ["hr"], "formal"),
];

const AUTO_RD_PANEL: Interviewer[] = [
  P("au1", "Dr. Felix Braun", "CAE Lead", "R&D Simulation", "🖥️", "Simulation depth: meshing, validation, correlation.", ["cfd", "structures"], "formal"),
  P("au2", "Kavya Krishnan", "Thermal Engineer", "Powertrain", "🔥", "Heat transfer everywhere; loves practical estimates.", ["thermal"], "curious"),
  P("au3", "Martin Vogel", "Manufacturing Engineer", "Production", "🏭", "Design-for-manufacture; costs and tolerances.", ["structures", "project"], "skeptical"),
  P("au4", "Shruti Deshpande", "Team Lead", "Vehicle Dynamics", "👩‍💼", "Behavioral depth and cross-team collaboration.", ["behavioral", "flight-mechanics"], "warm"),
  P("au5", "Hans Weber", "HR Manager", "People", "🙂", "Relocation, teamwork, and language of motivation.", ["hr", "resume"], "warm"),
];

const SEMI_PANEL: Interviewer[] = [
  P("s1", "Arjun Reddy", "Systems Engineer", "SoC Design", "🔌", "Signals, circuits, and low-level fundamentals.", ["controls", "coding"], "skeptical"),
  P("s2", "Wei Zhang", "Senior Engineer", "Embedded", "👨‍💻", "Bit-level precision; C and memory questions.", ["coding", "rapid-fire"], "rapid"),
  P("s3", "Diego Marín", "Engineering Manager", "Platform", "👔", "Projects, ownership, and debugging war stories.", ["behavioral", "project"], "warm"),
  P("s4", "Fatima Khan", "HR Partner", "People", "🙂", "Fit, expectations, and career trajectory.", ["hr", "resume"], "warm"),
];

const CONSULTING_PANEL: Interviewer[] = [
  P("c1", "Alexandra Hunt", "Engagement Manager", "Strategy", "📈", "Classic case interviewer; structure is everything.", ["case-study"], "formal"),
  P("c2", "Vikram Sethi", "Associate Partner", "Operations", "🧮", "Pushes on numbers; expects fast mental math.", ["case-study", "quant", "rapid-fire"], "rapid"),
  P("c3", "Sophie Martin", "Recruiting Lead", "Talent", "🙂", "Personal-impact and leadership stories.", ["behavioral", "hr", "resume"], "warm"),
];

const FINANCE_PANEL: Interviewer[] = [
  P("f1", "Dmitri Volkov", "Quant Researcher", "Trading Strategies", "📉", "Probability brainteasers; zero tolerance for bluffing.", ["quant"], "skeptical"),
  P("f2", "Rachel Goldman", "VP Technology", "Trading Systems", "👩‍💻", "Low-latency systems and clean code.", ["coding", "system-design"], "formal"),
  P("f3", "Aditya Jain", "Desk Strategist", "Markets", "🧮", "Rapid-fire mental math and market intuition.", ["quant", "rapid-fire"], "rapid"),
  P("f4", "Emma Collins", "HR Associate", "Campus Recruiting", "🙂", "Motivation for finance; teamwork under pressure.", ["hr", "behavioral"], "warm"),
];

const IT_PANEL: Interviewer[] = [
  P("i1", "Suresh Kumar", "Technical Lead", "Delivery", "👨‍💻", "Fundamentals-first: DSA, SQL, OOP.", ["coding"], "formal"),
  P("i2", "Deepa Menon", "Project Manager", "Client Services", "👩‍💼", "Communication, teamwork, client scenarios.", ["behavioral", "project"], "warm"),
  P("i3", "Ravi Shastri", "HR Executive", "Talent Acquisition", "🙂", "Standard HR round; relocation and bond questions.", ["hr", "resume"], "warm"),
];

export const COMPANIES: Company[] = [
  { id: "google", name: "Google", emoji: "🔍", domain: "Software & AI", panel: TECH_PANEL, roles: ["swe", "ml", "ds", "research"] },
  { id: "microsoft", name: "Microsoft", emoji: "🪟", domain: "Software & Cloud", panel: TECH_PANEL, roles: ["swe", "ml", "ds", "pm"] },
  { id: "meta", name: "Meta", emoji: "♾️", domain: "Software & AI", panel: TECH_PANEL, roles: ["swe", "ml", "ds"] },
  { id: "amazon", name: "Amazon", emoji: "📦", domain: "Software & Cloud", panel: TECH_PANEL, roles: ["swe", "ds", "pm"] },
  { id: "apple", name: "Apple", emoji: "🍎", domain: "Hardware & Software", panel: TECH_PANEL, roles: ["swe", "ml"] },
  { id: "nvidia", name: "NVIDIA", emoji: "🎮", domain: "GPU & AI", panel: SEMI_PANEL, roles: ["swe", "ml", "embedded"] },
  { id: "openai", name: "OpenAI", emoji: "🤖", domain: "AI Research", panel: AI_PANEL, roles: ["ml", "research", "swe"] },
  { id: "anthropic", name: "Anthropic", emoji: "🧠", domain: "AI Research", panel: AI_PANEL, roles: ["ml", "research", "swe"] },
  { id: "tesla", name: "Tesla", emoji: "⚡", domain: "EV & Energy", panel: AUTO_RD_PANEL, roles: ["mech", "embedded", "ds"] },
  { id: "spacex", name: "SpaceX", emoji: "🚀", domain: "Space Launch", panel: AEROSPACE_PANEL, roles: ["aero", "structures", "propulsion", "gnc"] },
  { id: "blueorigin", name: "Blue Origin", emoji: "🌍", domain: "Space Launch", panel: AEROSPACE_PANEL, roles: ["aero", "structures", "propulsion"] },
  { id: "airbus", name: "Airbus", emoji: "✈️", domain: "Aviation", panel: AEROSPACE_PANEL, roles: ["aero", "structures", "cfd-eng", "gnc"] },
  { id: "boeing", name: "Boeing", emoji: "🛩️", domain: "Aviation & Defense", panel: AEROSPACE_PANEL, roles: ["aero", "structures", "cfd-eng"] },
  { id: "isro", name: "ISRO", emoji: "🛰️", domain: "Space Agency", panel: ISRO_PANEL, roles: ["scientist", "propulsion", "aero"] },
  { id: "drdo", name: "DRDO", emoji: "🎯", domain: "Defense R&D", panel: ISRO_PANEL, roles: ["scientist", "aero", "gnc"] },
  { id: "hal", name: "HAL", emoji: "🚁", domain: "Aeronautics", panel: AEROSPACE_PANEL, roles: ["aero", "structures", "get"] },
  { id: "ge-aero", name: "GE Aerospace", emoji: "🌀", domain: "Aero Engines", panel: AUTO_RD_PANEL, roles: ["mech", "thermal", "propulsion"] },
  { id: "honeywell", name: "Honeywell", emoji: "🎛️", domain: "Avionics & Controls", panel: SEMI_PANEL, roles: ["gnc", "embedded", "mech"] },
  { id: "rolls-royce", name: "Rolls-Royce", emoji: "⚙️", domain: "Aero Engines", panel: AUTO_RD_PANEL, roles: ["mech", "thermal", "propulsion"] },
  { id: "mercedes", name: "Mercedes-Benz R&D", emoji: "🏎️", domain: "Automotive R&D", panel: AUTO_RD_PANEL, roles: ["mech", "cfd-eng", "ds"] },
  { id: "bosch", name: "Bosch", emoji: "🔧", domain: "Engineering & Tech", panel: AUTO_RD_PANEL, roles: ["mech", "embedded", "ds"] },
  { id: "qualcomm", name: "Qualcomm", emoji: "📶", domain: "Semiconductors", panel: SEMI_PANEL, roles: ["embedded", "swe"] },
  { id: "ti", name: "Texas Instruments", emoji: "🔬", domain: "Semiconductors", panel: SEMI_PANEL, roles: ["embedded", "swe"] },
  { id: "goldman", name: "Goldman Sachs", emoji: "💰", domain: "Finance", panel: FINANCE_PANEL, roles: ["quant-analyst", "swe"] },
  { id: "jpmorgan", name: "JPMorgan", emoji: "🏦", domain: "Finance", panel: FINANCE_PANEL, roles: ["quant-analyst", "swe"] },
  { id: "mckinsey", name: "McKinsey", emoji: "📊", domain: "Consulting", panel: CONSULTING_PANEL, roles: ["consultant", "ba"] },
  { id: "bcg", name: "BCG", emoji: "📈", domain: "Consulting", panel: CONSULTING_PANEL, roles: ["consultant", "ba"] },
  { id: "bain", name: "Bain", emoji: "🧭", domain: "Consulting", panel: CONSULTING_PANEL, roles: ["consultant", "ba"] },
  { id: "deloitte", name: "Deloitte", emoji: "🌐", domain: "Consulting & Tech", panel: CONSULTING_PANEL, roles: ["consultant", "ba", "swe"] },
  { id: "accenture", name: "Accenture", emoji: "💠", domain: "Consulting & Tech", panel: IT_PANEL, roles: ["swe", "ba", "get"] },
  { id: "tcs", name: "TCS", emoji: "🖥️", domain: "IT Services", panel: IT_PANEL, roles: ["swe", "get"] },
  { id: "infosys", name: "Infosys", emoji: "💻", domain: "IT Services", panel: IT_PANEL, roles: ["swe", "get"] },
  { id: "wipro", name: "Wipro", emoji: "🌟", domain: "IT Services", panel: IT_PANEL, roles: ["swe", "get"] },
  { id: "iitb-phd", name: "PhD / MS Admission Panel", emoji: "🎓", domain: "Academia", panel: [
    P("ph1", "Prof. R. Bhattacharya", "Professor", "Aerospace Engineering", "👨‍🏫", "Deep fundamentals; derives everything from first principles.", ["aerodynamics", "propulsion", "research"], "formal"),
    P("ph2", "Prof. A. Desai", "Associate Professor", "Fluid Mechanics", "👩‍🏫", "Loves thought experiments and limiting cases.", ["cfd", "aerodynamics", "research"], "curious"),
    P("ph3", "Prof. V. Kulkarni", "Professor", "Structures", "🧑‍🏫", "Asks why you want research, and whether you can survive it.", ["research", "behavioral", "structures"], "skeptical"),
  ], roles: ["phd", "ms"] },
];

export function companyById(id: string): Company | undefined {
  return COMPANIES.find((c) => c.id === id);
}
