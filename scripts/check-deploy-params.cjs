#!/usr/bin/env node
/**
 * check-deploy-params — the committed functions env file vs what the code declares.
 *
 * WHY. `firebase deploy --only functions` analyses the whole codebase and
 * demands a literal value for every `defineString` param. ZeusOS supplies them
 * from the committed `functions/.env.zeusos`. A param declared in code but
 * missing from that file makes a non-interactive deploy abort PARTWAY — some
 * containers on new code, some on old — which is strictly worse than never
 * starting.
 *
 * WHAT IS AND IS NOT A FILE VALUE:
 *   defineSecret → Google Secret Manager, `firebase-managed: functions`. The
 *                  deploy BINDS these by reference and never reads a value, so
 *                  they must NOT appear with a value in a committed env file:
 *                  that is a live credential in git.
 *   defineString → the only params a deploy demands a literal for. Every one
 *                  of these MUST have a key in the env file — unless the code
 *                  declares a `default:`, which says in code that unset is a
 *                  legitimate state (usually: unset keeps the feature off).
 *
 * Extra keys in the file are fine: they carry plain `process.env` config that
 * does not block a deploy but IS baked into the deployed environment.
 *
 * Exit 0 when the file covers everything, 1 when a deploy would be missed or a
 * secret value is committed.
 *
 * Usage: node scripts/check-deploy-params.cjs [env-file]
 *   default env-file: functions/.env.zeusos
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(ROOT, 'functions', '.env.zeusos');
const FN_DIR = path.join(ROOT, 'functions');

function fail(msg) {
  process.stderr.write(`check-deploy-params: ${msg}\n`);
  process.exit(1);
}

/**
 * Only the modules a deploy actually LOADS declare params at deploy time:
 * functions/index.js and everything it `require()`s, transitively. A
 * DawinOS-legacy trigger that index.js no longer exports may still sit in
 * functions/src with its own defineString — the deploy never evaluates it, so
 * demanding a key for it would be a false alarm. Walk the require graph.
 */
function resolveRequire(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // a package, not a local module
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.js`, path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function reachableFrom(entry) {
  const seen = new Set();
  const queue = [entry];
  const REQUIRE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    if (file.includes(`${path.sep}node_modules${path.sep}`) || file.includes(`${path.sep}vendor${path.sep}`)) continue;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = REQUIRE.exec(src))) {
      const target = resolveRequire(file, m[1]);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return [...seen];
}

const sources = reachableFrom(path.join(FN_DIR, 'index.js'));
if (sources.length < 2) fail('functions/index.js requires nothing — the require walk is broken.');

const declared = { defineString: new Set(), defineSecret: new Set() };
/** defineString params that declare a `default:` — unset is a legitimate state. */
const withDefault = new Set();
for (const file of sources) {
  const src = fs.readFileSync(file, 'utf8');
  for (const kind of ['defineString', 'defineSecret']) {
    const re = new RegExp(`${kind}\\(\\s*['"]([A-Z0-9_]+)['"]`, 'g');
    let m;
    while ((m = re.exec(src))) {
      declared[kind].add(m[1]);
      if (kind === 'defineString') {
        // Look only at the call's own argument list, so a `default:` belonging
        // to the NEXT declaration cannot be mistaken for this one's.
        const tail = src.slice(m.index, m.index + 600);
        const callEnd = tail.indexOf(')');
        const closeObj = tail.indexOf('})');
        const call = tail.slice(0, closeObj !== -1 && closeObj < 600 ? closeObj + 2 : callEnd + 1);
        if (/\bdefault\s*:/.test(call)) withDefault.add(m[1]);
      }
    }
  }
}

if (declared.defineString.size === 0 && declared.defineSecret.size === 0) {
  fail('found no defineString/defineSecret params at all — the scan is broken, not the env file.');
}

if (!fs.existsSync(ENV_FILE)) fail(`env file not found at ${path.relative(ROOT, ENV_FILE)}`);
const envText = fs.readFileSync(ENV_FILE, 'utf8');

/** KEY=value lines; a quoted or empty value counts as set-but-empty when blank. */
const envValues = new Map();
for (const line of envText.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
  const value = t.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
  envValues.set(key, value);
}
if (envValues.size === 0) fail(`${path.relative(ROOT, ENV_FILE)} holds no KEY=value lines — check its formatting.`);

const missing = [...declared.defineString]
  .filter((p) => !envValues.has(p) && !withDefault.has(p))
  .sort();
const committedSecrets = [...declared.defineSecret].filter((p) => (envValues.get(p) ?? '') !== '').sort();
const bothKinds = [...declared.defineString].filter((p) => declared.defineSecret.has(p)).sort();

if (missing.length) {
  fail(
    `these defineString params have no key in ${path.relative(ROOT, ENV_FILE)}:\n` +
      missing.map((p) => `    ${p}`).join('\n') +
      `\n  A deploy demands a literal value for each, and a missing one aborts\n` +
      `  PARTWAY. Add \`${missing[0]}=\` (empty is a value) to the env file, or\n` +
      `  give the declaration a \`default:\` if unset is a legitimate state.`,
  );
}

if (committedSecrets.length) {
  fail(
    `these params live in Secret Manager (defineSecret) but carry a VALUE in\n` +
      `  ${path.relative(ROOT, ENV_FILE)}:\n` +
      committedSecrets.map((p) => `    ${p}`).join('\n') +
      `\n  That is a live credential committed to git. Remove the value — the\n` +
      `  deploy binds defineSecret params by reference\n` +
      `  (\`firebase functions:secrets:set ${committedSecrets[0]}\`).`,
  );
}

if (bothKinds.length) {
  process.stderr.write(
    `check-deploy-params: warning — declared as BOTH defineString and defineSecret: ${bothKinds.join(', ')}.\n` +
      `  Pick one; two declarations of one name are two places to configure it and one will be ignored.\n`,
  );
}

process.stdout.write(
  `check-deploy-params: OK — ${declared.defineString.size} defineString param(s) covered ` +
    `(${withDefault.size} with a default), ${declared.defineSecret.size} defineSecret param(s) left to Secret Manager ` +
    `(${envValues.size} keys in ${path.relative(ROOT, ENV_FILE)}).\n`,
);
