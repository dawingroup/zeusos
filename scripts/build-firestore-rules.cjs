#!/usr/bin/env node
/**
 * Build the deployable Firestore rules from the documented source.
 *
 * WHY THIS EXISTS
 * ---------------
 * A rules set must serialize to under 256 KiB (262,144 bytes). Comments
 * count. `firestore.rules` crossed that line on 2026-08-15 (PR #1126,
 * 262,263 bytes — 119 over) and EVERY production deploy since has failed
 * on the "Deploy Firestore rules" step, while `Deploy Hosting` kept
 * succeeding. So the app shipped and the rules silently did not.
 *
 * The failure gives you nothing to work with:
 *
 *   Error: Request to https://firebaserules.googleapis.com/v1/projects/
 *   dawinos:test had HTTP Error: 400, Request contains an invalid argument.
 *
 * No mention of size, no line number. It reads like a syntax error, which
 * is why it survived five deploys — the emulator compiles the same file
 * happily (no size limit locally) and the rules unit tests all pass.
 *
 * Roughly 40% of `firestore.rules` is comment, and those comments are
 * worth keeping: they carry the reasoning behind gates that are easy to
 * get subtly wrong. So the source keeps them and the DEPLOYED artifact
 * drops them. That buys back ~108 KiB — years of headroom — without
 * deleting a single word of documentation.
 *
 * Indentation is deliberately PRESERVED. It costs ~35 KiB we can afford,
 * and it keeps the rules readable in the Firebase console, which is where
 * someone will be looking when production is misbehaving.
 *
 * CONTRACT: this script may only remove comments and blank lines. It must
 * never alter a string literal, a path, or an expression. `//` inside a
 * quoted string is data, not a comment (see the state machine below), and
 * getting that wrong would silently rewrite an access rule.
 */

const fs = require('fs');
const path = require('path');

/** Hard limit on a serialized rules set: 256 KiB. */
const MAX_RULES_BYTES = 262144;

/**
 * Warn once the file is within this much of the limit, so the break is
 * seen in a PR rather than discovered as a 400 during a deploy.
 */
const WARN_MARGIN_BYTES = 20480; // 20 KiB

/**
 * Strip comments from a Firestore rules source.
 *
 * Single-pass state machine. The only states that matter are "inside a
 * string" (where `//` and `/*` are ordinary characters) and "inside a
 * comment" (where everything is dropped). Rules have no template
 * literals and no regex literals — regexes are written as strings —
 * so quotes and backslash escapes are the whole story.
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  let quote = null; // the open quote character, or null

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (quote) {
      out += ch;
      // A backslash escapes the next character, including a quote —
      // consume both so \" does not read as the end of the string.
      if (ch === '\\' && i + 1 < source.length) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      // Line comment — drop to (not including) the newline, so blank-line
      // cleanup below can decide what to do with the line.
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) {
        throw new Error('Unterminated block comment in firestore.rules');
      }
      // Preserve any newlines the block spanned so line numbers in a
      // compiler error still land near the right place.
      const newlines = source.slice(i, end + 2).split('\n').length - 1;
      out += '\n'.repeat(newlines);
      i = end + 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Drop lines that are empty or became empty once comments were removed. */
function dropBlankLines(source) {
  return source
    .split('\n')
    .filter((line) => line.trim().length > 0)
    // Trailing whitespace left behind by a stripped end-of-line comment.
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');
}

/**
 * A second, deliberately dumber comment filter: line-based rather than
 * character-based.
 *
 * This is the reference the real stripper is checked against. Comparing
 * the output to the RAW source would be wrong by construction — the
 * source contains prose like `allow update: if true` inside a comment
 * (firestore.rules:2692), which is documentation, not a rule. Comparing
 * against a filter that shares no logic with the stripper makes the
 * check independent: both would have to be wrong in the same way to
 * agree on a bad answer.
 *
 * It has a known blind spot — a line beginning with a string that
 * contains `//` would be mis-filtered here but handled correctly by the
 * stripper. That disagreement is a FAILURE worth investigating, not a
 * false alarm to suppress, so it is left to fail loudly.
 */
function stripCommentsLineBased(source) {
  const out = [];
  let inBlock = false;
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlock = true;
      continue;
    }
    if (trimmed.startsWith('//')) continue;
    const marker = line.indexOf('//');
    out.push(marker === -1 ? line : line.slice(0, marker));
  }
  return out.join('\n');
}

function build(sourcePath, outputPath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const built = `${dropBlankLines(stripComments(source))}\n`;

  const sourceBytes = Buffer.byteLength(source, 'utf8');
  const builtBytes = Buffer.byteLength(built, 'utf8');

  // Structural assertions against an INDEPENDENT comment filter. They
  // cannot prove semantic equivalence, but they catch a stripper that ate
  // a brace or a rule — the failure mode that would silently widen access.
  const reference = stripCommentsLineBased(source);
  const countOf = (text, re) => (text.match(re) || []).length;
  const checks = [
    ['match blocks', /\bmatch\s+\/[^\s{]*/g],
    ['allow statements', /\ballow\s+[a-z, ]+:/g],
    ['function definitions', /\bfunction\s+[A-Za-z0-9_]+\s*\(/g],
    ['braces', /[{}]/g],
  ];
  for (const [label, re] of checks) {
    const expected = countOf(reference, re);
    const actual = countOf(built, re);
    if (expected !== actual) {
      throw new Error(
        `Rules build changed the ${label} count (${expected} → ${actual}). ` +
          'Refusing to emit — the stripper altered something it should not have.'
      );
    }
  }
  // Braces must still balance, or the block structure moved.
  const braceDelta = (text) => countOf(text, /{/g) - countOf(text, /}/g);
  if (braceDelta(built) !== 0) {
    throw new Error(
      `Built rules have unbalanced braces (delta ${braceDelta(built)}). Refusing to emit.`
    );
  }

  if (builtBytes > MAX_RULES_BYTES) {
    throw new Error(
      `Built rules are ${builtBytes} bytes, over the ${MAX_RULES_BYTES}-byte ` +
        `(256 KiB) limit by ${builtBytes - MAX_RULES_BYTES}. Firebase rejects ` +
        'this with an opaque HTTP 400 "invalid argument" at deploy time, so it ' +
        'is caught here instead. Shorten the rules — extract shared logic into ' +
        'functions, or consolidate duplicated match blocks.'
    );
  }

  fs.writeFileSync(outputPath, built, 'utf8');

  const headroom = MAX_RULES_BYTES - builtBytes;
  const pct = ((1 - builtBytes / sourceBytes) * 100).toFixed(1);
  console.log(
    `[rules] ${path.basename(sourcePath)} ${sourceBytes} B → ` +
      `${path.basename(outputPath)} ${builtBytes} B (−${pct}%), ` +
      `${headroom} B under the limit`
  );

  if (headroom < WARN_MARGIN_BYTES) {
    console.warn(
      `[rules] WARNING: only ${headroom} bytes of headroom left. Comments are ` +
        'already stripped, so the next fix has to be the rules themselves.'
    );
  }

  return { sourceBytes, builtBytes, headroom };
}

module.exports = {
  stripComments,
  stripCommentsLineBased,
  dropBlankLines,
  build,
  MAX_RULES_BYTES,
};

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, '..');
  const sourcePath = path.join(repoRoot, 'firestore.rules');
  const outputPath = path.join(repoRoot, 'firestore.rules.deploy');
  try {
    build(sourcePath, outputPath);
  } catch (err) {
    console.error(`[rules] ${err.message}`);
    process.exit(1);
  }
}
