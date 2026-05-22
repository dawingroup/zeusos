/**
 * PostCampaignReport — summary document produced after campaign completion.
 *
 * Lives at root collection: post_campaign_reports/{reportId}.
 */

import type { Timestamp } from 'firebase/firestore';

export interface CampaignMetric {
  name: string;
  planned: number;
  actual: number;
  unit: string;
  /** Source of the data — e.g. "GA4", "Meta Business Suite", "AC Nielsen". */
  source?: string;
}

export interface PostCampaignReport {
  id: string;
  mediaPlanId: string;
  masterJobId: string;
  title: string;
  /** Narrative executive summary. */
  narrative?: string;
  metrics: CampaignMetric[];
  /** Storage reference to the generated PDF. */
  pdfStorageRef?: string;
  /** Total planned spend in minor units (rolled up from the plan). */
  totalPlannedMinor: number;
  /** Total actual spend in minor units (rolled up from actuals). */
  totalActualMinor: number;
  status: 'DRAFT' | 'PUBLISHED';
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
