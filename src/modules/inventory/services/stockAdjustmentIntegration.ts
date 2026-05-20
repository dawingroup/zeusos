/**
 * Stock Adjustment Integration Service
 * Provides cross-module hooks for Manufacturing, Purchasing, etc.
 * Creates pre-approved adjustments from automated processes.
 */

import { db } from '@/shared/services/firebase/firestore';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import type {
  StockAdjustmentLineItem,
  AdjustmentDirection,
} from '../types/stockAdjustment';

const COLLECTION = 'stock_adjustments';

function buildLineItems(
  items: Array<{
    itemId: string;
    itemName: string;
    itemSku: string;
    quantity: number;
    unitOfMeasure: string;
    unitCost: number;
    lotNumber?: string;
  }>,
  direction: AdjustmentDirection
): StockAdjustmentLineItem[] {
  return items.map(item => ({
    lineId: uuidv4(),
    itemId: item.itemId,
    itemName: item.itemName,
    itemSku: item.itemSku,
    direction,
    quantity: item.quantity,
    unitOfMeasure: item.unitOfMeasure,
    unitCostAtAdjustment: item.unitCost,
    totalValue: item.quantity * item.unitCost,
    lotNumber: item.lotNumber,
  }));
}

function computeTotals(lineItems: StockAdjustmentLineItem[]) {
  const totalIncreaseValue = lineItems
    .filter(l => l.direction === 'increase')
    .reduce((sum, l) => sum + l.totalValue, 0);
  const totalDecreaseValue = lineItems
    .filter(l => l.direction === 'decrease')
    .reduce((sum, l) => sum + l.totalValue, 0);
  return {
    totalIncreaseValue,
    totalDecreaseValue,
    netValueImpact: totalIncreaseValue - totalDecreaseValue,
    lineCount: lineItems.length,
  };
}

export const StockAdjustmentIntegration = {
  /**
   * Called by Manufacturing Module when materials are issued to an MO.
   * Creates a pre-approved stock decrease adjustment.
   */
  createProductionConsumption: async (params: {
    organizationId: string;
    moId: string;
    moNumber: string;
    materials: Array<{
      itemId: string;
      itemName: string;
      itemSku: string;
      quantity: number;
      unitOfMeasure: string;
      unitCost: number;
      lotNumber?: string;
    }>;
    issuedBy: string;
  }): Promise<string> => {
    const lineItems = buildLineItems(params.materials, 'decrease');
    const totals = computeTotals(lineItems);
    const itemIds = [...new Set(lineItems.map(l => l.itemId))];

    const docData = {
      organizationId: params.organizationId,
      adjustmentType: 'production_consumption',
      status: 'approved',
      adjustmentNumber: '', // Set by Cloud Function
      lineItems,
      itemIds,
      ...totals,
      referenceType: 'manufacturing_order',
      referenceId: params.moId,
      referenceNumber: params.moNumber,
      reason: `Materials issued to Manufacturing Order ${params.moNumber}`,
      isAutoApproved: true,
      approvedBy: 'system:manufacturing',
      approvedAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
      submittedBy: params.issuedBy,
      qboSyncStatus: 'pending',
      createdBy: params.issuedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const colRef = collection(db, COLLECTION);
    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  },

  /**
   * Called by Manufacturing Module when production is completed.
   * Creates a pre-approved stock increase adjustment.
   */
  createProductionOutput: async (params: {
    organizationId: string;
    moId: string;
    moNumber: string;
    finishedGoods: Array<{
      itemId: string;
      itemName: string;
      itemSku: string;
      quantity: number;
      unitOfMeasure: string;
      unitCost: number;  // Job-order cost
      lotNumber?: string;
    }>;
    completedBy: string;
  }): Promise<string> => {
    const lineItems = buildLineItems(params.finishedGoods, 'increase');
    const totals = computeTotals(lineItems);
    const itemIds = [...new Set(lineItems.map(l => l.itemId))];

    const docData = {
      organizationId: params.organizationId,
      adjustmentType: 'production_output',
      status: 'approved',
      adjustmentNumber: '',
      lineItems,
      itemIds,
      ...totals,
      referenceType: 'manufacturing_order',
      referenceId: params.moId,
      referenceNumber: params.moNumber,
      reason: `Finished goods received from Manufacturing Order ${params.moNumber}`,
      isAutoApproved: true,
      approvedBy: 'system:manufacturing',
      approvedAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
      submittedBy: params.completedBy,
      qboSyncStatus: 'pending',
      createdBy: params.completedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const colRef = collection(db, COLLECTION);
    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  },

  /**
   * Called by Purchasing when goods are received against a PO.
   */
  createGoodsReceived: async (params: {
    organizationId: string;
    poId: string;
    poNumber: string;
    receivedItems: Array<{
      itemId: string;
      itemName: string;
      itemSku: string;
      quantity: number;
      unitOfMeasure: string;
      unitCost: number;
      lotNumber?: string;
    }>;
    receivedBy: string;
  }): Promise<string> => {
    const lineItems = buildLineItems(params.receivedItems, 'increase');
    const totals = computeTotals(lineItems);
    const itemIds = [...new Set(lineItems.map(l => l.itemId))];

    const docData = {
      organizationId: params.organizationId,
      adjustmentType: 'goods_received',
      status: 'approved',
      adjustmentNumber: '',
      lineItems,
      itemIds,
      ...totals,
      referenceType: 'purchase_order',
      referenceId: params.poId,
      referenceNumber: params.poNumber,
      reason: `Goods received against Purchase Order ${params.poNumber}`,
      isAutoApproved: true,
      approvedBy: 'system:purchasing',
      approvedAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
      submittedBy: params.receivedBy,
      qboSyncStatus: 'pending',
      createdBy: params.receivedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const colRef = collection(db, COLLECTION);
    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  },
};
