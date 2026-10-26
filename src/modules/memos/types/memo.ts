/**
 * Memos — written context for finance, administrative and operational
 * decisions (DawinOS stream G, ported 2026-10-26).
 *
 * A memo is a first-class DECISION RECORD that links to the records it covers
 * (an IWO, a PO, a change order, an employee change) rather than duplicating
 * them. Its `type` picks the workflow:
 *
 *   decision     ask a named authority to decide → signed APPROVE / DECLINE / MODIFY
 *   request      justify a spend, exception or hire → tier from amount × impact × type
 *   information  brief; no decision → distribution only
 *   directive    policy / notice → admin tier, recipients acknowledge
 *   record       memo for record → numbered and filed, no approval
 *
 * Drafts are the author's (client writes under the `memos` rules). Every
 * later transition goes through the `memoAction` callable
 * (functions/src/memos/callables/memoAction.js), which numbers, routes,
 * freezes and files the memo and writes each step's task into
 * `generated_tasks`. Timestamps are ISO strings throughout, as on tasks.
 *
 * Collection: `memos/{memoId}` — brand-scoped by `subsidiaryId`.
 */

import type { GlobalRole, SubsidiaryId } from '@/core/settings/types';
import type { RecordEntityType } from '@/shared/navigation';

export type MemoType = 'decision' | 'request' | 'information' | 'directive' | 'record';
export type MemoCategory = 'finance' | 'admin' | 'operations';
export type MemoImpact = 'low' | 'medium' | 'high';

/** Routing entity type in `systemSettings/approvalRouting.modules`. */
export type MemoRoutingEntityType = 'memo_finance' | 'memo_admin' | 'memo_operations';

export type MemoStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'issued'
  | 'superseded'
  | 'withdrawn';

export type MemoDecisionOutcome = 'approved' | 'rejected' | 'modified';

/** A person named in the memo header. `uid` is optional — a memo may be
 *  addressed to a title-holder with no ZeusOS login (the board, an auditor). */
export interface MemoParty {
  uid?: string;
  name: string;
  title?: string;
  email?: string;
}

export interface MemoHeader {
  to: MemoParty[];
  from: MemoParty;
  through: MemoParty[];
  cc: MemoParty[];
  /** 'YYYY-MM-DD' — the date printed on the memo. */
  date: string;
}

/** One authored section. Order in the array is the print order. */
export interface MemoSection {
  /** Template key (e.g. 'purpose'); stable across edits. */
  key: string;
  heading: string;
  /** Plain prose. Paragraphs split on blank lines; `- ` / `1. ` lines become lists. */
  content: string;
  /** Opt a section out without deleting it, so the template stays visible. */
  enabled: boolean;
}

export interface MemoAttachment {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  contentType?: string;
  size?: number;
  addedBy: string;
  addedAt: string;
}

export type MemoLinkRelation = 'authorises' | 'context' | 'supersedes';

/**
 * A record the memo is about. `type` is a RecordEntityType so RecordLink can
 * render it clickable; `'other'` carries a free `href`.
 */
export interface MemoLink {
  type: RecordEntityType | 'other';
  id: string;
  label: string;
  relation: MemoLinkRelation;
  /** Route params resolveRecordTarget may need for this type. */
  clientId?: string;
  msaId?: string;
  sowId?: string;
  /** `'other'` only. */
  href?: string;
}

export type MemoRecipientRole = 'to' | 'through' | 'cc' | 'ack';

export interface MemoRecipient {
  uid: string;
  name: string;
  email?: string;
  role: MemoRecipientRole;
  /** Directive memos: the recipient must acknowledge. */
  requiresAck: boolean;
}

export interface MemoAcknowledgement {
  name: string;
  at: string;
  method: 'in_app';
}

export interface MemoStatusEvent {
  from: MemoStatus | null;
  to: MemoStatus;
  by: string;
  byName: string;
  at: string;
  note?: string;
}

export type MemoRouteStage = 'clearance' | 'decision' | 'cleared';

export interface MemoRouteParty {
  uid: string;
  name: string;
  email?: string;
}

export interface MemoRoute {
  source: 'addressed' | 'role';
  clearance: MemoRouteParty[];
  deciders: MemoRouteParty[];
}

export interface MemoClearance {
  uid: string;
  name: string;
  outcome: 'cleared' | 'returned';
  note?: string;
  at: string;
}

export interface MemoSkippedParty {
  name: string;
  list: 'to' | 'through';
  reason: 'not-a-user' | 'author';
}

/** The routing decision snapshotted at submit (written by the callable). */
export interface MemoApprovalSnapshot {
  required: boolean;
  entityType: MemoRoutingEntityType;
  bandId?: string;
  bandLabel?: string;
  bandRole: GlobalRole | null;
  impactMinimumRole: GlobalRole | null;
  typeMinimumRole: GlobalRole | null;
  /** The most senior of the three inputs; null = no decision required. */
  effectiveRole: GlobalRole | null;
  roleChain: GlobalRole[] | null;
  raisedBy: 'band' | 'impact' | 'type' | null;
  currencyMismatch?: boolean;
  evaluatedAt: string;
  configVersion?: number;
  /** Header parties left off the route (typed names, the author). */
  skipped?: MemoSkippedParty[];
  /** WHO the memo goes to, fixed at submit from its header. */
  route?: MemoRoute;
  stage?: MemoRouteStage;
  clearanceIndex?: number;
  clearanceUids?: string[];
  deciderUids?: string[];
  clearances?: MemoClearance[];
  /** Whether every decider holds the tier (callable). */
  tierMet?: boolean | null;
  deciderRoles?: Record<string, string | null>;
  /** Set when nobody under To could receive a task and a decider was picked by role. */
  routedTo?: { uid: string; name: string; email?: string | null; matchedRole?: string | null };
  seniorityCheck?: 'ok' | 'junior';
  signerRole?: string | null;
  unroutable?: string;
}

/** A memo sent back to its author by someone clearing it. */
export interface MemoReturn {
  by: string;
  byName: string;
  note: string;
  at: string;
}

/** The decision AS TAKEN. Immutable once written. */
export interface MemoDecision {
  outcome: MemoDecisionOutcome;
  /** Verbatim. Required when outcome === 'modified'. */
  conditions?: string;
  notes?: string;
  signedBy: string;
  signedByName: string;
  /** The name the signer typed to sign. */
  signedNameTyped: string;
  signatureMethod: 'typed';
  at: string;
  /** An admin decided in an addressee's place. */
  coveredAsAdmin?: boolean;
}

/** The issued document, frozen. */
export interface MemoIssuedSnapshot {
  memoNumber: string;
  version: number;
  header: MemoHeader;
  sections: MemoSection[];
  links: MemoLink[];
  attachments: MemoAttachment[];
  distribution: MemoRecipient[];
  amountMinor?: number;
  currency?: string;
  /** sha-256 of the canonical JSON of the content fields. */
  contentHash: string;
  pdfStoragePath?: string;
  pdfUrl?: string;
  pdfFiledAt?: string;
  pdfFiledBy?: string;
  issuedAt: string;
  issuedBy: string;
}

export interface Memo {
  id: string;
  /** 'MEMO-ZTA-2026-004' — allocated at SUBMIT; drafts are unnumbered. */
  memoNumber?: string;
  subsidiaryId: SubsidiaryId | string;
  type: MemoType;
  category: MemoCategory;
  impact: MemoImpact;
  /** Narrows read access to participants + admin (hides from the brand register). */
  confidential: boolean;
  subject: string;
  externalRef?: string;
  header: MemoHeader;
  /** Minor units of `currency`; compared against routing bands with no FX. */
  amountMinor?: number | null;
  currency?: string | null;
  sections: MemoSection[];
  attachments: MemoAttachment[];
  links: MemoLink[];
  distribution: MemoRecipient[];
  /** Denormalised from `distribution` for the rules `in` check. */
  distributionUids: string[];
  /** Everyone on the memo's route (Through + To with a login), written at submit. */
  routeUids?: string[];
  returned?: MemoReturn | null;
  acknowledgements: Record<string, MemoAcknowledgement>;

  status: MemoStatus;
  statusHistory: MemoStatusEvent[];
  /** Increments on each submit (rejected → draft → resubmit). */
  version: number;

  approval?: MemoApprovalSnapshot;
  decision?: MemoDecision;
  issuedSnapshot?: MemoIssuedSnapshot;

  supersedes?: string;
  supersededBy?: string;

  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  submittedAt?: string;
  decidedAt?: string;
  issuedAt?: string;
  withdrawnAt?: string;
}

/** `memos/{id}/comments/{commentId}` */
export interface MemoComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** `memos/{id}/versions/v{n}` — what was submitted, immutable. */
export interface MemoVersion {
  id: string;
  version: number;
  header: MemoHeader;
  sections: MemoSection[];
  links: MemoLink[];
  attachments: MemoAttachment[];
  amountMinor?: number;
  currency?: string;
  submittedBy: string;
  submittedAt: string;
}

export interface MemoActor {
  uid: string;
  name: string;
  email?: string;
}

export interface CreateMemoInput {
  subsidiaryId: string;
  type: MemoType;
  category: MemoCategory;
  impact?: MemoImpact;
  confidential?: boolean;
  subject: string;
  externalRef?: string;
  header?: Partial<MemoHeader>;
  amountMinor?: number | null;
  currency?: string | null;
  /** Defaults to the type's section template. */
  sections?: MemoSection[];
  links?: MemoLink[];
  distribution?: MemoRecipient[];
  supersedes?: string;
}

export type UpdateMemoDraftInput = Partial<
  Pick<Memo, 'type' | 'category' | 'impact' | 'confidential' | 'subject' | 'header' | 'sections' | 'attachments' | 'links' | 'distribution'>
> & {
  /** `null` clears the field (undefined leaves it alone). */
  amountMinor?: number | null;
  currency?: string | null;
  externalRef?: string | null;
};

export interface MemoFilters {
  subsidiaryId?: string;
  status?: MemoStatus | MemoStatus[];
  type?: MemoType;
  category?: MemoCategory;
  /** Only memos authored by this uid. */
  createdBy?: string;
  /** Only memos this uid is on the distribution of. */
  recipientUid?: string;
  /** Only memos this uid is on the route of (Through or To). */
  routeUid?: string;
  limit?: number;
}
