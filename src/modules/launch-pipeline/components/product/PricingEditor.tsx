/**
 * PricingEditor
 * UI for setting product pricing with margin calculation
 */

import { DollarSign } from 'lucide-react';
import type { ProductPricing } from '../../types/product.types';

interface PricingEditorProps {
  pricing: ProductPricing;
  onChange: (pricing: ProductPricing) => void;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'UGX', label: 'UGX (USh)' },
  { value: 'EUR', label: 'EUR (\u20AC)' },
  { value: 'GBP', label: 'GBP (\u00A3)' },
  { value: 'KES', label: 'KES (KSh)' },
];

export function PricingEditor({ pricing, onChange }: PricingEditorProps) {
  const margin = pricing.basePrice > 0 && pricing.costPerItem
    ? ((pricing.basePrice - pricing.costPerItem) / pricing.basePrice * 100).toFixed(1)
    : null;

  const update = (fields: Partial<ProductPricing>) => {
    onChange({ ...pricing, ...fields });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="w-4 h-4 text-gray-500" />
        <h4 className="text-sm font-medium text-gray-900">Pricing</h4>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Base Price *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={pricing.basePrice || ''}
            onChange={(e) => update({ basePrice: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={pricing.currency}
            onChange={(e) => update({ currency: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {CURRENCIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Compare-at Price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={pricing.compareAtPrice || ''}
            onChange={(e) => update({ compareAtPrice: parseFloat(e.target.value) || undefined })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Original price (optional)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Item</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={pricing.costPerItem || ''}
            onChange={(e) => update({ costPerItem: parseFloat(e.target.value) || undefined })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Your cost (optional)"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={pricing.taxable}
            onChange={(e) => update({ taxable: e.target.checked })}
            className="rounded border-gray-300"
          />
          Charge tax on this product
        </label>
        {margin !== null && (
          <span className={`text-sm font-medium ${parseFloat(margin) > 0 ? 'text-green-600' : 'text-red-600'}`}>
            Margin: {margin}%
          </span>
        )}
      </div>
    </div>
  );
}

export default PricingEditor;
