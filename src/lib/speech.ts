"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorLike {
  error?: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export type VoiceStatus = "idle" | "starting" | "listening" | "reconnecting" | "error";

/**
 * Speech-to-text for long, pause-heavy interview answers.
 *
 * Browsers end a recognition session on their own after a short silence. Naively
 * treating that as "the user finished" truncates answers at the first pause, so
 * a session here is a *continuous dictation*: when the engine ends we start a
 * new one and keep going until the user explicitly stops.
 *
 * Edge/Chromium specifics that this handles:
 *  - `start()` throws InvalidStateError if called while the previous instance is
 *    still tearing down, so we abort the old one and back off before respawning.
 *  - Repeated fast failures are backed off progressively instead of hot-looping.
 *  - A watchdog respawns if a session dies without firing `onend`.
 *  - `service-not-allowed` on Windows usually means the OS-level "Online speech
 *    recognition" setting is off, which we surface explicitly rather than
 *    failing silently.
 */
export function useSpeechRecognition(onSegment?: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const backoffRef = useRef(300);
  const lastActivityRef = useRef(0);
  const sessionStartRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const respawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gotResultRef = useRef(false);
  const lastSegmentRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;

  const teardown = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    rec.onstart = null;
    rec.onresult = null;
    rec.onend = null;
    rec.onerror = null;
    try {
      rec.abort ? rec.abort() : rec.stop();
    } catch {
      /* already dead */
    }
  }, []);

  /** Schedule exactly one respawn; never let restart chains multiply. */
  const scheduleRespawn = useCallback((delay: number) => {
    if (respawnTimerRef.current) return;
    respawnTimerRef.current = setTimeout(() => {
      respawnTimerRef.current = null;
      if (shouldListenRef.current) spawnRef.current?.();
    }, delay);
  }, []);

  // spawn is self-referential via scheduleRespawn, so route through a ref.
  const spawnRef = useRef<(() => void) | null>(null);

  const spawn = useCallback(() => {
    if (!shouldListenRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    // Hard floor on respawn rate. Real sessions last seconds, so this never
    // bites in normal use — it just bounds churn if an engine cycles rapidly.
    const MIN_SPAWN_GAP = 700;
    const since = Date.now() - lastSpawnRef.current;
    if (since < MIN_SPAWN_GAP) {
      scheduleRespawn(MIN_SPAWN_GAP - since);
      return;
    }
    lastSpawnRef.current = Date.now();

    // Edge throws if a previous instance is still alive — clear it first.
    teardown();

    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      sessionStartRef.current = Date.now();
      gotResultRef.current = false;
      lastActivityRef.current = Date.now();
      setStatus("listening");
    };

    rec.onresult = (e) => {
      lastActivityRef.current = Date.now();
      gotResultRef.current = true;
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const chunk = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const t = chunk.trim();
          // Some engines re-emit the tail phrase when a session restarts;
          // drop an identical segment repeated within a couple of seconds.
          const dup =
            t === lastSegmentRef.current.text && Date.now() - lastSegmentRef.current.at < 2500;
          if (t && !dup) {
            lastSegmentRef.current = { text: t, at: Date.now() };
            onSegmentRef.current?.(t);
          }
        } else {
          interimText += chunk;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      const kind = e?.error ?? "";
      lastActivityRef.current = Date.now();
      if (kind === "not-allowed") {
        shouldListenRef.current = false;
        setStatus("error");
        setError("Microphone blocked. Click the padlock in the address bar and allow microphone access, then try again.");
      } else if (kind === "service-not-allowed") {
        shouldListenRef.current = false;
        setStatus("error");
        setError(
          "Windows is blocking speech recognition. Open Settings → Privacy & security → Speech and turn on 'Online speech recognition', then reload this page. (You can always type your answer instead.)"
        );
      } else if (kind === "audio-capture") {
        shouldListenRef.current = false;
        setStatus("error");
        setError("No microphone detected. Check your input device, or type your answer instead.");
      }
      // 'no-speech', 'aborted', 'network' are transient — onend will respawn.
    };

    rec.onend = () => {
      setInterim("");
      if (!shouldListenRef.current) {
        setStatus("idle");
        return;
      }
      // A session that ran a healthy length (or produced speech) means the
      // engine is fine and we can restart promptly. A session that died
      // instantly means something is wrong — back off so we don't hot-loop
      // spawning recognition instances.
      const lasted = Date.now() - sessionStartRef.current;
      if (lasted > 1200 || gotResultRef.current) {
        backoffRef.current = 300;
      } else {
        backoffRef.current = Math.min(backoffRef.current * 1.8, 5000);
      }
      setStatus("reconnecting");
      scheduleRespawn(backoffRef.current);
    };

    recRef.current = rec;
    setStatus("starting");
    lastActivityRef.current = Date.now();
    try {
      rec.start();
    } catch {
      // Edge throws InvalidStateError if the previous session is still closing.
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 1.8, 5000);
      scheduleRespawn(delay);
    }
  }, [teardown, scheduleRespawn]);

  spawnRef.current = spawn;

  const start = useCallback(() => {
    if (shouldListenRef.current) return;
    setError(null);
    shouldListenRef.current = true;
    backoffRef.current = 300;
    lastSegmentRef.current = { text: "", at: 0 };
    setStatus("starting");
    spawn();

    // Watchdog: some engines die without firing onend. If nothing has happened
    // for a while but we should be listening, restart the session.
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = setInterval(() => {
      if (!shouldListenRef.current) return;
      if (Date.now() - lastActivityRef.current > 8000) {
        lastActivityRef.current = Date.now();
        spawn();
      }
    }, 4000);
  }, [spawn]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (respawnTimerRef.current) {
      clearTimeout(respawnTimerRef.current);
      respawnTimerRef.current = null;
    }
    setInterim("");
    setStatus("idle");
    teardown();
  }, [teardown]);

  useEffect(
    () => () => {
      shouldListenRef.current = false;
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      if (respawnTimerRef.current) clearTimeout(respawnTimerRef.current);
      teardown();
    },
    [teardown]
  );

  return {
    listening: status === "listening" || status === "starting" || status === "reconnecting",
    status,
    interim,
    error,
    start,
    stop,
    supported: speechSupported(),
  };
}

/** Speak text via the Web Speech API. Best-effort; silent if unsupported. */
export function speak(text: string, onEnd?: () => void, voiceHint?: "female" | "male") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ""));
  u.rate = 1.02;
  u.pitch = voiceHint === "male" ? 0.9 : 1.05;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length && voiceHint) {
    const match = voices.find((v) =>
      voiceHint === "female"
        ? /female|samantha|victoria|zira|susan|karen|aria|jenny/i.test(v.name)
        : /male|david|daniel|alex|mark|rishi|guy|ryan/i.test(v.name)
    );
    if (match) u.voice = match;
  }
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
