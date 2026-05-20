/**
 * Social Media Service
 * CRUD operations and real-time subscriptions for social media posts
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { COLLECTIONS } from '../constants';
import type { SocialMediaPost, SocialPostFormData, SocialPostFilters, PostStatus } from '../types';

// ============================================
// Create
// ============================================

export async function createSocialPost(
  data: SocialPostFormData & { companyId: string; subsidiaryId?: string },
  createdBy: string,
  createdByName: string
): Promise<string> {
  const postData: Omit<SocialMediaPost, 'id'> = {
    companyId: data.companyId,
    subsidiaryId: data.subsidiaryId,
    title: data.title,
    content: data.content,
    platforms: data.platforms,
    socialAccountIds: data.socialAccountIds,
    mediaUrls: data.mediaUrls || [],
    mediaType: data.mediaType || 'image',
    status: data.scheduledFor ? 'scheduled' : 'draft',
    scheduledFor: data.scheduledFor ? Timestamp.fromDate(data.scheduledFor) : undefined,
    platformPosts: data.platforms.map((platform) => ({
      platform,
      status: 'draft' as PostStatus,
    })),
    campaignId: data.campaignId,
    tags: data.tags || [],
    category: data.category,
    createdBy,
    createdByName,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.SOCIAL_POSTS), postData);
  return docRef.id;
}

// ============================================
// Read
// ============================================

export async function getSocialPost(postId: string): Promise<SocialMediaPost | null> {
  const docRef = doc(db, COLLECTIONS.SOCIAL_POSTS, postId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as SocialMediaPost;
}

export function subscribeToSocialPosts(
  companyId: string,
  callback: (posts: SocialMediaPost[]) => void,
  onError?: (error: Error) => void,
  filters: SocialPostFilters = {}
): () => void {
  const constraints: any[] = [
    where('companyId', '==', companyId),
  ];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.campaignId) {
    constraints.push(where('campaignId', '==', filters.campaignId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, COLLECTIONS.SOCIAL_POSTS), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      let posts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SocialMediaPost[];

      // Client-side filtering for fields that can't be efficiently indexed
      if (filters.platforms && filters.platforms.length > 0) {
        posts = posts.filter((p) =>
          p.platforms.some((platform) => filters.platforms!.includes(platform))
        );
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();
        posts = posts.filter(
          (p) =>
            p.title.toLowerCase().includes(search) ||
            p.content.toLowerCase().includes(search)
        );
      }

      if (filters.dateFrom) {
        posts = posts.filter((p) => {
          const date = p.scheduledFor?.toDate() || p.createdAt?.toDate();
          return date && date >= filters.dateFrom!;
        });
      }

      if (filters.dateTo) {
        posts = posts.filter((p) => {
          const date = p.scheduledFor?.toDate() || p.createdAt?.toDate();
          return date && date <= filters.dateTo!;
        });
      }

      callback(posts);
    },
    (error) => {
      console.error('Error subscribing to social posts:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to posts scoped to a subsidiary (with optional filters).
 * Posts without subsidiaryId are excluded; run the backfill script before relying on this.
 */
export function subscribeToSocialPostsBySubsidiary(
  subsidiaryId: string,
  callback: (posts: SocialMediaPost[]) => void,
  onError?: (error: Error) => void,
  filters: SocialPostFilters = {}
): () => void {
  const constraints: any[] = [where('subsidiaryId', '==', subsidiaryId)];

  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.campaignId) constraints.push(where('campaignId', '==', filters.campaignId));

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, COLLECTIONS.SOCIAL_POSTS), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      let posts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as SocialMediaPost[];

      if (filters.platforms && filters.platforms.length > 0) {
        posts = posts.filter((p) =>
          p.platforms.some((platform) => filters.platforms!.includes(platform))
        );
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        posts = posts.filter(
          (p) => p.title.toLowerCase().includes(s) || p.content.toLowerCase().includes(s)
        );
      }
      if (filters.dateFrom) {
        posts = posts.filter((p) => {
          const date = p.scheduledFor?.toDate() || p.createdAt?.toDate();
          return date && date >= filters.dateFrom!;
        });
      }
      if (filters.dateTo) {
        posts = posts.filter((p) => {
          const date = p.scheduledFor?.toDate() || p.createdAt?.toDate();
          return date && date <= filters.dateTo!;
        });
      }
      callback(posts);
    },
    (error) => {
      console.error('Error subscribing to subsidiary social posts:', error);
      onError?.(error);
    }
  );
}

/**
 * Get posts for a specific date range (for calendar view)
 */
export function subscribeToPostsByDateRange(
  companyId: string,
  startDate: Date,
  endDate: Date,
  callback: (posts: SocialMediaPost[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTIONS.SOCIAL_POSTS),
    where('companyId', '==', companyId),
    where('scheduledFor', '>=', Timestamp.fromDate(startDate)),
    where('scheduledFor', '<=', Timestamp.fromDate(endDate)),
    orderBy('scheduledFor', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const posts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SocialMediaPost[];
      callback(posts);
    },
    (error) => {
      console.error('Error subscribing to posts by date range:', error);
      onError?.(error);
    }
  );
}

// ============================================
// Update
// ============================================

export async function updateSocialPost(
  postId: string,
  data: Partial<SocialPostFormData>,
  _updatedBy: string
): Promise<void> {
  const updates: Record<string, any> = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  if (data.scheduledFor) {
    updates.scheduledFor = Timestamp.fromDate(data.scheduledFor);
    if (!data.scheduledFor) {
      updates.status = 'draft';
    }
  }

  if (data.platforms) {
    updates.platformPosts = data.platforms.map((platform) => ({
      platform,
      status: 'draft' as PostStatus,
    }));
  }

  await updateDoc(doc(db, COLLECTIONS.SOCIAL_POSTS, postId), updates);
}

export async function updatePostStatus(
  postId: string,
  status: PostStatus
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.SOCIAL_POSTS, postId), {
    status,
    updatedAt: serverTimestamp(),
    ...(status === 'published' ? { publishedAt: serverTimestamp() } : {}),
  });
}

export async function schedulePost(
  postId: string,
  scheduledFor: Date,
  socialAccountIds?: Partial<Record<string, string>>
): Promise<void> {
  const payload: Record<string, unknown> = {
    status: 'scheduled',
    scheduledFor: Timestamp.fromDate(scheduledFor),
    updatedAt: serverTimestamp(),
  };
  if (socialAccountIds && Object.keys(socialAccountIds).length > 0) {
    payload.socialAccountIds = socialAccountIds;
  }
  await updateDoc(doc(db, COLLECTIONS.SOCIAL_POSTS, postId), payload);
}

// ============================================
// Delete
// ============================================

export async function deleteSocialPost(postId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.SOCIAL_POSTS, postId));
}
