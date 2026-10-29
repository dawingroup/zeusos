/**
 * People directory for the task engine's SERVER-side writers — one scan of
 * `employees` + `users`, indexed by employee doc id AND auth uid AND email.
 *
 * Tasks are assigned by Auth uid (`assignedToUserId`); plans are keyed by uid;
 * managers are found through the employee record (`position.reportingTo`,
 * an employee doc id) and then mapped back to a uid. A uid with no employee
 * record (a parent-org admin) still gets a directory entry from `users`, so
 * work assigned to them is still planned.
 *
 * `db` is passed in; no Firebase at module load, so the node tests inject the
 * in-memory stub.
 */

const EMPLOYEES_COLLECTION = 'employees';
const USERS_COLLECTION = 'users';
const WORKING_STATUSES = ['active', 'probation', 'notice_period'];

function nameOfEmployee(e) {
  return (
    e.fullName ||
    [e.firstName, e.lastName].filter(Boolean).join(' ') ||
    e.preferredName ||
    e.displayName ||
    null
  );
}

function emailOf(e) {
  const v = e.email || e.workEmail || (e.systemAccess && e.systemAccess.email) || null;
  return typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : null;
}

/**
 * @typedef {object} PersonRecord
 * @property {string|null} employeeId
 * @property {string|null} uid
 * @property {string|null} name
 * @property {string|null} email
 * @property {string|null} managerEmployeeId
 * @property {string|null} managerUid
 * @property {string|null} managerName
 * @property {string|null} subsidiaryId
 * @property {string|null} departmentId
 * @property {string|null} roleProfileId
 * @property {string[]|null} workDays
 */

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ includeExStaff?: boolean }} [opts]
 * @returns {Promise<Map<string, PersonRecord>>} keyed by employeeId, uid and email
 */
async function loadDirectory(db, opts = {}) {
  let q = db.collection(EMPLOYEES_COLLECTION);
  if (!opts.includeExStaff) q = q.where('employmentStatus', 'in', WORKING_STATUSES);
  const [empSnap, userSnap] = await Promise.all([
    q.get(),
    db.collection(USERS_COLLECTION).limit(2000).get(),
  ]);

  // users/{uid}: email → uid, uid → profile (display name, home org).
  const uidByEmail = new Map();
  const userById = new Map();
  for (const d of userSnap.docs) {
    const u = d.data() || {};
    const uid = u.uid || d.id;
    userById.set(uid, { uid, ...u });
    const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : null;
    if (email && !uidByEmail.has(email)) uidByEmail.set(email, uid);
  }

  const byKey = new Map();
  const records = [];
  for (const d of empSnap.docs) {
    const e = d.data() || {};
    const email = emailOf(e);
    const linked = e.systemAccess && typeof e.systemAccess.userId === 'string' ? e.systemAccess.userId : null;
    // The linked uid wins when it names a real user; a synthetic HR id does not.
    const uid = (linked && userById.has(linked) ? linked : null) || (email && uidByEmail.get(email)) || linked || null;
    const record = {
      employeeId: d.id,
      uid,
      name: nameOfEmployee(e),
      email,
      managerEmployeeId: (e.position && e.position.reportingTo) || e.reportingTo || null,
      managerUid: null,
      managerName: null,
      subsidiaryId: e.subsidiaryId || e.subsidiary || null,
      departmentId: (e.position && e.position.departmentId) || null,
      roleProfileId: e.roleProfileId || (e.position && e.position.roleProfileId) || null,
      workDays: (e.workSchedule && e.workSchedule.workDays) || null,
    };
    records.push(record);
    byKey.set(d.id, record);
    if (record.uid && !byKey.has(record.uid)) byKey.set(record.uid, record);
    if (email && !byKey.has(email)) byKey.set(email, record);
  }

  // Users with no employee record still exist as people (parent-org admins).
  for (const [uid, u] of userById) {
    if (byKey.has(uid)) continue;
    if (u.isActive === false) continue;
    const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : null;
    const record = {
      employeeId: null,
      uid,
      name: u.displayName || u.name || (email ? email.split('@')[0] : null),
      email,
      managerEmployeeId: null,
      managerUid: null,
      managerName: null,
      subsidiaryId: u.homeOrgId || null,
      departmentId: u.department || null,
      roleProfileId: null,
      workDays: null,
    };
    records.push(record);
    byKey.set(uid, record);
    if (email && !byKey.has(email)) byKey.set(email, record);
  }

  // Second pass: the manager's uid + name, now that every record exists.
  for (const r of records) {
    if (!r.managerEmployeeId) continue;
    const m = byKey.get(r.managerEmployeeId);
    if (!m) continue;
    r.managerUid = m.uid || null;
    r.managerName = m.name || null;
  }
  return byKey;
}

/** Display name for any person key, or null — NEVER the key itself. */
function nameFor(directory, key) {
  if (!key || typeof key !== 'string') return null;
  const rec = directory.get(key) || directory.get(key.trim().toLowerCase());
  return (rec && rec.name) || null;
}

/**
 * Resolve any id a task may carry (uid, employee doc id, email) to ONE stable
 * key per person — their uid when the directory knows one. Falls back to the
 * raw key so a task assigned to someone the directory does not know still
 * gets a plan rather than being dropped.
 */
function canonicalAssigneeId(rawKey, directory) {
  if (!rawKey) return null;
  const person = directory ? directory.get(rawKey) || directory.get(String(rawKey).toLowerCase()) : null;
  return (person && person.uid) || rawKey;
}

/** Group candidate tasks by PERSON, not by the id a task happens to carry. */
function groupByAssignee(tasks, directory) {
  const { assigneeOf } = require('./taskModel');
  const byAssignee = new Map();
  for (const t of tasks || []) {
    const raw = assigneeOf(t);
    if (!raw) continue;
    const key = canonicalAssigneeId(raw, directory);
    const list = byAssignee.get(key) || [];
    list.push(t);
    byAssignee.set(key, list);
  }
  return byAssignee;
}

/**
 * ONE person's uid from whatever key a caller sends (uid, employee doc id or
 * email) — the single-lookup counterpart of `loadDirectory` for a callable
 * that resolves one assignee. Returns { uid, name, employeeId } or null.
 */
async function resolvePersonUid(db, rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const key = rawKey.trim();
  if (!key) return null;

  // An existing user doc keyed by uid.
  const userSnap = await db.collection(USERS_COLLECTION).doc(key).get();
  if (userSnap.exists) {
    const u = userSnap.data() || {};
    return { uid: key, name: u.displayName || u.name || null, employeeId: null };
  }

  // An employee doc id.
  if (!key.includes('@')) {
    const empSnap = await db.collection(EMPLOYEES_COLLECTION).doc(key).get();
    if (empSnap.exists) {
      const e = empSnap.data() || {};
      const linked = e.systemAccess && e.systemAccess.userId;
      if (linked) {
        const linkedUser = await db.collection(USERS_COLLECTION).doc(linked).get();
        if (linkedUser.exists) return { uid: linked, name: nameOfEmployee(e), employeeId: key };
      }
      const email = emailOf(e);
      if (email) {
        const byEmail = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
        if (!byEmail.empty) return { uid: byEmail.docs[0].data().uid || byEmail.docs[0].id, name: nameOfEmployee(e), employeeId: key };
      }
      if (linked) return { uid: linked, name: nameOfEmployee(e), employeeId: key };
      return null;
    }
  }

  // An email.
  const email = key.toLowerCase();
  if (email.includes('@')) {
    const byEmail = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
    if (!byEmail.empty) {
      const u = byEmail.docs[0].data() || {};
      return { uid: u.uid || byEmail.docs[0].id, name: u.displayName || null, employeeId: null };
    }
  }
  return null;
}

/**
 * The owner — the last stop for work nobody else can take. Sorted by email so
 * repeated runs pick the same person. Owners first, then admins.
 */
async function findOwnerUser(db) {
  for (const role of ['owner', 'admin']) {
    const snap = await db.collection(USERS_COLLECTION).where('globalRole', '==', role).get();
    const people = snap.docs
      .map((d) => ({ uid: d.data().uid || d.id, ...d.data() }))
      .filter((u) => u.isActive !== false)
      .sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));
    if (people.length) {
      const u = people[0];
      return { uid: u.uid, name: u.displayName || u.name || u.email || null, email: u.email || null, matchedRole: role };
    }
  }
  return null;
}

module.exports = {
  EMPLOYEES_COLLECTION,
  USERS_COLLECTION,
  WORKING_STATUSES,
  loadDirectory,
  nameFor,
  nameOfEmployee,
  canonicalAssigneeId,
  groupByAssignee,
  resolvePersonUid,
  findOwnerUser,
};
