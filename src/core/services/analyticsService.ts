/**
 * Analytics Service
 * Placeholder for unified analytics/event tracking
 */

import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { ModuleId } from '@/integration/constants';

const COLLECTION = 'analytics_events';

export interface AnalyticsEvent {
  id: string;
  organizationId: string;
  userId?: string;
  module: ModuleId;
  name: string;
  properties?: Record<string, unknown>;
  timestamp: Timestamp;
}

export async function trackEvent(
  event: Omit<AnalyticsEvent, 'id' | 'timestamp'>
): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    ...event,
    timestamp: Timestamp.now(),
  });
}
