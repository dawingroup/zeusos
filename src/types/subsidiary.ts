/**
 * Subsidiary Types
 * Data model for multi-subsidiary support in ZeusOS.
 * Zeus Group operates five peer agencies under one organisation.
 */

import type { SubsidiaryId } from '@/core/settings/types';
export type { SubsidiaryId } from '@/core/settings/types';

export interface Subsidiary {
  id: SubsidiaryId;
  name: string;
  shortName: string;
  logo?: string;
  color: string;
  description: string;
  modules: SubsidiaryModule[];
  status: 'active' | 'inactive' | 'coming-soon';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SubsidiaryModule union — every module that can be granted to a subsidiary.
 *
 * NOTE(ZeusOS Phase 1.C): the construction/manufacturing-domain modules at
 * the top of this union (design-manager, inventory, design-studio, etc.)
 * will be deleted as part of Phase 1.C and removed from this union. They
 * are kept here for the duration of Phase 1.B so the typecheck doesn't
 * cascade-break consumers we haven't migrated yet.
 *
 * The agency-friendly modules (crm, marketing, customer-hub, suppliers,
 * sales-orders, whatsapp, launch-pipeline, asset-registry, plus the
 * corporate cross-subsidiary set) are the canonical Zeus set.
 *
 * Phase 3 will add: 'campaigns' | 'media' | 'production' | 'talent' | 'asset-library'.
 */
export type SubsidiaryModule =
  // Legacy construction modules (queued for deletion in Phase 1.C)
  | 'design-manager'
  | 'clipper'
  | 'feature-library'
  | 'construction'
  | 'inventory'
  | 'workshop-viewer'
  | 'design-studio'
  | 'matflow'
  | 'investment_advisory'
  | 'infrastructure_delivery'
  // Agency-friendly modules (retained for Zeus)
  | 'asset-registry'
  | 'launch-pipeline'
  | 'procurement'
  | 'production'
  | 'marketing'
  | 'crm'
  | 'customer-hub'
  | 'whatsapp'
  | 'sales-orders'
  // Shared modules (cross-subsidiary)
  | 'suppliers'
  // Corporate modules (cross-subsidiary)
  | 'market_intelligence'
  | 'strategy'
  | 'hr'
  | 'finance'
  | 'capital'
  | 'compliance'
  | 'intelligence-layer';

export interface SubsidiaryStats {
  activeProjects: number;
  totalDesignItems: number;
  pendingTasks: number;
  completedThisMonth: number;
}

/**
 * Modules that every Zeus agency gets by default. Phase 3 will introduce the
 * canonical Campaign & Job Manager, Media Plan, Talent Roster, and Asset
 * Library — they'll join this list as they ship.
 */
const ZEUS_DEFAULT_AGENCY_MODULES: SubsidiaryModule[] = [
  'crm',
  'customer-hub',
  'marketing',
  'sales-orders',
  'procurement',
  'suppliers',
  'asset-registry',
  'launch-pipeline',
  'whatsapp',
];

/**
 * Default subsidiaries for Zeus Group — the five operating agencies.
 *
 * Brand colours mirror the sub-brand colour tokens in src/index.css
 * (--zeus-the-agency, --zeus-digital, etc.) for visual consistency
 * between admin chrome and per-agency UI.
 */
export const DEFAULT_SUBSIDIARIES: Subsidiary[] = [
  {
    id: 'zeus-the-agency',
    name: 'Zeus The Agency',
    shortName: 'Zeus',
    color: '#F5D900',
    description:
      'Flagship 360-degree Ugandan advertising agency. Creative, BTL, Digital, PR, Media Buying, and Production strategies.',
    modules: ZEUS_DEFAULT_AGENCY_MODULES,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'zeus-digital',
    name: 'Zeus Digital',
    shortName: 'ZD',
    color: '#00C5E5',
    description:
      'Digital-focused offshoot delivering content, SEM/SEO, influencer, media buy, channel, and digital innovation strategy.',
    modules: ZEUS_DEFAULT_AGENCY_MODULES,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'labyrinth',
    name: 'Labyrinth Audio & Visual Content Studio',
    shortName: 'Labyrinth',
    color: '#C8F0D6',
    description:
      'Audio and visual content creation: sound production, photography, podcast, product photography, film, and documentary production.',
    modules: ZEUS_DEFAULT_AGENCY_MODULES,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'odd-gorilla',
    name: 'Odd Gorilla',
    shortName: 'Odd Gorilla',
    color: '#FFB0B8',
    description:
      'Fully integrated conflict agency — serves clients in categories already handled by Zeus The Agency. 360-degree marketing and communications services.',
    modules: ZEUS_DEFAULT_AGENCY_MODULES,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'house-of-zeus',
    name: 'House of Zeus',
    shortName: 'HoZ',
    color: '#C8FF3C',
    description:
      'Kenya market expansion. 360-degree marketing and communications services for the Kenyan market.',
    modules: ZEUS_DEFAULT_AGENCY_MODULES,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
