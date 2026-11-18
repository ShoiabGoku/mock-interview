"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, CameraOff, Captions, CaptionsOff, Clock, Grid2x2, Loader2, Mic, MicOff, Send, SquareUser, StopCircle,
  Volume2, VolumeX, X,
} from "lucide-react";
import { RoomStage, type Seat } from "@/components/room/RoomStage";
import type { AvatarMood } from "@/components/room/Avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, fmtClock, uid } from "@/lib/utils";
import { useStore, useHydrated } from "@/store/useStore";
import { createEngine, type EngineAdapter } from "@/lib/engine";
import { stopSpeaking, useSpeechRecognition } from "@/lib/speech";
import { readAloudSilently, speakAs, voiceFor, warmVoices, type SpeechHandle } from "@/lib/voices";
import { useCamera } from "@/lib/camera";
import { lookFor } from "@/lib/people";
import type { InterviewSession, TranscriptEntry } from "@/lib/types";

type Phase = "loading" | "active" | "processing" | "ended";

interface Speaking {
  id: string;
  name: string;
  text: string;
  shown: number;
}

export default function InterviewRoom() {
  const router = useRouter();
  const hydrated = useHydrated();
  const config = useStore((s) => s.pendingConfig);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const addSession = useStore((s) => s.addSession);
  const setPendingConfig = useStore((s) => s.setPendingConfig);

  const engineRef = useRef<EngineAdapter | null>(null);
  const answersRef = useRef<Record<number, string>>({});
  const startedAtRef = useRef(0);
  const initRef = useRef(false);
  const handleRef = useRef<SpeechHandle | null>(null);
  const voiceOnRef = useRef(settings.voiceOutput);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  /** The engine, mirrored into state so rendering never reads a ref. */
  const [engine, setEngine] = useState<EngineAdapter | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [speaking, setSpeaking] = useState<Speaking | null>(null);
  const [moods, setMoods] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [voiceOn, setVoiceOn] = useState(settings.voiceOutput);
  const [showTranscript, setShowTranscript] = useState(true);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const cam = useCamera(settings.cameraOn);

  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);

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
    warmVoices();
    const engine = createEngine(config, { apiKey: settings.apiKey, model: settings.model, preferAI: settings.preferAI });
    engineRef.current = engine;
    startedAtRef.current = Date.now();
    setRemaining(config.durationMin * 60);
    setVoiceOn(settings.voiceOutput);

    engine
      .start()
      .then((line) => {
        setEngine(engine);
        setPhase("active");
        // A beat for the voice list to load before the first line.
        setTimeout(() => pushLine(line.interviewer.id, line.interviewer.name, line.text, false, engine), 500);
      })
      .catch((e) => {
        setEngine(engine);
        setError(`Could not start the AI panel (${e instanceof Error ? e.message : "error"}). Check your API key in Settings, or run offline.`);
        setPhase("active");
      });
    return () => handleRef.current?.cancel();
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
      setMoods(engine.mood());
      const n = engine.liveNotes();
      setNotes(n);
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
      noteTimerRef.current = setTimeout(() => setNotes({}), 8000);
      setTranscript((t) => [...t, { speaker: speakerId, interviewerName: name, text, interruption, ts: Date.now() }]);
      setSpeaking({ id: speakerId, name, text, shown: 0 });
      handleRef.current?.cancel();
      const onProgress = (chars: number) => setSpeaking((s) => (s && s.id === speakerId && s.text === text ? { ...s, shown: chars } : s));
      const onEnd = () => setSpeaking((s) => (s && s.id === speakerId && s.text === text ? null : s));
      if (voiceOnRef.current) {
        const iv = engine.company.panel.find((p) => p.id === speakerId);
        const look = lookFor(speakerId, iv?.name ?? name);
        handleRef.current = speakAs(text, voiceFor(speakerId, look.gender, look.accent), { onProgress, onEnd });
      } else {
        handleRef.current = readAloudSilently(text, { onProgress, onEnd }, 6);
      }
    },
    []
  );

  const submit = useCallback(async () => {
    const engine = engineRef.current;
    const answer = input.trim();
    if (!engine || !answer || phase !== "active") return;
    stopRec();
    handleRef.current?.cancel();
    stopSpeaking();
    const idx = engine.currentIndex();
    answersRef.current[idx] = answer;
    setTranscript((t) => [...t, { speaker: "you", text: answer, ts: Date.now() }]);
    setInput("");
    setPhase("processing");
    setSpeaking(null);
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
    // Let the closing line finish before leaving the room.
    setTimeout(() => {
      handleRef.current?.cancel();
      router.replace(`/report/?id=${session.id}`);
    }, voiceOnRef.current ? 4500 : 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, transcript]);

  const seats: Seat[] = useMemo(
    () =>
      (engine?.company.panel ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        look: lookFor(p.id, p.name),
        mood: (moods[p.id] as AvatarMood | undefined) ?? "neutral",
        note: notes[p.id],
      })),
    [engine, moods, notes]
  );

  if (!hydrated || phase === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" />
        <p className="text-sm text-muted">Assembling the panel…</p>
      </div>
    );
  }

  const company = engine?.company;
  const processing = phase === "processing";
  const youName = settings.userName || "You";
  const caption = settings.captions && speaking && speaking.shown > 0 ? { name: speaking.name, text: speaking.text.slice(0, speaking.shown) } : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#eceae5] text-[#1d2230] dark:bg-[#15171c] dark:text-[#e6e8ee]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white/70 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-black/30">
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn("flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-base font-bold tabular-nums", remaining < 60 ? "bg-danger/15 text-danger" : "bg-primary-soft text-primary")}>
            <Clock size={14} /> {fmtClock(remaining)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{company?.emoji} {company?.name} · {engine?.role.name}</p>
            <p className="text-[11px] text-muted">{config?.mode} · Q {Math.min((engine?.currentIndex() ?? 0) + 1, engine?.total ?? 1)}/{engine?.total ?? "?"}</p>
          </div>
          <Badge tone={engine?.usedAI ? "success" : "neutral"}>{engine?.usedAI ? "AI" : "Offline"}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <IconBtn on={settings.captions} onClick={() => update({ captions: !settings.captions })} title="Captions" a={<Captions size={15} />} b={<CaptionsOff size={15} />} />
          <IconBtn on={voiceOn} onClick={() => { if (voiceOn) handleRef.current?.cancel(); setVoiceOn((v) => !v); }} title="Interviewer voice" a={<Volume2 size={15} />} b={<VolumeX size={15} />} />
          <IconBtn on={settings.cameraOn} onClick={() => update({ cameraOn: !settings.cameraOn })} title="Your camera" a={<Camera size={15} />} b={<CameraOff size={15} />} />
          <IconBtn on={settings.roomView === "grid"} onClick={() => update({ roomView: settings.roomView === "grid" ? "room" : "grid" })}
            title={settings.roomView === "grid" ? "Switch to in-person room" : "Switch to video-call grid"} a={<Grid2x2 size={15} />} b={<SquareUser size={15} />} />
          <Button variant="danger" size="sm" onClick={() => { if (confirm("End the interview now and see your report?")) finalize(); }}>
            <StopCircle size={14} /> End
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 p-2 md:p-3">
          <div className="w-full" style={{ maxWidth: settings.roomView === "grid" ? "min(100%, 1100px)" : "min(100%, calc(64vh * 16 / 9))" }}>
            {company && (
              <RoomStage
                layout="panel"
                view={settings.roomView}
                seats={seats}
                activeId={speaking?.id ?? null}
                self={{ stream: cam.stream, status: cam.status, name: youName, speaking: listening && !!interim }}
                board={{ title: `${company.emoji} ${company.name}`, kicker: `${engine?.role.name} · interview panel` }}
                caption={caption}
              />
            )}
          </div>
          {cam.error && <p className="w-full max-w-3xl rounded-lg bg-danger/10 p-2 text-xs text-danger">{cam.error}</p>}
          {error && <p className="w-full max-w-3xl rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>}

          {/* The current question, readable at any pace */}
          {(() => {
            const lastQ = [...transcript].reverse().find((t) => t.speaker !== "you");
            return lastQ ? (
              <div className="w-full max-w-4xl rounded-xl bg-white/70 px-3 py-2 text-sm shadow-sm dark:bg-white/5">
                <span className="mr-1.5 text-xs font-semibold text-primary">{lastQ.interviewerName}{lastQ.interruption ? " · interrupts" : ""}:</span>
                {lastQ.text}
              </div>
            ) : null;
          })()}

          {phase !== "ended" && (
            <div className="w-full max-w-4xl">
              {listening && (
                <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={cn("h-2 w-2 rounded-full", voiceStatus === "listening" ? "animate-pulse bg-success" : "bg-warning")} />
                  <span className="text-accent">
                    {voiceStatus === "reconnecting" || voiceStatus === "starting"
                      ? "Reconnecting mic — keep talking…"
                      : "Listening — pauses are fine, it keeps going. Click the mic again when you're done."}
                  </span>
                  {interim && <span className="italic text-muted">{interim}</span>}
                </p>
              )}
              {sttError && <p className="mb-1.5 rounded-lg bg-danger/10 p-2 text-xs text-danger">{sttError}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                  placeholder={processing ? "Wait for the panel…" : "Type your answer, or use the mic. (Ctrl/Cmd+Enter to send)"}
                  rows={2}
                  disabled={processing}
                  className="min-h-[52px] flex-1 resize-none rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-primary/60 disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
                />
                {sttSupported && (
                  <button
                    onClick={() => {
                      if (listening) stopRec();
                      else {
                        handleRef.current?.cancel();
                        startRec();
                      }
                    }}
                    disabled={processing}
                    className={cn("flex h-[52px] w-12 items-center justify-center rounded-xl", listening ? "bg-danger/20 text-danger" : "border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5")}
                    title={listening ? "Stop" : "Speak your answer"}
                  >
                    {listening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
                <Button onClick={submit} disabled={processing || !input.trim()} className="h-[52px]">
                  {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </div>
            </div>
          )}
        </div>

        {showTranscript ? (
          <aside className="flex max-h-[40vh] w-full flex-col border-t border-black/10 bg-white/60 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0 dark:border-white/10 dark:bg-black/20">
            <div className="flex items-center justify-between border-b border-black/10 p-2 dark:border-white/10">
              <span className="px-1 text-xs font-semibold">Transcript</span>
              <button onClick={() => setShowTranscript(false)} className="text-muted hover:text-foreground" aria-label="Hide transcript"><X size={14} /></button>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
              {transcript.map((e, i) => (
                <div key={i} className={cn("rounded-xl px-2.5 py-1.5 text-xs leading-relaxed", e.speaker === "you" ? "bg-primary/10" : "bg-black/[0.04] dark:bg-white/[0.04]")}>
                  <p className="font-semibold">
                    {e.speaker === "you" ? `You (${youName})` : e.interviewerName}
                    {e.interruption && <span className="font-normal text-amber-600"> · interrupts</span>}
                  </p>
                  <p className="whitespace-pre-line">{e.text}</p>
                </div>
              ))}
              {processing && (
                <p className="flex items-center gap-1.5 text-xs text-muted"><Loader2 size={12} className="animate-spin" /> {engine?.usedAI ? "The panel is considering…" : "…"}</p>
              )}
            </div>
          </aside>
        ) : (
          <button onClick={() => setShowTranscript(true)} className="fixed bottom-3 right-3 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold shadow dark:bg-black/50">Transcript</button>
        )}
      </div>
    </div>
  );
}

function IconBtn({ on, onClick, title, a, b }: { on: boolean; onClick: () => void; title: string; a: React.ReactNode; b: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-colors", on ? "bg-primary-soft text-primary" : "bg-black/5 text-muted hover:text-foreground dark:bg-white/5")}>
      {on ? a : b}
    </button>
  );
}
