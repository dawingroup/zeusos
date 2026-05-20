/**
 * BOQ Item Form
 */

import React, { useState } from 'react';
import { MeasurementUnit, ConstructionStage } from '../../utils/reviewHelpers';
import type { CreateBOQItemInput } from '../../services/boqService';

interface BOQItemFormProps {
  onSubmit: (data: CreateBOQItemInput) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CreateBOQItemInput>;
}

export const BOQItemForm: React.FC<BOQItemFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
}) => {
  const [formData, setFormData] = useState<CreateBOQItemInput>({
    itemCode: initialData?.itemCode || '',
    description: initialData?.description || '',
    unit: initialData?.unit || MeasurementUnit.PIECES,
    quantityContract: initialData?.quantityContract || 0,
    rate: initialData?.rate || 0,
    stage: initialData?.stage || ConstructionStage.SUBSTRUCTURE,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Code
          </label>
          <input
            type="text"
            value={formData.itemCode}
            onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stage
          </label>
          <select
            value={formData.stage}
            onChange={(e) => setFormData({ ...formData, stage: e.target.value as ConstructionStage })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            {Object.values(ConstructionStage).map(stage => (
              <option key={stage} value={stage}>
                {stage.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          rows={3}
          required
        />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={formData.quantityContract}
            onChange={(e) => setFormData({ ...formData, quantityContract: parseFloat(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            min="0"
            step="0.01"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit
          </label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value as MeasurementUnit })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            {Object.values(MeasurementUnit).map(unit => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rate (UGX)
          </label>
          <input
            type="number"
            value={formData.rate}
            onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            min="0"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Item'}
        </button>
      </div>
    </form>
  );
};
