#!/usr/bin/env node
/**
 * check-rules-null-safety.cjs — keeps the `resource.data.<field>` class closed.
 *
 * In `firestore.rules`, `resource.data.foo` does not evaluate to false when
 * there is nothing to read — it THROWS:
 *
 *   the document does not exist   → `resource` is null
 *                                   `evaluation error at L…, Null value error`
 *   it exists with no `foo`       → `…, Property foo is undefined on object`
 *
 * Both refuse the write exactly as `false` would, so this is never a hole. But
 * the refusal is reported as an opaque rule fault rather than a verdict, and
 * chasing one costs an afternoon (an emulator teardown deleting a document
 * whose seeding had aborted, blamed on two innocent suites).
 *
 * Every write gate must therefore guard its reads with `has('foo')` (see the
 * helper in firestore.rules) or an explicit `resource != null` /
 * `resource.data.get('foo', …)`. Read gates are exempt: a read of an absent
 * document returns "not found" without evaluating the rule against a null
 * `resource` in the same way, and `create` gates use `request.resource`.
 *
 * THE BASELINE. ZeusOS inherited a ruleset with dozens of unguarded sites.
 * `scripts/rules-null-safety-baseline.json` lists them (keyed by gate text, not
 * line number, so an unrelated edit does not move them); the gate FAILS only
 * on a site that is not in the baseline, and reports a baseline entry whose
 * site has been fixed so the entry gets deleted. Fix the baseline down to zero;
 * never add to it except by `--update` after a deliberate review.
 *
 * Usage: node scripts/check-rules-null-safety.cjs [--update]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'firestore.rules');
const BASELINE = path.join(__dirname, 'rules-null-safety-baseline.json');
const raw = fs.readFileSync(FILE, 'utf8');

// Strip comments BEFORE splitting into statements, never after.
//
// A statement is terminated at the first `;`, and a `//` comment inside a
// condition can carry one — `// Report on the commitments; never add or drop
// one.` truncated a gate mid-condition and hid an unguarded `resource.data
// .items` sitting after it. Comments are replaced with a space rather than
// deleted so line numbers survive for the offender report.
const src = raw.replace(/\/\/[^\n]*/g, '');
const FIELD = /(?<!request\.)\bresource\.data\.([A-Za-z_][A-Za-z0-9_]*)/g;
// `fn(resource.data)` — including the built-in `request.resource.data.diff(...)`
// — dereferences inside the callee, so it throws on an absent document with no
// `resource.data.<field>` for the field scan above to see.
const CALL = /(?<!request\.)\b[A-Za-z_][A-Za-z0-9_]*\(\s*resource\.data\s*\)/;

const offenders = [];
const re = /allow\s+([a-z,\s]+?):\s*if\s([\s\S]*?);/g;
let m;
while ((m = re.exec(src)) !== null) {
  const ops = m[1].split(',').map((o) => o.trim());
  if (!ops.some((o) => o === 'update' || o === 'delete' || o === 'write')) continue;

  const cond = m[2];
  const fields = [...cond.matchAll(FIELD)].map((x) => x[1]).filter((f) => f !== 'get');
  const passesWholeMap = CALL.test(cond);
  if (fields.length === 0 && !passesWholeMap) continue;

  // A whole-map read needs only a resource-null guard: the callee's own field
  // reads are its business, and `has(...)` anywhere implies `resource != null`.
  if (passesWholeMap && !/resource\s*!=\s*null/.test(cond) && !/\bhas\(/.test(cond)) {
    offenders.push({
      line: src.slice(0, m.index).split('\n').length,
      ops: ops.join(','),
      fields: 'resource.data passed to a function',
      cond: cond.replace(/\s+/g, ' ').trim().slice(0, 100),
    });
    continue;
  }
  if (fields.length === 0) continue;

  // Check EVERY field, not the condition as a whole. Placement (which disjunct
  // the guard sits in) is a review matter this script cannot judge; it only
  // insists a guard for that field exists.
  const unguarded = [...new Set(fields)].filter((f) => {
    if (cond.includes(`has('${f}')`)) return false;
    if (cond.includes(`resource.data.get('${f}'`)) return false;
    if (cond.includes(`'${f}' in resource.data`) && /resource\s*!=\s*null/.test(cond)) return false;
    return true;
  });
  if (unguarded.length === 0) continue;

  offenders.push({
    line: src.slice(0, m.index).split('\n').length,
    ops: ops.join(','),
    fields: unguarded.join(', '),
    cond: cond.replace(/\s+/g, ' ').trim().slice(0, 100),
  });
}

// Helper FUNCTIONS too. A gate can be perfectly guarded and still throw because
// the predicate it calls dereferences first. Every caller of these is an
// update/delete gate, so `resource` is null only for an absent document.
const FN = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{([\s\S]*?)\n    \}/g;
let f;
while ((f = FN.exec(src)) !== null) {
  const [name, body] = [f[1], f[2]];
  if (name === 'has') continue;
  const fields = [...body.matchAll(FIELD)].map((x) => x[1]).filter((x) => x !== 'get');
  if (fields.length === 0) continue;
  if (/resource\s*!=\s*null/.test(body) || /\bhas\(/.test(body)) continue;
  offenders.push({
    line: src.slice(0, f.index).split('\n').length,
    ops: `function ${name}()`,
    fields: [...new Set(fields)].join(', '),
    cond: body.replace(/\s+/g, ' ').trim().slice(0, 100),
  });
}

const keyOf = (o) => `${o.ops} [${o.fields}] ${o.cond}`;

if (process.argv.includes('--update')) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          'Write gates and helper functions in firestore.rules that read resource.data.<field> with no has() guard, inherited with the fork. ' +
          'Keyed by gate text so unrelated edits do not move them. The check fails on any site NOT listed here; fix these down to zero. ' +
          'Rewrite only with `node scripts/check-rules-null-safety.cjs --update` after a deliberate review.',
        count: offenders.length,
        sites: offenders.map(keyOf),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline written to scripts/rules-null-safety-baseline.json (${offenders.length} inherited site(s)).`);
  process.exit(0);
}

let baseline = [];
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).sites || [];
} catch {
  baseline = [];
}
const known = new Set(baseline);
const present = new Set(offenders.map(keyOf));
const fresh = offenders.filter((o) => !known.has(keyOf(o)));
const stale = baseline.filter((k) => !present.has(k));

for (const k of stale) {
  console.warn(`⚠ stale baseline entry (fixed — delete it from scripts/rules-null-safety-baseline.json): ${k.slice(0, 110)}`);
}

if (fresh.length > 0) {
  console.error(
    `✗ ${fresh.length} write gate(s) read resource.data.<field> with no null guard (not in the baseline).\n` +
    `  Wrap the DISJUNCT that reads the field — never the whole condition:\n` +
    `      isAdmin() || (has('status') && resource.data.status == 'draft')\n` +
    `  Hoisting the guard in front of an || would newly deny an admin acting on\n` +
    `  an absent document, which succeeds today by short-circuit.\n`
  );
  for (const o of fresh) {
    console.error(`  firestore.rules:${o.line}  allow ${o.ops}  [${o.fields}]\n      ${o.cond}`);
  }
  process.exit(1);
}

if (offenders.length > 0) {
  console.log(
    `✓ Firestore rules: no NEW unguarded resource.data reads ` +
    `(${offenders.length} inherited site(s) still tracked in scripts/rules-null-safety-baseline.json — fix them down).`,
  );
} else {
  console.log('✓ Firestore rules: every write gate guards its resource.data reads.');
}
