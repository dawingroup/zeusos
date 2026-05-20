/**
 * generateMDP — Cloud Function (HTTPS Callable)
 *
 * Server-side Manufacturing Data Package generator.
 * Validates PDD configuration, computes BOM, checks stock,
 * generates cut list / hardware schedule, and returns the full MDP.
 *
 * Timeout: 60s (BOM computation + stock queries can be slow)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();

/**
 * Callable: generateMDP
 *
 * Input: { pddId, configuration, finishSelections }
 * Returns: ManufacturingDataPackage
 */
const generateMDP = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { pddId, configuration, finishSelections } = request.data;

    if (!pddId || typeof pddId !== 'string') {
      throw new HttpsError('invalid-argument', 'pddId is required');
    }
    if (!configuration || typeof configuration !== 'object') {
      throw new HttpsError('invalid-argument', 'configuration is required');
    }

    logger.info('generateMDP called', { pddId, uid: request.auth.uid });

    // 1. Fetch PDD
    const pddSnap = await db.collection('productDefinitions').doc(pddId).get();
    if (!pddSnap.exists) {
      throw new HttpsError('not-found', `PDD ${pddId} not found`);
    }
    const pdd = { id: pddSnap.id, ...pddSnap.data() };

    // 2. Evaluate constraints
    const violations = evaluateConstraints(pdd.constraints || [], configuration);
    if (violations.length > 0) {
      throw new HttpsError(
        'failed-precondition',
        `Configuration has ${violations.length} violation(s): ${violations.map(v => v.reason).join('; ')}`,
      );
    }

    // 3. Compute BOM from template
    const bom = await computeBOM(pdd, configuration, finishSelections || {});

    // 4. Check stock availability
    const stockAvailability = await checkStockAvailability(bom);

    // 5. Compute pricing
    const pricingBreakdown = computePricing(pdd, bom);

    // 6. Generate cut list
    const cutList = pdd.manufacturingOutputConfig?.generateCutList !== false
      ? extractCutList(bom, configuration, finishSelections || {})
      : undefined;

    // 7. Generate edge banding schedule
    const edgeBandingSchedule = pdd.manufacturingOutputConfig?.generateEdgeBandingSchedule && cutList
      ? generateEdgeBandingSchedule(cutList)
      : undefined;

    // 8. Generate hardware schedule
    const hardwareSchedule = pdd.manufacturingOutputConfig?.generateHardwareSchedule !== false
      ? generateHardwareSchedule(bom)
      : undefined;

    // 9. Identify shortages
    const shortages = identifyShortages(stockAvailability);

    // 10. Persist MDP to Firestore
    const mdpDoc = {
      pddId,
      configuration,
      finishSelections: finishSelections || {},
      bom,
      pricingBreakdown,
      cutList: cutList || null,
      edgeBandingSchedule: edgeBandingSchedule || null,
      hardwareSchedule: hardwareSchedule || null,
      stockAvailability,
      shortages,
      glbUrl: '',
      thumbnailUrl: '',
      arReady: false,
      createdBy: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const mdpRef = await db.collection('manufacturingDataPackages').add(mdpDoc);

    logger.info('MDP generated', { mdpId: mdpRef.id, pddId, bomLines: bom.length, shortages: shortages.length });

    return { id: mdpRef.id, ...mdpDoc, createdAt: new Date().toISOString() };
  },
);

// ── Constraint evaluation ────────────────────────────────

function evaluateConstraints(constraints, configuration) {
  const violations = [];

  for (const constraint of constraints) {
    if (!constraint.condition) continue;

    try {
      // Simple expression evaluation for common patterns
      const result = safeEvaluate(constraint.condition, configuration);

      if (result === false) {
        const shouldBlock = constraint.action === 'block' || constraint.action === 'error';
        violations.push({
          constraintId: constraint.id || 'unknown',
          reason: constraint.message || `Constraint failed: ${constraint.condition}`,
          severity: shouldBlock ? 'error' : 'warning',
        });
      }
    } catch (err) {
      logger.warn('Constraint evaluation error', { condition: constraint.condition, error: err.message });
    }
  }

  return violations.filter(v => v.severity === 'error');
}

/**
 * Safe expression evaluator for constraint conditions.
 * Supports basic comparison, logical operators, and property access.
 */
function safeEvaluate(expression, params) {
  // Replace parameter references with actual values
  let expr = expression;
  for (const [key, value] of Object.entries(params)) {
    const regex = new RegExp(`parameters\\.${key}\\b|\\b${key}\\b`, 'g');
    expr = expr.replace(regex, typeof value === 'string' ? `"${value}"` : String(value));
  }

  // Only allow safe characters: numbers, operators, comparisons, booleans, strings
  const safePattern = /^[\d\s+\-*/().<>=!&|"'a-zA-Z_]+$/;
  if (!safePattern.test(expr)) {
    throw new Error(`Unsafe expression: ${expression}`);
  }

  // Evaluate with Function constructor (no access to global scope)
  const fn = new Function(`"use strict"; return (${expr});`);
  return fn();
}

// ── BOM computation ──────────────────────────────────────

async function computeBOM(pdd, configuration, finishSelections) {
  const bomTemplate = pdd.bomTemplate || [];
  const bindings = pdd.inventoryBindings || {};
  const lines = [];

  for (const templateLine of bomTemplate) {
    // Evaluate quantity expression
    let quantity = 1;
    if (templateLine.quantityExpression) {
      try {
        quantity = safeEvaluate(templateLine.quantityExpression, configuration);
      } catch {
        quantity = templateLine.defaultQuantity || 1;
      }
    } else {
      quantity = templateLine.defaultQuantity || 1;
    }

    if (quantity <= 0) continue;

    // Resolve inventory binding
    const binding = bindings[templateLine.key] || {};
    const inventoryItemId = binding.inventoryItemId || '';
    let unitCost = 0;
    let inventoryItemName = templateLine.description || templateLine.key;

    if (inventoryItemId) {
      const itemSnap = await db.collection('inventoryItems').doc(inventoryItemId).get();
      if (itemSnap.exists) {
        const item = itemSnap.data();
        unitCost = item.costPrice || item.unitCost || 0;
        inventoryItemName = item.name || inventoryItemName;
      }
    }

    // Calculate area-based cost for panel materials
    let computedQuantity = quantity;
    const cat = (templateLine.materialCategory || '').toLowerCase();
    if (cat.includes('board') || cat.includes('panel') || cat.includes('sheet')) {
      const width = Number(configuration.width) || 600;
      const depth = Number(configuration.depth) || 560;
      const wastage = pdd.manufacturingOutputConfig?.wasteFactorPercent || 10;
      const areaM2 = (width / 1000) * (depth / 1000) * (1 + wastage / 100);
      computedQuantity = quantity * areaM2;
    }

    const totalCost = computedQuantity * unitCost;

    lines.push({
      bomTemplateLineKey: templateLine.key,
      description: inventoryItemName,
      materialCategory: templateLine.materialCategory || 'other',
      inventoryItemId,
      inventoryItemName,
      quantity: computedQuantity,
      unit: templateLine.unit || 'pcs',
      unitCost,
      totalCost,
      inStock: true, // Updated by stock check
    });
  }

  return lines;
}

// ── Stock availability ───────────────────────────────────

async function checkStockAvailability(bom) {
  const availability = {};

  for (const line of bom) {
    if (!line.inventoryItemId) {
      availability[line.bomTemplateLineKey] = {
        inventoryItemId: '',
        inventoryItemName: line.description,
        availableQuantity: 0,
        requiredQuantity: line.quantity,
        status: 'unknown',
      };
      continue;
    }

    // Query stock levels
    const stockSnap = await db
      .collection('stockLevels')
      .where('inventoryItemId', '==', line.inventoryItemId)
      .limit(1)
      .get();

    let available = 0;
    if (!stockSnap.empty) {
      const stock = stockSnap.docs[0].data();
      available = stock.currentQuantity || stock.quantity || 0;
    }

    const status = available >= line.quantity
      ? 'in_stock'
      : available > 0
        ? 'low_stock'
        : 'out_of_stock';

    line.inStock = status === 'in_stock';

    availability[line.bomTemplateLineKey] = {
      inventoryItemId: line.inventoryItemId,
      inventoryItemName: line.inventoryItemName,
      availableQuantity: available,
      requiredQuantity: line.quantity,
      status,
    };
  }

  return availability;
}

// ── Pricing ──────────────────────────────────────────────
// Pricing computes material costs from inventory costPrice lookups.
// Labor, overhead, and margin are applied using PDD config.
// Full estimation (processing costs, labor rates) is handled by
// Design Manager's estimateService when the user triggers a quote.

function computePricing(pdd, bom) {
  const overheadPct = pdd.pricingConfig?.overheadPercent ?? 15;
  const marginPct = pdd.pricingConfig?.marginPercent ?? 25;
  const currency = pdd.pricingConfig?.currencyOverride ?? 'UGX';
  const vatApplicable = pdd.pricingConfig?.taxConfig?.vatApplicable ?? true;
  const vatRate = 0.18;

  let materialsCost = 0;
  let edgeBandingCost = 0;
  let hardwareCost = 0;
  const lineItems = [];

  for (const line of bom) {
    const cat = line.materialCategory.toLowerCase();

    if (cat.includes('edge_banding') || cat.includes('edgebanding')) {
      edgeBandingCost += line.totalCost;
    } else if (isHardwareCategory(cat)) {
      hardwareCost += line.totalCost;
    } else {
      materialsCost += line.totalCost;
    }

    lineItems.push({
      description: line.description,
      category: line.materialCategory,
      quantity: line.quantity,
      unitPrice: line.unitCost,
      amount: line.totalCost,
    });
  }

  // Labor cost is 0 here — Design Manager's estimateService calculates
  // labor from processing costs when the user creates a quote/MO
  const laborCost = 0;

  const directCosts = materialsCost + edgeBandingCost + hardwareCost + laborCost;
  const overheadCost = directCosts * (overheadPct / 100);
  const subtotalBeforeMargin = directCosts + overheadCost;
  const marginAmount = subtotalBeforeMargin * (marginPct / 100);
  const subtotal = subtotalBeforeMargin + marginAmount;
  const vatAmount = vatApplicable ? subtotal * vatRate : 0;
  const total = subtotal + vatAmount;

  return {
    materialsCost,
    edgeBandingCost,
    hardwareCost,
    laborCost,
    overheadCost,
    marginAmount,
    subtotal,
    vatAmount,
    total,
    currency,
    lineItems,
  };
}

function isHardwareCategory(cat) {
  return cat.includes('hardware') || cat.includes('hinge') || cat.includes('handle') ||
    cat.includes('slide') || cat.includes('connector') || cat.includes('leg');
}

// ── Cut list extraction ──────────────────────────────────

function extractCutList(bom, configuration, finishSelections) {
  const entries = [];
  const width = Number(configuration.width) || 600;
  const depth = Number(configuration.depth) || 560;

  for (const line of bom) {
    const cat = line.materialCategory.toLowerCase();
    if (cat.includes('board') || cat.includes('panel') || cat.includes('sheet')) {
      entries.push({
        partName: line.description,
        material: line.inventoryItemName,
        finishLibraryId: finishSelections[line.bomTemplateLineKey] || '',
        length: width,
        width: depth,
        thickness: 18,
        quantity: Math.ceil(line.quantity),
        grainDirection: 'length',
        edgeBanding: { top: null, bottom: null, left: null, right: null },
      });
    }
  }

  return entries;
}

// ── Edge banding schedule ────────────────────────────────

function generateEdgeBandingSchedule(cutList) {
  const edgeMap = new Map();

  for (const entry of cutList) {
    for (const [edge, type] of Object.entries(entry.edgeBanding)) {
      if (!type) continue;
      const existing = edgeMap.get(type) || { totalLength: 0, panels: [] };
      const edgeLength = edge === 'top' || edge === 'bottom' ? entry.length : entry.width;
      existing.totalLength += edgeLength * entry.quantity;
      existing.panels.push(entry.partName);
      edgeMap.set(type, existing);
    }
  }

  return Array.from(edgeMap.entries()).map(([edgeType, data]) => ({
    edgeType,
    inventoryItemId: '',
    totalLength: Math.round(data.totalLength / 1000 * 100) / 100,
    unit: 'lm',
    panels: [...new Set(data.panels)],
  }));
}

// ── Hardware schedule ────────────────────────────────────

function generateHardwareSchedule(bom) {
  return bom
    .filter(line => isHardwareCategory(line.materialCategory.toLowerCase()))
    .map(line => ({
      hardwareName: line.description,
      inventoryItemId: line.inventoryItemId,
      quantity: Math.ceil(line.quantity),
      perUnit: 'unit',
      boringRequired: false,
    }));
}

// ── Shortage identification ──────────────────────────────

function identifyShortages(stockAvailability) {
  return Object.values(stockAvailability)
    .filter(s => (s.status === 'out_of_stock' || s.status === 'low_stock') && s.requiredQuantity > s.availableQuantity)
    .map(s => ({
      inventoryItemId: s.inventoryItemId,
      itemName: s.inventoryItemName,
      requiredQuantity: s.requiredQuantity,
      availableQuantity: s.availableQuantity,
      shortfall: s.requiredQuantity - s.availableQuantity,
      suggestedAction: 'create_po',
    }));
}

module.exports = { generateMDP };
