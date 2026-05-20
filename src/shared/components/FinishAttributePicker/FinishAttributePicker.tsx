/**
 * FinishAttributePicker Component
 * Composite picker for selecting finish + attributes on an estimate line item.
 * Used by Design Manager and Inventory modules.
 */

import { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import type { FinishDocument, LinkedFinish, FinishCategory } from '@/modules/inventory/types';
import { useFinishLibrary } from '@/modules/inventory/hooks/useFinishLibrary';
import { useFinishAttributes } from '@/modules/inventory/hooks/useFinishAttributes';
import { useVariantResolver, type ResolvedPricePreview } from '@/modules/inventory/hooks/useVariantResolver';
import { getVariantByKey } from '@/modules/inventory/services/productVariantService';
import { generateVariantKey } from '@/modules/inventory/utils/variant-key';
import { FinishSelector } from './FinishSelector';
import { AttributeSelector } from './AttributeSelector';
import { VariantPricePreview } from './VariantPricePreview';

export interface FinishAttributeSelection {
  selectedFinish: {
    finishId: string;
    finishName: string;
    finishCode: string;
    hexColor?: string;
  };
  selectedAttributes: Record<string, string | number | boolean>;
  resolvedUnitCost?: number;
  variantId?: string;
  variantKey?: string;
  stockAvailable?: number | null;
}

interface FinishAttributePickerProps {
  productId: string;
  organizationId: string;
  userId: string;
  finishCategory?: FinishCategory;
  linkedFinishes?: LinkedFinish[];
  requiredAttributes?: string[];
  attributeConstraints?: Record<string, (string | number | boolean)[]>;
  onSelect: (selection: FinishAttributeSelection) => void;
  onCancel?: () => void;
  showPricePreview?: boolean;
}

export function FinishAttributePicker({
  productId,
  organizationId,
  userId,
  finishCategory,
  linkedFinishes,
  requiredAttributes = [],
  attributeConstraints,
  onSelect,
  onCancel,
  showPricePreview = true,
}: FinishAttributePickerProps) {
  const [selectedFinish, setSelectedFinish] = useState<FinishDocument | null>(null);
  const [attrValues, setAttrValues] = useState<Record<string, string | number | boolean>>({});
  const [pricePreview, setPricePreview] = useState<ResolvedPricePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [stockAvailable, setStockAvailable] = useState<number | null | undefined>(undefined);

  const { finishes, loading: finishesLoading } = useFinishLibrary({
    organizationId,
    category: finishCategory,
    isActive: true,
  });

  const { attributes: attrDefs } = useFinishAttributes(
    organizationId,
    finishCategory
  );

  const { previewPrice } = useVariantResolver(productId, organizationId, userId);

  // Filter to only required attributes
  const requiredAttrDefs = attrDefs.filter(a => requiredAttributes.includes(a.key));

  // Check if all required attributes are filled
  const allRequiredFilled = requiredAttrDefs
    .filter(a => a.required)
    .every(a => attrValues[a.key] !== undefined && attrValues[a.key] !== '');

  const canConfirm = selectedFinish && (requiredAttrDefs.length === 0 || allRequiredFilled);

  // Update price preview when finish or attributes change
  useEffect(() => {
    if (!selectedFinish || !showPricePreview) {
      setPricePreview(null);
      return;
    }

    setPreviewLoading(true);
    previewPrice(selectedFinish.id, attrValues).then(preview => {
      setPricePreview(preview);
      setPreviewLoading(false);
    });
  }, [selectedFinish?.id, JSON.stringify(attrValues)]);

  // Check stock availability when finish + attrs change
  useEffect(() => {
    if (!selectedFinish || requiredAttributes.length === 0) {
      setStockAvailable(undefined);
      return;
    }

    const checkStock = async () => {
      const key = generateVariantKey(productId, selectedFinish.id, attrValues, requiredAttributes);
      const variant = await getVariantByKey(key);
      setStockAvailable(variant ? variant.quantityAvailable : null);
    };

    checkStock();
  }, [selectedFinish?.id, JSON.stringify(attrValues), productId]);

  const handleAttrChange = useCallback((key: string, value: string | number | boolean) => {
    setAttrValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleConfirm = () => {
    if (!selectedFinish) return;

    const variantKey = generateVariantKey(productId, selectedFinish.id, attrValues, requiredAttributes);

    onSelect({
      selectedFinish: {
        finishId: selectedFinish.id,
        finishName: selectedFinish.name,
        finishCode: selectedFinish.code,
        hexColor: selectedFinish.hexColor,
      },
      selectedAttributes: attrValues,
      resolvedUnitCost: pricePreview?.estimatedUnitCost,
      variantKey,
      stockAvailable: stockAvailable ?? null,
    });
  };

  return (
    <div className="space-y-4">
      {/* Finish Selection */}
      <FinishSelector
        finishes={finishes}
        linkedFinishes={linkedFinishes}
        selectedFinishId={selectedFinish?.id}
        onSelect={setSelectedFinish}
        loading={finishesLoading}
      />

      {/* Attribute Selection */}
      {selectedFinish && requiredAttrDefs.length > 0 && (
        <AttributeSelector
          attributes={requiredAttrDefs}
          values={attrValues}
          constraints={attributeConstraints}
          onChange={handleAttrChange}
        />
      )}

      {/* Price Preview */}
      {selectedFinish && showPricePreview && (
        <VariantPricePreview
          preview={pricePreview}
          loading={previewLoading}
          stockAvailable={stockAvailable}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          Confirm Selection
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
