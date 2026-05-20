/**
 * MDP Generator Service
 *
 * Generates Manufacturing Data Packages from validated PDD configurations.
 * Persists MDPs to Firestore. MO/PO/Quote creation is delegated to Design Manager.
 *
 * Architectural principle: Design Studio generates the MDP (BOM, cut list,
 * hardware schedule, shortage alerts). Design Manager handles MO handoff,
 * quote creation, and procurement via its own services:
 *   - releaseToProduction() for MO creation
 *   - createClientQuote() for quotes
 *   - Procurement workflow for PO creation
 */
import { Timestamp, addDoc, collection, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { validateConfiguration } from './constraintEngine.service';
import { getPDD } from './pdd.service';
import type { ProductDefinitionDocument } from '../types/productDefinition.types';
import type {
  ManufacturingDataPackage,
  CutListEntry,
  EdgeBandingEntry,
  HardwareScheduleEntry,
  ShortageAlert,
} from '../types/mdp.types';
import type { ComputedBOMLine, StockStatus } from '../types/constraintEngine.types';

const MDP_COLLECTION = 'manufacturingDataPackages';

/**
 * Generate a complete Manufacturing Data Package.
 */
export async function generateMDP(
  pddId: string,
  configuration: Record<string, unknown>,
  finishSelections: Record<string, string>,
): Promise<ManufacturingDataPackage> {
  // 1. Validate configuration
  const validation = await validateConfiguration({ pddId, configuration, finishSelections });
  if (!validation.valid) {
    throw new Error(
      `Configuration has ${validation.violations.length} violation(s): ${validation.violations.map(v => v.reason).join('; ')}`
    );
  }

  const pdd = await getPDD(pddId);
  if (!pdd) throw new Error(`PDD ${pddId} not found`);

  // 2. Extract cut list from BOM
  const cutList = pdd.manufacturingOutputConfig.generateCutList
    ? extractCutList(validation.computedBOM, pdd, configuration, finishSelections)
    : undefined;

  // 3. Generate edge banding schedule
  const edgeBandingSchedule = pdd.manufacturingOutputConfig.generateEdgeBandingSchedule && cutList
    ? generateEdgeBandingSchedule(cutList)
    : undefined;

  // 4. Generate hardware schedule
  const hardwareSchedule = pdd.manufacturingOutputConfig.generateHardwareSchedule
    ? generateHardwareSchedule(validation.computedBOM)
    : undefined;

  // 5. Identify shortages
  const shortages = identifyShortages(validation.stockAvailability);

  // 6. Build MDP
  const mdp: ManufacturingDataPackage = {
    pddId,
    configuration,
    finishSelections,
    timestamp: Timestamp.now(),
    bom: validation.computedBOM,
    pricingBreakdown: validation.estimatedPrice,
    cutList,
    edgeBandingSchedule,
    hardwareSchedule,
    stockAvailability: validation.stockAvailability,
    shortages,
    glbUrl: '', // Set by caller after GLB generation
    thumbnailUrl: '', // Set by caller
    arReady: false,
  };

  return mdp;
}

/**
 * Persist an MDP to Firestore.
 * Returns the Firestore document ID.
 */
export async function persistMDP(mdp: ManufacturingDataPackage): Promise<string> {
  const docRef = await addDoc(collection(db, MDP_COLLECTION), {
    ...mdp,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Flag shortages on a persisted MDP document.
 * Writes shortage data to the MDP doc so Design Manager's procurement
 * workflow can pick it up and create POs.
 */
export async function flagShortages(
  mdpId: string,
  shortages: ShortageAlert[],
): Promise<void> {
  if (shortages.length === 0) return;

  await updateDoc(doc(db, MDP_COLLECTION, mdpId), {
    shortages,
    shortageStatus: 'flagged',
    shortageCount: shortages.length,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Prepare MDP data as a Design Manager handoff payload.
 * The returned object contains everything Design Manager needs to
 * create an MO via releaseToProduction() once a design project/item exists.
 */
export function prepareMOHandoff(mdp: ManufacturingDataPackage, pddName: string) {
  return {
    source: 'design-studio' as const,
    pddId: mdp.pddId,
    itemName: pddName,
    quantity: 1,
    bom: mdp.bom.map(line => ({
      inventoryItemId: line.inventoryItemId || '',
      name: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitCost: line.unitCost,
    })),
    cutList: mdp.cutList,
    hardwareSchedule: mdp.hardwareSchedule,
    estimatedCost: mdp.pricingBreakdown.total,
    currency: mdp.pricingBreakdown.currency,
    configuration: mdp.configuration,
    finishSelections: mdp.finishSelections,
  };
}

/**
 * Prepare MDP pricing as a ConsolidatedEstimate-compatible shape
 * for Design Manager's createClientQuote().
 */
export function prepareQuoteHandoff(mdp: ManufacturingDataPackage) {
  return {
    source: 'design-studio' as const,
    pddId: mdp.pddId,
    lineItems: mdp.pricingBreakdown.lineItems.map(item => ({
      description: item.description,
      category: item.category,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
    })),
    subtotal: mdp.pricingBreakdown.subtotal,
    vatAmount: mdp.pricingBreakdown.vatAmount,
    total: mdp.pricingBreakdown.total,
    currency: mdp.pricingBreakdown.currency,
  };
}

/**
 * Fire project.design.confirmed event for Design Manager workflow.
 */
export async function fireDesignConfirmedEvent(
  mdp: ManufacturingDataPackage,
  projectId: string,
): Promise<void> {
  await addDoc(collection(db, 'businessEvents'), {
    type: 'project.design.confirmed',
    projectId,
    pddId: mdp.pddId,
    mdpId: mdp.manufacturingOrderId, // If persisted
    timestamp: serverTimestamp(),
  });
}

// ── Internal helpers ──────────────────────────────────────

function extractCutList(
  bom: ComputedBOMLine[],
  _pdd: ProductDefinitionDocument,
  parameters: Record<string, unknown>,
  finishSelections: Record<string, string>,
): CutListEntry[] {
  const entries: CutListEntry[] = [];

  // Extract panel-type BOM lines as cut list entries
  for (const line of bom) {
    const cat = line.materialCategory.toLowerCase();
    if (cat.includes('board') || cat.includes('panel') || cat.includes('sheet')) {
      const width = typeof parameters.width === 'number' ? parameters.width : 600;
      const depth = typeof parameters.depth === 'number' ? parameters.depth : 560;

      entries.push({
        partName: line.description,
        material: line.inventoryItemName,
        finishLibraryId: finishSelections[line.bomTemplateLineKey] || '',
        length: width,
        width: depth,
        thickness: 18, // Default — refined by DKB component specs
        quantity: Math.ceil(line.quantity),
        grainDirection: 'length',
        edgeBanding: { top: null, bottom: null, left: null, right: null },
      });
    }
  }

  return entries;
}

function generateEdgeBandingSchedule(cutList: CutListEntry[]): EdgeBandingEntry[] {
  const edgeMap = new Map<string, { totalLength: number; panels: string[] }>();

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
    inventoryItemId: '', // Resolved by procurement
    totalLength: Math.round(data.totalLength / 1000 * 100) / 100, // Convert mm → lm
    unit: 'lm' as const,
    panels: [...new Set(data.panels)],
  }));
}

function generateHardwareSchedule(bom: ComputedBOMLine[]): HardwareScheduleEntry[] {
  return bom
    .filter(line => {
      const cat = line.materialCategory.toLowerCase();
      return cat.includes('hardware') || cat.includes('hinge') || cat.includes('handle') || cat.includes('slide') || cat.includes('connector');
    })
    .map(line => ({
      hardwareName: line.description,
      inventoryItemId: line.inventoryItemId,
      quantity: Math.ceil(line.quantity),
      perUnit: 'unit',
      boringRequired: false,
      notes: undefined,
    }));
}

function identifyShortages(
  stockAvailability: Record<string, StockStatus>,
): ShortageAlert[] {
  return Object.values(stockAvailability)
    .filter(s => s.status === 'out_of_stock' || s.status === 'low_stock')
    .filter(s => s.requiredQuantity > s.availableQuantity)
    .map(s => ({
      inventoryItemId: s.inventoryItemId,
      itemName: s.inventoryItemName,
      requiredQuantity: s.requiredQuantity,
      availableQuantity: s.availableQuantity,
      shortfall: s.requiredQuantity - s.availableQuantity,
      estimatedRestockDays: s.estimatedRestockDays,
      suggestedAction: 'create_po' as const,
    }));
}
