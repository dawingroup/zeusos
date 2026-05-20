/**
 * MATRIX ALLOCATION HOOK
 *
 * Manages state for line-item × project allocation matrix.
 * Each line item's quantity is distributed across selected projects.
 * Amounts auto-compute from allocatedQuantity × unitPrice.
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  CaptureLineItem,
  MatrixCell,
  MatrixProject,
  MatrixAllocationEntry,
} from '../types/allocation';
import type { CreateAllocationInput } from '../services/allocation-service';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function cellKey(lineItemId: string, projectId: string) {
  return `${lineItemId}:${projectId}`;
}

// ─────────────────────────────────────────────────────────────────
// VALIDATION TYPES
// ─────────────────────────────────────────────────────────────────

export interface RowValidation {
  lineItemId: string;
  totalQty: number;
  allocatedQty: number;
  isValid: boolean;               // allocatedQty === totalQty
  remaining: number;
}

export interface MatrixValidation {
  rows: RowValidation[];
  allRowsValid: boolean;
  grandTotal: number;
  expectedTotal: number;
  grandTotalValid: boolean;       // within rounding tolerance
  isComplete: boolean;            // all rows valid + at least 2 projects + line items exist
}

// ─────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────

export function useMatrixState(totalAmount: number, currency: 'UGX' | 'USD') {
  const [lineItems, setLineItems] = useState<CaptureLineItem[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<MatrixProject[]>([]);
  const [cells, setCells] = useState<Record<string, MatrixCell>>({});
  const [rationale, setRationale] = useState('');

  // ── Line Item Operations ─────────────────────────────────────

  const addLineItem = useCallback((item: Omit<CaptureLineItem, 'id' | 'totalPrice'>) => {
    const newItem: CaptureLineItem = {
      ...item,
      id: crypto.randomUUID(),
      totalPrice: item.quantity * item.unitPrice,
    };
    setLineItems((prev) => [...prev, newItem]);
    return newItem.id;
  }, []);

  const updateLineItem = useCallback((id: string, updates: Partial<CaptureLineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        // Recompute totalPrice if quantity or unitPrice changed
        if ('quantity' in updates || 'unitPrice' in updates) {
          updated.totalPrice = updated.quantity * updated.unitPrice;
        }
        return updated;
      })
    );
    // Recompute cell amounts if unitPrice changed
    if ('unitPrice' in updates) {
      setCells((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].lineItemId === id) {
            next[key] = {
              ...next[key],
              allocatedAmount: next[key].allocatedQuantity * (updates.unitPrice ?? 0),
            };
          }
        }
        return next;
      });
    }
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
    // Remove all cells for this line item
    setCells((prev) => {
      const next: Record<string, MatrixCell> = {};
      for (const [key, cell] of Object.entries(prev)) {
        if (cell.lineItemId !== id) next[key] = cell;
      }
      return next;
    });
  }, []);

  const setAllLineItems = useCallback((items: CaptureLineItem[]) => {
    setLineItems(items);
    // Clear cells that reference removed line items
    const itemIds = new Set(items.map((i) => i.id));
    setCells((prev) => {
      const next: Record<string, MatrixCell> = {};
      for (const [key, cell] of Object.entries(prev)) {
        if (itemIds.has(cell.lineItemId)) next[key] = cell;
      }
      return next;
    });
  }, []);

  // ── Project Operations ───────────────────────────────────────

  const addProject = useCallback((project: Project) => {
    setSelectedProjects((prev) => {
      if (prev.some((p) => p.projectId === project.id)) return prev;
      return [
        ...prev,
        {
          projectId: project.id,
          projectName: project.name,
          programId: project.programId,
          budgetCategory: 'materials',
          availableBudget: project.budget?.remaining ?? 0,
        },
      ];
    });
  }, []);

  const removeProject = useCallback((projectId: string) => {
    setSelectedProjects((prev) => prev.filter((p) => p.projectId !== projectId));
    // Remove all cells for this project
    setCells((prev) => {
      const next: Record<string, MatrixCell> = {};
      for (const [key, cell] of Object.entries(prev)) {
        if (cell.projectId !== projectId) next[key] = cell;
      }
      return next;
    });
  }, []);

  // ── Cell Operations ──────────────────────────────────────────

  const updateCell = useCallback(
    (lineItemId: string, projectId: string, allocatedQuantity: number) => {
      const key = cellKey(lineItemId, projectId);
      const item = lineItems.find((i) => i.id === lineItemId);
      const unitPrice = item?.unitPrice ?? 0;

      setCells((prev) => ({
        ...prev,
        [key]: {
          lineItemId,
          projectId,
          allocatedQuantity,
          allocatedAmount: allocatedQuantity * unitPrice,
        },
      }));
    },
    [lineItems]
  );

  // ── Validation ───────────────────────────────────────────────

  const validation: MatrixValidation = useMemo(() => {
    const tolerance = currency === 'UGX' ? 2 : 0.02;

    const rows: RowValidation[] = lineItems.map((item) => {
      let allocatedQty = 0;
      for (const proj of selectedProjects) {
        const key = cellKey(item.id, proj.projectId);
        allocatedQty += cells[key]?.allocatedQuantity ?? 0;
      }
      return {
        lineItemId: item.id,
        totalQty: item.quantity,
        allocatedQty,
        isValid: Math.abs(allocatedQty - item.quantity) < 0.001,
        remaining: item.quantity - allocatedQty,
      };
    });

    const allRowsValid = rows.length > 0 && rows.every((r) => r.isValid);

    // Grand total = sum of all cell amounts
    let grandTotal = 0;
    for (const cell of Object.values(cells)) {
      grandTotal += cell.allocatedAmount;
    }

    // Expected total = sum of line item totals
    const expectedTotal = lineItems.reduce((s, i) => s + i.totalPrice, 0);
    const grandTotalValid = Math.abs(grandTotal - expectedTotal) < tolerance;

    const isComplete =
      allRowsValid &&
      selectedProjects.length >= 2 &&
      lineItems.length >= 1 &&
      rationale.trim().length > 0;

    return { rows, allRowsValid, grandTotal, expectedTotal, grandTotalValid, isComplete };
  }, [lineItems, selectedProjects, cells, currency, rationale]);

  // ── Column Totals (per-project) ──────────────────────────────

  const projectTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const proj of selectedProjects) {
      let total = 0;
      for (const item of lineItems) {
        const key = cellKey(item.id, proj.projectId);
        total += cells[key]?.allocatedAmount ?? 0;
      }
      totals[proj.projectId] = total;
    }
    return totals;
  }, [selectedProjects, lineItems, cells]);

  // ── Convert to CreateAllocationInput ─────────────────────────

  const toAllocationInput = useCallback((): Pick<
    CreateAllocationInput,
    'allocations' | 'allocationMethod'
  > & {
    lineItems: CaptureLineItem[];
    matrixAllocations: MatrixAllocationEntry[];
  } => {
    // Per-project totals for the legacy allocations[] array
    const allocations = selectedProjects.map((proj) => {
      let allocatedAmount = 0;
      for (const item of lineItems) {
        const key = cellKey(item.id, proj.projectId);
        allocatedAmount += cells[key]?.allocatedAmount ?? 0;
      }
      const percentage =
        totalAmount > 0 ? Math.round((allocatedAmount / totalAmount) * 1000) / 10 : 0;

      return {
        projectId: proj.projectId,
        projectName: proj.projectName,
        programId: proj.programId,
        budgetCategory: proj.budgetCategory,
        percentage,
        allocatedAmount,
      };
    });

    // Detailed per-cell entries
    const matrixAllocations: MatrixAllocationEntry[] = [];
    for (const item of lineItems) {
      for (const proj of selectedProjects) {
        const key = cellKey(item.id, proj.projectId);
        const cell = cells[key];
        if (cell && cell.allocatedQuantity > 0) {
          matrixAllocations.push({
            lineItemId: item.id,
            lineItemDescription: item.description,
            projectId: proj.projectId,
            projectName: proj.projectName,
            programId: proj.programId,
            budgetCategory: proj.budgetCategory,
            allocatedQuantity: cell.allocatedQuantity,
            unitPrice: item.unitPrice,
            allocatedAmount: cell.allocatedAmount,
          });
        }
      }
    }

    return {
      allocationMethod: 'FixedAmount' as const,
      allocations,
      lineItems,
      matrixAllocations,
    };
  }, [selectedProjects, lineItems, cells, totalAmount]);

  return {
    // State
    lineItems,
    selectedProjects,
    cells,
    rationale,

    // Line item ops
    addLineItem,
    updateLineItem,
    removeLineItem,
    setAllLineItems,

    // Project ops
    addProject,
    removeProject,

    // Cell ops
    updateCell,

    // Rationale
    setRationale,

    // Derived
    validation,
    projectTotals,
    toAllocationInput,
  };
}
