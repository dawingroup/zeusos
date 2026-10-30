#!/usr/bin/env node
/**
 * check-rules-complexity.cjs — keeps firestore.rules under the size it is
 * KNOWN to release at.
 *
 * WHY: a ruleset can compile, pass every emulator test and still be refused at
 * RELEASE with `400 Request contains an invalid argument` — no field, no line.
 * It is not the 256 KiB size limit (2026-09-23: refused at 208 KB) but a
 * complexity ceiling, and the CLI then disguises it as `409 Requested entity
 * already exists`, so a deploy can go red having shipped nothing or go
 * unnoticed having shipped nothing (#1827, #1838, #1845). What was measured:
 * blank lines and inert match blocks cost nothing; rules that READ THE STORED
 * DOCUMENT (`resource.data…`) are what spend the budget; deleting four unused
 * helpers was enough to get a refused ruleset live.
 *
 * Nobody knows the ceiling's formula, so this does not pretend to compute it.
 * It records the measurements of a ruleset that DID release
 * (scripts/rules-complexity-baseline.json) and fails when the working tree
 * exceeds any of them. The baseline is a high-water mark, not the current
 * size: room freed by deleting dead rules stays available to the next change.
 *
 * When it fails:
 *   1. Make room. Every deploy prints `⚠ Unused function: …` — delete those.
 *      Delete match blocks whose path has an odd number of segments (they can
 *      never match a document). Move a write behind a callable and give the
 *      client no `allow` for it. An `allow …: if false;` grants nothing —
 *      rules only grant, and whatever no allow grants is refused — so it can
 *      be written as a comment (`// write: no client may (no allow)`), which
 *      is stripped before measuring. KEEP the statement where a rules test
 *      pins the refusal's wording: `if false` refuses with "… false for
 *      'update'", no allow at all with "No matching allow statements", and
 *      the `/false for '/` pins (CLAUDE.md, `has()`) are also what makes a
 *      refusal test fail when its block is deleted. Keep it too where a block
 *      would be left with no allow. 2026-10-03 (visual commerce X-2): 92
 *      statements became comments (~3.3 KB), the stripped ruleset otherwise
 *      byte-identical.
 *   2. Only if a ruleset ABOVE the baseline has been released and verified
 *      live by content (scripts/verify-live-rules.cjs) may the baseline move:
 *        node scripts/check-rules-complexity.cjs --update
 *
 * Usage: node scripts/check-rules-complexity.cjs [--file <rules>] [--json] [--update]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, 'rules-complexity-baseline.json');

const METRICS = [
  ['bytes', 'bytes once comments and blank lines are stripped'],
  ['allowStatements', '`allow` statements'],
  ['functions', 'helper functions'],
  ['documentReads', '`get(` / `exists(` document reads'],
  ['storedDocumentReads', 'reads of the stored document (`resource.data`)'],
];

/**
 * Comments out, blank lines out. Quote-aware, so a `//` inside a string
 * literal (a URL, a regex) is kept — the same contract as
 * build-firestore-rules.cjs, which this must not import: that script builds
 * on load.
 */
function strip(source) {
  let out = '';
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < source.length) {
        out += next;
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) throw new Error('Unterminated block comment');
      i = end + 1;
      continue;
    }
    out += ch;
  }
  return `${out
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')}\n`;
}

function measure(source) {
  const built = strip(source);
  const count = (re) => (built.match(re) || []).length;
  return {
    bytes: Buffer.byteLength(built, 'utf8'),
    allowStatements: count(/\ballow\s+[a-z, ]+:/g),
    functions: count(/\bfunction\s+[A-Za-z0-9_]+\s*\(/g),
    documentReads: count(/\b(?:get|exists)\(\s*\/databases\//g),
    storedDocumentReads: count(/(?<!request\.)\bresource\.data\b/g),
  };
}

/** Metrics of `current` that exceed `baseline`, as [{metric, baseline, current}]. */
function exceeded(baseline, current) {
  return METRICS.map(([metric]) => metric)
    .filter((metric) => current[metric] > baseline[metric])
    .map((metric) => ({ metric, baseline: baseline[metric], current: current[metric] }));
}

function main() {
  const args = process.argv.slice(2);
  const fileArg = args.indexOf('--file');
  const file = fileArg === -1 ? path.join(ROOT, 'firestore.rules') : path.resolve(args[fileArg + 1]);
  const current = measure(fs.readFileSync(file, 'utf8'));

  if (args.includes('--json')) {
    console.log(JSON.stringify(current, null, 2));
    return 0;
  }

  if (args.includes('--update')) {
    const previous = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : {};
    const next = {
      _comment:
        'Measurements of a firestore.rules that RELEASED and was verified live by content. ' +
        'A high-water mark, not the current size. Move it only per scripts/check-rules-complexity.cjs.',
      releasedAt: previous.releasedAt || null,
      ...current,
    };
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Baseline written to ${path.relative(ROOT, BASELINE_FILE)} — set "releasedAt" to the commit that is live.`);
    return 0;
  }

  if (!fs.existsSync(BASELINE_FILE)) {
    console.error(`✗ No baseline at ${path.relative(ROOT, BASELINE_FILE)}.`);
    return 1;
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  const over = exceeded(baseline, current);

  const width = Math.max(...METRICS.map(([m]) => m.length));
  for (const [metric] of METRICS) {
    const delta = current[metric] - baseline[metric];
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    console.log(`  ${metric.padEnd(width)}  ${String(current[metric]).padStart(7)}  (released at ${baseline[metric]}, ${sign})`);
  }

  if (over.length === 0) {
    console.log('✓ Firestore rules: at or under the size known to release.');
    return 0;
  }

  console.error('\n✗ Firestore rules: larger than any ruleset known to release.');
  for (const o of over) {
    const label = METRICS.find(([m]) => m === o.metric)[1];
    console.error(`   • ${label}: ${o.current} (released at ${o.baseline})`);
  }
  console.error(
    '\nA ruleset can compile and pass every test and still be refused at RELEASE (a 400\n' +
      'with no field, shown by the CLI as a 409). Make room first: delete the functions the\n' +
      'deploy warns are unused, delete match blocks no document path can reach, or move a\n' +
      'write behind a callable. See the header of scripts/check-rules-complexity.cjs.'
  );
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { strip, measure, exceeded, METRICS };
