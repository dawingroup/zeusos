/**
 * In-memory Firestore stub — minimal surface area needed by the 3.B
 * callables and their service layer. Supports:
 *   db.doc(path).get/set/update                       (read/write doc)
 *   db.collection(path).doc(id) / .add({...})         (id auto or by .doc())
 *   db.collection(path).where().limit().get()         (basic query)
 *   db.runTransaction(async (tx) => {...})            (single-pass txn;
 *                                                       no retry/conflict)
 *   tx.get/set/update                                  (txn ops)
 *   FieldValue.serverTimestamp() / arrayUnion(...)    (sentinel resolved
 *                                                       on commit)
 *
 * Keep this tiny — the more it grows the harder the contract gap with real
 * Firestore. The integration tests deliberately exercise the txn
 * semantics that matter (single read snapshot, atomic commit, runTxn
 * conflict surface).
 */

const SERVER_TS = Symbol('SERVER_TIMESTAMP');
const ARRAY_UNION = Symbol('ARRAY_UNION');

class FieldValueStub {
  static serverTimestamp() { return { [SERVER_TS]: true }; }
  static arrayUnion(...vals) { return { [ARRAY_UNION]: vals }; }
  static increment(n) { return { __increment: n }; }
}

function resolveSentinels(value) {
  if (value && typeof value === 'object') {
    if (value[SERVER_TS]) return new Date().toISOString();
    if (value[ARRAY_UNION]) return value[ARRAY_UNION]; // tests don't read this back
    if (value instanceof Date) return value;
    if (Array.isArray(value)) return value.map(resolveSentinels);
    const out = {};
    for (const k of Object.keys(value)) out[k] = resolveSentinels(value[k]);
    return out;
  }
  return value;
}

function applyUpdate(existing, update) {
  // Shallow merge with sentinel resolution.
  const merged = { ...(existing || {}) };
  for (const [k, v] of Object.entries(update)) {
    if (v && v.__increment != null) {
      merged[k] = (merged[k] || 0) + v.__increment;
    } else {
      merged[k] = resolveSentinels(v);
    }
  }
  return merged;
}

class Store {
  constructor() {
    // path → data
    this.docs = new Map();
    // path → never (collections are derived from doc paths)
    this._idSeq = 0;
  }
  _nextId() { return `auto_${++this._idSeq}`; }
  has(path) { return this.docs.has(path); }
  get(path) { return this.docs.get(path); }
  set(path, value) { this.docs.set(path, value); }
  delete(path) { this.docs.delete(path); }
  byPrefix(prefix) {
    const out = [];
    for (const [k, v] of this.docs.entries()) {
      if (k.startsWith(prefix + '/')) {
        const rest = k.slice(prefix.length + 1);
        if (rest.indexOf('/') === -1) out.push({ path: k, id: rest, data: v });
      }
    }
    return out;
  }
}

class DocSnap {
  constructor(path, data) {
    this._path = path;
    this._data = data;
    this.exists = data !== undefined;
    this.id = path.split('/').pop();
  }
  data() { return this._data ? { ...this._data } : undefined; }
}

class DocRef {
  constructor(store, path, txn) {
    this._store = store;
    this._path = path;
    this._txn = txn || null;
    this.id = path.split('/').pop();
  }
  async get() {
    if (this._txn) return this._txn.get(this);
    return new DocSnap(this._path, this._store.get(this._path));
  }
  async set(data) {
    this._store.set(this._path, resolveSentinels({ ...data }));
  }
  async update(patch) {
    const existing = this._store.get(this._path);
    if (!existing) throw new Error(`update on missing doc ${this._path}`);
    this._store.set(this._path, applyUpdate(existing, patch));
  }
}

class QueryRef {
  constructor(store, basePath, filters, limit) {
    this._store = store;
    this._base = basePath;
    this._filters = filters || [];
    this._limit = limit;
  }
  where(field, op, value) {
    return new QueryRef(this._store, this._base, [...this._filters, { field, op, value }], this._limit);
  }
  limit(n) {
    return new QueryRef(this._store, this._base, this._filters, n);
  }
  async get() {
    const candidates = this._store.byPrefix(this._base);
    const matched = candidates.filter(({ data }) => {
      return this._filters.every(({ field, op, value }) => {
        if (op === '==') return data && data[field] === value;
        return false;
      });
    });
    const limited = typeof this._limit === 'number' ? matched.slice(0, this._limit) : matched;
    const store = this._store;
    const querySnap = {
      empty: limited.length === 0,
      docs: limited.map(({ id, path, data }) => ({
        id,
        data: () => ({ ...data }),
        exists: true,
        ref: new DocRef(store, path),
      })),
      size: limited.length,
      forEach(cb) { this.docs.forEach(cb); },
    };
    return querySnap;
  }
}

class ColRef extends QueryRef {
  constructor(store, basePath) {
    super(store, basePath, [], undefined);
    this._store = store;
    this._base = basePath;
  }
  doc(id) {
    const docId = id || this._store._nextId();
    return new DocRef(this._store, `${this._base}/${docId}`);
  }
  async add(data) {
    const id = this._store._nextId();
    const path = `${this._base}/${id}`;
    this._store.set(path, resolveSentinels({ ...data }));
    return new DocRef(this._store, path);
  }
}

class Transaction {
  constructor(store) {
    this._store = store;
    this._reads = new Map();    // path → snap (for read-locking semantics)
    this._writes = [];          // queued ops applied on commit
  }
  async get(refOrPath) {
    // tx.get(query) — Admin SDK supports passing a Query; the stub
    // delegates to QueryRef.get for collection scans (used by
    // approveChangeOrder to ripple the new ceiling to OPEN master_jobs).
    if (refOrPath && refOrPath instanceof QueryRef) {
      return refOrPath.get();
    }
    const path = typeof refOrPath === 'string' ? refOrPath : refOrPath._path;
    const data = this._store.get(path);
    const snap = new DocSnap(path, data);
    this._reads.set(path, snap);
    return snap;
  }
  set(refOrPath, data) {
    const path = typeof refOrPath === 'string' ? refOrPath : refOrPath._path;
    this._writes.push({ op: 'set', path, data });
  }
  update(refOrPath, patch) {
    const path = typeof refOrPath === 'string' ? refOrPath : refOrPath._path;
    this._writes.push({ op: 'update', path, patch });
  }
  _commit() {
    for (const w of this._writes) {
      if (w.op === 'set') {
        this._store.set(w.path, resolveSentinels({ ...w.data }));
      } else if (w.op === 'update') {
        const existing = this._store.get(w.path);
        if (!existing) throw new Error(`tx.update on missing doc ${w.path}`);
        this._store.set(w.path, applyUpdate(existing, w.patch));
      }
    }
  }
}

class FirestoreStub {
  constructor() { this._store = new Store(); }
  doc(path) { return new DocRef(this._store, path); }
  collection(path) { return new ColRef(this._store, path); }
  async runTransaction(fn) {
    // Naive single-attempt — does NOT simulate retries / contention.
    const tx = new Transaction(this._store);
    const out = await fn(tx);
    tx._commit();
    return out;
  }
  // helpers for tests
  _seed(path, data) { this._store.set(path, { ...data }); }
  _dump() { return Object.fromEntries(this._store.docs.entries()); }
  _dump_prefix(prefix) {
    return this._store.byPrefix(prefix).map(({ path, data }) => ({ path, data }));
  }
}

/** Build a stub Firestore + matching FieldValue. */
function makeFirestore() {
  return { db: new FirestoreStub(), FieldValue: FieldValueStub };
}

/**
 * Concurrent transaction helper for the §11.1 double-allocation test.
 * Both transactions read the same initial state, then commit in series
 * (mimicking serializable-isolation conflict where the later writer
 * sees the earlier writer's effect). The helper runs `fnA` and `fnB`
 * in parallel up to the point they call `barrier()`, then commits A,
 * then re-runs `fnB` against the updated store.
 *
 * For the spec §11.1 case it's simpler: we run the headroom check
 * against the SAME initial snapshot, but only the first to commit
 * wins — the second's headroom is now off. Our stub doesn't enforce
 * tx isolation, so the test instead runs them sequentially and
 * verifies the second sees the updated allocatedMinor and fails the
 * headroom check.
 */
module.exports = {
  makeFirestore,
  FieldValueStub,
};
