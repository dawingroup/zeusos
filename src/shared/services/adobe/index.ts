/**
 * Adobe Services Public API
 *
 * This module provides unified access to all Adobe Professional integrations.
 *
 * @example
 * ```typescript
 * import { adobePdf, adobeSign, adobePhotoshop } from '@/shared/services/adobe';
 *
 * // Generate PDF
 * const pdf = await adobePdf.createFromHtml(htmlContent);
 *
 * // Send for signature
 * await adobeSign.sendForSignature(pdf, recipientEmail);
 *
 * // Enhance image
 * const enhanced = await adobePhotoshop.removeBackground(imageUrl);
 * ```
 *
 * @see docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md for full implementation guide
 * @see docs/ADOBE_QUICKSTART.md for quick start guide
 */

// Configuration
export { getAdobeConfig, isAdobeServiceEnabled, ADOBE_DEBUG, logAdobeDebug } from './config';
export type { AdobeConfig } from './config';

// Types
export * from './types';

// Auth
export { AdobeTokenManager } from './auth';

// Utils
export {
  parseAdobeError,
  isRetryableError,
  getRetryDelay,
  ADOBE_ERROR_CODES,
} from './utils';

// =============================================================================
// Phase 2: PDF Services
// =============================================================================
export { AdobePdfServicesClient, adobePdfServices } from './pdf';
export { AdobePdfExtractClient, adobePdfExtract } from './pdf/pdf-extract';
export type { BOQItem, BOQExtractionResult } from './pdf/pdf-extract';

// =============================================================================
// Phase 3: Document Generation (uncomment after implementation)
// =============================================================================
// export { AdobeDocumentGenerationClient, adobeDocumentGeneration } from './document-generation';

// =============================================================================
// Phase 4: Adobe Sign (uncomment after implementation)
// =============================================================================
// export { AdobeSignClient, adobeSign } from './sign';

// =============================================================================
// Phase 5: Creative Services (uncomment after implementation)
// =============================================================================
// export { AdobePhotoshopClient, adobePhotoshop } from './creative/photoshop';
// export { AdobeLightroomClient, adobeLightroom } from './creative/lightroom';
// export { AdobeFireflyClient, adobeFirefly } from './creative/firefly';

// =============================================================================
// Phase 6: Creative Cloud Libraries (uncomment after implementation)
// =============================================================================
// export { AdobeCCLibrariesClient, adobeCCLibraries } from './cc-libraries';

// =============================================================================
// PDF Embed API (client-side PDF viewer)
// =============================================================================
export { AdobePdfEmbedClient, getAdobePdfEmbedClient, adobePdfEmbed } from './embed';
export type { PDFEmbedConfig, PDFEmbedOptions } from './embed';

// =============================================================================
// Hooks
// =============================================================================
export { useAdobePdfServices } from './hooks/useAdobePdfServices';
export { useAdobePdfEmbed } from './hooks/useAdobePdfEmbed';
// export { useAdobeDocGen } from './hooks/useAdobeDocGen';
// export { useAdobeSign } from './hooks/useAdobeSign';
// export { useAdobePhotoshop } from './hooks/useAdobePhotoshop';
// export { useAdobeFirefly } from './hooks/useAdobeFirefly';
// export { useAdobeLibraries } from './hooks/useAdobeLibraries';
