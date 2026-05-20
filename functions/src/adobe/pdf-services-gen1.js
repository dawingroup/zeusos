/**
 * Adobe PDF Services Cloud Functions (Gen 1 - for CORS compatibility)
 *
 * Using Gen 1 functions because Gen 2 (Cloud Run) requires public invoker
 * access for CORS preflight, which org policy prevents.
 *
 * @see https://developer.adobe.com/document-services/docs/overview/pdf-services-api/
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getAccessToken, getAdobeConfig, getAdobeSecretsV1, isAdobeConfigured } = require('./token-service');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const storage = admin.storage();

/**
 * CORS middleware - handles preflight and sets headers
 */
function handleCors(req, res) {
  const origin = req.headers.origin;

  // Check if origin is allowed
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }

  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }

  return false;
}

/**
 * Verify Firebase ID token from Authorization header
 */
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new functions.https.HttpsError('unauthenticated', 'Missing or invalid Authorization header');
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    functions.logger.error('Token verification failed:', error);
    throw new functions.https.HttpsError('unauthenticated', 'Invalid authentication token');
  }
}

/**
 * Helper to get file content from various sources
 */
async function getFileContent(fileRef) {
  const { type, value, contentType = 'application/pdf' } = fileRef;

  switch (type) {
    case 'url': {
      const response = await fetch(value);
      if (!response.ok) {
        throw new functions.https.HttpsError('invalid-argument', `Failed to fetch file from URL: ${response.status}`);
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
        throw new functions.https.HttpsError('not-found', `File not found in storage: ${value}`);
      }
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      return { buffer, contentType: metadata.contentType || contentType };
    }

    default:
      throw new functions.https.HttpsError('invalid-argument', `Unsupported file reference type: ${type}`);
  }
}

/**
 * Upload file to Adobe and get asset ID
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
    throw new functions.https.HttpsError('internal', `Failed to get upload URI: ${errorText}`);
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
    throw new functions.https.HttpsError('internal', `Failed to upload file to Adobe: ${putResponse.status}`);
  }

  return assetID;
}

/**
 * Poll for operation completion and download result
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
      throw new functions.https.HttpsError('internal', `Polling failed: ${response.status}`);
    }

    const status = await response.json();

    if (status.status === 'done') {
      const downloadUrl = status.asset?.downloadUri || status.downloadUri;
      if (!downloadUrl) {
        throw new functions.https.HttpsError('internal', 'No download URI in completed operation');
      }

      const resultResponse = await fetch(downloadUrl);
      if (!resultResponse.ok) {
        throw new functions.https.HttpsError('internal', `Failed to download result: ${resultResponse.status}`);
      }

      return Buffer.from(await resultResponse.arrayBuffer());
    }

    if (status.status === 'failed') {
      throw new functions.https.HttpsError('internal', `Operation failed: ${status.error?.message || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new functions.https.HttpsError('deadline-exceeded', 'Operation timed out');
}

// Runtime options for Gen 1 functions with secrets
const runtimeOpts = {
  timeoutSeconds: 300,
  memory: '512MB',
  secrets: getAdobeSecretsV1(),
};

/**
 * Create PDF from various file formats (Gen 1)
 */
const adobeCreatePdfGen1 = functions
  .runWith(runtimeOpts)
  .https.onRequest(async (req, res) => {
    // Handle CORS
    if (handleCors(req, res)) return;

    try {
      // Verify authentication
      await verifyAuth(req);

      if (!isAdobeConfigured()) {
        res.status(500).json({ error: 'Adobe PDF Services not configured' });
        return;
      }

      const { input, documentLanguage } = req.body.data || req.body;

      if (!input) {
        res.status(400).json({ error: 'Input file reference required' });
        return;
      }

      const accessToken = await getAccessToken();
      const config = getAdobeConfig();

      const { buffer, contentType } = await getFileContent(input);
      const assetId = await uploadToAdobe(buffer, contentType, accessToken);

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
        res.status(500).json({ error: `Create PDF failed: ${errorText}` });
        return;
      }

      const pollingUrl = operationResponse.headers.get('location');
      if (!pollingUrl) {
        res.status(500).json({ error: 'No polling URL returned' });
        return;
      }

      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);

      res.json({
        result: {
          success: true,
          data: resultBuffer.toString('base64'),
          contentType: 'application/pdf',
        }
      });
    } catch (error) {
      functions.logger.error('adobeCreatePdfGen1 error', error);
      res.status(error.httpErrorCode?.status || 500).json({
        error: error.message || 'Internal error'
      });
    }
  });

/**
 * Extract text and tables from PDF (Gen 1)
 */
const adobeExtractPdfGen1 = functions
  .runWith({ ...runtimeOpts, timeoutSeconds: 540 })
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      await verifyAuth(req);

      if (!isAdobeConfigured()) {
        res.status(500).json({ error: 'Adobe PDF Services not configured' });
        return;
      }

      const { input, elementsToExtract, tableOutputFormat, includeRenditions, includeStyling } = req.body.data || req.body;

      if (!input) {
        res.status(400).json({ error: 'Input file reference required' });
        return;
      }

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
        res.status(500).json({ error: `Extract PDF failed: ${errorText}` });
        return;
      }

      const pollingUrl = operationResponse.headers.get('location');

      // Poll for completion
      const startTime = Date.now();
      const maxWaitMs = 300000;
      const pollInterval = 3000;

      while (Date.now() - startTime < maxWaitMs) {
        const statusResponse = await fetch(pollingUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-api-key': config.clientId,
          },
        });

        if (!statusResponse.ok) {
          res.status(500).json({ error: `Polling failed: ${statusResponse.status}` });
          return;
        }

        const status = await statusResponse.json();

        if (status.status === 'done') {
          const downloadUrl = status.resource?.downloadUri;
          if (!downloadUrl) {
            res.status(500).json({ error: 'No download URI in completed extraction' });
            return;
          }

          const resultResponse = await fetch(downloadUrl);
          if (!resultResponse.ok) {
            res.status(500).json({ error: `Failed to download result: ${resultResponse.status}` });
            return;
          }

          const extractedData = await resultResponse.json();

          res.json({
            result: {
              success: true,
              data: extractedData,
            }
          });
          return;
        }

        if (status.status === 'failed') {
          res.status(500).json({ error: `Extraction failed: ${status.error?.message || 'Unknown error'}` });
          return;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      res.status(408).json({ error: 'Extraction timed out' });
    } catch (error) {
      functions.logger.error('adobeExtractPdfGen1 error', error);
      res.status(error.httpErrorCode?.status || 500).json({
        error: error.message || 'Internal error'
      });
    }
  });

/**
 * Compress PDF (Gen 1)
 */
const adobeCompressPdfGen1 = functions
  .runWith(runtimeOpts)
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      await verifyAuth(req);

      if (!isAdobeConfigured()) {
        res.status(500).json({ error: 'Adobe PDF Services not configured' });
        return;
      }

      const { input, compressionLevel } = req.body.data || req.body;

      if (!input) {
        res.status(400).json({ error: 'Input file reference required' });
        return;
      }

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
        res.status(500).json({ error: `Compress PDF failed: ${errorText}` });
        return;
      }

      const pollingUrl = operationResponse.headers.get('location');
      const resultBuffer = await pollAndDownload(pollingUrl, accessToken);
      const compressedSize = resultBuffer.length;

      res.json({
        result: {
          success: true,
          data: resultBuffer.toString('base64'),
          contentType: 'application/pdf',
          originalSize,
          compressedSize,
          compressionRatio: 1 - (compressedSize / originalSize),
        }
      });
    } catch (error) {
      functions.logger.error('adobeCompressPdfGen1 error', error);
      res.status(error.httpErrorCode?.status || 500).json({
        error: error.message || 'Internal error'
      });
    }
  });

module.exports = {
  adobeCreatePdfGen1,
  adobeExtractPdfGen1,
  adobeCompressPdfGen1,
};
