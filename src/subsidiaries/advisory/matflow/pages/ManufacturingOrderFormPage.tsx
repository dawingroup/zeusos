/**
 * Manufacturing Order Form Page
 * Create a new manufacturing/production work order
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Factory,
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { createManufacturingOrder } from '../services/manufacturing-service';
import type { ManufacturingPriority, CreateManufacturingOrderInput } from '../types/manufacturing';

interface MaterialRow {
  materialId: string;
  materialName: string;
  unit: string;
  quantityRequired: number;
  unitCost: number;
}

const PRIORITY_OPTIONS: { value: ManufacturingPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const UNIT_OPTIONS = ['pcs', 'sets', 'sqm', 'lm', 'kg', 'tonnes', 'bags', 'trips', 'panels', 'sheets'];

const ManufacturingOrderFormPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('pcs');
  const [priority, setPriority] = useState<ManufacturingPriority>('medium');
  const [workCenter, setWorkCenter] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [qualityCheckRequired, setQualityCheckRequired] = useState(false);
  const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>([
    { materialId: '', materialName: '', unit: 'pcs', quantityRequired: 0, unitCost: 0 },
  ]);

  const addMaterialRow = () => {
    setMaterials(prev => [...prev, { materialId: '', materialName: '', unit: 'pcs', quantityRequired: 0, unitCost: 0 }]);
  };

  const removeMaterialRow = (index: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: keyof MaterialRow, value: string | number) => {
    setMaterials(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const totalMaterialCost = materials.reduce((sum, m) => sum + (m.quantityRequired * m.unitCost), 0);

  const isValid = productName.trim() && quantity > 0 && projectId;

  const handleSubmit = async () => {
    if (!isValid || !user || !projectId) return;
    setSaving(true);
    try {
      const input: CreateManufacturingOrderInput = {
        productName: productName.trim(),
        productDescription: productDescription.trim() || undefined,
        quantity,
        unit,
        priority,
        workCenter: workCenter.trim() || undefined,
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : undefined,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : undefined,
        qualityCheckRequired,
        notes: notes.trim() || undefined,
        materials: materials
          .filter(m => m.materialName.trim())
          .map(m => ({
            materialId: m.materialId || m.materialName.toLowerCase().replace(/\s+/g, '_'),
            materialName: m.materialName.trim(),
            unit: m.unit,
            quantityRequired: m.quantityRequired,
            unitCost: m.unitCost,
          })),
      };

      const userName = user.displayName || user.email || 'Unknown';
      await createManufacturingOrder(projectId, input, user.uid, userName);
      navigate(`/advisory/delivery/projects/${projectId}/manufacturing`);
    } catch (err) {
      console.error('Failed to create manufacturing order:', err);
      alert('Failed to create manufacturing order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="h-6 w-6 text-amber-600" />
            New Manufacturing Order
          </h1>
          <p className="text-muted-foreground">Create a production work order</p>
        </div>
      </div>

      {/* Product Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Product Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              type="text"
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="e.g., Precast Concrete Panels, Steel Trusses"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={productDescription}
              onChange={e => setProductDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of what's being manufactured..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {UNIT_OPTIONS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as ManufacturingPriority)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {PRIORITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Center</label>
            <input
              type="text"
              value={workCenter}
              onChange={e => setWorkCenter(e.target.value)}
              placeholder="e.g., Workshop A, Site Factory"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Timeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start</label>
            <input
              type="date"
              value={plannedStartDate}
              onChange={e => setPlannedStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned End</label>
            <input
              type="date"
              value={plannedEndDate}
              onChange={e => setPlannedEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Bill of Materials */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Bill of Materials</h3>
          <button
            onClick={addMaterialRow}
            className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-3">Material Name</th>
                <th className="pb-2 pr-3 w-24">Unit</th>
                <th className="pb-2 pr-3 w-28 text-right">Qty Required</th>
                <th className="pb-2 pr-3 w-32 text-right">Unit Cost (UGX)</th>
                <th className="pb-2 pr-3 w-32 text-right">Total</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {materials.map((m, idx) => (
                <tr key={idx}>
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      value={m.materialName}
                      onChange={e => updateMaterial(idx, 'materialName', e.target.value)}
                      placeholder="Material name"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={m.unit}
                      onChange={e => updateMaterial(idx, 'unit', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    >
                      {UNIT_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      value={m.quantityRequired || ''}
                      onChange={e => updateMaterial(idx, 'quantityRequired', Number(e.target.value))}
                      min={0}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      value={m.unitCost || ''}
                      onChange={e => updateMaterial(idx, 'unitCost', Number(e.target.value))}
                      min={0}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                    />
                  </td>
                  <td className="py-2 pr-3 text-right font-medium text-gray-700">
                    {formatCurrency(m.quantityRequired * m.unitCost)}
                  </td>
                  <td className="py-2">
                    {materials.length > 1 && (
                      <button
                        onClick={() => removeMaterialRow(idx)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td colSpan={4} className="pt-3 text-right text-gray-700">Total Material Cost:</td>
                <td className="pt-3 text-right text-gray-900">{formatCurrency(totalMaterialCost)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Options */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Options</h3>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={qualityCheckRequired}
            onChange={e => setQualityCheckRequired(e.target.checked)}
            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm text-gray-700">Quality check required before completion</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional notes or instructions..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Create Order
        </button>
      </div>
    </div>
  );
};

export default ManufacturingOrderFormPage;
