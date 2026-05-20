/**
 * Geographic and regulatory information for deals
 * 
 * Focused on East Africa but supports global deals.
 */

export interface DealGeography {
  country: string;             // ISO 3166-1 alpha-2
  region?: string;             // State/Province
  city?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  operatingCountries?: string[];  // For multi-country operations
}

export interface RegulatoryInfo {
  regulatoryBody?: string;
  licenseRequired: boolean;
  licenseStatus?: LicenseStatus;
  licenseDetails?: string;
  foreignOwnershipLimit?: number;  // Percentage
  sectorRestrictions?: string[];
  approvalRequirements: ApprovalRequirement[];
  taxConsiderations?: TaxConsideration[];
  environmentalPermits?: EnvironmentalPermit[];
}

export type LicenseStatus = 
  | 'not_required'
  | 'required_not_started'
  | 'application_submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface ApprovalRequirement {
  authority: string;
  type: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  submittedDate?: Date;
  expectedDate?: Date;
  notes?: string;
}

export interface TaxConsideration {
  taxType: TaxType;
  rate?: number;
  description: string;
  mitigationStrategy?: string;
}

export type TaxType =
  | 'corporate_income'
  | 'withholding'
  | 'vat'
  | 'stamp_duty'
  | 'capital_gains'
  | 'transfer_tax'
  | 'customs'
  | 'other';

export interface EnvironmentalPermit {
  permitType: string;
  authority: string;
  status: 'not_required' | 'required' | 'applied' | 'approved' | 'expired';
  expiryDate?: Date;
  notes?: string;
}

// East Africa specific country configurations
export const EA_COUNTRY_CONFIG: Record<string, CountryConfig> = {
  UG: {
    name: 'Uganda',
    currency: 'UGX',
    regulatoryBodies: ['URA', 'URSB', 'Ministry of Finance'],
    foreignOwnershipRestrictions: {
      default: 100,
      restricted: {
        'banking': 49,
        'insurance': 67,
        'telecommunications': 51,
      },
    },
    taxRates: {
      corporateIncome: 30,
      withholding: {
        dividends: 15,
        interest: 15,
        royalties: 15,
      },
      vat: 18,
      capitalGains: 30,
    },
  },
  KE: {
    name: 'Kenya',
    currency: 'KES',
    regulatoryBodies: ['KRA', 'CBK', 'CMA'],
    foreignOwnershipRestrictions: {
      default: 100,
      restricted: {
        'banking': 40,
        'insurance': 67,
        'telecommunications': 80,
      },
    },
    taxRates: {
      corporateIncome: 30,
      withholding: {
        dividends: 15,
        interest: 15,
        royalties: 20,
      },
      vat: 16,
      capitalGains: 15,
    },
  },
  TZ: {
    name: 'Tanzania',
    currency: 'TZS',
    regulatoryBodies: ['TRA', 'BRELA', 'CMSA'],
    foreignOwnershipRestrictions: {
      default: 100,
      restricted: {
        'mining': 16,
        'banking': 40,
        'telecommunications': 51,
      },
    },
    taxRates: {
      corporateIncome: 30,
      withholding: {
        dividends: 10,
        interest: 10,
        royalties: 15,
      },
      vat: 18,
      capitalGains: 10,
    },
  },
  RW: {
    name: 'Rwanda',
    currency: 'RWF',
    regulatoryBodies: ['RRA', 'BNR', 'CMA'],
    foreignOwnershipRestrictions: {
      default: 100,
      restricted: {},
    },
    taxRates: {
      corporateIncome: 30,
      withholding: {
        dividends: 15,
        interest: 15,
        royalties: 15,
      },
      vat: 18,
      capitalGains: 30,
    },
  },
};

export interface CountryConfig {
  name: string;
  currency: string;
  regulatoryBodies: string[];
  foreignOwnershipRestrictions: {
    default: number;
    restricted: Record<string, number>;
  };
  taxRates: {
    corporateIncome: number;
    withholding: {
      dividends: number;
      interest: number;
      royalties: number;
    };
    vat: number;
    capitalGains: number;
  };
}

// Helper to get country config
export function getCountryConfig(countryCode: string): CountryConfig | undefined {
  return EA_COUNTRY_CONFIG[countryCode];
}

// Helper to get foreign ownership limit for a sector
export function getForeignOwnershipLimit(countryCode: string, sector: string): number {
  const config = EA_COUNTRY_CONFIG[countryCode];
  if (!config) return 100; // Default to no restriction
  
  const restricted = config.foreignOwnershipRestrictions.restricted[sector.toLowerCase()];
  return restricted !== undefined ? restricted : config.foreignOwnershipRestrictions.default;
}

// Get license status display name
export function getLicenseStatusDisplayName(status: LicenseStatus): string {
  const names: Record<LicenseStatus, string> = {
    not_required: 'Not Required',
    required_not_started: 'Required - Not Started',
    application_submitted: 'Application Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    expired: 'Expired',
  };
  return names[status] || status;
}
