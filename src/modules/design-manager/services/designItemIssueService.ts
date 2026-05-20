/**
 * designItemIssueService — CRUD + realtime for DesignItemIssue.
 *
 * Collection layout:
 *   designItemIssues/{issueId}
 *     comments/{commentId}
 *
 * Issues live in a flat top-level collection (not nested under the
 * DesignItem) so we can:
 *   - Query cross-project "all open issues assigned to me" without a
 *     collectionGroup walk.
 *   - Let the same listener power a scene-level Parts Review badge and
 *     a Design Manager item-detail panel from one snapshot.
 *
 * Comments live in a subcollection for cheap append + stable pagination;
 * we mirror `recentCommentCount` onto the parent so list views avoid
 * the N+1 read.
 */
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, setDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, increment,
  type Unsubscribe, type QueryConstraint, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  DesignItemIssue, CreateIssueInput, IssueFilter,
  IssueComment, IssueStatus,
} from '../types/designItemIssue';

const ISSUES_COLLECTION = 'designItemIssues';
const COMMENTS_SUBCOLLECTION = 'comments';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createDesignItemIssue(
  input: CreateIssueInput,
  user: { uid: string; displayName?: string | null; email?: string | null },
): Promise<string> {
  const now = serverTimestamp();
  const payload: Omit<DesignItemIssue, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt: unknown; updatedAt: unknown;
  } = {
    projectId: input.projectId,
    designItemId: input.designItemId,
    kind: input.kind,
    severity: input.severity,
    status: 'open',
    title: input.title.slice(0, 140),
    body: input.body,
    scope: input.scope ?? {},
    recentCommentCount: 0,
    createdBy: user.uid,
    createdByName: user.displayName || user.email || 'Unknown',
    createdAt: now,
    updatedAt: now,
    source: input.source,
  };
  const ref = await addDoc(collection(db, ISSUES_COLLECTION), payload);
  return ref.id;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** One-shot fetch — prefer subscribe for live UIs. */
export async function listIssues(filter: IssueFilter = {}): Promise<DesignItemIssue[]> {
  const constraints = buildConstraints(filter);
  const snap = await getDocs(query(collection(db, ISSUES_COLLECTION), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DesignItemIssue));
}

export function subscribeToIssues(
  filter: IssueFilter,
  cb: (issues: DesignItemIssue[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const constraints = buildConstraints(filter);
  return onSnapshot(
    query(collection(db, ISSUES_COLLECTION), ...constraints),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as DesignItemIssue))),
    onError,
  );
}

function buildConstraints(filter: IssueFilter): QueryConstraint[] {
  const out: QueryConstraint[] = [];
  if (filter.projectId) out.push(where('projectId', '==', filter.projectId));
  if (filter.designItemId) out.push(where('designItemId', '==', filter.designItemId));
  if (filter.status) {
    if (Array.isArray(filter.status)) out.push(where('status', 'in', filter.status));
    else out.push(where('status', '==', filter.status));
  }
  if (filter.kind) out.push(where('kind', '==', filter.kind));
  // Order by updatedAt desc — newest activity first.
  out.push(orderBy('updatedAt', 'desc'));
  return out;
}

// ---------------------------------------------------------------------------
// Mutate — status + comments
// ---------------------------------------------------------------------------

/** Change status and append an audit comment in one shot. */
export async function setIssueStatus(
  issueId: string,
  nextStatus: IssueStatus,
  commentBody: string,
  user: { uid: string; displayName?: string | null; email?: string | null },
): Promise<void> {
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  const now = serverTimestamp();
  const patch: Record<string, unknown> = {
    status: nextStatus,
    updatedAt: now,
  };
  if (nextStatus === 'resolved') {
    patch.resolvedAt = now;
    patch.resolvedBy = user.uid;
    patch.resolvedByName = user.displayName || user.email || 'Unknown';
  } else if (nextStatus === 'open') {
    // Clearing resolution (re-opened).
    patch.resolvedAt = null;
    patch.resolvedBy = null;
    patch.resolvedByName = null;
  }
  await updateDoc(issueRef, patch);

  if (commentBody.trim()) {
    await addComment(issueId, { body: commentBody, statusChangeTo: nextStatus }, user);
  }
}

export async function addComment(
  issueId: string,
  input: { body: string; statusChangeTo?: IssueStatus },
  user: { uid: string; displayName?: string | null; email?: string | null },
): Promise<string> {
  const commentRef = doc(collection(db, ISSUES_COLLECTION, issueId, COMMENTS_SUBCOLLECTION));
  const now = serverTimestamp();
  const payload: Omit<IssueComment, 'id' | 'createdAt'> & { createdAt: unknown } = {
    authorId: user.uid,
    authorName: user.displayName || user.email || 'Unknown',
    body: input.body,
    ...(input.statusChangeTo ? { statusChangeTo: input.statusChangeTo } : {}),
    createdAt: now,
  };
  await setDoc(commentRef, payload);
  // Bump counter + updatedAt on the parent issue.
  await updateDoc(doc(db, ISSUES_COLLECTION, issueId), {
    recentCommentCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  return commentRef.id;
}

export function subscribeToComments(
  issueId: string,
  cb: (comments: IssueComment[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, ISSUES_COLLECTION, issueId, COMMENTS_SUBCOLLECTION),
      orderBy('createdAt', 'asc'),
    ),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as IssueComment))),
    onError,
  );
}

// ---------------------------------------------------------------------------
// Idempotency helpers — used by auto-detectors to avoid duplicate issues.
// ---------------------------------------------------------------------------

/**
 * Look up an existing open issue matching a stable "fingerprint". The
 * fingerprint is a synthetic tag stored in scope.partId (for part-level
 * issues) or composed from (designItemId + source + kind) so detectors
 * can re-run without spamming duplicate issues.
 */
export async function findOpenIssue(opts: {
  designItemId: string;
  source: string;
  kind: DesignItemIssue['kind'];
  scopeKey?: string; // e.g. cabinetId + meshNodeId
}): Promise<DesignItemIssue | null> {
  const snap = await getDocs(query(
    collection(db, ISSUES_COLLECTION),
    where('designItemId', '==', opts.designItemId),
    where('source', '==', opts.source),
    where('kind', '==', opts.kind),
    where('status', 'in', ['open', 'acknowledged']),
  ));
  const match = snap.docs.find(d => {
    const data = d.data() as DesignItemIssue;
    if (!opts.scopeKey) return true;
    const key = `${data.scope.cabinetId ?? ''}|${data.scope.meshNodeId ?? data.scope.partId ?? ''}`;
    return key === opts.scopeKey;
  });
  if (!match) return null;
  return { id: match.id, ...match.data() } as DesignItemIssue;
}

/**
 * Bulk-resolve every open issue matching a source + kind + scope. Used
 * by auto-detectors (e.g. the revision→parts apply flow) to close out
 * their own previously-raised issues once the underlying condition has
 * been addressed.
 *
 * Each close appends an audit comment so the thread explains what
 * changed — "Auto-resolved: revision N+1 applied" — rather than silently
 * flipping status.
 */
export async function resolveOpenIssuesBySource(opts: {
  designItemId: string;
  source: string;
  kind?: DesignItemIssue['kind'];
  /** Optional scope filter — cabinetId + (meshNodeId|partId) concatenated. */
  scopeKey?: string;
  auditComment: string;
  user: { uid: string; displayName?: string | null; email?: string | null };
}): Promise<number> {
  const snap = await getDocs(query(
    collection(db, ISSUES_COLLECTION),
    where('designItemId', '==', opts.designItemId),
    where('source', '==', opts.source),
    where('status', 'in', ['open', 'acknowledged']),
  ));
  let closed = 0;
  for (const d of snap.docs) {
    const data = d.data() as DesignItemIssue;
    if (opts.kind && data.kind !== opts.kind) continue;
    if (opts.scopeKey) {
      const key = `${data.scope.cabinetId ?? ''}|${data.scope.meshNodeId ?? data.scope.partId ?? ''}`;
      if (key !== opts.scopeKey) continue;
    }
    await setIssueStatus(d.id, 'resolved', opts.auditComment, opts.user);
    closed++;
  }
  return closed;
}

/** Convenience — get a single issue (for detail panels). */
export async function getIssue(issueId: string): Promise<DesignItemIssue | null> {
  const snap = await getDoc(doc(db, ISSUES_COLLECTION, issueId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DesignItemIssue;
}

/**
 * Typed Timestamp helper — tests / pre-persistence fixtures need one.
 * Thin re-export so callers don't reach into firebase for this one type.
 */
export { Timestamp as IssueTimestamp };
