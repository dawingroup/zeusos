/**
 * Construction Pricing Tab
 * Manages pricing for construction/fitout items.
 * Features visual method selector cards and a slide-out drawer for pricing entry.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calculator, Check, Loader2, Plus, Trash2, X, Save,
  Ruler, Banknote, Clock, Percent, FileText, Layers,
  Pencil, ChevronRight, Building2, User, Phone, Hash, ExternalLink,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import type { DesignItem } from '../../types';
import { SupplierPicker } from '@/modules/procurement/components/SupplierPicker';
import { getSupplier } from '@/modules/suppliers/services/supplierService';
import {
  CONSTRUCTION_CATEGORY_LABELS,
  CONSTRUCTION_UNIT_SHORT_LABELS,
  calculateConstructionPricing,
  calculateSubItem,
  PRICING_METHOD_LABELS,
  PRICING_METHOD_DESCRIPTIONS,
  type ConstructionPricing,
  type ConstructionPricingMethod,
  type ConstructionCategory,
  type ConstructionUnitType,
  type QuoteLineItem,
  type ConstructionSubItem,
} from '../../types/deliverables';

// ============================================
// Constants
// ============================================

export interface ConstructionPricingTabProps {
  item: DesignItem;
  projectId: string;
  userId: string;
  onUpdate: (updates: Partial<ConstructionPricing>) => Promise<void>;
  readOnly?: boolean;
}

const UNIT_OPTIONS: { value: ConstructionUnitType; label: string }[] = [
  { value: 'sqm', label: 'Square Meters (m²)' },
  { value: 'sqft', label: 'Square Feet (ft²)' },
  { value: 'lm', label: 'Linear Meters (lm)' },
  { value: 'unit', label: 'Units' },
  { value: 'lot', label: 'Lump Sum' },
];

const CATEGORY_OPTIONS: { value: ConstructionCategory; label: string }[] = Object.entries(
  CONSTRUCTION_CATEGORY_LABELS
).map(([value, label]) => ({ value: value as ConstructionCategory, label }));

const CURRENCY_OPTIONS = ['UGX', 'KES', 'USD', 'EUR', 'GBP', 'ZAR'];

const METHOD_ICONS: Record<ConstructionPricingMethod, React.ElementType> = {
  measured: Ruler,
  lump_sum: Banknote,
  day_works: Clock,
  cost_plus: Percent,
  contractor_quote: FileText,
  composite: Layers,
};

const METHOD_COLORS: Record<ConstructionPricingMethod, { bg: string; border: string; text: string; ring: string }> = {
  measured: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', ring: 'ring-blue-500' },
  lump_sum: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', ring: 'ring-emerald-500' },
  day_works: { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', ring: 'ring-violet-500' },
  cost_plus: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', ring: 'ring-orange-500' },
  contractor_quote: { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', ring: 'ring-cyan-500' },
  composite: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', ring: 'ring-rose-500' },
};

const SUB_ITEM_METHODS: { value: Exclude<ConstructionPricingMethod, 'composite'>; label: string }[] = [
  { value: 'measured', label: 'Measured (BOQ)' },
  { value: 'lump_sum', label: 'Lump Sum' },
  { value: 'day_works', label: 'Day Works' },
  { value: 'cost_plus', label: 'Cost Plus' },
  { value: 'contractor_quote', label: 'Contractor Quote' },
];

// ============================================
// Helper Components
// ============================================

function SummaryRow({ label, amount, format }: { label: string; amount: number; format: (n: number) => string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium font-mono">{format(amount)}</span>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function ConstructionPricingTab({
  item,
  projectId: _projectId,
  userId: _userId,
  onUpdate,
  readOnly = false,
}: ConstructionPricingTabProps) {
  const existingPricing = (item as any).construction as ConstructionPricing | undefined;

  const [pricing, setPricing] = useState<ConstructionPricing>({
    category: existingPricing?.category || 'other',
    contractor: existingPricing?.contractor || '',
    contractorContact: existingPricing?.contractorContact || '',
    contractorId: existingPricing?.contractorId,
    unitType: existingPricing?.unitType || 'sqm',
    quantity: existingPricing?.quantity || 0,
    unitRate: existingPricing?.unitRate || 0,
    laborCost: existingPricing?.laborCost || 0,
    laborDays: existingPricing?.laborDays,
    laborNotes: existingPricing?.laborNotes || '',
    materialsCost: existingPricing?.materialsCost || 0,
    materialsBreakdown: existingPricing?.materialsBreakdown || '',
    subtotal: existingPricing?.subtotal || 0,
    vatRate: existingPricing?.vatRate,
    vatAmount: existingPricing?.vatAmount,
    totalCost: existingPricing?.totalCost || 0,
    currency: existingPricing?.currency || 'UGX',
    quoteReference: existingPricing?.quoteReference || '',
    scopeOfWork: existingPricing?.scopeOfWork || '',
    exclusions: existingPricing?.exclusions || '',
    notes: existingPricing?.notes || '',
    pricingMethod: existingPricing?.pricingMethod,
    laborDailyRate: existingPricing?.laborDailyRate || 0,
    managementFeePercent: existingPricing?.managementFeePercent || 0,
    managementFeeAmount: existingPricing?.managementFeeAmount || 0,
    lumpSumAmount: existingPricing?.lumpSumAmount || 0,
    quoteLineItems: existingPricing?.quoteLineItems || [],
    quoteDocument: existingPricing?.quoteDocument || '',
    subItems: existingPricing?.subItems || [],
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPricingRef = useRef(pricing);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Escape key closes drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) setDrawerOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [drawerOpen]);

  const doSave = useCallback(async (data: ConstructionPricing) => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await onUpdateRef.current(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Construction pricing save failed:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        doSave(latestPricingRef.current);
      }
    };
  }, [doSave]);

  const handleFieldChange = <K extends keyof ConstructionPricing>(field: K, value: ConstructionPricing[K]) => {
    const updated = { ...pricing, [field]: value };
    const calculated = calculateConstructionPricing(updated);
    setPricing(calculated);
    latestPricingRef.current = calculated;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(calculated), 800);
  };

  const selectMethod = (method: ConstructionPricingMethod) => {
    if (readOnly) return;
    handleFieldChange('pricingMethod', method);
  };

  // Quote line items
  const handleAddQuoteLineItem = () => {
    handleFieldChange('quoteLineItems', [...(pricing.quoteLineItems || []), { id: nanoid(8), description: '', amount: 0 }]);
  };
  const handleRemoveQuoteLineItem = (id: string) => {
    handleFieldChange('quoteLineItems', (pricing.quoteLineItems || []).filter(li => li.id !== id));
  };
  const handleUpdateQuoteLineItem = (id: string, field: keyof QuoteLineItem, value: string | number) => {
    handleFieldChange('quoteLineItems', (pricing.quoteLineItems || []).map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  // Composite sub-items
  const handleAddSubItem = () => {
    handleFieldChange('subItems', [...(pricing.subItems || []), { id: nanoid(8), name: '', pricingMethod: 'measured' as const, subtotal: 0, totalCost: 0 }]);
  };
  const handleRemoveSubItem = (id: string) => {
    handleFieldChange('subItems', (pricing.subItems || []).filter(si => si.id !== id));
  };
  const handleUpdateSubItem = (id: string, updates: Partial<ConstructionSubItem>) => {
    handleFieldChange('subItems', (pricing.subItems || []).map(si => {
      if (si.id !== id) return si;
      return calculateSubItem({ ...si, ...updates });
    }));
  };

  const fmt = (amount: number) => `${pricing.currency} ${amount.toLocaleString()}`;
  const effectiveMethod: ConstructionPricingMethod | 'legacy' = pricing.pricingMethod || 'legacy';
  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 disabled:bg-gray-100";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ====== HEADER ====== */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Construction Pricing</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {pricing.pricingMethod
              ? PRICING_METHOD_LABELS[pricing.pricingMethod]
              : 'Select a pricing method below'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
            </span>
          )}
          {saved && !saving && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Save failed: {saveError}
        </div>
      )}

      {/* ====== METHOD SELECTOR CARDS ====== */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Pricing Method</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(Object.keys(PRICING_METHOD_LABELS) as ConstructionPricingMethod[]).map((method) => {
            const Icon = METHOD_ICONS[method];
            const colors = METHOD_COLORS[method];
            const isSelected = pricing.pricingMethod === method;
            return (
              <button
                key={method}
                type="button"
                onClick={() => selectMethod(method)}
                disabled={readOnly}
                className={`relative flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left
                  ${isSelected
                    ? `${colors.bg} ${colors.border} ring-2 ${colors.ring}/20`
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${isSelected ? colors.bg : 'bg-gray-100'}`}>
                  <Icon className={`w-4 h-4 ${isSelected ? colors.text : 'text-gray-500'}`} />
                </div>
                <span className={`text-sm font-medium ${isSelected ? colors.text : 'text-gray-700'}`}>
                  {PRICING_METHOD_LABELS[method]}
                </span>
                <span className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {PRICING_METHOD_DESCRIPTIONS[method]}
                </span>
                {isSelected && (
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${colors.text} ${colors.bg}`}>
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====== EDIT PRICING BUTTON ====== */}
      {pricing.pricingMethod && !readOnly && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-amber-300 hover:bg-amber-50/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Edit Pricing Details</p>
              <p className="text-xs text-gray-500">
                {effectiveMethod === 'measured' && pricing.quantity > 0
                  ? `${pricing.quantity} ${CONSTRUCTION_UNIT_SHORT_LABELS[pricing.unitType]} @ ${fmt(pricing.unitRate)}`
                  : effectiveMethod === 'lump_sum' && (pricing.lumpSumAmount || 0) > 0
                    ? `Fixed: ${fmt(pricing.lumpSumAmount || 0)}`
                    : effectiveMethod === 'day_works' && (pricing.laborDays || 0) > 0
                      ? `${pricing.laborDays} days @ ${fmt(pricing.laborDailyRate || 0)}/day`
                      : effectiveMethod === 'cost_plus'
                        ? `Base + ${((pricing.managementFeePercent || 0) * 100).toFixed(0)}% fee`
                        : effectiveMethod === 'contractor_quote'
                          ? `${(pricing.quoteLineItems || []).length} line items`
                          : effectiveMethod === 'composite'
                            ? `${(pricing.subItems || []).length} sub-items`
                            : 'Tap to enter values'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-amber-600 transition-colors" />
        </button>
      )}

      {/* ====== CONTRACTOR & GENERAL INFO ====== */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contractor & Info</label>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="text-xs text-amber-600 hover:text-amber-700 font-medium"
              >
                Edit
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            <InfoRow icon={Building2} label="Category" value={CONSTRUCTION_CATEGORY_LABELS[pricing.category]} />
            {pricing.contractorId ? (
              <div className="flex items-center gap-2 py-1">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Contractor</p>
                  <Link to={`/suppliers/${pricing.contractorId}`} className="text-sm font-medium text-blue-600 hover:underline truncate flex items-center gap-1">
                    {pricing.contractor || 'View Supplier'}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <InfoRow icon={User} label="Contractor" value={pricing.contractor || ''} />
            )}
            <InfoRow icon={Phone} label="Contact" value={pricing.contractorContact || ''} />
            <InfoRow icon={Hash} label="Quote Ref" value={pricing.quoteReference || ''} />
            {!pricing.contractor && !pricing.contractorContact && !pricing.quoteReference && (
              <p className="text-xs text-gray-400 py-2">No contractor info yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ====== SCOPE PREVIEW ====== */}
      {pricing.scopeOfWork && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scope of Work</label>
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap line-clamp-3">{pricing.scopeOfWork}</p>
        </div>
      )}

      {/* ====== COST SUMMARY ====== */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-900">Cost Summary</h4>
            {pricing.pricingMethod && (
              <p className="text-xs text-amber-600">{PRICING_METHOD_LABELS[pricing.pricingMethod]}</p>
            )}
          </div>
        </div>

        <div className="space-y-1 text-sm">
          {effectiveMethod === 'legacy' && (
            <>
              <SummaryRow label={`Units (${pricing.quantity} ${CONSTRUCTION_UNIT_SHORT_LABELS[pricing.unitType]})`} amount={pricing.quantity * pricing.unitRate} format={fmt} />
              <SummaryRow label="Labor" amount={pricing.laborCost} format={fmt} />
              <SummaryRow label="Materials" amount={pricing.materialsCost} format={fmt} />
            </>
          )}
          {effectiveMethod === 'measured' && (
            <SummaryRow label={`${pricing.quantity} ${CONSTRUCTION_UNIT_SHORT_LABELS[pricing.unitType]} @ ${fmt(pricing.unitRate)}`} amount={pricing.quantity * pricing.unitRate} format={fmt} />
          )}
          {effectiveMethod === 'lump_sum' && (
            <SummaryRow label="Lump Sum" amount={pricing.lumpSumAmount || 0} format={fmt} />
          )}
          {effectiveMethod === 'day_works' && (
            <>
              <SummaryRow label={`${pricing.laborDays || 0} days @ ${fmt(pricing.laborDailyRate || 0)}/day`} amount={(pricing.laborDays || 0) * (pricing.laborDailyRate || 0)} format={fmt} />
              <SummaryRow label="Materials" amount={pricing.materialsCost || 0} format={fmt} />
            </>
          )}
          {effectiveMethod === 'cost_plus' && (
            <>
              <SummaryRow label="Labor" amount={pricing.laborCost || 0} format={fmt} />
              <SummaryRow label="Materials" amount={pricing.materialsCost || 0} format={fmt} />
              <SummaryRow label={`Fee (${((pricing.managementFeePercent || 0) * 100).toFixed(0)}%)`} amount={pricing.managementFeeAmount || 0} format={fmt} />
            </>
          )}
          {effectiveMethod === 'contractor_quote' && (
            (pricing.quoteLineItems || []).length > 0
              ? (pricing.quoteLineItems || []).map(li => <SummaryRow key={li.id} label={li.description || 'Line item'} amount={li.amount || 0} format={fmt} />)
              : <SummaryRow label="Quote Amount" amount={pricing.lumpSumAmount || 0} format={fmt} />
          )}
          {effectiveMethod === 'composite' && (
            (pricing.subItems || []).map(sub => <SummaryRow key={sub.id} label={sub.name || 'Sub-item'} amount={sub.totalCost || 0} format={fmt} />)
          )}

          <div className="border-t border-amber-200 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-gray-700 font-medium">Subtotal</span>
              <span className="font-semibold font-mono">{fmt(pricing.subtotal)}</span>
            </div>
            {(pricing.vatRate || 0) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-600">VAT ({((pricing.vatRate || 0) * 100).toFixed(0)}%)</span>
                <span className="font-mono">{fmt(pricing.vatAmount || 0)}</span>
              </div>
            )}
          </div>
          <div className="border-t-2 border-amber-300 pt-2 mt-1">
            <div className="flex justify-between items-baseline">
              <span className="text-amber-900 font-bold text-base">Total</span>
              <span className="font-bold text-amber-900 text-xl font-mono">{fmt(pricing.totalCost)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ====== VAT QUICK EDIT ====== */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">VAT Rate</label>
        <input
          type="number"
          value={(pricing.vatRate || 0) * 100 || ''}
          onChange={(e) => handleFieldChange('vatRate', (parseFloat(e.target.value) || 0) / 100)}
          disabled={readOnly}
          className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 disabled:bg-gray-100"
          placeholder="0"
          min="0"
          max="100"
        />
        <span className="text-sm text-gray-500">%</span>
        <div className="flex-1" />
        <span className="text-sm text-gray-600 font-mono">{fmt(pricing.vatAmount || 0)}</span>
      </div>

      {/* ====== PRICING DETAIL DRAWER ====== */}
      {drawerOpen && (
        <PricingDrawer
          pricing={pricing}
          effectiveMethod={effectiveMethod}
          readOnly={readOnly}
          saving={saving}
          saved={saved}
          inputCls={inputCls}
          fmt={fmt}
          onClose={() => setDrawerOpen(false)}
          onFieldChange={handleFieldChange}
          onSave={() => doSave(pricing)}
          onAddQuoteLineItem={handleAddQuoteLineItem}
          onRemoveQuoteLineItem={handleRemoveQuoteLineItem}
          onUpdateQuoteLineItem={handleUpdateQuoteLineItem}
          onAddSubItem={handleAddSubItem}
          onRemoveSubItem={handleRemoveSubItem}
          onUpdateSubItem={handleUpdateSubItem}
        />
      )}
    </div>
  );
}

// ============================================
// Pricing Drawer
// ============================================

interface PricingDrawerProps {
  pricing: ConstructionPricing;
  effectiveMethod: ConstructionPricingMethod | 'legacy';
  readOnly: boolean;
  saving: boolean;
  saved: boolean;
  inputCls: string;
  fmt: (n: number) => string;
  onClose: () => void;
  onFieldChange: <K extends keyof ConstructionPricing>(field: K, value: ConstructionPricing[K]) => void;
  onSave: () => void;
  onAddQuoteLineItem: () => void;
  onRemoveQuoteLineItem: (id: string) => void;
  onUpdateQuoteLineItem: (id: string, field: keyof QuoteLineItem, value: string | number) => void;
  onAddSubItem: () => void;
  onRemoveSubItem: (id: string) => void;
  onUpdateSubItem: (id: string, updates: Partial<ConstructionSubItem>) => void;
}

function PricingDrawer({
  pricing, effectiveMethod, readOnly, saving, saved, inputCls, fmt,
  onClose, onFieldChange, onSave,
  onAddQuoteLineItem, onRemoveQuoteLineItem, onUpdateQuoteLineItem,
  onAddSubItem, onRemoveSubItem, onUpdateSubItem,
}: PricingDrawerProps) {
  const methodLabel = pricing.pricingMethod ? PRICING_METHOD_LABELS[pricing.pricingMethod] : 'Legacy';
  const colors = pricing.pricingMethod ? METHOD_COLORS[pricing.pricingMethod] : null;
  const MethodIcon = pricing.pricingMethod ? METHOD_ICONS[pricing.pricingMethod] : Calculator;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors?.bg || 'bg-gray-100'}`}>
              <MethodIcon className={`w-4.5 h-4.5 ${colors?.text || 'text-gray-600'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{methodLabel} Pricing</h3>
              <p className="text-xs text-gray-500">Enter pricing details below</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            {saved && !saving && <Check className="w-4 h-4 text-green-500" />}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* ====== GENERAL / CONTRACTOR ====== */}
          <DrawerSection title="General Information">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select value={pricing.category} onChange={(e) => onFieldChange('category', e.target.value as ConstructionCategory)} disabled={readOnly} className={inputCls}>
                  {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
                <select value={pricing.currency} onChange={(e) => onFieldChange('currency', e.target.value)} disabled={readOnly} className={inputCls}>
                  {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <SupplierPicker
                  label="Contractor"
                  placeholder="Search contractors / suppliers..."
                  preferredCategories={['contractor', 'subcontractor']}
                  disabled={readOnly}
                  value={pricing.contractorId ? { supplierId: pricing.contractorId, supplierName: pricing.contractor || '' } : null}
                  onChange={async (val) => {
                    if (val) {
                      try {
                        const supplier = await getSupplier(val.supplierId);
                        onFieldChange('contractor', supplier?.name || val.supplierName);
                        onFieldChange('contractorId', val.supplierId);
                        onFieldChange('contractorContact', [supplier?.contactPerson, supplier?.phone].filter(Boolean).join(' — '));
                      } catch {
                        onFieldChange('contractor', val.supplierName);
                        onFieldChange('contractorId', val.supplierId);
                      }
                    } else {
                      onFieldChange('contractor', '');
                      onFieldChange('contractorId', undefined);
                      onFieldChange('contractorContact', '');
                    }
                  }}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Contact (auto-filled, editable)</label>
                <input type="text" value={pricing.contractorContact || ''} onChange={(e) => onFieldChange('contractorContact', e.target.value)} disabled={readOnly} className={inputCls} placeholder="Phone or email" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Quote Reference</label>
                <input type="text" value={pricing.quoteReference || ''} onChange={(e) => onFieldChange('quoteReference', e.target.value)} disabled={readOnly} className={inputCls} placeholder="QT-2024-001" />
              </div>
            </div>
          </DrawerSection>

          {/* ====== METHOD-SPECIFIC FIELDS ====== */}

          {/* MEASURED / LEGACY */}
          {(effectiveMethod === 'measured' || effectiveMethod === 'legacy') && (
            <DrawerSection title="Unit-Based Pricing">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unit Type</label>
                  <select value={pricing.unitType} onChange={(e) => onFieldChange('unitType', e.target.value as ConstructionUnitType)} disabled={readOnly} className={inputCls}>
                    {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                  <input type="number" value={pricing.quantity || ''} onChange={(e) => onFieldChange('quantity', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono text-center`} min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rate / {CONSTRUCTION_UNIT_SHORT_LABELS[pricing.unitType]}</label>
                  <input type="number" value={pricing.unitRate || ''} onChange={(e) => onFieldChange('unitRate', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono text-center`} min="0" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Unit Total</span>
                  <span className="font-semibold font-mono">{fmt(pricing.quantity * pricing.unitRate)}</span>
                </div>
              </div>
            </DrawerSection>
          )}

          {/* LEGACY: Labor + Materials */}
          {effectiveMethod === 'legacy' && (
            <>
              <DrawerSection title="Labor Costs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Labor Cost</label>
                    <input type="number" value={pricing.laborCost || ''} onChange={(e) => onFieldChange('laborCost', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono`} min="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Est. Days</label>
                    <input type="number" value={pricing.laborDays || ''} onChange={(e) => onFieldChange('laborDays', parseFloat(e.target.value) || undefined)} disabled={readOnly} className={`${inputCls} font-mono`} min="0" />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <input type="text" value={pricing.laborNotes || ''} onChange={(e) => onFieldChange('laborNotes', e.target.value)} disabled={readOnly} className={inputCls} placeholder="e.g., Weekend work included" />
                </div>
              </DrawerSection>
              <DrawerSection title="Materials">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Materials Cost</label>
                    <input type="number" value={pricing.materialsCost || ''} onChange={(e) => onFieldChange('materialsCost', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono`} min="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Breakdown</label>
                    <input type="text" value={pricing.materialsBreakdown || ''} onChange={(e) => onFieldChange('materialsBreakdown', e.target.value)} disabled={readOnly} className={inputCls} placeholder="Tiles, grout, adhesive" />
                  </div>
                </div>
              </DrawerSection>
            </>
          )}

          {/* LUMP SUM */}
          {effectiveMethod === 'lump_sum' && (
            <DrawerSection title="Lump Sum Amount">
              <label className="block text-xs font-medium text-gray-500 mb-1">Fixed Price</label>
              <input type="number" value={pricing.lumpSumAmount || ''} onChange={(e) => onFieldChange('lumpSumAmount', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono text-lg`} min="0" />
            </DrawerSection>
          )}

          {/* DAY WORKS */}
          {effectiveMethod === 'day_works' && (
            <DrawerSection title="Day Works">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Labor Days</label>
                  <input type="number" value={pricing.laborDays || ''} onChange={(e) => onFieldChange('laborDays', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono text-center`} min="0" step="0.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Daily Rate</label>
                  <input type="number" value={pricing.laborDailyRate || ''} onChange={(e) => onFieldChange('laborDailyRate', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono text-center`} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Materials</label>
                  <input type="number" value={pricing.materialsCost || ''} onChange={(e) => onFieldChange('materialsCost', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono text-center`} min="0" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mt-3 flex justify-between text-sm">
                <span className="text-gray-600">Labor: {fmt((pricing.laborDays || 0) * (pricing.laborDailyRate || 0))}</span>
                <span className="text-gray-600">Mat: {fmt(pricing.materialsCost || 0)}</span>
              </div>
            </DrawerSection>
          )}

          {/* COST PLUS */}
          {effectiveMethod === 'cost_plus' && (
            <DrawerSection title="Cost Plus">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Labor</label>
                  <input type="number" value={pricing.laborCost || ''} onChange={(e) => onFieldChange('laborCost', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono text-center`} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Materials</label>
                  <input type="number" value={pricing.materialsCost || ''} onChange={(e) => onFieldChange('materialsCost', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono text-center`} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fee (%)</label>
                  <input type="number" value={(pricing.managementFeePercent || 0) * 100 || ''} onChange={(e) => onFieldChange('managementFeePercent', (parseFloat(e.target.value) || 0) / 100)} disabled={readOnly} className={`${inputCls} font-mono text-center`} min="0" max="100" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mt-3 flex justify-between text-sm">
                <span className="text-gray-600">Base: {fmt((pricing.laborCost || 0) + (pricing.materialsCost || 0))}</span>
                <span className="text-gray-600">Fee: {fmt(pricing.managementFeeAmount || 0)}</span>
              </div>
            </DrawerSection>
          )}

          {/* CONTRACTOR QUOTE */}
          {effectiveMethod === 'contractor_quote' && (
            <DrawerSection title="Contractor Quote">
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">Quote Document</label>
                <input type="text" value={pricing.quoteDocument || ''} onChange={(e) => onFieldChange('quoteDocument', e.target.value)} disabled={readOnly} className={inputCls} placeholder="Quote-2024-001.pdf" />
              </div>

              <label className="block text-xs font-medium text-gray-500 mb-2">Line Items</label>
              <div className="space-y-2">
                {(pricing.quoteLineItems || []).map((li) => (
                  <div key={li.id} className="flex items-center gap-2">
                    <input type="text" value={li.description} onChange={(e) => onUpdateQuoteLineItem(li.id, 'description', e.target.value)} disabled={readOnly} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" placeholder="Description" />
                    <input type="number" value={li.amount || ''} onChange={(e) => onUpdateQuoteLineItem(li.id, 'amount', parseFloat(e.target.value) || 0)} disabled={readOnly} className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-amber-500/30" min="0" />
                    {!readOnly && (
                      <button type="button" onClick={() => onRemoveQuoteLineItem(li.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button type="button" onClick={onAddQuoteLineItem} className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 w-full justify-center">
                    <Plus className="w-4 h-4" /> Add Line Item
                  </button>
                )}
              </div>
              {(!pricing.quoteLineItems || pricing.quoteLineItems.length === 0) && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Or Lump Sum Amount</label>
                  <input type="number" value={pricing.lumpSumAmount || ''} onChange={(e) => onFieldChange('lumpSumAmount', parseFloat(e.target.value) || 0)} disabled={readOnly} className={`${inputCls} font-mono`} min="0" />
                </div>
              )}
            </DrawerSection>
          )}

          {/* COMPOSITE */}
          {effectiveMethod === 'composite' && (
            <DrawerSection title="Composite Sub-Items">
              <div className="space-y-3">
                {(pricing.subItems || []).map((sub) => (
                  <div key={sub.id} className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <input type="text" value={sub.name} onChange={(e) => onUpdateSubItem(sub.id, { name: e.target.value })} disabled={readOnly} className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30" placeholder="Sub-item name" />
                      {!readOnly && (
                        <button type="button" onClick={() => onRemoveSubItem(sub.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Method</label>
                        <select value={sub.pricingMethod} onChange={(e) => onUpdateSubItem(sub.id, { pricingMethod: e.target.value as Exclude<ConstructionPricingMethod, 'composite'> })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30">
                          {SUB_ITEM_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      {sub.pricingMethod === 'measured' && (
                        <>
                          <div><label className="block text-xs text-gray-500 mb-0.5">Qty</label><input type="number" value={sub.quantity || ''} onChange={(e) => onUpdateSubItem(sub.id, { quantity: parseFloat(e.target.value) || 0 })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" min="0" /></div>
                          <div><label className="block text-xs text-gray-500 mb-0.5">Rate</label><input type="number" value={sub.unitRate || ''} onChange={(e) => onUpdateSubItem(sub.id, { unitRate: parseFloat(e.target.value) || 0 })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" min="0" /></div>
                        </>
                      )}
                      {sub.pricingMethod === 'lump_sum' && (
                        <div className="col-span-2"><label className="block text-xs text-gray-500 mb-0.5">Amount</label><input type="number" value={sub.lumpSumAmount || ''} onChange={(e) => onUpdateSubItem(sub.id, { lumpSumAmount: parseFloat(e.target.value) || 0 })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" min="0" /></div>
                      )}
                      {sub.pricingMethod === 'day_works' && (
                        <>
                          <div><label className="block text-xs text-gray-500 mb-0.5">Days</label><input type="number" value={sub.laborDays || ''} onChange={(e) => onUpdateSubItem(sub.id, { laborDays: parseFloat(e.target.value) || 0 })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" min="0" /></div>
                          <div><label className="block text-xs text-gray-500 mb-0.5">Rate/day</label><input type="number" value={sub.laborDailyRate || ''} onChange={(e) => onUpdateSubItem(sub.id, { laborDailyRate: parseFloat(e.target.value) || 0 })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" min="0" /></div>
                        </>
                      )}
                      {sub.pricingMethod === 'cost_plus' && (
                        <>
                          <div><label className="block text-xs text-gray-500 mb-0.5">Labor</label><input type="number" value={sub.laborCost || ''} onChange={(e) => onUpdateSubItem(sub.id, { laborCost: parseFloat(e.target.value) || 0 })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" min="0" /></div>
                          <div><label className="block text-xs text-gray-500 mb-0.5">Fee %</label><input type="number" value={(sub.managementFeePercent || 0) * 100 || ''} onChange={(e) => onUpdateSubItem(sub.id, { managementFeePercent: (parseFloat(e.target.value) || 0) / 100 })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" min="0" max="100" /></div>
                        </>
                      )}
                      {sub.pricingMethod === 'contractor_quote' && (
                        <div className="col-span-2"><label className="block text-xs text-gray-500 mb-0.5">Quote Amount</label><input type="number" value={sub.lumpSumAmount || ''} onChange={(e) => onUpdateSubItem(sub.id, { lumpSumAmount: parseFloat(e.target.value) || 0 })} disabled={readOnly} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white" min="0" /></div>
                      )}
                    </div>
                    <div className="text-right text-xs font-semibold text-amber-700 pt-1 border-t border-gray-200">
                      {fmt(sub.totalCost || 0)}
                    </div>
                  </div>
                ))}
                {!readOnly && (
                  <button type="button" onClick={onAddSubItem} className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 w-full justify-center">
                    <Plus className="w-4 h-4" /> Add Sub-Item
                  </button>
                )}
              </div>
            </DrawerSection>
          )}

          {/* ====== SCOPE & NOTES ====== */}
          <DrawerSection title="Scope & Notes">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Scope of Work</label>
                <textarea value={pricing.scopeOfWork || ''} onChange={(e) => onFieldChange('scopeOfWork', e.target.value)} disabled={readOnly} className={`${inputCls} resize-none`} rows={4} placeholder="Describe the work to be done..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Exclusions</label>
                <textarea value={pricing.exclusions || ''} onChange={(e) => onFieldChange('exclusions', e.target.value)} disabled={readOnly} className={`${inputCls} resize-none`} rows={2} placeholder="What's NOT included..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <textarea value={pricing.notes || ''} onChange={(e) => onFieldChange('notes', e.target.value)} disabled={readOnly} className={`${inputCls} resize-none`} rows={2} placeholder="Any other notes..." />
              </div>
            </div>
          </DrawerSection>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
            Close
          </button>
          {!readOnly && (
            <button
              onClick={() => { onSave(); onClose(); }}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                saved ? 'bg-green-600 text-white' : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                : saved ? <><Check className="w-4 h-4" /> Saved</>
                  : <><Save className="w-4 h-4" /> Save & Close</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Drawer Section
// ============================================

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{title}</label>
      {children}
    </div>
  );
}
