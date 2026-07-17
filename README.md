# PanelPrep 🎤

An **AI-powered mock interview platform** that simulates a realistic multi-interviewer **hiring panel** from top companies — built for an IIT Bombay M.Tech Aerospace profile preparing for both core aerospace and non-core (software, AI/ML, quant, consulting, research, PhD/MS) roles.

**Live:** https://shoiabgoku.github.io/mock-interview/

## What it does

Instead of one interviewer, you sit in front of a **panel** — each with a name, role, department, personality and questioning style. One speaks at a time, others observe and take notes, and a second panelist occasionally **interrupts** with a follow-up. The panel asks one question at a time, adapts to your answers, challenges weak points, cross-questions, and applies pressure that scales with the difficulty you choose.

- **33 company panels** — Google, Microsoft, Meta, Amazon, Apple, NVIDIA, OpenAI, Anthropic, Tesla, SpaceX, Blue Origin, Airbus, Boeing, ISRO, DRDO, HAL, GE Aerospace, Honeywell, Rolls-Royce, Mercedes-Benz R&D, Bosch, Qualcomm, TI, Goldman Sachs, JPMorgan, McKinsey, BCG, Bain, Deloitte, Accenture, TCS, Infosys, Wipro, plus a PhD/MS admission panel. Each has its own interviewers.
- **20 roles** (SWE, Data Scientist, AI/ML, Aerodynamics, CFD, Structures, Propulsion, Thermal, GNC, Consultant, PM, Quant, GET, Scientist, PhD, MS…) and **12 interview modes** (Technical, HR, Behavioral, Resume Deep Dive, Project, Coding, System Design, Case Study, Research, Rapid Fire, Mixed, Final Hiring Committee).
- **6 difficulty levels** from Beginner to Research Scientist.
- **Type or speak** your answers (browser speech-to-text) and hear the panel speak back (text-to-speech).
- Optional **resume** and **job-description** paste to tailor and grill.
- **Full report** after every interview: overall / technical / communication / confidence / problem-solving / behavioral / depth / structure scores, company & role readiness, an explicitly-labelled AI hiring-probability *estimate* (not a real prediction), a skill radar, and **per-question feedback** (your answer, what a strong answer covers, strengths, weaknesses, missing concepts, a better way to answer).
- **AI coach**: topics to revise, books/courses/videos, and a study plan.
- **Performance dashboard**: history, radar, growth-over-time, company-wise averages, streaks.

## Two brains — AI and offline

The interview engine is **pluggable**:

- **AI mode** — paste your own **Anthropic API key** in Settings (stored only in your browser, sent directly to Anthropic via the SDK's browser client). The panel becomes genuinely adaptive: real follow-ups, cross-questions, per-answer evaluation, and an AI-written report.
- **Offline mode** — no key needed. A deterministic scripted engine drives a curated question bank with keyword-based answer scoring, adaptive follow-ups, panel interruptions, and a computed report. Works instantly and free.

Both share the same room UI, so the experience is identical in shape; AI mode is simply smarter.

## Tech stack

Next.js (App Router, **static export**) · TypeScript · Tailwind CSS v4 · Zustand (persisted to localStorage) · Framer Motion · Recharts · Web Speech API · `@anthropic-ai/sdk`.

No backend. Everything — your key, resume, transcripts, scores, history — lives only in your browser. Deploys free on GitHub Pages.

## Project structure

```
src/
  app/            # routes: home, setup wizard, interview room, report, dashboard, settings
  components/     # shell, ui primitives, interview panel
  data/           # companies + panels, roles, modes, question bank, resources
  lib/            # types, scripted engine, AI engine, orchestrator, scoring, speech
  store/          # zustand store (settings, history, pending config)
```

## Adding a company

Append one entry to `src/data/companies.ts` referencing a panel template (or a custom interviewer list). New roles go in `src/data/roles.ts`; new questions in `src/data/questionBank.ts`.

## Development

```bash
npm install
npm run dev    # http://localhost:3001
npm run build  # static export to out/
```

Pushing to `main` builds and publishes to GitHub Pages via the included Actions workflow.

---

*The scores and "hiring probability" are an AI estimate of interview performance for practice purposes only — not a real hiring decision or prediction.*
