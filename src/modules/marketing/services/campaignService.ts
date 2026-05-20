/**
 * Campaign Service
 * Firestore CRUD operations and real-time subscriptions for marketing campaigns
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  CollectionReference,
  Query,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  MarketingCampaign,
  CampaignFormData,
  CampaignFilters,
  CampaignSend,
  SendFilters,
  CampaignMetrics,
} from '../types';
import { CAMPAIGNS_COLLECTION } from '../constants';

// Collection references
const campaignsRef = collection(db, CAMPAIGNS_COLLECTION) as CollectionReference<MarketingCampaign>;

// ============================================
// Campaign CRUD Operations
// ============================================

/**
 * Create a new marketing campaign
 */
export async function createCampaign(
  companyId: string,
  data: CampaignFormData,
  userId: string,
  userName: string
): Promise<string> {
  const campaign: Omit<MarketingCampaign, 'id'> = {
    companyId,
    name: data.name,
    description: data.description,
    campaignType: data.campaignType,
    targetAudience: data.targetAudience,
    estimatedReach: data.targetAudience.estimatedSize,
    status: 'draft',
    scheduledStartDate: Timestamp.fromDate(data.scheduledStartDate),
    scheduledEndDate: Timestamp.fromDate(data.scheduledEndDate),
    whatsappConfig: data.whatsappConfig,
    socialMediaConfig: data.socialMediaConfig,
    productPromotionConfig: data.productPromotionConfig,
    budget: data.budget,
    budgetCurrency: data.budgetCurrency,
    goals: data.goals.map((goal, index) => ({
      ...goal,
      id: `goal_${index}_${Date.now()}`,
      currentValue: 0,
    })),
    metrics: {
      totalSent: 0,
      totalReached: 0,
      totalEngagements: 0,
      totalConversions: 0,
      totalRevenue: 0,
      engagementRate: 0,
      conversionRate: 0,
      lastUpdated: serverTimestamp() as Timestamp,
    },
    createdBy: userId,
    createdByName: userName,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    tags: data.tags,
  };

  const docRef = await addDoc(campaignsRef, campaign);
  return docRef.id;
}

/**
 * Get a single campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<MarketingCampaign | null> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as MarketingCampaign;
}

/**
 * Get all campaigns for a company with optional filters
 */
export async function getCampaigns(
  companyId: string,
  filters: CampaignFilters = {}
): Promise<MarketingCampaign[]> {
  const constraints: any[] = [where('companyId', '==', companyId)];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.campaignType) {
    constraints.push(where('campaignType', '==', filters.campaignType));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(campaignsRef, ...constraints);
  const snapshot = await getDocs(q);

  let campaigns = snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  })) as MarketingCampaign[];

  // Client-side filters
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    campaigns = campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.description.toLowerCase().includes(searchLower)
    );
  }

  if (filters.tags && filters.tags.length > 0) {
    campaigns = campaigns.filter((c) => c.tags.some((tag) => filters.tags!.includes(tag)));
  }

  if (filters.dateFrom) {
    const dateFrom = Timestamp.fromDate(filters.dateFrom);
    campaigns = campaigns.filter((c) => c.createdAt >= dateFrom);
  }

  if (filters.dateTo) {
    const dateTo = Timestamp.fromDate(filters.dateTo);
    campaigns = campaigns.filter((c) => c.createdAt <= dateTo);
  }

  return campaigns;
}

/**
 * Update a campaign
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<CampaignFormData>
): Promise<void> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);

  const updateData: any = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Convert dates to Timestamps
  if (updates.scheduledStartDate) {
    updateData.scheduledStartDate = Timestamp.fromDate(updates.scheduledStartDate);
  }
  if (updates.scheduledEndDate) {
    updateData.scheduledEndDate = Timestamp.fromDate(updates.scheduledEndDate);
  }

  await updateDoc(docRef, updateData);
}

/**
 * Update campaign status
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: MarketingCampaign['status']
): Promise<void> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);

  const updateData: any = {
    status,
    updatedAt: serverTimestamp(),
  };

  // Set actual dates based on status
  if (status === 'active') {
    updateData.actualStartDate = serverTimestamp();
  } else if (status === 'completed' || status === 'cancelled') {
    updateData.actualEndDate = serverTimestamp();
  }

  await updateDoc(docRef, updateData);
}

/**
 * Update campaign metrics
 */
export async function updateCampaignMetrics(
  campaignId: string,
  metrics: Partial<CampaignMetrics>
): Promise<void> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);

  await updateDoc(docRef, {
    metrics: {
      ...metrics,
      lastUpdated: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await deleteDoc(docRef);
}

// ============================================
// Real-time Subscriptions
// ============================================

/**
 * Subscribe to campaigns list with real-time updates
 */
export function subscribeToCampaigns(
  companyId: string,
  callback: (campaigns: MarketingCampaign[]) => void,
  onError?: (error: Error) => void,
  filters: CampaignFilters = {}
): () => void {
  const constraints: any[] = [where('companyId', '==', companyId)];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.campaignType) {
    constraints.push(where('campaignType', '==', filters.campaignType));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(campaignsRef, ...constraints) as Query<MarketingCampaign>;

  return onSnapshot(
    q,
    (snapshot) => {
      let campaigns = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as MarketingCampaign[];

      // Client-side filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        campaigns = campaigns.filter(
          (c) =>
            c.name.toLowerCase().includes(searchLower) ||
            c.description.toLowerCase().includes(searchLower)
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        campaigns = campaigns.filter((c) => c.tags.some((tag) => filters.tags!.includes(tag)));
      }

      callback(campaigns);
    },
    (error) => {
      console.error('Campaigns subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to a single campaign
 */
export function subscribeToCampaign(
  campaignId: string,
  callback: (campaign: MarketingCampaign | null) => void,
  onError?: (error: Error) => void
): () => void {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback({
        id: snapshot.id,
        ...snapshot.data(),
      } as MarketingCampaign);
    },
    (error) => {
      console.error('Campaign subscription error:', error);
      onError?.(error);
    }
  );
}

// ============================================
// Campaign Sends (Sub-collection)
// ============================================

/**
 * Get campaign sends (messages sent as part of the campaign)
 */
export async function getCampaignSends(
  campaignId: string,
  filters: SendFilters = {}
): Promise<CampaignSend[]> {
  const sendsRef = collection(db, CAMPAIGNS_COLLECTION, campaignId, 'sends');
  const constraints: any[] = [];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.replied !== undefined) {
    constraints.push(where('replied', '==', filters.replied));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(sendsRef, ...constraints);
  const snapshot = await getDocs(q);

  let sends = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CampaignSend[];

  // Client-side date filters
  if (filters.dateFrom) {
    const dateFrom = Timestamp.fromDate(filters.dateFrom);
    sends = sends.filter((s) => s.createdAt >= dateFrom);
  }

  if (filters.dateTo) {
    const dateTo = Timestamp.fromDate(filters.dateTo);
    sends = sends.filter((s) => s.createdAt <= dateTo);
  }

  return sends;
}

/**
 * Subscribe to campaign sends
 */
export function subscribeToCampaignSends(
  campaignId: string,
  callback: (sends: CampaignSend[]) => void,
  onError?: (error: Error) => void,
  limitCount = 100
): () => void {
  const sendsRef = collection(db, CAMPAIGNS_COLLECTION, campaignId, 'sends');
  const q = query(sendsRef, orderBy('createdAt', 'desc'), limit(limitCount));

  return onSnapshot(
    q,
    (snapshot) => {
      const sends = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CampaignSend[];

      callback(sends);
    },
    (error) => {
      console.error('Campaign sends subscription error:', error);
      onError?.(error);
    }
  );
}

// ============================================
// Analytics & Stats
// ============================================

/**
 * Calculate campaign statistics
 */
export async function getCampaignStats(campaignId: string): Promise<{
  totalSends: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
  failureRate: number;
}> {
  const sends = await getCampaignSends(campaignId);

  const totalSends = sends.length;
  const delivered = sends.filter((s) => s.status === 'delivered' || s.status === 'read' || s.status === 'replied').length;
  const read = sends.filter((s) => s.status === 'read' || s.status === 'replied').length;
  const replied = sends.filter((s) => s.replied).length;
  const failed = sends.filter((s) => s.status === 'failed').length;

  return {
    totalSends,
    deliveryRate: totalSends > 0 ? (delivered / totalSends) * 100 : 0,
    readRate: totalSends > 0 ? (read / totalSends) * 100 : 0,
    replyRate: totalSends > 0 ? (replied / totalSends) * 100 : 0,
    failureRate: totalSends > 0 ? (failed / totalSends) * 100 : 0,
  };
}

/**
 * Get recent campaigns
 */
export async function getRecentCampaigns(
  companyId: string,
  limitCount = 5
): Promise<MarketingCampaign[]> {
  const q = query(
    campaignsRef,
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  })) as MarketingCampaign[];
}

/**
 * Get active campaigns
 */
export async function getActiveCampaigns(companyId: string): Promise<MarketingCampaign[]> {
  const q = query(
    campaignsRef,
    where('companyId', '==', companyId),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  })) as MarketingCampaign[];
}
