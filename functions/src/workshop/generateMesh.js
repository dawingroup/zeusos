/**
 * generateMesh — Cloud Function
 *
 * Proxies image-to-3D generation via the Tripo API v2.
 * Accepts an image (Firebase Storage path), submits to Tripo,
 * polls for completion, downloads the GLB result, and stores it
 * in Firebase Storage.
 *
 * Also tracks credit usage per subsidiary in Firestore.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');
const { ALLOWED_ORIGINS } = require('../config/cors');

const TRIPO_API_KEY = defineSecret('TRIPO_API_KEY');

const TRIPO_API_BASE = 'https://api.tripo3d.ai/v2/openapi';
const TRIPO_MODEL_VERSION = 'v2.5-20250123';
const DEFAULT_FACE_LIMIT = 10000;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60; // 3 minutes max

const FormData = require('form-data');

/**
 * Upload an image to Tripo API and get an image token.
 */
async function uploadImageToTripo(apiKey, imageBuffer, contentType) {
  const form = new FormData();
  form.append('file', imageBuffer, {
    filename: 'reference.jpg',
    contentType: contentType || 'image/jpeg',
  });

  const uploadUrl = `${TRIPO_API_BASE}/upload`;
  console.log(`[generateMesh] Uploading image to Tripo: ${uploadUrl} (${imageBuffer.length} bytes)`);

  const response = await axios.post(uploadUrl, form, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    maxContentLength: 20 * 1024 * 1024,
  });

  if (response.data.code !== 0) {
    throw new Error(`Tripo upload failed: ${response.data.message || 'Unknown error'}`);
  }

  return response.data.data.image_token;
}

/**
 * Submit an image-to-model task to Tripo API.
 */
async function submitImageToModelTask(apiKey, imageToken, options = {}) {
  const response = await axios.post(
    `${TRIPO_API_BASE}/task`,
    {
      type: 'image_to_model',
      file: { type: 'image_token', file_token: imageToken },
      model_version: TRIPO_MODEL_VERSION,
      face_limit: options.faceLimit || DEFAULT_FACE_LIMIT,
      texture: true,
      pbr: true,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (response.data.code !== 0) {
    throw new Error(`Tripo task submission failed: ${response.data.message || 'Unknown error'}`);
  }

  return response.data.data.task_id;
}

/**
 * Submit a text-to-model task to Tripo API.
 */
async function submitTextToModelTask(apiKey, prompt, options = {}) {
  const response = await axios.post(
    `${TRIPO_API_BASE}/task`,
    {
      type: 'text_to_model',
      prompt,
      model_version: TRIPO_MODEL_VERSION,
      face_limit: options.faceLimit || DEFAULT_FACE_LIMIT,
      texture: true,
      pbr: true,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (response.data.code !== 0) {
    throw new Error(`Tripo task submission failed: ${response.data.message || 'Unknown error'}`);
  }

  return response.data.data.task_id;
}

/**
 * Poll a Tripo task until completion or failure.
 */
async function pollTask(apiKey, taskId) {
  let consecutiveErrors = 0;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await axios.get(`${TRIPO_API_BASE}/task/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      consecutiveErrors = 0;
    } catch (err) {
      const httpStatus = err.response?.status;
      if (httpStatus >= 500 && httpStatus < 600) {
        consecutiveErrors++;
        console.warn(`[generateMesh] Poll attempt ${attempt} got ${httpStatus}, retrying (${consecutiveErrors}/5)...`);
        if (consecutiveErrors >= 5) {
          throw new Error(`Tripo API returned ${httpStatus} on 5 consecutive poll attempts`);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 2));
        continue;
      }
      throw err;
    }

    const data = response.data.data;
    const status = data.status;

    if (status === 'success') {
      console.log(`[generateMesh] Task complete. Output keys: ${JSON.stringify(Object.keys(data.output || {}))}`);
      console.log(`[generateMesh] Full output: ${JSON.stringify(data.output).substring(0, 500)}`);
      const modelUrl = data.output?.model?.url || data.output?.model || data.output?.pbr_model?.url || data.output?.pbr_model;
      const renderedImageUrl = data.output?.rendered_image?.url || data.output?.rendered_image;
      return {
        status: 'success',
        modelUrl,
        renderedImageUrl,
        progress: 100,
      };
    }

    if (status === 'failed' || status === 'cancelled') {
      throw new Error(`Tripo task ${status}: ${data.message || 'No details'}`);
    }

    // Still running — wait and retry
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('Tripo task timed out after max poll attempts');
}

/**
 * Download a file from URL and upload to Firebase Storage.
 * Returns a Firebase download URL with an embedded download token.
 */
async function downloadAndStore(url, storagePath) {
  const crypto = require('crypto');
  console.log(`[generateMesh] Downloading from Tripo: ${url?.substring(0, 80)}...`);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  console.log(`[generateMesh] Downloaded ${buffer.length} bytes, storing at: ${storagePath}`);

  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const contentType = storagePath.endsWith('.glb') ? 'model/gltf-binary' : 'image/png';

  // Set a download token so the URL works without Firebase auth
  const downloadToken = crypto.randomUUID();
  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  const bucketName = bucket.name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
}

/**
 * Track credit usage per subsidiary.
 */
async function trackCredits(subsidiaryId, creditsUsed) {
  const db = getFirestore();
  const ref = db.doc(`creditUsage/${subsidiaryId}`);
  await ref.set(
    {
      totalCredits: FieldValue.increment(creditsUsed),
      lastUsedAt: FieldValue.serverTimestamp(),
      monthlyUsage: {
        [new Date().toISOString().slice(0, 7)]: FieldValue.increment(creditsUsed),
      },
    },
    { merge: true },
  );
}

exports.generateMesh = onCall(
  {
    secrets: [TRIPO_API_KEY],
    timeoutSeconds: 300,
    memory: '512MiB',
    region: 'us-central1',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const {
      mode = 'image', // 'image' or 'text'
      imageStoragePath,
      textPrompt,
      overallDimensions, // { width, depth, height } in mm
      faceLimit,
      subsidiaryId = 'dawin-finishes',
    } = request.data;

    const apiKey = (TRIPO_API_KEY.value() || '').trim();
    if (!apiKey) {
      throw new HttpsError('internal', 'Tripo API key not configured');
    }

    try {
      let taskId;

      if (mode === 'image') {
        if (!imageStoragePath) {
          throw new HttpsError('invalid-argument', 'imageStoragePath required for image mode');
        }

        // Download image from Firebase Storage
        console.log(`[generateMesh] Downloading image from Storage: ${imageStoragePath}`);
        const bucket = getStorage().bucket();
        const file = bucket.file(imageStoragePath);
        const [exists] = await file.exists();
        if (!exists) {
          throw new HttpsError('not-found', `Image not found at path: ${imageStoragePath}`);
        }
        const [imageBuffer] = await file.download();
        console.log(`[generateMesh] Image downloaded: ${imageBuffer.length} bytes`);
        const contentType = imageStoragePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

        // Upload to Tripo and submit task
        const imageToken = await uploadImageToTripo(apiKey, imageBuffer, contentType);
        console.log(`[generateMesh] Tripo image token received: ${imageToken?.substring(0, 20)}...`);
        taskId = await submitImageToModelTask(apiKey, imageToken, { faceLimit });
        console.log(`[generateMesh] Tripo task submitted: ${taskId}`);
      } else if (mode === 'text') {
        if (!textPrompt) {
          throw new HttpsError('invalid-argument', 'textPrompt required for text mode');
        }
        taskId = await submitTextToModelTask(apiKey, textPrompt, { faceLimit });
      } else {
        throw new HttpsError('invalid-argument', `Invalid mode: ${mode}`);
      }

      // Poll for completion
      const result = await pollTask(apiKey, taskId);

      // Download GLB and store in Firebase Storage
      const timestamp = Date.now();
      const glbPath = `workshop-viewer/generated/${request.auth.uid}/${timestamp}.glb`;
      const glbUrl = await downloadAndStore(result.modelUrl, glbPath);

      // Store thumbnail if available
      let thumbnailUrl = null;
      if (result.renderedImageUrl) {
        const thumbPath = `workshop-viewer/generated/${request.auth.uid}/${timestamp}_thumb.png`;
        thumbnailUrl = await downloadAndStore(result.renderedImageUrl, thumbPath);
      }

      // Track credit usage (estimated 30 credits per generation)
      await trackCredits(subsidiaryId, 30);

      return {
        success: true,
        data: {
          taskId,
          glbUrl,
          glbStoragePath: glbPath,
          thumbnailUrl,
          overallDimensions: overallDimensions || null,
        },
      };
    } catch (error) {
      console.error('[generateMesh] Error:', error.message);
      throw new HttpsError('internal', `Mesh generation failed: ${error.message}`);
    }
  },
);
