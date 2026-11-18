import Anthropic from "@anthropic-ai/sdk";
import type { GDReport, GDTurn, TurnKind } from "./types";
import { GDEngine, YOU, type NextContext } from "./engine";
import { callName } from "@/lib/people";

/**
 * Where the other participants' lines come from. Offline, the scripted
 * engine writes them; with the user's own Anthropic key, Claude plays every
 * participant — reacting freely to whatever the candidate says — while the
 * engine still keeps the record, the timing cues and the scoring.
 */
export interface GDBrain {
  usedAI: boolean;
  next(ctx: NextContext): Promise<GDTurn>;
  summary(): Promise<GDTurn>;
  feedback(report: GDReport): Promise<string | undefined>;
}

export function createGDBrain(engine: GDEngine, opts: { apiKey: string; model: string; preferAI: boolean }): GDBrain {
  const offline: GDBrain = {
    usedAI: false,
    next: (ctx) => Promise.resolve(engine.nextTurn(ctx)),
    summary: () => Promise.resolve(engine.summaryTurn()),
    feedback: () => Promise.resolve(undefined),
  };
  if (!opts.preferAI || !opts.apiKey.trim()) return offline;
  try {
    return new AIGDBrain(engine, opts.apiKey, opts.model);
  } catch {
    return offline;
  }
}

interface TurnJSON {
  speaker_id?: string;
  text?: string;
  kind?: string;
  addresses?: string | null;
}

const KINDS: TurnKind[] = ["initiate", "point", "counter", "build", "invite", "summary", "drift", "redirect", "react", "rehash", "answer"];

class AIGDBrain implements GDBrain {
  usedAI = true;
  private client: Anthropic;
  private failures = 0;

  constructor(private engine: GDEngine, apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  private system(): string {
    const e = this.engine;
    const people = e.personas
      .map((p) => `- id "${p.id}": ${p.name} — ${p.blurb}${e.topic.kind === "factual" ? ` Leans: ${e.stance[p.id]}.` : ""}`)
      .join("\n");
    const points = e.topic.points.map((p) => `- (${p.side}) ${p.label}: ${p.say}${p.fact ? ` Fact: ${p.fact}` : ""}`).join("\n");
    const tone = {
      friendly: "Polite and supportive. Leave pauses, invite the quieter people (including the candidate) in.",
      competitive: "A normal competitive campus GD. People speak confidently, occasionally cut in, and don't wait to be invited.",
      aggressive: "Highly competitive. People cut each other off, talk forcefully and rarely make room — the candidate must break in.",
    }[e.config.difficulty];
    return `You are simulating the OTHER candidates in a realistic Indian campus-placement GROUP DISCUSSION. The human candidate is "${e.userName}" (call them ${e.userFirst}).

Topic: "${e.topic.title}" — ${e.topic.brief}
Group tone: ${tone}

The other candidates (you voice ONLY these, never the human, never the moderators):
${people}

Background points you may draw on (don't recite them; vary and paraphrase; don't use all):
${points}

RULES
- Exactly one candidate speaks per turn: 1–3 spoken sentences, natural Indian-English campus speech. No stage directions.
- React to what was just said. Refer to people by first name ("Building on ${e.userFirst}'s point…", "I disagree with Rohan…").
- When ${e.userFirst} speaks, someone usually responds to it directly — agree and extend, or challenge it with a reason. If it was off-topic, gently steer back.
- Stay in character. Never evaluate or coach ${e.userFirst}; never mention scores, AI or simulation.
- Converge toward conclusions as time runs out.

Respond with ONLY a JSON object: {"speaker_id": "<one of the ids above>", "text": "<what they say>", "kind": "<initiate|point|counter|build|invite|redirect|answer|summary>", "addresses": "<an id; the word user if asking ${e.userFirst}; or null>"}`;
  }

  private transcript(): string {
    return this.engine.records
      .slice(-30)
      .map((r) => `${r.speakerId === YOU ? `${this.engine.userName} (CANDIDATE)` : r.name}: ${r.text}${r.cutOff ? " —(cut off)" : ""}`)
      .join("\n");
  }

  private async ask(instruction: string, maxTokens = 320): Promise<TurnJSON> {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: this.system(),
      messages: [{ role: "user", content: `Discussion so far:\n${this.transcript() || "(nobody has spoken yet)"}\n\n${instruction}` }],
    });
    const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    return JSON.parse(json) as TurnJSON;
  }

  async next(ctx: NextContext): Promise<GDTurn> {
    if (this.failures >= 2) return this.engine.nextTurn(ctx);
    const e = this.engine;
    const forced = e.addressedNext;
    const mins = Math.max(0, Math.round(ctx.remainingSec / 60));
    const notes = [
      forced ? `${e.nameOf(forced)} was just asked to speak — they must speak next (speaker_id "${forced}").` : "",
      ctx.userInviteLapsed ? `${e.userFirst} was asked to speak but stayed silent — acknowledge it briefly and move on.` : "",
      ctx.overrideComposing ? "Someone takes the floor now." : "",
      mins <= 2 ? "Under two minutes left — start converging." : `About ${mins} minutes left.`,
    ].filter(Boolean).join(" ");
    try {
      const j = await this.ask(`Next turn. ${notes}`);
      const speaker = e.personas.find((p) => p.id === j.speaker_id) ?? (forced ? e.personas.find((p) => p.id === forced) : undefined);
      if (!speaker || !j.text?.trim()) throw new Error("bad turn");
      this.failures = 0;
      const addressed = j.addresses === "user" ? YOU : e.personas.find((p) => p.id === j.addresses)?.id;
      const kind = KINDS.includes(j.kind as TurnKind) ? (j.kind as TurnKind) : "point";
      return { speakerId: speaker.id, text: j.text.trim(), kind, addressed, pointId: e.analyse(j.text).points[0] };
    } catch {
      this.failures++;
      return e.nextTurn(ctx);
    }
  }

  async summary(): Promise<GDTurn> {
    const e = this.engine;
    const who = e.personas.find((p) => p.style === "harmoniser") ?? e.personas[0];
    try {
      const j = await this.ask(
        `The moderator asked for a closing summary and ${e.userFirst} did not volunteer. ${who.name} (id "${who.id}") gives a neutral 3–4 sentence summary covering both sides and the group's conclusion.`,
        400
      );
      if (!j.text?.trim()) throw new Error("empty");
      return { speakerId: who.id, text: j.text.trim(), kind: "summary" };
    } catch {
      return e.summaryTurn();
    }
  }

  async feedback(report: GDReport): Promise<string | undefined> {
    const e = this.engine;
    const mine = e.records.filter((r) => r.speakerId === YOU).map((r, i) => `${i + 1}. ${r.text}`).join("\n") || "(the candidate did not speak)";
    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        system: "You are an experienced placement-GD assessor. Give candid, specific, encouraging feedback in plain prose.",
        messages: [{
          role: "user",
          content: `Topic: "${e.topic.title}". The candidate (${e.userFirst}) took ${Math.round(report.yourShare * 100)}% of the airtime in a group of ${e.personas.length + 1}${report.initiated ? " and initiated" : ""}.\n\nFull discussion:\n${this.transcript()}\n\nThe candidate's contributions:\n${mine}\n\nWrite 4–6 sentences of feedback for ${callName(e.userName)}: what worked, what to change, and one specific line they could have said at a key moment. No scores, no bullet points.`,
        }],
      });
      return resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim() || undefined;
    } catch {
      return undefined;
    }
  }
}
