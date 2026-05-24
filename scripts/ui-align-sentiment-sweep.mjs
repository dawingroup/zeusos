#!/usr/bin/env node
/**
 * ui-align-sentiment-sweep
 *
 * Phase U.3 codemod — replaces raw Tailwind sentiment palette utilities
 * (red/green/blue/amber + emerald/rose for the same families) with the
 * corresponding RAG token CSS-var refs.
 *
 * Companion to scripts/ui-align-gray-sweep.mjs. Same shape: regex over raw
 * file text, word-bounded so variant prefixes (hover:, dark:, md:, !) are
 * preserved automatically.
 *
 * What it does (conservative — no JSX restructuring):
 *   text-{red|green|blue|amber}-{500|600|700|800|900}     → text-[var(--rag-{color})]
 *   text-{red|green|blue|amber}-{300|400}                 → text-[var(--rag-{color})]
 *   text-emerald-*                                        → text-[var(--rag-green)]
 *   text-rose-* / text-orange-*                           → text-[var(--rag-red)] / text-[var(--rag-amber)]
 *   bg-{red|green|blue|amber}-{50|100}                    → bg-[var(--rag-{color}-soft)]
 *   bg-{red|green|blue|amber}-{500|600|700|800|900}       → bg-[var(--rag-{color})]
 *   border-{red|green|blue|amber}-{200|300|400|500}       → border-[var(--rag-{color})]
 *   ring-{red|green|blue|amber}-{any}                     → ring-[var(--rag-{color})]
 *
 * What it does NOT touch (intentional — requires per-call-site judgment
 * or JSX-aware tooling):
 *   - Paired pill patterns `bg-X-50 text-X-700` that should collapse to
 *     <span className="rag X">  →  needs AST transform, do by hand or use
 *     codemod with jscodeshift
 *   - Recharts string color props like <Bar fill="#..." />               →
 *     use chartSeriesColor() from semantic-colors.ts manually
 *   - style={{ color: '#...' }}                                          →
 *     U.3.c (hex eradication) handles these with the helpers
 *   - Specialty palettes (purple, indigo, violet, pink, cyan, sky)       →
 *     these usually mean "category color", not RAG; leave for module-aware
 *     decisions in U.3.a..N
 *
 * Color → RAG mapping rationale:
 *   red, rose             → rag-red   (off-track / error / destructive)
 *   green, emerald        → rag-green (on-track / success)
 *   amber, yellow, orange → rag-amber (at-risk / warning)
 *   blue, sky             → rag-blue  (info / in-progress)
 *
 * Usage:
 *   node scripts/ui-align-sentiment-sweep.mjs <glob> [<glob> ...]
 *   node scripts/ui-align-sentiment-sweep.mjs --dry <glob>
 */

import { readFileSync, writeFileSync, statSync, globSync } from 'node:fs';
import { argv, exit } from 'node:process';

const args = argv.slice(2);
const dry = args.includes('--dry');
const patterns = args.filter((a) => a !== '--dry');

if (patterns.length === 0) {
  console.error('Usage: node scripts/ui-align-sentiment-sweep.mjs [--dry] <glob> [<glob> ...]');
  exit(1);
}

// Tailwind palette family → RAG token color
const RAG_FAMILIES = {
  red: ['red', 'rose', 'pink'],
  amber: ['amber', 'yellow', 'orange'],
  green: ['green', 'emerald'],
  // 'blue' is the catch-all for "info / category accent". Purple, indigo,
  // violet, teal, cyan don't have direct Zeus brand equivalents — they all
  // mean "this is a category indicator" or "this is info-adjacent" in the
  // existing codebase. Consolidating to RAG-blue preserves semantic intent
  // without inventing a separate category-color token system. If a call
  // site needs a distinct hue, U.4 can introduce --cat-1..N tokens.
  blue: ['blue', 'sky', 'purple', 'indigo', 'violet', 'teal', 'cyan'],
};

const MAPPINGS = [];

for (const [rag, families] of Object.entries(RAG_FAMILIES)) {
  const F = `(?:${families.join('|')})`;

  // Solid text colors → solid RAG token (includes Tailwind 3.4 950 depth)
  MAPPINGS.push({
    from: new RegExp(`\\btext-${F}-(?:300|400|500|600|700|800|900|950)\\b`, 'g'),
    to: `text-[var(--rag-${rag})]`,
  });

  // Light backgrounds → soft RAG variant (e.g. status pill background)
  MAPPINGS.push({
    from: new RegExp(`\\bbg-${F}-(?:50|100)\\b`, 'g'),
    to: `bg-[var(--rag-${rag}-soft)]`,
  });

  // Mid + stronger backgrounds → solid RAG (status dots, filled badges, alert headers)
  MAPPINGS.push({
    from: new RegExp(`\\bbg-${F}-(?:200|300|400|500|600|700|800|900)\\b`, 'g'),
    to: `bg-[var(--rag-${rag})]`,
  });

  // Gradient direction stops (from-/via-/to-{family}-{shade})
  MAPPINGS.push({
    from: new RegExp(`\\b(from|via|to)-${F}-(?:50|100)\\b`, 'g'),
    to: `$1-[var(--rag-${rag}-soft)]`,
  });
  MAPPINGS.push({
    from: new RegExp(`\\b(from|via|to)-${F}-(?:200|300|400|500|600|700|800|900)\\b`, 'g'),
    to: `$1-[var(--rag-${rag})]`,
  });

  // Native HTML form-control accent color
  MAPPINGS.push({
    from: new RegExp(`\\baccent-${F}-\\d{2,3}\\b`, 'g'),
    to: `accent-[var(--rag-${rag})]`,
  });

  // Borders → solid RAG (use opacity arbitrary value at call-site if you
  // want a softer border). Full shade range including 100 (soft outlines on
  // pill containers) and 950 (Tailwind 3.4 deep).
  MAPPINGS.push({
    from: new RegExp(`\\bborder-${F}-(?:100|200|300|400|500|600|700|800|900|950)\\b`, 'g'),
    to: `border-[var(--rag-${rag})]`,
  });

  // Ring (focus outline)
  MAPPINGS.push({
    from: new RegExp(`\\bring-${F}-\\d{2,3}\\b`, 'g'),
    to: `ring-[var(--rag-${rag})]`,
  });

  // Divide
  MAPPINGS.push({
    from: new RegExp(`\\bdivide-${F}-\\d{2,3}\\b`, 'g'),
    to: `divide-[var(--rag-${rag})]`,
  });

  // SVG fill / stroke utilities — used for filled icons (e.g. rating stars)
  MAPPINGS.push({
    from: new RegExp(`\\bfill-${F}-\\d{2,3}\\b`, 'g'),
    to: `fill-[var(--rag-${rag})]`,
  });
  MAPPINGS.push({
    from: new RegExp(`\\bstroke-${F}-\\d{2,3}\\b`, 'g'),
    to: `stroke-[var(--rag-${rag})]`,
  });

  // Low-shade text (text-X-100/200) — used for de-emphasized text on dark
  // surfaces. Maps to the soft RAG variant.
  MAPPINGS.push({
    from: new RegExp(`\\btext-${F}-(?:100|200)\\b`, 'g'),
    to: `text-[var(--rag-${rag}-soft)]`,
  });

  // Text 50 — even softer. Same target (the soft variant is the only token
  // we have at this end of the scale).
  MAPPINGS.push({
    from: new RegExp(`\\btext-${F}-50\\b`, 'g'),
    to: `text-[var(--rag-${rag}-soft)]`,
  });

  // bg-X-950 (deepest shade — added in Tailwind 3.4)
  MAPPINGS.push({
    from: new RegExp(`\\bbg-${F}-950\\b`, 'g'),
    to: `bg-[var(--rag-${rag})]`,
  });
}

const allFiles = [...new Set(patterns.flatMap((p) => globSync(p, { nodir: true })))];

let filesChanged = 0;
let totalReplacements = 0;
const perRule = new Map();

for (const file of allFiles) {
  if (!statSync(file).isFile()) continue;
  let src = readFileSync(file, 'utf8');
  const before = src;
  let fileReplacements = 0;

  for (const { from, to } of MAPPINGS) {
    src = src.replace(from, (match) => {
      fileReplacements += 1;
      perRule.set(`${from.source} → ${to}`, (perRule.get(`${from.source} → ${to}`) || 0) + 1);
      return to;
    });
  }

  if (src !== before) {
    filesChanged += 1;
    totalReplacements += fileReplacements;
    if (!dry) writeFileSync(file, src);
    console.log(`${dry ? '(dry) ' : ''}${file}  —  ${fileReplacements} replacement(s)`);
  }
}

console.log();
console.log(`${dry ? '(dry run) ' : ''}Files changed: ${filesChanged} / ${allFiles.length}`);
console.log(`${dry ? '(dry run) ' : ''}Total replacements: ${totalReplacements}`);

if (perRule.size > 0) {
  console.log();
  console.log('Per-rule counts (top 20):');
  [...perRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([rule, n]) => {
    console.log(`  ${String(n).padStart(5)}  ${rule}`);
  });
}
