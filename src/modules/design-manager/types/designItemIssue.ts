/**
 * Design Item Issue — internal, team-facing thread raised against a
 * specific DesignItem (optionally narrowed to a cabinet + part).
 *
 * Sits next to ClientPortalMessage in the system map:
 *   - ClientPortalMessage = external, client↔team, quote/approval scoped.
 *   - DesignItemIssue     = internal, team-only, work-tracking scoped.
 *
 * Issues are raised when procurement, production, or design spot work
 * that needs attention — e.g. "cutting list has a 720mm face but the
 * model shows 740mm" or "material for part SIDE isn't linked to the
 * Finish Library". A thread of comments + a status field let one side
 * raise, the other acknowledge / push back / resolve.
 *
 * Why a separate collection (not reuse ClientPortalMessage):
 *   - Target is a DesignItem (or its parts), not a Quote.
 *   - Status lifecycle is different (open → acknowledged → resolved),
 *     not a chronological chat.
 *   - Client portal rules expose messages to external users; issues
 *     must stay internal.
 */
import type { Timestamp } from 'firebase/firestore';

export type IssueKind =
  | 'cutlist'       // Cutting list / dimensions / grain
  | 'material'      // Material / finish / inventory linkage
  | 'revision'      // 3D revision landed but parts haven't been refreshed
  | 'geometry'      // Part dims or mesh linkage look off
  | 'general';      // Catch-all

export type IssueSeverity = 'blocker' | 'major' | 'minor' | 'info';

export type IssueStatus = 'open' | 'acknowledged' | 'resolved' | 'wont_fix';

/** Narrowing pointer: which scene/cabinet/part does this concern? */
export interface IssueScope {
  sceneId?: string;
  cabinetId?: string;
  partId?: string;
  /** Mesh node the part tags — useful when the partId has been rewritten. */
  meshNodeId?: string;
}

/** A single comment in the issue thread. */
export interface IssueComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  /** Optional status change this comment caused (for audit breadcrumbs). */
  statusChangeTo?: IssueStatus;
  createdAt: Timestamp;
}

export interface DesignItemIssue {
  id: string;
  projectId: string;
  designItemId: string;

  kind: IssueKind;
  severity: IssueSeverity;
  status: IssueStatus;

  /** Short one-line summary shown in lists. */
  title: string;
  /** Initial body of the issue — usually pre-filled from a Parts Review flag. */
  body: string;

  /** Narrowing pointer — scene/cabinet/part this refers to. */
  scope: IssueScope;

  /** Comments subcollection is preferred for long threads; for compact
   *  issues we mirror the first few here so list views can render them
   *  without a second fetch. Authoritative copy lives under
   *  `designItemIssues/{id}/comments`. */
  recentCommentCount: number;

  /** Audit fields. */
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolvedByName?: string;

  /** Free-form source pointer — e.g. 'parts-review', 'revision-detector',
   *  'manual' — so we can tell which surface raised the issue. */
  source: string;
}

export interface CreateIssueInput {
  projectId: string;
  designItemId: string;
  kind: IssueKind;
  severity: IssueSeverity;
  title: string;
  body: string;
  scope?: IssueScope;
  source: string;
}

export interface IssueFilter {
  projectId?: string;
  designItemId?: string;
  status?: IssueStatus | IssueStatus[];
  kind?: IssueKind;
}
