"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MessageSquareQuote, RotateCcw, Sparkles } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar, StatRing } from "@/components/ui/progress";
import { cn, fmtClock, useQueryParam } from "@/lib/utils";
import { useStore, useHydrated } from "@/store/useStore";
import { YOU } from "@/lib/gd/engine";

const TIP = { backgroundColor: "var(--background)", border: "1px solid var(--card-border)", borderRadius: "12px", fontSize: "12px" };
const SCORE_LABELS: Record<string, string> = {
  initiation: "Initiation",
  participation: "Participation",
  content: "Content & knowledge",
  listening: "Listening & building",
  leadership: "Leadership",
  communication: "Communication",
  conduct: "Conduct",
  summary: "Summary",
};

export default function GDReportPage() {
  const router = useRouter();
  const id = useQueryParam("id");
  const hydrated = useHydrated();
  const history = useStore((s) => s.gdHistory);
  const setPendingGD = useStore((s) => s.setPendingGD);
  const session = id ? history.find((s) => s.id === id) : history[0];

  if (!hydrated) return <div className="p-10 text-center text-muted">Loading…</div>;
  if (!session || !session.report) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="font-semibold">Report unavailable</p>
        <Link href="/gd" className="mt-4 inline-block"><Button variant="outline">Start a group discussion</Button></Link>
      </div>
    );
  }

  const r = session.report;
  const scores = Object.entries(r.scores).filter(([, v]) => v !== null) as [string, number][];
  const radar = scores.map(([k, v]) => ({ k: SCORE_LABELS[k], v }));
  const air = r.airtime.map((a) => ({ name: a.id === YOU ? "You" : a.name.split(" ")[0], share: Math.round(a.share * 100), you: a.id === YOU }));

  const retry = () => {
    setPendingGD({ ...session.config });
    router.push("/gd/room");
  };

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Group Discussion Report</h1>
          <p className="mt-1 text-sm text-muted">
            {session.companyName} · “{session.topic.title}” · {session.config.difficulty} group of {session.config.groupSize} · {session.config.durationMin} min
            {session.usedAI ? " · AI group" : " · offline group"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={retry}><RotateCcw size={14} /> Same topic again</Button>
          <Link href="/gd"><Button size="sm">New GD</Button></Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col items-center justify-center py-6">
          <StatRing value={r.overall} label={`${r.overall}`} sublabel="Overall" size={130} />
        </Card>
        <Card className="md:col-span-2">
          <CardTitle>Summary</CardTitle>
          <p className="mt-2 text-sm leading-relaxed">{r.summary}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Your airtime" value={`${Math.round(r.yourShare * 100)}%`} sub={`fair share ≈ ${Math.round(r.fairShare * 100)}%`} />
            <Stat label="Contributions" value={`${r.contributions}`} sub={r.initiated ? "you initiated" : r.firstSpokeAtSec !== null ? `first at ${fmtClock(r.firstSpokeAtSec)}` : "didn't speak"} />
            <Stat label="Shortlist estimate" value={`${r.selectionEstimate}%`} sub="practice estimate only" />
          </div>
        </Card>
      </div>

      {r.aiFeedback && (
        <Card className="mt-4 bg-accent/5">
          <CardTitle className="flex items-center gap-1.5"><Sparkles size={14} className="text-accent" /> Assessor&apos;s note</CardTitle>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.aiFeedback}</p>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>What assessors look at</CardTitle>
          <div className="mt-3 space-y-2.5">
            {scores.map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-sm"><span>{SCORE_LABELS[k]}</span><span className="text-muted">{v}</span></div>
                <ProgressBar value={v} className="mt-1 h-1.5" barClassName={v < 50 ? "from-danger to-warning" : undefined} />
              </div>
            ))}
            {r.scores.summary === null && <p className="text-xs text-muted">Summary: not attempted.</p>}
          </div>
        </Card>
        <Card>
          <CardTitle>Skill radar</CardTitle>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="70%">
                <PolarGrid stroke="var(--card-border)" />
                <PolarAngleAxis dataKey="k" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Radar dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.35} />
                <Tooltip contentStyle={TIP} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Who held the floor</CardTitle>
        <p className="mt-1 text-xs text-muted">Share of everything said in the discussion. Too little and you&apos;re invisible; far above a fair share and you&apos;re dominating.</p>
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={air}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <YAxis unit="%" tick={{ fontSize: 11, fill: "var(--muted)" }} width={36} />
              <Tooltip contentStyle={TIP} formatter={(v) => [`${v}%`, "airtime"]} />
              <Bar dataKey="share" radius={[6, 6, 0, 0]}>
                {air.map((a, i) => <Cell key={i} fill={a.you ? "var(--primary)" : "var(--muted)"} fillOpacity={a.you ? 1 : 0.45} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle className="text-success">What worked</CardTitle>
          <ul className="mt-2 space-y-1.5 text-sm">{r.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-success">✓</span>{s}</li>)}</ul>
        </Card>
        <Card>
          <CardTitle className="text-danger">What to change</CardTitle>
          <ul className="mt-2 space-y-1.5 text-sm">{r.improvements.map((s, i) => <li key={i} className="flex gap-2"><span className="text-danger">→</span>{s}</li>)}</ul>
        </Card>
      </div>

      <h2 className="mt-8 text-lg font-bold">Your contributions</h2>
      <div className="mt-3 space-y-2">
        {r.perContribution.length === 0 && <Card><p className="text-sm text-muted">You didn&apos;t speak in this discussion.</p></Card>}
        {r.perContribution.map((c, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] text-primary">{fmtClock(c.atSec)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">“{c.text}”</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((t, j) => (
                    <Badge key={j} tone={/Off-topic|Interrupted|Very short|Long|dismissive/.test(t) ? "warning" : /Point:|data|example|Built|Countered|Invited|Initiated|structure|track|ummar/.test(t) ? "success" : "neutral"}>{t}</Badge>
                  ))}
                </div>
                {c.tip && <p className="mt-2 text-xs text-accent">💡 {c.tip}</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Points you made</CardTitle>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.pointsYouMade.length ? r.pointsYouMade.map((p, i) => <Badge key={i} tone="success">{p}</Badge>) : <p className="text-sm text-muted">None of the key points were clearly made.</p>}
          </div>
          <p className="mt-3 text-xs text-muted">Facts used: {r.factsUsed} · Examples: {r.examplesUsed} · Built on others: {r.builtOnOthers} · Brought others in: {r.invitedOthers}</p>
        </Card>
        <Card>
          <CardTitle>Points you could have raised</CardTitle>
          <ul className="mt-2 space-y-2 text-sm">
            {r.pointsMissed.map((p, i) => (
              <li key={i}>
                <span className="font-semibold">{p.label}</span>
                {p.side !== "neutral" && <Badge tone="neutral" className="ml-1.5">{p.side}</Badge>}
                <p className="text-xs text-muted">{p.say}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle className="flex items-center gap-1.5"><MessageSquareQuote size={14} /> A model conclusion</CardTitle>
        <p className="mt-2 text-sm leading-relaxed">{r.conclusion}</p>
      </Card>

      <details className="glass mt-4 rounded-2xl p-5">
        <summary className="cursor-pointer text-sm font-semibold">Full transcript</summary>
        <div className="mt-3 space-y-1.5">
          {session.transcript.map((t, i) => (
            <p key={i} className={cn("text-sm", t.speakerId === YOU && "rounded-lg bg-primary/10 px-2 py-1")}>
              <span className="font-semibold">{t.speakerId === YOU ? "You" : t.name}:</span> {t.text}{t.cutOff ? " —" : ""}
            </p>
          ))}
        </div>
      </details>

      <p className="mt-6 text-center text-[11px] text-muted">Scores are a practice estimate of GD performance — not a real selection decision.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-primary-soft/40 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </div>
  );
}
