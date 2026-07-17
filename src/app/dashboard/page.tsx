"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowRight, Flame, Trophy } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatRing } from "@/components/ui/progress";
import { useStore, useHydrated } from "@/store/useStore";
import { companyById } from "@/data/companies";
import { roleById } from "@/data/roles";

const AXIS = { fontSize: 11, fill: "var(--muted)" };
const TIP = { backgroundColor: "var(--background)", border: "1px solid var(--card-border)", borderRadius: "12px", fontSize: "12px" };

export default function DashboardPage() {
  const hydrated = useHydrated();
  const history = useStore((s) => s.history);

  const latest = history[0]?.report;
  const chrono = useMemo(() => [...history].reverse(), [history]);

  const trend = chrono
    .filter((s) => s.report)
    .map((s, i) => ({
      name: `#${i + 1}`,
      overall: s.report!.overall,
      technical: s.report!.technical,
      communication: s.report!.communication,
    }));

  const radar = latest
    ? [
        { k: "Technical", v: latest.technical },
        { k: "Communication", v: latest.communication },
        { k: "Confidence", v: latest.confidence },
        { k: "Problem Solving", v: latest.problemSolving },
        { k: "Depth", v: latest.depth },
        { k: "Structure", v: latest.structure },
      ]
    : [];

  const byCompany = useMemo(() => {
    const map = new Map<string, { total: number; n: number }>();
    for (const s of history) {
      if (!s.report) continue;
      const cur = map.get(s.companyName) ?? { total: 0, n: 0 };
      cur.total += s.report.overall;
      cur.n += 1;
      map.set(s.companyName, cur);
    }
    return [...map.entries()].map(([name, v]) => ({ name, score: Math.round(v.total / v.n) })).slice(0, 8);
  }, [history]);

  const streak = useMemo(() => {
    if (!history.length) return 0;
    const days = new Set(history.map((s) => new Date(s.startedAt).toDateString()));
    let count = 0;
    const d = new Date();
    // allow today or yesterday to start the streak
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 3650; i++) {
      if (days.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); } else break;
    }
    return count;
  }, [history]);

  const best = history.reduce((m, s) => Math.max(m, s.report?.overall ?? 0), 0);

  if (!hydrated) return <div className="p-10 text-center text-muted">Loading…</div>;

  if (history.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-lg font-semibold">No interviews yet</p>
        <p className="mt-2 text-sm text-muted">Complete a mock interview and your performance analytics appear here — radar, trends, company breakdown and streaks.</p>
        <Link href="/setup" className="mt-4 inline-block">
          <Button>Start your first interview <ArrowRight size={16} /></Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Performance Dashboard</h1>
      <p className="mt-1 text-sm text-muted">{history.length} interview{history.length === 1 ? "" : "s"} analyzed · scores are AI estimates of performance, not hiring outcomes.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <Card className="flex flex-col items-center justify-center">
          <StatRing value={latest?.overall ?? 0} label={`${latest?.overall ?? 0}`} sublabel="Latest overall" size={120} />
        </Card>
        <Card className="flex flex-col justify-center">
          <CardTitle className="flex items-center gap-1.5"><Trophy size={14} /> Best score</CardTitle>
          <p className="mt-2 text-3xl font-bold">{best}</p>
          <p className="text-xs text-muted">across all interviews</p>
        </Card>
        <Card className="flex flex-col justify-center">
          <CardTitle className="flex items-center gap-1.5"><Flame size={14} /> Streak</CardTitle>
          <p className="mt-2 text-3xl font-bold">{streak} <span className="text-base font-normal text-muted">days</span></p>
          <p className="text-xs text-muted">consecutive practice days</p>
        </Card>
        <Card className="flex flex-col justify-center">
          <CardTitle>Readiness</CardTitle>
          <p className="mt-2 text-3xl font-bold">{latest?.companyReadiness ?? 0}%</p>
          <p className="text-xs text-muted">company readiness (latest)</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {radar.length > 0 && (
          <Card>
            <CardTitle>Skill Radar (latest)</CardTitle>
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="var(--card-border)" />
                  <PolarAngleAxis dataKey="k" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                  <Radar dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.35} />
                  <Tooltip contentStyle={TIP} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardTitle>Growth Over Time</CardTitle>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="name" tick={AXIS} />
                <YAxis domain={[0, 100]} tick={AXIS} width={30} />
                <Tooltip contentStyle={TIP} />
                <Line type="monotone" dataKey="overall" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} name="Overall" />
                <Line type="monotone" dataKey="technical" stroke="var(--accent)" strokeWidth={2} dot={false} name="Technical" />
                <Line type="monotone" dataKey="communication" stroke="var(--warning)" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Communication" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {byCompany.length > 0 && (
          <Card className="lg:col-span-3">
            <CardTitle>Company-wise Average</CardTitle>
            <div className="mt-2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCompany}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="name" tick={AXIS} />
                  <YAxis domain={[0, 100]} tick={AXIS} width={30} />
                  <Tooltip contentStyle={TIP} />
                  <Bar dataKey="score" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      <h2 className="mt-8 text-lg font-bold">Interview History</h2>
      <div className="mt-3 flex flex-col gap-2">
        {history.map((s) => {
          const c = companyById(s.config.companyId);
          return (
            <Link key={s.id} href={`/report/?id=${s.id}`}>
              <Card hover className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c?.emoji ?? "🎤"}</span>
                  <div>
                    <p className="text-sm font-semibold">{s.companyName} · {roleById(s.config.roleId)?.name ?? s.roleName}</p>
                    <p className="text-xs text-muted">
                      {s.config.mode} · {s.config.difficulty} · {new Date(s.startedAt).toLocaleDateString()}
                      {s.usedAI ? " · AI panel" : " · offline"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={(s.report?.overall ?? 0) >= 60 ? "success" : "warning"}>{s.report?.overall ?? 0}</Badge>
                  <ArrowRight size={16} className="text-muted" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
