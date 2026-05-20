/**
 * generateParametric — Cloud Function
 *
 * Generates a 3D furniture model from a template + parameters using Tripo text-to-model.
 * Builds a descriptive prompt from the template metadata and user parameters,
 * submits to Tripo API, polls for completion, stores GLB + thumbnail,
 * and evaluates the BOM template with parameter values.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');
const crypto = require('crypto');
const { ALLOWED_ORIGINS } = require('../config/cors');

const TRIPO_API_KEY = defineSecret('TRIPO_API_KEY');

const TRIPO_API_BASE = 'https://api.tripo3d.ai/v2/openapi';
const TRIPO_MODEL_VERSION = 'v2.5-20250123';
const DEFAULT_FACE_LIMIT = 10000;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60;

/**
 * Build a descriptive text prompt from template + parameters for Tripo text-to-model.
 */
function buildPromptFromTemplate(template, parameters) {
  const parts = [];

  // Base description from template
  parts.push(`A detailed 3D model of a ${template.name.toLowerCase()}.`);

  if (template.description) {
    parts.push(template.description);
  }

  // Add dimension parameters
  const dimParts = [];
  for (const paramDef of template.parameters || []) {
    const value = parameters[paramDef.key] ?? paramDef.default;
    if (paramDef.type === 'number' && paramDef.unit === 'mm') {
      dimParts.push(`${paramDef.label}: ${value}mm`);
    } else if (paramDef.type === 'select') {
      const option = paramDef.options?.find(o => String(o.value) === String(value));
      if (option) {
        dimParts.push(`${paramDef.label}: ${option.label}`);
      }
    } else if (paramDef.type === 'boolean' && value) {
      dimParts.push(`With ${paramDef.label.toLowerCase()}`);
    }
  }

  if (dimParts.length > 0) {
    parts.push(`Specifications: ${dimParts.join(', ')}.`);
  }

  // Category-specific style hints
  const categoryHints = {
    seating: 'Modern upholstered furniture with realistic proportions and fabric textures.',
    casegoods: 'Clean cabinet furniture with wood grain textures and precise joinery details.',
    tables: 'Furniture with clean lines, realistic wood or metal textures.',
    beds: 'Bedroom furniture with realistic fabric and wood textures.',
    fitout: 'Built-in joinery with precise dimensions and clean edges.',
    custom: 'Detailed furniture piece with realistic materials and proportions.',
  };

  if (categoryHints[template.category]) {
    parts.push(categoryHints[template.category]);
  }

  parts.push('High quality, photorealistic, product visualization style.');

  return parts.join(' ');
}

/**
 * Evaluate BOM template expressions with parameter values.
 * Supports simple math expressions with parameter references.
 */
function evaluateBomTemplate(bomTemplate, parameters, template) {
  if (!bomTemplate || !Array.isArray(bomTemplate)) return [];

  // Build a context object with all parameter values
  const ctx = {};
  for (const paramDef of template.parameters || []) {
    const val = parameters[paramDef.key] ?? paramDef.default;
    ctx[paramDef.key] = typeof val === 'string' ? parseFloat(val) || 0 : (val || 0);
  }

  // Pre-compute common derived values
  const w = (ctx.width || ctx.overall_width || 0) / 1000; // mm → m
  const d = (ctx.depth || ctx.seat_depth || 0) / 1000;
  const h = (ctx.height || ctx.seat_height || 0) / 1000;

  ctx.carcase_area = 2 * (w * h + d * h + w * d); // approx m²
  ctx.door_area = w * h * (ctx.door_count || 1);
  ctx.top_area = w * d;
  ctx.frame_volume = w * d * h * 0.1; // ~10% of bounding volume for frame
  ctx.seat_count = ctx.seat_count ? parseFloat(ctx.seat_count) || 3 : 3;
  ctx.door_count = ctx.door_count ? parseFloat(ctx.door_count) || 1 : 1;
  ctx.drawer_count = ctx.drawer_count || 0;
  ctx.shelf_count = ctx.shelf_count || 0;

  return bomTemplate.map((line) => {
    let quantity = 0;
    try {
      // Safe evaluation: replace known variable names with values
      let expr = line.quantityExpression;
      // Sort keys by length descending to avoid partial replacement
      const sortedKeys = Object.keys(ctx).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(ctx[key]));
      }
      // Only allow numbers, operators, parentheses, and spaces
      if (/^[\d\s+\-*/().]+$/.test(expr)) {
        quantity = Function(`"use strict"; return (${expr})`)();
      }
    } catch {
      quantity = 0;
    }

    return {
      materialCategory: line.materialCategory,
      quantity: Math.round(quantity * 100) / 100,
      unit: line.unit,
      isVariantDriven: line.isVariantDriven,
      finishAttributeKey: line.finishAttributeKey || null,
    };
  });
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
        console.warn(`[generateParametric] Poll attempt ${attempt} got ${httpStatus}, retrying (${consecutiveErrors}/5)...`);
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
      const modelUrl = data.output?.model?.url || data.output?.model || data.output?.pbr_model?.url || data.output?.pbr_model;
      const renderedImageUrl = data.output?.rendered_image?.url || data.output?.rendered_image;
      return { status: 'success', modelUrl, renderedImageUrl, progress: 100 };
    }

    if (status === 'failed' || status === 'cancelled') {
      throw new Error(`Tripo task ${status}: ${data.message || 'No details'}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('Tripo task timed out after max poll attempts');
}

/**
 * Download a file from URL and upload to Firebase Storage with download token.
 */
async function downloadAndStore(url, storagePath) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);

  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const contentType = storagePath.endsWith('.glb') ? 'model/gltf-binary' : 'image/png';

  const downloadToken = crypto.randomUUID();
  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  const bucketName = bucket.name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
}

exports.generateParametric = onCall(
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

    const { templateId, parameters, finishSelections, subsidiaryId = 'dawin-finishes' } = request.data;

    if (!templateId) {
      throw new HttpsError('invalid-argument', 'templateId is required');
    }
    if (!parameters || typeof parameters !== 'object') {
      throw new HttpsError('invalid-argument', 'parameters object is required');
    }

    // Fetch template from Firestore
    const db = getFirestore();
    const templateSnap = await db.doc(`furnitureTemplates/${templateId}`).get();
    if (!templateSnap.exists) {
      throw new HttpsError('not-found', `Template ${templateId} not found`);
    }

    const template = templateSnap.data();

    // Validate parameters against template definitions
    for (const paramDef of template.parameters || []) {
      const value = parameters[paramDef.key];
      if (value === undefined && paramDef.default === undefined) {
        throw new HttpsError('invalid-argument', `Missing required parameter: ${paramDef.key}`);
      }
      if (paramDef.type === 'number' && typeof value === 'number') {
        if (paramDef.min !== undefined && value < paramDef.min) {
          throw new HttpsError('invalid-argument', `${paramDef.key} must be >= ${paramDef.min}`);
        }
        if (paramDef.max !== undefined && value > paramDef.max) {
          throw new HttpsError('invalid-argument', `${paramDef.key} must be <= ${paramDef.max}`);
        }
      }
    }

    const apiKey = (TRIPO_API_KEY.value() || '').trim();
    if (!apiKey) {
      throw new HttpsError('internal', 'Tripo API key not configured');
    }

    try {
      // Build prompt from template + parameters
      const prompt = buildPromptFromTemplate(template, parameters);
      console.log(`[generateParametric] Prompt: ${prompt.substring(0, 200)}...`);

      // Submit to Tripo text-to-model
      const taskId = await submitTextToModelTask(apiKey, prompt, {
        faceLimit: DEFAULT_FACE_LIMIT,
      });
      console.log(`[generateParametric] Tripo task submitted: ${taskId}`);

      // Poll for completion
      const result = await pollTask(apiKey, taskId);

      // Download GLB and store in Firebase Storage
      const timestamp = Date.now();
      const basePath = `workshop-viewer/parametric/${request.auth.uid}/${timestamp}`;
      const glbUrl = await downloadAndStore(result.modelUrl, `${basePath}.glb`);

      // Store thumbnail if available
      let thumbnailUrl = null;
      if (result.renderedImageUrl) {
        thumbnailUrl = await downloadAndStore(result.renderedImageUrl, `${basePath}_thumb.png`);
      }

      // Evaluate BOM template
      const bom = evaluateBomTemplate(template.bomTemplate, parameters, template);

      // Compute dimensions from parameters
      const dims = {
        width: parameters.width || parameters.overall_width || 0,
        depth: parameters.depth || parameters.seat_depth || 0,
        height: parameters.height || parameters.back_height || parameters.seat_height || 0,
      };

      // Track credit usage
      await db.doc(`creditUsage/${subsidiaryId}`).set(
        {
          totalCredits: FieldValue.increment(30),
          lastUsedAt: FieldValue.serverTimestamp(),
          monthlyUsage: {
            [new Date().toISOString().slice(0, 7)]: FieldValue.increment(30),
          },
        },
        { merge: true },
      );

      return {
        success: true,
        data: {
          taskId,
          glbUrl,
          glbStoragePath: `${basePath}.glb`,
          thumbnailUrl,
          overallDimensions: dims,
          bom,
          templateName: template.name,
          prompt,
        },
      };
    } catch (error) {
      console.error('[generateParametric] Error:', error.message);
      throw new HttpsError('internal', `Parametric generation failed: ${error.message}`);
    }
  },
);
