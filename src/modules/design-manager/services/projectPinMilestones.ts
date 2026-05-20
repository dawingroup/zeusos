/**
 * When a pinned project hits a commercial / production milestone, drop the pin
 * so the "Working on" strip stays honest (see Design Manager plan).
 */

import { deriveHandoverStatus } from './designItemStatusDerivation';
import { projectHasSalesOrder } from './projectCommercialSignals';
import type { QuoteCommercialSignal } from './projectCommercialSignals';
import type { DesignProject, DesignItem } from '../types';
import type { CRMDealStage } from '@/modules/crm/types';

/**
 * @returns Human-readable release reason, or `null` if the pin should stay.
 */
export function getPinAutoReleaseReason(
  project: DesignProject | undefined,
  projectItems: DesignItem[],
  dealStage: CRMDealStage | null | undefined,
  quoteSignal: QuoteCommercialSignal,
  hasSalesOrderFromSet: Set<string>,
  commercialReady: boolean,
): string | null {
  if (!project) {
    return 'Project removed from your list';
  }

  if (dealStage === 'won') {
    return 'CRM deal won';
  }

  if (projectHasSalesOrder(project, hasSalesOrderFromSet)) {
    return 'Sales order linked';
  }

  if (projectItems.some((i) => deriveHandoverStatus(i) === 'handed-over')) {
    return 'Released to manufacturing';
  }

  if (commercialReady && (quoteSignal === 'full_approval' || quoteSignal === 'partial_lines')) {
    return 'Client quote has approved line(s)';
  }

  return null;
}
