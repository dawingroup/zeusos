/**
 * MaterialForm Component
 * Form for creating/editing materials with full enrichment fields
 */

import { useState, useEffect } from 'react';
import { generateMaterialCode } from '../../services/materialService';
import {
  MATERIAL_CATEGORIES,
  MATERIAL_SUBCATEGORIES,
  MATERIAL_UNITS,
  COMMON_THICKNESSES,
  FUNCTIONAL_USE_OPTIONS,
  APPLICATION_AREAS,
} from '../../types/materials';
import type {
  MaterialFormData,
  MaterialCategory,
  MaterialUnit,
  Material,
  FunctionalUse,
  MaterialPreferredSupplier,
  MaterialProperties,
} from '../../types/materials';

interface MaterialFormProps {
  material?: Material;
  onSubmit: (data: MaterialFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const CATEGORIES_WITH_DIMENSIONS: MaterialCategory[] = [
  'sheet-goods', 'solid-wood', 'glass', 'metal', 'stone-composite',
];

export function MaterialForm({ material, onSubmit, onCancel, isSubmitting = false }: MaterialFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<MaterialFormData>({
    code: material?.code || '',
    name: material?.name || '',
    description: material?.description || '',
    category: material?.category || 'sheet-goods',
    subcategory: material?.subcategory || '',
    dimensions: material?.dimensions || { length: 2440, width: 1220, thickness: 18 },
    pricing: material?.pricing ? {
      unitCost: material.pricing.unitCost,
      currency: material.pricing.currency,
      unit: material.pricing.unit,
      supplier: material.pricing.supplier,
      // P12-3 (F11) — override flag + reason round-trip through the form.
      // Audit stamps (overrideAt/By) are intentionally NOT captured here;
      // the service layer sets them on write when the flag transitions.
      isOverride: material.pricing.isOverride,
      overrideReason: material.pricing.overrideReason,
    } : {
      unitCost: 0,
      currency: 'UGX',
      unit: 'sheet',
    },
    grainPattern: material?.grainPattern || 'none',
    useCases: material?.useCases || [],
    functionalUse: material?.functionalUse,
    applicationAreas: material?.applicationAreas || [],
    preferredSupplier: material?.preferredSupplier,
    alternateSuppliers: material?.alternateSuppliers || [],
    properties: material?.properties || {},
    images: material?.images || [],
    datasheetUrl: material?.datasheetUrl || '',
    status: material?.status || 'active',
  });

  // Local text state for array inputs
  const [useCasesText, setUseCasesText] = useState((material?.useCases || []).join(', '));
  const [altSuppliersText, setAltSuppliersText] = useState((material?.alternateSuppliers || []).join(', '));
  const [imagesText, setImagesText] = useState((material?.images || []).join(', '));
  const [autoCode, setAutoCode] = useState(!material);

  useEffect(() => {
    if (autoCode && formData.name) {
      setFormData((prev) => ({
        ...prev,
        code: generateMaterialCode(formData.name, formData.category),
      }));
    }
  }, [formData.name, formData.category, autoCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    // Parse array fields from text — use empty arrays instead of undefined
    const data: MaterialFormData = {
      ...formData,
      useCases: useCasesText ? useCasesText.split(',').map(s => s.trim()).filter(Boolean) : [],
      alternateSuppliers: altSuppliersText ? altSuppliersText.split(',').map(s => s.trim()).filter(Boolean) : [],
      images: imagesText ? imagesText.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    // Strip empty optional fields
    if (!data.subcategory) delete data.subcategory;
    if (!data.functionalUse) delete data.functionalUse;
    if (!data.datasheetUrl) delete data.datasheetUrl;
    if (!data.preferredSupplier?.name) delete data.preferredSupplier;
    if (data.properties && !Object.values(data.properties).some(v => v != null && v !== '')) delete data.properties;
    try {
      await onSubmit(data);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save material');
    }
  };

  const updateField = <K extends keyof MaterialFormData>(field: K, value: MaterialFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateCategory = (cat: MaterialCategory) => {
    setFormData((prev) => ({ ...prev, category: cat, subcategory: '' }));
  };

  const updateDimension = (field: 'length' | 'width' | 'thickness', value: number) => {
    setFormData((prev) => ({
      ...prev,
      dimensions: { ...prev.dimensions!, [field]: value },
    }));
  };

  const updatePricing = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      pricing: { ...prev.pricing!, [field]: value },
    }));
  };

  const updateSupplier = (field: keyof MaterialPreferredSupplier, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      preferredSupplier: { ...prev.preferredSupplier, name: prev.preferredSupplier?.name || '', [field]: value },
    }));
  };

  const updateProperty = (field: keyof MaterialProperties, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      properties: { ...prev.properties, [field]: value || undefined },
    }));
  };

  const toggleApplicationArea = (area: string) => {
    setFormData((prev) => {
      const current = prev.applicationAreas || [];
      const next = current.includes(area)
        ? current.filter(a => a !== area)
        : [...current, area];
      return { ...prev, applicationAreas: next };
    });
  };

  const subcategories = MATERIAL_SUBCATEGORIES[formData.category] || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ===== Basic Info ===== */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-800 mb-1">Basic Info</legend>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="e.g., Birch Plywood"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => {
                setAutoCode(false);
                updateField('code', e.target.value);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary font-mono"
              placeholder="SHT-BIRCH-001"
            />
            {autoCode && (
              <p className="text-xs text-gray-500 mt-1">Auto-generated from name</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => updateCategory(e.target.value as MaterialCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            >
              {Object.entries(MATERIAL_CATEGORIES).map(([key, { label, icon }]) => (
                <option key={key} value={key}>
                  {icon} {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subcategory */}
        {subcategories.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
            <select
              value={formData.subcategory || ''}
              onChange={(e) => updateField('subcategory', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">-- Select --</option>
              {subcategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            placeholder="Optional description..."
          />
        </div>
      </fieldset>

      {/* ===== Dimensions ===== */}
      {CATEGORIES_WITH_DIMENSIONS.includes(formData.category) && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-gray-800 mb-1">Dimensions (mm)</legend>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Length</label>
              <input
                type="number"
                value={formData.dimensions?.length || 0}
                onChange={(e) => updateDimension('length', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width</label>
              <input
                type="number"
                value={formData.dimensions?.width || 0}
                onChange={(e) => updateDimension('width', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Thickness</label>
              <select
                value={formData.dimensions?.thickness || 18}
                onChange={(e) => updateDimension('thickness', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {COMMON_THICKNESSES.map((t) => (
                  <option key={t} value={t}>{t}mm</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {/* ===== Pricing ===== */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-gray-800 mb-1">Pricing</legend>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Unit Cost</label>
            <input
              type="number"
              value={formData.pricing?.unitCost || 0}
              onChange={(e) => updatePricing('unitCost', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Currency</label>
            <select
              value={formData.pricing?.currency || 'UGX'}
              onChange={(e) => updatePricing('currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="UGX">UGX</option>
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="AED">AED</option>
              <option value="ZAR">ZAR</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Per Unit</label>
            <select
              value={formData.pricing?.unit || 'sheet'}
              onChange={(e) => updatePricing('unit', e.target.value as MaterialUnit)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            >
              {Object.entries(MATERIAL_UNITS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Supplier</label>
            <input
              type="text"
              value={formData.pricing?.supplier || ''}
              onChange={(e) => updatePricing('supplier', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="Optional"
            />
          </div>
        </div>

        {/*
         * P12-3 (F11) — override toggle. Only meaningful when the
         * material links to an InventoryItem (otherwise the material
         * IS the only cost source and "override" has nothing to
         * override). We still render it on unlinked materials as a
         * no-op checkbox so operators see the control exists, but the
         * helper text explains it's inert. When `material` is
         * undefined (creating a new material) we hide the toggle
         * entirely — inventory link is set via the separate link
         * action, so there's nothing to override yet.
         */}
        {material && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.pricing?.isOverride}
                onChange={(e) => {
                  const next = e.target.checked;
                  setFormData((prev) => ({
                    ...prev,
                    pricing: {
                      ...prev.pricing!,
                      isOverride: next,
                      // Clear stale reason when turning override off so
                      // `isMaterialPricingOverrideInvalid` stops flagging
                      // the row as inconsistent.
                      overrideReason: next ? prev.pricing?.overrideReason : undefined,
                    },
                  }));
                }}
                className="mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">
                  Override linked inventory cost
                </span>
                <p className="text-xs text-gray-500">
                  {material.inventoryItemId
                    ? 'Use the Unit Cost above instead of the InventoryItem cost. The inventory link stays intact.'
                    : 'No inventory link on this material — Unit Cost is already the only source. Toggle has no effect until you link an inventory item.'}
                </p>
              </div>
            </label>
            {formData.pricing?.isOverride && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Override reason</label>
                <input
                  type="text"
                  value={formData.pricing?.overrideReason || ''}
                  onChange={(e) => updatePricing('overrideReason', e.target.value)}
                  placeholder="e.g. One-off supplier quote, imported batch, negotiated rate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Visible in audit views + reconciliation reports.
                </p>
              </div>
            )}
          </div>
        )}
      </fieldset>

      {/* ===== Use Cases & Application ===== */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-800 mb-1">Use Cases & Application</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Functional Use</label>
            <select
              value={formData.functionalUse || ''}
              onChange={(e) => updateField('functionalUse', (e.target.value || undefined) as FunctionalUse | undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">-- Select --</option>
              {FUNCTIONAL_USE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Use Cases (comma-separated)</label>
            <input
              type="text"
              value={useCasesText}
              onChange={(e) => setUseCasesText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="cabinet doors, shelving, drawer fronts"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Application Areas</label>
          <div className="flex flex-wrap gap-2">
            {APPLICATION_AREAS.map(area => {
              const selected = formData.applicationAreas?.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleApplicationArea(area)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary'
                  }`}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* ===== Supplier Info ===== */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-gray-800 mb-1">Supplier Info</legend>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Preferred Supplier</label>
            <input
              type="text"
              value={formData.preferredSupplier?.name || ''}
              onChange={(e) => updateSupplier('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="Supplier name"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Lead Time (days)</label>
            <input
              type="number"
              value={formData.preferredSupplier?.leadTimeDays || ''}
              onChange={(e) => updateSupplier('leadTimeDays', parseFloat(e.target.value) || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="e.g. 14"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">MOQ</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={formData.preferredSupplier?.moq || ''}
                onChange={(e) => updateSupplier('moq', parseFloat(e.target.value) || undefined)}
                className="w-2/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="Qty"
              />
              <input
                type="text"
                value={formData.preferredSupplier?.moqUnit || ''}
                onChange={(e) => updateSupplier('moqUnit', e.target.value || undefined)}
                className="w-1/3 px-2 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="unit"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Alternate Suppliers (comma-separated)</label>
          <input
            type="text"
            value={altSuppliersText}
            onChange={(e) => setAltSuppliersText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            placeholder="Supplier A, Supplier B"
          />
        </div>
      </fieldset>

      {/* ===== Properties ===== */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-gray-800 mb-1">Properties</legend>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Weight (kg)</label>
            <input
              type="number"
              value={formData.properties?.weight ?? ''}
              onChange={(e) => updateProperty('weight', parseFloat(e.target.value) || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Density (kg/m3)</label>
            <input
              type="number"
              value={formData.properties?.density ?? ''}
              onChange={(e) => updateProperty('density', parseFloat(e.target.value) || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fire Rating</label>
            <input
              type="text"
              value={formData.properties?.fireRating || ''}
              onChange={(e) => updateProperty('fireRating', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="e.g. Class A"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Moisture</label>
            <select
              value={formData.properties?.moistureResistance || ''}
              onChange={(e) => updateProperty('moistureResistance', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">--</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Waterproof">Waterproof</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Durability</label>
            <select
              value={formData.properties?.durabilityRating || ''}
              onChange={(e) => updateProperty('durabilityRating', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">--</option>
              <option value="Light Duty">Light Duty</option>
              <option value="Medium">Medium</option>
              <option value="Heavy Duty">Heavy Duty</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Color Code</label>
            <input
              type="text"
              value={formData.properties?.colorCode || ''}
              onChange={(e) => updateProperty('colorCode', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="#FFFFFF"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Finish</label>
            <select
              value={formData.properties?.finish || ''}
              onChange={(e) => updateProperty('finish', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">--</option>
              <option value="Matt">Matt</option>
              <option value="Gloss">Gloss</option>
              <option value="Satin">Satin</option>
              <option value="Textured">Textured</option>
              <option value="Raw">Raw</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Texture</label>
            <input
              type="text"
              value={formData.properties?.texture || ''}
              onChange={(e) => updateProperty('texture', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="e.g. Smooth"
            />
          </div>
        </div>
      </fieldset>

      {/* ===== Images & Datasheet ===== */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-gray-800 mb-1">Images & Datasheet</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Image URLs (comma-separated)</label>
            <input
              type="text"
              value={imagesText}
              onChange={(e) => setImagesText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Datasheet URL</label>
            <input
              type="text"
              value={formData.datasheetUrl || ''}
              onChange={(e) => updateField('datasheetUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="https://..."
            />
          </div>
        </div>
      </fieldset>

      {/* ===== Grain & Status ===== */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grain Pattern</label>
          <select
            value={formData.grainPattern || 'none'}
            onChange={(e) => updateField('grainPattern', e.target.value as MaterialFormData['grainPattern'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="none">None</option>
            <option value="lengthwise">Lengthwise</option>
            <option value="crosswise">Crosswise</option>
            <option value="random">Random</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => updateField('status', e.target.value as MaterialFormData['status'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* ===== Error ===== */}
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {formError}
        </div>
      )}

      {/* ===== Actions ===== */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !formData.name || !formData.code}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : material ? 'Update Material' : 'Create Material'}
        </button>
      </div>
    </form>
  );
}

export default MaterialForm;
