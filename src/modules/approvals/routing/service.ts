/**
 * Firestore access for the approval-routing config (`systemSettings/approvalRouting`).
 *
 * An onSnapshot subscription that never yields null (a missing document
 * surfaces as the defaults — exactly what the Cloud Function falls back to),
 * and a validated save through the timeout-wrapped write helpers.
 */

import { doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { setDoc } from '@/shared/services/firebase/firestore-writes';

import { validateApprovalRouting } from './engine';
import {
  APPROVAL_ROUTING_COLLECTION,
  APPROVAL_ROUTING_DOC_ID,
  DEFAULT_APPROVAL_ROUTING,
  type ApprovalRoutingConfig,
} from './types';

function configRef() {
  return doc(db, APPROVAL_ROUTING_COLLECTION, APPROVAL_ROUTING_DOC_ID);
}

/**
 * Subscribe to the config. The callback also reports whether the document
 * exists, so the page can say "using defaults" rather than implying someone
 * chose these values.
 */
export function subscribeToApprovalRouting(
  callback: (config: ApprovalRoutingConfig, exists: boolean) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    configRef(),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_APPROVAL_ROUTING, false);
        return;
      }
      const data = snap.data() as Partial<ApprovalRoutingConfig>;
      callback(
        {
          version: data.version ?? DEFAULT_APPROVAL_ROUTING.version,
          modules: data.modules ?? DEFAULT_APPROVAL_ROUTING.modules,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        },
        true,
      );
    },
    (err) => {
      onError?.(err);
      callback(DEFAULT_APPROVAL_ROUTING, false);
    },
  );
}

/**
 * Save the config. Validates first and throws on any problem — the same rules
 * the Cloud Function applies when reading, so an invalid ladder cannot reach
 * Firestore through this path even if the Save button were mis-gated.
 *
 * Writes the whole `modules` map rather than merging into it, so removing a
 * band or rule actually removes it.
 */
export async function saveApprovalRouting(config: ApprovalRoutingConfig, userId: string): Promise<void> {
  const problems = validateApprovalRouting(config);
  const entries = Object.entries(problems);
  if (entries.length > 0) {
    throw new Error(
      `Approval routing is invalid and was not saved:\n${entries.map(([entityType, errors]) => `${entityType}: ${errors.join(' ')}`).join('\n')}`,
    );
  }
  await setDoc(
    configRef(),
    {
      version: config.version ?? DEFAULT_APPROVAL_ROUTING.version,
      modules: config.modules,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  );
}
