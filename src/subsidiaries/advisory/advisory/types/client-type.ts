/**
 * Client Type Classifications
 */

export type ClientTier =
  | 'strategic'
  | 'institutional'
  | 'professional'
  | 'qualified'
  | 'standard';

export type ClientType =
  | 'institutional'
  | 'corporate'
  | 'family_office'
  | 'hnwi'              // High-net-worth individual
  | 'fund_of_funds'
  | 'government'
  | 'endowment'
  | 'dfi'
  | 'other';

export type InstitutionType =
  // Development Finance
  | 'dfi'               // Development Finance Institution
  | 'mdb'               // Multilateral Development Bank
  | 'bilateral_agency'  // Bilateral aid agency
  
  // Institutional Investors
  | 'pension_fund'
  | 'sovereign_wealth_fund'
  | 'insurance_company'
  | 'asset_manager'
  | 'bank'
  
  // Other
  | 'foundation'
  | 'endowment'
  | 'corporate_treasury'
  | 'family_office_institutional'
  | 'other';

export type KYCDocumentType =
  | 'certificate_of_incorporation'
  | 'memorandum_articles'
  | 'register_of_directors'
  | 'register_of_shareholders'
  | 'proof_of_address'
  | 'financial_statements'
  | 'source_of_funds'
  | 'board_resolution'
  | 'authorized_signatories'
  | 'tax_certificate'
  | 'regulatory_license'
  | 'ubo_declaration'
  | 'passport_id'
  | 'proof_of_wealth'
  | 'establishment_treaty'
  | 'establishment_decree'
  | 'fund_documentation'
  | 'tax_exempt_status'
  | 'budget_allocation'
  | 'accreditation_certificate'
  | 'other';

export interface ClientTypeConfig {
  type: ClientType;
  label: string;
  description: string;
  institutionTypes?: InstitutionType[];
  defaultTier: ClientTier;
  kycLevel: 'standard' | 'enhanced' | 'simplified';
  minimumInvestment?: number;
  requiredDocuments: KYCDocumentType[];
  complianceRequirements: string[];
}

export const CLIENT_TYPE_CONFIGS: ClientTypeConfig[] = [
  {
    type: 'institutional',
    label: 'Institutional Investor',
    description: 'Pension funds, insurance companies, sovereign wealth funds, and other institutional allocators',
    institutionTypes: ['pension_fund', 'sovereign_wealth_fund', 'insurance_company', 'asset_manager', 'bank'],
    defaultTier: 'institutional',
    kycLevel: 'enhanced',
    minimumInvestment: 5_000_000,
    requiredDocuments: [
      'certificate_of_incorporation',
      'memorandum_articles',
      'register_of_directors',
      'board_resolution',
      'authorized_signatories',
      'financial_statements',
      'regulatory_license'
    ],
    complianceRequirements: ['fatca', 'crs', 'aml_screening', 'sanctions_check']
  },
  {
    type: 'dfi',
    label: 'Development Finance Institution',
    description: 'DFIs, MDBs, and bilateral development agencies',
    institutionTypes: ['dfi', 'mdb', 'bilateral_agency'],
    defaultTier: 'strategic',
    kycLevel: 'simplified',
    minimumInvestment: 10_000_000,
    requiredDocuments: [
      'establishment_treaty',
      'board_resolution',
      'authorized_signatories'
    ],
    complianceRequirements: ['sanctions_check']
  },
  {
    type: 'family_office',
    label: 'Family Office',
    description: 'Single and multi-family offices',
    defaultTier: 'professional',
    kycLevel: 'enhanced',
    minimumInvestment: 1_000_000,
    requiredDocuments: [
      'certificate_of_incorporation',
      'register_of_directors',
      'ubo_declaration',
      'source_of_funds',
      'financial_statements'
    ],
    complianceRequirements: ['fatca', 'crs', 'aml_screening', 'sanctions_check', 'pep_check']
  },
  {
    type: 'hnwi',
    label: 'High-Net-Worth Individual',
    description: 'Qualified individual investors',
    defaultTier: 'qualified',
    kycLevel: 'enhanced',
    minimumInvestment: 250_000,
    requiredDocuments: [
      'passport_id',
      'proof_of_address',
      'proof_of_wealth',
      'source_of_funds',
      'accreditation_certificate'
    ],
    complianceRequirements: ['fatca', 'crs', 'aml_screening', 'sanctions_check', 'pep_check', 'accreditation_verification']
  },
  {
    type: 'fund_of_funds',
    label: 'Fund of Funds',
    description: 'Fund managers investing on behalf of their investors',
    defaultTier: 'institutional',
    kycLevel: 'enhanced',
    minimumInvestment: 5_000_000,
    requiredDocuments: [
      'certificate_of_incorporation',
      'fund_documentation',
      'regulatory_license',
      'register_of_directors',
      'financial_statements'
    ],
    complianceRequirements: ['fatca', 'crs', 'aml_screening', 'sanctions_check', 'look_through']
  },
  {
    type: 'government',
    label: 'Government Entity',
    description: 'National and local government bodies',
    defaultTier: 'strategic',
    kycLevel: 'simplified',
    minimumInvestment: 0,
    requiredDocuments: [
      'establishment_decree',
      'authorized_signatories',
      'budget_allocation'
    ],
    complianceRequirements: ['sanctions_check']
  },
  {
    type: 'endowment',
    label: 'Endowment/Foundation',
    description: 'University endowments, charitable foundations',
    defaultTier: 'professional',
    kycLevel: 'standard',
    minimumInvestment: 1_000_000,
    requiredDocuments: [
      'certificate_of_incorporation',
      'tax_exempt_status',
      'board_resolution',
      'financial_statements'
    ],
    complianceRequirements: ['aml_screening', 'sanctions_check']
  }
];

export function getClientTypeConfig(type: ClientType): ClientTypeConfig | undefined {
  return CLIENT_TYPE_CONFIGS.find(c => c.type === type);
}
