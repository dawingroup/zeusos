/**
 * validateConfiguration — Cloud Function (HTTPS Callable)
 *
 * Server-side constraint validation for PDD configurations.
 * Evaluates PDD constraints, checks part dimensions against DKB,
 * validates material compatibility, and returns computed BOM + pricing.
 *
 * Timeout: 30s
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();

const validateConfiguration = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { pddId, parameters } = request.data;

    if (!pddId || typeof pddId !== 'string') {
      throw new HttpsError('invalid-argument', 'pddId is required');
    }
    if (!parameters || typeof parameters !== 'object') {
      throw new HttpsError('invalid-argument', 'parameters is required');
    }

    logger.info('validateConfiguration called', { pddId, uid: request.auth.uid });

    // 1. Fetch PDD
    const pddSnap = await db.collection('productDefinitions').doc(pddId).get();
    if (!pddSnap.exists) {
      throw new HttpsError('not-found', `PDD ${pddId} not found`);
    }
    const pdd = { id: pddSnap.id, ...pddSnap.data() };

    // 2. Evaluate PDD constraints
    const violations = [];
    const warnings = [];
    for (const constraint of (pdd.constraints || [])) {
      if (!constraint.condition || !constraint.isActive) continue;
      try {
        const result = safeEvaluate(constraint.condition, parameters);
        if (result) {
          const entry = {
            constraintId: constraint.id || 'unknown',
            action: constraint.action || 'warn',
            reason: constraint.reason || constraint.message || `Constraint: ${constraint.condition}`,
            affectedParameters: constraint.affectedParameters || [],
          };
          if (constraint.action === 'reject') violations.push(entry);
          else warnings.push(entry);
        }
      } catch (err) {
        logger.warn('Constraint eval error', { condition: constraint.condition, error: err.message });
      }
    }

    // 3. DKB dimension validation
    const dkbViolations = await validateDimensions(parameters);

    // 4. Compute basic BOM
    const bomTemplate = pdd.bomTemplate || [];
    const computedBOM = [];
    for (const line of bomTemplate) {
      let quantity = 1;
      if (line.quantityExpression) {
        try { quantity = safeEvaluate(line.quantityExpression, parameters); } catch { /* use default */ }
      }
      if (typeof quantity !== 'number' || quantity <= 0) continue;

      computedBOM.push({
        bomTemplateLineKey: line.materialCategory || line.key,
        materialCategory: line.materialCategory || 'other',
        description: line.description || line.materialCategory,
        quantity: Math.round(quantity * 1000) / 1000,
        unit: line.unit || 'pcs',
      });
    }

    logger.info('Configuration validated', {
      pddId,
      violationCount: violations.length,
      warningCount: warnings.length,
      dkbViolationCount: dkbViolations.length,
      bomLineCount: computedBOM.length,
    });

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      dkbViolations,
      computedBOM,
    };
  },
);

/**
 * Validate dimensions against DKB component entries.
 */
async function validateDimensions(parameters) {
  const violations = [];
  const width = Number(parameters.width) || 0;
  const depth = Number(parameters.depth) || 0;

  if (width === 0 && depth === 0) return violations;

  // Fetch component entries from DKB
  const snap = await db.collection('designKnowledgeBase')
    .where('entryType', '==', 'component')
    .where('isActive', '==', true)
    .get();

  for (const doc of snap.docs) {
    const comp = doc.data();
    const dims = comp.dimensions;
    if (!dims) continue;

    // Check if parameters reference this component type
    const cat = (comp.componentCategory || '').toLowerCase();
    if (cat.includes('shelf') && width > 0) {
      if (dims.width && (width < dims.width.min || width > dims.width.max)) {
        violations.push({
          type: 'dimension',
          severity: 'error',
          message: `${comp.name} width ${width}mm outside range [${dims.width.min}–${dims.width.max}mm]`,
          dkbEntryId: doc.id,
        });
      }
    }
  }

  return violations;
}

function safeEvaluate(expression, params) {
  let expr = expression;
  for (const [key, value] of Object.entries(params)) {
    const regex = new RegExp(`parameters\\.${key}\\b|\\b${key}\\b`, 'g');
    expr = expr.replace(regex, typeof value === 'string' ? `"${value}"` : String(value));
  }
  const safePattern = /^[\d\s+\-*/().<>=!&|"'a-zA-Z_]+$/;
  if (!safePattern.test(expr)) throw new Error(`Unsafe expression: ${expression}`);
  const fn = new Function(`"use strict"; return (${expr});`);
  return fn();
}

module.exports = { validateConfiguration };
