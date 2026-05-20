/**
 * ENGAGEMENT DOMAIN
 * Primary purpose of the engagement
 */
export type EngagementDomain =
  | 'infrastructure_delivery'    // Building/constructing infrastructure
  | 'infrastructure_investment'  // Investing in infrastructure assets
  | 'investment_advisory'        // Portfolio/wealth advisory
  | 'transaction_advisory'       // M&A, capital raising
  | 'strategy_consulting';       // Strategic advisory

/**
 * ENGAGEMENT TYPE
 * Specific type within domain
 */
export type EngagementType =
  // Infrastructure Delivery
  | 'donor_program'              // NGO/foundation funded
  | 'government_program'         // Government funded
  | 'corporate_program'          // Private sector client
  | 'ppp_project'                // Public-private partnership
  | 'blended_program'            // Multiple funding types
  
  // Infrastructure Investment
  | 'direct_investment'          // Investing fund capital
  | 'fund_advisory'              // Advising a fund
  | 'transaction_support'        // Buy/sell side advisory
  | 'asset_management'           // Managing infra assets
  
  // Investment Advisory
  | 'discretionary_mandate'      // Full management
  | 'advisory_mandate'           // Recommendation-based
  | 'family_office_services'     // Multi-generational
  | 'institutional_advisory'     // Pension/insurance clients
  
  // Transaction Advisory
  | 'buy_side_ma'                // Acquisition advisory
  | 'sell_side_ma'               // Divestiture advisory
  | 'capital_raising'            // Debt/equity raising
  | 'restructuring'              // Financial restructuring
  
  // Strategy Consulting
  | 'market_entry'               // Market entry strategy
  | 'growth_strategy'            // Growth planning
  | 'operational_improvement'    // Ops optimization
  | 'due_diligence_advisory';    // DD support

/**
 * SECTOR
 * Infrastructure/industry sector
 */
export type Sector =
  | 'healthcare'
  | 'education'
  | 'water_sanitation'
  | 'energy_power'
  | 'energy_renewables'
  | 'transport_roads'
  | 'transport_rail'
  | 'transport_ports'
  | 'transport_airports'
  | 'housing_affordable'
  | 'housing_commercial'
  | 'agriculture'
  | 'agro_processing'
  | 'telecommunications'
  | 'digital_infrastructure'
  | 'industrial'
  | 'commercial_real_estate'
  | 'mixed_use'
  | 'waste_management'
  | 'financial_services'
  | 'manufacturing';

/**
 * Get domain display name
 */
export function getDomainDisplayName(domain: EngagementDomain): string {
  const names: Record<EngagementDomain, string> = {
    infrastructure_delivery: 'Infrastructure Delivery',
    infrastructure_investment: 'Infrastructure Investment',
    investment_advisory: 'Investment Advisory',
    transaction_advisory: 'Transaction Advisory',
    strategy_consulting: 'Strategy Consulting',
  };
  return names[domain];
}

/**
 * Get domain description
 */
export function getDomainDescription(domain: EngagementDomain): string {
  const descriptions: Record<EngagementDomain, string> = {
    infrastructure_delivery: 'Program and project management for infrastructure construction and delivery',
    infrastructure_investment: 'Investment in infrastructure assets including deal sourcing and asset management',
    investment_advisory: 'Portfolio management and wealth advisory services for clients',
    transaction_advisory: 'M&A, capital raising, and financial restructuring support',
    strategy_consulting: 'Strategic advisory and operational improvement consulting',
  };
  return descriptions[domain];
}

/**
 * Get domain icon name (for Lucide icons)
 */
export function getDomainIcon(domain: EngagementDomain): string {
  const icons: Record<EngagementDomain, string> = {
    infrastructure_delivery: 'HardHat',
    infrastructure_investment: 'TrendingUp',
    investment_advisory: 'Briefcase',
    transaction_advisory: 'Handshake',
    strategy_consulting: 'Target',
  };
  return icons[domain];
}

/**
 * Get engagement types for a domain
 */
export function getTypesForDomain(domain: EngagementDomain): EngagementType[] {
  const typesByDomain: Record<EngagementDomain, EngagementType[]> = {
    infrastructure_delivery: [
      'donor_program',
      'government_program',
      'corporate_program',
      'ppp_project',
      'blended_program',
    ],
    infrastructure_investment: [
      'direct_investment',
      'fund_advisory',
      'transaction_support',
      'asset_management',
    ],
    investment_advisory: [
      'discretionary_mandate',
      'advisory_mandate',
      'family_office_services',
      'institutional_advisory',
    ],
    transaction_advisory: [
      'buy_side_ma',
      'sell_side_ma',
      'capital_raising',
      'restructuring',
    ],
    strategy_consulting: [
      'market_entry',
      'growth_strategy',
      'operational_improvement',
      'due_diligence_advisory',
    ],
  };
  return typesByDomain[domain];
}

/**
 * Get engagement type display name
 */
export function getTypeDisplayName(type: EngagementType): string {
  const names: Record<EngagementType, string> = {
    // Infrastructure Delivery
    donor_program: 'Donor-Funded Program',
    government_program: 'Government Program',
    corporate_program: 'Corporate Program',
    ppp_project: 'Public-Private Partnership',
    blended_program: 'Blended Finance Program',
    
    // Infrastructure Investment
    direct_investment: 'Direct Investment',
    fund_advisory: 'Fund Advisory',
    transaction_support: 'Transaction Support',
    asset_management: 'Asset Management',
    
    // Investment Advisory
    discretionary_mandate: 'Discretionary Mandate',
    advisory_mandate: 'Advisory Mandate',
    family_office_services: 'Family Office Services',
    institutional_advisory: 'Institutional Advisory',
    
    // Transaction Advisory
    buy_side_ma: 'Buy-Side M&A',
    sell_side_ma: 'Sell-Side M&A',
    capital_raising: 'Capital Raising',
    restructuring: 'Restructuring',
    
    // Strategy Consulting
    market_entry: 'Market Entry Strategy',
    growth_strategy: 'Growth Strategy',
    operational_improvement: 'Operational Improvement',
    due_diligence_advisory: 'Due Diligence Advisory',
  };
  return names[type];
}

/**
 * Get sector display name
 */
export function getSectorDisplayName(sector: Sector): string {
  const names: Record<Sector, string> = {
    healthcare: 'Healthcare',
    education: 'Education',
    water_sanitation: 'Water & Sanitation',
    energy_power: 'Energy & Power',
    energy_renewables: 'Renewable Energy',
    transport_roads: 'Roads & Highways',
    transport_rail: 'Rail',
    transport_ports: 'Ports & Maritime',
    transport_airports: 'Airports & Aviation',
    housing_affordable: 'Affordable Housing',
    housing_commercial: 'Commercial Real Estate',
    agriculture: 'Agriculture',
    agro_processing: 'Agro-Processing',
    telecommunications: 'Telecommunications',
    digital_infrastructure: 'Digital Infrastructure',
    industrial: 'Industrial',
    commercial_real_estate: 'Commercial Real Estate',
    mixed_use: 'Mixed Use Development',
    waste_management: 'Waste Management',
    financial_services: 'Financial Services',
    manufacturing: 'Manufacturing',
  };
  return names[sector];
}

/**
 * Get sector icon name (for Lucide icons)
 */
export function getSectorIcon(sector: Sector): string {
  const icons: Record<Sector, string> = {
    healthcare: 'Heart',
    education: 'GraduationCap',
    water_sanitation: 'Droplet',
    energy_power: 'Zap',
    energy_renewables: 'Sun',
    transport_roads: 'Route',
    transport_rail: 'Train',
    transport_ports: 'Ship',
    transport_airports: 'Plane',
    housing_affordable: 'Home',
    housing_commercial: 'Building2',
    agriculture: 'Wheat',
    agro_processing: 'Factory',
    telecommunications: 'Radio',
    digital_infrastructure: 'Server',
    industrial: 'Cog',
    commercial_real_estate: 'Building',
    mixed_use: 'Layers',
    waste_management: 'Trash2',
    financial_services: 'Landmark',
    manufacturing: 'Wrench',
  };
  return icons[sector];
}

/**
 * Get domain for a given engagement type
 */
export function getDomainForType(type: EngagementType): EngagementDomain {
  const deliveryTypes: EngagementType[] = ['donor_program', 'government_program', 'corporate_program', 'ppp_project', 'blended_program'];
  const investmentTypes: EngagementType[] = ['direct_investment', 'fund_advisory', 'transaction_support', 'asset_management'];
  const advisoryTypes: EngagementType[] = ['discretionary_mandate', 'advisory_mandate', 'family_office_services', 'institutional_advisory'];
  const transactionTypes: EngagementType[] = ['buy_side_ma', 'sell_side_ma', 'capital_raising', 'restructuring'];
  
  if (deliveryTypes.includes(type)) return 'infrastructure_delivery';
  if (investmentTypes.includes(type)) return 'infrastructure_investment';
  if (advisoryTypes.includes(type)) return 'investment_advisory';
  if (transactionTypes.includes(type)) return 'transaction_advisory';
  return 'strategy_consulting';
}
