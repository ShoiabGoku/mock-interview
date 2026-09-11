#!/usr/bin/env node
/**
 * Copy the Myplacement question banks into src/data/placement/.
 *
 *   node scripts/sync-placement.mjs [path-to-myplacement]
 *
 * Defaults to ../myplacement. Files are copied byte-for-byte (so ₹, √, σ and
 * friends survive) with one change: the `@/lib/types` import is pointed at the
 * local ./types.ts. Re-run this after adding questions in Myplacement, then
 * rebuild — placementBank.ts picks everything up automatically.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(process.argv[2] ?? join(root, "..", "myplacement"), "src/data/questions");
const dest = join(root, "src/data/placement");

const BANKS = ["aerospace", "mechanics", "resume", "nonCore", "coding", "aptitude", "interview"];

if (!existsSync(src)) {
  console.error(`Myplacement banks not found at ${src}`);
  process.exit(1);
}

for (const name of BANKS) {
  const from = join(src, `${name}.ts`);
  const text = readFileSync(from, "utf8");
  const rewritten = text.replace(
    /import type \{ Question \} from "@\/lib\/types";/,
    'import type { Question } from "./types";'
  );
  if (rewritten === text) {
    console.error(`${name}.ts: expected type import not found — check the file by hand.`);
    process.exit(1);
  }
  writeFileSync(join(dest, `${name}.ts`), rewritten, "utf8");
  console.log(`synced ${name}.ts`);
}
