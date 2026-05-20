/**
 * Receipt Routing Service
 * Routes received goods to the correct module based on PO line item category.
 *
 * - inventory → stock levels + cost update (existing behavior)
 * - asset     → create or update asset in registry
 * - service   → generate expense reference for finance
 * - overhead  → generate expense reference for finance
 */

import {
  resolveLineItemCategory,
  type POLineItem,
  type GoodsReceiptLine,
  type PurchaseOrder,
} from '../types/purchaseOrder';
import {
  receiveStock,
  updateInventoryItemCostFromReceipt,
} from '@/modules/inventory/services/stockLevelService';
import { getInventoryItem } from '@/modules/inventory/services/inventoryService';
import { hasPackagingDefined } from '@/modules/inventory/utils/packagingUtils';
import {
  convertToFunctionalCurrency,
  FUNCTIONAL_CURRENCY,
} from '@/modules/finance/constants/currency.constants';
import { assetService } from '@/modules/assets/services/AssetService';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { AssetFinancials, AssetCategory } from '@/shared/types/assets';

// Default useful life by asset category (years)
const DEFAULT_USEFUL_LIFE: Record<string, number> = {
  STATIONARY_MACHINE: 10,
  POWER_TOOL: 5,
  HAND_TOOL: 7,
  JIG: 5,
  CNC: 10,
  DUST_COLLECTION: 8,
  SPRAY_EQUIPMENT: 7,
  SEWING_MACHINE: 8,
};

interface RoutingResult {
  assetId?: string;
  expenseReference?: string;
}

/**
 * Route a single receipt line to the appropriate module
 */
export async function routeReceiptLine(
  line: GoodsReceiptLine,
  poLineItem: POLineItem,
  po: PurchaseOrder,
  userId: string,
): Promise<RoutingResult> {
  const category = resolveLineItemCategory(poLineItem);

  switch (category) {
    case 'inventory':
      return routeToInventory(line, poLineItem, po, userId);
    case 'asset':
      return routeToAssetRegistry(line, poLineItem, po, userId);
    case 'service':
    case 'overhead':
    case 'manufacturing-overhead':
      return routeToExpense(line, poLineItem, po, category, userId);
    default:
      return routeToInventory(line, poLineItem, po, userId);
  }
}

// ────────────────────────────────────────────
// Packaging & currency conversion
// ────────────────────────────────────────────

interface ReceiptConversions {
  baseUnitQuantity: number;
  packagingMultiplier: number;
  functionalCurrencyUnitCost: number;
  exchangeRateUsed: number;
  sourceCurrency: string;
}

/**
 * Resolve packaging-to-base-unit and currency conversions for a receipt line.
 *
 * Packaging priority:
 *   1. PO line item's packagingQty (new POs)
 *   2. Live lookup from inventory item's supplier pricing (existing POs)
 *   3. Default: 1 (no conversion)
 *
 * Currency priority:
 *   1. Line-level exchangeRateToUGX override
 *   2. PO-level exchangeRateOverride
 *   3. Static default from convertToFunctionalCurrency()
 */
async function resolveReceiptConversions(
  line: GoodsReceiptLine,
  poLineItem: POLineItem,
  po: PurchaseOrder,
): Promise<ReceiptConversions> {
  // ── Resolve packaging multiplier ──
  // Priority:
  //   1. PO line item's packagingQty (explicit on the order)
  //   2. Inventory item's supplier pricing packagingQty
  //   3. Inventory item's UoM conversion (purchaseUom → stockUom)
  //   4. Default: 1 (no conversion)
  let packagingMultiplier = poLineItem.packagingQty ?? 0;

  // Live lookup for existing POs that lack packaging on the line item
  if (packagingMultiplier <= 0 && line.inventoryItemId) {
    try {
      const fullItem = await getInventoryItem(line.inventoryItemId);
      if (fullItem) {
        // Try supplier pricing first
        const match = findBestSupplierPricing(
          fullItem.supplierPricing,
          fullItem.vendorSources,
          po.supplierId ?? undefined,
        );
        if (match && hasPackagingDefined(match as any)) {
          packagingMultiplier = match.packagingQty!;
        }

        // Fall back to item-level UoM conversion (purchaseUom → stockUom)
        if (packagingMultiplier <= 0 && fullItem.uomConversion && fullItem.uomConversion > 0) {
          packagingMultiplier = fullItem.uomConversion;
        }
      }
    } catch (err) {
      console.warn(`[receiptRouting] Packaging lookup failed for item ${line.inventoryItemId}, defaulting to 1:1`, err);
    }
  }

  if (packagingMultiplier <= 0) packagingMultiplier = 1;

  const baseUnitQuantity = line.quantityReceived * packagingMultiplier;

  // ── Resolve cost per base unit in source currency ──
  const effectiveCost = poLineItem.effectiveUnitCost ?? poLineItem.unitCost;
  const baseUnitCostInSourceCurrency = effectiveCost / packagingMultiplier;

  // ── Resolve currency conversion ──
  const sourceCurrency = poLineItem.currency || po.totals.currency;

  if (sourceCurrency === FUNCTIONAL_CURRENCY) {
    return {
      baseUnitQuantity,
      packagingMultiplier,
      functionalCurrencyUnitCost: baseUnitCostInSourceCurrency,
      exchangeRateUsed: 1,
      sourceCurrency,
    };
  }

  // Rate priority: line override → PO override → static default
  const explicitRate = poLineItem.exchangeRateToUGX ?? po.exchangeRateOverride;

  if (explicitRate && explicitRate > 0) {
    return {
      baseUnitQuantity,
      packagingMultiplier,
      functionalCurrencyUnitCost: Math.round(baseUnitCostInSourceCurrency * explicitRate * 100) / 100,
      exchangeRateUsed: explicitRate,
      sourceCurrency,
    };
  }

  const converted = convertToFunctionalCurrency(baseUnitCostInSourceCurrency, sourceCurrency);
  return {
    baseUnitQuantity,
    packagingMultiplier,
    functionalCurrencyUnitCost: converted.amountUGX,
    exchangeRateUsed: converted.rate,
    sourceCurrency,
  };
}

/**
 * Find the best supplier pricing match. Prefers exact supplierId, falls back to preferred.
 */
function findBestSupplierPricing(
  supplierPricing?: Array<{ supplierId: string; isPreferred?: boolean; packagingQty?: number; packagingUnit?: string; pricePerPackage?: number }>,
  vendorSources?: Array<{ supplierId: string; isPreferred?: boolean; packagingQty?: number; packagingUnit?: string; pricePerPackage?: number }>,
  supplierId?: string,
): { packagingQty?: number; packagingUnit?: string; pricePerPackage?: number } | null {
  for (const list of [supplierPricing, vendorSources]) {
    if (!list?.length) continue;
    if (supplierId) {
      const match = list.find((s) => s.supplierId === supplierId);
      if (match) return match;
    }
    const preferred = list.find((s) => s.isPreferred);
    if (preferred) return preferred;
  }
  return null;
}

// ────────────────────────────────────────────
// Inventory routing
// ────────────────────────────────────────────

async function routeToInventory(
  line: GoodsReceiptLine,
  poLineItem: POLineItem,
  po: PurchaseOrder,
  userId: string,
): Promise<RoutingResult> {
  if (!line.inventoryItemId || !line.warehouseId) return {};

  const {
    baseUnitQuantity,
    packagingMultiplier,
    functionalCurrencyUnitCost,
    exchangeRateUsed,
    sourceCurrency,
  } = await resolveReceiptConversions(line, poLineItem, po);

  // Build descriptive notes
  const notes = buildReceiptNotes(po.poNumber, packagingMultiplier, line.quantityReceived, baseUnitQuantity, poLineItem, sourceCurrency, exchangeRateUsed);

  // Receive stock in base units
  await receiveStock(
    line.inventoryItemId,
    line.warehouseId,
    poLineItem.sku ?? '',
    poLineItem.description,
    baseUnitQuantity,
    po.id,
    userId,
    notes,
  );

  // Update inventory cost in functional currency
  if (poLineItem.effectiveUnitCost || poLineItem.unitCost) {
    await updateInventoryItemCostFromReceipt(
      line.inventoryItemId,
      baseUnitQuantity,
      functionalCurrencyUnitCost,
      FUNCTIONAL_CURRENCY,
      userId,
      po.id,
      po.poNumber,
    );
  }

  // Write audit fields onto the receipt line for persistence
  line.baseUnitQuantityReceived = baseUnitQuantity;
  line.packagingMultiplier = packagingMultiplier;
  line.functionalCurrencyUnitCost = functionalCurrencyUnitCost;
  line.exchangeRateUsed = exchangeRateUsed;
  line.sourceCurrency = sourceCurrency;

  return {};
}

function buildReceiptNotes(
  poNumber: string,
  multiplier: number,
  rawQty: number,
  baseQty: number,
  li: POLineItem,
  currency: string,
  rate: number,
): string {
  let note = `From PO ${poNumber}`;
  if (multiplier > 1) {
    note += ` (${rawQty} ${li.unit} × ${multiplier} = ${baseQty} ${li.baseUnit ?? 'pcs'})`;
  }
  if (currency !== FUNCTIONAL_CURRENCY) {
    note += ` [${currency} → UGX @ ${rate}]`;
  }
  return note;
}

// ────────────────────────────────────────────
// Asset routing
// ────────────────────────────────────────────

async function routeToAssetRegistry(
  line: GoodsReceiptLine,
  poLineItem: POLineItem,
  po: PurchaseOrder,
  userId: string,
): Promise<RoutingResult> {
  // If linked to an existing asset, update its status
  if (poLineItem.assetId) {
    await assetService.updateAsset(
      poLineItem.assetId,
      { status: 'ACTIVE' },
      userId,
    );
    return { assetId: poLineItem.assetId };
  }

  // Resolve cost in functional currency (UGX)
  const sourceCurrency = poLineItem.currency || po.totals.currency;
  const effectiveCost = poLineItem.effectiveUnitCost ?? poLineItem.unitCost;

  let unitCostUGX: number;
  let exchangeRateUsed: number;

  if (sourceCurrency === FUNCTIONAL_CURRENCY) {
    unitCostUGX = effectiveCost;
    exchangeRateUsed = 1;
  } else {
    const explicitRate = poLineItem.exchangeRateToUGX ?? po.exchangeRateOverride;
    if (explicitRate && explicitRate > 0) {
      unitCostUGX = Math.round(effectiveCost * explicitRate * 100) / 100;
      exchangeRateUsed = explicitRate;
    } else {
      const converted = convertToFunctionalCurrency(effectiveCost, sourceCurrency);
      unitCostUGX = converted.amountUGX;
      exchangeRateUsed = converted.rate;
    }
  }

  // Build financials object
  const assetCategory = (poLineItem.assetCategory ?? 'POWER_TOOL') as AssetCategory;
  const usefulLifeYears = DEFAULT_USEFUL_LIFE[assetCategory] ?? 5;
  const purchaseDate = new Date().toISOString().split('T')[0];

  const financials: AssetFinancials = {
    purchasePrice: unitCostUGX,
    purchaseDate,
    currency: FUNCTIONAL_CURRENCY,
    supplier: po.supplierName ?? po.supplierId ?? '',
    invoiceReference: po.poNumber,
    depreciationMethod: 'STRAIGHT_LINE',
    usefulLifeYears,
    salvageValue: 0,
  };

  // Create new asset(s) for each unit received
  let firstAssetId: string | undefined;
  for (let i = 0; i < line.quantityReceived; i++) {
    // Parse brand/model from description (best-effort)
    const descParts = poLineItem.description.split(' ');
    const brand = descParts[0] ?? 'Unknown';
    const model = descParts.slice(1).join(' ') || poLineItem.description;

    const asset = await assetService.createAsset(
      {
        brand,
        model,
        serialNumber: line.serialNumber || undefined,
        category: assetCategory,
        specs: {},
        maintenance: {
          intervalHours: 500,
          tasks: [],
          nextServiceDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          history: [],
        },
        status: 'ACTIVE',
        location: { zone: 'Receiving' },
        financials,
        createdBy: userId,
        updatedBy: userId,
      },
      userId,
    );

    if (!firstAssetId) firstAssetId = asset.id;
  }

  // Write audit fields onto the receipt line for persistence
  line.functionalCurrencyUnitCost = unitCostUGX;
  line.exchangeRateUsed = exchangeRateUsed;
  line.sourceCurrency = sourceCurrency;

  // Emit business event for tracking
  await addDoc(collection(db, 'businessEvents'), {
    eventType: 'asset_received_from_po',
    category: 'asset_management',
    severity: 'low',
    sourceModule: 'manufacturing',
    entityType: 'asset',
    entityId: firstAssetId ?? '',
    entityName: poLineItem.description,
    title: `Asset received via PO ${po.poNumber}`,
    description: `${line.quantityReceived}x ${poLineItem.description}`,
    triggeredBy: userId,
    triggeredAt: serverTimestamp(),
    status: 'pending',
    metadata: { poId: po.id, poNumber: po.poNumber, lineItemId: poLineItem.id },
    createdAt: serverTimestamp(),
  });

  return { assetId: firstAssetId };
}

// ────────────────────────────────────────────
// Service / overhead routing
// ────────────────────────────────────────────

async function routeToExpense(
  line: GoodsReceiptLine,
  poLineItem: POLineItem,
  po: PurchaseOrder,
  category: 'service' | 'overhead' | 'manufacturing-overhead',
  userId: string,
): Promise<RoutingResult> {
  const reference = `EXP-${po.poNumber}-${poLineItem.id}`;

  // Emit business event for finance module to pick up
  await addDoc(collection(db, 'businessEvents'), {
    eventType: category === 'service' ? 'service_expense_from_po' : 'overhead_expense_from_po',
    category: 'finance',
    severity: 'low',
    sourceModule: 'manufacturing',
    entityType: 'expense',
    entityId: reference,
    entityName: poLineItem.description,
    title: `${category === 'service' ? 'Service' : 'Overhead'} expense from PO ${po.poNumber}`,
    description: `${poLineItem.description} — ${poLineItem.totalCost.toLocaleString()} ${po.totals.currency}`,
    triggeredBy: userId,
    triggeredAt: serverTimestamp(),
    status: 'pending',
    metadata: {
      poId: po.id,
      poNumber: po.poNumber,
      lineItemId: poLineItem.id,
      expenseCategory: category,
      amount: poLineItem.effectiveUnitCost
        ? poLineItem.effectiveUnitCost * line.quantityReceived
        : poLineItem.totalCost,
      currency: po.totals.currency,
      ...(poLineItem.expenseAccountCode ? { accountCode: poLineItem.expenseAccountCode } : {}),
    },
    createdAt: serverTimestamp(),
  });

  return { expenseReference: reference };
}
