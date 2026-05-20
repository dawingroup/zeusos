/**
 * Adobe PDF Services Cloud Functions
 *
 * Firebase callable functions for PDF operations using Adobe PDF Services API.
 * All API secrets are stored server-side using Firebase Functions secrets.
 *
 * @see https://developer.adobe.com/document-services/docs/overview/pdf-services-api/
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { getAccessToken, getAdobeConfig, getAdobeSecrets, isAdobeConfigured } = require('./token-service');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Common options for all Adobe callable functions
// Note: We don't use invoker: 'private' because it blocks CORS preflight requests.
// Authentication is handled via request.auth in the function code, which validates
// the Firebase Auth token passed by httpsCallable.
const callableOptions = {
  cors: ALLOWED_ORIGINS,
  maxInstances: 10,
};

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const storage = admin.storage();

/**
 * Helper to get file content from various sources
 *
 * @param {Object} fileRef - File reference object
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
async function getFileContent(fileRef) {
  const { type, value, contentType = 'application/pdf' } = fileRef;

  switch (type) {
    case 'url': {
      const response = await fetch(value);
      if (!response.ok) {
        throw new HttpsError('invalid-argument', `Failed to fetch file from URL: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return { buffer, contentType: response.headers.get('content-type') || contentType };
    }

    case 'base64': {
      const buffer = Buffer.from(value, 'base64');
      return { buffer, contentType };
    }

    case 'storage': {
      const bucket = storage.bucket();
      const file = bucket.file(value);
      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', `File not found in storage: ${value}`);
      }
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      return { buffer, contentType: metadata.contentType || contentType };
    }

    default:
      throw new HttpsError('invalid-argument', `Unsupported file reference type: ${type}`);
  }
}

/**
 * Upload file to Adobe and get asset ID
 *
 * @param {Buffer} buffer - File content
 * @param {string} contentType - MIME type
 * @param {string} accessToken - Adobe access token
 * @returns {Promise<string>} Asset ID
 */
async function uploadToAdobe(buffer, contentType, accessToken) {
  const config = getAdobeConfig();

  // Step 1: Request upload URI
  const uploadResponse = await fetch(`${config.pdfServicesBaseUrl}/assets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': config.clientId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mediaType: contentType,
    }),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new HttpsError('internal', `Failed to get upload URI: ${errorText}`);
  }

  const { uploadUri, assetID } = await uploadResponse.json();

  // Step 2: Upload the file
  const putResponse = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: buffer,
  });

  if (!putResponse.ok) {
    throw new HttpsError('internal', `Failed to upload file to Adobe: ${putResponse.status}`);
  }

  return assetID;
}

/**
 * Poll for operation completion and download result
 *
 * @param {string} pollingUrl - URL to poll for status
 * @param {string} accessToken - Adobe access token
 * @param {number} maxWaitMs - Maximum wait time
 * @returns {Promise<Buffer>} Result file content
 */
async function pollAndDownload(pollingUrl, accessToken, maxWaitMs = 120000) {
  const config = getAdobeConfig();
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(pollingUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': config.clientId,
      },
    });

    if (!response.ok) {
      throw new HttpsError('internal', `Polling failed: ${response.status}`);
    }

    const status = await response.json();

    if (status.status === 'done') {
      // Download the result
      const downloadUrl = status.asset?.downloadUri || status.downloadUri;
      if (!downloadUrl) {
        throw new HttpsError('internal', 'No download URI in completed operation');
      }

      const resultResponse = await fetch(downloadUrl);
      if (!resultResponse.ok) {
        throw new HttpsError('internal', `Failed to download result: ${resultResponse.status}`);
      }

      return Buffer.from(await resultResponse.arrayBuffer());
    }

    if (status.status === 'failed') {
      throw new HttpsError('internal', `Operation failed: ${status.error?.message || 'Unknown error'}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new HttpsError('deadline-exceeded', 'Operation timed out');
}

/**
 * Create PDF from various file formats
 */
const adobeCreatePdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input, inputFormat, documentLanguage } = request.data;

    if (!input) {
      throw new HttpsError('invalid-argument', 'Input file reference required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      // Get file content
      const { buffer, contentType } = await getFileContent(input);

      // Upload to Adobe
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      // Create PDF operation
      const operationResponse = await fetch(config.createPdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetID: assetId,
          ...(documentLanguage && { documentLanguage }),
        }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Create PDF failed: ${errorText}`);
      }

      // Get polling location
      const pollingUrl = operationResponse.headers.get('location');
      if (!pollingUrl) {
        throw new HttpsError('internal', 'No polling URL returned');
      }

      // Poll for completion and get result
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);

      // Return as base64
      return {
        success: true,
        data: resultBuffer.toString('base64'),
        contentType: 'application/pdf',
      };
    } catch (error) {
      logger.error('adobeCreatePdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Export PDF to other formats (DOCX, PPTX, etc.)
 */
const adobeExportPdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input, outputFormat, ocrEnabled, ocrLanguage } = request.data;

    if (!input || !outputFormat) {
      throw new HttpsError('invalid-argument', 'Input and outputFormat required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      const operationResponse = await fetch(config.exportPdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetID: assetId,
          targetFormat: outputFormat,
          ...(ocrEnabled && { ocrLang: ocrLanguage || 'en-US' }),
        }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Export PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);

      const outputContentTypes = {
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        rtf: 'application/rtf',
      };

      return {
        success: true,
        data: resultBuffer.toString('base64'),
        contentType: outputContentTypes[outputFormat] || 'application/octet-stream',
      };
    } catch (error) {
      logger.error('adobeExportPdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Combine multiple PDFs into one
 */
const adobeCombinePdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { inputs, pageRanges } = request.data;

    if (!inputs || !Array.isArray(inputs) || inputs.length < 2) {
      throw new HttpsError('invalid-argument', 'At least 2 input files required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      // Upload all files
      const assets = await Promise.all(
        inputs.map(async (input) => {
          const { buffer, contentType } = await getFileContent(input);
          const assetId = await uploadToAdobe(buffer, contentType, accessToken);
          return { assetID: assetId };
        })
      );

      // Add page ranges if specified
      if (pageRanges && pageRanges.length > 0) {
        pageRanges.forEach((range) => {
          if (assets[range.fileIndex]) {
            assets[range.fileIndex].pageRanges = [{
              start: range.start,
              end: range.end,
            }];
          }
        });
      }

      const operationResponse = await fetch(config.combinePdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assets }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Combine PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);

      return {
        success: true,
        data: resultBuffer.toString('base64'),
        contentType: 'application/pdf',
      };
    } catch (error) {
      logger.error('adobeCombinePdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Extract text and tables from PDF
 */
const adobeExtractPdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input, elementsToExtract, tableOutputFormat, includeRenditions, includeStyling } = request.data;

    if (!input) {
      throw new HttpsError('invalid-argument', 'Input file reference required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      const elementsToExtractOption = elementsToExtract || ['text', 'tables'];

      const operationResponse = await fetch(config.extractApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetID: assetId,
          elementsToExtract: elementsToExtractOption,
          ...(tableOutputFormat && { tableOutputFormat }),
          renditionsToExtract: includeRenditions ? ['tables', 'figures'] : [],
          ...(includeStyling && { addCharInfo: true }),
        }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Extract PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');

      // Poll for completion - extraction returns JSON
      const startTime = Date.now();
      const maxWaitMs = 180000; // 3 minutes for extraction
      const pollInterval = 3000;

      while (Date.now() - startTime < maxWaitMs) {
        const statusResponse = await fetch(pollingUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-api-key': config.clientId,
          },
        });

        if (!statusResponse.ok) {
          throw new HttpsError('internal', `Polling failed: ${statusResponse.status}`);
        }

        const status = await statusResponse.json();

        if (status.status === 'done') {
          // Download the ZIP result
          const downloadUrl = status.resource?.downloadUri;
          if (!downloadUrl) {
            throw new HttpsError('internal', 'No download URI in completed extraction');
          }

          const resultResponse = await fetch(downloadUrl);
          if (!resultResponse.ok) {
            throw new HttpsError('internal', `Failed to download result: ${resultResponse.status}`);
          }

          // Adobe Extract API returns a ZIP file containing structuredData.json
          const zipBuffer = Buffer.from(await resultResponse.arrayBuffer());
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(zipBuffer);

          // Find and extract the structuredData.json file
          const jsonEntry = zip.getEntry('structuredData.json');
          if (!jsonEntry) {
            throw new HttpsError('internal', 'structuredData.json not found in extraction result');
          }

          const jsonContent = zip.readAsText(jsonEntry);
          const extractedData = JSON.parse(jsonContent);

          return {
            success: true,
            data: extractedData,
          };
        }

        if (status.status === 'failed') {
          throw new HttpsError('internal', `Extraction failed: ${status.error?.message || 'Unknown error'}`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      throw new HttpsError('deadline-exceeded', 'Extraction timed out');
    } catch (error) {
      logger.error('adobeExtractPdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * OCR a scanned PDF
 */
const adobeOcrPdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input, ocrLanguage, ocrType } = request.data;

    if (!input) {
      throw new HttpsError('invalid-argument', 'Input file reference required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      const operationResponse = await fetch(config.ocrPdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetID: assetId,
          ocrLang: ocrLanguage || 'en-US',
          ocrType: ocrType || 'searchable_image',
        }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `OCR PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);

      return {
        success: true,
        data: resultBuffer.toString('base64'),
        contentType: 'application/pdf',
      };
    } catch (error) {
      logger.error('adobeOcrPdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Compress PDF
 */
const adobeCompressPdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input, compressionLevel } = request.data;

    if (!input) {
      throw new HttpsError('invalid-argument', 'Input file reference required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const originalSize = buffer.length;
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      const operationResponse = await fetch(config.compressPdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetID: assetId,
          compressionLevel: compressionLevel || 'MEDIUM',
        }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Compress PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);
      const compressedSize = resultBuffer.length;

      return {
        success: true,
        data: resultBuffer.toString('base64'),
        contentType: 'application/pdf',
        originalSize,
        compressedSize,
        compressionRatio: 1 - (compressedSize / originalSize),
      };
    } catch (error) {
      logger.error('adobeCompressPdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Protect PDF with password
 */
const adobeProtectPdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input, userPassword, ownerPassword, permissions, encryptionAlgorithm } = request.data;

    if (!input) {
      throw new HttpsError('invalid-argument', 'Input file reference required');
    }

    if (!userPassword && !ownerPassword) {
      throw new HttpsError('invalid-argument', 'At least one password required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      const passwordProtection = {
        ...(userPassword && { userPassword }),
        ...(ownerPassword && { ownerPassword }),
      };

      const operationResponse = await fetch(config.protectPdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetID: assetId,
          passwordProtection,
          encryptionAlgorithm: encryptionAlgorithm || 'AES_256',
          ...(permissions && { contentToEncrypt: permissions }),
        }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Protect PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);

      return {
        success: true,
        data: resultBuffer.toString('base64'),
        contentType: 'application/pdf',
      };
    } catch (error) {
      logger.error('adobeProtectPdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Split PDF into multiple files
 */
const adobeSplitPdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input, splitType, pageCount, pageRanges, fileSizeLimit } = request.data;

    if (!input || !splitType) {
      throw new HttpsError('invalid-argument', 'Input and splitType required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      let splitOptions = {};
      switch (splitType) {
        case 'byPageCount':
          splitOptions = { pageCount: pageCount || 1 };
          break;
        case 'byPageRanges':
          splitOptions = { pageRanges };
          break;
        case 'byFileSize':
          splitOptions = { fileSizeLimit };
          break;
      }

      const operationResponse = await fetch(config.splitPdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetID: assetId,
          ...splitOptions,
        }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Split PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');

      // Poll for completion - split returns multiple files
      const startTime = Date.now();
      const maxWaitMs = 120000;
      const pollInterval = 2000;

      while (Date.now() - startTime < maxWaitMs) {
        const statusResponse = await fetch(pollingUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-api-key': config.clientId,
          },
        });

        const status = await statusResponse.json();

        if (status.status === 'done') {
          const files = [];
          const assets = status.asset || [];

          for (const asset of assets) {
            const downloadResponse = await fetch(asset.downloadUri);
            const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
            files.push({
              data: fileBuffer.toString('base64'),
              pageCount: asset.pageCount || 0,
            });
          }

          return {
            success: true,
            files,
            contentType: 'application/pdf',
          };
        }

        if (status.status === 'failed') {
          throw new HttpsError('internal', `Split failed: ${status.error?.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      throw new HttpsError('deadline-exceeded', 'Split operation timed out');
    } catch (error) {
      logger.error('adobeSplitPdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Linearize PDF for web optimization
 */
const adobeLinearizePdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input } = request.data;

    if (!input) {
      throw new HttpsError('invalid-argument', 'Input file reference required');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      const operationResponse = await fetch(config.linearizePdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assetID: assetId }),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Linearize PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);

      return {
        success: true,
        data: resultBuffer.toString('base64'),
        contentType: 'application/pdf',
      };
    } catch (error) {
      logger.error('adobeLinearizePdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Add watermark to PDF
 */
const adobeWatermarkPdf = onCall(
  { secrets: getAdobeSecrets(), ...callableOptions },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!isAdobeConfigured()) {
      throw new HttpsError('failed-precondition', 'Adobe PDF Services not configured');
    }

    const { input, type, text, image, opacity, rotation, position, pageRanges } = request.data;

    if (!input || !type) {
      throw new HttpsError('invalid-argument', 'Input and watermark type required');
    }

    if (type === 'text' && !text) {
      throw new HttpsError('invalid-argument', 'Text required for text watermark');
    }

    if (type === 'image' && !image) {
      throw new HttpsError('invalid-argument', 'Image required for image watermark');
    }

    try {
      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

      let watermarkAssetId = null;
      if (type === 'image' && image) {
        const { buffer: imgBuffer, contentType: imgContentType } = await getFileContent(image);
        watermarkAssetId = await uploadToAdobe(imgBuffer, imgContentType, accessToken);
      }

      const watermarkOptions = {
        assetID: assetId,
        watermark: {
          ...(type === 'text' && { text }),
          ...(type === 'image' && watermarkAssetId && { watermarkAssetID: watermarkAssetId }),
          opacity: opacity || 0.5,
          rotation: rotation || 0,
          appearance: {
            appearOnForeground: true,
          },
        },
        ...(pageRanges && { pageRanges }),
      };

      const operationResponse = await fetch(config.watermarkPdfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': config.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(watermarkOptions),
      });

      if (!operationResponse.ok) {
        const errorText = await operationResponse.text();
        throw new HttpsError('internal', `Watermark PDF failed: ${errorText}`);
      }

      const pollingUrl = operationResponse.headers.get('location');
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);

      return {
        success: true,
        data: resultBuffer.toString('base64'),
        contentType: 'application/pdf',
      };
    } catch (error) {
      logger.error('adobeWatermarkPdf error', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

module.exports = {
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
};
