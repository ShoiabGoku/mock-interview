"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Brain, Mic, Sparkles, Users2, BarChart3, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { COMPANIES } from "@/data/companies";
import { useHydrated, useStore } from "@/store/useStore";

const FEATURES = [
  { icon: Users2, title: "AI Hiring Panel", body: "Multiple interviewers with distinct personalities — a coder, a bar raiser, an HR partner — who question, challenge, and interrupt like the real thing." },
  { icon: Brain, title: "Adaptive & Realistic", body: "With your Claude API key the panel adapts to every answer: sharp follow-ups, cross-questions, and pressure that scales with difficulty." },
  { icon: Mic, title: "Type or Speak", body: "Answer by typing or by voice with speech-to-text, and hear interviewers speak back. Practise thinking out loud." },
  { icon: BarChart3, title: "Deep Feedback", body: "Per-question strengths, gaps, ideal answers, and a full report — technical, communication, confidence, readiness — plus an AI coach and study plan." },
  { icon: Shield, title: "Private by Design", body: "Runs entirely in your browser. Your API key and history never leave your device. Works offline with a scripted panel too." },
  { icon: Sparkles, title: "Built for your profile", body: "Core aerospace (ISRO, Airbus, SpaceX) and non-core (Google, quant, McKinsey, PhD/MS) — tuned for an IIT Bombay M.Tech Aerospace candidate." },
];

export default function HomePage() {
  const hydrated = useHydrated();
  const hasKey = useStore((s) => s.settings.apiKey.length > 0);

  return (
    <div className="mx-auto max-w-6xl">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl px-6 py-14 text-center md:py-20"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted">
          <Sparkles size={13} className="text-accent" /> Sit in front of a hiring panel — before the real one
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
          Rehearse the interview with an{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI panel</span> from the
          companies you're targeting.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted md:text-base">
          Google to ISRO, McKinsey to SpaceX, PhD panels to quant desks. A realistic multi-interviewer simulation that
          challenges you, adapts to your answers, and tells you exactly how to get better.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/setup">
            <Button size="lg">
              Start a mock interview <ArrowRight size={18} />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">
              View dashboard
            </Button>
          </Link>
        </div>
        {hydrated && !hasKey && (
          <p className="mt-4 text-xs text-muted">
            Works instantly in offline mode.{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Add a Claude API key
            </Link>{" "}
            for a fully adaptive panel.
          </p>
        )}
      </motion.section>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }}>
            <Card hover className="h-full">
              <f.icon className="text-primary" size={22} />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.body}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold">33 company panels, ready to go</h2>
        <p className="mt-1 text-sm text-muted">Each with its own interviewers, departments and questioning styles.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {COMPANIES.map((c) => (
            <Link key={c.id} href={`/setup?company=${c.id}`}>
              <span className="glass glass-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm">
                <span>{c.emoji}</span> {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <Card className="flex flex-col items-center justify-between gap-4 bg-gradient-to-r from-primary/10 to-accent/10 md:flex-row">
          <div>
            <h3 className="text-lg font-bold">Ready when you are.</h3>
            <p className="text-sm text-muted">Pick a company, choose a role and difficulty, and walk into the room.</p>
          </div>
          <Link href="/setup">
            <Button size="lg">
              Begin <ArrowRight size={18} />
            </Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}
