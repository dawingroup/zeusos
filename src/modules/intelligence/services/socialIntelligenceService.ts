// ============================================================================
// SOCIAL INTELLIGENCE SERVICE
// DawinOS v2.0 - Market Intelligence Module
// Firestore CRUD + Cloud Function wrappers for social tracking
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../../shared/services/firebase/firestore';
import {
  SocialPost,
  SocialMetrics,
  SocialAnalysisResult,
  SocialSyncResult,
  FetchPostsResult,
  SocialPlatform,
} from '../types/socialIntelligence.types';

const SOCIAL_POSTS_COLLECTION = 'social_posts';
const SOCIAL_METRICS_COLLECTION = 'social_metrics';

// ============================================================================
// READ — SOCIAL POSTS
// ============================================================================

export const socialIntelligenceService = {
  // --------------------------------------------------------------------------
  // POSTS
  // --------------------------------------------------------------------------

  async getPostsByCompetitor(
    competitorId: string,
    options?: {
      platform?: SocialPlatform;
      limit?: number;
    }
  ): Promise<SocialPost[]> {
    // Validate input
    if (!competitorId || competitorId.trim() === '') {
      console.warn('getPostsByCompetitor called with empty competitorId');
      return [];
    }

    let q = query(
      collection(db, SOCIAL_POSTS_COLLECTION),
      where('competitorId', '==', competitorId),
      orderBy('publishedAt', 'desc')
    );

    if (options?.platform) {
      q = query(
        collection(db, SOCIAL_POSTS_COLLECTION),
        where('competitorId', '==', competitorId),
        where('platform', '==', options.platform),
        orderBy('publishedAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    let posts = snapshot.docs
      .map(d => {
        const data = { id: d.id, ...d.data() } as Record<string, unknown>;
        // Validate required fields
        if (!data.competitorId || !data.profileId || !data.postId) {
          console.warn(`Invalid post data in Firestore: ${d.id}`);
          return null;
        }
        return data as unknown as SocialPost;
      })
      .filter((p): p is SocialPost => p !== null);

    if (options?.limit) {
      posts = posts.slice(0, options.limit);
    }

    return posts;
  },

  async getPostsByProfile(profileId: string, maxResults = 20): Promise<SocialPost[]> {
    // Validate input
    if (!profileId || profileId.trim() === '') {
      console.warn('getPostsByProfile called with empty profileId');
      return [];
    }

    const q = query(
      collection(db, SOCIAL_POSTS_COLLECTION),
      where('profileId', '==', profileId),
      orderBy('publishedAt', 'desc'),
      firestoreLimit(maxResults)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => {
        const data = { id: d.id, ...d.data() } as Record<string, unknown>;
        // Validate required fields
        if (!data.competitorId || !data.profileId || !data.postId) {
          console.warn(`Invalid post data in Firestore: ${d.id}`);
          return null;
        }
        return data as unknown as SocialPost;
      })
      .filter((p): p is SocialPost => p !== null);
  },

  async getPost(postId: string): Promise<SocialPost | null> {
    const docSnap = await getDoc(doc(db, SOCIAL_POSTS_COLLECTION, postId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as unknown as SocialPost;
  },

  async getAnalyzedPosts(competitorId: string, maxResults = 50): Promise<SocialPost[]> {
    // Validate input
    if (!competitorId || competitorId.trim() === '') {
      console.warn('getAnalyzedPosts called with empty competitorId');
      return [];
    }

    const q = query(
      collection(db, SOCIAL_POSTS_COLLECTION),
      where('competitorId', '==', competitorId),
      orderBy('publishedAt', 'desc'),
      firestoreLimit(maxResults)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }) as unknown as SocialPost)
      .filter(p => p.aiAnalysis != null);
  },

  // --------------------------------------------------------------------------
  // METRICS
  // --------------------------------------------------------------------------

  async getLatestMetrics(competitorId: string): Promise<SocialMetrics[]> {
    // Validate input
    if (!competitorId || competitorId.trim() === '') {
      console.warn('getLatestMetrics called with empty competitorId');
      return [];
    }

    const q = query(
      collection(db, SOCIAL_METRICS_COLLECTION),
      where('competitorId', '==', competitorId),
      orderBy('capturedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const allMetrics = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SocialMetrics[];

    // Deduplicate: keep only the latest per platform
    const seen = new Set<string>();
    return allMetrics.filter(m => {
      if (seen.has(m.platform)) return false;
      seen.add(m.platform);
      return true;
    });
  },

  async getMetricsHistory(
    profileId: string,
    maxResults = 30
  ): Promise<SocialMetrics[]> {
    // Validate input
    if (!profileId || profileId.trim() === '') {
      console.warn('getMetricsHistory called with empty profileId');
      return [];
    }

    const q = query(
      collection(db, SOCIAL_METRICS_COLLECTION),
      where('profileId', '==', profileId),
      orderBy('capturedAt', 'desc'),
      firestoreLimit(maxResults)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SocialMetrics[];
  },

  async getAllLatestMetrics(): Promise<SocialMetrics[]> {
    const q = query(
      collection(db, SOCIAL_METRICS_COLLECTION),
      orderBy('capturedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const allMetrics = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SocialMetrics[];

    // Deduplicate: keep only the latest per competitor+platform
    const seen = new Set<string>();
    return allMetrics.filter(m => {
      const key = `${m.competitorId}_${m.platform}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  // --------------------------------------------------------------------------
  // CLOUD FUNCTION WRAPPERS
  // --------------------------------------------------------------------------

  async fetchPosts(profileId: string): Promise<FetchPostsResult> {
    const functions = getFunctions();
    const fn = httpsCallable(functions, 'fetchSocialPosts');
    const result = await fn({ profileId });
    return result.data as FetchPostsResult;
  },

  async analyzeStrategy(
    postIds: string[],
    competitorId: string,
    competitorName: string
  ): Promise<SocialAnalysisResult> {
    const functions = getFunctions();
    const fn = httpsCallable(functions, 'analyzeSocialStrategy');
    const result = await fn({ postIds, competitorId, competitorName });
    return result.data as SocialAnalysisResult;
  },

  async triggerSync(competitorId?: string): Promise<SocialSyncResult> {
    const functions = getFunctions();
    const fn = httpsCallable(functions, 'triggerSocialSync');
    const result = await fn({ competitorId });
    return result.data as SocialSyncResult;
  },
};
