"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Dices, Play, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/room/Avatar";
import { CameraCheck } from "@/components/room/CameraCheck";
import { cn } from "@/lib/utils";
import { COMPANIES, companyById } from "@/data/companies";
import { GD_CATEGORIES, GD_TOPICS, pickGroup, suggestTopic, topicById } from "@/data/gd";
import { lookFor } from "@/lib/people";
import { useStore, useHydrated } from "@/store/useStore";
import type { GDCategory, GDDifficulty } from "@/lib/gd/types";

const DIFFICULTY: { id: GDDifficulty; name: string; body: string }[] = [
  { id: "friendly", name: "Friendly", body: "Polite group that leaves pauses and invites you in. Good for your first few GDs." },
  { id: "competitive", name: "Competitive", body: "A normal campus GD: confident speakers, occasional cut-ins, nobody waits for you." },
  { id: "aggressive", name: "Aggressive", body: "Two dominant voices who talk over others. You'll have to break in — politely." },
];

export default function GDSetupPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const gdHistory = useStore((s) => s.gdHistory);
  const setPendingGD = useStore((s) => s.setPendingGD);

  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState("campus");
  const [category, setCategory] = useState<GDCategory | "all">("all");
  const [topicId, setTopicId] = useState("random");
  const [custom, setCustom] = useState("");
  const [groupSize, setGroupSize] = useState(6);
  const [difficulty, setDifficulty] = useState<GDDifficulty>("competitive");
  const [durationMin, setDurationMin] = useState(15);
  const [prepSec, setPrepSec] = useState(60);

  const aiReady = hydrated && settings.apiKey.length > 0 && settings.preferAI;
  const company = companyById(companyId);
  const topics = useMemo(() => GD_TOPICS.filter((t) => category === "all" || t.category === category), [category]);
  const group = useMemo(() => pickGroup(groupSize, difficulty, "preview"), [groupSize, difficulty]);
  const steps = ["Company", "Topic", "Group", "Camera check"];

  const begin = () => {
    let tid = topicId;
    if (tid === "random") tid = suggestTopic(companyId, gdHistory.slice(0, 6).map((h) => h.topic.id)).id;
    setPendingGD({
      companyId,
      topicId: tid,
      groupSize,
      difficulty,
      durationMin,
      prepSec,
      customTopic: tid === "custom" ? custom.trim() : undefined,
    });
    router.push("/gd/room");
  };

  const canNext = [true, topicId !== "custom" || custom.trim().length > 8, true, settings.userName.trim().length > 0][step];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Group Discussion</h1>
      <p className="mt-1 text-sm text-muted">
        Sit at the table with {groupSize - 1} other candidates and two assessors. Initiate, make your points, build on others, and summarise — just like the real round.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <button
            key={s}
            onClick={() => i <= step && setStep(i)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              i === step ? "bg-primary text-white dark:text-slate-950" : i < step ? "bg-primary-soft text-primary" : "glass text-muted"
            )}
          >
            {i < step ? <Check size={12} /> : <span>{i + 1}</span>} {s}
          </button>
        ))}
      </div>

      <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="mt-6">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <button onClick={() => setCompanyId("campus")}
              className={cn("glass glass-hover rounded-2xl p-4 text-left", companyId === "campus" && "ring-2 ring-primary")}>
              <div className="text-2xl">🎓</div>
              <div className="mt-2 text-sm font-semibold leading-tight">Campus placement GD</div>
              <div className="text-[11px] text-muted">Placement cell · any topic</div>
            </button>
            {COMPANIES.filter((c) => c.id !== "iitb-phd").map((c) => (
              <button key={c.id} onClick={() => setCompanyId(c.id)}
                className={cn("glass glass-hover rounded-2xl p-4 text-left", companyId === c.id && "ring-2 ring-primary")}>
                <div className="text-2xl">{c.emoji}</div>
                <div className="mt-2 text-sm font-semibold leading-tight">{c.name}</div>
                <div className="text-[11px] text-muted">{c.domain}</div>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Chip active={category === "all"} onClick={() => setCategory("all")}>All topics</Chip>
              {GD_CATEGORIES.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.emoji} {c.name}</Chip>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => setTopicId("random")}
                className={cn("glass glass-hover flex items-start gap-3 rounded-2xl p-4 text-left", topicId === "random" && "ring-2 ring-primary")}>
                <Dices className="mt-0.5 shrink-0 text-primary" size={18} />
                <div>
                  <p className="text-sm font-semibold">Surprise me</p>
                  <p className="text-[11px] text-muted">
                    Like the real round — you hear the topic only when the moderator announces it{company ? `, picked for ${company.name}` : ""}.
                  </p>
                </div>
              </button>
              {topics.map((t) => (
                <button key={t.id} onClick={() => setTopicId(t.id)}
                  className={cn("glass glass-hover rounded-2xl p-4 text-left", topicId === t.id && "ring-2 ring-primary")}>
                  <p className="text-sm font-semibold leading-snug">{t.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone="neutral">{GD_CATEGORIES.find((c) => c.id === t.category)?.name}</Badge>
                    <Badge tone={t.kind === "case" ? "accent" : t.kind === "abstract" ? "warning" : "neutral"}>{t.kind}</Badge>
                  </div>
                </button>
              ))}
              <button onClick={() => aiReady && setTopicId("custom")} disabled={!aiReady}
                className={cn("glass rounded-2xl p-4 text-left disabled:opacity-50", aiReady && "glass-hover", topicId === "custom" && "ring-2 ring-primary")}>
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles size={14} className="text-accent" /> Your own topic</p>
                <p className="text-[11px] text-muted">{aiReady ? "Type any topic — the AI group will discuss it." : "Needs a Claude API key in Settings."}</p>
              </button>
            </div>
            {topicId === "custom" && (
              <Card>
                <label className="text-sm font-semibold">Topic</label>
                <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Should India host the Olympics in 2036?"
                  className="glass mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none" />
              </Card>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <Card>
              <p className="text-sm font-semibold">How the group behaves</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {DIFFICULTY.map((d) => (
                  <button key={d.id} onClick={() => setDifficulty(d.id)}
                    className={cn("glass glass-hover rounded-2xl p-3 text-left", difficulty === d.id && "ring-2 ring-primary")}>
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{d.body}</p>
                  </button>
                ))}
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <p className="text-sm font-semibold">Group size</p>
                <div className="mt-2 flex gap-1.5">
                  {[5, 6, 7, 8].map((n) => <Chip key={n} active={groupSize === n} onClick={() => setGroupSize(n)}>{n}</Chip>)}
                </div>
                <p className="mt-1.5 text-[11px] text-muted">Including you.</p>
              </Card>
              <Card>
                <p className="text-sm font-semibold">Discussion time</p>
                <div className="mt-2 flex gap-1.5">
                  {[10, 15, 20].map((n) => <Chip key={n} active={durationMin === n} onClick={() => setDurationMin(n)}>{n} min</Chip>)}
                </div>
              </Card>
              <Card>
                <p className="text-sm font-semibold">Thinking time</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[0, 30, 60, 120].map((n) => <Chip key={n} active={prepSec === n} onClick={() => setPrepSec(n)}>{n === 0 ? "None" : n < 60 ? `${n}s` : `${n / 60} min`}</Chip>)}
                </div>
              </Card>
            </div>

            <Card>
              <p className="text-sm font-semibold">You&apos;ll be discussing with</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {group.map((p) => (
                  <div key={p.id} className="flex w-[104px] flex-col items-center text-center">
                    <div className="h-20 w-20 overflow-hidden rounded-2xl tile-bg-0">
                      <Avatar id={p.id} look={lookFor(p.id, p.name)} className="h-full w-full" />
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-tight">{p.name}</p>
                    <p className="text-[10px] leading-tight text-muted">{p.blurb}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <label className="text-sm font-semibold">Your name</label>
              <p className="text-xs text-muted">The others will address you by this name.</p>
              <input value={settings.userName} onChange={(e) => update({ userName: e.target.value })}
                className="glass mt-2 w-full max-w-xs rounded-xl px-3 py-2 text-sm outline-none" />
            </Card>
            <Card>
              <CameraCheck name={settings.userName} />
            </Card>
            <Card className="bg-primary-soft/30 text-sm">
              <b>{company?.name ?? "Campus placement"}</b> · {topicId === "random" ? "surprise topic" : topicId === "custom" ? custom : topicById(topicId)?.title} ·{" "}
              {DIFFICULTY.find((d) => d.id === difficulty)?.name} group of {groupSize} · {durationMin} min
              <p className="mt-1 text-xs text-muted">{aiReady ? "AI group — participants respond freely to whatever you say." : "Offline group — works without an API key."}</p>
            </Card>
          </div>
        )}
      </motion.div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft size={16} /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext}>
            Next <ArrowRight size={16} />
          </Button>
        ) : (
          <Button variant="success" size="lg" onClick={begin} disabled={!canNext}>
            <Play size={16} /> Enter the room
          </Button>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors", active ? "bg-primary text-white dark:text-slate-950" : "glass hover:text-foreground")}>
      {children}
    </button>
  );
}
