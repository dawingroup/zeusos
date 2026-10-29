/**
 * Where a memo goes: it follows its own header.
 *
 *   Through   each person clears it, IN THE ORDER LISTED, before anyone decides
 *   To        the people it is addressed to decide it — any one of them
 *
 * The author is never routed to. A party typed by name with no ZeusOS login
 * cannot receive a task, so it is left off the route; when that leaves nobody
 * under To, the route is `source: 'role'` and the callable picks a decider by
 * role instead — still never the author.
 *
 * Pure. Mirror of functions/src/memos/lib/memoRoute.js (lockstep-tested).
 */
import type { Memo, MemoApprovalSnapshot, MemoHeader, MemoParty, MemoRoute, MemoRouteParty, MemoRouteStage, MemoSkippedParty } from '../types/memo';

function toRouteParty(p: MemoParty): MemoRouteParty {
  const party: MemoRouteParty = { uid: p.uid!, name: p.name || p.uid! };
  if (p.email) party.email = p.email;
  return party;
}

export interface MemoRoutePlan {
  route: MemoRoute;
  skipped: MemoSkippedParty[];
}

export function planMemoRoute(header: Pick<MemoHeader, 'to' | 'through'>, authorUid: string): MemoRoutePlan {
  const skipped: MemoSkippedParty[] = [];
  const seen = new Set<string>();

  const deciders: MemoRouteParty[] = [];
  for (const p of header.to ?? []) {
    if (!p?.uid) { skipped.push({ name: p?.name ?? '', list: 'to', reason: 'not-a-user' }); continue; }
    if (p.uid === authorUid) { skipped.push({ name: p.name, list: 'to', reason: 'author' }); continue; }
    if (seen.has(p.uid)) continue;
    seen.add(p.uid);
    deciders.push(toRouteParty(p));
  }

  const clearance: MemoRouteParty[] = [];
  for (const p of header.through ?? []) {
    if (!p?.uid) { skipped.push({ name: p?.name ?? '', list: 'through', reason: 'not-a-user' }); continue; }
    if (p.uid === authorUid) { skipped.push({ name: p.name, list: 'through', reason: 'author' }); continue; }
    if (seen.has(p.uid)) continue;
    seen.add(p.uid);
    clearance.push(toRouteParty(p));
  }

  return { route: { source: deciders.length ? 'addressed' : 'role', clearance, deciders }, skipped };
}

export function stageAfterClearance(required: boolean): MemoRouteStage {
  return required ? 'decision' : 'cleared';
}

export function routeFieldsForSubmit(route: MemoRoute, required = true): {
  approval: Pick<MemoApprovalSnapshot, 'route' | 'stage' | 'clearanceIndex' | 'clearanceUids' | 'deciderUids' | 'clearances'>;
  routeUids: string[];
} {
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

type RoutedMemo = Pick<Memo, 'status' | 'createdBy'> & { approval?: MemoApprovalSnapshot };

/** The uid who must clear the memo right now, if it is at clearance. */
export function currentClearanceUid(memo: RoutedMemo): string | null {
  const a = memo.approval;
  if (memo.status !== 'submitted' || a?.stage !== 'clearance') return null;
  return a.clearanceUids?.[a.clearanceIndex ?? 0] ?? null;
}

/** Whether this person may decide the memo now (an admin may cover for an addressee). */
export function canDecideMemo(memo: RoutedMemo, uid: string | null | undefined, isAdmin: boolean): boolean {
  if (!uid || memo.status !== 'submitted' || memo.createdBy === uid) return false;
  if ((memo.approval?.stage ?? 'decision') !== 'decision') return false;
  if (isAdmin) return true;
  return (memo.approval?.deciderUids ?? []).includes(uid);
}

/** Whether this person is holding the memo up right now (for "Awaiting me"). */
export function isAwaitingPerson(memo: RoutedMemo, uid: string | null | undefined): boolean {
  if (!uid || memo.status !== 'submitted') return false;
  if (currentClearanceUid(memo) === uid) return true;
  return (memo.approval?.stage ?? 'decision') === 'decision' && (memo.approval?.deciderUids ?? []).includes(uid);
}

export function isClearedForIssue(memo: RoutedMemo): boolean {
  return memo.status === 'submitted' && memo.approval?.stage === 'cleared';
}

/** Human line: "Through Grace → Ben, then to Amina for decision". */
export function describeRoute(route: MemoRoute | undefined, required = true): string {
  if (!route) return '';
  const through = route.clearance.map((p) => p.name).join(' → ');
  const to = route.deciders.map((p) => p.name).join(required ? ' or ' : ', ');
  if (!required) {
    return through ? `Through ${through}, then issued${to ? ` to ${to}` : ''}` : `Issued${to ? ` to ${to}` : ''}`;
  }
  if (route.source === 'role' && !to) return through ? `Through ${through}, then to a decider picked by role` : 'To a decider picked by role';
  return through ? `Through ${through}, then to ${to} for decision` : `To ${to} for decision`;
}

export type MemoRouteStepState = 'done' | 'current' | 'waiting' | 'returned';

export interface MemoRouteStep {
  uid: string;
  name: string;
  action: 'clear' | 'decide' | 'receive';
  state: MemoRouteStepState;
}

/** The route as steps, in the order the memo travels. */
export function memoRouteSteps(memo: Memo): MemoRouteStep[] {
  const a = memo.approval;
  const route = a?.route;
  if (!a || !route) return [];
  const clearances = a.clearances ?? [];
  const index = a.clearanceIndex ?? 0;
  const live = memo.status === 'submitted';
  const steps: MemoRouteStep[] = route.clearance.map((p, i) => {
    const given = clearances.find((c) => c.uid === p.uid);
    const state: MemoRouteStepState = given?.outcome === 'returned' ? 'returned'
      : given?.outcome === 'cleared' ? 'done'
        : live && a.stage === 'clearance' && i === index ? 'current' : 'waiting';
    return { uid: p.uid, name: p.name, action: 'clear', state };
  });
  const decides = a.required !== false;
  const decidedBy = memo.decision?.signedBy;
  for (const p of route.deciders) {
    const state: MemoRouteStepState = decides
      ? decidedBy === p.uid ? 'done' : live && a.stage === 'decision' ? 'current' : 'waiting'
      : memo.status === 'issued' ? 'done' : 'waiting';
    steps.push({ uid: p.uid, name: p.name, action: decides ? 'decide' : 'receive', state });
  }
  return steps;
}

/** One line: who holds the memo now. */
export function memoRouteStatusLine(memo: Memo): string {
  const a = memo.approval;
  if (memo.status !== 'submitted' || !a) return '';
  if (a.unroutable) return 'Nobody could be found to decide it — an admin must decide, or it must be re-addressed';
  if (a.stage === 'clearance') {
    const uid = currentClearanceUid(memo);
    const who = a.route?.clearance.find((p) => p.uid === uid)?.name ?? 'the next person';
    const total = a.clearanceUids?.length ?? 0;
    return `With ${who} to clear${total > 1 ? ` (${(a.clearanceIndex ?? 0) + 1} of ${total})` : ''}`;
  }
  if (a.stage === 'cleared') return 'Cleared by everyone it goes through — ready to issue';
  const names = a.route?.deciders.map((p) => p.name) ?? [];
  if (!names.length) return 'Awaiting a decider — being routed by role';
  return `Awaiting a decision by ${names.join(' or ')}`;
}
