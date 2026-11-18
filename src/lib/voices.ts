"use client";

import { speakable } from "./speech";
import { hashOf, type Gender } from "./people";

/**
 * Distinct, stable voices for everyone in the room.
 *
 * A group discussion with six people who all sound identical stops feeling
 * like a room, so each person is mapped to one of the browser's installed
 * voices that matches their gender (and an Indian-English voice when one is
 * available and the person is Indian), plus a small personal pitch and rate
 * offset so two people sharing a voice still sound different.
 */

export interface VoiceProfile {
  voice?: SpeechSynthesisVoice;
  pitch: number;
  rate: number;
}

const FEMALE = /female|woman|zira|aria|jenny|neerja|heera|swara|kalpana|sonia|libby|susan|hazel|samantha|karen|moira|tessa|veena|victoria|fiona|serena|ava|allison|emma|michelle|natasha|clara|sara|nancy|elizabeth|catherine|linda/i;
const MALE = /\bmale\b|\bman\b|david|mark|guy|ryan|prabhat|ravi|george|daniel|alex|rishi|christopher|eric|davis|brian|thomas|oliver|james|william|tom|fred|aaron|arthur|liam|andrew|roger|steffan|connor|mitchell/i;

let cache: SpeechSynthesisVoice[] = [];
function voices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) cache = v;
  return cache;
}

/** Ask the browser to load its voice list early (Chrome loads it lazily). */
export function warmVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  voices();
  window.speechSynthesis.onvoiceschanged = () => voices();
}

export function voiceFor(personId: string, gender: Gender, accent: "in" | "intl" = "intl"): VoiceProfile {
  const h = hashOf(personId);
  const all = voices().filter((v) => /^en[-_]/i.test(v.lang) || /english/i.test(v.name));
  const genderRe = gender === "f" ? FEMALE : MALE;
  const otherRe = gender === "f" ? MALE : FEMALE;
  const byGender = all.filter((v) => genderRe.test(v.name) && !otherRe.test(v.name.replace(genderRe, "")));
  const indian = byGender.filter((v) => /en[-_]IN/i.test(v.lang) || /india/i.test(v.name));
  // Natural/online voices sound far better than the old desktop ones.
  const natural = (list: SpeechSynthesisVoice[]) => {
    const n = list.filter((v) => /natural|online|neural|google/i.test(v.name));
    return n.length ? n : list;
  };
  let pool: SpeechSynthesisVoice[] = [];
  if (accent === "in" && indian.length && h % 3 !== 0) pool = natural(indian);
  if (!pool.length) pool = natural(byGender);
  if (!pool.length) pool = all;

  const base = gender === "f" ? 1.06 : 0.9;
  return {
    voice: pool.length ? pool[h % pool.length] : undefined,
    pitch: +(base + (((h >> 4) % 13) - 6) * 0.018).toFixed(3),
    rate: +(1.0 + (((h >> 9) % 9) - 4) * 0.018).toFixed(3),
  };
}

export interface SpeechHandle {
  cancel: () => void;
}

/**
 * Speak `text` as `profile`, sentence by sentence (long utterances get cut off
 * in Chrome, and never fire `end`). `onProgress` receives how many characters
 * of the ORIGINAL text have been spoken so far, for live captions. A watchdog
 * finishes the turn if the engine goes quiet without an `end` event, so a
 * flaky voice can never stall the room.
 */
export function speakAs(
  text: string,
  profile: VoiceProfile,
  cb: { onStart?: () => void; onProgress?: (chars: number) => void; onEnd?: () => void } = {}
): SpeechHandle {
  let done = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const finish = () => {
    if (done) return;
    done = true;
    if (watchdog) clearTimeout(watchdog);
    cb.onProgress?.(text.length);
    cb.onEnd?.();
  };

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    setTimeout(finish, 0);
    return { cancel: () => { done = true; } };
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  // Sentences with their offsets in the original text.
  const parts: { s: string; at: number }[] = [];
  const re = /[^.!?…]+[.!?…]*["')\]]*\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].trim()) parts.push({ s: m[0], at: m.index });
  }
  if (!parts.length) parts.push({ s: text, at: 0 });

  const words = text.split(/\s+/).length;
  const armWatchdog = (ms: number) => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(finish, ms);
  };
  // ~2.6 words/second at rate 1, plus generous slack.
  armWatchdog((words / (2.6 * profile.rate)) * 1000 + 4000);

  let started = false;
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(speakable(p.s));
    if (profile.voice) u.voice = profile.voice;
    u.pitch = profile.pitch;
    u.rate = profile.rate;
    u.onstart = () => {
      if (done) return;
      if (!started) {
        started = true;
        cb.onStart?.();
      }
      cb.onProgress?.(p.at);
      // Per-sentence watchdog, in case one sentence hangs.
      armWatchdog((p.s.split(/\s+/).length / (2.4 * profile.rate)) * 1000 + 3500);
    };
    u.onboundary = (e) => {
      if (done || e.name === "sentence") return;
      // charIndex refers to the spoken (symbol-expanded) string; clamp so
      // captions never run past this sentence.
      cb.onProgress?.(Math.min(p.at + e.charIndex, p.at + p.s.length));
    };
    u.onend = () => {
      if (done) return;
      cb.onProgress?.(p.at + p.s.length);
      if (i === parts.length - 1) finish();
    };
    u.onerror = () => {
      if (i === parts.length - 1) finish();
    };
    synth.speak(u);
  });

  return {
    cancel: () => {
      done = true;
      if (watchdog) clearTimeout(watchdog);
      synth.cancel();
    },
  };
}

/**
 * Reveal `text` at reading pace when the voice is off, so captions and turn
 * timing still feel like someone is talking.
 */
export function readAloudSilently(
  text: string,
  cb: { onProgress?: (chars: number) => void; onEnd?: () => void },
  wordsPerSec = 3.6
): SpeechHandle {
  const tokens = text.split(/(\s+)/);
  let i = 0;
  let chars = 0;
  let done = false;
  const step = () => {
    if (done) return;
    if (i >= tokens.length) {
      done = true;
      setTimeout(() => cb.onEnd?.(), 650);
      return;
    }
    chars += tokens[i].length + (tokens[i + 1]?.length ?? 0);
    i += 2;
    cb.onProgress?.(chars);
    timer = setTimeout(step, 1000 / wordsPerSec);
  };
  let timer: ReturnType<typeof setTimeout> = setTimeout(step, 120);
  return {
    cancel: () => {
      done = true;
      clearTimeout(timer);
    },
  };
}
