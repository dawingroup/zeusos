/**
 * FUNDING CATEGORY
 * High-level classification of funding source
 */
export type FundingCategory =
  | 'grant'              // Non-repayable funding
  | 'concessional'       // Below-market rate debt
  | 'government'         // Government budget allocation
  | 'commercial_debt'    // Market-rate debt
  | 'equity'             // Ownership investment
  | 'guarantee'          // Credit enhancement
  | 'internal';          // Self-funded / retained earnings

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: FundingCategory): string {
  const names: Record<FundingCategory, string> = {
    grant: 'Grant',
    concessional: 'Concessional Finance',
    government: 'Government Budget',
    commercial_debt: 'Commercial Debt',
    equity: 'Equity',
    guarantee: 'Guarantee',
    internal: 'Internal Funding',
  };
  return names[category];
}

/**
 * Get category description
 */
export function getCategoryDescription(category: FundingCategory): string {
  const descriptions: Record<FundingCategory, string> = {
    grant: 'Non-repayable funding from donors, foundations, or development partners',
    concessional: 'Below-market rate debt from development finance institutions',
    government: 'Government budget allocations and public funding',
    commercial_debt: 'Market-rate debt from commercial lenders',
    equity: 'Ownership investment from equity investors',
    guarantee: 'Credit enhancement and risk mitigation instruments',
    internal: 'Self-funded from retained earnings or internal resources',
  };
  return descriptions[category];
}

/**
 * Check if funding is repayable
 */
export function isRepayable(category: FundingCategory): boolean {
  return ['concessional', 'commercial_debt'].includes(category);
}

/**
 * Check if funding requires return on investment
 */
export function requiresReturn(category: FundingCategory): boolean {
  return ['equity', 'commercial_debt', 'concessional'].includes(category);
}

/**
 * Check if funding is concessional (below market)
 */
export function isConcessional(category: FundingCategory): boolean {
  return ['grant', 'concessional', 'government'].includes(category);
}

/**
 * Check if funding is commercial
 */
export function isCommercial(category: FundingCategory): boolean {
  return ['commercial_debt', 'equity'].includes(category);
}

/**
 * Get funding category color
 */
export function getCategoryColor(category: FundingCategory): string {
  const colors: Record<FundingCategory, string> = {
    grant: 'green',
    concessional: 'teal',
    government: 'blue',
    commercial_debt: 'purple',
    equity: 'orange',
    guarantee: 'yellow',
    internal: 'gray',
  };
  return colors[category];
}

/**
 * Get funding category icon (Lucide icon name)
 */
export function getCategoryIcon(category: FundingCategory): string {
  const icons: Record<FundingCategory, string> = {
    grant: 'Gift',
    concessional: 'Heart',
    government: 'Landmark',
    commercial_debt: 'Building2',
    equity: 'TrendingUp',
    guarantee: 'Shield',
    internal: 'Wallet',
  };
  return icons[category];
}

/**
 * All funding categories
 */
export const ALL_FUNDING_CATEGORIES: FundingCategory[] = [
  'grant',
  'concessional',
  'government',
  'commercial_debt',
  'equity',
  'guarantee',
  'internal',
];
