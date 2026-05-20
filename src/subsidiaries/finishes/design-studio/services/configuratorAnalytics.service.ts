/**
 * Configurator Analytics Service — Track configuration events
 */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';

export type ConfiguratorEvent =
  | 'configurator_opened'
  | 'parameter_changed'
  | 'finish_selected'
  | 'validation_completed'
  | 'quote_requested'
  | 'mo_created'
  | 'share_link_generated'
  | 'ar_preview_opened'
  | 'configuration_loaded_from_url';

interface AnalyticsPayload {
  event: ConfiguratorEvent;
  pddId: string;
  mode: string;
  metadata?: Record<string, unknown>;
}

const COLLECTION = 'configuratorAnalytics';

/**
 * Track a configurator event.
 */
export async function trackEvent(payload: AnalyticsPayload): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTION), {
      ...payload,
      timestamp: serverTimestamp(),
    });
  } catch {
    // Analytics should never block the user flow
  }
}
