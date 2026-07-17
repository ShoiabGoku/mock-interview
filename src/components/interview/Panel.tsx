"use client";

import { motion } from "framer-motion";
import type { Interviewer } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOOD_COLOR: Record<string, string> = {
  impressed: "bg-success",
  pleased: "bg-success/70",
  neutral: "bg-muted",
  skeptical: "bg-warning",
  concerned: "bg-danger",
};
const MOOD_LABEL: Record<string, string> = {
  impressed: "impressed",
  pleased: "pleased",
  neutral: "listening",
  skeptical: "skeptical",
  concerned: "concerned",
};

export function Panel({
  panel,
  activeId,
  moods,
  notes,
  companyName,
}: {
  panel: Interviewer[];
  activeId: string | null;
  moods: Record<string, string>;
  notes: Record<string, string>;
  companyName: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
      {panel.map((iv) => {
        const active = iv.id === activeId;
        const mood = moods[iv.id] ?? "neutral";
        return (
          <motion.div
            key={iv.id}
            animate={active ? { scale: 1.02 } : { scale: 1 }}
            className={cn(
              "glass relative flex items-start gap-3 rounded-2xl p-3 transition-all",
              active ? "border-primary/60 shadow-lg shadow-primary/20" : "opacity-80"
            )}
          >
            <div className="relative">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-full text-xl", active ? "bg-primary-soft" : "bg-primary-soft/40")}>
                {iv.avatar}
              </div>
              {active && (
                <motion.span
                  className="absolute -inset-1 rounded-full border-2 border-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold">{iv.name}</p>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", MOOD_COLOR[mood])} title={MOOD_LABEL[mood]} />
              </div>
              <p className="truncate text-[11px] text-muted">{iv.role} · {companyName}</p>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted">{iv.department}</p>
              {notes[iv.id] && <p className="mt-1 line-clamp-2 text-[11px] italic text-accent">📝 {notes[iv.id]}</p>}
              {active && !notes[iv.id] && <p className="mt-1 text-[11px] italic text-primary">speaking…</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
