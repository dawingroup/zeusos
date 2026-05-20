/**
 * GEO POINT
 * Latitude/longitude coordinates
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * ADDRESS
 * Structured address components
 */
export interface Address {
  street?: string;
  city?: string;
  district?: string;
  region?: string;
  country: string;
  postalCode?: string;
}

/**
 * LOCATION TYPE
 */
export type LocationType = 'headquarters' | 'site' | 'office' | 'warehouse' | 'other';

/**
 * GEO LOCATION
 * Full location with address and coordinates
 */
export interface GeoLocation {
  /** Display name */
  name: string;
  
  /** Address components */
  address?: Address;
  
  /** Coordinates */
  coordinates?: GeoPoint;
  
  /** Location type */
  type?: LocationType;
  
  /** Is primary location */
  isPrimary?: boolean;
}

/**
 * COUNTRY
 * Country reference
 */
export interface Country {
  /** ISO 3166-1 alpha-2 code */
  code: string;
  
  /** Country name */
  name: string;
  
  /** Geographic region */
  region: string;
  
  /** ISO 4217 currency code */
  currency: string;
}

/**
 * East African countries supported
 */
export const EA_COUNTRIES: Country[] = [
  { code: 'UG', name: 'Uganda', region: 'East Africa', currency: 'UGX' },
  { code: 'KE', name: 'Kenya', region: 'East Africa', currency: 'KES' },
  { code: 'TZ', name: 'Tanzania', region: 'East Africa', currency: 'TZS' },
  { code: 'RW', name: 'Rwanda', region: 'East Africa', currency: 'RWF' },
  { code: 'ET', name: 'Ethiopia', region: 'East Africa', currency: 'ETB' },
  { code: 'SS', name: 'South Sudan', region: 'East Africa', currency: 'SSP' },
  { code: 'BI', name: 'Burundi', region: 'East Africa', currency: 'BIF' },
  { code: 'SO', name: 'Somalia', region: 'East Africa', currency: 'SOS' },
  { code: 'DJ', name: 'Djibouti', region: 'East Africa', currency: 'DJF' },
  { code: 'ER', name: 'Eritrea', region: 'East Africa', currency: 'ERN' },
];

/**
 * Southern African countries
 */
export const SA_COUNTRIES: Country[] = [
  { code: 'ZA', name: 'South Africa', region: 'Southern Africa', currency: 'ZAR' },
  { code: 'ZW', name: 'Zimbabwe', region: 'Southern Africa', currency: 'ZWL' },
  { code: 'ZM', name: 'Zambia', region: 'Southern Africa', currency: 'ZMW' },
  { code: 'MW', name: 'Malawi', region: 'Southern Africa', currency: 'MWK' },
  { code: 'MZ', name: 'Mozambique', region: 'Southern Africa', currency: 'MZN' },
  { code: 'BW', name: 'Botswana', region: 'Southern Africa', currency: 'BWP' },
  { code: 'NA', name: 'Namibia', region: 'Southern Africa', currency: 'NAD' },
];

/**
 * All supported countries
 */
export const ALL_COUNTRIES: Country[] = [...EA_COUNTRIES, ...SA_COUNTRIES];

/**
 * Get country by code
 */
export function getCountryByCode(code: string): Country | undefined {
  return ALL_COUNTRIES.find(c => c.code === code);
}

/**
 * Get countries by region
 */
export function getCountriesByRegion(region: string): Country[] {
  return ALL_COUNTRIES.filter(c => c.region === region);
}

/**
 * Format location for display
 */
export function formatLocation(location: GeoLocation): string {
  if (location.address) {
    const parts = [
      location.address.city,
      location.address.region,
      location.address.country,
    ].filter(Boolean);
    return parts.join(', ');
  }
  return location.name;
}
