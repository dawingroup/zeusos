/**
 * useSocialPosts Hook
 * Subscribe to social media posts with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  SocialMediaPost,
  SocialPostFilters,
  SocialPostFormData,
  SocialPlatform,
} from '../types';
import {
  subscribeToSocialPosts,
  subscribeToPostsByDateRange,
  createSocialPost,
  updateSocialPost,
  updatePostStatus,
  schedulePost,
  deleteSocialPost,
} from '../services/socialMediaService';
import type { PostStatus } from '../types';

export interface UseSocialPostsResult {
  posts: SocialMediaPost[];
  loading: boolean;
  error: Error | null;
  create: (data: SocialPostFormData) => Promise<string>;
  update: (postId: string, data: Partial<SocialPostFormData>) => Promise<void>;
  changeStatus: (postId: string, status: PostStatus) => Promise<void>;
  schedule: (
    postId: string,
    scheduledFor: Date,
    socialAccountIds?: Partial<Record<SocialPlatform, string>>
  ) => Promise<void>;
  remove: (postId: string) => Promise<void>;
}

export function useSocialPosts(
  companyId: string | undefined,
  filters: SocialPostFilters = {},
  userEmail?: string,
  userName?: string,
  subsidiaryId?: string
): UseSocialPostsResult {
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToSocialPosts(
      companyId,
      (data) => {
        const next = subsidiaryId
          ? data.filter((p) => !p.subsidiaryId || p.subsidiaryId === subsidiaryId)
          : data;
        setPosts(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      filters
    );

    return () => unsubscribe();
  }, [companyId, subsidiaryId, JSON.stringify(filters)]);

  const create = useCallback(
    async (data: SocialPostFormData) => {
      if (!companyId || !userEmail) throw new Error('Missing company or user info');
      return createSocialPost(
        { ...data, companyId, subsidiaryId },
        userEmail,
        userName || userEmail
      );
    },
    [companyId, userEmail, userName, subsidiaryId]
  );

  const update = useCallback(
    async (postId: string, data: Partial<SocialPostFormData>) => {
      if (!userEmail) throw new Error('Missing user info');
      return updateSocialPost(postId, data, userEmail);
    },
    [userEmail]
  );

  const changeStatus = useCallback(
    async (postId: string, status: PostStatus) => {
      return updatePostStatus(postId, status);
    },
    []
  );

  const schedule = useCallback(
    async (
      postId: string,
      scheduledFor: Date,
      socialAccountIds?: Partial<Record<SocialPlatform, string>>
    ) => {
      return schedulePost(postId, scheduledFor, socialAccountIds);
    },
    []
  );

  const remove = useCallback(
    async (postId: string) => {
      return deleteSocialPost(postId);
    },
    []
  );

  return { posts, loading, error, create, update, changeStatus, schedule, remove };
}

/**
 * Hook for calendar date-range subscriptions
 */
export interface UseCalendarPostsResult {
  posts: SocialMediaPost[];
  loading: boolean;
  error: Error | null;
}

export function useCalendarPosts(
  companyId: string | undefined,
  startDate: Date,
  endDate: Date
): UseCalendarPostsResult {
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToPostsByDateRange(
      companyId,
      startDate,
      endDate,
      (data) => {
        setPosts(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, startDate.getTime(), endDate.getTime()]);

  return { posts, loading, error };
}
