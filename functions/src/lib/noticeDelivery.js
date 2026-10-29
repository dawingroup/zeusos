/**
 * Writes in-app notices: the I/O half of lib/inAppNotice.js.
 *
 *   notifyUser(db, notice)                  one person, by Auth uid
 *   notifyUsers(db, uids, notice)           the same notice to several people
 *   notifyAudience(db, { audience, ... })   everyone an audience resolves to:
 *       { kind: 'user', uid | personKey }       a uid, an employee id or an email
 *       { kind: 'role', role }                  everyone with that globalRole
 *       { kind: 'parent_org' }                  Zeus Group (Account Management) principals
 *       { kind: 'brand_leads', subsidiaryId }   the brand's delivery leads, else its MDs
 *       { kind: 'brand_staff', subsidiaryId }   everyone whose home org is the brand
 *       { kind: 'role_profile', roleProfileId } holders of a role profile (active role_assignments)
 *   resolveAudience(db, audience)           the uids an audience names (for tests and callers)
 *
 * All best-effort. A notice is never the record of what happened, so a failed
 * write logs and returns and never fails the caller's business write. Pass the
 * db handle in, as every lib helper here does, so tests can inject a fake.
 *
 * Dedupe: with a `dedupeKey` the doc id is `${dedupeKey}_${userId}` and a
 * second write for the same key and person does nothing — a daily alert
 * re-evaluated on every run never flips a notice the person already read back
 * to unread. Real Firestore uses `create()` (atomic); a stub without it falls
 * back to get-then-set.
 */

const { logger } = require('firebase-functions');

const { NOTICES_COLLECTION, buildNotice, noticeDocId } = require('./inAppNotice');

const PARENT_ORG_ID = 'zeus-group';
const USER_COLLECTIONS = ['users', 'organizations/default/users'];
const ROLE_ORDER = ['owner', 'admin', 'manager', 'member', 'viewer'];

function nowIso(deps) {
  return (deps && deps.nowIso) || new Date().toISOString();
}

function log(deps) {
  return (deps && deps.logger) || logger;
}

// ── one person ──────────────────────────────────────────────────────────────

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} notice - buildNotice input, plus an optional `dedupeKey`.
 * @param {{ nowIso?: string, logger?: object }} [deps]
 * @returns {Promise<boolean>} whether a notice was written
 */
async function notifyUser(db, notice, deps = {}) {
  const { dedupeKey, ...input } = notice || {};
  let fields;
  try {
    fields = { ...buildNotice(input), createdAt: nowIso(deps) };
  } catch (err) {
    log(deps).warn('[notice] not written: invalid notice', { type: input.type || null, error: err.message });
    return false;
  }
  const col = db.collection(NOTICES_COLLECTION);
  try {
    if (dedupeKey) {
      const ref = col.doc(noticeDocId(dedupeKey, fields.userId));
      if (typeof ref.create === 'function') {
        try {
          await ref.create(fields);
        } catch (err) {
          // gRPC 6 = ALREADY_EXISTS: this person already has this notice.
          if (err && (err.code === 6 || err.code === 'already-exists')) return false;
          throw err;
        }
      } else {
        const snap = await ref.get();
        if (snap.exists) return false;
        await ref.set(fields);
      }
    } else {
      await col.add(fields);
    }
    return true;
  } catch (err) {
    log(deps).warn('[notice] write failed', { type: fields.type, userId: fields.userId, error: err.message });
    return false;
  }
}

/** The same notice to several people. Returns how many were written. */
async function notifyUsers(db, uids, notice, deps = {}) {
  let written = 0;
  for (const uid of new Set((uids || []).filter(Boolean))) {
    if (await notifyUser(db, { ...notice, userId: uid }, deps)) written++;
  }
  return written;
}

// ── who an audience is ──────────────────────────────────────────────────────

/** Every user record across the two user collections, keyed by uid. Active only. */
async function loadUsers(db) {
  const byUid = new Map();
  for (const col of USER_COLLECTIONS) {
    let snap;
    try { snap = await db.collection(col).limit(2000).get(); } catch { continue; }
    for (const d of snap.docs) {
      const u = d.data() || {};
      const uid = u.uid || d.id;
      if (!uid || byUid.has(uid) || u.isActive === false) continue;
      byUid.set(uid, { uid, ...u });
    }
  }
  return byUid;
}

function isParentOrgUser(u) {
  if (u.homeOrgId === PARENT_ORG_ID) return true;
  return Array.isArray(u.subsidiaryAccess) && u.subsidiaryAccess.some((s) => s && s.subsidiaryId === PARENT_ORG_ID && s.hasAccess !== false);
}

function sortedUids(users) {
  return users
    .sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')))
    .map((u) => u.uid);
}

/** Holders of a role profile, through active role_assignments → employees → uid. */
async function roleProfileHolders(db, roleProfileId) {
  const { resolvePersonUid } = require('../event-task-engine/lib/peopleDirectory');
  let snap;
  try {
    snap = await db.collection('role_assignments').where('status', '==', 'active').where('roleProfileId', '==', roleProfileId).get();
  } catch {
    return [];
  }
  const uids = [];
  for (const d of snap.docs) {
    const a = d.data() || {};
    const key = a.userId || a.employeeId;
    if (!key) continue;
    const person = await resolvePersonUid(db, String(key));
    if (person && person.uid && !uids.includes(person.uid)) uids.push(person.uid);
  }
  return uids;
}

/**
 * The uids an audience names, in a stable order (by email). Falls back to the
 * owners, then admins, when a role-shaped audience resolves to nobody — a
 * notice for nobody is a notice lost, and the owner is the last stop.
 *
 * @returns {Promise<{ uids: string[], fellBack: boolean }>}
 */
async function resolveAudience(db, audience, deps = {}) {
  const a = audience || {};
  const users = deps.users || (await loadUsers(db));
  const all = [...users.values()];
  const fallback = () => {
    for (const role of ['owner', 'admin']) {
      const holders = sortedUids(all.filter((u) => u.globalRole === role));
      if (holders.length) return { uids: holders, fellBack: true };
    }
    return { uids: [], fellBack: true };
  };

  switch (a.kind) {
    case 'user': {
      if (a.uid && users.has(a.uid)) return { uids: [a.uid], fellBack: false };
      const key = a.uid || a.personKey;
      if (!key) return { uids: [], fellBack: false };
      const { resolvePersonUid } = require('../event-task-engine/lib/peopleDirectory');
      const person = await resolvePersonUid(db, String(key));
      return { uids: person && person.uid ? [person.uid] : [], fellBack: false };
    }
    case 'role': {
      const role = String(a.role || '').toLowerCase();
      // 'admin' means admins AND owners: the senior tier always hears what the junior one does.
      const roles = ROLE_ORDER.slice(0, ROLE_ORDER.indexOf(role) + 1);
      const holders = sortedUids(all.filter((u) => roles.includes(u.globalRole)));
      return holders.length ? { uids: holders, fellBack: false } : fallback();
    }
    case 'parent_org': {
      const holders = sortedUids(all.filter(isParentOrgUser));
      return holders.length ? { uids: holders, fellBack: false } : fallback();
    }
    case 'brand_leads': {
      const sub = a.subsidiaryId;
      const leads = sortedUids(all.filter((u) => Array.isArray(u.deliveryLeadFor) && u.deliveryLeadFor.includes(sub)));
      if (leads.length) return { uids: leads, fellBack: false };
      const mds = sortedUids(all.filter((u) => u.homeOrgId === sub && (u.globalRole === 'admin' || u.globalRole === 'owner')));
      return mds.length ? { uids: mds, fellBack: false } : fallback();
    }
    case 'brand_staff': {
      const staff = sortedUids(all.filter((u) => u.homeOrgId === a.subsidiaryId));
      return staff.length ? { uids: staff, fellBack: false } : fallback();
    }
    case 'role_profile': {
      const holders = a.roleProfileId ? await roleProfileHolders(db, a.roleProfileId) : [];
      return holders.length ? { uids: holders, fellBack: false } : fallback();
    }
    default:
      return { uids: [], fellBack: false };
  }
}

function audienceLabel(a) {
  if (!a || !a.kind) return 'nobody';
  switch (a.kind) {
    case 'user': return `user:${a.uid || a.personKey || '?'}`;
    case 'role': return `role:${a.role}`;
    case 'parent_org': return 'parent_org';
    case 'brand_leads': return `brand_leads:${a.subsidiaryId}`;
    case 'brand_staff': return `brand_staff:${a.subsidiaryId}`;
    case 'role_profile': return `role_profile:${a.roleProfileId}`;
    default: return String(a.kind);
  }
}

/**
 * One notice per person the audience resolves to, stamped with the audience
 * asked for (`recipientRole`) for the audit trail.
 *
 * @returns {Promise<{ recipients: string[], written: number, fellBack: boolean }>}
 */
async function notifyAudience(db, { audience, ...notice }, deps = {}) {
  let resolved = { uids: [], fellBack: false };
  try {
    resolved = await resolveAudience(db, audience, deps);
  } catch (err) {
    log(deps).warn('[notice] audience could not be resolved', { audience: audienceLabel(audience), error: err.message });
  }
  if (!resolved.uids.length) {
    log(deps).warn('[notice] audience notice reached nobody', { audience: audienceLabel(audience), type: notice.type || null });
    return { recipients: [], written: 0, fellBack: resolved.fellBack };
  }
  const written = await notifyUsers(db, resolved.uids, { ...notice, recipientRole: audienceLabel(audience) }, deps);
  return { recipients: resolved.uids, written, fellBack: resolved.fellBack };
}

/** Everyone with `role` (and above). Kept for producers that speak in roles. */
function notifyRole(db, { role, ...notice }, deps = {}) {
  return notifyAudience(db, { audience: { kind: 'role', role }, ...notice }, deps);
}

module.exports = {
  PARENT_ORG_ID,
  notifyUser,
  notifyUsers,
  notifyAudience,
  notifyRole,
  resolveAudience,
  audienceLabel,
  loadUsers,
};
