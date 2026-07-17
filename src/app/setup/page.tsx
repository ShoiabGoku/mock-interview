"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, useQueryParam } from "@/lib/utils";
import { COMPANIES, companyById } from "@/data/companies";
import { ROLES, roleById } from "@/data/roles";
import { MODES, DIFFICULTIES } from "@/data/modes";
import { useStore, useHydrated } from "@/store/useStore";
import type { Difficulty } from "@/lib/types";

const DURATIONS = [15, 30, 45, 60];

export default function SetupPage() {
  const router = useRouter();
  const companyParam = useQueryParam("company");
  const hydrated = useHydrated();
  const setPendingConfig = useStore((s) => s.setPendingConfig);
  const hasKey = useStore((s) => s.settings.apiKey.length > 0);

  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState("");
  // Preselect the company from ?company= once it resolves after mount.
  useEffect(() => {
    if (companyParam) setCompanyId(companyParam);
  }, [companyParam]);
  const [roleId, setRoleId] = useState("");
  const [mode, setMode] = useState("mixed");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [durationMin, setDurationMin] = useState(30);
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");

  const company = companyById(companyId);
  // Roles available for the chosen company come first, then the rest.
  const roleList = useMemo(() => {
    if (!company) return ROLES;
    const preferred = new Set(company.roles);
    return [...ROLES].sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id)));
  }, [company]);

  const steps = ["Company", "Role", "Mode", "Level", "Duration", "Context"];
  const canNext = [companyId, roleId, mode, difficulty, durationMin, true][step];

  const begin = () => {
    if (!companyId || !roleId) return;
    setPendingConfig({
      companyId, roleId, mode, difficulty, durationMin,
      resume: resume.trim() || undefined,
      jobDescription: jd.trim() || undefined,
    });
    router.push("/interview");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Set up your interview</h1>
      <p className="mt-1 text-sm text-muted">Six quick steps and you&apos;re in the room.</p>

      {/* Stepper */}
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
        {/* Step 0: Company */}
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {COMPANIES.map((c) => (
              <button key={c.id} onClick={() => setCompanyId(c.id)}
                className={cn("glass glass-hover rounded-2xl p-4 text-left", companyId === c.id && "ring-2 ring-primary")}>
                <div className="text-2xl">{c.emoji}</div>
                <div className="mt-2 text-sm font-semibold leading-tight">{c.name}</div>
                <div className="text-[11px] text-muted">{c.domain}</div>
                <div className="mt-1 text-[10px] text-muted">{c.panel.length} interviewers</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Role */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {roleList.map((r) => {
              const preferred = company?.roles.includes(r.id);
              return (
                <button key={r.id} onClick={() => setRoleId(r.id)}
                  className={cn("glass glass-hover rounded-2xl p-4 text-left", roleId === r.id && "ring-2 ring-primary")}>
                  <div className="text-sm font-semibold leading-tight">{r.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {preferred && <Badge tone="accent">common here</Badge>}
                    <span className="text-[10px] text-muted">{r.focus.slice(0, 2).join(", ")}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Mode */}
        {step === 2 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={cn("glass glass-hover rounded-2xl p-4 text-left", mode === m.id && "ring-2 ring-primary")}>
                <div className="text-xl">{m.emoji}</div>
                <div className="mt-1.5 text-sm font-semibold">{m.name}</div>
                <div className="text-[11px] text-muted">{m.description}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Difficulty */}
        {step === 3 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} onClick={() => setDifficulty(d.id)}
                className={cn("glass glass-hover rounded-2xl p-4 text-left", difficulty === d.id && "ring-2 ring-primary")}>
                <div className="text-sm font-semibold">{d.name}</div>
                <div className="text-[11px] text-muted">{d.description}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 4: Duration */}
        {step === 4 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DURATIONS.map((d) => (
              <button key={d} onClick={() => setDurationMin(d)}
                className={cn("glass glass-hover rounded-2xl p-6 text-center", durationMin === d && "ring-2 ring-primary")}>
                <div className="text-2xl font-bold">{d}</div>
                <div className="text-xs text-muted">minutes</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 5: Context */}
        {step === 5 && (
          <div className="space-y-4">
            <Card>
              <label className="text-sm font-semibold">Resume (optional)</label>
              <p className="text-xs text-muted">Paste your resume text — the panel will grill you on it.</p>
              <textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={5}
                placeholder="Paste resume text…"
                className="glass mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none" />
            </Card>
            <Card>
              <label className="text-sm font-semibold">Job description (optional)</label>
              <p className="text-xs text-muted">Paste the JD to tailor questions to the role.</p>
              <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={4}
                placeholder="Paste job description…"
                className="glass mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none" />
            </Card>
            <Card className="bg-primary-soft/30">
              <div className="text-sm">
                <b>{company?.name}</b> · {roleById(roleId)?.name ?? "role"} · {MODES.find((m) => m.id === mode)?.name} ·{" "}
                {DIFFICULTIES.find((d) => d.id === difficulty)?.name} · {durationMin} min
              </div>
              <p className="mt-1 text-xs text-muted">
                {hydrated && hasKey
                  ? "AI panel enabled — fully adaptive questioning."
                  : "Offline scripted panel. Add a Claude API key in Settings for adaptive AI."}
              </p>
            </Card>
          </div>
        )}
      </motion.div>

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft size={16} /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext}>
            Next <ArrowRight size={16} />
          </Button>
        ) : (
          <Button variant="success" size="lg" onClick={begin} disabled={!companyId || !roleId}>
            <Play size={16} /> Start interview
          </Button>
        )}
      </div>

      {!companyId && step > 0 && (
        <p className="mt-3 text-center text-xs text-danger">
          Pick a company first — <Link href="/setup" className="underline" onClick={() => setStep(0)}>go back to step 1</Link>.
        </p>
      )}
    </div>
  );
}
