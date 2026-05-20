// ============================================================================
// COMPETITOR CONSTANTS
// DawinOS v2.0 - Market Intelligence Module
// Constants for Competitor Analysis
// ============================================================================

// ----------------------------------------------------------------------------
// COMPETITOR TYPES
// ----------------------------------------------------------------------------

export const COMPETITOR_TYPES = {
  DIRECT: 'direct',
  INDIRECT: 'indirect',
  POTENTIAL: 'potential',
  SUBSTITUTE: 'substitute',
  EMERGING: 'emerging',
  DORMANT: 'dormant',
} as const;

export type CompetitorType = typeof COMPETITOR_TYPES[keyof typeof COMPETITOR_TYPES];

export const COMPETITOR_TYPE_LABELS: Record<CompetitorType, string> = {
  [COMPETITOR_TYPES.DIRECT]: 'Direct Competitor',
  [COMPETITOR_TYPES.INDIRECT]: 'Indirect Competitor',
  [COMPETITOR_TYPES.POTENTIAL]: 'Potential Competitor',
  [COMPETITOR_TYPES.SUBSTITUTE]: 'Substitute Provider',
  [COMPETITOR_TYPES.EMERGING]: 'Emerging Competitor',
  [COMPETITOR_TYPES.DORMANT]: 'Dormant Competitor',
};

export const COMPETITOR_TYPE_COLORS: Record<CompetitorType, string> = {
  [COMPETITOR_TYPES.DIRECT]: '#EF4444',
  [COMPETITOR_TYPES.INDIRECT]: '#F59E0B',
  [COMPETITOR_TYPES.POTENTIAL]: '#3B82F6',
  [COMPETITOR_TYPES.SUBSTITUTE]: '#8B5CF6',
  [COMPETITOR_TYPES.EMERGING]: '#10B981',
  [COMPETITOR_TYPES.DORMANT]: '#6B7280',
};

// ----------------------------------------------------------------------------
// THREAT LEVELS
// ----------------------------------------------------------------------------

export const THREAT_LEVELS = {
  MINIMAL: 'minimal',
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type ThreatLevel = typeof THREAT_LEVELS[keyof typeof THREAT_LEVELS];

export const THREAT_LEVEL_LABELS: Record<ThreatLevel, string> = {
  [THREAT_LEVELS.MINIMAL]: 'Minimal Threat',
  [THREAT_LEVELS.LOW]: 'Low Threat',
  [THREAT_LEVELS.MODERATE]: 'Moderate Threat',
  [THREAT_LEVELS.HIGH]: 'High Threat',
  [THREAT_LEVELS.CRITICAL]: 'Critical Threat',
};

export const THREAT_LEVEL_SCORES: Record<ThreatLevel, number> = {
  [THREAT_LEVELS.MINIMAL]: 1,
  [THREAT_LEVELS.LOW]: 2,
  [THREAT_LEVELS.MODERATE]: 3,
  [THREAT_LEVELS.HIGH]: 4,
  [THREAT_LEVELS.CRITICAL]: 5,
};

export const THREAT_LEVEL_COLORS: Record<ThreatLevel, string> = {
  [THREAT_LEVELS.MINIMAL]: '#10B981',
  [THREAT_LEVELS.LOW]: '#22C55E',
  [THREAT_LEVELS.MODERATE]: '#F59E0B',
  [THREAT_LEVELS.HIGH]: '#EF4444',
  [THREAT_LEVELS.CRITICAL]: '#7F1D1D',
};

// ----------------------------------------------------------------------------
// COMPETITOR STATUS
// ----------------------------------------------------------------------------

export const COMPETITOR_STATUSES = {
  ACTIVE: 'active',
  WATCHING: 'watching',
  INACTIVE: 'inactive',
  ACQUIRED: 'acquired',
  BANKRUPT: 'bankrupt',
  MERGED: 'merged',
  EXITED_MARKET: 'exited_market',
} as const;

export type CompetitorStatus = typeof COMPETITOR_STATUSES[keyof typeof COMPETITOR_STATUSES];

export const COMPETITOR_STATUS_LABELS: Record<CompetitorStatus, string> = {
  [COMPETITOR_STATUSES.ACTIVE]: 'Active',
  [COMPETITOR_STATUSES.WATCHING]: 'Watching',
  [COMPETITOR_STATUSES.INACTIVE]: 'Inactive',
  [COMPETITOR_STATUSES.ACQUIRED]: 'Acquired',
  [COMPETITOR_STATUSES.BANKRUPT]: 'Bankrupt',
  [COMPETITOR_STATUSES.MERGED]: 'Merged',
  [COMPETITOR_STATUSES.EXITED_MARKET]: 'Exited Market',
};

// ----------------------------------------------------------------------------
// INDUSTRIES
// ----------------------------------------------------------------------------

export const INDUSTRIES = {
  INFRASTRUCTURE: 'infrastructure',
  CONSTRUCTION: 'construction',
  REAL_ESTATE: 'real_estate',
  ADVISORY: 'advisory',
  INVESTMENT: 'investment',
  PROCUREMENT: 'procurement',
  HEALTHCARE: 'healthcare',
  AGRICULTURE: 'agriculture',
  FINANCIAL_SERVICES: 'financial_services',
  TECHNOLOGY: 'technology',
  TELECOMMUNICATIONS: 'telecommunications',
  ENERGY: 'energy',
  MANUFACTURING: 'manufacturing',
  EDUCATION: 'education',
  TRANSPORT: 'transport',
  MINING: 'mining',
} as const;

export type Industry = typeof INDUSTRIES[keyof typeof INDUSTRIES];

export const INDUSTRY_LABELS: Record<Industry, string> = {
  [INDUSTRIES.INFRASTRUCTURE]: 'Infrastructure',
  [INDUSTRIES.CONSTRUCTION]: 'Construction',
  [INDUSTRIES.REAL_ESTATE]: 'Real Estate',
  [INDUSTRIES.ADVISORY]: 'Advisory Services',
  [INDUSTRIES.INVESTMENT]: 'Investment Management',
  [INDUSTRIES.PROCUREMENT]: 'Procurement',
  [INDUSTRIES.HEALTHCARE]: 'Healthcare',
  [INDUSTRIES.AGRICULTURE]: 'Agriculture',
  [INDUSTRIES.FINANCIAL_SERVICES]: 'Financial Services',
  [INDUSTRIES.TECHNOLOGY]: 'Technology',
  [INDUSTRIES.TELECOMMUNICATIONS]: 'Telecommunications',
  [INDUSTRIES.ENERGY]: 'Energy',
  [INDUSTRIES.MANUFACTURING]: 'Manufacturing',
  [INDUSTRIES.EDUCATION]: 'Education',
  [INDUSTRIES.TRANSPORT]: 'Transport & Logistics',
  [INDUSTRIES.MINING]: 'Mining',
};

// ----------------------------------------------------------------------------
// GEOGRAPHIES
// ----------------------------------------------------------------------------

export const GEOGRAPHIES = {
  UGANDA: 'uganda',
  KENYA: 'kenya',
  TANZANIA: 'tanzania',
  RWANDA: 'rwanda',
  ETHIOPIA: 'ethiopia',
  DRC: 'drc',
  SOUTH_SUDAN: 'south_sudan',
  BURUNDI: 'burundi',
  EAST_AFRICA: 'east_africa',
  WEST_AFRICA: 'west_africa',
  SOUTHERN_AFRICA: 'southern_africa',
  NORTH_AFRICA: 'north_africa',
  PAN_AFRICA: 'pan_africa',
  GLOBAL: 'global',
} as const;

export type Geography = typeof GEOGRAPHIES[keyof typeof GEOGRAPHIES];

export const GEOGRAPHY_LABELS: Record<Geography, string> = {
  [GEOGRAPHIES.UGANDA]: 'Uganda',
  [GEOGRAPHIES.KENYA]: 'Kenya',
  [GEOGRAPHIES.TANZANIA]: 'Tanzania',
  [GEOGRAPHIES.RWANDA]: 'Rwanda',
  [GEOGRAPHIES.ETHIOPIA]: 'Ethiopia',
  [GEOGRAPHIES.DRC]: 'DR Congo',
  [GEOGRAPHIES.SOUTH_SUDAN]: 'South Sudan',
  [GEOGRAPHIES.BURUNDI]: 'Burundi',
  [GEOGRAPHIES.EAST_AFRICA]: 'East Africa (Regional)',
  [GEOGRAPHIES.WEST_AFRICA]: 'West Africa',
  [GEOGRAPHIES.SOUTHERN_AFRICA]: 'Southern Africa',
  [GEOGRAPHIES.NORTH_AFRICA]: 'North Africa',
  [GEOGRAPHIES.PAN_AFRICA]: 'Pan-Africa',
  [GEOGRAPHIES.GLOBAL]: 'Global',
};

// ----------------------------------------------------------------------------
// COMPANY SIZES
// ----------------------------------------------------------------------------

export const COMPANY_SIZES = {
  STARTUP: 'startup',
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  ENTERPRISE: 'enterprise',
  MULTINATIONAL: 'multinational',
} as const;

export type CompanySize = typeof COMPANY_SIZES[keyof typeof COMPANY_SIZES];

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  [COMPANY_SIZES.STARTUP]: 'Startup (<10 employees)',
  [COMPANY_SIZES.SMALL]: 'Small (10-50 employees)',
  [COMPANY_SIZES.MEDIUM]: 'Medium (50-250 employees)',
  [COMPANY_SIZES.LARGE]: 'Large (250-1000 employees)',
  [COMPANY_SIZES.ENTERPRISE]: 'Enterprise (1000-5000 employees)',
  [COMPANY_SIZES.MULTINATIONAL]: 'Multinational (5000+ employees)',
};

export const COMPANY_SIZE_RANGES: Record<CompanySize, { min: number; max: number }> = {
  [COMPANY_SIZES.STARTUP]: { min: 1, max: 10 },
  [COMPANY_SIZES.SMALL]: { min: 10, max: 50 },
  [COMPANY_SIZES.MEDIUM]: { min: 50, max: 250 },
  [COMPANY_SIZES.LARGE]: { min: 250, max: 1000 },
  [COMPANY_SIZES.ENTERPRISE]: { min: 1000, max: 5000 },
  [COMPANY_SIZES.MULTINATIONAL]: { min: 5000, max: 100000 },
};

// ----------------------------------------------------------------------------
// SWOT CATEGORIES
// ----------------------------------------------------------------------------

export const SWOT_CATEGORIES = {
  STRENGTH: 'strength',
  WEAKNESS: 'weakness',
  OPPORTUNITY: 'opportunity',
  THREAT: 'threat',
} as const;

export type SWOTCategory = typeof SWOT_CATEGORIES[keyof typeof SWOT_CATEGORIES];

export const SWOT_CATEGORY_LABELS: Record<SWOTCategory, string> = {
  [SWOT_CATEGORIES.STRENGTH]: 'Strength',
  [SWOT_CATEGORIES.WEAKNESS]: 'Weakness',
  [SWOT_CATEGORIES.OPPORTUNITY]: 'Opportunity',
  [SWOT_CATEGORIES.THREAT]: 'Threat',
};

export const SWOT_CATEGORY_COLORS: Record<SWOTCategory, string> = {
  [SWOT_CATEGORIES.STRENGTH]: '#10B981',
  [SWOT_CATEGORIES.WEAKNESS]: '#EF4444',
  [SWOT_CATEGORIES.OPPORTUNITY]: '#3B82F6',
  [SWOT_CATEGORIES.THREAT]: '#F59E0B',
};

// ----------------------------------------------------------------------------
// SWOT FACTOR TYPES
// ----------------------------------------------------------------------------

export const SWOT_FACTOR_TYPES = {
  // Strengths
  BRAND_RECOGNITION: 'brand_recognition',
  MARKET_SHARE: 'market_share',
  FINANCIAL_STRENGTH: 'financial_strength',
  TECHNOLOGY_CAPABILITY: 'technology_capability',
  TALENT_POOL: 'talent_pool',
  CUSTOMER_BASE: 'customer_base',
  OPERATIONAL_EFFICIENCY: 'operational_efficiency',
  PRODUCT_QUALITY: 'product_quality',
  DISTRIBUTION_NETWORK: 'distribution_network',
  PARTNERSHIPS: 'partnerships',
  // Weaknesses
  LIMITED_RESOURCES: 'limited_resources',
  WEAK_BRAND: 'weak_brand',
  HIGH_COSTS: 'high_costs',
  POOR_TECHNOLOGY: 'poor_technology',
  TALENT_GAPS: 'talent_gaps',
  CUSTOMER_SERVICE: 'customer_service',
  LIMITED_REACH: 'limited_reach',
  QUALITY_ISSUES: 'quality_issues',
  MANAGEMENT_ISSUES: 'management_issues',
  FINANCIAL_CONSTRAINTS: 'financial_constraints',
  // Opportunities
  MARKET_GROWTH: 'market_growth',
  NEW_MARKETS: 'new_markets',
  TECHNOLOGY_ADOPTION: 'technology_adoption',
  REGULATORY_CHANGES: 'regulatory_changes',
  PARTNERSHIP_OPPORTUNITIES: 'partnership_opportunities',
  ACQUISITION_TARGETS: 'acquisition_targets',
  TALENT_AVAILABILITY: 'talent_availability',
  COMPETITOR_WEAKNESS: 'competitor_weakness',
  ECONOMIC_CONDITIONS: 'economic_conditions',
  INNOVATION_POTENTIAL: 'innovation_potential',
  // Threats
  NEW_ENTRANTS: 'new_entrants',
  PRICE_COMPETITION: 'price_competition',
  REGULATORY_RISK: 'regulatory_risk',
  TECHNOLOGY_DISRUPTION: 'technology_disruption',
  ECONOMIC_DOWNTURN: 'economic_downturn',
  TALENT_COMPETITION: 'talent_competition',
  SUPPLIER_ISSUES: 'supplier_issues',
  CUSTOMER_PREFERENCES: 'customer_preferences',
  POLITICAL_INSTABILITY: 'political_instability',
  SUBSTITUTE_PRODUCTS: 'substitute_products',
} as const;

export type SWOTFactorType = typeof SWOT_FACTOR_TYPES[keyof typeof SWOT_FACTOR_TYPES];

export const SWOT_FACTOR_TYPE_LABELS: Record<SWOTFactorType, string> = {
  // Strengths
  [SWOT_FACTOR_TYPES.BRAND_RECOGNITION]: 'Brand Recognition',
  [SWOT_FACTOR_TYPES.MARKET_SHARE]: 'Market Share',
  [SWOT_FACTOR_TYPES.FINANCIAL_STRENGTH]: 'Financial Strength',
  [SWOT_FACTOR_TYPES.TECHNOLOGY_CAPABILITY]: 'Technology Capability',
  [SWOT_FACTOR_TYPES.TALENT_POOL]: 'Talent Pool',
  [SWOT_FACTOR_TYPES.CUSTOMER_BASE]: 'Customer Base',
  [SWOT_FACTOR_TYPES.OPERATIONAL_EFFICIENCY]: 'Operational Efficiency',
  [SWOT_FACTOR_TYPES.PRODUCT_QUALITY]: 'Product/Service Quality',
  [SWOT_FACTOR_TYPES.DISTRIBUTION_NETWORK]: 'Distribution Network',
  [SWOT_FACTOR_TYPES.PARTNERSHIPS]: 'Strategic Partnerships',
  // Weaknesses
  [SWOT_FACTOR_TYPES.LIMITED_RESOURCES]: 'Limited Resources',
  [SWOT_FACTOR_TYPES.WEAK_BRAND]: 'Weak Brand',
  [SWOT_FACTOR_TYPES.HIGH_COSTS]: 'High Cost Structure',
  [SWOT_FACTOR_TYPES.POOR_TECHNOLOGY]: 'Poor Technology',
  [SWOT_FACTOR_TYPES.TALENT_GAPS]: 'Talent Gaps',
  [SWOT_FACTOR_TYPES.CUSTOMER_SERVICE]: 'Customer Service Issues',
  [SWOT_FACTOR_TYPES.LIMITED_REACH]: 'Limited Geographic Reach',
  [SWOT_FACTOR_TYPES.QUALITY_ISSUES]: 'Quality Issues',
  [SWOT_FACTOR_TYPES.MANAGEMENT_ISSUES]: 'Management Issues',
  [SWOT_FACTOR_TYPES.FINANCIAL_CONSTRAINTS]: 'Financial Constraints',
  // Opportunities
  [SWOT_FACTOR_TYPES.MARKET_GROWTH]: 'Market Growth',
  [SWOT_FACTOR_TYPES.NEW_MARKETS]: 'New Markets',
  [SWOT_FACTOR_TYPES.TECHNOLOGY_ADOPTION]: 'Technology Adoption',
  [SWOT_FACTOR_TYPES.REGULATORY_CHANGES]: 'Favorable Regulatory Changes',
  [SWOT_FACTOR_TYPES.PARTNERSHIP_OPPORTUNITIES]: 'Partnership Opportunities',
  [SWOT_FACTOR_TYPES.ACQUISITION_TARGETS]: 'Acquisition Targets',
  [SWOT_FACTOR_TYPES.TALENT_AVAILABILITY]: 'Talent Availability',
  [SWOT_FACTOR_TYPES.COMPETITOR_WEAKNESS]: 'Competitor Weakness',
  [SWOT_FACTOR_TYPES.ECONOMIC_CONDITIONS]: 'Favorable Economic Conditions',
  [SWOT_FACTOR_TYPES.INNOVATION_POTENTIAL]: 'Innovation Potential',
  // Threats
  [SWOT_FACTOR_TYPES.NEW_ENTRANTS]: 'New Market Entrants',
  [SWOT_FACTOR_TYPES.PRICE_COMPETITION]: 'Price Competition',
  [SWOT_FACTOR_TYPES.REGULATORY_RISK]: 'Regulatory Risk',
  [SWOT_FACTOR_TYPES.TECHNOLOGY_DISRUPTION]: 'Technology Disruption',
  [SWOT_FACTOR_TYPES.ECONOMIC_DOWNTURN]: 'Economic Downturn',
  [SWOT_FACTOR_TYPES.TALENT_COMPETITION]: 'Talent Competition',
  [SWOT_FACTOR_TYPES.SUPPLIER_ISSUES]: 'Supplier Issues',
  [SWOT_FACTOR_TYPES.CUSTOMER_PREFERENCES]: 'Changing Customer Preferences',
  [SWOT_FACTOR_TYPES.POLITICAL_INSTABILITY]: 'Political Instability',
  [SWOT_FACTOR_TYPES.SUBSTITUTE_PRODUCTS]: 'Substitute Products/Services',
};

// Map factor types to their SWOT category
export const SWOT_FACTOR_CATEGORY_MAP: Record<SWOTFactorType, SWOTCategory> = {
  // Strengths
  [SWOT_FACTOR_TYPES.BRAND_RECOGNITION]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.MARKET_SHARE]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.FINANCIAL_STRENGTH]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.TECHNOLOGY_CAPABILITY]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.TALENT_POOL]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.CUSTOMER_BASE]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.OPERATIONAL_EFFICIENCY]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.PRODUCT_QUALITY]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.DISTRIBUTION_NETWORK]: SWOT_CATEGORIES.STRENGTH,
  [SWOT_FACTOR_TYPES.PARTNERSHIPS]: SWOT_CATEGORIES.STRENGTH,
  // Weaknesses
  [SWOT_FACTOR_TYPES.LIMITED_RESOURCES]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.WEAK_BRAND]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.HIGH_COSTS]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.POOR_TECHNOLOGY]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.TALENT_GAPS]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.CUSTOMER_SERVICE]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.LIMITED_REACH]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.QUALITY_ISSUES]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.MANAGEMENT_ISSUES]: SWOT_CATEGORIES.WEAKNESS,
  [SWOT_FACTOR_TYPES.FINANCIAL_CONSTRAINTS]: SWOT_CATEGORIES.WEAKNESS,
  // Opportunities
  [SWOT_FACTOR_TYPES.MARKET_GROWTH]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.NEW_MARKETS]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.TECHNOLOGY_ADOPTION]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.REGULATORY_CHANGES]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.PARTNERSHIP_OPPORTUNITIES]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.ACQUISITION_TARGETS]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.TALENT_AVAILABILITY]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.COMPETITOR_WEAKNESS]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.ECONOMIC_CONDITIONS]: SWOT_CATEGORIES.OPPORTUNITY,
  [SWOT_FACTOR_TYPES.INNOVATION_POTENTIAL]: SWOT_CATEGORIES.OPPORTUNITY,
  // Threats
  [SWOT_FACTOR_TYPES.NEW_ENTRANTS]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.PRICE_COMPETITION]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.REGULATORY_RISK]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.TECHNOLOGY_DISRUPTION]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.ECONOMIC_DOWNTURN]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.TALENT_COMPETITION]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.SUPPLIER_ISSUES]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.CUSTOMER_PREFERENCES]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.POLITICAL_INSTABILITY]: SWOT_CATEGORIES.THREAT,
  [SWOT_FACTOR_TYPES.SUBSTITUTE_PRODUCTS]: SWOT_CATEGORIES.THREAT,
};

// ----------------------------------------------------------------------------
// COMPETITIVE MOVE TYPES
// ----------------------------------------------------------------------------

export const COMPETITIVE_MOVE_TYPES = {
  PRODUCT_LAUNCH: 'product_launch',
  PRICE_CHANGE: 'price_change',
  MARKET_ENTRY: 'market_entry',
  MARKET_EXIT: 'market_exit',
  ACQUISITION: 'acquisition',
  PARTNERSHIP: 'partnership',
  LEADERSHIP_CHANGE: 'leadership_change',
  FUNDING_ROUND: 'funding_round',
  EXPANSION: 'expansion',
  RESTRUCTURING: 'restructuring',
  MARKETING_CAMPAIGN: 'marketing_campaign',
  TECHNOLOGY_LAUNCH: 'technology_launch',
  REGULATORY_FILING: 'regulatory_filing',
  IPO_LISTING: 'ipo_listing',
  TALENT_HIRE: 'talent_hire',
} as const;

export type CompetitiveMoveType = typeof COMPETITIVE_MOVE_TYPES[keyof typeof COMPETITIVE_MOVE_TYPES];

export const COMPETITIVE_MOVE_TYPE_LABELS: Record<CompetitiveMoveType, string> = {
  [COMPETITIVE_MOVE_TYPES.PRODUCT_LAUNCH]: 'Product/Service Launch',
  [COMPETITIVE_MOVE_TYPES.PRICE_CHANGE]: 'Price Change',
  [COMPETITIVE_MOVE_TYPES.MARKET_ENTRY]: 'Market Entry',
  [COMPETITIVE_MOVE_TYPES.MARKET_EXIT]: 'Market Exit',
  [COMPETITIVE_MOVE_TYPES.ACQUISITION]: 'Acquisition',
  [COMPETITIVE_MOVE_TYPES.PARTNERSHIP]: 'Strategic Partnership',
  [COMPETITIVE_MOVE_TYPES.LEADERSHIP_CHANGE]: 'Leadership Change',
  [COMPETITIVE_MOVE_TYPES.FUNDING_ROUND]: 'Funding Round',
  [COMPETITIVE_MOVE_TYPES.EXPANSION]: 'Geographic Expansion',
  [COMPETITIVE_MOVE_TYPES.RESTRUCTURING]: 'Restructuring',
  [COMPETITIVE_MOVE_TYPES.MARKETING_CAMPAIGN]: 'Major Marketing Campaign',
  [COMPETITIVE_MOVE_TYPES.TECHNOLOGY_LAUNCH]: 'Technology Launch',
  [COMPETITIVE_MOVE_TYPES.REGULATORY_FILING]: 'Regulatory Filing',
  [COMPETITIVE_MOVE_TYPES.IPO_LISTING]: 'IPO/Public Listing',
  [COMPETITIVE_MOVE_TYPES.TALENT_HIRE]: 'Key Talent Hire',
};

export const COMPETITIVE_MOVE_TYPE_ICONS: Record<CompetitiveMoveType, string> = {
  [COMPETITIVE_MOVE_TYPES.PRODUCT_LAUNCH]: 'rocket_launch',
  [COMPETITIVE_MOVE_TYPES.PRICE_CHANGE]: 'attach_money',
  [COMPETITIVE_MOVE_TYPES.MARKET_ENTRY]: 'login',
  [COMPETITIVE_MOVE_TYPES.MARKET_EXIT]: 'logout',
  [COMPETITIVE_MOVE_TYPES.ACQUISITION]: 'merge_type',
  [COMPETITIVE_MOVE_TYPES.PARTNERSHIP]: 'handshake',
  [COMPETITIVE_MOVE_TYPES.LEADERSHIP_CHANGE]: 'person',
  [COMPETITIVE_MOVE_TYPES.FUNDING_ROUND]: 'payments',
  [COMPETITIVE_MOVE_TYPES.EXPANSION]: 'public',
  [COMPETITIVE_MOVE_TYPES.RESTRUCTURING]: 'architecture',
  [COMPETITIVE_MOVE_TYPES.MARKETING_CAMPAIGN]: 'campaign',
  [COMPETITIVE_MOVE_TYPES.TECHNOLOGY_LAUNCH]: 'memory',
  [COMPETITIVE_MOVE_TYPES.REGULATORY_FILING]: 'gavel',
  [COMPETITIVE_MOVE_TYPES.IPO_LISTING]: 'show_chart',
  [COMPETITIVE_MOVE_TYPES.TALENT_HIRE]: 'person_add',
};

// ----------------------------------------------------------------------------
// IMPACT SIGNIFICANCE
// ----------------------------------------------------------------------------

export const IMPACT_SIGNIFICANCE = {
  NEGLIGIBLE: 'negligible',
  MINOR: 'minor',
  MODERATE: 'moderate',
  SIGNIFICANT: 'significant',
  MAJOR: 'major',
  TRANSFORMATIVE: 'transformative',
} as const;

export type ImpactSignificance = typeof IMPACT_SIGNIFICANCE[keyof typeof IMPACT_SIGNIFICANCE];

export const IMPACT_SIGNIFICANCE_LABELS: Record<ImpactSignificance, string> = {
  [IMPACT_SIGNIFICANCE.NEGLIGIBLE]: 'Negligible Impact',
  [IMPACT_SIGNIFICANCE.MINOR]: 'Minor Impact',
  [IMPACT_SIGNIFICANCE.MODERATE]: 'Moderate Impact',
  [IMPACT_SIGNIFICANCE.SIGNIFICANT]: 'Significant Impact',
  [IMPACT_SIGNIFICANCE.MAJOR]: 'Major Impact',
  [IMPACT_SIGNIFICANCE.TRANSFORMATIVE]: 'Transformative Impact',
};

export const IMPACT_SIGNIFICANCE_SCORES: Record<ImpactSignificance, number> = {
  [IMPACT_SIGNIFICANCE.NEGLIGIBLE]: 1,
  [IMPACT_SIGNIFICANCE.MINOR]: 2,
  [IMPACT_SIGNIFICANCE.MODERATE]: 3,
  [IMPACT_SIGNIFICANCE.SIGNIFICANT]: 4,
  [IMPACT_SIGNIFICANCE.MAJOR]: 5,
  [IMPACT_SIGNIFICANCE.TRANSFORMATIVE]: 6,
};

// ----------------------------------------------------------------------------
// WIN/LOSS OUTCOMES
// ----------------------------------------------------------------------------

export const WIN_LOSS_OUTCOMES = {
  WON: 'won',
  LOST: 'lost',
  NO_DECISION: 'no_decision',
  PARTIAL_WIN: 'partial_win',
  WALKED_AWAY: 'walked_away',
  PENDING: 'pending',
} as const;

export type WinLossOutcome = typeof WIN_LOSS_OUTCOMES[keyof typeof WIN_LOSS_OUTCOMES];

export const WIN_LOSS_OUTCOME_LABELS: Record<WinLossOutcome, string> = {
  [WIN_LOSS_OUTCOMES.WON]: 'Won',
  [WIN_LOSS_OUTCOMES.LOST]: 'Lost',
  [WIN_LOSS_OUTCOMES.NO_DECISION]: 'No Decision',
  [WIN_LOSS_OUTCOMES.PARTIAL_WIN]: 'Partial Win',
  [WIN_LOSS_OUTCOMES.WALKED_AWAY]: 'Walked Away',
  [WIN_LOSS_OUTCOMES.PENDING]: 'Pending',
};

export const WIN_LOSS_OUTCOME_COLORS: Record<WinLossOutcome, string> = {
  [WIN_LOSS_OUTCOMES.WON]: '#10B981',
  [WIN_LOSS_OUTCOMES.LOST]: '#EF4444',
  [WIN_LOSS_OUTCOMES.NO_DECISION]: '#6B7280',
  [WIN_LOSS_OUTCOMES.PARTIAL_WIN]: '#F59E0B',
  [WIN_LOSS_OUTCOMES.WALKED_AWAY]: '#8B5CF6',
  [WIN_LOSS_OUTCOMES.PENDING]: '#3B82F6',
};

// ----------------------------------------------------------------------------
// WIN/LOSS REASONS
// ----------------------------------------------------------------------------

export const WIN_LOSS_REASONS = {
  PRICE: 'price',
  QUALITY: 'quality',
  RELATIONSHIP: 'relationship',
  CAPABILITY: 'capability',
  TIMING: 'timing',
  EXPERIENCE: 'experience',
  INNOVATION: 'innovation',
  SERVICE_LEVEL: 'service_level',
  REFERENCES: 'references',
  LOCAL_PRESENCE: 'local_presence',
  FINANCING: 'financing',
  RISK_PERCEPTION: 'risk_perception',
  POLITICAL: 'political',
  TECHNOLOGY: 'technology',
  OTHER: 'other',
} as const;

export type WinLossReason = typeof WIN_LOSS_REASONS[keyof typeof WIN_LOSS_REASONS];

export const WIN_LOSS_REASON_LABELS: Record<WinLossReason, string> = {
  [WIN_LOSS_REASONS.PRICE]: 'Price/Cost',
  [WIN_LOSS_REASONS.QUALITY]: 'Quality',
  [WIN_LOSS_REASONS.RELATIONSHIP]: 'Relationship/Trust',
  [WIN_LOSS_REASONS.CAPABILITY]: 'Technical Capability',
  [WIN_LOSS_REASONS.TIMING]: 'Timing/Availability',
  [WIN_LOSS_REASONS.EXPERIENCE]: 'Experience/Track Record',
  [WIN_LOSS_REASONS.INNOVATION]: 'Innovation',
  [WIN_LOSS_REASONS.SERVICE_LEVEL]: 'Service Level',
  [WIN_LOSS_REASONS.REFERENCES]: 'References/Testimonials',
  [WIN_LOSS_REASONS.LOCAL_PRESENCE]: 'Local Presence',
  [WIN_LOSS_REASONS.FINANCING]: 'Financing Terms',
  [WIN_LOSS_REASONS.RISK_PERCEPTION]: 'Risk Perception',
  [WIN_LOSS_REASONS.POLITICAL]: 'Political Factors',
  [WIN_LOSS_REASONS.TECHNOLOGY]: 'Technology',
  [WIN_LOSS_REASONS.OTHER]: 'Other',
};

// ----------------------------------------------------------------------------
// INTELLIGENCE SOURCES
// ----------------------------------------------------------------------------

export const INTELLIGENCE_SOURCES = {
  PUBLIC_FILING: 'public_filing',
  NEWS_ARTICLE: 'news_article',
  INDUSTRY_REPORT: 'industry_report',
  FIELD_INTELLIGENCE: 'field_intelligence',
  CUSTOMER_FEEDBACK: 'customer_feedback',
  EMPLOYEE_INTEL: 'employee_intel',
  TRADE_SHOW: 'trade_show',
  SOCIAL_MEDIA: 'social_media',
  WEBSITE: 'website',
  PRESS_RELEASE: 'press_release',
  REGULATORY_FILING: 'regulatory_filing',
  ANALYST_REPORT: 'analyst_report',
  PATENT_FILING: 'patent_filing',
  JOB_POSTING: 'job_posting',
  OTHER: 'other',
} as const;

export type IntelligenceSource = typeof INTELLIGENCE_SOURCES[keyof typeof INTELLIGENCE_SOURCES];

export const INTELLIGENCE_SOURCE_LABELS: Record<IntelligenceSource, string> = {
  [INTELLIGENCE_SOURCES.PUBLIC_FILING]: 'Public Filing',
  [INTELLIGENCE_SOURCES.NEWS_ARTICLE]: 'News Article',
  [INTELLIGENCE_SOURCES.INDUSTRY_REPORT]: 'Industry Report',
  [INTELLIGENCE_SOURCES.FIELD_INTELLIGENCE]: 'Field Intelligence',
  [INTELLIGENCE_SOURCES.CUSTOMER_FEEDBACK]: 'Customer Feedback',
  [INTELLIGENCE_SOURCES.EMPLOYEE_INTEL]: 'Employee Intelligence',
  [INTELLIGENCE_SOURCES.TRADE_SHOW]: 'Trade Show/Conference',
  [INTELLIGENCE_SOURCES.SOCIAL_MEDIA]: 'Social Media',
  [INTELLIGENCE_SOURCES.WEBSITE]: 'Company Website',
  [INTELLIGENCE_SOURCES.PRESS_RELEASE]: 'Press Release',
  [INTELLIGENCE_SOURCES.REGULATORY_FILING]: 'Regulatory Filing',
  [INTELLIGENCE_SOURCES.ANALYST_REPORT]: 'Analyst Report',
  [INTELLIGENCE_SOURCES.PATENT_FILING]: 'Patent Filing',
  [INTELLIGENCE_SOURCES.JOB_POSTING]: 'Job Posting',
  [INTELLIGENCE_SOURCES.OTHER]: 'Other',
};

export const INTELLIGENCE_SOURCE_RELIABILITY: Record<IntelligenceSource, number> = {
  [INTELLIGENCE_SOURCES.PUBLIC_FILING]: 95,
  [INTELLIGENCE_SOURCES.REGULATORY_FILING]: 95,
  [INTELLIGENCE_SOURCES.PATENT_FILING]: 90,
  [INTELLIGENCE_SOURCES.PRESS_RELEASE]: 85,
  [INTELLIGENCE_SOURCES.ANALYST_REPORT]: 80,
  [INTELLIGENCE_SOURCES.INDUSTRY_REPORT]: 80,
  [INTELLIGENCE_SOURCES.NEWS_ARTICLE]: 70,
  [INTELLIGENCE_SOURCES.WEBSITE]: 70,
  [INTELLIGENCE_SOURCES.TRADE_SHOW]: 65,
  [INTELLIGENCE_SOURCES.CUSTOMER_FEEDBACK]: 60,
  [INTELLIGENCE_SOURCES.JOB_POSTING]: 60,
  [INTELLIGENCE_SOURCES.FIELD_INTELLIGENCE]: 55,
  [INTELLIGENCE_SOURCES.EMPLOYEE_INTEL]: 50,
  [INTELLIGENCE_SOURCES.SOCIAL_MEDIA]: 40,
  [INTELLIGENCE_SOURCES.OTHER]: 30,
};

// ----------------------------------------------------------------------------
// POSITIONING DIMENSIONS
// ----------------------------------------------------------------------------

export const POSITIONING_DIMENSIONS = {
  PRICE: 'price',
  QUALITY: 'quality',
  INNOVATION: 'innovation',
  SERVICE: 'service',
  BREADTH: 'breadth',
  SPECIALIZATION: 'specialization',
  LOCAL_FOCUS: 'local_focus',
  GLOBAL_REACH: 'global_reach',
  SPEED: 'speed',
  RELIABILITY: 'reliability',
} as const;

export type PositioningDimension = typeof POSITIONING_DIMENSIONS[keyof typeof POSITIONING_DIMENSIONS];

export const POSITIONING_DIMENSION_LABELS: Record<PositioningDimension, string> = {
  [POSITIONING_DIMENSIONS.PRICE]: 'Price (Low to High)',
  [POSITIONING_DIMENSIONS.QUALITY]: 'Quality (Low to High)',
  [POSITIONING_DIMENSIONS.INNOVATION]: 'Innovation (Traditional to Cutting-Edge)',
  [POSITIONING_DIMENSIONS.SERVICE]: 'Service Level (Basic to Premium)',
  [POSITIONING_DIMENSIONS.BREADTH]: 'Product Breadth (Narrow to Broad)',
  [POSITIONING_DIMENSIONS.SPECIALIZATION]: 'Specialization (Generalist to Specialist)',
  [POSITIONING_DIMENSIONS.LOCAL_FOCUS]: 'Market Focus (Local to Global)',
  [POSITIONING_DIMENSIONS.GLOBAL_REACH]: 'Geographic Reach (Local to Global)',
  [POSITIONING_DIMENSIONS.SPEED]: 'Speed/Delivery (Slow to Fast)',
  [POSITIONING_DIMENSIONS.RELIABILITY]: 'Reliability (Low to High)',
};

// ----------------------------------------------------------------------------
// UGANDA COMPETITOR LANDSCAPE
// ----------------------------------------------------------------------------

export const UGANDA_CONSTRUCTION_COMPETITORS = [
  'Roko Construction',
  'Mota-Engil Uganda',
  'China State Construction',
  'Dott Services',
  'Sogea-Satom Uganda',
  'CICO Construction',
  'Pearl Engineering',
  'Ambitious Construction',
  'Excel Construction',
  'China Communications Construction',
] as const;

export const UGANDA_ADVISORY_COMPETITORS = [
  'Deloitte Uganda',
  'PwC Uganda',
  'KPMG Uganda',
  'EY Uganda',
  'Grant Thornton Uganda',
  'BDO Uganda',
  'PKF Uganda',
  'Bowmans Uganda',
  'Signum Advocates',
  'AF Mpanga Advocates',
] as const;

export const UGANDA_INVESTMENT_COMPETITORS = [
  'Catalyst Principal Partners',
  'Pearl Capital Partners',
  'Fanisi Capital',
  'Novastar Ventures',
  'XSML',
  'Mango Fund',
  'Iungo Capital',
  'Ascent Capital',
  'DOB Equity',
  'AlphaMundi',
] as const;

// ----------------------------------------------------------------------------
// DEFAULT VALUES
// ----------------------------------------------------------------------------

export const DEFAULT_COMPETITOR_CONFIG = {
  threatLevel: THREAT_LEVELS.MODERATE,
  status: COMPETITOR_STATUSES.ACTIVE,
  type: COMPETITOR_TYPES.DIRECT,
  monitoringFrequency: 'monthly',
} as const;

export const ANALYSIS_PERIODS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMI_ANNUAL: 'semi_annual',
  ANNUAL: 'annual',
} as const;

export type AnalysisPeriod = typeof ANALYSIS_PERIODS[keyof typeof ANALYSIS_PERIODS];

export const ANALYSIS_PERIOD_LABELS: Record<AnalysisPeriod, string> = {
  [ANALYSIS_PERIODS.MONTHLY]: 'Monthly',
  [ANALYSIS_PERIODS.QUARTERLY]: 'Quarterly',
  [ANALYSIS_PERIODS.SEMI_ANNUAL]: 'Semi-Annual',
  [ANALYSIS_PERIODS.ANNUAL]: 'Annual',
};

// ----------------------------------------------------------------------------
// FIRESTORE COLLECTIONS
// ----------------------------------------------------------------------------

export const COMPETITORS_COLLECTION = 'competitors';
export const SWOT_COLLECTION = 'competitor_swot';
export const MOVES_COLLECTION = 'competitive_moves';
export const WIN_LOSS_COLLECTION = 'win_loss_records';
export const MARKET_SHARE_COLLECTION = 'market_share_data';
export const PRICING_COLLECTION = 'pricing_intelligence';
