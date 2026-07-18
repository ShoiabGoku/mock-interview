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

/**
 * Speech-to-text for long answers.
 *
 * Chrome ends a recognition session on its own after a short silence, which
 * previously truncated answers: the first pause ended dictation and everything
 * after it was lost. Here the session is treated as a *continuous* dictation —
 * when the browser ends it we transparently start a new one, and we only stop
 * for real when the user asks us to (or permission is denied).
 *
 * Finalized phrases are streamed to `onSegment` as they are recognized so the
 * answer box fills live rather than all at once at the end.
 */
export function useSpeechRecognition(onSegment?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;

  const spawn = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const chunk = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const t = chunk.trim();
          if (t) onSegmentRef.current?.(t);
        } else {
          interimText += chunk;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      const kind = e?.error ?? "";
      // Silence and transient aborts are normal during a long answer — onend
      // will respawn. Permission/hardware errors are terminal.
      if (kind === "not-allowed" || kind === "service-not-allowed") {
        shouldListenRef.current = false;
        setError("Microphone permission denied. Allow mic access to answer by voice.");
      } else if (kind === "audio-capture") {
        shouldListenRef.current = false;
        setError("No microphone found.");
      }
    };

    rec.onend = () => {
      setInterim("");
      if (shouldListenRef.current) {
        // Browser stopped on silence — keep dictation alive.
        setTimeout(() => {
          if (!shouldListenRef.current) return;
          try {
            spawn();
          } catch {
            /* a start is already in flight; ignore */
          }
        }, 150);
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* start() throws if one is already running; safe to ignore */
    }
  }, []);

  const start = useCallback(() => {
    if (shouldListenRef.current) return;
    setError(null);
    shouldListenRef.current = true;
    setListening(true);
    spawn();
  }, [spawn]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    setInterim("");
    setListening(false);
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(
    () => () => {
      shouldListenRef.current = false;
      try {
        recRef.current?.abort?.() ?? recRef.current?.stop();
      } catch {
        /* ignore */
      }
    },
    []
  );

  return { listening, interim, error, start, stop, supported: speechSupported() };
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
        ? /female|samantha|victoria|zira|susan|karen/i.test(v.name)
        : /male|david|daniel|alex|mark|rishi/i.test(v.name)
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
