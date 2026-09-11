# PanelPrep 🎤

An **AI-powered mock interview platform** that simulates a realistic multi-interviewer **hiring panel** from top companies — built for an IIT Bombay M.Tech Aerospace profile preparing for both core aerospace and non-core (software, AI/ML, quant, consulting, research, PhD/MS) roles.

**Live:** https://shoiabgoku.github.io/mock-interview/

## What it does

Instead of one interviewer, you sit in front of a **panel** — each with a name, role, department, personality and questioning style. One speaks at a time, others observe and take notes, and a second panelist occasionally **interrupts** with a follow-up. The panel asks one question at a time, adapts to your answers, challenges weak points, cross-questions, and applies pressure that scales with the difficulty you choose.

- **33 company panels** — Google, Microsoft, Meta, Amazon, Apple, NVIDIA, OpenAI, Anthropic, Tesla, SpaceX, Blue Origin, Airbus, Boeing, ISRO, DRDO, HAL, GE Aerospace, Honeywell, Rolls-Royce, Mercedes-Benz R&D, Bosch, Qualcomm, TI, Goldman Sachs, JPMorgan, McKinsey, BCG, Bain, Deloitte, Accenture, TCS, Infosys, Wipro, plus a PhD/MS admission panel. Each has its own interviewers.
- **20 roles** (SWE, Data Scientist, AI/ML, Aerodynamics, CFD, Structures, Propulsion, Thermal, GNC, Consultant, PM, Quant, GET, Scientist, PhD, MS…) and **13 interview modes** (Technical, Analytical / Aptitude, HR, Behavioral, Resume Deep Dive, Project, Coding, System Design, Case Study, Research, Rapid Fire, Mixed, Final Hiring Committee).
- **640+ questions**: a hand-written bank of discussion questions plus **every question from the [Myplacement](https://shoiabgoku.github.io/Myplacement/) prep app**. Each round draws from matching questions: the **Analytical round** asks quant aptitude, logical reasoning, puzzles and verbal ability; the **Technical round** mixes discussion questions with GATE-style numericals and MCQs from your role's technical areas (and never drifts into HR); the Resume and Project rounds grill you on the CV-specific questions.
- **Exact grading for numericals and MCQs**: say the number (digits, words, fractions, "2.2 lakh", "3 × 10^5") or the option ("B", "option c", "the second one", or its text). The panel confirms a right answer, gives one chance to re-check a wrong one *without revealing it*, and asks you to commit if you only talked around it. The report shows the correct answer and Myplacement's worked solution.
- **6 difficulty levels** from Beginner to Research Scientist.
- **Type or speak** your answers (browser speech-to-text) and hear the panel speak back (text-to-speech).
- Optional **resume** and **job-description** paste to tailor and grill.
- **Full report** after every interview: overall / technical / communication / confidence / problem-solving / behavioral / depth / structure scores, company & role readiness, an explicitly-labelled AI hiring-probability *estimate* (not a real prediction), a skill radar, and **per-question feedback** (your answer, what a strong answer covers, strengths, weaknesses, missing concepts, a better way to answer).
- **AI coach**: topics to revise, books/courses/videos, and a study plan.
- **Performance dashboard**: history, radar, growth-over-time, company-wise averages, streaks.

## Two brains — AI and offline

The interview engine is **pluggable**:

- **AI mode** — paste your own **Anthropic API key** in Settings (stored only in your browser, sent directly to Anthropic via the SDK's browser client). The panel becomes genuinely adaptive: real follow-ups, cross-questions, per-answer evaluation, and an AI-written report.
- **Offline mode** — no key needed. A deterministic scripted engine drives the question bank with keyword-based scoring for discussion questions, exact grading for numericals/MCQs, adaptive follow-ups, panel interruptions, and a computed report. Works instantly and free.

In AI mode the session's questions are drawn from the same bank and handed to Claude as a plan, with private answer keys for the graded ones.

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
    placement/    #   Myplacement's question banks, copied verbatim by scripts/sync-placement.mjs
    placementBank.ts     # turns them into interview questions (round/category, spoken form, answer key)
    placementCurated.ts  # hand conversions of interview/resume questions into open ones
  lib/            # types, scripted engine, AI engine, orchestrator, scoring, grading, speech
  store/          # zustand store (settings, history, pending config)
scripts/
  sync-placement.mjs     # re-copy the banks from ../myplacement
```

## Adding a company

Append one entry to `src/data/companies.ts` referencing a panel template (or a custom interviewer list). New roles go in `src/data/roles.ts`; new discussion questions in `src/data/questionBank.ts`.

## Pulling in new Myplacement questions

Questions added to Myplacement reach the interview after a sync and rebuild — no other change needed:

```bash
node scripts/sync-placement.mjs   # copies ../myplacement/src/data/questions/*.ts
npm run build
```

Each question's round comes from its Myplacement topic (`TOPIC_CATEGORY` in `placementBank.ts`); a question whose topic isn't mapped is listed in `UNPLACED` rather than silently dropped. Interview-style questions that read better asked openly than as quizzes go in `placementCurated.ts`.

## Development

```bash
npm install
npm run dev    # http://localhost:3001
npm run build  # static export to out/
```

Pushing to `main` builds and publishes to GitHub Pages via the included Actions workflow.

---

*The scores and "hiring probability" are an AI estimate of interview performance for practice purposes only — not a real hiring decision or prediction.*
