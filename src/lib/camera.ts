"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "off" | "requesting" | "on" | "denied" | "unavailable" | "error";

/**
 * The user's webcam, for the self-view in the interview and group-discussion
 * rooms. Video only — speech-to-text opens the microphone separately, and
 * capturing audio here too can collide with it on some browsers.
 *
 * Nothing is recorded or uploaded: the stream goes straight into a <video>
 * element on this page and its tracks are stopped when the room closes.
 */
export function useCamera(wanted: boolean) {
  const [status, setStatus] = useState<CameraStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wantRef = useRef(wanted);
  useEffect(() => {
    wantRef.current = wanted;
  }, [wanted]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setStatus("off");
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      setError("This browser can't open a camera here. Camera access needs a secure (https) page in Chrome, Edge, Firefox or Safari.");
      return;
    }
    setStatus("requesting");
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" },
        audio: false,
      });
      // The room may have closed or the camera been switched off while the
      // permission prompt was open.
      if (!wantRef.current) {
        s.getTracks().forEach((t) => t.stop());
        setStatus("off");
        return;
      }
      streamRef.current = s;
      setStream(s);
      setStatus("on");
      s.getVideoTracks()[0]?.addEventListener("ended", () => {
        streamRef.current = null;
        setStream(null);
        setStatus("off");
      });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("denied");
        setError("Camera blocked. Click the camera icon in the address bar, allow access for this site, then turn the camera on again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setStatus("unavailable");
        setError("No camera found. Plug one in, or carry on without video — the room works either way.");
      } else if (name === "NotReadableError") {
        setStatus("error");
        setError("The camera is busy in another app (Zoom, Teams, the Camera app…). Close it and try again.");
      } else {
        setStatus("error");
        setError("Couldn't start the camera. You can carry on without video.");
      }
    }
  }, []);

  // Follow the on/off preference. Both paths settle asynchronously, after the
  // camera (an external system) has actually changed state.
  useEffect(() => {
    void Promise.resolve().then(wanted ? start : stop);
  }, [wanted, start, stop]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return { status, error, stream, start, stop };
}

/** Attach a MediaStream to a <video> element (ref callback friendly). */
export function attachStream(el: HTMLVideoElement | null, stream: MediaStream | null) {
  if (!el) return;
  if (el.srcObject !== stream) el.srcObject = stream;
  if (stream) void el.play().catch(() => undefined);
}
