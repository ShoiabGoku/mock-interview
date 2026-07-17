import type { Company, Report, RoleDef, SessionConfig } from "./types";
import type { NextLine } from "./scriptedEngine";
import { ScriptedEngine } from "./scriptedEngine";
import { AIEngine } from "./aiEngine";
import { companyById } from "@/data/companies";
import { roleById } from "@/data/roles";

/**
 * Uniform async adapter over both interview brains so the room UI doesn't care
 * which one is running. AI when a key is present and preferred; otherwise the
 * deterministic scripted engine (also the fallback if AI construction fails).
 */
export interface EngineAdapter {
  usedAI: boolean;
  company: Company;
  role: RoleDef;
  total: number;
  currentIndex: () => number;
  start: () => Promise<NextLine>;
  submitAnswer: (answer: string) => Promise<NextLine>;
  buildReport: (answersByIdx: Record<number, string>) => Promise<Report>;
  mood: () => Record<string, string>;
  liveNotes: () => Record<string, string>;
}

export function createEngine(
  config: SessionConfig,
  opts: { apiKey: string; model: string; preferAI: boolean }
): EngineAdapter {
  const company = companyById(config.companyId)!;
  const role = roleById(config.roleId)!;

  const wantAI = opts.preferAI && opts.apiKey.trim().length > 0;
  if (wantAI) {
    try {
      const ai = new AIEngine(config, company, role, opts.apiKey, opts.model);
      return {
        usedAI: true,
        company,
        role,
        total: ai.total,
        currentIndex: () => ai.currentIndex,
        start: () => ai.start(),
        submitAnswer: (a) => ai.submitAnswer(a),
        buildReport: () => ai.buildReport(),
        mood: () => ai.mood(),
        liveNotes: () => ai.liveNotes(),
      };
    } catch {
      // fall through to scripted
    }
  }

  const s = new ScriptedEngine(config, company, role);
  return {
    usedAI: false,
    company,
    role,
    total: s.total,
    currentIndex: () => s.currentIndex,
    start: () => Promise.resolve(s.start()),
    submitAnswer: (a) => Promise.resolve(s.submitAnswer(a)),
    buildReport: (answersByIdx) => Promise.resolve(s.buildReport(answersByIdx)),
    mood: () => s.mood(),
    liveNotes: () => s.liveNotes(),
  };
}
