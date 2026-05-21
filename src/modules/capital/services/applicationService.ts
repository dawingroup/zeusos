// ============================================================================
// APPLICATION SERVICE
// ZeusOS v2.0 — Capital application pipeline management
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  CapitalApplication,
  CapitalApplicationFilters,
  ApplicationStage,
  ApplicationDocument,
  ApplicationCommunication,
} from '../types/capital.types';
import type { CapitalApplicationInput } from '../schemas/capital.schemas';
import { CAPITAL_APPLICATIONS_COLLECTION } from '../constants/capital.constants';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string) {
  return collection(db, 'companies', companyId, CAPITAL_APPLICATIONS_COLLECTION);
}

function companyDoc(companyId: string, docId: string) {
  return doc(db, 'companies', companyId, CAPITAL_APPLICATIONS_COLLECTION, docId);
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class ApplicationService {

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════════════

  async createApplication(
    companyId: string,
    input: CapitalApplicationInput,
    userId: string,
  ): Promise<CapitalApplication> {
    const data = {
      ...input,
      companyId,
      stageHistory: [
        {
          from: '',
          to: input.stage || 'identifying',
          changedAt: Timestamp.now(),
          changedBy: userId,
        },
      ],
      documents: [],
      communications: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
    };

    const docRef = await addDoc(companyCol(companyId), data);
    return { id: docRef.id, ...data } as CapitalApplication;
  }

  async getApplication(
    companyId: string,
    applicationId: string,
  ): Promise<CapitalApplication | null> {
    const docSnap = await getDoc(companyDoc(companyId, applicationId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as CapitalApplication;
  }

  async getApplications(
    companyId: string,
    filters: CapitalApplicationFilters = {},
  ): Promise<CapitalApplication[]> {
    let q = query(companyCol(companyId), orderBy('createdAt', 'desc'));

    if (filters.stage) {
      q = query(q, where('stage', '==', filters.stage));
    }
    if (filters.productType) {
      q = query(q, where('productType', '==', filters.productType));
    }

    const snapshot = await getDocs(q);
    let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CapitalApplication));

    if (filters.outcome) {
      items = items.filter(i => i.outcome === filters.outcome);
    }
    if (filters.provider) {
      items = items.filter(i =>
        i.provider.toLowerCase().includes(filters.provider!.toLowerCase()),
      );
    }
    if (filters.minAmount !== undefined) {
      items = items.filter(i => i.amountRequested >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      items = items.filter(i => i.amountRequested <= filters.maxAmount!);
    }

    return items;
  }

  async updateApplication(
    companyId: string,
    applicationId: string,
    updates: Partial<CapitalApplicationInput>,
  ): Promise<void> {
    await updateDoc(companyDoc(companyId, applicationId), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteApplication(
    companyId: string,
    applicationId: string,
  ): Promise<void> {
    await deleteDoc(companyDoc(companyId, applicationId));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  async updateStage(
    companyId: string,
    applicationId: string,
    newStage: ApplicationStage,
    userId: string,
    notes?: string,
  ): Promise<void> {
    const app = await this.getApplication(companyId, applicationId);
    if (!app) throw new Error('Application not found');

    const stageHistory = [
      ...app.stageHistory,
      {
        from: app.stage,
        to: newStage,
        changedAt: Timestamp.now(),
        changedBy: userId,
        notes,
      },
    ];

    const updates: Record<string, unknown> = {
      stage: newStage,
      stageHistory,
      updatedAt: Timestamp.now(),
    };

    // Set key dates based on stage
    if (newStage === 'submitted' && !app.submittedDate) {
      updates.submittedDate = Timestamp.now();
    }
    if (newStage === 'approved') {
      updates.approvalDate = Timestamp.now();
      updates.outcome = 'approved';
    }
    if (newStage === 'completed') {
      updates.disbursementDate = Timestamp.now();
    }
    if (newStage === 'declined') {
      updates.outcome = 'declined';
    }
    if (newStage === 'withdrawn') {
      updates.outcome = 'withdrawn';
    }

    await updateDoc(companyDoc(companyId, applicationId), updates);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DOCUMENTS
  // ══════════════════════════════════════════════════════════════════════════

  async addDocument(
    companyId: string,
    applicationId: string,
    document: Omit<ApplicationDocument, 'id' | 'uploadedAt'>,
  ): Promise<void> {
    const app = await this.getApplication(companyId, applicationId);
    if (!app) throw new Error('Application not found');

    const newDoc: ApplicationDocument = {
      ...document,
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uploadedAt: Timestamp.now(),
    };

    await updateDoc(companyDoc(companyId, applicationId), {
      documents: [...app.documents, newDoc],
      updatedAt: Timestamp.now(),
    });
  }

  async updateDocumentStatus(
    companyId: string,
    applicationId: string,
    documentId: string,
    status: ApplicationDocument['status'],
  ): Promise<void> {
    const app = await this.getApplication(companyId, applicationId);
    if (!app) throw new Error('Application not found');

    const documents = app.documents.map(d =>
      d.id === documentId ? { ...d, status } : d,
    );

    await updateDoc(companyDoc(companyId, applicationId), {
      documents,
      updatedAt: Timestamp.now(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMMUNICATIONS
  // ══════════════════════════════════════════════════════════════════════════

  async logCommunication(
    companyId: string,
    applicationId: string,
    communication: Omit<ApplicationCommunication, 'id' | 'date'>,
    userId: string,
  ): Promise<void> {
    const app = await this.getApplication(companyId, applicationId);
    if (!app) throw new Error('Application not found');

    const newComm: ApplicationCommunication = {
      ...communication,
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: Timestamp.now(),
      createdBy: userId,
    };

    await updateDoc(companyDoc(companyId, applicationId), {
      communications: [...app.communications, newComm],
      updatedAt: Timestamp.now(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PIPELINE ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  async getPipelineSummary(companyId: string) {
    const apps = await this.getApplications(companyId);

    const byStage = new Map<ApplicationStage, { count: number; totalAmount: number }>();
    for (const app of apps) {
      const current = byStage.get(app.stage) || { count: 0, totalAmount: 0 };
      current.count++;
      current.totalAmount += app.amountRequested;
      byStage.set(app.stage, current);
    }

    const activeApps = apps.filter(
      a => !['completed', 'declined', 'withdrawn'].includes(a.stage),
    );

    return {
      total: apps.length,
      active: activeApps.length,
      totalAmountInPipeline: activeApps.reduce((s, a) => s + a.amountRequested, 0),
      byStage: Object.fromEntries(byStage),
      recentActivity: apps.slice(0, 5),
    };
  }
}

export const applicationService = new ApplicationService();
