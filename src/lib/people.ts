/**
 * How each person in the room looks and sounds.
 *
 * Every interviewer and every group-discussion participant gets a stable
 * appearance (skin tone, hair, glasses, outfit…) that the SVG avatar draws,
 * and a gender used to pick a matching text-to-speech voice. Interviewers are
 * listed explicitly; anyone else falls back to a deterministic look derived
 * from their id, so the same person always looks the same.
 */

export type Gender = "f" | "m";
export type HairStyle =
  | "short" | "side" | "crop" | "curly" | "receding" | "bald"
  | "long" | "bob" | "bun" | "ponytail" | "wavy";
export type Outfit = "blazer" | "shirt" | "sweater" | "kurta" | "blouse";

export interface Look {
  gender: Gender;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  facial?: "stubble" | "beard" | "moustache";
  glasses?: boolean;
  bindi?: boolean;
  outfit: Outfit;
  outfitColor: string;
  /** Shirt or blouse under a blazer / sweater. */
  innerColor?: string;
  age: "young" | "mid" | "senior";
  /** Prefer an Indian-English voice when the browser has one. */
  accent?: "in" | "intl";
}

export const SKIN = ["#f5d6c2", "#ecc4a4", "#dca783", "#c98d66", "#ad724e", "#8e5b3c", "#6c442d"];
export const HAIR = {
  black: "#1c1613",
  dark: "#33241b",
  brown: "#5b3d2a",
  auburn: "#7b4126",
  blonde: "#c6a26a",
  grey: "#9b9a98",
  salt: "#5f5e5c",
  white: "#d9d7d2",
};

const L = (
  gender: Gender,
  skin: number,
  hair: HairStyle,
  hairColor: string,
  outfit: Outfit,
  outfitColor: string,
  extra: Partial<Look> = {}
): Look => ({ gender, skin: SKIN[skin], hair, hairColor, outfit, outfitColor, age: "mid", ...extra });

const NAVY = "#25324d";
const CHARCOAL = "#3a3d44";
const GREY = "#6b7180";
const BEIGE = "#b9a487";
const OLIVE = "#55603f";
const MAROON = "#6e2f3a";
const TEAL = "#2f6c72";
const WHITE = "#f2f2ee";
const SKY = "#c9dcef";
const PINK = "#e7c3c8";

/** Interviewers on the company panels (ids from data/companies.ts). */
const PANEL_LOOKS: Record<string, Look> = {
  t1: L("f", 3, "long", HAIR.black, "blazer", CHARCOAL, { innerColor: WHITE, age: "young", accent: "in" }),
  t2: L("m", 1, "side", HAIR.black, "shirt", SKY, { glasses: true }),
  t3: L("f", 2, "bob", HAIR.dark, "blazer", NAVY, { innerColor: PINK }),
  t4: L("m", 6, "crop", HAIR.black, "shirt", "#e9e4da", { facial: "beard" }),
  t5: L("f", 3, "bun", HAIR.black, "blouse", TEAL, { accent: "in" }),
  a1: L("f", 0, "bob", HAIR.brown, "sweater", "#4c5b6e", { glasses: true, innerColor: WHITE }),
  a2: L("m", 4, "short", HAIR.black, "shirt", "#dfe6ee", { facial: "stubble", age: "young", accent: "in" }),
  a3: L("f", 1, "long", HAIR.black, "blazer", "#2e3a3a", { innerColor: WHITE }),
  a4: L("m", 6, "crop", HAIR.black, "blazer", NAVY, { innerColor: SKY, facial: "beard" }),
  a5: L("f", 3, "ponytail", HAIR.black, "blouse", "#8b5a7a", { accent: "in", age: "young" }),
  ae1: L("f", 0, "bun", HAIR.brown, "blazer", CHARCOAL, { innerColor: WHITE, glasses: true }),
  ae2: L("m", 0, "short", HAIR.blonde, "shirt", "#e6e9ec", {}),
  ae3: L("f", 4, "long", HAIR.black, "blouse", "#3d5a80", { bindi: true, accent: "in", age: "young" }),
  ae4: L("m", 1, "side", HAIR.brown, "blazer", "#3b4252", { innerColor: WHITE }),
  ae5: L("f", 1, "wavy", HAIR.dark, "blouse", "#a3574d", {}),
  is1: L("m", 4, "receding", HAIR.grey, "shirt", "#e8e1cf", { glasses: true, facial: "moustache", age: "senior", accent: "in" }),
  is2: L("f", 4, "bun", HAIR.salt, "blouse", MAROON, { glasses: true, bindi: true, age: "senior", accent: "in" }),
  is3: L("m", 5, "short", HAIR.black, "shirt", "#d9e4dc", { facial: "moustache", accent: "in" }),
  is4: L("m", 4, "receding", HAIR.white, "shirt", "#ede7d9", { glasses: true, age: "senior", accent: "in" }),
  is5: L("f", 4, "bun", HAIR.black, "blouse", "#4f7a5a", { bindi: true, accent: "in" }),
  au1: L("m", 0, "short", HAIR.brown, "sweater", "#394150", { glasses: true, innerColor: WHITE }),
  au2: L("f", 3, "ponytail", HAIR.black, "shirt", "#e9edf2", { accent: "in", age: "young" }),
  au3: L("m", 1, "crop", HAIR.grey, "shirt", "#b8c4cf", { facial: "beard" }),
  au4: L("f", 2, "bob", HAIR.black, "blazer", "#5a4a6a", { innerColor: WHITE, accent: "in" }),
  au5: L("m", 0, "side", HAIR.blonde, "blazer", GREY, { innerColor: WHITE }),
  s1: L("m", 4, "short", HAIR.black, "shirt", "#cfd8e3", { facial: "stubble", accent: "in" }),
  s2: L("m", 1, "short", HAIR.black, "sweater", "#2f3a4a", { glasses: true, innerColor: WHITE }),
  s3: L("m", 2, "curly", HAIR.dark, "shirt", "#e6ddd0", { facial: "beard" }),
  s4: L("f", 2, "long", HAIR.black, "blouse", "#3f6f6a", { accent: "in" }),
  c1: L("f", 0, "long", HAIR.blonde, "blazer", NAVY, { innerColor: WHITE }),
  c2: L("m", 3, "side", HAIR.black, "blazer", CHARCOAL, { innerColor: SKY, glasses: true, accent: "in" }),
  c3: L("f", 1, "bob", HAIR.brown, "blouse", "#c9b6a0", {}),
  f1: L("m", 0, "crop", HAIR.brown, "shirt", "#dfe3e8", { facial: "stubble" }),
  f2: L("f", 1, "wavy", HAIR.dark, "blazer", "#2b2f36", { innerColor: WHITE, glasses: true }),
  f3: L("m", 3, "short", HAIR.black, "shirt", SKY, { accent: "in", age: "young" }),
  f4: L("f", 0, "ponytail", HAIR.auburn, "blouse", "#7a8fa6", { age: "young" }),
  i1: L("m", 4, "side", HAIR.black, "shirt", "#e7ecef", { facial: "moustache", accent: "in" }),
  i4: L("m", 3, "short", HAIR.salt, "shirt", "#d8dee8", { glasses: true, accent: "in" }),
  i2: L("f", 4, "long", HAIR.black, "blouse", "#6a4f8a", { accent: "in" }),
  i3: L("m", 3, "side", HAIR.black, "blazer", "#30384a", { innerColor: WHITE, accent: "in" }),
  ph1: L("m", 3, "receding", HAIR.grey, "kurta", "#d9cfb8", { glasses: true, facial: "beard", age: "senior", accent: "in" }),
  ph2: L("f", 2, "bob", HAIR.salt, "sweater", "#7b6d5d", { glasses: true, innerColor: WHITE, age: "senior", accent: "in" }),
  ph3: L("m", 3, "short", HAIR.grey, "shirt", "#e4dccb", { facial: "moustache", age: "senior", accent: "in" }),
};

/** Group-discussion participants and moderators (ids from data/gdPeople.ts). */
const GD_LOOKS: Record<string, Look> = {
  "gd-karan": L("m", 3, "side", HAIR.black, "shirt", "#cfe0f1", { age: "young", accent: "in" }),
  "gd-ishita": L("f", 2, "long", HAIR.black, "shirt", WHITE, { glasses: true, age: "young", accent: "in" }),
  "gd-rohan": L("m", 4, "curly", HAIR.black, "shirt", "#e8e2d6", { facial: "stubble", age: "young", accent: "in" }),
  "gd-ananya": L("f", 3, "ponytail", HAIR.dark, "blouse", "#4f6d8f", { age: "young", accent: "in" }),
  "gd-siddharth": L("m", 2, "short", HAIR.black, "shirt", "#dfe8e0", { glasses: true, age: "young", accent: "in" }),
  "gd-zoya": L("f", 2, "wavy", HAIR.dark, "blouse", "#8a4f5f", { age: "young", accent: "in" }),
  "gd-manav": L("m", 3, "crop", HAIR.black, "shirt", "#f0e6d2", { age: "young", accent: "in" }),
  "gd-tanvi": L("f", 3, "bob", HAIR.black, "blazer", "#2f3b4c", { innerColor: WHITE, age: "young", accent: "in" }),
  "gd-aakash": L("m", 4, "short", HAIR.black, "shirt", "#c9d3e0", { facial: "stubble", age: "young", accent: "in" }),
  "gd-neha": L("f", 4, "bun", HAIR.black, "shirt", "#eadcef", { bindi: true, age: "young", accent: "in" }),
  "mod-kavitha": L("f", 4, "bun", HAIR.salt, "blouse", "#5b4a7a", { glasses: true, age: "senior", accent: "in" }),
  "mod-joseph": L("m", 3, "side", HAIR.salt, "blazer", CHARCOAL, { innerColor: WHITE, age: "mid", accent: "in" }),
};

const FEMALE_HAIR: HairStyle[] = ["long", "bob", "bun", "ponytail", "wavy"];
const MALE_HAIR: HairStyle[] = ["short", "side", "crop", "curly"];
const OUTFIT_COLORS = [NAVY, CHARCOAL, GREY, BEIGE, OLIVE, MAROON, TEAL, "#4a5a7a", "#6d5a4a"];

export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A best guess at gender from a first name, for people with no explicit look. */
function guessGender(name: string): Gender {
  const first = name.replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, "").split(/\s+/)[0].toLowerCase();
  if (/(a|i|ee|ya|elle|ette|ine|een|ah)$/.test(first) && !/^(ravi|hari|krishna|aditya|surya|rahul|nikhil|ali)$/.test(first)) {
    return "f";
  }
  return "m";
}

export function lookFor(id: string, name = ""): Look {
  const explicit = PANEL_LOOKS[id] ?? GD_LOOKS[id];
  if (explicit) return explicit;
  const h = hashOf(id + name);
  const gender = guessGender(name || id);
  const hairs = gender === "f" ? FEMALE_HAIR : MALE_HAIR;
  return {
    gender,
    skin: SKIN[h % SKIN.length],
    hair: hairs[(h >> 3) % hairs.length],
    hairColor: [HAIR.black, HAIR.dark, HAIR.brown][(h >> 5) % 3],
    glasses: (h >> 7) % 4 === 0,
    facial: gender === "m" && (h >> 9) % 3 === 0 ? "stubble" : undefined,
    outfit: gender === "f" ? "blouse" : (h >> 11) % 2 ? "blazer" : "shirt",
    outfitColor: OUTFIT_COLORS[(h >> 13) % OUTFIT_COLORS.length],
    innerColor: WHITE,
    age: "mid",
  };
}

/** Initials for name plates and the camera-off tile. */
export function initials(name: string): string {
  return name
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ÿ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** "Dr. K. Raghavan" -> "Raghavan", "Karan Malhotra" -> "Karan". */
export function callName(name: string): string {
  const parts = name.replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, "").split(/\s+/);
  const real = parts.filter((p) => !/^[A-Z]\.$/.test(p));
  if (/^(dr|prof)\.?\s/i.test(name)) return name.split(/\s+/)[0] + " " + (real[real.length - 1] ?? "");
  return real[0] ?? name;
}
