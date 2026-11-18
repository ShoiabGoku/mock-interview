"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, CameraOff, Captions, CaptionsOff, Clock, Grid2x2, Hand, Loader2, Mic, MicOff, NotebookPen,
  Send, SquareUser, StopCircle, Volume2, VolumeX, X,
} from "lucide-react";
import { RoomStage, type Seat } from "@/components/room/RoomStage";
import { Button } from "@/components/ui/button";
import { cn, fmtClock, uid } from "@/lib/utils";
import { useStore, useHydrated } from "@/store/useStore";
import { useCamera } from "@/lib/camera";
import { useSpeechRecognition } from "@/lib/speech";
import { readAloudSilently, speakAs, voiceFor, warmVoices, type SpeechHandle } from "@/lib/voices";
import { lookFor } from "@/lib/people";
import { companyById } from "@/data/companies";
import { moderatorsFor, pickGroup, topicById } from "@/data/gd";
import { GDEngine, YOU, firstSentences, sentenceCount } from "@/lib/gd/engine";
import { evaluateGD } from "@/lib/gd/evaluate";
import { createGDBrain, type GDBrain } from "@/lib/gd/brain";
import type { GDRecord, GDSession, GDTopic, GDTurn } from "@/lib/gd/types";

type Phase = "loading" | "intro" | "prep" | "discussion" | "summary" | "closing";

/** How long the group waits while you're typing before someone else takes the floor. */
const COMPOSE_GRACE = { friendly: 45, competitive: 18, aggressive: 8 };
/** How long they wait for you after asking you directly. */
const INVITE_WAIT = { friendly: 18, competitive: 12, aggressive: 8 };
/** Pause between speakers. */
const GAP = { friendly: [1400, 2600], competitive: [600, 1500], aggressive: [200, 750] } as const;
/** Opening window in which you can initiate before someone else does. */
const INITIATE_WINDOW = { friendly: 6000, competitive: 3200, aggressive: 1300 };

interface Speaking {
  id: string;
  name: string;
  text: string;
  shown: number;
}

export default function GDRoom() {
  const router = useRouter();
  const hydrated = useHydrated();
  const config = useStore((s) => s.pendingGD);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const addGDSession = useStore((s) => s.addGDSession);
  const setPendingGD = useStore((s) => s.setPendingGD);

  const engineRef = useRef<GDEngine | null>(null);
  const brainRef = useRef<GDBrain | null>(null);
  const initRef = useRef(false);
  const phaseRef = useRef<Phase>("loading");
  const handleRef = useRef<SpeechHandle | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const discussionStartRef = useRef(0);
  const lastUserAtRef = useRef(0);
  const composingSinceRef = useRef(0);
  const awaitingUserRef = useRef<{ since: number; by: string } | null>(null);
  const summaryAskedAtRef = useRef(0);
  const timeChecksRef = useRef<Set<string>>(new Set());
  const modQueueRef = useRef<GDTurn[]>([]);
  const versionRef = useRef(0);
  const speakingRef = useRef<Speaking | null>(null);
  const takeTurnRef = useRef<(() => Promise<void>) | null>(null);
  const closeDiscussionRef = useRef<(() => Promise<void>) | null>(null);
  const submitRef = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);
  const micInterruptRef = useRef<string | undefined>(undefined);
  const lastSegmentAtRef = useRef(0);
  const voiceOnRef = useRef(settings.voiceOutput);
  const inputRef = useRef("");

  const [phase, setPhaseState] = useState<Phase>("loading");
  const [records, setRecords] = useState<GDRecord[]>([]);
  const [speaking, setSpeaking] = useState<Speaking | null>(null);
  const [nodding, setNodding] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [prepLeft, setPrepLeft] = useState(0);
  const [input, setInputState] = useState("");
  const [notes, setNotes] = useState("");
  const [voiceOn, setVoiceOn] = useState(settings.voiceOutput);
  const [panel, setPanel] = useState<"transcript" | "notes" | null>("transcript");
  const [awaitingUser, setAwaitingUser] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [usedAI, setUsedAI] = useState(false);

  const cam = useCamera(settings.cameraOn);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const setInput = useCallback((v: string | ((prev: string) => string)) => {
    setInputState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      inputRef.current = next;
      return next;
    });
  }, []);

  const rec = useSpeechRecognition((text) => {
    lastSegmentAtRef.current = Date.now();
    setInput((prev) => (prev ? prev.replace(/\s+$/, "") + " " : "") + text);
  });
  const listeningRef = useRef(false);
  useEffect(() => {
    listeningRef.current = rec.listening;
  }, [rec.listening]);
  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);

  /* ---------------------------------------------------------- setup */

  const topic: GDTopic | null = useMemo(() => {
    if (!config) return null;
    if (config.customTopic) {
      return {
        id: "custom",
        title: config.customTopic,
        category: "society",
        kind: "abstract",
        brief: config.customTopic,
        points: [],
        openers: [`Let me start by defining what this topic really asks, and then we can look at it from a few angles — the benefits, the costs, and who is affected.`],
        conclusion: "A balanced view weighs the benefits against the costs and risks, considers who is affected, and looks for a practical middle ground.",
      };
    }
    return topicById(config.topicId) ?? null;
  }, [config]);

  const personas = useMemo(() => (config ? pickGroup(config.groupSize, config.difficulty, config.topicId + config.companyId) : []), [config]);
  const moderators = useMemo(() => (config ? moderatorsFor(config.companyId) : []), [config]);
  const company = config ? companyById(config.companyId) : undefined;

  const seats: Seat[] = useMemo(() => personas.map((p) => ({ id: p.id, name: p.name, look: lookFor(p.id, p.name) })), [personas]);
  const observers: Seat[] = useMemo(() => moderators.map((m) => ({ id: m.id, name: m.name, role: m.role, look: lookFor(m.id, m.name) })), [moderators]);
  const lookOf = useCallback(
    (id: string) => seats.find((s) => s.id === id)?.look ?? observers.find((s) => s.id === id)?.look ?? lookFor(id),
    [seats, observers]
  );

  const sync = useCallback(() => {
    const e = engineRef.current;
    if (e) setRecords([...e.records]);
  }, []);

  const nowSec = () => (Date.now() - startedAtRef.current) / 1000;

  /* ------------------------------------------------------ speaking */

  /** Speak a turn (voice or silent captions) and log it. Resolves when it ends or is cut off. */
  const play = useCallback(
    (turn: GDTurn): Promise<void> => {
      const e = engineRef.current!;
      const spokenText = turn.cutAfter ? firstSentences(turn.text, turn.cutAfter) : turn.text;
      e.record(turn, nowSec(), turn.cutAfter ? spokenText : undefined);
      sync();
      const name = e.nameOf(turn.speakerId);
      setSpeaking({ id: turn.speakerId, name, text: spokenText, shown: 0 });
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          finishRef.current = null;
          handleRef.current = null;
          setSpeaking((s) => (s?.id === turn.speakerId ? null : s));
          resolve();
        };
        finishRef.current = finish;
        const onProgress = (chars: number) => setSpeaking((s) => (s && s.id === turn.speakerId ? { ...s, shown: chars } : s));
        if (voiceOnRef.current) {
          const look = lookOf(turn.speakerId);
          handleRef.current = speakAs(spokenText, voiceFor(turn.speakerId, look.gender, look.accent), { onProgress, onEnd: finish });
        } else {
          handleRef.current = readAloudSilently(spokenText, { onProgress, onEnd: finish });
        }
      });
    },
    [lookOf, sync]
  );

  /** Stop whoever is talking. Returns their id if someone was mid-turn. */
  const cutOff = useCallback((): string | undefined => {
    const s = speakingRef.current;
    if (!s || !handleRef.current) return undefined;
    handleRef.current.cancel();
    const e = engineRef.current!;
    const last = e.records[e.records.length - 1];
    if (last && last.speakerId === s.id && s.shown < s.text.length - 3) {
      const said = s.text.slice(0, Math.max(s.shown, 1)).replace(/\s+\S*$/, "");
      last.text = said || last.text.split(" ").slice(0, 4).join(" ");
      last.cutOff = true;
      sync();
    }
    finishRef.current?.();
    return s.id;
  }, [sync]);
  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  /* ------------------------------------------------------ scheduling */

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const gap = () => {
    const [lo, hi] = GAP[config?.difficulty ?? "competitive"];
    return lo + Math.random() * (hi - lo);
  };

  const scheduleNext = useCallback((delay: number) => {
    clearTimer();
    timerRef.current = setTimeout(() => void takeTurnRef.current?.(), delay);
  }, []);

  const takeTurn = useCallback(async () => {
    const e = engineRef.current;
    const brain = brainRef.current;
    if (!e || !brain || !config) return;
    // Someone is mid-turn: check again shortly (your own caption doesn't block).
    if (busyRef.current || (speakingRef.current && speakingRef.current.id !== YOU)) {
      if (phaseRef.current === "discussion" || phaseRef.current === "summary") scheduleNext(600);
      return;
    }
    const p = phaseRef.current;

    if (p === "summary") {
      // Waiting for the candidate to volunteer the summary.
      const composing = inputRef.current.trim().length > 0 || listeningRef.current;
      const waited = (Date.now() - summaryAskedAtRef.current) / 1000;
      if ((composing && waited < 90) || (!composing && waited < 10)) {
        scheduleNext(800);
        return;
      }
      busyRef.current = true;
      setThinking(brain.usedAI);
      const s = await brain.summary();
      setThinking(false);
      await play(s);
      busyRef.current = false;
      await closeDiscussionRef.current?.();
      return;
    }
    if (p !== "discussion") return;

    // Queued moderator announcements (time checks) go first, never mid-turn.
    const mod = modQueueRef.current.shift();
    if (mod) {
      busyRef.current = true;
      await play(mod);
      busyRef.current = false;
      scheduleNext(gap());
      return;
    }

    const now = Date.now();
    const composing = inputRef.current.trim().length > 0 || listeningRef.current;
    let overrideComposing = false;
    if (composing) {
      if (!composingSinceRef.current) composingSinceRef.current = now;
      const talking = listeningRef.current && now - lastSegmentAtRef.current < 4000;
      const waited = (now - composingSinceRef.current) / 1000;
      if (talking || waited < COMPOSE_GRACE[config.difficulty]) {
        scheduleNext(700);
        return;
      }
      overrideComposing = true;
    }

    let userInviteLapsed = false;
    const aw = awaitingUserRef.current;
    if (aw) {
      if ((now - aw.since) / 1000 < INVITE_WAIT[config.difficulty]) {
        scheduleNext(700);
        return;
      }
      awaitingUserRef.current = null;
      setAwaitingUser(null);
      userInviteLapsed = true;
    }

    const elapsedSec = (now - discussionStartRef.current) / 1000;
    const ctx = {
      elapsedSec,
      remainingSec: config.durationMin * 60 - elapsedSec,
      userSilentSec: (now - Math.max(lastUserAtRef.current, discussionStartRef.current)) / 1000,
      userInviteLapsed,
      overrideComposing,
    };
    busyRef.current = true;
    const version = versionRef.current;
    setThinking(brain.usedAI);
    let turn: GDTurn;
    try {
      turn = await brain.next(ctx);
    } catch {
      turn = e.nextTurn(ctx);
    }
    setThinking(false);
    // The candidate spoke while we were deciding — react to that instead.
    if (version !== versionRef.current || phaseRef.current !== "discussion") {
      busyRef.current = false;
      if (phaseRef.current === "discussion") scheduleNext(200);
      return;
    }
    if (overrideComposing) composingSinceRef.current = Date.now();
    await play(turn);
    busyRef.current = false;
    if (phaseRef.current !== "discussion") return;
    // Cut off by the candidate: make sure the reply to them still comes.
    if (version !== versionRef.current) {
      scheduleNext(900);
      return;
    }
    if (turn.addressed === YOU) {
      awaitingUserRef.current = { since: Date.now(), by: turn.speakerId };
      setAwaitingUser(e.nameOf(turn.speakerId).split(" ")[0]);
    }
    scheduleNext(turn.cutAfter && sentenceCount(turn.text) > (turn.cutAfter ?? 0) ? 120 : gap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, play, scheduleNext]);
  useEffect(() => {
    takeTurnRef.current = takeTurn;
  }, [takeTurn]);

  /* ------------------------------------------------------ phases */

  const finishSession = useCallback(async () => {
    const e = engineRef.current;
    const brain = brainRef.current;
    if (!e || !config || !topic) return;
    setPhase("closing");
    clearTimer();
    rec.stop();
    const report = evaluateGD(e);
    try {
      const fb = await Promise.race([brain?.feedback(report), new Promise<undefined>((r) => setTimeout(() => r(undefined), 15000))]);
      if (fb) report.aiFeedback = fb;
    } catch {
      /* optional */
    }
    const session: GDSession = {
      id: uid("gd-"),
      config,
      topic: { id: topic.id, title: topic.title, category: topic.category },
      companyName: company?.name ?? "Campus placement",
      participants: e.personas.map((p) => ({ id: p.id, name: p.name })),
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      transcript: e.records,
      report,
      usedAI: !!brain?.usedAI,
    };
    addGDSession(session);
    setPendingGD(null);
    router.replace(`/gd/report/?id=${session.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, topic, company, addGDSession, setPendingGD, router]);

  const closeDiscussion = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    setPhase("closing");
    clearTimer();
    await play(e.closingTurn(company?.name ?? null));
    await finishSession();
  }, [play, finishSession, company, setPhase]);
  useEffect(() => {
    closeDiscussionRef.current = closeDiscussion;
  }, [closeDiscussion]);

  const timeUp = useCallback(async () => {
    const e = engineRef.current;
    if (!e || phaseRef.current !== "discussion") return;
    setPhase("summary");
    clearTimer();
    // Let the current speaker finish their sentence, then wrap up.
    const waitFor = Date.now();
    while (speakingRef.current && Date.now() - waitFor < 7000) await new Promise((r) => setTimeout(r, 250));
    if (speakingRef.current) cutOff();
    while (busyRef.current && Date.now() - waitFor < 9000) await new Promise((r) => setTimeout(r, 250));
    awaitingUserRef.current = null;
    setAwaitingUser(null);
    busyRef.current = true;
    await play(e.timeUpTurn());
    await play(e.summaryInviteTurn());
    busyRef.current = false;
    summaryAskedAtRef.current = Date.now();
    scheduleNext(800);
  }, [play, cutOff, scheduleNext, setPhase]);

  const startDiscussion = useCallback(async () => {
    const e = engineRef.current;
    if (!e || !config || phaseRef.current === "discussion" || discussionStartRef.current) return;
    // The clock starts with the moderator's "your time starts now".
    discussionStartRef.current = Date.now();
    lastUserAtRef.current = 0;
    setRemaining(config.durationMin * 60);
    setPhase("discussion");
    busyRef.current = true;
    await play(e.startTurn(config.prepSec > 0));
    busyRef.current = false;
    scheduleNext(INITIATE_WINDOW[config.difficulty]);
  }, [config, play, scheduleNext, setPhase]);

  const runIntro = useCallback(async () => {
    const e = engineRef.current;
    if (!e || !config) return;
    setPhase("intro");
    for (const t of e.introTurns(company?.name ?? null)) {
      if (phaseRef.current !== "intro") return;
      await play(t);
      await new Promise((r) => setTimeout(r, 350));
    }
    if (phaseRef.current !== "intro") return;
    if (config.prepSec > 0) {
      await play(e.prepStartTurn());
      setPrepLeft(config.prepSec);
      setPhase("prep");
    } else {
      await startDiscussion();
    }
  }, [config, company, play, startDiscussion, setPhase]);

  const skipIntro = () => {
    if (phaseRef.current !== "intro" || !config) return;
    cutOff();
    const e = engineRef.current!;
    // Make sure the topic itself is on record even when skipping.
    const turns = e.introTurns(company?.name ?? null);
    if (!e.records.some((r) => r.text.startsWith("Your topic is"))) e.record(turns[2], nowSec());
    sync();
    if (config.prepSec > 0) {
      setPrepLeft(config.prepSec);
      setPhase("prep");
    } else {
      void startDiscussion();
    }
  };

  /* ------------------------------------------------------ init */

  useEffect(() => {
    if (!hydrated || initRef.current) return;
    if (!config || !topic) {
      router.replace("/gd");
      return;
    }
    initRef.current = true;
    warmVoices();
    const engine = new GDEngine(topic, personas, moderators, config, settings.userName);
    engineRef.current = engine;
    brainRef.current = createGDBrain(engine, { apiKey: settings.apiKey, model: settings.model, preferAI: settings.preferAI });
    const ai = brainRef.current.usedAI;
    setTimeout(() => setUsedAI(ai), 0);
    startedAtRef.current = Date.now();
    // Give the voice list a moment to load before the first line.
    setTimeout(() => void runIntro(), 700);
    return () => {
      clearTimer();
      handleRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, config, topic]);

  // Prep countdown.
  useEffect(() => {
    if (phase !== "prep") return;
    const t = setInterval(() => {
      setPrepLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          void startDiscussion();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, startDiscussion]);

  // Discussion clock + moderator time checks.
  useEffect(() => {
    if (phase !== "discussion" || !config) return;
    const total = config.durationMin * 60;
    const t = setInterval(() => {
      if (!discussionStartRef.current) return;
      const left = Math.max(0, Math.round(total - (Date.now() - discussionStartRef.current) / 1000));
      setRemaining(left);
      const e = engineRef.current;
      if (!e) return;
      if (left <= total / 2 && left > 150 && !timeChecksRef.current.has("half")) {
        timeChecksRef.current.add("half");
        modQueueRef.current.push(e.timeCheckTurn(Math.round(left / 60)));
      }
      if (left <= 120 && !timeChecksRef.current.has("final")) {
        timeChecksRef.current.add("final");
        modQueueRef.current.push(e.timeCheckTurn(2));
      }
      if (left <= 0) {
        clearInterval(t);
        void timeUp();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, config, timeUp]);

  // Auto-send a spoken contribution once the candidate pauses.
  useEffect(() => {
    if (!autoSend || !rec.listening) return;
    const t = setInterval(() => {
      if (inputRef.current.trim() && !rec.interim && Date.now() - lastSegmentAtRef.current > 2300) submitRef.current?.();
    }, 400);
    return () => clearInterval(t);
  }, [autoSend, rec.listening, rec.interim]);

  /* ------------------------------------------------------ your turn */

  const submit = useCallback(() => {
    const e = engineRef.current;
    const text = inputRef.current.trim();
    const p = phaseRef.current;
    if (!e || !text || (p !== "discussion" && p !== "summary")) return;
    const interrupted = micInterruptRef.current ?? cutOff();
    micInterruptRef.current = undefined;
    rec.stop();
    clearTimer();
    versionRef.current++;
    const summaryRound = p === "summary";
    e.observeUser(text, nowSec(), interrupted, summaryRound);
    sync();
    setInput("");
    lastUserAtRef.current = Date.now();
    composingSinceRef.current = 0;
    awaitingUserRef.current = null;
    setAwaitingUser(null);
    setSpeaking({ id: YOU, name: e.userName, text, shown: text.length });
    setTimeout(() => setSpeaking((s) => (s?.id === YOU ? null : s)), Math.min(6000, 1200 + text.split(/\s+/).length * 120));
    if (e.nods.length) {
      setNodding(e.nods);
      setTimeout(() => setNodding([]), 1500);
    }
    if (summaryRound) {
      setTimeout(() => void closeDiscussionRef.current?.(), 1600);
      return;
    }
    scheduleNext(900 + Math.random() * 700);
  }, [cutOff, rec, scheduleNext, setInput, sync]);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const toggleMic = () => {
    if (rec.listening) {
      rec.stop();
      return;
    }
    // Starting to talk takes the floor: whoever is speaking stops.
    if (phaseRef.current === "discussion" || phaseRef.current === "summary") {
      micInterruptRef.current = cutOff();
      composingSinceRef.current = Date.now();
    }
    lastSegmentAtRef.current = Date.now();
    rec.start();
  };

  const endNow = () => {
    if (!confirm("End the group discussion now and see your report?")) return;
    cutOff();
    clearTimer();
    void finishSession();
  };

  /* ------------------------------------------------------ render */

  if (!hydrated || phase === "loading" || !config || !topic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" />
        <p className="text-sm text-muted">Setting up the discussion room…</p>
      </div>
    );
  }

  const youName = settings.userName || "You";
  const discussionStarted = records.some((r) => r.kind !== "moderator");
  const userSpeaking = speaking?.id === YOU || (rec.listening && !!rec.interim);
  const caption = settings.captions && speaking && speaking.shown > 0
    ? { name: speaking.id === YOU ? "You" : speaking.name, text: speaking.text.slice(0, speaking.shown), you: speaking.id === YOU }
    : null;
  const someoneTalking = speaking && speaking.id !== YOU;
  const inputDisabled = phase === "intro" || phase === "prep" || phase === "closing";
  const lastSpeaker = someoneTalking ? speaking!.name.split(" ")[0] : null;

  let banner: { tone: "info" | "ask" | "warn"; text: string } | null = null;
  if (phase === "prep") banner = { tone: "info", text: "Thinking time. Jot down 2–3 points and one fact or example. Decide whether you'll initiate." };
  else if (phase === "discussion" && !discussionStarted) banner = { tone: "ask", text: "The floor is open — start now if you want to initiate." };
  else if (awaitingUser) banner = { tone: "ask", text: `${awaitingUser} asked you directly — your turn to speak.` };
  else if (phase === "summary") banner = { tone: "ask", text: "The moderator wants a summary. Volunteer now — cover both sides and the main points, neutrally." };
  else if (someoneTalking && input.trim()) banner = { tone: "warn", text: `${lastSpeaker} is still speaking — sending now cuts in. Try "Sorry to interrupt…" or wait for the pause.` };

  return (
    <div className="flex min-h-screen flex-col bg-[#eceae5] text-[#1d2230] dark:bg-[#15171c] dark:text-[#e6e8ee]">
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white/70 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-black/30">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{company?.emoji ?? "🎓"} Group Discussion · {company?.name ?? "Campus placement"}</p>
          <p className="truncate text-[11px] text-muted">{topic.title}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-base font-bold tabular-nums",
            phase === "discussion" && remaining < 120 ? "bg-danger/15 text-danger" : "bg-primary-soft text-primary"
          )}>
            <Clock size={14} />
            {phase === "prep" ? fmtClock(prepLeft) : phase === "intro" ? "Intro" : phase === "summary" || phase === "closing" ? "Wrap-up" : fmtClock(remaining)}
          </div>
          <IconBtn on={settings.captions} onClick={() => update({ captions: !settings.captions })} title="Captions" a={<Captions size={15} />} b={<CaptionsOff size={15} />} />
          <IconBtn on={voiceOn} onClick={() => { setVoiceOn((v) => !v); }} title="Participants' voices" a={<Volume2 size={15} />} b={<VolumeX size={15} />} />
          <IconBtn on={settings.cameraOn} onClick={() => update({ cameraOn: !settings.cameraOn })} title="Your camera" a={<Camera size={15} />} b={<CameraOff size={15} />} />
          <IconBtn on={settings.roomView === "grid"} onClick={() => update({ roomView: settings.roomView === "grid" ? "room" : "grid" })}
            title={settings.roomView === "grid" ? "Switch to in-person room" : "Switch to video-call grid"} a={<Grid2x2 size={15} />} b={<SquareUser size={15} />} />
          <IconBtn on={panel === "notes"} onClick={() => setPanel(panel === "notes" ? null : "notes")} title="Your notes" a={<NotebookPen size={15} />} b={<NotebookPen size={15} />} />
          <Button variant="danger" size="sm" onClick={endNow}><StopCircle size={14} /> End</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Stage */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 p-2 md:p-3">
          <div className="w-full" style={{ maxWidth: settings.roomView === "grid" ? "min(100%, 1100px)" : "min(100%, calc(66vh * 16 / 9))" }}>
            <RoomStage
              layout="circle"
              view={settings.roomView}
              seats={seats}
              observers={observers}
              activeId={speaking?.id ?? null}
              nodding={nodding}
              lookDown={phase === "prep"}
              self={{ stream: cam.stream, status: cam.status, name: youName, speaking: userSpeaking }}
              board={{ kicker: "Topic", title: topic.title }}
              caption={caption}
            />
          </div>
          {cam.error && <p className="w-full max-w-3xl rounded-lg bg-danger/10 p-2 text-xs text-danger">{cam.error}</p>}

          {/* Composer */}
          <div className="w-full max-w-4xl">
            {banner && (
              <div className={cn(
                "mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs",
                banner.tone === "ask" ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" : banner.tone === "warn" ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-primary-soft text-primary"
              )}>
                <Hand size={14} className="shrink-0" /> {banner.text}
                {phase === "prep" && (
                  <button onClick={() => { setPrepLeft(0); void startDiscussion(); }} className="ml-auto rounded-lg bg-white/70 px-2 py-0.5 font-semibold text-primary dark:bg-black/30">I&apos;m ready</button>
                )}
                {phase === "intro" && <button onClick={skipIntro} className="ml-auto rounded-lg bg-white/70 px-2 py-0.5 font-semibold text-primary">Skip intro</button>}
              </div>
            )}
            {phase === "intro" && !banner && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-xs text-primary">
                The moderator is explaining the rules…
                <button onClick={skipIntro} className="ml-auto rounded-lg bg-white/70 px-2 py-0.5 font-semibold dark:bg-black/30">Skip intro</button>
              </div>
            )}
            {rec.listening && (
              <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                <span className="text-accent">{autoSend ? "Listening — pause for a couple of seconds and it sends." : "Listening — click the mic again when you're done."}</span>
                {rec.interim && <span className="italic text-muted">{rec.interim}</span>}
              </p>
            )}
            {rec.error && <p className="mb-1.5 rounded-lg bg-danger/10 p-2 text-xs text-danger">{rec.error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(ev) => setInput(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submit(); } }}
                placeholder={inputDisabled ? (phase === "prep" ? "Use the notes pad while you think…" : "Listen to the moderator…") : "Say your point — Enter to speak, Shift+Enter for a new line"}
                rows={2}
                disabled={inputDisabled}
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-primary/60 disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
              />
              {rec.supported && (
                <button onClick={toggleMic} disabled={inputDisabled}
                  className={cn("flex h-[52px] w-12 items-center justify-center rounded-xl disabled:opacity-40", rec.listening ? "bg-danger/20 text-danger" : "border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5")}
                  title={rec.listening ? "Stop" : "Speak (takes the floor)"}>
                  {rec.listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <Button onClick={submit} disabled={inputDisabled || !input.trim()} className="h-[52px]"><Send size={16} /></Button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
              {rec.supported && (
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={autoSend} onChange={(ev) => setAutoSend(ev.target.checked)} /> Auto-send spoken points when I pause
                </label>
              )}
              {thinking && <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> someone is about to speak…</span>}
              <span>{usedAI ? "AI group" : "Offline group"} · {config.difficulty}</span>
            </div>
          </div>
        </div>

        {/* Side panel: transcript / notes */}
        {panel && (
          <aside className="flex max-h-[45vh] w-full flex-col border-t border-black/10 bg-white/60 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0 dark:border-white/10 dark:bg-black/20">
            <div className="flex items-center gap-1 border-b border-black/10 p-2 dark:border-white/10">
              <button onClick={() => setPanel("transcript")} className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold", panel === "transcript" ? "bg-primary-soft text-primary" : "text-muted")}>Transcript</button>
              <button onClick={() => setPanel("notes")} className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold", panel === "notes" ? "bg-primary-soft text-primary" : "text-muted")}>Notes</button>
              <button onClick={() => setPanel(null)} className="ml-auto text-muted hover:text-foreground" aria-label="Close panel"><X size={14} /></button>
            </div>
            {panel === "transcript" ? <Transcript records={records} youName={youName} /> : (
              <textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder={"Your rough sheet — points, facts, who said what.\n(Not scored.)"}
                className="flex-1 resize-none bg-transparent p-3 text-sm outline-none" />
            )}
          </aside>
        )}
        {!panel && (
          <button onClick={() => setPanel("transcript")} className="fixed bottom-3 right-3 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold shadow dark:bg-black/50">Transcript</button>
        )}
      </div>
    </div>
  );
}

function Transcript({ records, youName }: { records: GDRecord[]; youName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [records.length]);
  return (
    <div ref={ref} className="flex-1 space-y-2 overflow-y-auto p-3">
      {records.map((r, i) => (
        <div key={i} className={cn("rounded-xl px-2.5 py-1.5 text-xs leading-relaxed", r.speakerId === YOU ? "bg-primary/10" : r.kind === "moderator" ? "bg-amber-500/10" : "bg-black/[0.04] dark:bg-white/[0.04]")}>
          <p className="font-semibold">
            {r.speakerId === YOU ? `You (${youName})` : r.name}
            {r.kind === "moderator" && <span className="font-normal text-muted"> · moderator</span>}
            {r.interrupted && <span className="font-normal text-amber-600"> · cut in</span>}
          </p>
          <p>{r.text}{r.cutOff ? " —" : ""}</p>
        </div>
      ))}
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
