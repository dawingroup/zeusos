#!/usr/bin/env node
/**
 * ui-align-gray-sweep
 *
 * Phase U.2 codemod — replaces raw Tailwind gray-family palette utilities with
 * design-token equivalents. Operates on raw file text (not AST) because the
 * replacements are unambiguous and word-bounded.
 *
 * What it does:
 *   bg-white                       → bg-card
 *   bg-gray-{50..400}              → bg-[var(--bg-sunken)]
 *   text-gray-{900,800}            → text-foreground
 *   text-gray-{700,600,500}        → text-muted-foreground
 *   text-gray-{400,300,200}        → text-[var(--fg-tertiary)]
 *   border-gray-{100,200}          → border-[var(--border-subtle)]
 *   border-gray-{300}              → border-[var(--border-default)]
 *   border-gray-{400..800}         → border-[var(--border-strong)]
 *   divide-gray-{any}              → divide-[var(--border-subtle)]
 *   ring-gray-{any}                → ring-[var(--border-default)]
 *
 * Variant prefixes (hover:, focus:, dark:, md:, !) are preserved automatically —
 * the regex word-boundaries match the bare utility part, leaving the prefix
 * untouched.
 *
 * Neutral families covered: gray | slate | zinc | neutral | stone.
 * These are visually interchangeable in a brand-neutral context and all
 * map to the same Zeus token. If a project ever needs to preserve a
 * specific Tailwind family distinction, narrow the G regex.
 *
 * What it does NOT touch:
 *   - Sentiment colors (blue/red/green/amber/yellow/etc.) — those need
 *     judgment and are handled in Phase U.3 with the hex eradication +
 *     .rag/.pill migration.
 *
 * Usage:
 *   node scripts/ui-align-gray-sweep.mjs <glob> [<glob> ...]
 *   node scripts/ui-align-gray-sweep.mjs --dry <glob>      # preview only
 *
 * Examples:
 *   node scripts/ui-align-gray-sweep.mjs 'src/modules/finance/**\/*.{ts,tsx}'
 *   node scripts/ui-align-gray-sweep.mjs --dry 'src/modules/intelligence/**\/*.tsx'
 */

import { readFileSync, writeFileSync, statSync, globSync } from 'node:fs';
import { argv, exit } from 'node:process';

const args = argv.slice(2);
const dry = args.includes('--dry');
const patterns = args.filter((a) => a !== '--dry');

if (patterns.length === 0) {
  console.error('Usage: node scripts/ui-align-gray-sweep.mjs [--dry] <glob> [<glob> ...]');
  exit(1);
}

const G = '(?:gray|slate|zinc|neutral|stone)';

const MAPPINGS = [
  // backgrounds
  { from: /\bbg-white\b/g, to: 'bg-card' },
  { from: new RegExp(`\\bbg-${G}-(?:50|100|200|300|400)\\b`, 'g'), to: 'bg-[var(--bg-sunken)]' },

  // text colors
  { from: new RegExp(`\\btext-${G}-(?:900|800)\\b`, 'g'), to: 'text-foreground' },
  { from: new RegExp(`\\btext-${G}-(?:700|600|500)\\b`, 'g'), to: 'text-muted-foreground' },
  { from: new RegExp(`\\btext-${G}-(?:400|300|200)\\b`, 'g'), to: 'text-[var(--fg-tertiary)]' },

  // borders — tiered by shade depth
  { from: new RegExp(`\\bborder-${G}-(?:50|100|200)\\b`, 'g'), to: 'border-[var(--border-subtle)]' },
  { from: new RegExp(`\\bborder-${G}-300\\b`, 'g'), to: 'border-[var(--border-default)]' },
  { from: new RegExp(`\\bborder-${G}-(?:400|500|600|700|800|900)\\b`, 'g'), to: 'border-[var(--border-strong)]' },

  // divide / ring — single mapping each
  { from: new RegExp(`\\bdivide-${G}-\\d{2,3}\\b`, 'g'), to: 'divide-[var(--border-subtle)]' },
  { from: new RegExp(`\\bring-${G}-\\d{2,3}\\b`, 'g'), to: 'ring-[var(--border-default)]' },
];

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
      perRule.set(from.source, (perRule.get(from.source) || 0) + 1);
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
  console.log('Per-rule counts:');
  [...perRule.entries()].sort((a, b) => b[1] - a[1]).forEach(([rule, n]) => {
    console.log(`  ${String(n).padStart(5)}  ${rule}`);
  });
}
