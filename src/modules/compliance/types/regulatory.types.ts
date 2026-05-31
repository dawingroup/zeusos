/**
 * Regulatory-change feed — Phase 2.4.
 *
 * A lightweight register of regulatory/legal changes relevant to Zeus's
 * clients and the group's own brands. Two consumers:
 *   1. Compliance officers (RegulatoryChangesPage) — track what's coming.
 *   2. The client Strategy Assistant (Phase 3) — surfaces the regulatory
 *      exposure for a given client by matching `sector` against the client's
 *      industry tag.
 */

import type { Timestamp } from 'firebase/firestore';
import type { RegulatoryBody } from './index';
import type { SubsidiaryId } from '@/core/settings/types';

export type RegulatoryImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export type RegulatoryChangeStatus =
  | 'proposed'      // announced / draft bill
  | 'enacted'       // passed, not yet in force
  | 'in_force'      // active
  | 'superseded';   // replaced / repealed

export interface RegulatoryChange {
  id: string;
  title: string;
  regulatoryBody: RegulatoryBody;
  /** Industry sectors this affects (matched against client.sector). Lowercase. */
  sector: string[];
  /** ISO date the change takes/took effect. */
  effectiveDate: string;
  impactLevel: RegulatoryImpactLevel;
  status: RegulatoryChangeStatus;
  summary: string;
  sourceUrl?: string;
  /** Which Zeus brands this is relevant to (empty = group-wide). */
  subsidiaryOrgIds: SubsidiaryId[];
  /** Provenance: 'manual' (officer entry) or 'ai' (market-intel scan, Phase 3). */
  source: 'manual' | 'ai';
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  createdBy?: string;
}

export type RegulatoryChangeInput = Omit<
  RegulatoryChange,
  'id' | 'createdAt' | 'updatedAt' | 'createdBy'
>;

export const IMPACT_LEVEL_LABELS: Record<RegulatoryImpactLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const REGULATORY_STATUS_LABELS: Record<RegulatoryChangeStatus, string> = {
  proposed: 'Proposed',
  enacted: 'Enacted',
  in_force: 'In force',
  superseded: 'Superseded',
};
