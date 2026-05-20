// ============================================================================
// SECTION AUDIT LOG SERVICE - Strategy Plan Update Tool
// Append-only audit trail for document section changes
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { SECTION_AUDIT_LOG } from '../constants/strategy.constants';
import type { SectionAuditEntry } from '../types/documentSection.types';

// ----------------------------------------------------------------------------
// Write Audit Entry (append-only)
// ----------------------------------------------------------------------------

export async function writeAuditEntry(
  companyId: string,
  reviewId: string,
  entry: Omit<SectionAuditEntry, 'id' | 'timestamp'>
): Promise<string> {
  const colPath = SECTION_AUDIT_LOG(companyId, reviewId);
  const docRef = doc(collection(db, colPath));
  const id = docRef.id;

  const fullEntry: SectionAuditEntry = {
    ...entry,
    id,
    timestamp: Timestamp.now(),
  };

  await setDoc(docRef, fullEntry);
  return id;
}

// ----------------------------------------------------------------------------
// Read Audit Log
// ----------------------------------------------------------------------------

export async function getAuditLog(
  companyId: string,
  reviewId: string,
  sectionId?: string
): Promise<SectionAuditEntry[]> {
  const colPath = SECTION_AUDIT_LOG(companyId, reviewId);
  const colRef = collection(db, colPath);

  const constraints = sectionId
    ? [where('sectionId', '==', sectionId), orderBy('timestamp', 'desc')]
    : [orderBy('timestamp', 'desc')];

  const q = query(colRef, ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => d.data() as SectionAuditEntry);
}
