/**
 * COGS Calculation Service
 * Calculates Cost of Goods Sold for completed Manufacturing Orders
 *
 * IFRS Compliance:
 * - Material costs: Debit COGS-Materials, Credit Inventory (IAS 2)
 * - Outsourced services: Debit COGS-Outsourced, Credit AP (separate recognition)
 * - Labour: Excluded from per-MO COGS — tracked at payroll level (IAS 19)
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Calculate COGS for a Manufacturing Order
 * Returns breakdown of material cost, outsourced cost, and total COGS
 */
async function calculateMOCOGS(moId) {
  console.log(`[COGSCalculation] Calculating COGS for MO ${moId}`);

  // 1. Fetch Manufacturing Order
  const moDoc = await db.collection('manufacturingOrders').doc(moId).get();
  if (!moDoc.exists) {
    throw new Error(`Manufacturing Order ${moId} not found`);
  }

  const mo = { id: moDoc.id, ...moDoc.data() };

  // 2. Calculate Material Cost from consumptions
  let materialCost = 0;
  const consumptionDetails = [];

  if (mo.materialConsumptions && mo.materialConsumptions.length > 0) {
    for (const consumption of mo.materialConsumptions) {
      if (consumption.totalCost !== undefined) {
        materialCost += consumption.totalCost;
        consumptionDetails.push({
          inventoryItemId: consumption.inventoryItemId,
          quantity: consumption.quantityConsumed,
          unitCost: consumption.unitCost,
          totalCost: consumption.totalCost,
        });
      } else if (consumption.unitCost !== undefined) {
        const cost = consumption.quantityConsumed * consumption.unitCost;
        materialCost += cost;
        consumptionDetails.push({
          inventoryItemId: consumption.inventoryItemId,
          quantity: consumption.quantityConsumed,
          unitCost: consumption.unitCost,
          totalCost: cost,
        });
      } else {
        console.warn(`[COGSCalculation] Material consumption ${consumption.id} missing cost data`);
      }
    }
  }

  console.log(`[COGSCalculation] Material cost: ${materialCost} from ${mo.materialConsumptions?.length || 0} consumptions`);

  // 3. Calculate Outsourced Service Costs from linked OPOs
  //
  // IMPORTANT: If an OPO has already been synced as a Bill to QBO (qboBillId exists),
  // the bill sync already posted: Debit cogsOutsourced, Credit AP.
  // Including it again in the COGS journal entry would double-count the expense
  // and create unreconciled AP balances.
  //
  // We only include outsourced costs in the JE when:
  // - The OPO has NOT been synced as a bill (no qboBillId), OR
  // - The bill was posted to a WIP/prepaid asset account (needs reclassification to COGS)
  let outsourcedCost = 0;
  const outsourcedDetails = [];

  if (mo.linkedPOIds && mo.linkedPOIds.length > 0) {
    for (const poId of mo.linkedPOIds) {
      try {
        const poDoc = await db.collection('purchaseOrders').doc(poId).get();
        if (!poDoc.exists) continue;

        const po = poDoc.data();

        // Only include outsourced POs (not standard material POs)
        if (po.purchaseOrderType !== 'outsourced') continue;

        // Only include completed/received POs
        if (!['received', 'completed', 'closed'].includes(po.status)) {
          console.log(`[COGSCalculation] Skipping OPO ${poId} — status: ${po.status}`);
          continue;
        }

        // If OPO already synced as a Bill to QBO, the expense is already recognized.
        // Skip unless it was posted to a prepaid/WIP account (needs reclassification).
        if (po.qboBillId && !po.isPrepaid) {
          console.log(`[COGSCalculation] OPO ${poId} already synced as QBO Bill ${po.qboBillId} — expense already recognized, skipping`);
          continue;
        }

        // Service fee = contractor's charge for the outsourced work
        const serviceFee = po.totalServiceFee || 0;

        // Ingredient costs are already in material consumptions (inventory),
        // so we only track the service fee as outsourced COGS
        if (serviceFee > 0) {
          outsourcedCost += serviceFee;
          outsourcedDetails.push({
            purchaseOrderId: poId,
            poNumber: po.poNumber || poId,
            supplierName: po.supplierName || 'Unknown',
            serviceFee,
            isPrepaid: !!po.isPrepaid,
            hasBill: !!po.qboBillId,
          });
        }
      } catch (err) {
        console.warn(`[COGSCalculation] Error fetching linked PO ${poId}:`, err.message);
      }
    }
  }

  console.log(`[COGSCalculation] Outsourced cost: ${outsourcedCost} from ${outsourcedDetails.length} OPOs`);

  // 4. Labour is excluded from per-MO COGS (tracked at payroll level per IAS 19)
  const laborCost = 0;
  const overheadCost = 0;

  // 5. Total COGS = material + outsourced (no labour, no overhead)
  const totalCOGS = materialCost + outsourcedCost;

  console.log(`[COGSCalculation] Total COGS for MO ${moId}: ${totalCOGS} (materials: ${materialCost}, outsourced: ${outsourcedCost})`);

  return {
    moId,
    moNumber: mo.moNumber,
    materialCost,
    outsourcedCost,
    laborCost,
    overheadCost,
    totalCOGS,
    currency: mo.currency || 'USD',
    consumptionDetails,
    outsourcedDetails,
    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Validate that all material consumptions have cost data
 */
async function validateMOCostData(moId) {
  const moDoc = await db.collection('manufacturingOrders').doc(moId).get();
  if (!moDoc.exists) {
    throw new Error(`Manufacturing Order ${moId} not found`);
  }

  const mo = { id: moDoc.id, ...moDoc.data() };
  const warnings = [];
  const errors = [];

  // Check material consumptions
  if (!mo.materialConsumptions || mo.materialConsumptions.length === 0) {
    warnings.push('No material consumptions recorded');
  } else {
    for (const consumption of mo.materialConsumptions) {
      if (!consumption.unitCost && consumption.unitCost !== 0) {
        errors.push(`Material consumption ${consumption.id} missing unitCost`);
      }
      if (!consumption.totalCost && consumption.totalCost !== 0) {
        warnings.push(`Material consumption ${consumption.id} missing totalCost (can be calculated)`);
      }
    }
  }

  // Check linked outsourced POs
  if (mo.linkedPOIds && mo.linkedPOIds.length > 0) {
    for (const poId of mo.linkedPOIds) {
      const poDoc = await db.collection('purchaseOrders').doc(poId).get();
      if (!poDoc.exists) {
        warnings.push(`Linked PO ${poId} not found`);
        continue;
      }
      const po = poDoc.data();
      if (po.purchaseOrderType === 'outsourced' && !po.totalServiceFee) {
        warnings.push(`Outsourced PO ${po.poNumber || poId} missing service fee`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get inventory valuation method
 */
function getInventoryValuationMethod() {
  return 'AVERAGE';
}

module.exports = {
  calculateMOCOGS,
  validateMOCostData,
  getInventoryValuationMethod,
};
