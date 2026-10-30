/**
 * Where a memo goes: it follows its own header.
 *
 *   Through   each person clears it, IN THE ORDER LISTED, before anyone decides
 *   To        the people it is addressed to decide it — any one of them
 *
 * The author is never routed to. A party typed by name with no ZeusOS login
 * cannot receive a task, so it is left off the route; when that leaves nobody
 * under To, `source` is 'role' and the callable picks a decider by role
 * instead — still never the author.
 *
 * PURE. Mirror: src/modules/memos/utils/memoRoute.ts (lockstep-tested).
 */

function toRouteParty(p) {
  const party = { uid: p.uid, name: p.name || p.uid };
  if (p.email) party.email = p.email;
  return party;
}

function planMemoRoute(header, authorUid) {
  const skipped = [];
  const seen = new Set();

  const deciders = [];
  for (const p of (header && header.to) || []) {
    if (!p || !p.uid) { skipped.push({ name: (p && p.name) || '', list: 'to', reason: 'not-a-user' }); continue; }
    if (p.uid === authorUid) { skipped.push({ name: p.name, list: 'to', reason: 'author' }); continue; }
    if (seen.has(p.uid)) continue;
    seen.add(p.uid);
    deciders.push(toRouteParty(p));
  }

  // Someone who decides does not also clear it first.
  const clearance = [];
  for (const p of (header && header.through) || []) {
    if (!p || !p.uid) { skipped.push({ name: (p && p.name) || '', list: 'through', reason: 'not-a-user' }); continue; }
    if (p.uid === authorUid) { skipped.push({ name: p.name, list: 'through', reason: 'author' }); continue; }
    if (seen.has(p.uid)) continue;
    seen.add(p.uid);
    clearance.push(toRouteParty(p));
  }

  return {
    route: { source: deciders.length ? 'addressed' : 'role', clearance, deciders },
    skipped,
  };
}

function stageAfterClearance(required) {
  return required ? 'decision' : 'cleared';
}

/** The fields submit writes onto `approval` (and the top-level routeUids). */
function routeFieldsForSubmit(route, required = true) {
  const clearanceUids = route.clearance.map((p) => p.uid);
  const addresseeUids = route.deciders.map((p) => p.uid);
  return {
    approval: {
      route,
      stage: clearanceUids.length ? 'clearance' : stageAfterClearance(required),
      clearanceIndex: 0,
      clearanceUids,
      deciderUids: required ? addresseeUids : [],
      clearances: [],
    },
    routeUids: [...clearanceUids, ...addresseeUids],
  };
}

/** The uid who must clear the memo right now, if it is at clearance. */
function currentClearanceUid(memo) {
  const a = memo && memo.approval;
  if (!memo || memo.status !== 'submitted' || !a || a.stage !== 'clearance') return null;
  const i = a.clearanceIndex || 0;
  return (a.clearanceUids || [])[i] || null;
}

/** Whether this person may decide the memo now (an admin may cover for an addressee). */
function canDecideMemo(memo, uid, isAdmin) {
  if (!uid || !memo || memo.status !== 'submitted' || memo.createdBy === uid) return false;
  const stage = (memo.approval && memo.approval.stage) || 'decision';
  if (stage !== 'decision') return false;
  if (isAdmin) return true;
  return ((memo.approval && memo.approval.deciderUids) || []).includes(uid);
}

/** Whether the memo has cleared every Through party and waits only to be issued. */
function isClearedForIssue(memo) {
  return Boolean(memo) && memo.status === 'submitted' && Boolean(memo.approval) && memo.approval.stage === 'cleared';
}

/** Who holds the memo now: 'clearance:<i>:<uid>' | 'decision:<uids>' | 'cleared' | ''. */
function holderKey(memo) {
  if (!memo || memo.status !== 'submitted') return '';
  const a = memo.approval || {};
  if (a.stage === 'clearance') return `clearance:${a.clearanceIndex || 0}:${(a.clearanceUids || [])[a.clearanceIndex || 0] || ''}`;
  if (a.stage === 'decision') return `decision:${(a.deciderUids || []).join(',')}`;
  return a.stage || '';
}

module.exports = {
  planMemoRoute,
  routeFieldsForSubmit,
  stageAfterClearance,
  currentClearanceUid,
  canDecideMemo,
  isClearedForIssue,
  holderKey,
};
