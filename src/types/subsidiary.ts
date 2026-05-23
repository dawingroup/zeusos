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
 * After Phase 1.C: construction/manufacturing modules removed (design-manager,
 * inventory, design-studio, matflow, construction, workshop-viewer, clipper,
 * feature-library, infrastructure_delivery). After Phase 1.D: advisory and
 * investment_advisory modules removed (Zeus is a marketing consortium, not an
 * advisory firm). Heavily coupled modules also removed pending Phase 3 rebuild
 * (crm, customer-hub, marketing, sales-orders, procurement, suppliers,
 * whatsapp, launch-pipeline).
 *
 * Phase 3 will add the canonical Zeus modules: 'campaigns' | 'media' |
 * 'production' | 'talent' | 'asset-library' and the corresponding role registry
 * in src/core/settings/moduleRoles.ts.
 */
export type SubsidiaryModule =
  // Agency-domain modules — placeholders for Phase 3+ (kept in the union now
  // so the role-registry compiles ahead of the module folders existing)
  | 'campaigns'
  | 'media'
  | 'production'
  | 'talent'
  | 'asset-library'
  // Cross-subsidiary corporate modules (retained from DawinOS, light edits)
  | 'asset-registry'
  | 'market_intelligence'
  | 'strategy'
  | 'hr'
  | 'finance'
  | 'compliance'
  | 'intelligence-layer';

export interface SubsidiaryStats {
  activeProjects: number;
  totalDesignItems: number;
  pendingTasks: number;
  completedThisMonth: number;
}

/**
 * Modules that every Zeus agency gets by default. As Phase 3 ships the
 * Campaign & Job Manager, Media Plan, Production, Talent, and Asset Library
 * modules, the IDs are listed here so newly-created subsidiaries see the
 * full surface from day one.
 */
const ZEUS_DEFAULT_AGENCY_MODULES: SubsidiaryModule[] = [
  'campaigns',
  'media',
  'production',
  'talent',
  'asset-library',
  'asset-registry',
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
