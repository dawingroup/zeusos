/**
 * ADDRESS TYPE
 */
export type AddressType =
  | 'registered'     // Legal registered address
  | 'headquarters'   // Main office
  | 'mailing'        // Correspondence address
  | 'site'           // Project/site location
  | 'residential'    // Home address (for individuals)
  | 'other';

/**
 * ADDRESS
 * Physical/mailing address
 */
export interface Address {
  /** Address type */
  type: AddressType;
  
  /** Is primary address */
  isPrimary: boolean;
  
  /** Address line 1 */
  line1: string;
  
  /** Address line 2 */
  line2?: string;
  
  /** City/town */
  city: string;
  
  /** District/county */
  district?: string;
  
  /** State/region/province */
  region?: string;
  
  /** Country (ISO 3166-1 alpha-2) */
  country: string;
  
  /** Postal/ZIP code */
  postalCode?: string;
}

/**
 * Get address type display name
 */
export function getAddressTypeDisplayName(type: AddressType): string {
  const names: Record<AddressType, string> = {
    registered: 'Registered Address',
    headquarters: 'Headquarters',
    mailing: 'Mailing Address',
    site: 'Site Location',
    residential: 'Residential Address',
    other: 'Other',
  };
  return names[type];
}

/**
 * Format address for display (multi-line)
 */
export function formatAddress(address: Address): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.region,
    address.country,
    address.postalCode,
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Format address for single line display
 */
export function formatAddressOneLine(address: Address): string {
  return `${address.city}, ${address.country}`;
}

/**
 * Format address for mailing
 */
export function formatAddressForMailing(address: Address): string {
  const lines = [
    address.line1,
    address.line2,
    [address.city, address.region].filter(Boolean).join(', '),
    address.postalCode,
    address.country,
  ].filter(Boolean);
  
  return lines.join('\n');
}

/**
 * Create empty address
 */
export function createEmptyAddress(type: AddressType = 'headquarters', isPrimary: boolean = true): Address {
  return {
    type,
    isPrimary,
    line1: '',
    city: '',
    country: '',
  };
}
