/**
 * Discount Policy Service
 * Policy CRUD, discount evaluation, margin calculation.
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  DiscountPolicy,
  DiscountEvaluation,
  MarginAnalysis,
  SalesOrder,
} from '../types';
import { DISCOUNT_POLICIES_COLLECTION, SO_COLLECTION } from '../constants';

// ============================================================================
// POLICY CRUD
// ============================================================================

export async function getPolicy(
  subsidiaryId?: string,
): Promise<DiscountPolicy | null> {
  // Try subsidiary-specific first, then fallback to global
  if (subsidiaryId) {
    const q = query(
      collection(db, DISCOUNT_POLICIES_COLLECTION),
      where('subsidiaryId', '==', subsidiaryId),
      where('isActive', '==', true),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as DiscountPolicy;
    }
  }

  // Fallback: global policy (no subsidiaryId)
  const q = query(
    collection(db, DISCOUNT_POLICIES_COLLECTION),
    where('isActive', '==', true),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  // Prefer one without subsidiaryId
  const global = snap.docs.find((d) => !d.data().subsidiaryId);
  if (global) return { id: global.id, ...global.data() } as DiscountPolicy;

  return { id: snap.docs[0].id, ...snap.docs[0].data() } as DiscountPolicy;
}

export async function createPolicy(
  data: Omit<DiscountPolicy, 'id' | 'isActive' | 'updatedAt'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, DISCOUNT_POLICIES_COLLECTION), {
    ...data,
    isActive: true,
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePolicy(
  policyId: string,
  updates: Partial<DiscountPolicy>,
): Promise<void> {
  await updateDoc(doc(db, DISCOUNT_POLICIES_COLLECTION, policyId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function getAllPolicies(subsidiaryId?: string): Promise<DiscountPolicy[]> {
  const constraints = subsidiaryId
    ? [where('subsidiaryId', '==', subsidiaryId)]
    : [];

  const q = query(collection(db, DISCOUNT_POLICIES_COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiscountPolicy));
}

// ============================================================================
// DISCOUNT EVALUATION
// ============================================================================

export async function evaluateDiscount(
  orderId: string,
  discountPercent: number,
  discountAmount: number,
): Promise<DiscountEvaluation> {
  const soRef = doc(db, SO_COLLECTION, orderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) {
    return {
      autoApproved: false,
      exceedsPolicy: true,
      marginAfterDiscount: 0,
      marginBelowMinimum: true,
      warnings: ['Sales order not found'],
    };
  }

  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;
  const policy = await getPolicy(so.subsidiaryId);

  // No policy → cannot auto-approve
  if (!policy) {
    return {
      autoApproved: false,
      requiredApprover: 'manager',
      exceedsPolicy: false,
      marginAfterDiscount: 0,
      marginBelowMinimum: false,
      warnings: ['No discount policy configured — requires manual approval'],
    };
  }

  const warnings: string[] = [];
  let autoApproved = false;
  let requiredApprover: DiscountEvaluation['requiredApprover'];
  let exceedsPolicy = false;

  // Check against auto-approve thresholds
  if (discountPercent <= policy.autoApproveMaxPercent && discountAmount <= policy.autoApproveMaxAmount) {
    autoApproved = true;
  } else if (discountPercent <= policy.managerApproveMaxPercent) {
    requiredApprover = 'manager';
  } else if (discountPercent <= policy.ceoApproveMaxPercent) {
    requiredApprover = 'ceo';
    warnings.push('Discount requires CEO approval');
  } else {
    requiredApprover = 'special';
    exceedsPolicy = true;
    warnings.push('Discount exceeds maximum policy threshold — requires board/special approval');
  }

  // Calculate margin impact (simplified — uses quote amount as proxy for revenue)
  const priceAfterDiscount = so.currentAmount - discountAmount;
  // Estimate cost at 60% of original quote (default assumption)
  const estimatedCost = so.originalQuoteAmount * 0.6;
  const marginAfterDiscount =
    priceAfterDiscount > 0
      ? ((priceAfterDiscount - estimatedCost) / priceAfterDiscount) * 100
      : 0;

  const marginBelowMinimum = marginAfterDiscount < policy.minimumMarginPercent;

  if (marginBelowMinimum) {
    autoApproved = false;
    if (!requiredApprover || requiredApprover === 'manager') {
      requiredApprover = 'ceo';
    }
    warnings.push(
      `Margin after discount (${marginAfterDiscount.toFixed(1)}%) is below minimum (${policy.minimumMarginPercent}%)`,
    );
  } else if (marginAfterDiscount < policy.minimumMarginWarning) {
    warnings.push(
      `Margin after discount (${marginAfterDiscount.toFixed(1)}%) is approaching minimum (${policy.minimumMarginWarning}%)`,
    );
  }

  // Check category rules
  // (Would need line-item level analysis for full implementation)

  return {
    autoApproved,
    requiredApprover,
    marginAfterDiscount,
    marginBelowMinimum,
    exceedsPolicy,
    warnings,
  };
}

// ============================================================================
// MARGIN ANALYSIS
// ============================================================================

export async function calculatePostDiscountMargin(
  orderId: string,
  discountAmount: number,
): Promise<MarginAnalysis> {
  const soRef = doc(db, SO_COLLECTION, orderId);
  const soSnap = await getDoc(soRef);

  if (!soSnap.exists()) {
    return {
      originalMargin: 0,
      newMargin: 0,
      marginReduction: 0,
      belowMinimum: true,
      estimatedCost: 0,
      projectedProfit: 0,
    };
  }

  const so = soSnap.data() as SalesOrder;
  const policy = await getPolicy(so.subsidiaryId);
  const minimumMargin = policy?.minimumMarginPercent ?? 15;

  // Estimate cost at 60% of original quote
  const estimatedCost = so.originalQuoteAmount * 0.6;

  const originalMargin =
    so.currentAmount > 0
      ? ((so.currentAmount - estimatedCost) / so.currentAmount) * 100
      : 0;

  const priceAfterDiscount = so.currentAmount - discountAmount;
  const newMargin =
    priceAfterDiscount > 0
      ? ((priceAfterDiscount - estimatedCost) / priceAfterDiscount) * 100
      : 0;

  return {
    originalMargin,
    newMargin,
    marginReduction: originalMargin - newMargin,
    belowMinimum: newMargin < minimumMargin,
    estimatedCost,
    projectedProfit: priceAfterDiscount - estimatedCost,
  };
}
