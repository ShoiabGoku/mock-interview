import Anthropic from "@anthropic-ai/sdk";
import type {
  AnswerEval,
  Company,
  Report,
  RoleDef,
  SessionConfig,
} from "./types";
import { modeById } from "@/data/modes";
import { DIFFICULTIES } from "@/data/modes";
import type { NextLine } from "./scriptedEngine";
import { RESOURCES } from "@/data/resources";
import { categoriesFor } from "@/data/roles";

/**
 * AI interview brain. Runs Claude in the browser with the user's own API key
 * (stored only in localStorage) via dangerouslyAllowBrowser. Mirrors the
 * ScriptedEngine's async surface: start / submitAnswer / buildReport.
 *
 * Each turn asks Claude to respond as ONE panelist in a strict JSON envelope so
 * the room UI can render a single speaker plus a private evaluation.
 */

const DEFAULT_MODEL = "claude-opus-4-8";

interface TurnEnvelope {
  interviewer_name: string;
  interviewer_role: string;
  text: string;
  interruption: boolean;
  done: boolean;
  eval?: {
    technical: number;
    communication: number;
    confidence: number;
    depth: number;
    structure: number;
    notes: string;
    missing: string[];
  };
}

export class AIEngine {
  private client: Anthropic;
  private model: string;
  private messages: Anthropic.MessageParam[] = [];
  private system: string;
  private evals: AnswerEval[] = [];
  private qa: { question: string; answer: string }[] = [];
  private lastQuestion = "";
  private turnCount = 0;
  private maxQuestions: number;

  constructor(
    private config: SessionConfig,
    private company: Company,
    private role: RoleDef,
    apiKey: string,
    model?: string
  ) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model || DEFAULT_MODEL;
    this.maxQuestions = config.durationMin <= 15 ? 5 : config.durationMin <= 30 ? 8 : config.durationMin <= 45 ? 11 : 14;
    this.system = this.buildSystem();
  }

  private buildSystem(): string {
    const mode = modeById(this.config.mode);
    const diff = DIFFICULTIES.find((d) => d.id === this.config.difficulty);
    const cats = categoriesFor(this.role.focus, mode?.categories ?? null);
    const panel = this.company.panel
      .map((p) => `- ${p.name} (${p.role}, ${p.department}): ${p.personality} Focus: ${p.focus.join(", ")}. Style: ${p.style}.`)
      .join("\n");

    return `You are simulating a realistic ${this.company.name} interview PANEL for an M.Tech Aerospace student from IIT Bombay.

Role being interviewed for: ${this.role.name}
Interview mode: ${mode?.name} — ${mode?.description}
Difficulty: ${diff?.name} — ${diff?.description}
Topic areas to draw from, in priority order: ${cats.join(", ")}
Target number of primary questions: about ${this.maxQuestions}.

THE PANEL:
${panel}

${this.config.resume ? `CANDIDATE RESUME (ask about this):\n${this.config.resume.slice(0, 4000)}\n` : ""}
${this.config.jobDescription ? `JOB DESCRIPTION (tailor questions to this):\n${this.config.jobDescription.slice(0, 3000)}\n` : ""}

RULES:
- Exactly ONE panelist speaks per turn. Only one interviewer at a time.
- Ask ONE question at a time, then wait for the candidate's answer.
- Ask sharp follow-ups based on the actual answer. Challenge weak or hand-wavy answers. Request clarification. Cross-question. Remember earlier answers.
- Occasionally (roughly 1 in 4 turns) have a DIFFERENT panelist interrupt with a related follow-up — set "interruption": true and speak as that panelist.
- Match each panelist's personality and questioning style. Stay in character.
- Create realistic pressure appropriate to the difficulty. Do NOT reveal correct answers or coach during the interview — stay in interviewer character.
- Change topics naturally as a real panel would, covering the priority areas.
- After about ${this.maxQuestions} primary questions (plus follow-ups), have a warm panelist close the interview and set "done": true.

SOUNDING REAL — this matters as much as the questions:
- REACT to what they actually said before moving on. Name the specific thing they got right ("Good — you went straight to the Kutta condition") or the specific thing they skipped ("You haven't mentioned downwash at all"). Never respond with a generic "Good answer, next question."
- If the answer is CORRECT, acknowledge it properly and either go deeper or move on — do not pretend it was wrong or ask them to repeat themselves.
- If the answer is one line or empty, push: "That's very brief — talk me through your reasoning," rather than silently moving on.
- If they say they don't know, respond like a real interviewer would: acknowledge it, maybe offer a small hint or reframe, then move on. Don't punish them repeatedly.
- Vary your sentence length and openers. Use natural spoken English with contractions and the occasional "Hmm," "Right," "Okay —". Avoid sounding like a form letter.
- Keep each turn SHORT — one or two sentences of reaction plus one question. Real interviewers don't monologue.

EVALUATION (private, never shown to the candidate mid-interview):
- After each candidate answer, silently score it 0-10 on: technical, communication, confidence, depth, structure. List concepts they missed.

OUTPUT FORMAT — respond with ONLY a JSON object, no prose, no code fences:
{
  "interviewer_name": "<panelist name>",
  "interviewer_role": "<their role>",
  "text": "<what this panelist says out loud>",
  "interruption": <true|false>,
  "done": <true|false>,
  "eval": { "technical": 0-10, "communication": 0-10, "confidence": 0-10, "depth": 0-10, "structure": 0-10, "notes": "<one line>", "missing": ["concept", ...] }
}
On the very first turn there is no answer to evaluate yet — omit "eval". Keep "text" natural and conversational, like real speech.`;
  }

  private matchInterviewer(name: string, role: string) {
    const byName = this.company.panel.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (byName) return byName;
    const byRole = this.company.panel.find((p) => p.role.toLowerCase() === role.toLowerCase());
    return byRole ?? this.company.panel[0];
  }

  private async ask(userText: string): Promise<TurnEnvelope> {
    this.messages.push({ role: "user", content: userText });
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 1200,
      system: this.system,
      messages: this.messages,
    });
    const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    this.messages.push({ role: "assistant", content: text });
    return parseEnvelope(text);
  }

  get total(): number {
    return this.maxQuestions;
  }
  get currentIndex(): number {
    return Math.min(this.turnCount, this.maxQuestions);
  }

  async start(): Promise<NextLine> {
    const env = await this.ask(
      "Begin the interview now. Greet the candidate briefly as the lead panelist and ask your first question."
    );
    this.lastQuestion = env.text;
    this.turnCount = 1;
    const iv = this.matchInterviewer(env.interviewer_name, env.interviewer_role);
    return { interviewer: iv, text: env.text, interruption: false, done: false };
  }

  async submitAnswer(answer: string): Promise<NextLine> {
    // Record the Q/A pair for the report.
    this.qa.push({ question: this.lastQuestion, answer });
    const env = await this.ask(answer);
    if (env.eval) {
      this.evals.push({
        questionIdx: this.qa.length - 1,
        technical: env.eval.technical,
        communication: env.eval.communication,
        confidence: env.eval.confidence,
        depth: env.eval.depth,
        structure: env.eval.structure,
        notes: env.eval.notes,
        missing: env.eval.missing ?? [],
      });
    }
    this.lastQuestion = env.text;
    if (!env.done && !env.interruption) this.turnCount++;
    const iv = this.matchInterviewer(env.interviewer_name, env.interviewer_role);
    return { interviewer: iv, text: env.text, interruption: env.interruption, done: env.done };
  }

  mood(): Record<string, string> {
    const last = this.evals[this.evals.length - 1];
    if (!last) return {};
    const iv = this.company.panel[0];
    const q = (last.technical + last.depth) / 20;
    return { [iv.id]: q > 0.7 ? "impressed" : q > 0.5 ? "pleased" : q > 0.35 ? "neutral" : "skeptical" };
  }
  liveNotes(): Record<string, string> {
    const last = this.evals[this.evals.length - 1];
    if (!last) return {};
    return { [this.company.panel[0].id]: last.notes };
  }

  /** Ask Claude for a full structured report; fall back to a local computation. */
  async buildReport(): Promise<Report> {
    const transcript = this.qa.map((p, i) => `Q${i + 1}: ${p.question}\nA${i + 1}: ${p.answer}`).join("\n\n");
    const prompt = `The interview is over. You are now the HIRING COMMITTEE producing a detailed, honest, constructive evaluation report for this candidate (${this.role.name} at ${this.company.name}).

Here is the full transcript:
${transcript}

Produce ONLY a JSON object (no prose, no code fences) with this exact shape. All scores are 0-100 unless noted:
{
  "overall": n, "technical": n, "communication": n, "confidence": n, "problemSolving": n,
  "behavioral": n, "depth": n, "structure": n, "companyReadiness": n, "roleReadiness": n,
  "hiringProbability": n,
  "summary": "3-4 sentence honest summary. End by noting this is an AI estimate, not a real hiring decision.",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "perQuestion": [
    { "question": "...", "answer": "...", "idealAnswer": "what a strong answer covers",
      "strengths": ["..."], "weaknesses": ["..."], "missingConcepts": ["..."],
      "betterAnswer": "how to answer it better", "confidence": 0-10 }
  ],
  "coach": {
    "topicsToRevise": ["..."],
    "resources": [{ "title": "...", "type": "Book|Course|Video|Article|Problem Set|Guide" }],
    "studyPlan": ["step 1", "step 2", "step 3"]
  }
}
Include one perQuestion entry per question asked. Be specific and actionable.`;

    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      const parsed = JSON.parse(stripFences(text)) as Report;
      return normalizeReport(parsed);
    } catch {
      return this.localReport();
    }
  }

  /** Report from accumulated evals if the AI report call fails. */
  private localReport(): Report {
    const a = (f: (e: AnswerEval) => number) =>
      this.evals.length ? Math.round((this.evals.reduce((s, e) => s + f(e), 0) / this.evals.length) * 10) : 50;
    const technical = a((e) => e.technical);
    const communication = a((e) => e.communication);
    const confidence = a((e) => e.confidence);
    const depth = a((e) => e.depth);
    const structure = a((e) => e.structure);
    const overall = Math.round(technical * 0.35 + communication * 0.2 + depth * 0.2 + confidence * 0.15 + structure * 0.1);
    return {
      overall, technical, communication, confidence,
      problemSolving: Math.round((technical + depth) / 2),
      behavioral: communication, depth, structure,
      companyReadiness: overall, roleReadiness: Math.round((technical + depth) / 2),
      hiringProbability: Math.round(overall * 0.85),
      summary: "Report generated locally from live evaluations (the AI report call did not complete). Scores are an AI estimate of interview performance, not a hiring decision.",
      strengths: ["Completed the full interview."],
      weaknesses: ["See per-question notes for specifics."],
      perQuestion: this.qa.map((p, i) => {
        const e = this.evals[i];
        return {
          question: p.question, answer: p.answer, idealAnswer: "(unavailable in local mode)",
          strengths: e && e.technical >= 7 ? ["Solid technical content."] : ["Attempted the question."],
          weaknesses: e && e.depth < 5 ? ["Add more depth and a concrete example."] : ["Minor gaps."],
          missingConcepts: e?.missing ?? [],
          betterAnswer: "Lead with the core idea, add a concrete example, state a trade-off.",
          confidence: e ? Math.round((e.technical + e.depth) / 2) : 5,
        };
      }),
      coach: {
        topicsToRevise: [this.role.name],
        resources: Object.values(RESOURCES)[0],
        studyPlan: ["Review the per-question feedback.", "Redo this mock with the same settings.", "Focus your weakest category next session."],
      },
    };
  }
}

function parseEnvelope(text: string): TurnEnvelope {
  try {
    return JSON.parse(stripFences(text)) as TurnEnvelope;
  } catch {
    // If the model didn't return JSON, treat the whole text as the panelist line.
    return { interviewer_name: "", interviewer_role: "", text: text.trim() || "Let's continue. Tell me more.", interruption: false, done: false };
  }
}

function stripFences(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  // Grab the outermost JSON object if there's surrounding prose.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) return t.slice(first, last + 1);
  return t;
}

function normalizeReport(r: Report): Report {
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n || 0)));
  return {
    ...r,
    overall: clamp(r.overall), technical: clamp(r.technical), communication: clamp(r.communication),
    confidence: clamp(r.confidence), problemSolving: clamp(r.problemSolving), behavioral: clamp(r.behavioral),
    depth: clamp(r.depth), structure: clamp(r.structure), companyReadiness: clamp(r.companyReadiness),
    roleReadiness: clamp(r.roleReadiness), hiringProbability: clamp(r.hiringProbability),
    strengths: r.strengths ?? [], weaknesses: r.weaknesses ?? [], perQuestion: r.perQuestion ?? [],
    coach: r.coach ?? { topicsToRevise: [], resources: [], studyPlan: [] },
  };
}
