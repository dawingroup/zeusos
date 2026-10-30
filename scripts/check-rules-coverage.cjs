#!/usr/bin/env node
/**
 * Firestore rules coverage check — fails CI when the client code references a
 * Firestore collection that has no `match` block in firestore.rules.
 *
 * WHY: firestore.rules has no terminal `match /{document=**}` catch-all (by
 * design — a permissive catch-all would over-share). The flip side is that a
 * brand-new collection default-DENIES for every client until someone remembers
 * to add a match block, which is the structural reason module updates keep
 * re-breaking staff access ("Missing or insufficient permissions"). This check
 * closes that gap at author time: add a collection in src/ without a rules
 * block and the build fails with the collection named.
 *
 * HOW: scan src/ for `collection()` / `collectionGroup()` / `doc()` call sites,
 * resolve the FULL path each one targets (every variadic arg and every
 * slash-joined segment), and verify a match block reaches that path's leaf
 * collection through the rules' real nesting:
 *
 *   collection(db, 'designProjects', id, 'priceOverrides')
 *     needs  match /designProjects/{p} { match /priceOverrides/{o} … }
 *     or     match /{path=**}/priceOverrides/{o}
 *
 * Until 2026-10 the gate recorded only the FIRST segment and accepted a name
 * that appeared in ANY match statement, so that exact subcollection — with no
 * block at all — was default-denied in production for months behind a green
 * gate. Also checked now: a `collectionGroup()` needs a `{path=**}` rule (a
 * nested rule does not authorise a group query), `collection(parentRef, 'sub')`
 * must be the TAIL of some match path, and a path with the wrong segment
 * parity (a collection ref with an even count) is reported, since it throws.
 *
 * Intentional exceptions live in scripts/rules-coverage-allowlist.json: `allow`
 * (names, e.g. Admin-SDK-only collections) and `allowSites` (per key AND file,
 * for dead scaffolding and owner-accepted denials).
 *
 * Three access shapes were invisible to the original literal-only regex, and a
 * collection reached ONLY through one of them shipped with no rules coverage
 * and a passing gate (`portalSceneLayoutFailures`, PR #1002, was exactly this):
 *
 *   1. `doc(db, 'name', id)` — the whole `doc()` form was never scanned, so a
 *      service that only ever writes single documents by id was unseen. 415
 *      files use it.
 *   2. `collection(db, NAME_CONST)` — the path arg had to be a quoted literal,
 *      so the near-universal `const X_COLLECTION = 'x'` convention defeated it.
 *      229 files use it.
 *   3. `collection(db, `parent/${id}/sub`)` — any `$` in the literal skipped the
 *      whole site, even when the FIRST segment (the part that names the
 *      top-level collection) is perfectly static.
 *
 * Resolution of named constants is deliberately conservative: same-file `const
 * X = '…'` first, then a cross-file index for imported constants — but only
 * when the name maps to exactly ONE literal repo-wide. A name defined twice
 * with different values is reported as unresolved rather than guessed, so the
 * gate never fails CI on a collection nobody actually references.
 *
 * Run: node scripts/check-rules-coverage.cjs [--verbose]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const RULES_FILE = path.join(ROOT, 'firestore.rules');
const ALLOWLIST_FILE = path.join(__dirname, 'rules-coverage-allowlist.json');
const VERBOSE = process.argv.includes('--verbose');

/**
 * Identifiers that hold a CLIENT Firestore instance. Only these make a
 * `doc(handle, 'x', id)` call an access site that rules govern. `adminDb` and
 * friends are Admin SDK — they bypass rules entirely, so demanding a match
 * block for them would be noise.
 */
const DB_HANDLES = new Set(['db', 'firestore', 'this.db', 'firestoreDb']);

/**
 * Recursively list client source files under a dir.
 *
 * `*.test.*` / `*.spec.*` files are skipped. `.js`/`.jsx` are included, not just TypeScript: the app entry is
 * `src/main.jsx`, and four legacy `.js` services still talk to Firestore
 * directly. A `.ts`-only walk left those collections unscanned.
 */
// Test files are not access sites: they run against mocks or the emulator,
// never a browser, and this file's own unit test is full of fixture paths.
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

function listSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) && !TEST_FILE.test(entry.name)) out.push(full);
  }
  return out;
}

// `const X = 'literal'` / `export const X: string = 'literal'`. Template
// literals are included so long as they carry no interpolation.
// The literal must END the initialiser (`;`, `,`, `)`, newline, `as const`):
// `const code = 'orderNumber' in scope ? … : …` is an expression, not a name.
const CONST_RE = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]| ]+)?\s*=\s*(['"`])([^'"`\n]*)\2(?=\s*(?:as\s+const\s*)?(?:[;,)\n]|$))/g;

/**
 * Call sites of the three Firestore path builders, with an argument list that
 * tolerates ONE level of nested parens (`collection(db, x)` inside `doc(...)`,
 * a `${}` template, a `.trim()` call). Deeper nesting is rare in path
 * expressions and degrades to "unresolved", which is the safe direction.
 */
const CALL_RE = /\b(collectionGroup|collection|doc)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;

// `doc(collection(db, 'X')).id` mints a random document id — it never reads or
// writes collection X, so it is NOT an access site and must not demand a rules
// block (collections named `_` / `temp` exist only to serve this).
const ID_GEN_RE = /\bdoc\s*\(\s*collection\s*\([^()]*\)\s*\)\s*\.id/g;

function idGenSpans(text) {
  const spans = [];
  let m;
  ID_GEN_RE.lastIndex = 0;
  while ((m = ID_GEN_RE.exec(text))) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

/** Split an argument list on TOP-LEVEL commas only. */
function splitArgs(argText) {
  const args = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < argText.length; i++) {
    const ch = argText[i];
    if (quote) {
      current += ch;
      if (ch === quote && argText[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; current += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * Collect every `const NAME = 'literal'` in a file. A template const is
 * expanded through the file's OTHER consts (`${LIBRARY_ROOT}/formulas`); one
 * still interpolated after that (`${companyId}/x`) is kept raw, so that it
 * SHADOWS any same-named const in another file — falling back to the cross-file
 * index there resolved formulaLibraryService's `FORMULAS_COLLECTION` to a
 * sibling service's `'matflow/data/formulas'`, a different collection.
 */
function constsIn(text) {
  const map = new Map();
  let m;
  CONST_RE.lastIndex = 0;
  while ((m = CONST_RE.exec(text))) map.set(m[1], m[3]);
  for (let pass = 0; pass < 3; pass++) {
    for (const [name, value] of map) {
      if (!value.includes('${')) continue;
      map.set(name, value.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (whole, ref) => {
        const v = map.get(ref);
        return v !== undefined && ref !== name && !v.includes('${') ? v : whole;
      }));
    }
  }
  return map;
}

/** Names a file exports: `export const X` and `export { X, Y as Z }`. */
function exportedNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/\bexport\s+const\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of text.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const local = part.trim().split(/\s+as\s+/)[0].trim();
      if (local) names.add(local);
    }
  }
  return names;
}

/**
 * Resolve a path argument to a string, or null when it cannot be resolved
 * statically. Handles a quoted/template literal and a named constant (local
 * definition wins over the cross-file index).
 */
function resolvePathArg(arg, localConsts, globalConsts) {
  const literal = /^(['"`])([\s\S]*)\1$/.exec(arg);
  if (literal) return literal[2];
  if (/^[A-Za-z_$][\w$]*$/.test(arg)) {
    if (localConsts.has(arg)) return localConsts.get(arg);
    if (!globalConsts) return null;
    const candidates = globalConsts.get(arg);
    // Ambiguous across files — refuse to guess rather than risk a false failure.
    if (candidates && candidates.size === 1) return [...candidates][0];
  }
  return null;
}

/**
 * Resolve the PATH arguments of `collection(db, a, id, b, …)` /
 * `doc(db, a, id, …)` into a segment list. Firestore joins the variadic args
 * with '/', so `('a', id, 'b')`, `'a/x/b'` and `` `a/${id}/b` `` all name the
 * same path. Collection names sit at EVEN positions (0, 2, 4…), document ids
 * at odd ones.
 *
 * Each segment is `{ lit: 'name' }` or `{ wild: true }`. A non-literal arg is
 * taken to be ONE segment: at an id position it is a wildcard (the normal
 * `projectId` variable); at a collection-name position the path cannot be
 * known from there on, so resolution stops and `unresolvedAt` records the arg.
 * The segments resolved before it are still returned and still checked.
 *
 * Until 2026-10 only the first segment of `args[1]` was recorded, so
 * `collection(db, 'designProjects', projectId, 'priceOverrides')` counted as
 * `designProjects` — and the subcollection, which had NO match block, was
 * default-denied in production for months behind a green gate.
 */
function resolvePathSegments(pathArgs, localConsts, globalConsts) {
  const segments = [];
  for (const arg of pathArgs) {
    // At an id position a bare identifier is almost always a parameter
    // (`code`, `id`) — never look it up in the cross-file index, where some
    // unrelated `const code = 'orderNumber'` would turn it into a path.
    const atId = segments.length % 2 === 1;
    const value = resolvePathArg(arg, localConsts, atId ? null : globalConsts);
    if (value === null) {
      if (segments.length % 2 === 0) return { segments, unresolvedAt: arg };
      segments.push({ wild: true });
      continue;
    }
    for (const raw of value.split('/')) {
      const seg = raw.trim();
      if (!seg) continue; // leading/trailing/double slashes
      if (seg.includes('${')) {
        if (segments.length % 2 === 0) return { segments, unresolvedAt: arg };
        segments.push({ wild: true });
      } else {
        segments.push({ lit: seg });
      }
    }
  }
  return { segments, unresolvedAt: null };
}

/**
 * The ONE collection a resolved path accesses: the path itself for a
 * collection reference (odd length), its parent for a document reference.
 * `a/{id}/b` and `a/{id}/b/{id2}` both access `a/{id}/b` — and only that:
 * Firestore evaluates rules on the requested path alone, never on its
 * ancestors, so `matflow/data/formulas` needs `match /matflow/data/formulas/{f}`
 * and nothing at all for `matflow`. Null when the path is empty.
 */
function leafCollectionPath(segments) {
  if (!segments.length) return null;
  return segments.length % 2 === 1 ? segments : segments.slice(0, -1);
}

function pathKey(collectionPath) {
  return collectionPath.map((s, i) => (i % 2 === 1 ? '*' : s.lit)).join('/');
}

function collect(files = listSourceFiles(SRC), readFile = (f) => fs.readFileSync(f, 'utf8')) {
  // Cross-file constant index, built first so an imported `X_COLLECTION`
  // resolves regardless of scan order. Values are a Set so a name defined
  // twice with different literals is detectably ambiguous.
  const globalConsts = new Map();
  const fileTexts = new Map();
  for (const file of files) {
    const text = readFile(file);
    fileTexts.set(file, text);
    const exported = exportedNames(text);
    for (const [name, value] of constsIn(text)) {
      // Only an EXPORTED const can be imported elsewhere. Indexing every const
      // let a function-local `const name = 'emulator-admin'` in one file
      // resolve another file's `name` PARAMETER.
      if (!exported.has(name)) continue;
      if (value.includes('${')) continue; // per-call value, not a shared name
      if (!globalConsts.has(name)) globalConsts.set(name, new Set());
      globalConsts.get(name).add(value);
    }
  }

  // key -> { segments, file }. Full collection paths reached from the root
  // through `db`; these must be matched by a NESTED match path.
  const paths = new Map();
  // `…/sub` -> { segments, file }. `collection(parentRef, 'sub')`: the parent
  // is a runtime value, so the path is known only from the end — it must be
  // the TAIL of some match path (`…/sub/{id}`).
  const relative = new Map();
  const groups = new Map();
  const unresolved = [];
  const invalid = []; // { rel, fn, path }: wrong segment parity
  // key -> Set of files: every access site, for triage (`--sites`).
  const sites = new Map();
  const note = (key, rel) => {
    if (!sites.has(key)) sites.set(key, new Set());
    sites.get(key).add(rel);
  };

  for (const file of files) {
    const text = fileTexts.get(file);
    const rel = path.isAbsolute(file) ? path.relative(ROOT, file) : file;
    const localConsts = constsIn(text);
    const spans = idGenSpans(text);
    const inIdGen = (idx) => spans.some(([s, e]) => idx >= s && idx < e);

    let m;
    CALL_RE.lastIndex = 0;
    while ((m = CALL_RE.exec(text))) {
      // Resume INSIDE the match, so a call nested in this one's arguments —
      // `doc(collection(db, 'a', id, 'b'), x)` — is scanned too. Consuming
      // the whole outer call hid every such inner collection.
      CALL_RE.lastIndex = m.index + m[1].length + 1;
      if (inIdGen(m.index)) continue; // pure id-generation, not an access site
      const fn = m[1];
      const args = splitArgs(m[2]);
      if (args.length < 1) continue;

      if (fn === 'collectionGroup') {
        // collectionGroup(db, 'name')
        const value = resolvePathArg(args[1] ?? '', localConsts, globalConsts);
        if (value === null || value.includes('${')) { unresolved.push({ rel, fn, arg: args[1] ?? '' }); continue; }
        const name = value.trim();
        if (name && !groups.has(name)) groups.set(name, rel);
        if (name) note(`**/${name}`, rel);
        continue;
      }

      if (args.length < 2) continue;

      if (!DB_HANDLES.has(args[0])) {
        // ONLY `doc(db, path, ...)` names a collection. `doc(colRef, id)` and
        // `doc(docRef)` take a document id / reference as arg 2 — treating that
        // as a collection name would invent collections that do not exist.
        if (fn === 'doc') continue;
        // collection(parentDocRef, 'sub'[, id, 'sub2']): arg 2 IS a
        // collection name, but under a parent we cannot see.
        const { segments, unresolvedAt } = resolvePathSegments(args.slice(1), localConsts, globalConsts);
        if (unresolvedAt !== null) { unresolved.push({ rel, fn, arg: unresolvedAt }); continue; }
        const leaf = leafCollectionPath(segments);
        if (!leaf) continue;
        const key = `…/${pathKey(leaf)}`;
        if (!relative.has(key)) relative.set(key, { segments: leaf, file: rel });
        note(key, rel);
        continue;
      }

          // The leaf's WHOLE path must be reached by a nested match.
      const { segments, unresolvedAt } = resolvePathSegments(args.slice(1), localConsts, globalConsts);
      if (unresolvedAt !== null) { unresolved.push({ rel, fn, arg: unresolvedAt }); continue; }
      // A collection reference needs an ODD number of segments, a document
      // reference an EVEN one; anything else throws at runtime ("Invalid
      // collection reference") before rules are ever consulted.
      if (segments.length && (segments.length % 2 === 1) !== (fn === 'collection')) {
        invalid.push({ rel, fn, path: pathKey(segments) });
        note(`invalid ${fn}(${pathKey(segments)})`, rel);
        continue;
      }
      const leaf = leafCollectionPath(segments);
      if (!leaf) continue;
      const key = pathKey(leaf);
      if (!paths.has(key)) paths.set(key, { segments: leaf, file: rel });
      note(key, rel);
    }
  }

  return { paths, relative, groups, unresolved, invalid, sites };
}

/** Blank out comments and string literals, keeping offsets (and newlines). */
function stripRulesNoise(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') { out += ' '; i++; }
      if (i < text.length) out += '\n';
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      out += '  '; i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) { out += text[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      out += ch; i++;
      while (i < text.length && text[i] !== ch) { out += text[i] === '\n' ? '\n' : ' '; if (text[i] === '\\') { out += ' '; i++; } i++; }
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

const MATCH_SEG = String.raw`(?:\{[^}\s]*\}|[^\s{}/]+)`;
const MATCH_RE = new RegExp(String.raw`\bmatch\s+(\/${MATCH_SEG}(?:\/${MATCH_SEG})*)\s*\{`, 'y');

/**
 * Every match block's FULL path, with nesting resolved and the
 * `/databases/{database}/documents` root stripped. Segments are
 * `{ lit }`, `{ wild }` (`{x}`) or `{ rest }` (`{x=**}`, zero or more).
 */
function parseMatchPaths(rulesText) {
  const text = stripRulesNoise(rulesText);
  const stack = []; // { depth, segments }
  const out = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === 'm') {
      MATCH_RE.lastIndex = i;
      const m = MATCH_RE.exec(text);
      if (m && (i === 0 || !/[\w$]/.test(text[i - 1]))) {
        const parent = stack.length ? stack[stack.length - 1].segments : [];
        const own = m[1].split('/').filter(Boolean).map((seg) => {
          if (seg.startsWith('{')) return /=\*\*\}$/.test(seg) ? { rest: true } : { wild: true };
          return { lit: seg };
        });
        let segments = [...parent, ...own];
        // The service root — `match /databases/{database}/documents`.
        if (segments.length >= 3 && segments[0].lit === 'databases' && segments[1].wild && segments[2].lit === 'documents') {
          segments = segments.slice(3);
        }
        depth++;
        stack.push({ depth, segments });
        if (segments.length) out.push(segments);
        i = MATCH_RE.lastIndex - 1;
        continue;
      }
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      if (stack.length && stack[stack.length - 1].depth === depth) stack.pop();
      depth--;
    }
  }
  return out;
}

/**
 * Does a match pattern match a concrete request path? A request wildcard (an
 * id we only know as a variable) matches any pattern segment — the gate asks
 * whether SOME rule can reach the collection, not whether every id is allowed.
 */
function patternMatches(pattern, request, pi = 0, ri = 0) {
  if (pi === pattern.length) return ri === request.length;
  const p = pattern[pi];
  if (p.rest) {
    for (let k = ri; k <= request.length; k++) if (patternMatches(pattern, request, pi + 1, k)) return true;
    return false;
  }
  if (ri === request.length) return false;
  const r = request[ri];
  if (p.lit !== undefined && r.lit !== undefined && p.lit !== r.lit) return false;
  return patternMatches(pattern, request, pi + 1, ri + 1);
}

/** Is a collection path (ending in its name) reachable by any match block? */
function pathCovered(matchPaths, collectionPath) {
  const docPath = [...collectionPath, { wild: true }];
  return matchPaths.some((p) => patternMatches(p, docPath));
}

/**
 * Is a collection-group query on `name` reachable? It needs a recursive
 * `{path=**}` somewhere before the group name: `match /{path=**}/name/{id}`.
 */
function groupCovered(matchPaths, name) {
  return matchPaths.some((p) => {
    const n = p.length;
    if (n < 2 || p[n - 2].lit !== name) return false;
    if (!(p[n - 1].wild || p[n - 1].rest)) return false;
    return p.slice(0, n - 2).some((s) => s.rest);
  });
}

/**
 * Is a path known only from its END (`collection(parentRef, 'sub')`) reachable?
 * Some match path must contain it as a TAIL anchored on the same literal name
 * (`…/sub/{id}`, `{path=**}/sub/{id}`): the parent could be anything. A bare
 * trailing `{document=**}` does not count — under an unknown parent it would
 * "cover" every name there is.
 */
function tailCovered(matchPaths, collectionPath) {
  const docPath = [...collectionPath, { wild: true }];
  const first = collectionPath[0].lit;
  return matchPaths.some((p) => p.some((seg, k) => seg.lit === first && patternMatches(p.slice(k), docPath)));
}

/**
 * The gaps: what the code reaches that no match block covers, plus paths whose
 * segment parity makes the call throw.
 *
 * Two allowlist forms. `allow` holds plain names (a top-level collection, a
 * subcollection name, a collection group) and silences the name EVERYWHERE.
 * `allowSites` holds `{ key: { files: [...] } }` and silences only those
 * files' access sites, so a NEW caller of the same path still fails — use it
 * for anything that is not genuinely Admin-SDK-only.
 */
function findMissing(rulesText, collected, allowlist = new Set(), allowSites = {}) {
  const matchPaths = parseMatchPaths(rulesText);
  const missing = [];
  const sitesOf = (key, fallback) => [...(collected.sites?.get(key) || [fallback])];
  const consider = (key, file, kind) => {
    const listed = new Set((allowSites[key] && allowSites[key].files) || []);
    const open = sitesOf(key, file).filter((f) => !listed.has(f));
    if (open.length) missing.push({ name: key, file: open[0], files: open, kind });
  };
  for (const [key, { segments, file }] of collected.paths) {
    if (allowlist.has(key)) continue;
    if (segments.length === 1 && allowlist.has(segments[0].lit)) continue;
    if (!pathCovered(matchPaths, segments)) consider(key, file, 'path');
  }
  for (const [key, { segments, file }] of collected.relative) {
    if (allowlist.has(key) || allowlist.has(segments[segments.length - 1].lit)) continue;
    if (!tailCovered(matchPaths, segments)) consider(key, file, 'subcollection');
  }
  for (const [name, file] of collected.groups) {
    if (allowlist.has(name) || allowlist.has(`**/${name}`)) continue;
    if (!groupCovered(matchPaths, name)) consider(`**/${name}`, file, 'group');
  }
  for (const { rel, fn, path: p } of collected.invalid || []) {
    const key = `invalid ${fn}(${p})`;
    if (!missing.some((m) => m.name === key)) consider(key, rel, 'invalid');
  }
  return missing;
}

/**
 * `allowSites` entries that no longer suppress anything (the gap was fixed or
 * the file stopped reaching it). Reported, not failed: a stale entry hides
 * nothing, but it should be deleted so the list stays an honest backlog.
 */
function staleAllowSites(rulesText, collected, allowlist, allowSites) {
  const live = findMissing(rulesText, collected, allowlist, {});
  const byKey = new Map(live.map((m) => [m.name, new Set(m.files)]));
  const stale = [];
  for (const [key, entry] of Object.entries(allowSites)) {
    if (key.startsWith('_')) continue;
    const open = byKey.get(key) || new Set();
    for (const f of entry.files || []) if (!open.has(f)) stale.push(`${key}  ${f}`);
  }
  return stale;
}

function main() {
  if (!fs.existsSync(RULES_FILE)) {
    console.error(`firestore.rules not found at ${RULES_FILE}`);
    process.exit(2);
  }
  const rules = fs.readFileSync(RULES_FILE, 'utf8');
  const allowJson = fs.existsSync(ALLOWLIST_FILE) ? JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8')) : {};
  const allowlist = new Set(allowJson.allow || []);
  const allowSites = allowJson.allowSites || {};

  const collected = collect();
  const { paths, relative, groups, unresolved } = collected;
  const missing = findMissing(rules, collected, allowlist, allowSites);
  for (const line of staleAllowSites(rules, collected, allowlist, allowSites)) {
    console.warn(`⚠ stale allowSites entry (nothing to suppress any more — delete it): ${line}`);
  }

  if (VERBOSE) {
    console.log(`Resolved ${paths.size} collection paths + ${relative.size} relative subcollections + ${groups.size} collection groups.`);
    console.log(`Unresolved dynamic path args (skipped): ${unresolved.length}`);
    for (const u of unresolved.slice(0, 40)) console.log(`   ? ${u.fn}(… ${u.arg})   ${u.rel}`);
  }

  const scanned = paths.size + relative.size + groups.size;
  const sited = Object.keys(allowSites).filter((k) => !k.startsWith('_')).length;
  if (missing.length) {
    console.error(`\n✗ Firestore rules coverage: ${missing.length} collection(s) referenced in src/ have NO match block in firestore.rules:\n`);
    for (const { name, files } of missing.sort((a, b) => a.name.localeCompare(b.name))) {
      console.error(`   • ${name}`);
      for (const f of files) console.error(`       ${f}`);
    }
    console.error(`\n\`invalid …\` entries have the wrong number of path segments and throw at runtime.`);
    console.error(`A nested path needs a NESTED match (match /parent/{id}/sub/{subId}, or a`);
    console.error(`/{path=**}/sub/{id} group match) — the name appearing elsewhere does not count.`);
    console.error(`Add a match block (with a module-aware canRead*/canWrite* gate) to firestore.rules,`);
    console.error(`or, if the collection is Admin-SDK-only and no client ever touches it, add it to`);
    console.error(`scripts/rules-coverage-allowlist.json (\`allowSites\`, per file, for anything else).\n`);
    process.exit(1);
  }

  console.log(`✓ Firestore rules coverage: all ${scanned} client-referenced collections have match blocks (allowlist: ${allowlist.size} names, ${sited} per-file entries).`);
}

module.exports = {
  splitArgs,
  constsIn,
  resolvePathArg,
  resolvePathSegments,
  leafCollectionPath,
  pathKey,
  collect,
  parseMatchPaths,
  patternMatches,
  pathCovered,
  groupCovered,
  tailCovered,
  findMissing,
  staleAllowSites,
};

if (require.main === module) main();
