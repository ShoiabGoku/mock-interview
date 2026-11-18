"use client";

import { useCallback } from "react";
import { CameraOff, Loader2 } from "lucide-react";
import { attachStream, type CameraStatus } from "@/lib/camera";
import { initials } from "@/lib/people";
import { cn } from "@/lib/utils";

/**
 * The candidate's own camera tile — mirrored, like every video-call app, so
 * moving left moves left on screen. Falls back to an initials tile when the
 * camera is off or blocked.
 */
export function SelfView({
  stream,
  status,
  name,
  speaking = false,
  className,
  showLabel = true,
  framing = false,
}: {
  stream: MediaStream | null;
  status: CameraStatus;
  name: string;
  speaking?: boolean;
  className?: string;
  showLabel?: boolean;
  /** Draw a face-framing guide (camera check). */
  framing?: boolean;
}) {
  const videoRef = useCallback((el: HTMLVideoElement | null) => attachStream(el, stream), [stream]);
  const live = status === "on" && stream;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#1b1d22] shadow-lg ring-1 ring-black/20",
        speaking && "speaker-ring",
        className
      )}
    >
      {live ? (
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2a2d35] to-[#1a1c21] text-white/80">
          {status === "requesting" ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-base font-semibold">
                {initials(name) || "You"}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-white/60">
                <CameraOff size={11} /> {status === "denied" ? "Camera blocked" : status === "unavailable" ? "No camera" : "Camera off"}
              </span>
            </>
          )}
        </div>
      )}

      {framing && live && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[72%] w-[38%] rounded-[50%] border-2 border-dashed border-white/60" />
        </div>
      )}

      {showLabel && (
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          You{name ? ` · ${name}` : ""}
        </span>
      )}
      {speaking && (
        <span className="absolute right-1.5 top-1.5 flex items-end gap-[2px] rounded-md bg-black/45 px-1.5 py-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-[3px] animate-pulse rounded-sm bg-emerald-400" style={{ height: 6 + i * 3, animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      )}
    </div>
  );
}
