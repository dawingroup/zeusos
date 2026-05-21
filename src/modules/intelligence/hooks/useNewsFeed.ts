// ============================================================================
// NEWS FEED HOOK
// ZeusOS v2.0 - Market Intelligence Module
// Hook for news articles and sentiment analysis (Firestore-backed)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { NewsArticle } from '../types';

const NEWS_COLLECTION = 'news_articles';

interface NewsSummary {
  totalArticles: number;
  byCategory: Record<string, number>;
  bySentiment: Record<string, number>;
  topTopics: { topic: string; count: number }[];
  competitorMentions: { competitorId: string; count: number }[];
}

interface UseNewsFeedOptions {
  category?: string;
  sentiment?: string;
  competitorId?: string;
  dateRange?: { start: Date; end: Date };
  pageSize?: number;
}

interface UseNewsFeedReturn {
  articles: NewsArticle[];
  summary: NewsSummary | null;
  loading: boolean;
  scanning: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  scan: (sector?: string) => Promise<number>;
  markAsRead: (articleId: string) => Promise<void>;
  bookmarkArticle: (articleId: string, bookmarked: boolean) => Promise<void>;
}

const calculateSummary = (articleList: NewsArticle[]): NewsSummary => {
  const categoryCounts: Record<string, number> = {};
  const sentimentCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  const competitorCounts: Record<string, number> = {};

  articleList.forEach(article => {
    categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
    sentimentCounts[article.sentiment] = (sentimentCounts[article.sentiment] || 0) + 1;
    article.tags?.forEach(tag => {
      topicCounts[tag] = (topicCounts[tag] || 0) + 1;
    });
    article.mentionedCompetitors?.forEach(comp => {
      competitorCounts[comp] = (competitorCounts[comp] || 0) + 1;
    });
  });

  return {
    totalArticles: articleList.length,
    byCategory: categoryCounts,
    bySentiment: sentimentCounts,
    topTopics: Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count })),
    competitorMentions: Object.entries(competitorCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([competitorId, count]) => ({ competitorId, count })),
  };
};

export const useNewsFeed = ({
  category,
  sentiment,
  competitorId,
  pageSize = 50,
}: UseNewsFeedOptions = {}): UseNewsFeedReturn => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [summary, setSummary] = useState<NewsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let q = query(
        collection(db, NEWS_COLLECTION),
        orderBy('publishedAt', 'desc'),
        firestoreLimit(pageSize)
      );

      if (category && category !== 'all') {
        q = query(
          collection(db, NEWS_COLLECTION),
          where('category', '==', category),
          orderBy('publishedAt', 'desc'),
          firestoreLimit(pageSize)
        );
      }

      if (sentiment && sentiment !== 'all') {
        q = query(
          collection(db, NEWS_COLLECTION),
          where('sentiment', '==', sentiment),
          orderBy('publishedAt', 'desc'),
          firestoreLimit(pageSize)
        );
      }

      const snapshot = await getDocs(q);
      let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as NewsArticle[];

      // Client-side filter for competitorId (array-contains not combined with other wheres)
      if (competitorId) {
        results = results.filter(a => a.mentionedCompetitors?.includes(competitorId));
      }

      setArticles(results);
      setSummary(calculateSummary(results));
      setHasMore(results.length >= pageSize);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch news'));
    } finally {
      setLoading(false);
    }
  }, [category, sentiment, competitorId, pageSize]);

  const scan = useCallback(async (sector?: string): Promise<number> => {
    try {
      setScanning(true);
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const scanFn = httpsCallable(functions, 'scanMarketNews');

      const result = await scanFn({ sector: sector || 'general business', region: 'Uganda and East Africa' });
      const data = result.data as { articlesFound: number };

      // Refresh the list after scan
      await fetchArticles();
      return data.articlesFound || 0;
    } catch (err) {
      console.error('News scan error:', err);
      return 0;
    } finally {
      setScanning(false);
    }
  }, [fetchArticles]);

  const markAsRead = useCallback(async (articleId: string) => {
    try {
      await updateDoc(doc(db, NEWS_COLLECTION, articleId), { isRead: true });
      setArticles(prev =>
        prev.map(a => (a.id === articleId ? { ...a, isRead: true } : a))
      );
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  }, []);

  const bookmarkArticle = useCallback(async (articleId: string, bookmarked: boolean) => {
    try {
      await updateDoc(doc(db, NEWS_COLLECTION, articleId), { isBookmarked: bookmarked });
      setArticles(prev =>
        prev.map(a => (a.id === articleId ? { ...a, isBookmarked: bookmarked } : a))
      );
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  return {
    articles,
    summary,
    loading,
    scanning,
    error,
    hasMore,
    loadMore: fetchArticles,
    refresh: fetchArticles,
    scan,
    markAsRead,
    bookmarkArticle,
  };
};

export default useNewsFeed;
