"use client";

import { useState } from "react";
import { Camera, CameraOff, Headphones, Lightbulb, Mic, Volume2, VolumeX } from "lucide-react";
import { SelfView } from "./SelfView";
import { useCamera } from "@/lib/camera";
import { useSpeechRecognition } from "@/lib/speech";
import { speakAs, voiceFor, warmVoices } from "@/lib/voices";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

/**
 * The pre-room check: see yourself, test the microphone, hear a voice — like
 * the lobby of a video call. The camera choice is remembered in settings.
 */
export function CameraCheck({ name }: { name: string }) {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const cam = useCamera(settings.cameraOn);
  const [heard, setHeard] = useState("");
  const rec = useSpeechRecognition((t) => setHeard((h) => (h + " " + t).trim().slice(-140)));
  const [playing, setPlaying] = useState(false);

  const testVoice = () => {
    warmVoices();
    setPlaying(true);
    speakAs(
      `Hello ${name.split(/\s+/)[0] || "there"}, can you hear me clearly? This is how the panel will sound.`,
      voiceFor("mod-kavitha", "f", "in"),
      { onEnd: () => setPlaying(false) }
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
      <div>
        <SelfView stream={cam.stream} status={cam.status} name={name} speaking={rec.listening && !!rec.interim} framing className="aspect-video w-full" />
        {cam.error && <p className="mt-2 rounded-lg bg-danger/10 p-2 text-xs text-danger">{cam.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => update({ cameraOn: !settings.cameraOn })}
            className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium", settings.cameraOn ? "bg-primary-soft text-primary" : "glass text-muted")}
          >
            {settings.cameraOn ? <Camera size={14} /> : <CameraOff size={14} />} {settings.cameraOn ? "Camera on" : "Camera off"}
          </button>
          {rec.supported && (
            <button
              onClick={() => (rec.listening ? rec.stop() : rec.start())}
              className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium", rec.listening ? "bg-danger/15 text-danger" : "glass")}
            >
              <Mic size={14} /> {rec.listening ? "Stop mic test" : "Test microphone"}
            </button>
          )}
          <button onClick={testVoice} disabled={playing} className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-60">
            {playing ? <VolumeX size={14} /> : <Volume2 size={14} />} {playing ? "Playing…" : "Test speakers"}
          </button>
        </div>
        {(rec.listening || heard) && (
          <p className="mt-2 rounded-lg bg-primary-soft/40 p-2 text-xs">
            <span className="font-semibold">Heard:</span> {heard || <span className="italic text-muted">say something…</span>}
            {rec.interim && <span className="italic text-muted"> {rec.interim}</span>}
          </p>
        )}
        {rec.error && <p className="mt-2 rounded-lg bg-danger/10 p-2 text-xs text-danger">{rec.error}</p>}
      </div>

      <div className="space-y-2 text-sm">
        <p className="font-semibold">Before you walk in</p>
        <Tip icon={<Lightbulb size={14} />} text="Sit somewhere quiet and well lit — light in front of you, not behind. Keep your face inside the oval." />
        <Tip icon={<Headphones size={14} />} text="Use headphones if you'll answer by voice, so the microphone doesn't pick up the other speakers." />
        <Tip icon={<Camera size={14} />} text="Look at the camera when you speak, sit upright, and keep your hands visible — assessors notice body language." />
        <p className="pt-1 text-[11px] text-muted">Your camera stays on this device. Nothing is recorded or uploaded.</p>
      </div>
    </div>
  );
}

function Tip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="glass flex gap-2 rounded-xl p-2.5 text-xs leading-relaxed">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
