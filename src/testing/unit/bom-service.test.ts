/**
 * Unit Tests: BOM (Bill of Materials) Service
 *
 * Tests for BOM line CRUD, cost calculations, and material availability
 * within the manufacturing module. Verifies correct Firestore operations
 * and business logic for BOM management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks
// ============================================

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  collection: vi.fn((...args: string[]) => ({ path: args.join('/') })),
  doc: vi.fn((...args: string[]) => ({ path: args.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  serverTimestamp: vi.fn(() => new Date('2026-03-09T10:00:00Z')),
  runTransaction: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn(),
  })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date('2026-03-09T10:00:00Z') })),
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
  },
}));

vi.mock('@/shared/services/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  app: {},
}));

// Import after mocks are set up
import { bomService } from '@/modules/manufacturing/services/bomService';
import {
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  orderBy,
  query,
} from 'firebase/firestore';
import type { BOMLine, BOMCategory } from '@/modules/manufacturing/types';

// ============================================
// Helpers
// ============================================

function createMockBOMLine(overrides: Partial<BOMLine> = {}): BOMLine {
  return {
    id: 'bom-line-1',
    orderId: 'order-1',
    lineNumber: 1,
    category: 'sheet_material' as BOMCategory,
    inventoryItemId: 'inv-001',
    materialName: 'MDF 18mm',
    materialCode: 'MDF-18',
    specification: '2440x1220x18mm',
    requiredQuantity: 4,
    unit: 'sheet',
    reservedQuantity: 0,
    consumedQuantity: 0,
    wasteQuantity: 0,
    unitCost: 125000,
    totalEstimatedCost: 500000,
    totalActualCost: 0,
    procurementStatus: 'pending',
    fromOptimization: false,
    createdAt: new Date() as never,
    updatedAt: new Date() as never,
    ...overrides,
  };
}

function createMockDocsSnapshot(lines: Partial<BOMLine>[]) {
  return {
    docs: lines.map((line, idx) => ({
      id: line.id ?? `bom-line-${idx + 1}`,
      data: () => ({
        ...createMockBOMLine(line),
        id: undefined, // Firestore docs don't include id in data()
      }),
      ref: { path: `manufacturingOrders/order-1/bom/${line.id ?? `bom-line-${idx + 1}`}` },
    })),
    empty: lines.length === 0,
    size: lines.length,
  };
}

// ============================================
// Tests
// ============================================

describe('BOM Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // getBOM
  // ------------------------------------------
  describe('getBOM', () => {
    it('should query BOM subcollection ordered by lineNumber', async () => {
      const mockLines = [
        createMockBOMLine({ id: 'bom-1', lineNumber: 1, materialName: 'MDF 18mm' }),
        createMockBOMLine({ id: 'bom-2', lineNumber: 2, materialName: 'Edge Tape' }),
        createMockBOMLine({ id: 'bom-3', lineNumber: 3, materialName: 'Hinges' }),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockLines.map(line => ({
          id: line.id,
          data: () => {
            const { id: _id, ...rest } = line;
            return rest;
          },
        })),
      } as never);

      const result = await bomService.getBOM('order-1');

      // Verify collection and orderBy were called correctly
      expect(collection).toHaveBeenCalledWith(
        expect.anything(),
        'manufacturingOrders',
        'order-1',
        'bom',
      );
      expect(orderBy).toHaveBeenCalledWith('lineNumber', 'asc');
      expect(query).toHaveBeenCalled();

      // Verify results
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('bom-1');
      expect(result[0].materialName).toBe('MDF 18mm');
      expect(result[1].lineNumber).toBe(2);
      expect(result[2].materialName).toBe('Hinges');
    });

    it('should return empty array when no BOM lines exist', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [],
      } as never);

      const result = await bomService.getBOM('order-empty');

      expect(result).toEqual([]);
    });
  });

  // ------------------------------------------
  // addBOMLine
  // ------------------------------------------
  describe('addBOMLine', () => {
    it('should add document and update MO summary', async () => {
      // Mock addDoc for the new BOM line
      vi.mocked(addDoc).mockResolvedValueOnce({ id: 'new-bom-line' } as never);

      // Mock getDocs for updateMOBOMSummary (called internally after add)
      // First call: getBOM inside updateMOBOMSummary
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockDocsSnapshot([
          { id: 'existing-1', lineNumber: 1, category: 'sheet_material', totalEstimatedCost: 500000 },
          { id: 'new-bom-line', lineNumber: 2, category: 'hardware', totalEstimatedCost: 60000 },
        ]) as never,
      );

      // Mock updateDoc for MO summary update
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const result = await bomService.addBOMLine('order-1', {
        lineNumber: 2,
        category: 'hardware',
        inventoryItemId: 'inv-hw-001',
        materialName: 'Soft-close Hinges',
        materialCode: 'HINGE-SC',
        requiredQuantity: 6,
        unit: 'pcs',
        reservedQuantity: 0,
        consumedQuantity: 0,
        wasteQuantity: 0,
        unitCost: 10000,
        totalEstimatedCost: 60000,
        totalActualCost: 0,
        procurementStatus: 'pending',
        fromOptimization: false,
      });

      // Verify addDoc was called with correct data
      expect(addDoc).toHaveBeenCalled();
      const addDocCalls = vi.mocked(addDoc).mock.calls;
      const addedData = addDocCalls[0][1] as unknown as Record<string, unknown>;
      expect(addedData.orderId).toBe('order-1');
      expect(addedData.materialName).toBe('Soft-close Hinges');
      expect(addedData.requiredQuantity).toBe(6);
      expect(addedData.unitCost).toBe(10000);
      expect(addedData.totalEstimatedCost).toBe(60000); // 6 * 10000
      expect(addedData.createdAt).toBeDefined();
      expect(addedData.updatedAt).toBeDefined();

      // Verify returned ID
      expect(result).toBe('new-bom-line');

      // Verify MO summary was updated
      expect(updateDoc).toHaveBeenCalled();
      const updateDocCalls = vi.mocked(updateDoc).mock.calls;
      const summaryUpdate = updateDocCalls[0][1] as unknown as Record<string, unknown>;
      expect(summaryUpdate.bomLineCount).toBe(2);
      expect(summaryUpdate.bomTotalMaterialCost).toBeDefined();
    });

    it('should calculate totalEstimatedCost from quantity and unitCost', async () => {
      vi.mocked(addDoc).mockResolvedValueOnce({ id: 'calc-line' } as never);
      vi.mocked(getDocs).mockResolvedValueOnce(createMockDocsSnapshot([]) as never);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await bomService.addBOMLine('order-1', {
        lineNumber: 1,
        category: 'sheet_material',
        materialName: 'Plywood 12mm',
        requiredQuantity: 10,
        unit: 'sheet',
        reservedQuantity: 0,
        consumedQuantity: 0,
        wasteQuantity: 0,
        unitCost: 85000,
        totalEstimatedCost: 0, // Should be recalculated
        totalActualCost: 0,
        procurementStatus: 'pending',
        fromOptimization: false,
      });

      const addedData = vi.mocked(addDoc).mock.calls[0][1] as unknown as Record<string, unknown>;
      expect(addedData.totalEstimatedCost).toBe(850000); // 10 * 85000
    });
  });

  // ------------------------------------------
  // updateBOMLine
  // ------------------------------------------
  describe('updateBOMLine', () => {
    it('should recalculate estimated cost when quantity changes', async () => {
      const existingLine = createMockBOMLine({
        id: 'bom-1',
        requiredQuantity: 4,
        unitCost: 125000,
        totalEstimatedCost: 500000,
      });

      // Mock getDocs for finding the existing line (to get current values)
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'bom-1',
            data: () => {
              const { id: _id, ...rest } = existingLine;
              return rest;
            },
          },
        ],
      } as never);

      // Mock updateDoc for line update
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      // Mock getDocs for updateMOBOMSummary
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockDocsSnapshot([
          { id: 'bom-1', totalEstimatedCost: 750000, category: 'sheet_material' },
        ]) as never,
      );

      await bomService.updateBOMLine('order-1', 'bom-1', {
        requiredQuantity: 6, // Changed from 4 to 6
      });

      // Verify updateDoc was called with recalculated cost
      const updateCalls = vi.mocked(updateDoc).mock.calls;
      const lineUpdate = updateCalls[0][1] as unknown as Record<string, unknown>;
      expect(lineUpdate.totalEstimatedCost).toBe(750000); // 6 * 125000
      expect(lineUpdate.updatedAt).toBeDefined();
    });

    it('should recalculate estimated cost when unitCost changes', async () => {
      const existingLine = createMockBOMLine({
        id: 'bom-1',
        requiredQuantity: 4,
        unitCost: 125000,
        totalEstimatedCost: 500000,
      });

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'bom-1',
            data: () => {
              const { id: _id, ...rest } = existingLine;
              return rest;
            },
          },
        ],
      } as never);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      // Mock getDocs for updateMOBOMSummary
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockDocsSnapshot([
          { id: 'bom-1', totalEstimatedCost: 600000, category: 'sheet_material' },
        ]) as never,
      );

      await bomService.updateBOMLine('order-1', 'bom-1', {
        unitCost: 150000, // Changed from 125000 to 150000
      });

      const lineUpdate = vi.mocked(updateDoc).mock.calls[0][1] as unknown as Record<string, unknown>;
      expect(lineUpdate.totalEstimatedCost).toBe(600000); // 4 * 150000
    });

    it('should not recalculate cost when non-cost fields change', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      // Mock getDocs for updateMOBOMSummary
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockDocsSnapshot([
          { id: 'bom-1', totalEstimatedCost: 500000, category: 'sheet_material' },
        ]) as never,
      );

      await bomService.updateBOMLine('order-1', 'bom-1', {
        notes: 'Updated note',
        specification: 'New spec',
      });

      const lineUpdate = vi.mocked(updateDoc).mock.calls[0][1] as unknown as Record<string, unknown>;
      // totalEstimatedCost should not be present when only non-cost fields change
      expect(lineUpdate.totalEstimatedCost).toBeUndefined();
      expect(lineUpdate.notes).toBe('Updated note');
      expect(lineUpdate.specification).toBe('New spec');
    });
  });

  // ------------------------------------------
  // removeBOMLine
  // ------------------------------------------
  describe('removeBOMLine', () => {
    it('should delete document and update MO summary', async () => {
      // Mock deleteDoc
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      // Mock getDocs for updateMOBOMSummary (after deletion, only 1 line remains)
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockDocsSnapshot([
          { id: 'bom-2', lineNumber: 2, category: 'hardware', totalEstimatedCost: 60000 },
        ]) as never,
      );

      // Mock updateDoc for MO summary
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await bomService.removeBOMLine('order-1', 'bom-1');

      // Verify deleteDoc was called with the correct document reference
      expect(deleteDoc).toHaveBeenCalled();

      // Verify MO summary was updated after deletion
      expect(updateDoc).toHaveBeenCalled();
      const summaryUpdate = vi.mocked(updateDoc).mock.calls[0][1] as unknown as Record<string, unknown>;
      expect(summaryUpdate.bomLineCount).toBe(1); // One line remaining
      expect(summaryUpdate.bomTotalMaterialCost).toBe(60000);
    });

    it('should update MO summary to zero when last line is removed', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      // After removing the last line, no BOM lines remain
      vi.mocked(getDocs).mockResolvedValueOnce(
        createMockDocsSnapshot([]) as never,
      );

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await bomService.removeBOMLine('order-1', 'bom-last');

      const summaryUpdate = vi.mocked(updateDoc).mock.calls[0][1] as unknown as Record<string, unknown>;
      expect(summaryUpdate.bomLineCount).toBe(0);
      expect(summaryUpdate.bomTotalMaterialCost).toBe(0);
    });
  });

  // ------------------------------------------
  // checkMaterialAvailability
  // ------------------------------------------
  describe('checkMaterialAvailability', () => {
    it('should return correct availability status for in-stock materials', async () => {
      const bomLines = [
        createMockBOMLine({
          id: 'bom-1',
          inventoryItemId: 'inv-001',
          materialName: 'MDF 18mm',
          requiredQuantity: 4,
          unitCost: 125000,
          category: 'sheet_material',
        }),
      ];

      // First getDocs: getBOM
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: bomLines.map(line => ({
          id: line.id,
          data: () => {
            const { id: _id, ...rest } = line;
            return rest;
          },
        })),
      } as never);

      // Second getDocs: stock level query (inside checkMaterialAvailability)
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'stock-1',
            data: () => ({
              inventoryItemId: 'inv-001',
              currentQuantity: 10, // More than required (4)
            }),
          },
        ],
      } as never);

      const report = await bomService.checkMaterialAvailability('order-1');

      expect(report.orderId).toBe('order-1');
      expect(report.overallStatus).toBe('all_available');
      expect(report.lines).toHaveLength(1);
      expect(report.lines[0].status).toBe('in_stock');
      expect(report.lines[0].availableQuantity).toBe(10);
      expect(report.lines[0].shortageQuantity).toBe(0);
      expect(report.totalShortageValue).toBe(0);
    });

    it('should detect shortages and return correct shortage value', async () => {
      const bomLines = [
        createMockBOMLine({
          id: 'bom-1',
          inventoryItemId: 'inv-001',
          materialName: 'MDF 18mm',
          requiredQuantity: 10,
          unitCost: 125000,
          category: 'sheet_material',
        }),
      ];

      // getBOM
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: bomLines.map(line => ({
          id: line.id,
          data: () => {
            const { id: _id, ...rest } = line;
            return rest;
          },
        })),
      } as never);

      // Stock levels - only 3 available, need 10
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'stock-1',
            data: () => ({
              inventoryItemId: 'inv-001',
              currentQuantity: 3,
            }),
          },
        ],
      } as never);

      const report = await bomService.checkMaterialAvailability('order-1');

      expect(report.overallStatus).toBe('shortages');
      expect(report.lines[0].status).toBe('partial');
      expect(report.lines[0].availableQuantity).toBe(3);
      expect(report.lines[0].shortageQuantity).toBe(7); // 10 - 3
      expect(report.totalShortageValue).toBe(875000); // 7 * 125000
    });

    it('should treat labor lines as always in stock', async () => {
      const bomLines = [
        createMockBOMLine({
          id: 'labor-1',
          category: 'labor',
          materialName: 'Assembly Labor',
          requiredQuantity: 8,
          unitCost: 15000,
          inventoryItemId: undefined,
        }),
      ];

      // getBOM
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: bomLines.map(line => ({
          id: line.id,
          data: () => {
            const { id: _id, ...rest } = line;
            return rest;
          },
        })),
      } as never);

      const report = await bomService.checkMaterialAvailability('order-1');

      expect(report.overallStatus).toBe('all_available');
      expect(report.lines[0].status).toBe('in_stock');
      expect(report.lines[0].availableQuantity).toBe(8); // matches required
      expect(report.lines[0].shortageQuantity).toBe(0);
    });

    it('should handle out-of-stock materials correctly', async () => {
      const bomLines = [
        createMockBOMLine({
          id: 'bom-1',
          inventoryItemId: 'inv-001',
          materialName: 'Exotic Veneer',
          requiredQuantity: 2,
          unitCost: 500000,
          category: 'sheet_material',
        }),
      ];

      // getBOM
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: bomLines.map(line => ({
          id: line.id,
          data: () => {
            const { id: _id, ...rest } = line;
            return rest;
          },
        })),
      } as never);

      // Stock levels - no matching stock
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'stock-other',
            data: () => ({
              inventoryItemId: 'inv-999', // Different item
              currentQuantity: 50,
            }),
          },
        ],
      } as never);

      const report = await bomService.checkMaterialAvailability('order-1');

      expect(report.overallStatus).toBe('shortages');
      expect(report.lines[0].status).toBe('out_of_stock');
      expect(report.lines[0].availableQuantity).toBe(0);
      expect(report.lines[0].shortageQuantity).toBe(2);
      expect(report.totalShortageValue).toBe(1000000); // 2 * 500000
    });
  });

  // ------------------------------------------
  // getBOMCostSummary
  // ------------------------------------------
  describe('getBOMCostSummary', () => {
    it('should correctly separate material and labor costs', async () => {
      const bomLines = [
        createMockBOMLine({
          id: 'mat-1',
          category: 'sheet_material',
          materialName: 'MDF 18mm',
          totalEstimatedCost: 500000,
          totalActualCost: 480000,
          wasteQuantity: 0.5,
          unitCost: 125000,
        }),
        createMockBOMLine({
          id: 'mat-2',
          category: 'hardware',
          materialName: 'Hinges',
          totalEstimatedCost: 60000,
          totalActualCost: 60000,
          wasteQuantity: 0,
          unitCost: 10000,
        }),
        createMockBOMLine({
          id: 'labor-1',
          category: 'labor',
          materialName: 'CNC Cutting',
          totalEstimatedCost: 200000,
          totalActualCost: 220000,
          wasteQuantity: 0,
          unitCost: 25000,
        }),
        createMockBOMLine({
          id: 'labor-2',
          category: 'labor',
          materialName: 'Assembly',
          totalEstimatedCost: 150000,
          totalActualCost: 160000,
          wasteQuantity: 0,
          unitCost: 15000,
        }),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: bomLines.map(line => ({
          id: line.id,
          data: () => {
            const { id: _id, ...rest } = line;
            return rest;
          },
        })),
      } as never);

      const summary = await bomService.getBOMCostSummary('order-1');

      // Material costs (sheet_material + hardware)
      expect(summary.totalEstimatedMaterialCost).toBe(560000); // 500000 + 60000
      expect(summary.totalActualMaterialCost).toBe(540000); // 480000 + 60000

      // Labor costs
      expect(summary.totalEstimatedLaborCost).toBe(350000); // 200000 + 150000
      expect(summary.totalActualLaborCost).toBe(380000); // 220000 + 160000

      // Scrap cost (only from material lines)
      expect(summary.totalScrapCost).toBe(62500); // 0.5 * 125000

      // Metadata
      expect(summary.currency).toBe('UGX');
      expect(summary.lineCount).toBe(4);
    });

    it('should return zeros when no BOM lines exist', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [],
      } as never);

      const summary = await bomService.getBOMCostSummary('order-empty');

      expect(summary.totalEstimatedMaterialCost).toBe(0);
      expect(summary.totalActualMaterialCost).toBe(0);
      expect(summary.totalEstimatedLaborCost).toBe(0);
      expect(summary.totalActualLaborCost).toBe(0);
      expect(summary.totalScrapCost).toBe(0);
      expect(summary.lineCount).toBe(0);
    });

    it('should handle BOM with only material lines (no labor)', async () => {
      const bomLines = [
        createMockBOMLine({
          id: 'mat-1',
          category: 'sheet_material',
          totalEstimatedCost: 500000,
          totalActualCost: 490000,
          wasteQuantity: 1,
          unitCost: 125000,
        }),
        createMockBOMLine({
          id: 'mat-2',
          category: 'finishing',
          totalEstimatedCost: 80000,
          totalActualCost: 85000,
          wasteQuantity: 0.2,
          unitCost: 40000,
        }),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: bomLines.map(line => ({
          id: line.id,
          data: () => {
            const { id: _id, ...rest } = line;
            return rest;
          },
        })),
      } as never);

      const summary = await bomService.getBOMCostSummary('order-1');

      expect(summary.totalEstimatedMaterialCost).toBe(580000);
      expect(summary.totalActualMaterialCost).toBe(575000);
      expect(summary.totalEstimatedLaborCost).toBe(0);
      expect(summary.totalActualLaborCost).toBe(0);
      expect(summary.totalScrapCost).toBe(133000); // (1 * 125000) + (0.2 * 40000)
      expect(summary.lineCount).toBe(2);
    });

    it('should handle BOM with only labor lines (no materials)', async () => {
      const bomLines = [
        createMockBOMLine({
          id: 'labor-1',
          category: 'labor',
          totalEstimatedCost: 300000,
          totalActualCost: 310000,
          wasteQuantity: 0,
          unitCost: 30000,
        }),
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: bomLines.map(line => ({
          id: line.id,
          data: () => {
            const { id: _id, ...rest } = line;
            return rest;
          },
        })),
      } as never);

      const summary = await bomService.getBOMCostSummary('order-1');

      expect(summary.totalEstimatedMaterialCost).toBe(0);
      expect(summary.totalActualMaterialCost).toBe(0);
      expect(summary.totalEstimatedLaborCost).toBe(300000);
      expect(summary.totalActualLaborCost).toBe(310000);
      expect(summary.totalScrapCost).toBe(0);
      expect(summary.lineCount).toBe(1);
    });
  });
});
