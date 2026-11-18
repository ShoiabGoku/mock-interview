"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Avatar, type AvatarMood } from "./Avatar";
import { SelfView } from "./SelfView";
import type { Look } from "@/lib/people";
import type { CameraStatus } from "@/lib/camera";
import { cn } from "@/lib/utils";

export interface Seat {
  id: string;
  name: string;
  role?: string;
  look: Look;
  mood?: AvatarMood;
  /** A short live note shown above the head (interview panel notes). */
  note?: string;
}

export interface SelfInfo {
  stream: MediaStream | null;
  status: CameraStatus;
  name: string;
  speaking: boolean;
}

export type RoomView = "room" | "grid";

/**
 * The room the candidate is sitting in.
 *
 * "room" view is an in-person setting: a quiet, daylight-lit meeting room
 * with the interview panel behind a desk, or the group seated round an oval
 * table with name cards — and your own camera in the corner, as if you were
 * sitting at the table. "grid" view is the online version: everyone in their
 * own video tile, like a video call. Both show live captions for whoever is
 * speaking, and people turn to look at the speaker.
 */
export function RoomStage({
  layout,
  view,
  seats,
  observers = [],
  activeId,
  nodding = [],
  lookDown = false,
  self,
  board,
  caption,
  className,
}: {
  layout: "panel" | "circle";
  view: RoomView;
  seats: Seat[];
  observers?: Seat[];
  activeId: string | null;
  nodding?: string[];
  lookDown?: boolean;
  self: SelfInfo;
  board?: { title: string; kicker?: string };
  caption?: { name: string; text: string; you?: boolean } | null;
  className?: string;
}) {
  if (view === "grid") {
    return (
      <GridView
        seats={seats}
        observers={observers}
        activeId={activeId}
        nodding={nodding}
        lookDown={lookDown}
        self={self}
        caption={caption}
        className={className}
      />
    );
  }

  const placed = layout === "panel" ? placePanel(seats.length) : placeCircle(seats.length);
  const active = placed.find((_, i) => seats[i]?.id === activeId);
  const youSpeaking = activeId === "you" || self.speaking;

  const gazeFor = (x: number, isSpeaker: boolean) => {
    if (active && !youSpeaking && !isSpeaker) return clamp((active.x - x) / 22, -1, 1);
    // Speaker, or nobody / you speaking: look toward the candidate (camera).
    return clamp((50 - x) / 40, -1, 1) * (isSpeaker ? 0.5 : 0.85);
  };

  return (
    <div className={cn("relative aspect-[16/9] w-full overflow-hidden rounded-2xl ring-1 ring-black/10 room-wall", className)}>
      {/* Window with daylight */}
      <div className="room-window absolute left-[5%] top-[7%] h-[44%] w-[24%] rounded-md" />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-[45%] bg-gradient-to-r from-white/25 to-transparent" />

      {/* Board / plaque on the back wall */}
      {board && (
        layout === "circle" ? (
          <div className="absolute left-[37%] top-[6%] flex h-[24%] w-[30%] flex-col justify-center rounded-md border-[5px] border-[#c9cdd2] bg-[#fbfbf8] px-[2%] text-center shadow-md">
            {board.kicker && <p className="text-[clamp(6px,0.9vw,11px)] font-semibold uppercase tracking-widest text-[#5b6b85]">{board.kicker}</p>}
            <p className="mt-0.5 line-clamp-3 font-[cursive] text-[clamp(8px,1.35vw,17px)] font-semibold leading-tight text-[#1d3c78]">{board.title}</p>
          </div>
        ) : (
          <div className="absolute left-1/2 top-[8%] -translate-x-1/2 rounded-lg bg-white/70 px-[2.2%] py-[0.8%] text-center shadow-sm backdrop-blur">
            <p className="text-[clamp(8px,1.4vw,18px)] font-semibold tracking-tight text-[#2a3142]">{board.title}</p>
            {board.kicker && <p className="text-[clamp(6px,0.8vw,10px)] uppercase tracking-widest text-[#6b7385]">{board.kicker}</p>}
          </div>
        )
      )}

      <Plant />

      {/* Floor */}
      <div className="absolute bottom-0 left-0 h-[22%] w-full bg-gradient-to-b from-[#c7bfb2] to-[#b4ab9c]" />

      {/* People (behind the table) */}
      {seats.map((s, i) => {
        const p = placed[i];
        const isSpeaker = s.id === activeId;
        return (
          <div
            key={s.id}
            className="absolute"
            style={{ left: `${p.x}%`, bottom: `${100 - p.y}%`, height: `${p.h}%`, transform: "translateX(-50%)", zIndex: Math.round(p.y) }}
          >
            {isSpeaker && (
              <div className="pointer-events-none absolute -inset-x-[20%] bottom-0 top-[10%] rounded-full bg-[radial-gradient(closest-side,rgba(255,250,225,0.65),transparent)]" />
            )}
            <Avatar
              id={s.id}
              look={s.look}
              speaking={isSpeaker}
              mood={s.mood}
              gaze={gazeFor(p.x, isSpeaker)}
              nodding={nodding.includes(s.id)}
              lookDown={lookDown && !isSpeaker}
              className="relative h-full w-auto drop-shadow-[0_6px_10px_rgba(40,30,20,0.18)]"
            />
            <AnimatePresence>
              {s.note && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-[2%] left-1/2 w-max max-w-[180%] -translate-x-1/2 -translate-y-full rounded-lg bg-white/90 px-2 py-0.5 text-[clamp(7px,0.85vw,11px)] italic text-[#3b4252] shadow"
                >
                  📝 {s.note}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Table */}
      {layout === "panel" ? (
        <div className="room-table absolute bottom-[6%] left-[8%] h-[22%] w-[84%] rounded-t-[14px] rounded-b-md" style={{ zIndex: 200 }} />
      ) : (
        <div className="room-table absolute left-1/2 top-[71%] h-[32%] w-[86%] -translate-x-1/2 rounded-[50%]" style={{ zIndex: 200 }} />
      )}

      {/* Name cards on the table */}
      {seats.map((s, i) => {
        const p = placed[i];
        const isSpeaker = s.id === activeId;
        return (
          <div
            key={`tent-${s.id}`}
            className={cn(
              "room-tent absolute rounded-[3px] px-[0.7%] py-[0.25%] text-center leading-tight",
              isSpeaker && "ring-2 ring-emerald-500/70"
            )}
            style={{ left: `${p.x}%`, top: `${p.tentY}%`, zIndex: 210, transform: `translateX(-50%) scale(${p.scale})` }}
          >
            <p className="whitespace-nowrap text-[clamp(7px,0.95vw,12px)] font-semibold text-[#222731]">{s.name}</p>
            {s.role && <p className="whitespace-nowrap text-[clamp(5px,0.7vw,9px)] text-[#5d6575]">{s.role}</p>}
          </div>
        );
      })}

      {/* Assessors watching from the side */}
      {observers.length > 0 && (
        <div className="absolute left-[1.2%] top-[2%] flex items-center gap-1 rounded-xl bg-black/35 px-1.5 py-1 backdrop-blur" style={{ zIndex: 220 }}>
          <span className="px-1 text-[clamp(6px,0.75vw,10px)] font-semibold uppercase tracking-wider text-white/80">Assessors</span>
          {observers.map((o) => (
            <div key={o.id} className={cn("relative h-[clamp(26px,4.2vw,52px)] overflow-hidden rounded-lg bg-white/80", o.id === activeId && "speaker-ring")} title={`${o.name} · ${o.role ?? ""}`}>
              <Avatar id={o.id} look={o.look} speaking={o.id === activeId} gaze={0.3} className="h-[135%] w-auto -translate-y-[6%]" />
            </div>
          ))}
        </div>
      )}

      {/* Your camera */}
      <SelfView
        stream={self.stream}
        status={self.status}
        name={self.name}
        speaking={self.speaking}
        className="absolute right-[1.5%] top-[3%] z-[240] aspect-video w-[22%]"
      />

      <Caption caption={caption} />
    </div>
  );
}

function GridView({
  seats,
  observers,
  activeId,
  nodding,
  lookDown,
  self,
  caption,
  className,
}: {
  seats: Seat[];
  observers: Seat[];
  activeId: string | null;
  nodding: string[];
  lookDown: boolean;
  self: SelfInfo;
  caption?: { name: string; text: string; you?: boolean } | null;
  className?: string;
}) {
  const all = [...observers.map((o) => ({ ...o, observer: true })), ...seats.map((s) => ({ ...s, observer: false }))];
  const n = all.length + 1;
  const cols = n <= 2 ? 2 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  return (
    <div className={cn("relative w-full rounded-2xl bg-[#202227] p-2", className)}>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {all.map((s, i) => {
          const isSpeaker = s.id === activeId;
          return (
            <div key={s.id} className={cn("relative aspect-video overflow-hidden rounded-xl", `tile-bg-${i % 6}`, isSpeaker && "speaker-ring")}>
              <div className="absolute inset-x-0 bottom-0 flex h-[92%] justify-center">
                <Avatar id={s.id} look={s.look} speaking={isSpeaker} mood={s.mood} gaze={0} nodding={nodding.includes(s.id)}
                  lookDown={lookDown && !isSpeaker} className="h-full w-auto" />
              </div>
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {s.name}{s.observer ? " · Assessor" : s.role ? ` · ${s.role}` : ""}
              </span>
              {s.note && (
                <span className="absolute left-1.5 top-1.5 max-w-[90%] truncate rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] italic text-[#333]">📝 {s.note}</span>
              )}
            </div>
          );
        })}
        <SelfView stream={self.stream} status={self.status} name={self.name} speaking={self.speaking} className="aspect-video" />
      </div>
      <Caption caption={caption} grid />
    </div>
  );
}

function Caption({ caption, grid = false }: { caption?: { name: string; text: string; you?: boolean } | null; grid?: boolean }) {
  return (
    <AnimatePresence>
      {caption && caption.text && (
        <motion.div
          key={caption.name}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            "pointer-events-none z-[230] rounded-lg bg-black/70 px-3 py-1.5 text-white shadow-lg",
            grid ? "mx-auto mt-2 w-fit max-w-[90%]" : "absolute bottom-[3%] left-1/2 w-max max-w-[82%] -translate-x-1/2"
          )}
        >
          <span className={cn("mr-1.5 text-[clamp(9px,1vw,12px)] font-semibold", caption.you ? "text-sky-300" : "text-emerald-300")}>{caption.name}</span>
          <span className="text-[clamp(10px,1.15vw,14px)] leading-snug">{tail(caption.text, 190)}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Plant() {
  return (
    <svg viewBox="0 0 60 120" className="absolute bottom-[18%] right-[1%] h-[42%] w-auto" style={{ zIndex: 5 }} aria-hidden>
      <path d="M18 92 L42 92 L39 118 L21 118 Z" fill="#8a7a68" />
      <path d="M17 90 L43 90 L43 95 L17 95 Z" fill="#9b8b78" />
      <g fill="#5d7f55">
        <path d="M30 92 C28 70 14 60 6 48 C20 52 30 66 31 90 Z" />
        <path d="M30 92 C32 66 44 52 56 44 C48 60 36 70 31 90 Z" fill="#6b8f61" />
        <path d="M30 92 C26 60 24 34 30 10 C36 34 34 60 31 92 Z" fill="#4f6f48" />
        <path d="M30 92 C22 76 8 74 2 70 C14 66 26 76 31 90 Z" fill="#6b8f61" />
        <path d="M30 92 C40 78 52 78 58 74 C50 86 38 88 31 92 Z" />
      </g>
    </svg>
  );
}

/* ---------- seating geometry (percent of stage) ---------- */

interface Place {
  x: number;
  /** Bottom of the avatar, % from top. */
  y: number;
  /** Avatar height, % of stage height. */
  h: number;
  tentY: number;
  scale: number;
}

function placePanel(n: number): Place[] {
  const span = n <= 2 ? 34 : n === 3 ? 50 : n === 4 ? 60 : 68;
  return Array.from({ length: n }, (_, i) => {
    const x = n === 1 ? 50 : 50 - span / 2 + (span * i) / (n - 1);
    return { x, y: 76, h: 52, tentY: 73, scale: 1 };
  });
}

/** Round an oval table: back-centre seats are further away (smaller, higher). */
function placeCircle(n: number): Place[] {
  const from = n <= 4 ? 150 : 158;
  const to = 180 - from;
  return Array.from({ length: n }, (_, i) => {
    const theta = ((n === 1 ? 90 : from - ((from - to) * i) / (n - 1)) * Math.PI) / 180;
    const x = 50 + 41 * Math.cos(theta);
    // Far edge of the table ellipse (centre 50/87, radii 43/16) at this x.
    const edge = 87 - 16 * Math.sqrt(Math.max(0, 1 - ((x - 50) / 43) ** 2));
    const depth = clamp((edge - 71) / 9, 0, 1); // 0 = far back, 1 = near side
    const scale = 0.82 + 0.3 * depth;
    return { x, y: edge + 2.5, h: 40 * scale, tentY: edge + 0.8, scale };
  });
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function tail(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(s.length - max);
  return "…" + cut.slice(cut.indexOf(" ") + 1);
}
