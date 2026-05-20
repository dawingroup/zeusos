/**
 * Adobe Services Configuration
 *
 * Centralized configuration for all Adobe API integrations.
 * Credentials are loaded from environment variables.
 *
 * @see docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md for full implementation
 */

export interface AdobeConfig {
  // PDF Services
  pdfServices: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    orgId: string;
    technicalAccountId: string;
    privateKeyPath?: string;
    privateKey?: string;
  };

  // Adobe Sign
  sign: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    baseUri: string;
    refreshToken?: string;
  };

  // Firefly Services
  firefly: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
  };

  // Creative Cloud Libraries
  ccLibraries: {
    enabled: boolean;
    apiKey: string;
  };
}

export function getAdobeConfig(): AdobeConfig {
  return {
    pdfServices: {
      enabled: import.meta.env.VITE_ADOBE_PDF_SERVICES_ENABLED === 'true',
      clientId: import.meta.env.VITE_ADOBE_CLIENT_ID || '',
      clientSecret: '', // Server-side only
      orgId: import.meta.env.VITE_ADOBE_ORG_ID || '',
      technicalAccountId: import.meta.env.VITE_ADOBE_TECHNICAL_ACCOUNT_ID || '',
    },
    sign: {
      enabled: import.meta.env.VITE_ADOBE_SIGN_ENABLED === 'true',
      clientId: import.meta.env.VITE_ADOBE_SIGN_CLIENT_ID || '',
      clientSecret: '', // Server-side only
      baseUri:
        import.meta.env.VITE_ADOBE_SIGN_BASE_URI ||
        'https://api.na1.adobesign.com',
    },
    firefly: {
      enabled: import.meta.env.VITE_ADOBE_FIREFLY_ENABLED === 'true',
      clientId: import.meta.env.VITE_ADOBE_FIREFLY_CLIENT_ID || '',
      clientSecret: '', // Server-side only
    },
    ccLibraries: {
      enabled: import.meta.env.VITE_ADOBE_CC_LIBRARIES_ENABLED === 'true',
      apiKey: import.meta.env.VITE_ADOBE_CC_API_KEY || '',
    },
  };
}

export function isAdobeServiceEnabled(service: keyof AdobeConfig): boolean {
  const config = getAdobeConfig();
  return config[service]?.enabled ?? false;
}

// Debug mode
export const ADOBE_DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_ADOBE_DEBUG === 'true';

export function logAdobeDebug(message: string, data?: unknown): void {
  if (ADOBE_DEBUG) {
    console.log(`[Adobe] ${message}`, data);
  }
}
