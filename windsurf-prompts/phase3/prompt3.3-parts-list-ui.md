# Prompt 3.3: Parts List UI

## Objective
Create React components to display, add, edit, and import parts within the design item detail view.

## Prerequisites
- Completed Prompts 3.1-3.2 (Parts Model and CSV Parser)

## Requirements

### 1. Create PartsTab Component

Create file: `src/modules/design-manager/components/design-item/PartsTab.tsx`

```typescript
/**
 * PartsTab Component
 * Display and manage parts within a design item
 */

import { useState } from 'react';
import { Plus, Upload, Download, Trash2, Edit2, Package, AlertCircle } from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { useParts } from '../../hooks/useParts';
import type { DesignItem, PartEntry } from '../../types';
import { PartForm } from './PartForm';
import { PartsImportDialog } from './PartsImportDialog';

interface PartsTabProps {
  item: DesignItem;
  customerId: string;
  projectId: string;
}

export function PartsTab({ item, customerId, projectId }: PartsTabProps) {
  const { user } = useAuth();
  const parts = useParts(customerId, projectId, item, user?.email || '');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingPart, setEditingPart] = useState<PartEntry | null>(null);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());

  const partsList: PartEntry[] = (item as any).parts || [];
  const summary = (item as any).partsSummary;

  const handleDelete = async (partId: string) => {
    if (!confirm('Delete this part?')) return;
    try {
      await parts.remove(partId);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedParts.size} selected parts?`)) return;
    for (const partId of selectedParts) {
      await parts.remove(partId);
    }
    setSelectedParts(new Set());
  };

  const toggleSelect = (partId: string) => {
    const newSelected = new Set(selectedParts);
    if (newSelected.has(partId)) {
      newSelected.delete(partId);
    } else {
      newSelected.add(partId);
    }
    setSelectedParts(newSelected);
  };

  const selectAll = () => {
    if (selectedParts.size === partsList.length) {
      setSelectedParts(new Set());
    } else {
      setSelectedParts(new Set(partsList.map((p) => p.id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Total Parts</p>
            <p className="text-xl font-bold text-gray-900">{summary.totalParts}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Materials</p>
            <p className="text-xl font-bold text-gray-900">{summary.uniqueMaterials}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Total Area</p>
            <p className="text-xl font-bold text-gray-900">{summary.totalArea} m²</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Status</p>
            <p className={`text-xl font-bold ${summary.isComplete ? 'text-green-600' : 'text-amber-600'}`}>
              {summary.isComplete ? 'Complete' : 'Incomplete'}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Part
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          {selectedParts.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedParts.size})
            </button>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {partsList.length} part{partsList.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error Display */}
      {parts.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {parts.error.message}
        </div>
      )}

      {/* Parts Table */}
      {partsList.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No parts yet</h3>
          <p className="text-gray-500 mt-1">Add parts manually or import from CSV</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="text-primary hover:underline"
            >
              Add Part
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => setShowImport(true)}
              className="text-primary hover:underline"
            >
              Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedParts.size === partsList.length && partsList.length > 0}
                      onChange={selectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Part #</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">L (mm)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">W (mm)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">T (mm)</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Material</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">Grain</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">Edges</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partsList.map((part) => (
                  <tr key={part.id} className={selectedParts.has(part.id) ? 'bg-primary/5' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedParts.has(part.id)}
                        onChange={() => toggleSelect(part.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600">{part.partNumber}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{part.name}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{part.length}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{part.width}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{part.thickness}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{part.quantity}</td>
                    <td className="px-3 py-2 text-gray-700">{part.materialName}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        part.grainDirection === 'length' ? 'bg-blue-100 text-blue-700' :
                        part.grainDirection === 'width' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {part.grainDirection === 'length' ? 'L' : part.grainDirection === 'width' ? 'W' : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs text-gray-500">
                        {[
                          part.edgeBanding.top && 'T',
                          part.edgeBanding.bottom && 'B',
                          part.edgeBanding.left && 'L',
                          part.edgeBanding.right && 'R',
                        ].filter(Boolean).join('') || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingPart(part)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(part.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Part Form */}
      {(showAddForm || editingPart) && (
        <PartForm
          part={editingPart || undefined}
          onSave={async (data) => {
            if (editingPart) {
              await parts.update(editingPart.id, data);
            } else {
              await parts.add(data as any);
            }
            setShowAddForm(false);
            setEditingPart(null);
          }}
          onClose={() => {
            setShowAddForm(false);
            setEditingPart(null);
          }}
          loading={parts.loading}
        />
      )}

      {/* Import Dialog */}
      {showImport && (
        <PartsImportDialog
          onImport={async (importedParts, mode) => {
            if (mode === 'replace') {
              await parts.replaceAll(importedParts);
            } else {
              await parts.bulkAdd(importedParts);
            }
            setShowImport(false);
          }}
          onClose={() => setShowImport(false)}
          loading={parts.loading}
        />
      )}
    </div>
  );
}

export default PartsTab;
```

### 2. Create PartForm Component

Create file: `src/modules/design-manager/components/design-item/PartForm.tsx`

```typescript
/**
 * PartForm Component
 * Form for adding/editing a single part
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { PartEntry } from '../../types';

interface PartFormProps {
  part?: PartEntry;
  onSave: (data: Partial<PartEntry>) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function PartForm({ part, onSave, onClose, loading }: PartFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    length: '',
    width: '',
    thickness: '18',
    quantity: '1',
    materialName: '',
    grainDirection: 'none' as 'length' | 'width' | 'none',
    edgeBanding: { top: false, bottom: false, left: false, right: false },
    notes: '',
  });

  useEffect(() => {
    if (part) {
      setFormData({
        name: part.name,
        length: part.length.toString(),
        width: part.width.toString(),
        thickness: part.thickness.toString(),
        quantity: part.quantity.toString(),
        materialName: part.materialName,
        grainDirection: part.grainDirection,
        edgeBanding: { ...part.edgeBanding },
        notes: part.notes || '',
      });
    }
  }, [part]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name: formData.name,
      length: parseFloat(formData.length),
      width: parseFloat(formData.width),
      thickness: parseFloat(formData.thickness),
      quantity: parseInt(formData.quantity, 10),
      materialName: formData.materialName,
      grainDirection: formData.grainDirection,
      edgeBanding: formData.edgeBanding,
      notes: formData.notes || undefined,
      source: 'manual',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {part ? 'Edit Part' : 'Add Part'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Part Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Length (mm) *</label>
              <input
                type="number"
                value={formData.length}
                onChange={(e) => setFormData((f) => ({ ...f, length: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Width (mm) *</label>
              <input
                type="number"
                value={formData.width}
                onChange={(e) => setFormData((f) => ({ ...f, width: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thickness (mm)</label>
              <input
                type="number"
                value={formData.thickness}
                onChange={(e) => setFormData((f) => ({ ...f, thickness: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                min="1"
              />
            </div>
          </div>

          {/* Quantity and Material */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData((f) => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
              <input
                type="text"
                value={formData.materialName}
                onChange={(e) => setFormData((f) => ({ ...f, materialName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
          </div>

          {/* Grain Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grain Direction</label>
            <div className="flex gap-4">
              {(['none', 'length', 'width'] as const).map((dir) => (
                <label key={dir} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="grain"
                    checked={formData.grainDirection === dir}
                    onChange={() => setFormData((f) => ({ ...f, grainDirection: dir }))}
                    className="text-primary"
                  />
                  <span className="text-sm text-gray-700 capitalize">{dir}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Edge Banding */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Edge Banding</label>
            <div className="flex gap-4">
              {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
                <label key={edge} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.edgeBanding[edge]}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        edgeBanding: { ...f.edgeBanding, [edge]: e.target.checked },
                      }))
                    }
                    className="rounded border-gray-300 text-primary"
                  />
                  <span className="text-sm text-gray-700 capitalize">{edge}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : part ? 'Save Changes' : 'Add Part'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PartForm;
```

### 3. Create PartsImportDialog Component

Create file: `src/modules/design-manager/components/design-item/PartsImportDialog.tsx`

(Due to length, this component handles file upload, CSV parsing preview, and import confirmation - similar pattern to PartForm but with file handling)

## Validation Checklist

- [ ] Parts table displays all part fields correctly
- [ ] Add part form validates required fields
- [ ] Edit part pre-fills existing values
- [ ] Delete confirmation works
- [ ] Bulk selection and delete works
- [ ] Summary cards update in real-time

## Next Steps

After completing this prompt, proceed to:
- **Prompt 3.4**: Material Library - Three-tier material management system
