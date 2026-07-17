"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from "recharts";
import { BookOpen, ChevronDown, GraduationCap, RotateCcw, Sparkles } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar, StatRing } from "@/components/ui/progress";
import { cn, useQueryParam } from "@/lib/utils";
import { useStore, useHydrated } from "@/store/useStore";
import { companyById } from "@/data/companies";

const TIP = { backgroundColor: "var(--background)", border: "1px solid var(--card-border)", borderRadius: "12px", fontSize: "12px" };

export default function ReportPage() {
  const router = useRouter();
  const id = useQueryParam("id");
  const hydrated = useHydrated();
  const history = useStore((s) => s.history);
  const setPendingConfig = useStore((s) => s.setPendingConfig);
  const [openQ, setOpenQ] = useState<number | null>(0);

  const session = id ? history.find((s) => s.id === id) : history[0];

  if (!hydrated) return <div className="p-10 text-center text-muted">Loading…</div>;
  if (!session || !session.report) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="font-semibold">Report unavailable</p>
        <p className="mt-1 text-sm text-muted">This interview may have ended before a report was generated.</p>
        <Link href="/dashboard" className="mt-4 inline-block"><Button variant="outline">Back to dashboard</Button></Link>
      </div>
    );
  }

  const r = session.report;
  const c = companyById(session.config.companyId);
  const radar = [
    { k: "Technical", v: r.technical },
    { k: "Communication", v: r.communication },
    { k: "Confidence", v: r.confidence },
    { k: "Problem Solving", v: r.problemSolving },
    { k: "Depth", v: r.depth },
    { k: "Structure", v: r.structure },
  ];
  const scores: { label: string; v: number }[] = [
    { label: "Technical", v: r.technical },
    { label: "Communication", v: r.communication },
    { label: "Confidence", v: r.confidence },
    { label: "Problem Solving", v: r.problemSolving },
    { label: "Behavioral", v: r.behavioral },
    { label: "Depth", v: r.depth },
    { label: "Structure", v: r.structure },
    { label: "Company Readiness", v: r.companyReadiness },
    { label: "Role Readiness", v: r.roleReadiness },
  ];

  const retry = () => {
    setPendingConfig(session.config);
    router.push("/interview");
  };

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Interview Report</h1>
          <p className="mt-1 text-sm text-muted">
            {c?.emoji} {session.companyName} · {session.roleName} · {session.config.mode} · {session.config.difficulty}
            {session.usedAI ? " · AI panel" : " · offline panel"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={retry}><RotateCcw size={14} /> Retry</Button>
          <Link href="/setup"><Button size="sm">New interview</Button></Link>
        </div>
      </div>

      {/* Hero */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col items-center justify-center py-6">
          <StatRing value={r.overall} label={`${r.overall}`} sublabel="Overall" size={130} />
        </Card>
        <Card className="md:col-span-2">
          <CardTitle>Summary</CardTitle>
          <p className="mt-2 text-sm leading-relaxed">{r.summary}</p>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-warning/10 p-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Hiring probability (AI estimate)</p>
              <p className="text-2xl font-bold text-warning">{r.hiringProbability}%</p>
            </div>
            <p className="text-[11px] text-muted">A rough model estimate of interview performance — <b>not</b> a real hiring prediction or decision.</p>
          </div>
        </Card>
      </div>

      {/* Scores + radar */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Scorecard</CardTitle>
          <div className="mt-3 space-y-2.5">
            {scores.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm">
                  <span>{s.label}</span>
                  <span className="text-muted">{s.v}</span>
                </div>
                <ProgressBar value={s.v} className="mt-1 h-1.5" barClassName={s.v < 50 ? "from-danger to-warning" : undefined} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Skill Radar</CardTitle>
          <div className="mt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="var(--card-border)" />
                <PolarAngleAxis dataKey="k" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Radar dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.35} />
                <Tooltip contentStyle={TIP} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Strengths / weaknesses */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle className="text-success">Strengths</CardTitle>
          <ul className="mt-2 space-y-1 text-sm">
            {r.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-success">✓</span>{s}</li>)}
          </ul>
        </Card>
        <Card>
          <CardTitle className="text-danger">Areas to Improve</CardTitle>
          <ul className="mt-2 space-y-1 text-sm">
            {r.weaknesses.map((s, i) => <li key={i} className="flex gap-2"><span className="text-danger">→</span>{s}</li>)}
          </ul>
        </Card>
      </div>

      {/* Per-question feedback */}
      <h2 className="mt-8 text-lg font-bold">Question-by-Question Feedback</h2>
      <div className="mt-3 flex flex-col gap-3">
        {r.perQuestion.map((q, i) => {
          const open = openQ === i;
          return (
            <Card key={i} className="p-0">
              <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpenQ(open ? null : i)}>
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", !open && "line-clamp-2")}>{q.question}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={q.confidence >= 7 ? "success" : q.confidence >= 4 ? "warning" : "danger"}>Answer rated {q.confidence}/10</Badge>
                  </div>
                </div>
                <ChevronDown size={16} className={cn("mt-1 shrink-0 transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="space-y-3 px-4 pb-4 text-sm">
                  <Section label="Your answer" muted>{q.answer}</Section>
                  <Section label="What a strong answer covers" tone="success">{q.idealAnswer}</Section>
                  {q.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-success">Strengths</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">{q.strengths.map((s, j) => <li key={j}>{s}</li>)}</ul>
                    </div>
                  )}
                  {q.weaknesses.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-danger">Weaknesses</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">{q.weaknesses.map((s, j) => <li key={j}>{s}</li>)}</ul>
                    </div>
                  )}
                  {q.missingConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs font-semibold text-muted">Missing:</span>
                      {q.missingConcepts.map((m, j) => <Badge key={j} tone="danger">{m}</Badge>)}
                    </div>
                  )}
                  <Section label="Better way to answer" tone="accent">{q.betterAnswer}</Section>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* AI coach */}
      <h2 className="mt-8 flex items-center gap-2 text-lg font-bold"><Sparkles size={18} className="text-accent" /> Your AI Coach</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle className="flex items-center gap-1.5"><GraduationCap size={14} /> Topics to Revise</CardTitle>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.coach.topicsToRevise.length ? r.coach.topicsToRevise.map((t, i) => <Badge key={i} tone="accent">{t}</Badge>) : <p className="text-sm text-muted">Solid across the board.</p>}
          </div>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-1.5"><BookOpen size={14} /> Resources</CardTitle>
          <ul className="mt-2 space-y-1.5 text-sm">
            {r.coach.resources.map((res, i) => (
              <li key={i} className="flex items-start gap-2">
                <Badge tone="neutral" className="mt-0.5 shrink-0">{res.type}</Badge>
                <span>{res.title}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Study Plan</CardTitle>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
            {r.coach.studyPlan.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </Card>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Button variant="outline" onClick={retry}><RotateCcw size={16} /> Retry this interview</Button>
        <Link href="/dashboard"><Button>Go to dashboard</Button></Link>
      </div>
    </div>
  );
}

function Section({ label, children, muted, tone }: { label: string; children: React.ReactNode; muted?: boolean; tone?: "success" | "accent" }) {
  return (
    <div className={cn("rounded-xl p-3", muted ? "bg-primary-soft/30" : tone === "success" ? "bg-success/10" : tone === "accent" ? "bg-accent/10" : "bg-primary-soft/30")}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 whitespace-pre-line leading-relaxed">{children}</p>
    </div>
  );
}
