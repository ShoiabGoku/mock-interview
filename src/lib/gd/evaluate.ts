import type { GDContributionFeedback, GDReport, GDSide } from "./types";
import { GDEngine, YOU } from "./engine";

/**
 * Score the candidate's group discussion the way assessors do: did they
 * initiate, how much of the floor did they take (too little or too much both
 * hurt), what did they actually contribute, did they listen and build on
 * others, did they lead (structure, bring people in, pull the group back on
 * track), how did they conduct themselves, and could they summarise.
 */
export function evaluateGD(engine: GDEngine): GDReport {
  const { records, personas, config, topic } = engine;
  const talk = records.filter((r) => r.kind !== "moderator" && !r.summaryRound);
  const mine = talk.filter((r) => r.speakerId === YOU);
  const summary = records.find((r) => r.speakerId === YOU && r.summaryRound);
  const n = personas.length + 1;
  const fair = 1 / n;

  // ---------------- airtime ----------------
  const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  const totalWords = talk.reduce((s, r) => s + words(r.text), 0) || 1;
  const ids = [YOU, ...personas.map((p) => p.id)];
  const airtime = ids
    .map((id) => {
      const rs = talk.filter((r) => r.speakerId === id);
      return { id, name: id === YOU ? `${engine.userName} (you)` : engine.nameOf(id), share: rs.reduce((s, r) => s + words(r.text), 0) / totalWords, turns: rs.length };
    })
    .sort((a, b) => b.share - a.share);
  const yourShare = airtime.find((a) => a.id === YOU)?.share ?? 0;

  // ---------------- initiation ----------------
  const firstTalk = talk[0];
  const initiated = !!firstTalk && firstTalk.speakerId === YOU;
  const firstMine = mine[0];
  const startAt = records.find((r) => r.kind !== "moderator")?.atSec ?? 0;
  const firstSpokeAtSec = firstMine ? Math.max(0, firstMine.atSec - startAt) : null;
  let initiation = 10;
  if (initiated) initiation = firstMine?.analysis?.structured ? 100 : 86;
  else if (firstSpokeAtSec !== null) initiation = firstSpokeAtSec <= 60 ? 72 : firstSpokeAtSec <= 180 ? 55 : 35;

  // ---------------- participation ----------------
  const ratio = yourShare / fair;
  let participation =
    ratio < 0.15 ? 15 : ratio < 0.4 ? 30 + ratio * 60 : ratio < 0.75 ? 58 + (ratio - 0.4) * 60 : ratio <= 1.6 ? 88 + Math.min(12, (ratio - 0.75) * 20) : ratio <= 2.2 ? 78 : 58;
  if (mine.length < 2) participation = Math.min(participation, 45);
  else if (mine.length < 3 && config.durationMin >= 10) participation = Math.min(participation, 70);

  // ---------------- content ----------------
  const myPoints = [...new Set(mine.flatMap((r) => r.pointIds))];
  const facts = mine.reduce((s, r) => s + (r.analysis?.facts ?? 0), 0);
  const examples = mine.reduce((s, r) => s + (r.analysis?.examples ?? 0), 0);
  const sidesCovered = new Set(myPoints.map((id) => engine.pointById(id)?.side).filter((s) => s && s !== "neutral"));
  const novel = mine.filter((r) => r.analysis && r.analysis.onTopic && r.pointIds.length === 0 && r.analysis.words >= 18).length;
  const offTopic = mine.filter((r) => r.analysis && !r.analysis.onTopic && r.analysis.words >= 6).length;
  let content = Math.min(60, (myPoints.length + novel * 0.5) * 13) + Math.min(20, facts * 7) + Math.min(10, examples * 5) +
    (topic.kind === "factual" ? (sidesCovered.size >= 2 ? 10 : 0) : myPoints.length >= 3 ? 10 : 0);
  content -= offTopic * 8;
  if (!mine.length) content = 0;

  // ---------------- listening ----------------
  const idx = (r: (typeof talk)[number]) => talk.indexOf(r);
  let connected = 0;
  let builtOnOthers = 0;
  for (const r of mine) {
    const a = r.analysis!;
    const prev = talk[idx(r) - 1];
    const overlap = prev ? contentOverlap(r.text, prev.text) : 0;
    const refs = a.refs.length > 0 || !!a.agreeWith || !!a.disagreeWith;
    if (refs) builtOnOthers++;
    if (refs || overlap >= 2 || (prev && prev.pointIds.some((id) => r.pointIds.includes(id)))) connected++;
  }
  const listening = mine.length ? Math.round(35 + 65 * (connected / mine.length) * Math.min(1, 0.6 + builtOnOthers * 0.2)) : 0;

  // ---------------- leadership ----------------
  const invitedOthers = mine.reduce((s, r) => s + (r.analysis?.invited.length ? 1 : 0), 0);
  const redirects = mine.filter((r) => r.analysis?.redirected).length;
  const midSummaries = mine.filter((r) => r.analysis?.summarised).length;
  const structured = mine.filter((r) => r.analysis?.structured).length;
  let leadership = 25 + (initiated ? 20 : 0) + Math.min(20, structured * 12) + Math.min(20, invitedOthers * 12) + Math.min(15, redirects * 10) + Math.min(15, midSummaries * 10);
  if (!mine.length) leadership = 0;

  // ---------------- communication ----------------
  const lens = mine.map((r) => r.analysis!.words);
  const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const longOnes = lens.filter((l) => l > 120).length;
  const tiny = lens.filter((l) => l < 7).length;
  const hedges = mine.reduce((s, r) => s + (r.analysis?.hedges ?? 0), 0);
  let communication = avgLen >= 18 && avgLen <= 95 ? 85 : avgLen >= 10 ? 70 : avgLen > 0 ? 50 : 0;
  communication -= longOnes * 8 + tiny * 6 + Math.min(20, hedges * 3);
  communication += Math.min(10, mine.filter((r) => /(because|therefore|for example|so the|which means|firstly|secondly)/i.test(r.text)).length * 4);

  // ---------------- conduct ----------------
  const interruptions = mine.filter((r) => r.interrupted).length;
  const politeCuts = mine.filter((r) => r.interrupted && r.analysis?.polite).length;
  const rude = mine.filter((r) => r.analysis?.rude).length;
  let conduct = 82 + Math.min(10, mine.filter((r) => r.analysis?.polite).length * 4);
  conduct -= Math.max(0, interruptions - politeCuts - 1) * 9 + rude * 25;
  if (yourShare / fair > 2.2) conduct -= 10;
  if (!mine.length) conduct = 50;

  // ---------------- summary ----------------
  let summaryScore: number | null = null;
  if (summary) {
    const discussed = new Set([...engine.used.keys()]);
    const sumPoints = summary.analysis?.points.filter((id) => discussed.has(id)) ?? [];
    const sw = summary.analysis?.words ?? 0;
    const sumSides = new Set(sumPoints.map((id) => engine.pointById(id)?.side).filter((s) => s && s !== "neutral"));
    summaryScore = Math.round(
      Math.min(55, sumPoints.length * 14) + (sw >= 35 && sw <= 140 ? 20 : sw >= 20 ? 12 : 4) +
      (topic.kind !== "factual" || sumSides.size >= 2 ? 15 : 5) + (/(i think|in my opinion|i believe)/i.test(summary.text) ? 0 : 10)
    );
  }

  const s = {
    initiation: clampPct(initiation),
    participation: clampPct(participation),
    content: clampPct(content),
    listening: clampPct(listening),
    leadership: clampPct(leadership),
    communication: clampPct(communication),
    conduct: clampPct(conduct),
    summary: summaryScore === null ? null : clampPct(summaryScore),
  };
  const weights = { content: 0.25, participation: 0.15, listening: 0.15, communication: 0.13, leadership: 0.12, initiation: 0.08, conduct: 0.07, summary: 0.05 };
  let wsum = 0;
  let total = 0;
  for (const [k, w] of Object.entries(weights)) {
    const v = s[k as keyof typeof s];
    if (v === null) continue;
    total += v * w;
    wsum += w;
  }
  const overall = Math.round(total / wsum);
  const hardness = { friendly: 6, competitive: 0, aggressive: -4 }[config.difficulty];

  // ---------------- per-contribution feedback ----------------
  const perContribution: GDContributionFeedback[] = [...mine, ...(summary ? [summary] : [])].map((r) => {
    const a = r.analysis!;
    const tags: string[] = [];
    let tip: string | undefined;
    if (r === talk[0]) tags.push("Initiated");
    if (r.summaryRound) tags.push("Closing summary");
    if (a.structured) tags.push("Gave structure");
    for (const id of r.pointIds) tags.push(`Point: ${engine.pointById(id)?.label}`);
    if (a.facts) tags.push("Used data");
    if (a.examples) tags.push("Gave an example");
    if (a.agreeWith && a.agreeWith !== YOU) tags.push(`Built on ${short(engine, a.agreeWith)}`);
    if (a.disagreeWith && a.disagreeWith !== YOU) tags.push(`Countered ${short(engine, a.disagreeWith)}`);
    for (const id of a.invited) tags.push(`Invited ${short(engine, id)}`);
    if (a.redirected) tags.push("Brought it back on track");
    if (a.summarised && !r.summaryRound) tags.push("Summarised");
    if (r.interrupted) tags.push(a.polite ? `Cut in politely on ${short(engine, r.interrupted)}` : `Interrupted ${short(engine, r.interrupted)}`);
    if (!a.onTopic && a.words >= 6) tags.push("Off-topic");
    if (a.words > 120) tags.push(`Long (${a.words} words)`);
    if (a.words < 7) tags.push("Very short");
    if (a.rude) tags.push("Sounded dismissive");

    if (a.rude) tip = "Disagree with the idea, not the person: \"I see it differently, because…\".";
    else if (!a.onTopic && a.words >= 6) tip = "Tie every point back to the topic in your first sentence.";
    else if (a.words > 120) tip = "Make one point, back it with a reason or a fact, and stop — long monologues lose the group.";
    else if (a.words < 7) tip = "A one-liner rarely registers with assessors — add the 'because' and an example.";
    else if (r.interrupted && !a.polite) tip = "When you cut in, signal it: \"Sorry to interrupt, but…\" — assertive, not aggressive.";
    else if (!r.pointIds.length && !a.facts && !a.examples && !r.summaryRound) tip = "Anchor your view with a concrete fact or example so it stands out.";
    else if (!a.refs.length && !a.agreeWith && !a.disagreeWith && r !== talk[0] && !r.summaryRound) tip = "Link to what the previous speaker said before adding your own angle.";
    return { text: r.text, atSec: Math.max(0, r.atSec - startAt), tags, tip };
  });

  // ---------------- strengths / improvements ----------------
  const strengths: string[] = [];
  const improvements: string[] = [];
  if (initiated) strengths.push(firstMine?.analysis?.structured ? "You initiated and gave the group a structure — a strong start." : "You initiated the discussion.");
  if (s.content >= 65) strengths.push(`Substantive content — you raised ${myPoints.length} distinct point${myPoints.length === 1 ? "" : "s"}${facts ? " and backed them with data" : ""}.`);
  if (builtOnOthers >= 2) strengths.push("You listened and built on other people's points by name.");
  else if (builtOnOthers === 1) strengths.push("You linked your point to what someone else had said.");
  if (s.content < 65 && (facts > 0 || examples > 0)) strengths.push(`You backed your point with ${facts && examples ? "a fact and an example" : facts ? "a fact" : "an example"}.`);
  if (invitedOthers) strengths.push("You brought others into the discussion — a leadership signal assessors look for.");
  if (redirects) strengths.push("You pulled the group back on track when it drifted.");
  if (s.participation >= 85) strengths.push("Your share of the discussion was well judged — present without dominating.");
  if (summaryScore !== null && summaryScore >= 65) strengths.push("A balanced, well-structured closing summary.");

  if (!mine.length) improvements.push("You didn't speak at all. In a GD, silence is scored as zero — get in within the first two minutes.");
  else {
    if (firstSpokeAtSec !== null && firstSpokeAtSec > 180) improvements.push("You entered late. Aim to make your first point within the first two minutes.");
    if (ratio < 0.6) improvements.push("Your airtime was low. Make 3–5 crisp contributions in a 15-minute GD.");
    if (ratio > 2.2) improvements.push("You dominated the floor. Leave space, and bring others in — assessors mark down monopolising.");
    if (s.content < 50) improvements.push("Content was thin. Prepare 2–3 points per side and one fact or example for each.");
    if (facts === 0) improvements.push("Use at least one fact, number or real example — it makes a point memorable.");
    if (builtOnOthers === 0) improvements.push("Refer to others by name (\"Building on Ishita's point…\") to show you're listening.");
    if (topic.kind === "factual" && sidesCovered.size < 2 && myPoints.length >= 2) improvements.push("Acknowledge the other side before rebutting it — it reads as balanced, not stubborn.");
    if (interruptions - politeCuts > 1) improvements.push("You cut people off several times. Wait for a pause, or signal politely before you cut in.");
    if (offTopic) improvements.push("Some contributions drifted off topic.");
    if (summaryScore === null) improvements.push("Volunteer for the closing summary when the moderator asks — it's a free chance to stand out.");
    else if (summaryScore < 55) improvements.push("Your summary should neutrally cover both sides and the main points raised — not just your own view.");
  }
  if (!strengths.length) strengths.push("You stayed engaged with the discussion.");
  if (mine.length && !improvements.length) {
    if (!invitedOthers) improvements.push("Next level: bring a quieter participant in by name — it's one of the clearest leadership signals.");
    if (!midSummaries && !summary) improvements.push("Offer a short mid-discussion summary to steer the group when it starts going in circles.");
    if (!improvements.length) improvements.push("Keep it up — try a harder group (aggressive) to practise breaking in under pressure.");
  }

  const band = overall >= 75 ? "strong" : overall >= 60 ? "solid" : overall >= 45 ? "developing" : "early-stage";
  const summaryText = `A ${band} group-discussion performance. You took about ${Math.round(yourShare * 100)}% of the discussion (a fair share in a group of ${n} is about ${Math.round(fair * 100)}%), made ${mine.length} contribution${mine.length === 1 ? "" : "s"}${initiated ? " and initiated" : ""}. These scores are an estimate to help you practise, not a selection decision.`;

  const modelPoints = topic.points.map((p) => ({ side: p.side, label: p.label, say: p.say }));
  const pointsMissed = topic.points
    .filter((p) => !myPoints.includes(p.id))
    .sort((a, b) => Number(engine.used.has(a.id)) - Number(engine.used.has(b.id)))
    .slice(0, 5)
    .map((p) => ({ label: p.label, side: p.side as GDSide, say: p.say }));

  return {
    overall,
    scores: s,
    airtime,
    yourShare,
    fairShare: fair,
    contributions: mine.length,
    firstSpokeAtSec,
    initiated,
    pointsYouMade: myPoints.map((id) => engine.pointById(id)?.label ?? id),
    pointsMissed,
    factsUsed: facts,
    examplesUsed: examples,
    builtOnOthers,
    invitedOthers,
    interruptions,
    offTopic,
    perContribution,
    strengths,
    improvements,
    summary: summaryText,
    selectionEstimate: clampPct(Math.round(overall * 0.9 + hardness - (mine.length ? 0 : 20))),
    modelPoints,
    conclusion: topic.conclusion,
  };
}

function short(engine: GDEngine, id: string): string {
  return engine.nameOf(id).split(/\s+/)[0];
}

const STOP = new Set(["this", "that", "with", "have", "from", "they", "will", "would", "there", "their", "about", "which", "should", "could", "think", "because", "really", "these", "those", "being", "what", "when", "also", "more", "very", "into", "than", "then", "them", "were", "your", "just", "like", "make", "much", "some"]);

function contentOverlap(a: string, b: string): number {
  const set = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, "")));
  const A = set(a);
  const B = set(b);
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n;
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
