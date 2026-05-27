/**
 * Phase 6.UI.B — Traffic service layer.
 *
 * Thin wrappers around the existing 6.B callable (`routeBrand`) and
 * Firestore reads of `master_jobs` + `internal_work_orders` so the
 * Traffic surface stays UI-only. No new write paths are introduced
 * here — overrides are captured client-side and persisted naturally
 * by the existing `issueWorkOrder` callable (its `subsidiaryOrgId !==
 * proposal.proposedBrandId` is the canonical override signal).
 */

import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase/firestore';
import { app } from '@/core/services/firebase/config';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import type { RoutingProposal, RoutingRequest } from '../types/traffic.types';

const functions = getFunctions(app, 'europe-west1');

/** Bound callable — the `routeBrand` CFn lives in
 *  `functions/src/assignment/routeBrand.js`. */
export const routeBrandFn: HttpsCallable<RoutingRequest, RoutingProposal> =
  httpsCallable(functions, 'routeBrand');

// ──────────────────────────────────────────────────────────────────
// Master-job subscriptions
// ──────────────────────────────────────────────────────────────────

/**
 * Listen for master_jobs awaiting brand routing. The current
 * heuristic: status === 'OPEN' AND `allocatedMinor === 0` — i.e.
 * no IWO has been issued yet. Once an IWO is issued the master_job
 * moves to `DELIVERING` (or stays `OPEN` with allocation), at which
 * point Traffic considers it routed.
 */
export function subscribeOpenMasterJobs(
  cb: (jobs: MasterJob[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'master_jobs'),
    where('status', '==', 'OPEN'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const jobs = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<MasterJob, 'id'>) }))
        // Open + unrouted = no allocation yet. `allocatedMinor`
        // can be undefined on pre-3.B master_jobs — treat as 0.
        .filter((j) => (j.allocatedMinor ?? 0) === 0);
      cb(jobs);
    },
    (err) => {
      onError?.(err);
    },
  );
}

// ──────────────────────────────────────────────────────────────────
// IWO subscriptions (Active IWOs tab)
// ──────────────────────────────────────────────────────────────────

const ACTIVE_IWO_STATES = ['ISSUED', 'ACCEPTED', 'IN_PROGRESS', 'REVISION_REQUESTED', 'DELIVERED'];

export function subscribeActiveIwos(
  cb: (iwos: InternalWorkOrder[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders'),
    where('state', 'in', ACTIVE_IWO_STATES),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) })));
    },
    (err) => {
      onError?.(err);
    },
  );
}

// ──────────────────────────────────────────────────────────────────
// Override-log subscription (RoutingBrandProposed where override fired)
// ──────────────────────────────────────────────────────────────────

export interface RoutingBrandProposedEvent {
  id: string;
  aggregateId: string;
  occurredAt: string;
  payload: {
    proposalId: string;
    proposedBrandId: string | null;
    requiredCapability: string;
    tier: string | null;
    accountRegion: string | null;
    accountCategory: string | null;
    geographyPreferenceApplied: string | null;
    reasonNoCandidate: string | null;
    candidates: Array<{
      brandId: string;
      openIwoCount: number;
      availability: number;
      rejectionReason: string | null;
    }>;
    proposedByUserId: string;
  };
}

/**
 * Subscribe to RoutingBrandProposed events. The Override-log tab
 * cross-references these against the eventual `IWOIssued` events to
 * spot overrides — that cross-reference will land in 6.E with the
 * unified inbox; for now we just list proposals chronologically.
 */
export function subscribeRoutingProposals(
  cb: (events: RoutingBrandProposedEvent[]) => void,
  onError?: (e: Error) => void,
  cap: number = 100,
): Unsubscribe {
  const q = query(
    collection(db, 'domain_events'),
    where('eventType', '==', 'RoutingBrandProposed'),
    orderBy('occurredAt', 'desc'),
    limit(cap),
  );
  return onSnapshot(
    q,
    (snap) => {
      const events = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<RoutingBrandProposedEvent, 'id'>) }),
      );
      cb(events);
    },
    (err) => {
      onError?.(err);
    },
  );
}
