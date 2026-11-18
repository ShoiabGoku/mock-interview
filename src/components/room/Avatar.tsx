"use client";

import { useId, useMemo } from "react";
import type { Look } from "@/lib/people";
import { hashOf } from "@/lib/people";

export type AvatarMood = "neutral" | "pleased" | "impressed" | "skeptical" | "concerned";

/**
 * A seated person, drawn in SVG: head and shoulders with a face that blinks,
 * breathes, turns toward whoever is talking, nods, moves its mouth while
 * speaking and shows a mood. Everything animates in CSS (see globals.css), so
 * a room full of them stays cheap.
 */
export function Avatar({
  id,
  look,
  speaking = false,
  mood = "neutral",
  gaze = 0,
  nodding = false,
  lookDown = false,
  className,
}: {
  id: string;
  look: Look;
  speaking?: boolean;
  mood?: AvatarMood;
  /** -1 (looking to their right/our left) … 1 (our right). */
  gaze?: number;
  nodding?: boolean;
  /** Reading or writing notes. */
  lookDown?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const h = useMemo(() => hashOf(id), [id]);
  const female = look.gender === "f";
  const skin = look.skin;
  const skinLight = shade(skin, 0.1);
  const skinDark = shade(skin, -0.16);
  const skinDeep = shade(skin, -0.3);
  const hair = look.hairColor;
  const browColor = look.age === "senior" ? shade(hair, -0.25) : shade(hair, -0.05);
  const lip = female ? shade(mix(skin, "#b4505a", 0.45), -0.05) : shade(mix(skin, "#8a4a42", 0.5), -0.1);
  const iris = ["#3b2618", "#4a2f1c", "#2c1d14", look.skin === "#f5d6c2" ? "#4d6a7a" : "#3f2a1b"][h % 4];

  const blinkDur = 3.6 + (h % 30) / 10; // 3.6–6.5 s
  const blinkDelay = (h % 17) / 5;
  const swayDur = 6 + (h % 40) / 10;
  const breatheDur = 4 + (h % 20) / 10;

  const gx = Math.max(-1, Math.min(1, gaze));
  const headTurn = `rotate(${(gx * 4).toFixed(2)}deg) translateX(${(gx * 1.5).toFixed(2)}px)${lookDown ? " rotate(0deg) translateY(2px)" : ""}`;
  const irisShift = `translate(${(gx * 2.2).toFixed(2)}px, ${lookDown ? 1.6 : 0}px)`;

  const face = female
    ? "M68 90 C68 60 83 49 100 49 C117 49 132 60 132 90 C132 113 119 131 100 134 C81 131 68 113 68 90 Z"
    : "M67 90 C67 60 82 48 100 48 C118 48 133 60 133 90 C133 115 121 134 100 137 C79 134 67 115 67 90 Z";

  const brows = {
    neutral: ["M80 80 Q87 76.5 94 79", "M106 79 Q113 76.5 120 80"],
    pleased: ["M80 79 Q87 75 94 78", "M106 78 Q113 75 120 79"],
    impressed: ["M80 77 Q87 72.5 94 76", "M106 76 Q113 72.5 120 77"],
    skeptical: ["M80 75.5 Q87 70.5 94 75", "M106 80 Q113 78.5 120 80.5"],
    concerned: ["M80 80.5 Q87 79 94 76.5", "M106 76.5 Q113 79 120 80.5"],
  }[mood];
  const mouthPath = {
    neutral: "M90 119.5 Q100 122.5 110 119.5",
    pleased: "M89 118.5 Q100 125.5 111 118.5",
    impressed: "M88.5 118 Q100 127 111.5 118",
    skeptical: "M90 120.5 Q100 121.5 110 117.5",
    concerned: "M90 121.5 Q100 118.5 110 121.5",
  }[mood];

  return (
    <svg viewBox="0 0 200 230" className={className} aria-hidden>
      <defs>
        <radialGradient id={`face-${uid}`} cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="70%" stopColor={skin} />
          <stop offset="100%" stopColor={skinDark} />
        </radialGradient>
        <linearGradient id={`cloth-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(look.outfitColor, 0.08)} />
          <stop offset="100%" stopColor={shade(look.outfitColor, -0.18)} />
        </linearGradient>
        <linearGradient id={`hair-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(hair, 0.12)} />
          <stop offset="100%" stopColor={shade(hair, -0.12)} />
        </linearGradient>
      </defs>

      <g className="av-breathe" style={{ animationDuration: `${breatheDur}s` }}>
        {/* Hair that falls behind the head and shoulders */}
        <HairBack style={look.hair} fill={`url(#hair-${uid})`} />

        {/* Torso */}
        <Torso look={look} cloth={`url(#cloth-${uid})`} skin={skin} skinDark={skinDark} />

        {/* Neck */}
        <path d="M86 122 L86 154 C92 160 108 160 114 154 L114 122 Z" fill={skin} />
        <path d="M86 128 C92 140 108 140 114 128 L114 136 C108 146 92 146 86 136 Z" fill={skinDark} opacity={0.55} />

        {/* Head: gaze turn → idle sway → nod */}
        <g style={{ transform: headTurn, transformBox: "view-box", transformOrigin: "100px 140px", transition: "transform 0.6s ease" }}>
          <g className="av-sway" style={{ animationDuration: `${swayDur}s` }}>
            <g className={nodding ? "av-nod" : speaking ? "av-talk-head" : undefined}>
              {/* Ears */}
              <ellipse cx="66.5" cy="95" rx="5.2" ry="9" fill={skinDark} />
              <ellipse cx="133.5" cy="95" rx="5.2" ry="9" fill={skinDark} />
              <ellipse cx="67" cy="95" rx="2.6" ry="5.5" fill={skinDeep} opacity={0.35} />
              <ellipse cx="133" cy="95" rx="2.6" ry="5.5" fill={skinDeep} opacity={0.35} />

              {/* Face */}
              <path d={face} fill={`url(#face-${uid})`} />
              <ellipse cx="80" cy="108" rx="7" ry="4" fill="#e07a6a" opacity={female ? 0.16 : 0.09} />
              <ellipse cx="120" cy="108" rx="7" ry="4" fill="#e07a6a" opacity={female ? 0.16 : 0.09} />

              {look.age === "senior" && (
                <g stroke={skinDeep} strokeWidth={0.9} fill="none" opacity={0.35} strokeLinecap="round">
                  <path d="M88 67 Q100 64 112 67" />
                  <path d="M90 71 Q100 69 110 71" />
                  <path d="M88 108 Q86 115 89 120" />
                  <path d="M112 108 Q114 115 111 120" />
                </g>
              )}

              <FacialHair kind={look.facial} color={hair} />

              {/* Eyes */}
              {[87, 113].map((cx, i) => (
                <g key={cx}>
                  <g className="av-eye" style={{ animationDuration: `${blinkDur}s`, animationDelay: `${blinkDelay + i * 0.02}s` }}>
                    <ellipse cx={cx} cy="91.5" rx="6.2" ry="3.9" fill="#fbfaf7" />
                    <g style={{ transform: irisShift, transition: "transform 0.5s ease" }}>
                      <circle cx={cx} cy="91.6" r="3.1" fill={iris} />
                      <circle cx={cx} cy="91.6" r="1.45" fill="#0d0907" />
                      <circle cx={cx + 0.9} cy="90.6" r="0.75" fill="#fff" opacity={0.9} />
                    </g>
                    <path
                      d={`M${cx - 6.6} 90.6 Q${cx} ${female ? 85.6 : 86.2} ${cx + 6.6} 90.6`}
                      stroke={female ? "#1a1210" : shade(skin, -0.5)}
                      strokeWidth={female ? 1.6 : 1.2}
                      fill="none"
                      strokeLinecap="round"
                    />
                  </g>
                </g>
              ))}

              {/* Brows */}
              {brows.map((d, i) => (
                <path key={i} d={d} stroke={browColor} strokeWidth={female ? 2.1 : 2.8} fill="none" strokeLinecap="round"
                  style={{ transition: "d 0.4s ease" }} />
              ))}

              {/* Nose */}
              <path d="M100 95 C99 102 96.5 106.5 97.2 109.6 C99 111.4 102 111.4 104 109.8" stroke={skinDeep} strokeWidth={1.5}
                fill="none" strokeLinecap="round" opacity={0.6} />

              {/* Mouth: lips at rest, an animated opening while speaking */}
              {speaking ? (
                <g className="av-mouth">
                  <ellipse cx="100" cy="120.5" rx="7.2" ry="4.4" fill="#4a1f1c" />
                  <rect x="94.5" y="116.6" width="11" height="2.2" rx="1" fill="#f3efe8" opacity={0.9} />
                  <path d="M92.6 119.8 Q100 115.8 107.4 119.8" stroke={lip} strokeWidth={1.6} fill="none" />
                </g>
              ) : (
                <path d={mouthPath} stroke={lip} strokeWidth={female ? 2.6 : 2.2} fill="none" strokeLinecap="round"
                  style={{ transition: "d 0.4s ease" }} />
              )}

              {look.bindi && <circle cx="100" cy="77.5" r="1.5" fill="#b0283a" />}

              {look.glasses && (
                <g stroke="#26221f" strokeWidth={1.7} fill="#ffffff" fillOpacity={0.07}>
                  <rect x="78" y="85" width="18" height="13" rx="4.5" />
                  <rect x="104" y="85" width="18" height="13" rx="4.5" />
                  <path d="M96 90.5 Q100 88.6 104 90.5" fill="none" />
                  <path d="M78 89 L68 87" fill="none" />
                  <path d="M122 89 L132 87" fill="none" />
                </g>
              )}

              <HairFront style={look.hair} fill={`url(#hair-${uid})`} color={hair} />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

function Torso({ look, cloth, skin, skinDark }: { look: Look; cloth: string; skin: string; skinDark: string }) {
  const body = "M12 230 C14 186 38 162 76 154 L100 160 L124 154 C162 162 186 186 188 230 Z";
  const inner = look.innerColor ?? "#f2f2ee";
  switch (look.outfit) {
    case "blazer":
      return (
        <g>
          <path d={body} fill={cloth} />
          <path d="M84 152 L100 196 L116 152 Z" fill={inner} />
          <path d="M88 152 L100 166 L112 152 L108 150 L100 158 L92 150 Z" fill={shade(inner, -0.08)} />
          <path d="M84 152 L100 196 L72 178 L78 158 Z" fill={shade(look.outfitColor, -0.12)} />
          <path d="M116 152 L100 196 L128 178 L122 158 Z" fill={shade(look.outfitColor, -0.12)} />
          <path d="M100 196 L100 230" stroke={shade(look.outfitColor, -0.3)} strokeWidth={1.2} />
          <circle cx="104" cy="210" r="1.8" fill={shade(look.outfitColor, -0.35)} />
        </g>
      );
    case "sweater":
      return (
        <g>
          <path d={body} fill={cloth} />
          <path d="M84 153 C90 166 110 166 116 153 Z" fill={inner} />
          <path d="M86 152 L95 163 L100 156 L105 163 L114 152" fill={shade(inner, -0.06)} stroke={shade(inner, -0.2)} strokeWidth={0.6} />
          <path d="M80 156 C90 172 110 172 120 156" stroke={shade(look.outfitColor, -0.25)} strokeWidth={3} fill="none" />
        </g>
      );
    case "kurta":
      return (
        <g>
          <path d={body} fill={cloth} />
          <path d="M88 151 L112 151 L112 157 L88 157 Z" fill={shade(look.outfitColor, -0.1)} />
          <path d="M100 157 L100 200" stroke={shade(look.outfitColor, -0.28)} strokeWidth={1.4} />
          {[168, 180, 192].map((y) => <circle key={y} cx="100" cy={y} r="1.5" fill={shade(look.outfitColor, -0.35)} />)}
        </g>
      );
    case "blouse":
      return (
        <g>
          <path d={body} fill={cloth} />
          <path d="M84 153 C88 170 112 170 116 153 Z" fill={skin} />
          <path d="M88 160 C94 168 106 168 112 160" stroke={skinDark} strokeWidth={1} fill="none" opacity={0.4} />
          <path d="M82 154 C88 174 112 174 118 154" stroke={shade(look.outfitColor, -0.2)} strokeWidth={2.2} fill="none" />
        </g>
      );
    default: // shirt
      return (
        <g>
          <path d={body} fill={cloth} />
          <path d="M88 152 L100 172 L112 152 Z" fill={skin} />
          <path d="M86 150 L100 172 L84 168 L80 156 Z" fill={shade(look.outfitColor, 0.06)} stroke={shade(look.outfitColor, -0.2)} strokeWidth={0.8} />
          <path d="M114 150 L100 172 L116 168 L120 156 Z" fill={shade(look.outfitColor, 0.06)} stroke={shade(look.outfitColor, -0.2)} strokeWidth={0.8} />
          <path d="M100 172 L100 230" stroke={shade(look.outfitColor, -0.18)} strokeWidth={1} />
          {[186, 202, 218].map((y) => <circle key={y} cx="101.5" cy={y} r="1.3" fill={shade(look.outfitColor, -0.3)} />)}
        </g>
      );
  }
}

function HairBack({ style, fill }: { style: Look["hair"]; fill: string }) {
  switch (style) {
    case "long":
      return <path d="M60 96 C54 52 78 36 100 36 C122 36 146 52 140 96 C142 128 148 158 152 178 C128 188 72 188 48 178 C52 158 58 128 60 96 Z" fill={fill} />;
    case "wavy":
      return (
        <path
          d="M60 96 C54 52 78 36 100 36 C122 36 146 52 140 96 C144 116 140 128 148 142 C142 152 152 162 146 172 C126 182 74 182 54 172 C48 162 58 152 52 142 C60 128 56 116 60 96 Z"
          fill={fill}
        />
      );
    case "bob":
      return <path d="M59 98 C55 54 78 38 100 38 C122 38 145 54 141 98 C143 114 142 126 138 136 C128 130 72 130 62 136 C58 126 57 114 59 98 Z" fill={fill} />;
    case "bun":
      return <circle cx="100" cy="40" r="15" fill={fill} />;
    case "ponytail":
      return <path d="M126 62 C142 70 146 98 144 124 C142 144 136 160 130 168 C128 150 132 120 128 96 C126 82 122 72 118 66 Z" fill={fill} />;
    default:
      return null;
  }
}

function HairFront({ style, fill, color }: { style: Look["hair"]; fill: string; color: string }) {
  switch (style) {
    case "long":
    case "wavy":
      return <path d="M66 94 C61 56 80 40 100 40 C121 40 139 56 134 94 C131 74 123 63 110 60 C103 67 90 71 77 73 C71 79 68 86 66 94 Z" fill={fill} />;
    case "bob":
      return <path d="M66 96 C61 56 80 41 100 41 C121 41 139 56 134 96 C131 76 124 66 112 62 C100 70 86 70 75 70 C70 78 67 86 66 96 Z" fill={fill} />;
    case "bun":
    case "ponytail":
      return (
        <g>
          <path d="M67 86 C66 56 82 42 100 42 C118 42 134 56 133 86 C129 66 117 57 100 57 C83 57 71 66 67 86 Z" fill={fill} />
          <path d="M84 50 Q100 47 116 50" stroke={shade(color, 0.2)} strokeWidth={0.8} fill="none" opacity={0.6} />
        </g>
      );
    case "side":
      return (
        <g>
          <path d="M65 88 C62 54 81 39 101 39 C121 39 138 54 135 86 C132 70 125 62 114 60 C103 58 86 56 77 66 C71 72 68 80 65 88 Z" fill={fill} />
          <path d="M86 44 Q90 52 88 60" stroke={shade(color, 0.25)} strokeWidth={1} fill="none" opacity={0.7} />
        </g>
      );
    case "crop":
      return <path d="M67 82 C66 56 82 44 100 44 C118 44 134 56 133 82 C130 67 120 59 100 59 C80 59 70 67 67 82 Z" fill={fill} opacity={0.92} />;
    case "curly":
      return (
        <g fill={fill}>
          <path d="M66 86 C64 56 82 42 100 42 C118 42 136 56 134 86 C130 70 120 62 100 62 C80 62 70 70 66 86 Z" />
          {[[70, 64], [78, 52], [90, 45], [102, 43], [114, 46], [125, 53], [131, 65], [72, 76], [129, 77]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="8.5" />
          ))}
        </g>
      );
    case "receding":
      return (
        <g fill={fill}>
          <path d="M66 94 C63 78 66 66 73 60 L77 78 C72 83 69 88 66 94 Z" />
          <path d="M134 94 C137 78 134 66 127 60 L123 78 C128 83 131 88 134 94 Z" />
          <path d="M80 54 C90 49 110 49 120 54 C112 52 88 52 80 54 Z" opacity={0.5} />
        </g>
      );
    case "bald":
      return (
        <g fill={fill}>
          <path d="M66 96 C64 84 66 76 70 70 L72 86 C69 89 67 92 66 96 Z" />
          <path d="M134 96 C136 84 134 76 130 70 L128 86 C131 89 133 92 134 96 Z" />
        </g>
      );
    default: // short
      return <path d="M66 86 C64 54 82 40 100 40 C120 40 136 54 134 86 C132 72 126 64 118 62 C108 60 92 60 82 63 C74 66 69 74 66 86 Z" fill={fill} />;
  }
}

function FacialHair({ kind, color }: { kind?: Look["facial"]; color: string }) {
  if (!kind) return null;
  if (kind === "stubble") {
    return (
      <g fill={color} opacity={0.2}>
        <path d="M70 104 C72 124 84 136 100 137 C116 136 128 124 130 104 C126 118 116 128 100 129 C84 128 74 118 70 104 Z" />
        <path d="M89 115 Q100 111 111 115 Q100 116.5 89 115 Z" />
      </g>
    );
  }
  if (kind === "moustache") {
    return <path d="M88 116 Q94 111 100 113.5 Q106 111 112 116 Q106 115.5 100 116.5 Q94 115.5 88 116 Z" fill={color} />;
  }
  return (
    <g fill={color}>
      <path d="M68 98 C68 128 84 143 100 144 C116 143 132 128 132 98 C128 113 122 121 114 125 C108 119 92 119 86 125 C78 121 72 113 68 98 Z" opacity={0.92} />
      <path d="M88 116 Q94 111 100 113.5 Q106 111 112 116 Q106 115.5 100 116.5 Q94 115.5 88 116 Z" />
    </g>
  );
}

/* ---------- colour helpers ---------- */

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = toRgb(hex);
  const t = amt > 0 ? 255 : 0;
  const p = Math.abs(amt);
  return toHex([r + (t - r) * p, g + (t - g) * p, b + (t - b) * p]);
}
function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
