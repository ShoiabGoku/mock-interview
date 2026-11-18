import type {
  GDConfig, GDModerator, GDPersona, GDPoint, GDRecord, GDSide, GDTopic, GDTurn, UserAnalysis,
} from "./types";
import { keywordCoverage } from "@/lib/scoring";
import { callName } from "@/lib/people";

/**
 * The offline group-discussion brain.
 *
 * It holds the discussion state (who said what, which points have been made,
 * each participant's stance) and decides the next turn: who speaks and what
 * they say. Participants draw from the topic's point bank in their own style —
 * the analyst brings data, the contrarian counters the last point, the
 * harmoniser builds bridges and brings people in, the drifter wanders off and
 * gets pulled back — and they react to the candidate by name: building on a
 * point they made, countering it, answering their question, or noting when
 * they've gone off topic.
 *
 * Timing (when the next turn starts, waiting while the candidate composes)
 * lives in the room; this class is pure and synchronous so it can be tested.
 */

export const YOU = "you";

export interface NextContext {
  elapsedSec: number;
  remainingSec: number;
  /** Seconds since the candidate last spoke (or since the start). */
  userSilentSec: number;
  /** The candidate was asked to speak and didn't. */
  userInviteLapsed?: boolean;
  /** The candidate has been composing too long; someone takes the floor anyway. */
  overrideComposing?: boolean;
}

const INTERRUPT_P = { friendly: 0.04, competitive: 0.14, aggressive: 0.3 };
const INVITE_USER_AFTER = { friendly: 95, competitive: 200, aggressive: Infinity };

export class GDEngine {
  readonly topic: GDTopic;
  readonly personas: GDPersona[];
  readonly moderators: GDModerator[];
  readonly config: GDConfig;
  readonly userName: string;
  readonly userFirst: string;

  records: GDRecord[] = [];
  /** pointId -> first speaker who made it. */
  used = new Map<string, string>();
  stance: Record<string, GDSide> = {};
  /** Who should nod at the candidate's last point. */
  nods: string[] = [];

  private countered = new Set<string>();
  private factsUsed = new Set<string>();
  private conclusionUsed = 0;
  /** How far through the discussion we are, 0–1. */
  private frac = 0;
  private pendingAddressed: string | null = null;
  private pendingInterrupter: string | null = null;
  private midSummaryDone = false;
  private driftBy: string | null = null;
  private lastUserInviteAt = -Infinity;
  private recent: string[] = [];

  constructor(topic: GDTopic, personas: GDPersona[], moderators: GDModerator[], config: GDConfig, userName: string) {
    this.topic = topic;
    this.personas = personas;
    this.moderators = moderators;
    this.config = config;
    this.userName = userName.trim() || "Candidate";
    this.userFirst = this.userName.split(/\s+/)[0];
    this.assignStances();
  }

  /* ------------------------------------------------------------ people */

  nameOf(id: string): string {
    if (id === YOU) return this.userName;
    return this.personas.find((p) => p.id === id)?.name ?? this.moderators.find((m) => m.id === id)?.name ?? id;
  }

  private short(id: string): string {
    return id === YOU ? this.userFirst : callName(this.nameOf(id));
  }

  private persona(style: GDPersona["style"]): GDPersona | undefined {
    return this.personas.find((p) => p.style === style);
  }

  private assignStances() {
    const factual = this.topic.kind === "factual";
    let forCount = 0;
    let againstCount = 0;
    const lead = Math.random() < 0.5 ? "for" : "against";
    const opp = (s: GDSide): GDSide => (s === "for" ? "against" : "for");
    for (const p of this.personas) {
      let s: GDSide = "neutral";
      if (factual) {
        switch (p.style) {
          case "initiator": s = lead; break;
          case "contrarian": s = opp(lead); break;
          case "aggressor": s = opp(lead); break;
          case "harmoniser":
          case "structurer":
          case "drifter": s = "neutral"; break;
          default: s = forCount <= againstCount ? "for" : "against";
        }
      }
      if (s === "for") forCount++;
      if (s === "against") againstCount++;
      this.stance[p.id] = s;
    }
  }

  /* ------------------------------------------------------- moderator */

  private get lead(): GDModerator {
    return this.moderators[0];
  }

  introTurns(companyName: string | null): GDTurn[] {
    const m = this.lead;
    const other = this.moderators[1];
    const n = this.personas.length + 1;
    const prep = this.config.prepSec;
    const prepText = prep >= 60 ? `${Math.round(prep / 60)} minute${prep >= 120 ? "s" : ""}` : `${prep} seconds`;
    const where = companyName ? ` for the ${companyName} selection process` : "";
    return [
      {
        speakerId: m.id,
        kind: "moderator",
        text: `Good morning, everyone, and welcome to the group discussion round${where}. I'm ${m.name}, ${m.role}${other ? `, and with me is ${other.name}, ${other.role}` : ""}. We'll be observing and taking notes — we won't take part in the discussion.`,
      },
      {
        speakerId: m.id,
        kind: "moderator",
        text: `There are ${n} of you. You'll have ${this.config.durationMin} minutes. There's no fixed order — speak whenever you like, but don't talk over each other, and keep it respectful.${prep > 0 ? ` You'll first get ${prepText} to collect your thoughts; you may make notes.` : ""}`,
      },
      {
        speakerId: m.id,
        kind: "moderator",
        text: `Your topic is: "${this.topic.title}" ${this.topic.kind === "abstract" ? "" : this.topic.brief}`.trim(),
      },
    ];
  }

  prepStartTurn(): GDTurn {
    return { speakerId: this.lead.id, kind: "moderator", text: "Your preparation time starts now." };
  }

  startTurn(hadPrep: boolean): GDTurn {
    return {
      speakerId: this.lead.id,
      kind: "moderator",
      text: hadPrep
        ? "Okay, time for preparation is up. The discussion starts now — anyone can begin."
        : "Your time starts now — anyone can begin.",
    };
  }

  timeCheckTurn(minutesLeft: number): GDTurn {
    const m = this.moderators[this.moderators.length - 1];
    return {
      speakerId: m.id,
      kind: "moderator",
      text: minutesLeft <= 2
        ? `${minutesLeft === 1 ? "One minute" : "Two minutes"} left. Please start bringing the discussion to a conclusion.`
        : `Just to let you know — about ${minutesLeft} minutes remaining.`,
    };
  }

  timeUpTurn(): GDTurn {
    return { speakerId: this.lead.id, kind: "moderator", text: "Okay, time's up — please stop there. Thank you." };
  }

  summaryInviteTurn(): GDTurn {
    return {
      speakerId: this.lead.id,
      kind: "moderator",
      text: "Before we close — would one of you like to summarise the discussion? About a minute, please.",
    };
  }

  closingTurn(companyName: string | null): GDTurn {
    return {
      speakerId: this.lead.id,
      kind: "moderator",
      text: `Thank you, everyone — that was a good discussion. ${companyName ? `We'll get back to you through the ${companyName} recruitment team.` : "We'll share the results with the placement cell shortly."}`,
    };
  }

  /* ---------------------------------------------------------- records */

  /** Log an AI or moderator turn as it is spoken. `spokenText` is what was actually said if cut off. */
  record(turn: GDTurn, atSec: number, spokenText?: string, extra: Partial<GDRecord> = {}) {
    const pointIds = turn.pointId ? [turn.pointId] : [];
    for (const id of pointIds) if (!this.used.has(id)) this.used.set(id, turn.speakerId);
    if (turn.kind === "counter" && turn.pointId) this.countered.add(turn.pointId);
    if (this.pendingAddressed === turn.speakerId) this.pendingAddressed = null;
    if (turn.addressed && turn.addressed !== YOU) this.pendingAddressed = turn.addressed;
    if (turn.addressed === YOU) this.lastUserInviteAt = atSec;
    if (turn.kind === "drift") this.driftBy = turn.speakerId;
    if (turn.kind === "redirect") this.driftBy = null;
    this.records.push({
      speakerId: turn.speakerId,
      name: this.nameOf(turn.speakerId),
      text: spokenText ?? turn.text,
      kind: turn.kind,
      atSec,
      pointIds,
      cutOff: spokenText !== undefined && spokenText !== turn.text,
      ...extra,
    });
  }

  /** The candidate spoke. Returns what their contribution contained. */
  observeUser(text: string, atSec: number, interruptedId?: string, summaryRound = false): UserAnalysis {
    const a = this.analyse(text);
    for (const id of a.points) if (!this.used.has(id)) this.used.set(id, YOU);
    if (this.pendingInterrupter) this.pendingInterrupter = null;
    // Someone asked by name to speak was pre-empted by the candidate.
    this.pendingAddressed = a.invited[0] ?? null;
    if (a.redirected) this.driftBy = null;
    this.records.push({
      speakerId: YOU,
      name: this.userName,
      text,
      kind: "you",
      atSec,
      pointIds: a.points,
      interrupted: interruptedId,
      analysis: a,
      summaryRound,
    });
    // Participants on the same side nod along.
    const side = a.sides[0];
    this.nods = side
      ? this.personas.filter((p) => this.stance[p.id] === side || (p.style === "harmoniser" && Math.random() < 0.5)).map((p) => p.id).slice(0, 3)
      : [];
    return a;
  }

  analyse(text: string): UserAnalysis {
    const t = text.toLowerCase().replace(/[’']/g, "");
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    const points: string[] = [];
    const sides: GDSide[] = [];
    for (const p of this.topic.points) {
      const { matched } = keywordCoverage(text, p.keys);
      const multi = matched.some((k) => k.trim().includes(" "));
      if (matched.length >= 2 || (multi && matched.length >= 1)) {
        points.push(p.id);
        sides.push(p.side);
      }
    }
    // Most-mentioned side first.
    const sideOrder = (["for", "against", "neutral"] as GDSide[])
      .map((s) => ({ s, n: sides.filter((x) => x === s).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.s);

    const refs: string[] = [];
    for (const p of this.personas) {
      const first = callName(p.name).toLowerCase();
      if (new RegExp(`\\b${first}s?\\b`).test(t)) refs.push(p.id);
    }
    const lastAi = [...this.records].reverse().find((r) => r.speakerId !== YOU && !r.speakerId.startsWith("mod-") && !this.moderators.some((m) => m.id === r.speakerId));
    const agreeRe = /\b(i agree|agree with|exactly|building on|adding to|to add to|as .{1,20} (said|mentioned|pointed out)|good point|rightly said|i second)\b/;
    const disagreeRe = /\b(i disagree|disagree with|i differ|beg to differ|not convinced|on the contrary|i dont think|i do not think|thats not|that is not|but i think|however)\b/;
    const agreeWith = agreeRe.test(t) ? refs[0] ?? lastAi?.speakerId : undefined;
    const disagreeWith = disagreeRe.test(t) ? refs[0] ?? lastAi?.speakerId : undefined;

    const invited: string[] = [];
    const inviteRe = /(what do you think|what is your (view|take|opinion)|whats your (view|take|opinion)|would you like to|lets hear from|let us hear from|we havent heard from|we have not heard from|your thoughts|do you agree)/;
    if (inviteRe.test(t)) {
      for (const id of refs) invited.push(id);
    }

    const topicVocab = new Set(
      [...this.topic.points.flatMap((p) => p.keys.join(" ").split(/\s+/)), ...this.topic.title.toLowerCase().split(/\W+/), ...this.topic.brief.toLowerCase().split(/\W+/)]
        .map(stem)
        .filter((w) => w.length > 3 && !STOP.has(w))
    );
    const contentWords = t.split(/\W+/).map(stem).filter((w) => w.length > 3 && !STOP.has(w));
    const overlap = contentWords.filter((w) => topicVocab.has(w)).length;
    const onTopic = points.length > 0 || overlap >= 2 || (this.topic.kind === "abstract" && words >= 12);

    return {
      words,
      points,
      onTopic,
      facts: (text.match(/\d[\d,.]*\s*(%|percent|crore|lakh|billion|million|thousand|gw|kg|years?)?/gi) ?? []).length +
        (/(according to|report|survey|study|studies|data shows|statistic)/i.test(text) ? 1 : 0),
      examples: (t.match(/(for example|for instance|take the case of|take the example|such as|like in|e\.g\.|consider the case)/g) ?? []).length,
      refs,
      agreeWith,
      disagreeWith,
      invited,
      structured: /(let me (start|begin)|i('?d| would) like to (start|begin)|first(ly)?[, ].{0,60}second|two (sides|aspects|angles)|three (aspects|angles|parameters|things)|let us (look|divide|break)|lets (look|divide|break)|define|definition|structure|short term and long term|pros and cons)/.test(t),
      summarised: /(to summari[sz]e|in summary|so far we|so far, we|to sum up|to conclude|in conclusion|summing up|what we have discussed|we have discussed)/.test(t),
      redirected: /(coming back to|back to the topic|lets focus|let us focus|back to the point|getting back to|stay on (the )?topic|bring (it|this) back)/.test(t),
      polite: /(if i may|sorry to interrupt|can i add|may i add|just to add|excuse me|with due respect|respectfully|i respect|allow me)/.test(t),
      rude: /(you are wrong|youre wrong|thats nonsense|nonsense|rubbish|stupid|shut up|let me finish|you dont understand|ridiculous|absurd)/.test(t),
      question: /\?\s*$/.test(text.trim()),
      hedges: (t.match(/\b(um+|uh+|maybe|i guess|kind of|sort of|probably|not sure)\b/g) ?? []).length,
      sides: sideOrder,
    };
  }

  /* ------------------------------------------------------ next turn */

  nextTurn(ctx: NextContext): GDTurn {
    this.frac = Math.min(1, Math.max(0, ctx.elapsedSec / (this.config.durationMin * 60)));
    const turn = this.chooseTurn(ctx);
    // Occasionally someone talks over the end of a long turn.
    if (!turn.addressed && turn.kind !== "invite" && turn.kind !== "summary" && sentenceCount(turn.text) >= 3) {
      const cutters = this.personas.filter((p) => ["initiator", "aggressor", "contrarian"].includes(p.style) && p.id !== turn.speakerId);
      if (cutters.length && Math.random() < INTERRUPT_P[this.config.difficulty]) {
        turn.cutAfter = sentenceCount(turn.text) - 1;
        this.pendingInterrupter = pick(cutters).id;
      }
    }
    this.remember(turn.text);
    return turn;
  }

  private chooseTurn(ctx: NextContext): GDTurn {
    const discussion = this.records.filter((r) => r.kind !== "moderator");
    const last = discussion[discussion.length - 1];

    // Asked the candidate, who stayed silent: move on gracefully.
    if (ctx.userInviteLapsed) {
      const who = this.persona("harmoniser") ?? this.persona("structurer") ?? this.personas[0];
      return this.pointTurn(who, pick([
        `Okay — maybe ${this.userFirst} will come in later.`,
        `No problem, ${this.userFirst}, we'll come back to you.`,
      ]));
    }

    // Someone cut in on the previous speaker.
    if (this.pendingInterrupter) {
      const p = this.personas.find((x) => x.id === this.pendingInterrupter)!;
      this.pendingInterrupter = null;
      const prev = last ? this.short(last.speakerId) : "";
      const open = fill(pick(prev ? INTERRUPT_OPEN : INTERRUPT_OPEN_ANON), prev);
      const prevPoint = last?.pointIds[0] ? this.pointById(last.pointIds[0]) : undefined;
      if (prevPoint?.counter && !this.countered.has(prevPoint.id) && this.stance[p.id] !== prevPoint.side) {
        return { speakerId: p.id, kind: "counter", pointId: prevPoint.id, text: join(open, prevPoint.counter) };
      }
      return this.pointTurn(p, open);
    }

    // Someone was asked by name to speak.
    if (this.pendingAddressed) {
      const p = this.personas.find((x) => x.id === this.pendingAddressed);
      this.pendingAddressed = null;
      if (p) {
        const asker = last ? this.short(last.speakerId) : null;
        return this.pointTurn(p, pick([`Thanks${asker ? `, ${asker}` : ""}.`, `Sure.`, `Thank you${asker ? `, ${asker}` : ""}. I've been listening, and`]).replace(/ and$/, " —"));
      }
    }

    // Nobody has spoken yet: the initiator opens.
    if (!discussion.length) {
      const init = this.persona("initiator") ?? this.personas[0];
      return { speakerId: init.id, kind: "initiate", text: `${pick(INITIATE_OPEN)} ${pick(this.topic.openers)}` };
    }

    // React to the candidate.
    if (last?.speakerId === YOU && last.analysis && !ctx.overrideComposing) {
      const r = this.reactToUser(last.analysis);
      if (r) return r;
    }

    // Pull the discussion back after someone drifted.
    if (this.driftBy && last?.speakerId === this.driftBy) {
      const who = this.persona("harmoniser") ?? this.persona("structurer") ?? this.persona("analyst") ?? this.personas[0];
      return {
        ...this.pointTurn(who, `${pick(["I think we're drifting a little,", "That's a bigger issue,", "Fair, but"])} ${this.short(this.driftBy)}. Coming back to the topic —`),
        kind: "redirect",
      };
    }

    const harm = this.persona("harmoniser");

    // A mid-way summary from the consensus builder.
    const harmFree = harm && last?.speakerId !== harm.id;
    if (harm && harmFree && !this.midSummaryDone && ctx.elapsedSec > 0.42 * this.config.durationMin * 60 && this.used.size >= 3 && Math.random() < 0.45) {
      this.midSummaryDone = true;
      return this.midSummary(harm);
    }

    // Bring the silent candidate in (friendly / competitive groups only).
    if (
      harm &&
      harmFree &&
      ctx.userSilentSec > INVITE_USER_AFTER[this.config.difficulty] &&
      ctx.elapsedSec - this.lastUserInviteAt > 150 &&
      ctx.remainingSec > 60
    ) {
      const unused = this.unusedPoints();
      const angle = unused.length ? ` — maybe on ${pick(unused).label}` : "";
      return {
        speakerId: harm.id,
        kind: "invite",
        addressed: YOU,
        text: pick([
          `${this.userFirst}, we haven't heard from you yet. What's your take${angle}?`,
          `I'd like to hear from ${this.userFirst} — ${this.userFirst}, what do you think${angle}?`,
        ]),
      };
    }

    // Bring a quiet participant in.
    const quiet = this.persona("quiet") ?? this.persona("polite");
    if (harm && harmFree && quiet && this.turnsOf(quiet.id) === 0 && discussion.length > 5 && Math.random() < 0.35) {
      return {
        speakerId: harm.id,
        kind: "invite",
        addressed: quiet.id,
        text: `${this.short(quiet.id)}, you've been quiet — what do you think?`,
      };
    }

    const speaker = this.pickSpeaker(last?.speakerId);

    if (speaker.style === "drifter" && this.driftBy === null && Math.random() < 0.5) {
      return { speakerId: speaker.id, kind: "drift", text: pick(DRIFTS) };
    }

    if (speaker.style === "contrarian" && last && last.speakerId !== speaker.id) {
      const lp = last.pointIds[0] ? this.pointById(last.pointIds[0]) : undefined;
      if (lp?.counter && !this.countered.has(lp.id)) {
        return { speakerId: speaker.id, kind: "counter", pointId: lp.id, text: `${pick(COUNTER_OPEN)} ${lp.counter}` };
      }
    }

    if (speaker.style === "harmoniser" && last && discussion.length > 3 && Math.random() < 0.5) {
      const voices = [...new Set(discussion.slice(-4).map((r) => r.speakerId))].filter((id) => id !== speaker.id).slice(0, 2);
      if (voices.length === 2) {
        return this.pointTurn(speaker, `I think both ${this.short(voices[0])} and ${this.short(voices[1])} have a point.`);
      }
    }

    return this.pointTurn(speaker);
  }

  /**
   * A turn in which `p` contributes something new: a fresh point if any are
   * left, otherwise a fact or a counter-argument on a point already raised,
   * and only then a synthesis — so the group keeps adding substance instead
   * of repeating itself once the obvious points are on the table.
   */
  private pointTurn(p: GDPersona, lead?: string, agreeing = false): GDTurn {
    const pt = this.choosePoint(p);
    const prev = [...this.records].reverse().find((r) => r.kind !== "moderator" && r.speakerId !== p.id);
    if (!pt) {
      const extra = this.extraTurn(p, lead, agreeing);
      if (extra) return extra;
      return { speakerId: p.id, kind: "rehash", text: join(lead, this.synthesis(p)) };
    }

    let connector = lead ?? "";
    if (!lead && prev) {
      const prevSide = this.sideOf(prev);
      const name = this.short(prev.speakerId);
      if (prevSide && pt.side !== "neutral" && prevSide !== "neutral" && prevSide !== pt.side) {
        connector = fill(pick(DISAGREE_OPEN), name);
      } else if (prevSide && prevSide === pt.side) {
        connector = fill(pick(AGREE_OPEN), name);
      } else {
        connector = pick(STYLE_OPEN[p.style]);
      }
    } else if (!lead) {
      connector = pick(STYLE_OPEN[p.style]);
    }

    let body = pt.say;
    const wantsFact = p.style === "analyst" || p.style === "storyteller" || (p.length >= 3 && Math.random() < 0.5);
    if (pt.fact && wantsFact) {
      this.factsUsed.add(pt.id);
      body += p.style === "storyteller" ? ` Take a real example — ${lowerFirst(pt.fact)}` : ` ${join(pick(FACT_LEAD), pt.fact)}`;
    }
    if (p.style === "polite" || p.style === "quiet") body = firstSentences(body, 2);

    return { speakerId: p.id, kind: "point", pointId: pt.id, text: join(connector, body) };
  }

  /** A fact or a counter on a point that's already been raised. */
  private extraTurn(p: GDPersona, lead: string | undefined, agreeing = false): GDTurn | null {
    const raised = [...this.used.keys()].map((id) => this.pointById(id)).filter((x): x is GDPoint => !!x);
    const s = this.stance[p.id];
    const facts = raised.filter((x) => x.fact && !this.factsUsed.has(x.id));
    const counters = raised.filter((x) => x.counter && !this.countered.has(x.id) && (s === "neutral" ? p.style === "contrarian" || p.style === "structurer" || Math.random() < 0.3 : x.side !== s && x.side !== "neutral"));
    const prefersFacts = p.style === "analyst" || p.style === "storyteller" || p.style === "polite" || p.style === "harmoniser";
    const order = agreeing ? [facts] : prefersFacts ? [facts, counters] : [counters, facts];
    // Late in the discussion, people converge rather than open new fronts.
    if (this.frac > 0.8 && Math.random() < 0.5) return null;
    for (const list of order) {
      if (!list.length) continue;
      const x = pick(list);
      if (list === facts) {
        this.factsUsed.add(x.id);
        const intro = p.style === "storyteller"
          ? pick([`On ${x.label}, take a real example —`, `Here's a real example of ${x.label}:`])
          : pick([`Just to add a fact on ${x.label} —`, `On ${x.label}, the numbers back this up.`, `To support the point on ${x.label} —`]);
        return { speakerId: p.id, kind: "build", pointId: x.id, text: join(lead, join(intro, x.fact!)) };
      }
      const intro = pick([`On ${x.label}, though —`, `Coming back to ${x.label} — I'm not sure it holds.`, `I want to question the point on ${x.label}.`]);
      return { speakerId: p.id, kind: "counter", pointId: x.id, text: join(lead, join(intro, x.counter!)) };
    }
    return null;
  }

  private reactToUser(a: UserAnalysis): GDTurn | null {
    const you = this.userFirst;

    if (a.invited.length) {
      const p = this.personas.find((x) => x.id === a.invited[0]);
      if (p) return this.pointTurn(p, pick([`Thanks, ${you}.`, `Sure, ${you}.`, `Good question, ${you}.`]));
    }
    if (a.rude) {
      const h = this.persona("harmoniser") ?? this.persona("structurer") ?? this.personas[0];
      return this.pointTurn(h, `Let's keep it respectful, everyone — we're all trying to get somewhere.`);
    }
    if (a.summarised && a.words > 25) {
      const h = this.persona("harmoniser") ?? this.persona("structurer") ?? this.personas[0];
      return this.pointTurn(h, `That's a good summary, ${you}. One thing I'd add —`);
    }
    if (a.question && a.words >= 5) {
      const ans = this.persona("analyst") ?? this.persona("structurer") ?? this.personas[0];
      return this.pointTurn(ans, `To answer ${you}'s question —`);
    }
    if (!a.onTopic && a.words >= 6) {
      const h = this.persona("structurer") ?? this.persona("harmoniser") ?? this.personas[0];
      return {
        ...this.pointTurn(h, `${you}, I'm not sure how that connects to our topic. Coming back to it —`),
        kind: "redirect",
      };
    }
    if (a.words < 6) return null;

    const pid = a.points[0];
    const p = pid ? this.pointById(pid) : undefined;
    if (p) {
      const label = p.label;
      const wantCounter = p.counter && !this.countered.has(p.id) && Math.random() < (this.config.difficulty === "friendly" ? 0.4 : 0.6);
      if (wantCounter) {
        const opp = this.personas.filter((x) => x.style === "contrarian" || (this.stance[x.id] !== p.side && this.stance[x.id] !== "neutral"));
        const who = opp.length ? pick(opp) : this.persona("contrarian") ?? pick(this.personas);
        return {
          speakerId: who.id,
          kind: "counter",
          pointId: p.id,
          text: join(fill(pick(COUNTER_USER), you).replace("{label}", label), p.counter!),
        };
      }
      // Don't echo back a fact the candidate just gave.
      if (p.fact && wordOverlap(p.fact, lastUserText(this.records)) >= 3) this.factsUsed.add(p.id);
      const allies = this.personas.filter((x) => this.stance[x.id] === p.side || this.stance[x.id] === "neutral");
      const who = allies.length ? pick(allies) : pick(this.personas);
      if (p.fact && !this.factsUsed.has(p.id) && Math.random() < 0.5) {
        this.factsUsed.add(p.id);
        return {
          speakerId: who.id,
          kind: "build",
          pointId: p.id,
          text: join(fill(pick(BUILD_USER), you).replace("{label}", label), p.fact),
        };
      }
      return this.pointTurn(who, fill(pick(BUILD_USER), you).replace("{label}", label), true);
    }

    // On topic but not one of the bank's points — still acknowledge it.
    const who = this.pickSpeaker(YOU);
    return this.pointTurn(who, pick([`That's an interesting angle, ${you}.`, `Fair point, ${you}.`, `I take ${you}'s point.`, `Right, ${you} —`]));
  }

  private midSummary(p: GDPersona): GDTurn {
    const usedLabels = [...this.used.keys()].map((id) => this.pointById(id)?.label).filter(Boolean) as string[];
    const recent = usedLabels.slice(-3);
    const unused = this.unusedPoints();
    const gap = unused.length ? ` One thing we haven't really discussed is ${pick(unused).label}.` : "";
    return {
      speakerId: p.id,
      kind: "summary",
      text: `Let me quickly sum up where we are. We've talked about ${listJoin(recent)}.${gap}`,
    };
  }

  /** Closing summary when the candidate doesn't volunteer one. */
  summaryTurn(): GDTurn {
    const p = this.persona("harmoniser") ?? this.persona("structurer") ?? this.persona("analyst") ?? this.personas[0];
    const sideLabels = (s: GDSide) =>
      [...this.used.keys()].map((id) => this.pointById(id)).filter((x): x is GDPoint => !!x && x.side === s).map((x) => x.label).slice(0, 3);
    let text: string;
    if (this.topic.kind === "factual" && this.topic.sides) {
      const f = sideLabels("for");
      const g = sideLabels("against");
      text = `I'll summarise. On one side, the group argued ${f.length ? listJoin(f) : "the benefits"}; on the other, ${g.length ? listJoin(g) : "the risks"} were raised. ${firstSentences(this.topic.conclusion, 1)}`;
    } else {
      const all = [...this.used.keys()].map((id) => this.pointById(id)?.label).filter(Boolean).slice(0, 4) as string[];
      text = `I'll summarise. We looked at ${listJoin(all.length ? all : ["several angles"])}. ${firstSentences(this.topic.conclusion, 1)}`;
    }
    return { speakerId: p.id, kind: "summary", text };
  }

  /* --------------------------------------------------------- helpers */

  /** The side a turn argued: a counter argues against the point it names. */
  private sideOf(r: GDRecord): GDSide | undefined {
    const pt = r.pointIds[0] ? this.pointById(r.pointIds[0]) : undefined;
    if (!pt) return undefined;
    if (r.kind === "counter") return pt.side === "for" ? "against" : pt.side === "against" ? "for" : undefined;
    return pt.side;
  }

  /** Who must speak next because they were asked by name (AI brain uses this). */
  get addressedNext(): string | null {
    return this.pendingAddressed;
  }

  pointById(id: string): GDPoint | undefined {
    return this.topic.points.find((p) => p.id === id);
  }

  unusedPoints(): GDPoint[] {
    return this.topic.points.filter((p) => !this.used.has(p.id));
  }

  turnsOf(id: string): number {
    return this.records.filter((r) => r.speakerId === id).length;
  }

  private choosePoint(p: GDPersona): GDPoint | null {
    const unused = this.unusedPoints();
    if (!unused.length) return null;
    const s = this.stance[p.id];
    const mine = unused.filter((x) => x.side === s);
    const neutral = unused.filter((x) => x.side === "neutral");
    let pool = mine.length ? mine : neutral.length ? neutral : unused;
    if (p.style === "analyst") {
      const withFacts = pool.filter((x) => x.fact);
      if (withFacts.length) pool = withFacts;
    }
    if (p.style === "structurer" || p.style === "harmoniser") {
      // Balance the discussion: favour the side covered less so far.
      const covered = (side: GDSide) => [...this.used.keys()].filter((id) => this.pointById(id)?.side === side).length;
      const less: GDSide = covered("for") <= covered("against") ? "for" : "against";
      const bal = unused.filter((x) => x.side === less);
      if (this.topic.kind === "factual" && bal.length) pool = bal;
    }
    return pick(pool);
  }

  /** Once the bank is spent: tie threads together, and converge toward a conclusion late on. */
  private synthesis(p: GDPersona): string {
    const parts = this.topic.conclusion.match(/[^.!?]+[.!?]+/g) ?? [this.topic.conclusion];
    if (this.frac > 0.6 && this.conclusionUsed < parts.length) {
      const part = parts[this.conclusionUsed++].trim();
      return join(pick(["I think we're converging on something.", "If I try to pull this together —", "Where I think most of us agree is this:", "So maybe the answer is this —"]), part);
    }
    const labels = [...this.used.keys()].map((id) => this.pointById(id)?.label).filter(Boolean) as string[];
    if (labels.length >= 2) {
      const [a, b] = shuffle(labels).slice(0, 2);
      const options = [
        `To me, the real tension is between ${a} and ${b}, and the answer is probably a balance of the two.`,
        `If I connect ${a} with ${b}, they aren't really opposites — good policy can address both.`,
        `Of everything said so far, ${a} is what I'd prioritise. The rest follows from it.`,
        `We keep coming back to ${a}. I think that's because it decides how everything else plays out.`,
        `Nobody has really answered the point on ${b} yet — that's the gap in our discussion.`,
        `${p.style === "initiator" || p.style === "aggressor" ? "As I said earlier," : "For me,"} ${a} matters most, and we shouldn't lose sight of it.`,
      ];
      const fresh = options.filter((o) => !this.recent.includes(o.split(" ").slice(0, 3).join(" ")));
      return pick(fresh.length ? fresh : options);
    }
    return parts[0].trim();
  }

  private pickSpeaker(lastId?: string): GDPersona {
    const recentIds = this.records.slice(-3).map((r) => r.speakerId);
    const weights = this.personas.map((p) => {
      if (p.id === lastId) return 0;
      let w = p.talk;
      if (recentIds.includes(p.id)) w *= 0.35;
      if (this.config.difficulty === "aggressive" && (p.style === "initiator" || p.style === "aggressor")) w *= 1.4;
      if (this.config.difficulty === "friendly" && p.style === "aggressor") w *= 0.5;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < this.personas.length; i++) {
      r -= weights[i];
      if (r <= 0) return this.personas[i];
    }
    return this.personas.find((p) => p.id !== lastId) ?? this.personas[0];
  }

  private remember(line: string) {
    this.recent.push(line.split(" ").slice(0, 3).join(" "));
    if (this.recent.length > 8) this.recent.shift();
  }
}

/* ---------------- phrasing ---------------- */

const INITIATE_OPEN = ["Good morning, everyone. If I may start —", "Hello, everyone. I'd like to initiate.", "Let me start, if that's okay with everyone."];
const INTERRUPT_OPEN = ["Sorry to cut in, {name} —", "If I can just jump in here, {name} —", "Sorry, {name}, let me just add —", "Just a second, {name} —"];
const INTERRUPT_OPEN_ANON = ["Sorry to cut in —", "If I can just jump in —", "Sorry, let me just add —"];
const COUNTER_OPEN = ["Let me play devil's advocate here.", "I'm not fully convinced.", "Everyone seems to be agreeing, so let me push back.", "I'd like to differ on that."];
const COUNTER_USER = [
  "{name}, I hear you on {label}, but",
  "I'd respectfully disagree with {name} on {label}.",
  "{name}, that's one side of it. But",
  "With due respect to {name}'s point on {label} —",
];
const BUILD_USER = [
  "Building on {name}'s point about {label} —",
  "I agree with {name} on {label}.",
  "Adding to what {name} said about {label} —",
  "{name} made a good point about {label}.",
];
const AGREE_OPEN = ["Adding to what {name} said —", "I agree with {name}, and", "Building on that —", "Exactly, and to extend {name}'s point —"];
const DISAGREE_OPEN = ["I'd like to differ from {name} here.", "I see it differently from {name}.", "But {name}, there's another side to this.", "With respect, {name}, I'm not sure that holds."];
const FACT_LEAD = ["If we look at the numbers —", "Here's a data point:", "Just to put a fact on the table —", "For context,"];
const STYLE_OPEN: Record<GDPersona["style"], string[]> = {
  initiator: ["Look, the real point here is this.", "I'll be very direct.", "Let me put it simply."],
  analyst: ["If we look at the evidence,", "Let me add some facts.", "Looking at this objectively,"],
  contrarian: ["Let me take the opposite view.", "I'll push back a little.", "Here's something nobody has said yet."],
  harmoniser: ["I think we're getting somewhere.", "Let me add a balancing point.", "Picking up on the discussion so far,"],
  quiet: ["If I could just add something small —", "I've been listening, and", "Just one point from my side —"],
  storyteller: ["Let me bring in the human side of this.", "Let me give a real-world angle.", "Think about what this means for ordinary people."],
  drifter: ["In general, I feel", "Honestly, if you think about it,", "See, the way I look at it,"],
  structurer: ["Let's also look at the other side.", "If we separate the short term from the long term,", "Another dimension we should consider:"],
  aggressor: ["No, no — listen.", "Let me be clear.", "The fact is,"],
  polite: ["I agree with most of what's been said.", "Just to add briefly —", "If I may —"],
};
const DRIFTS = [
  "Honestly, I think the bigger problem in India is our education system itself. Everything starts with how we teach children, and until we fix that, nothing will really change.",
  "See, at the end of the day it all comes down to corruption and implementation. We make great policies, but implementation is where everything fails in our country.",
  "I feel the real issue is population. With 140 crore people, any solution we talk about becomes very difficult.",
  "If you look at countries like Singapore, they solved everything with discipline. I think we need that kind of discipline in every area.",
];

/* ---------------- small utilities ---------------- */

const STOP = new Set(["this", "that", "with", "have", "from", "they", "will", "would", "there", "their", "about", "which", "should", "could", "think", "because", "really", "these", "those", "being", "what", "when", "also", "more", "very", "into", "than", "then", "them", "were", "your", "just", "like"]);

function stem(w: string): string {
  return w.replace(/(ing|ed|es|s|ly)$/, "");
}

function wordOverlap(a: string, b: string): number {
  const set = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP.has(w)).map(stem));
  const A = set(a);
  let n = 0;
  for (const w of set(b)) if (A.has(w)) n++;
  return n;
}

function lastUserText(records: GDRecord[]): string {
  for (let i = records.length - 1; i >= 0; i--) if (records[i].speakerId === YOU) return records[i].text;
  return "";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fill(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}

/**
 * Join a lead-in and a sentence. After a lead-in that runs on (ends in a
 * comma, dash, colon or "and"), the sentence continues in lower case.
 */
function join(lead: string | undefined, body: string): string {
  if (!lead) return body;
  const runsOn = /[,—:\-]$|\b(and|but)$/i.test(lead.trim());
  return `${lead.trim()} ${runsOn ? lowerFirst(body.trim()) : body.trim()}`;
}

const PROPER = new Set([
  "I", "India", "India's", "Indian", "Indians", "ISRO", "ISRO's", "NASA", "UPI", "AI", "EVs", "EV", "GST", "DGCA", "IIT", "IndiGo",
  "Air", "Tata", "Micron", "Falcon", "Chandrayaan-3", "Chandrayaan", "Bengaluru", "Bengaluru's", "Delhi", "Mumbai", "Kota", "China",
  "Taiwan", "Japan", "Korea", "Europe", "EU", "US", "UK", "Amazon", "Google", "ChatGPT", "Skyroot", "Agnikul", "Brahmagupta",
  "Australia", "Rajasthan", "Rajasthan's", "Karnataka", "Go", "Kingfisher", "Jet", "Akasa", "Fukushima", "Jaitapur", "Kudankulam",
  "Pratt", "Infosys", "NITI", "SWAYAM", "NPTEL", "Tejas", "BrahMos", "Akash", "Budget", "COP29", "RBI", "RBI's", "LIC's", "ONGC",
  "WHO", "IMF", "Stanford", "TSMC", "Jan", "Kudankulam", "Mangalyaan", "Gaganyaan", "PM", "FAME", "SpaceX",
]);

function lowerFirst(s: string): string {
  const first = s.match(/^[^\s,;:—]+/)?.[0] ?? "";
  if (!first || PROPER.has(first) || /^I['’]/.test(first) || /^[A-Z0-9]{2,}/.test(first)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function sentenceCount(s: string): number {
  return (s.match(/[^.!?]+[.!?]+/g) ?? [s]).length;
}

export function firstSentences(s: string, n: number): string {
  const parts = s.match(/[^.!?]+[.!?]+["')]?\s*/g);
  if (!parts) return s;
  return parts.slice(0, n).join("").trim();
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
