/**
 * CLIENT TYPE
 * Classification of client entity
 */
export type ClientType =
  // Institutional/Program Clients
  | 'ngo'                     // Non-governmental organization
  | 'foundation'              // Charitable foundation
  | 'government_ministry'     // Government ministry
  | 'government_agency'       // Government agency/parastatal
  | 'local_government'        // County/district government
  | 'development_bank'        // DFI/MDB
  | 'corporate'               // Private corporation
  | 'sme'                     // Small/medium enterprise
  
  // Investment Advisory Clients
  | 'pension_fund'            // Pension/retirement fund
  | 'insurance_company'       // Insurance company
  | 'endowment'               // University/charitable endowment
  | 'sovereign_wealth'        // Sovereign wealth fund
  | 'family_office'           // Family office
  | 'hnwi'                    // High net worth individual
  | 'uhnwi';                  // Ultra high net worth individual

/**
 * ENTITY TYPE
 * Legal entity classification
 */
export type EntityType =
  | 'individual'              // Natural person
  | 'joint'                   // Joint account (married couple, etc.)
  | 'trust'                   // Trust structure
  | 'foundation'              // Foundation
  | 'corporation'             // Limited company
  | 'partnership'             // Partnership
  | 'llp'                     // Limited liability partnership
  | 'llc'                     // Limited liability company
  | 'government_entity'       // Government body
  | 'international_org'       // International organization
  | 'cooperative';            // Cooperative/SACCO

/**
 * Get display name for client type
 */
export function getClientTypeDisplayName(type: ClientType): string {
  const names: Record<ClientType, string> = {
    ngo: 'NGO',
    foundation: 'Foundation',
    government_ministry: 'Government Ministry',
    government_agency: 'Government Agency',
    local_government: 'Local Government',
    development_bank: 'Development Bank',
    corporate: 'Corporate',
    sme: 'SME',
    pension_fund: 'Pension Fund',
    insurance_company: 'Insurance Company',
    endowment: 'Endowment',
    sovereign_wealth: 'Sovereign Wealth Fund',
    family_office: 'Family Office',
    hnwi: 'HNWI',
    uhnwi: 'UHNWI',
  };
  return names[type];
}

/**
 * Get client type description
 */
export function getClientTypeDescription(type: ClientType): string {
  const descriptions: Record<ClientType, string> = {
    ngo: 'Non-governmental organization',
    foundation: 'Charitable or private foundation',
    government_ministry: 'Central government ministry',
    government_agency: 'Government agency or parastatal',
    local_government: 'County, district, or municipal government',
    development_bank: 'Development finance institution or multilateral development bank',
    corporate: 'Private corporation or multinational',
    sme: 'Small or medium enterprise',
    pension_fund: 'Pension or retirement fund',
    insurance_company: 'Insurance or reinsurance company',
    endowment: 'University, hospital, or charitable endowment',
    sovereign_wealth: 'Sovereign wealth fund',
    family_office: 'Single or multi-family office',
    hnwi: 'High net worth individual ($1M-$30M)',
    uhnwi: 'Ultra high net worth individual ($30M+)',
  };
  return descriptions[type];
}

/**
 * Check if client type is investment advisory type
 */
export function isInvestmentAdvisoryClient(type: ClientType): boolean {
  return [
    'pension_fund',
    'insurance_company',
    'endowment',
    'sovereign_wealth',
    'family_office',
    'hnwi',
    'uhnwi',
  ].includes(type);
}

/**
 * Check if client type is institutional program type
 */
export function isInstitutionalClient(type: ClientType): boolean {
  return [
    'ngo',
    'foundation',
    'government_ministry',
    'government_agency',
    'local_government',
    'development_bank',
    'corporate',
    'sme',
  ].includes(type);
}

/**
 * Check if client type is government
 */
export function isGovernmentClient(type: ClientType): boolean {
  return [
    'government_ministry',
    'government_agency',
    'local_government',
  ].includes(type);
}

/**
 * Get entity type display name
 */
export function getEntityTypeDisplayName(type: EntityType): string {
  const names: Record<EntityType, string> = {
    individual: 'Individual',
    joint: 'Joint Account',
    trust: 'Trust',
    foundation: 'Foundation',
    corporation: 'Corporation',
    partnership: 'Partnership',
    llp: 'LLP',
    llc: 'LLC',
    government_entity: 'Government Entity',
    international_org: 'International Organization',
    cooperative: 'Cooperative',
  };
  return names[type];
}

/**
 * Get default entity type for client type
 */
export function getDefaultEntityType(clientType: ClientType): EntityType {
  const defaults: Record<ClientType, EntityType> = {
    ngo: 'corporation',
    foundation: 'foundation',
    government_ministry: 'government_entity',
    government_agency: 'government_entity',
    local_government: 'government_entity',
    development_bank: 'international_org',
    corporate: 'corporation',
    sme: 'corporation',
    pension_fund: 'trust',
    insurance_company: 'corporation',
    endowment: 'trust',
    sovereign_wealth: 'government_entity',
    family_office: 'corporation',
    hnwi: 'individual',
    uhnwi: 'individual',
  };
  return defaults[clientType];
}

/**
 * Get client type icon (Lucide icon name)
 */
export function getClientTypeIcon(type: ClientType): string {
  const icons: Record<ClientType, string> = {
    ngo: 'Heart',
    foundation: 'Gift',
    government_ministry: 'Landmark',
    government_agency: 'Building2',
    local_government: 'MapPin',
    development_bank: 'Landmark',
    corporate: 'Building',
    sme: 'Store',
    pension_fund: 'PiggyBank',
    insurance_company: 'Shield',
    endowment: 'GraduationCap',
    sovereign_wealth: 'Crown',
    family_office: 'Users',
    hnwi: 'User',
    uhnwi: 'UserCheck',
  };
  return icons[type];
}
