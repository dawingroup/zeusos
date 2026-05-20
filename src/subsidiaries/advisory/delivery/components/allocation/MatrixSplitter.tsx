/**
 * MATRIX SPLITTER
 *
 * Line-item × project allocation grid for Quick Capture.
 * Rows = expense line items from receipt, columns = projects.
 * Cells contain quantity inputs; amounts auto-compute.
 *
 * Mobile-first: sticky item column, horizontally scrollable project columns.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import type {
  CaptureLineItem,
  MatrixCell,
  MatrixProject,
} from '../../types/allocation';
import { COMMON_UNITS } from '../../types/allocation';
import { formatBudgetAmount } from '../../types/project-budget';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';
import type { RowValidation, MatrixValidation } from '../../hooks/useMatrixAllocation';
import { ProjectPicker } from '../quick-capture/ProjectPicker';

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────

interface MatrixSplitterProps {
  currency: 'UGX' | 'USD';
  lineItems: CaptureLineItem[];
  onAddLineItem: (item: Omit<CaptureLineItem, 'id' | 'totalPrice'>) => void;
  onRemoveLineItem: (id: string) => void;
  selectedProjects: MatrixProject[];
  onAddProject: (project: Project) => void;
  onRemoveProject: (projectId: string) => void;
  cells: Record<string, MatrixCell>;
  onUpdateCell: (lineItemId: string, projectId: string, quantity: number) => void;
  activeProjects: Project[];
  projectsLoading?: boolean;
  projectsError?: Error | null;
  validation: MatrixValidation;
  projectTotals: Record<string, number>;
  rationale: string;
  onRationaleChange: (r: string) => void;
}

function cellKey(lineItemId: string, projectId: string) {
  return `${lineItemId}:${projectId}`;
}

// ─────────────────────────────────────────────────────────────────
// LINE ITEM EDITOR (inline card)
// ─────────────────────────────────────────────────────────────────

interface LineItemEditorProps {
  item?: CaptureLineItem;
  onSave: (item: Omit<CaptureLineItem, 'id' | 'totalPrice'>) => void;
  onCancel: () => void;
}

function LineItemEditor({ item, onSave, onCancel }: LineItemEditorProps) {
  const [description, setDescription] = useState(item?.description || '');
  const [quantity, setQuantity] = useState(item?.quantity?.toString() || '');
  const [unit, setUnit] = useState(item?.unit || 'pcs');
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice?.toString() || '');
  const budgetCategory = item?.budgetCategory || 'materials';

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const total = qty * price;
  const isValid = description.trim() && qty > 0 && price > 0;

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Item description (e.g. Cement bags)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] bg-white"
        autoFocus
      />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Qty</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Unit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] bg-white"
          >
            {COMMON_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Unit Price</label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            min="1"
            step="1"
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px] bg-white"
          />
        </div>
      </div>
      {total > 0 && (
        <p className="text-xs text-gray-500 text-right">
          Line total: <span className="font-semibold text-gray-700">{total.toLocaleString()}</span>
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (!isValid) return;
            onSave({ description: description.trim(), quantity: qty, unit, unitPrice: price, budgetCategory });
          }}
          disabled={!isValid}
          className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:bg-gray-300 min-h-[44px]"
        >
          {item ? 'Update' : 'Add Item'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-lg min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export function MatrixSplitter({
  currency,
  lineItems,
  onAddLineItem,
  onRemoveLineItem,
  selectedProjects,
  onAddProject,
  onRemoveProject,
  cells,
  onUpdateCell,
  activeProjects,
  projectsLoading,
  projectsError,
  validation,
  projectTotals,
  rationale,
  onRationaleChange,
}: MatrixSplitterProps) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(true);

  const rowValidationMap = useMemo(() => {
    const map: Record<string, RowValidation> = {};
    for (const rv of validation.rows) {
      map[rv.lineItemId] = rv;
    }
    return map;
  }, [validation.rows]);

  const excludedProjectIds = useMemo(
    () => selectedProjects.map((p) => p.projectId),
    [selectedProjects]
  );

  const handleProjectSelect = useCallback(
    (projectId: string, _projectName: string, _programId: string, _cur: 'UGX' | 'USD') => {
      const project = activeProjects.find((p) => p.id === projectId);
      if (project) {
        onAddProject(project);
      }
      setShowProjectPicker(false);
    },
    [activeProjects, onAddProject]
  );

  return (
    <div className="space-y-4">
      {/* ── 1. Line Items ──────────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setItemsExpanded(!itemsExpanded)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700 py-2 min-h-[44px]"
        >
          <span className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Line Items ({lineItems.length})
          </span>
          {itemsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {itemsExpanded && (
          <div className="space-y-2 mt-1">
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.description}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} {item.unit} × {item.unitPrice.toLocaleString()} ={' '}
                    <span className="font-semibold">{item.totalPrice.toLocaleString()}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveLineItem(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {showAddItem ? (
              <LineItemEditor
                onSave={(item) => {
                  onAddLineItem(item);
                  setShowAddItem(false);
                }}
                onCancel={() => setShowAddItem(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddItem(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                Add Line Item
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Project Columns ─────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Projects to Split Across
        </label>
        <div className="flex flex-wrap gap-2">
          {selectedProjects.map((proj) => (
            <span
              key={proj.projectId}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-full border border-indigo-200"
            >
              {proj.projectName}
              <button
                type="button"
                onClick={() => onRemoveProject(proj.projectId)}
                className="p-0.5 hover:text-red-600 rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setShowProjectPicker(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 border-2 border-dashed border-gray-300 text-sm text-gray-500 rounded-full hover:border-indigo-400 hover:text-indigo-600 transition-colors min-h-[36px]"
          >
            <Plus className="w-3 h-3" />
            Add Project
          </button>
        </div>

        {/* Project picker overlay (auto-opens when triggered) */}
        {showProjectPicker && (
          <ProjectPicker
            value={null}
            onChange={handleProjectSelect}
            projects={activeProjects}
            loading={projectsLoading}
            error={projectsError}
            excludeIds={excludedProjectIds}
            autoOpen
            onClose={() => setShowProjectPicker(false)}
          />
        )}
      </div>

      {/* ── 3. Allocation Matrix Grid ─────────────────────────── */}
      {lineItems.length > 0 && selectedProjects.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Header */}
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase min-w-[140px] max-w-[140px]">
                    Item
                  </th>
                  {selectedProjects.map((proj) => (
                    <th
                      key={proj.projectId}
                      className="text-center px-2 py-2 text-xs font-semibold text-gray-500 min-w-[100px]"
                    >
                      <div className="truncate max-w-[100px]" title={proj.projectName}>
                        {proj.projectName}
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 bg-gray-50 text-center px-3 py-2 text-xs font-semibold text-gray-500 min-w-[80px]">
                    Status
                  </th>
                </tr>
              </thead>

              {/* Body: one row per line item */}
              <tbody>
                {lineItems.map((item) => {
                  const rv = rowValidationMap[item.id];
                  return (
                    <tr key={item.id} className="border-b border-gray-100">
                      {/* Sticky item column */}
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[130px]">
                          {item.description}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.quantity} {item.unit}
                        </p>
                      </td>

                      {/* Quantity input cells */}
                      {selectedProjects.map((proj) => {
                        const key = cellKey(item.id, proj.projectId);
                        const cell = cells[key];
                        return (
                          <td key={proj.projectId} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={cell?.allocatedQuantity || ''}
                              onChange={(e) =>
                                onUpdateCell(item.id, proj.projectId, parseFloat(e.target.value) || 0)
                              }
                              placeholder="0"
                              className="w-full text-center border border-gray-300 rounded-md px-2 py-2 text-sm min-h-[44px] bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            {cell && cell.allocatedAmount > 0 && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {cell.allocatedAmount.toLocaleString()}
                              </p>
                            )}
                          </td>
                        );
                      })}

                      {/* Row validation status */}
                      <td className="sticky right-0 z-10 bg-white px-3 py-2 text-center border-l border-gray-100">
                        {rv?.isValid ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                            {rv.allocatedQty}/{rv.totalQty}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            {rv?.allocatedQty ?? 0}/{rv?.totalQty ?? item.quantity}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer: column totals */}
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                    Project Total
                  </td>
                  {selectedProjects.map((proj) => (
                    <td key={proj.projectId} className="px-2 py-2 text-center">
                      <p className="text-xs font-semibold text-gray-900">
                        {formatBudgetAmount(projectTotals[proj.projectId] ?? 0, currency)}
                      </p>
                    </td>
                  ))}
                  <td className="sticky right-0 z-10 bg-gray-50 px-3 py-2 text-center">
                    <p className="text-xs font-bold text-gray-900">
                      {formatBudgetAmount(validation.grandTotal, currency)}
                    </p>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {lineItems.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Add line items to start splitting across projects</p>
        </div>
      )}
      {lineItems.length > 0 && selectedProjects.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <p className="text-sm">Select at least 2 projects to allocate items</p>
        </div>
      )}

      {/* ── 4. Summary Bar ─────────────────────────────────────── */}
      {lineItems.length > 0 && selectedProjects.length > 0 && (
        <div
          className={`flex items-center justify-between p-3 rounded-lg border ${
            validation.allRowsValid && validation.grandTotalValid
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div>
            <p className="text-sm font-medium text-gray-900">
              Allocated: {formatBudgetAmount(validation.grandTotal, currency)}{' '}
              <span className="text-gray-500">
                of {formatBudgetAmount(validation.expectedTotal, currency)}
              </span>
            </p>
            <p className="text-xs text-gray-500">
              {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} across{' '}
              {selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            {validation.allRowsValid && validation.grandTotalValid ? (
              <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Balanced
              </span>
            ) : !validation.allRowsValid ? (
              <span className="text-sm text-amber-600 font-medium">
                {validation.rows.filter((r) => !r.isValid).length} row(s) incomplete
              </span>
            ) : (
              <span className="text-sm text-amber-600 font-medium">
                Total mismatch
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Rationale ───────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Allocation Rationale <span className="text-red-500">*</span>
        </label>
        <textarea
          value={rationale}
          onChange={(e) => onRationaleChange(e.target.value)}
          placeholder="Explain why these items are being split across these projects..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none"
        />
      </div>
    </div>
  );
}
