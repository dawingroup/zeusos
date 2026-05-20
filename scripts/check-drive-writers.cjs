/**
 * Governance lint (v3.1 §7).
 *
 * v3.1 §7 states: "Any new DawinOS module that creates Drive-backed
 * artefacts must be added to §4 of this document before it is permitted
 * to write to Drive."
 *
 * This script greps the repo for code that touches the Drive API and
 * cross-checks every hit against `policy/drive-writers.yaml`. CI runs
 * it; a mismatch fails the build with a clear "register this first"
 * message. Pass --fix to get scaffold YAML for any new callsite.
 *
 * Patterns we flag:
 *   - `googleapis.*drive`                     (SDK usage)
 *   - `googleapis/.../drive/v3/files`         (REST endpoint)
 *   - `getGoogleDriveAccessToken` / JWT auth  (service-account pattern)
 *   - multipart Drive uploads                 (the boundary marker)
 *
 * Exits 0 on pass, 1 on any un-registered writer.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const POLICY_FILE = path.join(ROOT, 'policy/drive-writers.yaml');

// ── Tiny YAML reader ────────────────────────────────────────────────────
// We don't pull in a `yaml` dep for this one file — the format is fully
// flat (just `- id:` / `path:` / `allowed:` entries) so a line walker is
// robust enough.
function readRegisteredPaths() {
  if (!fs.existsSync(POLICY_FILE)) {
    console.error(`[lint] FATAL — missing ${path.relative(ROOT, POLICY_FILE)}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(POLICY_FILE, 'utf8').split('\n');
  const entries = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*#/.test(line) || line.trim() === '') continue;
    const idMatch = line.match(/^\s*-\s*id:\s*(.+)$/);
    if (idMatch) {
      if (current) entries.push(current);
      current = { id: idMatch[1].trim(), allowed: false };
      continue;
    }
    if (!current) continue;
    const pathMatch = line.match(/^\s*path:\s*(.+)$/);
    if (pathMatch) current.path = pathMatch[1].trim();
    const allowedMatch = line.match(/^\s*allowed:\s*(true|false)/);
    if (allowedMatch) current.allowed = allowedMatch[1] === 'true';
    const readOnlyMatch = line.match(/^\s*read_only:\s*(true|false)/);
    if (readOnlyMatch) current.readOnly = readOnlyMatch[1] === 'true';
  }
  if (current) entries.push(current);
  return entries;
}

// ── Scan the source tree ────────────────────────────────────────────────
const SCAN_DIRS = ['src', 'functions'];
const SCAN_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx']);

// Files that the policy-check itself mentions — skip to avoid
// self-trip.
const SELF_SKIP = new Set([
  path.resolve(ROOT, 'scripts/check-drive-writers.cjs'),
  path.resolve(ROOT, 'policy/drive-writers.yaml'),
]);

// Directories we shouldn't walk.
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'vendor', '__tests__']);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
}

// Patterns that indicate actual Drive API traffic (not just OAuth scope
// declarations, which live on `auth.ts`/`config.js` for client sign-in).
const PATTERNS = [
  /googleapis\.com\/drive\/v3\//,                          // REST read/search
  /googleapis\.com\/upload\/drive\/v3/,                   // REST upload
  /\bgetGoogleDriveAccessToken\s*\(/,                     // service-account flow
  /\bdrive\.files\.(create|update|delete|insert|copy)\b/, // googleapis SDK
  /oauth2\.googleapis\.com\/token[\s\S]{0,400}urn:ietf:params:oauth:grant-type:jwt-bearer/, // inline JWT exchange
];

function fileWritesToDrive(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return PATTERNS.some((re) => re.test(text));
  } catch {
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────
const registered = readRegisteredPaths();
const registeredPaths = new Set(
  registered.filter((e) => e.allowed).map((e) => path.resolve(ROOT, e.path)),
);

const allFiles = [];
for (const d of SCAN_DIRS) walk(path.join(ROOT, d), allFiles);

const hits = [];
for (const f of allFiles) {
  if (SELF_SKIP.has(f)) continue;
  if (fileWritesToDrive(f)) hits.push(f);
}

const unregistered = hits.filter((h) => !registeredPaths.has(h));

if (unregistered.length === 0) {
  console.log(`[lint] ✓ Drive-writer policy OK — ${hits.length} known writer(s), all registered.`);
  process.exit(0);
}

console.error('\n[lint] ✗ v3.1 §7 VIOLATION — unregistered Drive writers:\n');
for (const u of unregistered) {
  console.error(`    ${path.relative(ROOT, u)}`);
}
console.error('\nFix: add a writers[] entry to policy/drive-writers.yaml AND amend v3.1 §4 first.\n');
console.error('Scaffold for your new entries:\n');
for (const u of unregistered) {
  const rel = path.relative(ROOT, u);
  const id = rel.replace(/[\\/]/g, '-').replace(/\.[^.]+$/, '');
  console.error(`  - id: ${id}`);
  console.error(`    path: ${rel}`);
  console.error(`    target: "<fill — target folder per v3.1 §4>"`);
  console.error(`    notes: "<one-line rationale>"`);
  console.error(`    allowed: true  # only after v3.1 §4 amendment lands`);
  console.error(`    policy_section: "v3.1 §4 — PENDING"`);
  console.error('');
}
process.exit(1);
