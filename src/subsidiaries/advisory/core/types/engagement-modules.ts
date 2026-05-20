import { EngagementDomain, EngagementType } from './engagement-domain';

/**
 * ENGAGEMENT MODULES
 * Which modules are active for this engagement
 */
export interface EngagementModules {
  /** Infrastructure Delivery - Project management, payments, progress */
  delivery: boolean;
  
  /** Infrastructure Investment - Deal pipeline, DD, monitoring */
  investment: boolean;
  
  /** Investment Advisory - Portfolios, client advisory */
  advisory: boolean;
  
  /** MatFlow - Material management (auto-enabled for construction) */
  matflow: boolean;
}

/**
 * Default modules by domain
 */
export function getDefaultModules(domain: EngagementDomain): EngagementModules {
  const defaults: Record<EngagementDomain, EngagementModules> = {
    infrastructure_delivery: {
      delivery: true,
      investment: false,
      advisory: false,
      matflow: true,  // Always enabled for delivery
    },
    infrastructure_investment: {
      delivery: false,
      investment: true,
      advisory: false,
      matflow: false,  // Enabled when construction involved
    },
    investment_advisory: {
      delivery: false,
      investment: false,
      advisory: true,
      matflow: false,
    },
    transaction_advisory: {
      delivery: false,
      investment: true,
      advisory: false,
      matflow: false,
    },
    strategy_consulting: {
      delivery: false,
      investment: false,
      advisory: false,
      matflow: false,
    },
  };
  return defaults[domain];
}

/**
 * Check if MatFlow should be available
 */
export function shouldEnableMatFlow(
  domain: EngagementDomain,
  _type: EngagementType,
  hasConstruction: boolean
): boolean {
  // Always for delivery
  if (domain === 'infrastructure_delivery') return true;
  
  // For investment with greenfield construction
  if (domain === 'infrastructure_investment' && hasConstruction) return true;
  
  return false;
}

/**
 * Get module display name
 */
export function getModuleDisplayName(module: keyof EngagementModules): string {
  const names: Record<keyof EngagementModules, string> = {
    delivery: 'Infrastructure Delivery',
    investment: 'Infrastructure Investment',
    advisory: 'Investment Advisory',
    matflow: 'MatFlow',
  };
  return names[module];
}

/**
 * Get module description
 */
export function getModuleDescription(module: keyof EngagementModules): string {
  const descriptions: Record<keyof EngagementModules, string> = {
    delivery: 'Program and project management, payment workflows, progress tracking',
    investment: 'Deal pipeline, due diligence, investment monitoring',
    advisory: 'Portfolio management, client advisory, wealth planning',
    matflow: 'Material management, BOQ, procurement, variance analysis',
  };
  return descriptions[module];
}

/**
 * Get active modules as array
 */
export function getActiveModules(modules: EngagementModules): (keyof EngagementModules)[] {
  return (Object.keys(modules) as (keyof EngagementModules)[]).filter(
    key => modules[key]
  );
}

/**
 * Count active modules
 */
export function countActiveModules(modules: EngagementModules): number {
  return getActiveModules(modules).length;
}
