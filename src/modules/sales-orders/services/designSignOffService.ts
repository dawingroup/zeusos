/**
 * Design Sign-Off Service
 * Sign-off CRUD, client approval/rejection, version validation.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '@/shared/services/firebase/firestore';
import type {
  DesignSignOff,
  ClientApprovalRecord,
  SalesOrder,
  ApprovalGates,
} from '../types';
import type { RequestDesignSignOffInput } from '../schemas';
import {
  DESIGN_SIGNOFFS_COLLECTION,
  SO_COLLECTION,
  CLIENT_PORTAL_TOKENS_COLLECTION,
  DEFAULT_DISCLAIMER_TEXT,
  DEFAULT_SIGNOFF_EXPIRY_DAYS,
} from '../constants';

// ============================================================================
// AUTO-NUMBERING
// ============================================================================

async function generateDSONumber(soNumber: string): Promise<string> {
  const q = query(
    collection(db, DESIGN_SIGNOFFS_COLLECTION),
    where('salesOrderId', '!=', ''),
  );
  const snap = await getDocs(q);
  const nextNum = snap.size + 1;
  return `DSO-${soNumber}-${String(nextNum).padStart(3, '0')}`;
}

// ============================================================================
// CRUD
// ============================================================================

export async function requestDesignSignOff(
  input: RequestDesignSignOffInput,
  userId: string,
  subsidiaryId: string,
): Promise<string> {
  const soRef = doc(db, SO_COLLECTION, input.salesOrderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error('Sales order not found');

  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;
  const dsoNumber = await generateDSONumber(so.orderNumber);

  // Supersede any existing active sign-offs for this SO
  const existing = await getSignOffsForSO(input.salesOrderId);
  for (const dso of existing) {
    if (dso.status === 'sent_to_client' || dso.status === 'draft') {
      await updateDoc(doc(db, DESIGN_SIGNOFFS_COLLECTION, dso.id), {
        status: 'superseded',
        isValid: false,
      });
    }
  }

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(
    now.toMillis() + DEFAULT_SIGNOFF_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  // Generate client portal token
  const clientPortalToken = nanoid(32);

  const dsoData: Omit<DesignSignOff, 'id'> = {
    subsidiaryId,
    salesOrderId: input.salesOrderId,
    designProjectId: so.designProjectId,
    designVersion: so.scopeVersion,
    scopeVersion: so.scopeVersion,
    signOffNumber: dsoNumber,
    title: input.title,
    description: input.description,
    designDocuments: input.documents.map((d, idx) => ({
      id: `doc-${Date.now()}-${idx}`,
      ...d,
    })),
    itemsCovered: input.itemsCovered,
    specificationsSnapshot: input.specificationsSnapshot,
    status: input.sendVia === 'client_portal' ? 'sent_to_client' : 'draft',
    sentToClientAt: input.sendVia === 'client_portal' ? now : undefined,
    sentToClientVia: input.sendVia,
    clientPortalToken,
    clientApprovalMethod: 'portal_acceptance',
    expiresAt,
    isValid: true,
    disclaimerText: input.disclaimerText || DEFAULT_DISCLAIMER_TEXT,
    termsAccepted: false,
    createdAt: now,
    createdBy: userId,
  };

  const docRef = await addDoc(collection(db, DESIGN_SIGNOFFS_COLLECTION), dsoData);

  // Create client portal token lookup
  if (input.sendVia === 'client_portal') {
    await addDoc(collection(db, CLIENT_PORTAL_TOKENS_COLLECTION), {
      token: clientPortalToken,
      type: 'design_signoff',
      entityId: docRef.id,
      salesOrderId: input.salesOrderId,
      createdAt: now,
      expiresAt,
    });
  }

  // Update SO gate to in_progress
  const updatedGates: ApprovalGates = {
    ...so.gates,
    designSignOff: {
      ...so.gates.designSignOff,
      status: 'in_progress',
      sentToClientAt: now,
    },
  };

  // Add sign-off ID to SO
  await updateDoc(soRef, {
    gates: updatedGates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return docRef.id;
}

export async function getDesignSignOff(signOffId: string): Promise<DesignSignOff | null> {
  const snap = await getDoc(doc(db, DESIGN_SIGNOFFS_COLLECTION, signOffId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DesignSignOff;
}

export async function getSignOffsForSO(salesOrderId: string): Promise<DesignSignOff[]> {
  const q = query(
    collection(db, DESIGN_SIGNOFFS_COLLECTION),
    where('salesOrderId', '==', salesOrderId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DesignSignOff));
}

export async function getSignOffByToken(token: string): Promise<DesignSignOff | null> {
  const q = query(
    collection(db, DESIGN_SIGNOFFS_COLLECTION),
    where('clientPortalToken', '==', token),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as DesignSignOff;
}

// ============================================================================
// CLIENT RESPONSES
// ============================================================================

export async function recordDesignApproval(
  signOffId: string,
  approval: ClientApprovalRecord,
): Promise<void> {
  const dso = await getDesignSignOff(signOffId);
  if (!dso) throw new Error('Design sign-off not found');

  if (dso.status !== 'sent_to_client') {
    throw new Error(`Cannot approve sign-off with status "${dso.status}"`);
  }

  // Check expiry
  if (dso.expiresAt && dso.expiresAt.toMillis() < Date.now()) {
    throw new Error('This sign-off request has expired');
  }

  const now = Timestamp.now();

  await updateDoc(doc(db, DESIGN_SIGNOFFS_COLLECTION, signOffId), {
    status: 'approved',
    clientApprovedAt: now,
    clientApprovalMethod: approval.approvalMethod,
    clientSignatureRef: approval.signatureRef,
    clientApprovalNotes: approval.notes,
    approvedByName: approval.approvedByName,
    approvedByEmail: approval.approvedByEmail,
    termsAccepted: true,
  });

  // Update SO gate
  const soRef = doc(db, SO_COLLECTION, dso.salesOrderId);
  const soSnap = await getDoc(soRef);
  if (soSnap.exists()) {
    const so = soSnap.data() as SalesOrder;

    // Verify scope version matches
    if (dso.scopeVersion === so.scopeVersion) {
      const updatedGates: ApprovalGates = {
        ...so.gates,
        designSignOff: {
          ...so.gates.designSignOff,
          status: 'approved',
          approvedAt: now,
          clientRespondedAt: now,
          clientSignatureRef: approval.signatureRef,
          evidence: `Design sign-off ${dso.signOffNumber} approved`,
        },
      };

      await updateDoc(soRef, {
        gates: updatedGates,
        updatedAt: serverTimestamp(),
      });
    }
    // If scope version doesn't match, sign-off is stale — don't update gate
  }
}

export async function recordDesignRejection(
  signOffId: string,
  reasons: string[],
  notes?: string,
): Promise<void> {
  const dso = await getDesignSignOff(signOffId);
  if (!dso) throw new Error('Design sign-off not found');

  const now = Timestamp.now();

  await updateDoc(doc(db, DESIGN_SIGNOFFS_COLLECTION, signOffId), {
    status: 'rejected',
    clientRejectedAt: now,
    rejectionReasons: reasons,
    rejectionNotes: notes,
  });

  // Reset SO gate to not_started
  const soRef = doc(db, SO_COLLECTION, dso.salesOrderId);
  const soSnap = await getDoc(soRef);
  if (soSnap.exists()) {
    const so = soSnap.data() as SalesOrder;
    const updatedGates: ApprovalGates = {
      ...so.gates,
      designSignOff: {
        ...so.gates.designSignOff,
        status: 'not_started',
        rejectionReason: reasons.join('; '),
        clientRespondedAt: now,
      },
    };

    await updateDoc(soRef, {
      gates: updatedGates,
      updatedAt: serverTimestamp(),
    });
  }
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export function subscribeToSignOffs(
  salesOrderId: string,
  callback: (signOffs: DesignSignOff[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, DESIGN_SIGNOFFS_COLLECTION),
    where('salesOrderId', '==', salesOrderId),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    const signOffs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DesignSignOff));
    callback(signOffs);
  });
}
