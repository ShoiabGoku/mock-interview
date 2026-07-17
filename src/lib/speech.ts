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
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
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
 * Speech-to-text hook. Returns the live transcript and start/stop controls.
 * onFinal fires with the accumulated final transcript when the user stops.
 */
export function useSpeechRecognition(onFinal?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    finalRef.current = "";
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const finalText = finalRef.current.trim();
      if (finalText && onFinal) onFinal(finalText);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [onFinal]);

  useEffect(() => () => recRef.current?.stop(), []);

  return { listening, interim, start, stop, supported: speechSupported() };
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

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
  currentUtterance = u;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}
