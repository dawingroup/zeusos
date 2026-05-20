// ============================================================================
// STRATEGY REVIEW SERVICE - DawinOS CEO Strategy Command
// Firestore persistence for strategy review data
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import type { StrategyReviewData } from '../types/strategy.types';

const COLLECTION = 'strategy_reviews';

// ----------------------------------------------------------------------------
// Collection References
// ----------------------------------------------------------------------------
function getReviewsCollection(companyId: string) {
  return collection(db, 'companies', companyId, COLLECTION);
}

function getReviewRef(companyId: string, reviewId: string) {
  return doc(db, 'companies', companyId, COLLECTION, reviewId);
}

// ----------------------------------------------------------------------------
// Serialization helpers — strip undefined values for Firestore
// ----------------------------------------------------------------------------
function sanitizeForFirestore(obj: unknown): unknown {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

/**
 * Strip fields that are ephemeral or too large for Firestore's 1MB doc limit.
 *
 * Strategy:
 * - KEEP uploadedDocument.parsedContent (~96KB) — it's the single source of truth
 * - STRIP section currentContent when it's an exact copy of parsedContent
 *   (these are temporary duplicates created on upload, before AI fills sections)
 * - STRIP aiConversationHistory — session-ephemeral chat
 */
function stripLargeFields(data: Partial<StrategyReviewData>): Partial<StrategyReviewData> {
  const out = { ...data };

  // Strip conversation history (session-ephemeral)
  if (out.aiConversationHistory) {
    delete out.aiConversationHistory;
  }

  // Strip section currentContent that is just a duplicate of the full document.
  // After AI fills sections with section-specific content, it won't match anymore.
  const fullDoc = out.uploadedDocument?.parsedContent;
  if (fullDoc && out.sectionReviews) {
    const reviews = { ...out.sectionReviews };
    for (const key of Object.keys(reviews) as (keyof typeof reviews)[]) {
      if (reviews[key]?.currentContent === fullDoc) {
        reviews[key] = { ...reviews[key], currentContent: '' };
      }
    }
    out.sectionReviews = reviews;
  }

  return out;
}

// ============================================================================
// STRATEGY REVIEW SERVICE CLASS
// ============================================================================
class StrategyReviewService {
  // --------------------------------------------------------------------------
  // Create Review
  // --------------------------------------------------------------------------
  async createReview(
    companyId: string,
    data: StrategyReviewData,
    userId: string
  ): Promise<StrategyReviewData> {
    const colRef = getReviewsCollection(companyId);
    const docRef = data.id ? doc(colRef, data.id) : doc(colRef);
    const now = new Date().toISOString();

    const reviewData: StrategyReviewData = {
      ...data,
      id: docRef.id,
      companyId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, sanitizeForFirestore(reviewData));
    return reviewData;
  }

  // --------------------------------------------------------------------------
  // Get Review by ID
  // --------------------------------------------------------------------------
  async getReview(
    companyId: string,
    reviewId: string
  ): Promise<StrategyReviewData | null> {
    const snap = await getDoc(getReviewRef(companyId, reviewId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as StrategyReviewData;
  }

  // --------------------------------------------------------------------------
  // List Reviews
  // --------------------------------------------------------------------------
  async getReviews(
    companyId: string,
    options?: { status?: string; limit?: number }
  ): Promise<StrategyReviewData[]> {
    let q = query(
      getReviewsCollection(companyId),
      orderBy('updatedAt', 'desc')
    );

    if (options?.status) {
      q = query(q, where('status', '==', options.status));
    }
    if (options?.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as StrategyReviewData));
  }

  // --------------------------------------------------------------------------
  // Save / Update Review (full replace)
  // --------------------------------------------------------------------------
  async saveReview(
    companyId: string,
    reviewId: string,
    data: Partial<StrategyReviewData>,
    userId: string
  ): Promise<void> {
    const now = new Date().toISOString();
    // Strip large fields that push past Firestore's 1MB doc limit
    const trimmed = stripLargeFields(data);
    const sanitized = sanitizeForFirestore(trimmed) as Record<string, unknown>;
    const updateData: Record<string, unknown> = {
      ...sanitized,
      updatedAt: now,
      updatedBy: userId,
    };

    const ref = getReviewRef(companyId, reviewId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await updateDoc(ref, updateData);
    } else {
      // First save — create with full data
      await setDoc(ref, {
        ...updateData,
        id: reviewId,
        companyId,
        createdBy: userId,
        createdAt: now,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Auto-save (debounced partial update — lighter weight)
  // --------------------------------------------------------------------------
  async autoSave(
    companyId: string,
    reviewId: string,
    data: Partial<StrategyReviewData>,
    userId: string
  ): Promise<void> {
    const ref = getReviewRef(companyId, reviewId);
    const snap = await getDoc(ref);

    // Strip large fields to stay under Firestore's 1MB doc limit
    const saveData = stripLargeFields(data);

    if (!snap.exists()) {
      // First auto-save creates the document
      await setDoc(ref, sanitizeForFirestore({
        ...saveData,
        id: reviewId,
        companyId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    await updateDoc(ref, sanitizeForFirestore({
      ...saveData,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    }) as Record<string, unknown>);
  }

  // --------------------------------------------------------------------------
  // Delete Review
  // --------------------------------------------------------------------------
  async deleteReview(companyId: string, reviewId: string): Promise<void> {
    await deleteDoc(getReviewRef(companyId, reviewId));
  }

  // --------------------------------------------------------------------------
  // Subscribe to real-time changes
  // --------------------------------------------------------------------------
  subscribeToReview(
    companyId: string,
    reviewId: string,
    callback: (data: StrategyReviewData | null) => void
  ): Unsubscribe {
    return onSnapshot(getReviewRef(companyId, reviewId), (snap) => {
      if (snap.exists()) {
        callback({ ...snap.data(), id: snap.id } as StrategyReviewData);
      } else {
        callback(null);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Update review status
  // --------------------------------------------------------------------------
  async updateStatus(
    companyId: string,
    reviewId: string,
    status: StrategyReviewData['status'],
    userId: string
  ): Promise<void> {
    await updateDoc(getReviewRef(companyId, reviewId), {
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
      ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    });
  }
}

export const strategyReviewService = new StrategyReviewService();
export default strategyReviewService;
