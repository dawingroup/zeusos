// ============================================================================
// TOPIC TRACKING SERVICE
// ZeusOS v2.0 - Market Intelligence Module
// Firestore service for topic tracking and discussion monitoring
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  TrackedTopic,
  TrackedTopicFormInput,
  TopicMention,
  TopicStatus,
} from '../types/topicTracking.types';

const TOPICS_COLLECTION = 'tracked_topics';
const MENTIONS_COLLECTION = 'topic_mentions';

// ============================================================================
// TOPIC CRUD
// ============================================================================

export const topicTrackingService = {
  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  async createTopic(
    input: TrackedTopicFormInput,
    userId: string
  ): Promise<string> {
    const now = Timestamp.now();

    const topicData: Omit<TrackedTopic, 'id'> = {
      name: input.name,
      description: input.description,
      keywords: input.keywords,
      excludeKeywords: input.excludeKeywords,
      scope: input.scope,
      regions: input.regions,
      languages: input.languages.length > 0 ? input.languages : ['en'],
      status: 'active',
      isAlertEnabled: input.isAlertEnabled,
      alertThreshold: input.alertThreshold,
      totalMentions: 0,
      mentionsLast24h: 0,
      mentionsLast7d: 0,
      mentionsLast30d: 0,
      overallSentiment: 'neutral',
      sentimentScore: 0,
      trendDirection: 'stable',
      relatedCompetitorIds: input.relatedCompetitorIds,
      relatedTopicIds: [],
      scanFrequency: input.scanFrequency,
      category: input.category,
      tags: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, TOPICS_COLLECTION), topicData);
    return docRef.id;
  },

  // --------------------------------------------------------------------------
  // READ
  // --------------------------------------------------------------------------

  async getTopic(id: string): Promise<TrackedTopic | null> {
    const docRef = doc(db, TOPICS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as TrackedTopic;
  },

  async getTopics(status?: TopicStatus): Promise<TrackedTopic[]> {
    let q = query(
      collection(db, TOPICS_COLLECTION),
      orderBy('updatedAt', 'desc')
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TrackedTopic[];
  },

  async getActiveTopics(): Promise<TrackedTopic[]> {
    return this.getTopics('active');
  },

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------

  async updateTopic(
    id: string,
    updates: Partial<TrackedTopicFormInput>
  ): Promise<void> {
    await updateDoc(doc(db, TOPICS_COLLECTION, id), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },

  async updateTopicStatus(id: string, status: TopicStatus): Promise<void> {
    await updateDoc(doc(db, TOPICS_COLLECTION, id), {
      status,
      updatedAt: Timestamp.now(),
    });
  },

  async toggleAlerts(id: string): Promise<void> {
    const topic = await this.getTopic(id);
    if (!topic) throw new Error('Topic not found');
    await updateDoc(doc(db, TOPICS_COLLECTION, id), {
      isAlertEnabled: !topic.isAlertEnabled,
      updatedAt: Timestamp.now(),
    });
  },

  // --------------------------------------------------------------------------
  // DELETE
  // --------------------------------------------------------------------------

  async deleteTopic(id: string): Promise<void> {
    await deleteDoc(doc(db, TOPICS_COLLECTION, id));
  },

  // --------------------------------------------------------------------------
  // MENTIONS
  // --------------------------------------------------------------------------

  async addMention(mention: Omit<TopicMention, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, MENTIONS_COLLECTION), mention);
    return docRef.id;
  },

  async getMentions(
    topicId: string,
    limitCount = 50
  ): Promise<TopicMention[]> {
    const q = query(
      collection(db, MENTIONS_COLLECTION),
      where('topicId', '==', topicId),
      orderBy('publishedAt', 'desc'),
      firestoreLimit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TopicMention[];
  },

  async getRecentMentions(limitCount = 20): Promise<TopicMention[]> {
    const q = query(
      collection(db, MENTIONS_COLLECTION),
      orderBy('discoveredAt', 'desc'),
      firestoreLimit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TopicMention[];
  },

  async updateMention(
    id: string,
    updates: Partial<Pick<TopicMention, 'isRead' | 'isBookmarked' | 'isFlagged' | 'notes'>>
  ): Promise<void> {
    await updateDoc(doc(db, MENTIONS_COLLECTION, id), updates);
  },

  async deleteMention(id: string): Promise<void> {
    await deleteDoc(doc(db, MENTIONS_COLLECTION, id));
  },

  // --------------------------------------------------------------------------
  // SCAN TRIGGER (calls Cloud Function)
  // --------------------------------------------------------------------------

  async triggerScan(topicId: string): Promise<{ mentionsFound: number }> {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const scanFn = httpsCallable(functions, 'scanTopicMentions');

      const result = await scanFn({ topicId });
      const data = result.data as { mentionsFound: number };
      return data;
    } catch (error) {
      console.error('Topic scan error:', error);
      return { mentionsFound: 0 };
    }
  },
};
