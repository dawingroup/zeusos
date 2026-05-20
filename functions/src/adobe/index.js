/**
 * Adobe Services - Firebase Cloud Functions
 *
 * Exports all Adobe-related cloud functions for PDF Services,
 * Document Generation, Sign, and Creative Cloud APIs.
 */

// PDF Services Functions (v1 - onCall, may have CORS issues)
const {
  adobeCreatePdf,
  adobeExportPdf,
  adobeCombinePdf,
  adobeExtractPdf,
  adobeOcrPdf,
  adobeCompressPdf,
  adobeProtectPdf,
  adobeSplitPdf,
  adobeLinearizePdf,
  adobeWatermarkPdf,
} = require('./pdf-services');

// PDF Services Functions (v2 - onRequest Gen 2, may have CORS issues with org policy)
const {
  adobeCreatePdfV2,
  adobeExtractPdfV2,
  adobeCompressPdfV2,
} = require('./pdf-services-v2');

// PDF Services Functions (Gen 1 - for CORS compatibility with org policy)
const {
  adobeCreatePdfGen1,
  adobeExtractPdfGen1,
  adobeCompressPdfGen1,
} = require('./pdf-services-gen1');

// Token Service utilities (for internal use)
const {
  getAccessToken,
  isAdobeConfigured,
  getAdobeConfig,
} = require('./token-service');

module.exports = {
  // PDF Services (v1 - onCall)
  adobeCreatePdf,
  adobeExportPdf,
  adobeCombinePdf,
  adobeExtractPdf,
  adobeOcrPdf,
  adobeCompressPdf,
  adobeProtectPdf,
  adobeSplitPdf,
  adobeLinearizePdf,
  adobeWatermarkPdf,

  // PDF Services (v2 - onRequest Gen 2, may have CORS issues)
  adobeCreatePdfV2,
  adobeExtractPdfV2,
  adobeCompressPdfV2,

  // PDF Services (Gen 1 - for CORS compatibility)
  adobeCreatePdfGen1,
  adobeExtractPdfGen1,
  adobeCompressPdfGen1,

  // Utilities (for future phases)
  _internal: {
    getAccessToken,
    isAdobeConfigured,
    getAdobeConfig,
  },
};
