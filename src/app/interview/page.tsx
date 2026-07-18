"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, Loader2, Mic, MicOff, Send, StopCircle, Volume2, VolumeX } from "lucide-react";
import { Panel } from "@/components/interview/Panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, fmtClock, uid } from "@/lib/utils";
import { useStore, useHydrated } from "@/store/useStore";
import { createEngine, type EngineAdapter } from "@/lib/engine";
import { speak, stopSpeaking, useSpeechRecognition } from "@/lib/speech";
import type { InterviewSession, TranscriptEntry } from "@/lib/types";

type Phase = "loading" | "active" | "processing" | "ended";

export default function InterviewRoom() {
  const router = useRouter();
  const hydrated = useHydrated();
  const config = useStore((s) => s.pendingConfig);
  const settings = useStore((s) => s.settings);
  const addSession = useStore((s) => s.addSession);
  const setPendingConfig = useStore((s) => s.setPendingConfig);

  const engineRef = useRef<EngineAdapter | null>(null);
  const answersRef = useRef<Record<number, string>>({});
  const startedAtRef = useRef(0);
  const initRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("loading");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moods, setMoods] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [voiceOn, setVoiceOn] = useState(settings.voiceOutput);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Each finalized phrase streams straight into the answer box, so a long
  // spoken answer accumulates instead of being cut off at the first pause.
  const {
    listening,
    status: voiceStatus,
    interim,
    error: sttError,
    start: startRec,
    stop: stopRec,
    supported: sttSupported,
  } = useSpeechRecognition((text) =>
    setInput((prev) => (prev ? prev.replace(/\s+$/, "") + " " : "") + text)
  );

  // ---- init engine + opening line ----
  useEffect(() => {
    if (!hydrated || initRef.current) return;
    if (!config) {
      router.replace("/setup");
      return;
    }
    initRef.current = true;
    const engine = createEngine(config, { apiKey: settings.apiKey, model: settings.model, preferAI: settings.preferAI });
    engineRef.current = engine;
    startedAtRef.current = Date.now();
    setRemaining(config.durationMin * 60);
    setVoiceOn(settings.voiceOutput);

    engine
      .start()
      .then((line) => {
        pushLine(line.interviewer.id, line.interviewer.name, line.text, false, engine);
        setPhase("active");
      })
      .catch((e) => {
        setError(`Could not start the AI panel (${e instanceof Error ? e.message : "error"}). Check your API key in Settings, or run offline.`);
        setPhase("active");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, config]);

  // ---- countdown ----
  useEffect(() => {
    if (phase !== "active" && phase !== "processing") return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          finalize();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, interim]);

  const pushLine = useCallback(
    (speakerId: string, name: string, text: string, interruption: boolean, engine: EngineAdapter) => {
      setActiveId(speakerId);
      setMoods(engine.mood());
      setNotes(engine.liveNotes());
      setTranscript((t) => [...t, { speaker: speakerId, interviewerName: name, text, interruption, ts: Date.now() }]);
      if (voiceOn) {
        const iv = engine.company.panel.find((p) => p.id === speakerId);
        const female = iv ? /^(👩|🙂|📊|✈️|🌀|👩‍|🧐)/.test(iv.avatar) : true;
        speak(text, undefined, female ? "female" : "male");
      }
    },
    [voiceOn]
  );

  const submit = useCallback(async () => {
    const engine = engineRef.current;
    const answer = input.trim();
    if (!engine || !answer || phase !== "active") return;
    stopRec();
    stopSpeaking();
    const idx = engine.currentIndex();
    answersRef.current[idx] = answer;
    setTranscript((t) => [...t, { speaker: "you", text: answer, ts: Date.now() }]);
    setInput("");
    setPhase("processing");
    setActiveId(null);
    try {
      const line = await engine.submitAnswer(answer);
      pushLine(line.interviewer.id, line.interviewer.name, line.text, line.interruption, engine);
      if (line.done) {
        await finalize();
      } else {
        setPhase("active");
      }
    } catch (e) {
      setError(`The panel hit an error (${e instanceof Error ? e.message : "error"}). You can end the interview to see your report.`);
      setPhase("active");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, phase, pushLine, stopRec]);

  const finalize = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !config) return;
    setPhase("processing");
    stopSpeaking();
    let report;
    try {
      report = await engine.buildReport(answersRef.current);
    } catch {
      report = undefined;
    }
    const session: InterviewSession = {
      id: uid("iv-"),
      config,
      companyName: engine.company.name,
      roleName: engine.role.name,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      transcript,
      evals: [],
      report,
      usedAI: engine.usedAI,
    };
    addSession(session);
    setPendingConfig(null);
    setPhase("ended");
    router.replace(`/report/?id=${session.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, transcript]);

  if (!hydrated || phase === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" />
        <p className="text-sm text-muted">Assembling the panel…</p>
      </div>
    );
  }

  const engine = engineRef.current;
  const company = engine?.company;
  const processing = phase === "processing";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Panel rail */}
      <aside className="glass shrink-0 border-b p-3 lg:h-screen lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">{company?.emoji} {company?.name}</p>
            <p className="text-[11px] text-muted">{engine?.role.name} · {config?.mode}</p>
          </div>
          <Badge tone={engine?.usedAI ? "success" : "neutral"}>{engine?.usedAI ? "AI" : "Offline"}</Badge>
        </div>
        {company && <Panel panel={company.panel} activeId={activeId} moods={moods} notes={notes} companyName={company.name} />}
      </aside>

      {/* Conversation */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="glass sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-lg font-bold tabular-nums", remaining < 60 ? "bg-danger/15 text-danger" : "bg-primary-soft text-primary")}>
              <Clock size={16} /> {fmtClock(remaining)}
            </div>
            <span className="text-xs text-muted">Q {Math.min((engine?.currentIndex() ?? 0) + 1, engine?.total ?? 1)}/{engine?.total ?? "?"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setVoiceOn((v) => { if (v) stopSpeaking(); return !v; }); }}
              className="glass glass-hover flex h-9 w-9 items-center justify-center rounded-full" title="Toggle interviewer voice">
              {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <Button variant="danger" size="sm" onClick={() => { if (confirm("End the interview now and see your report?")) finalize(); }}>
              <StopCircle size={14} /> End
            </Button>
          </div>
        </header>

        {error && <div className="mx-4 mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</div>}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
          {transcript.map((e, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex", e.speaker === "you" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", e.speaker === "you" ? "bg-primary text-white dark:text-slate-950" : "glass")}>
                {e.speaker !== "you" && (
                  <p className="mb-1 text-xs font-semibold text-primary">
                    {e.interviewerName}{e.interruption && <span className="ml-1 text-warning">· interrupts</span>}
                  </p>
                )}
                <p className="whitespace-pre-line leading-relaxed">{e.text}</p>
              </div>
            </motion.div>
          ))}
          {processing && (
            <div className="flex justify-start">
              <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" /> {engine?.usedAI ? "The panel is considering…" : "…"}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        {phase !== "ended" && (
          <div className="glass border-t p-3">
            {listening && (
              <p className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className={cn("h-2 w-2 rounded-full", voiceStatus === "listening" ? "animate-pulse bg-success" : "bg-warning")} />
                <span className="text-accent">
                  {voiceStatus === "reconnecting" || voiceStatus === "starting"
                    ? "Reconnecting mic — keep talking…"
                    : "Listening — pauses are fine, it keeps going. Click the mic again when you're done."}
                </span>
                {interim && <span className="italic text-muted">{interim}</span>}
              </p>
            )}
            {sttError && (
              <p className="mb-2 rounded-lg bg-danger/10 p-2 text-xs text-danger">{sttError}</p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                placeholder={processing ? "Wait for the panel…" : "Type your answer, or use the mic. (Ctrl/Cmd+Enter to send)"}
                rows={2}
                disabled={processing}
                className="glass min-h-[52px] flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-50"
              />
              {sttSupported && (
                <button
                  onClick={() => (listening ? stopRec() : startRec())}
                  disabled={processing}
                  className={cn("flex h-[52px] w-12 items-center justify-center rounded-xl", listening ? "bg-danger/20 text-danger" : "glass glass-hover")}
                  title={listening ? "Stop" : "Speak your answer"}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <Button onClick={submit} disabled={processing || !input.trim()} className="h-[52px]">
                <Send size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
