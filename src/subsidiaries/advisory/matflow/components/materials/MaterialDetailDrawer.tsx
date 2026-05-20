/**
 * Material Detail Drawer
 *
 * Right-slide panel for viewing and editing all fields of a material in the
 * library. Uses the same Radix Sheet primitive as FormulaDetailDrawer.
 *
 * Sections:
 *  • Overview    — name, code, category, subcategory, description
 *  • Pricing     — standardRate edit + "Get Market Price" AI button
 *  • Price History — timestamped rate entries (read-only)
 *  • Specifications — dynamic name/value/unit rows
 *  • Units       — baseUnit + alternative conversions
 *  • Stock       — currentStock, reorderLevel, leadTimeDays
 *  • Suppliers   — pill-tag list with add/remove
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Plus,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Package,
  Tag,
  BarChart2,
  Boxes,
  Users,
  Ruler,
  ClipboardList,
  Save,
  Clock,
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { materialService } from '../../services/material-service';
import type { Material, MaterialCategoryExtended, MaterialRateHistory } from '../../types/material';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: MaterialCategoryExtended; label: string }[] = [
  { value: 'cement_concrete', label: 'Cement & Concrete' },
  { value: 'steel_reinforcement', label: 'Steel & Reinforcement' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'timber', label: 'Timber' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'finishes', label: 'Finishes' },
  { value: 'doors_windows', label: 'Doors & Windows' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'aggregates', label: 'Aggregates' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLOURS: Record<string, string> = {
  cement_concrete: 'bg-gray-100 text-gray-700',
  steel_reinforcement: 'bg-blue-100 text-blue-700',
  masonry: 'bg-orange-100 text-orange-700',
  timber: 'bg-amber-100 text-amber-700',
  roofing: 'bg-red-100 text-red-700',
  plumbing: 'bg-cyan-100 text-cyan-700',
  electrical: 'bg-yellow-100 text-yellow-700',
  finishes: 'bg-purple-100 text-purple-700',
  doors_windows: 'bg-indigo-100 text-indigo-700',
  hardware: 'bg-zinc-100 text-zinc-700',
  aggregates: 'bg-stone-100 text-stone-700',
  chemicals: 'bg-green-100 text-green-700',
  equipment: 'bg-rose-100 text-rose-700',
  other: 'bg-gray-100 text-gray-500',
};

const SOURCE_LABELS: Record<string, string> = {
  standard: 'Manual',
  purchase: 'Purchase',
  quotation: 'Quotation',
  estimate: 'Estimate',
  market: 'AI Market',
};

const SOURCE_COLOURS: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700',
  purchase: 'bg-blue-100 text-blue-700',
  quotation: 'bg-purple-100 text-purple-700',
  estimate: 'bg-yellow-100 text-yellow-700',
  market: 'bg-green-100 text-green-700',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaterialDetailDrawerProps {
  material: Material | null;
  onClose: () => void;
  onSaved: (updated: Material) => void;
  userId: string;
}

interface SpecRow { name: string; value: string; unit: string; }
interface AltUnit { unit: string; conversionFactor: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number, currency = 'UGX') =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts._seconds * 1000);
    return d.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const getCategoryLabel = (cat: MaterialCategoryExtended) =>
  CATEGORIES.find(c => c.value === cat)?.label || cat;

// ─── Section toggle helper ────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 text-left"
      >
        <span className="text-gray-400">{icon}</span>
        {title}
        <span className="ml-auto text-gray-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const MaterialDetailDrawer: React.FC<MaterialDetailDrawerProps> = ({
  material,
  onClose,
  onSaved,
  userId,
}) => {
  // Form state — initialised / reset when material prop changes
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MaterialCategoryExtended>('other');
  const [subcategory, setSubcategory] = useState('');
  const [baseUnit, setBaseUnit] = useState('');
  const [rateAmount, setRateAmount] = useState(0);
  const [rateCurrency, setRateCurrency] = useState('UGX');
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [altUnits, setAltUnits] = useState<AltUnit[]>([]);
  const [currentStock, setCurrentStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [newSupplier, setNewSupplier] = useState('');
  const [rateHistory, setRateHistory] = useState<MaterialRateHistory[]>([]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isPricing, setIsPricing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricingSuccess, setPricingSuccess] = useState(false);

  // Populate form when material changes
  useEffect(() => {
    if (!material) return;
    setName(material.name);
    setCode(material.code);
    setDescription(material.description || '');
    setCategory(material.category);
    setSubcategory(material.subcategory || '');
    setBaseUnit(material.baseUnit);
    setRateAmount(material.standardRate?.amount ?? 0);
    setRateCurrency(material.standardRate?.currency || 'UGX');
    setSpecs(material.specifications?.map(s => ({ name: s.name, value: s.value, unit: s.unit || '' })) || []);
    setAltUnits(material.alternativeUnits?.map(u => ({ unit: u.unit, conversionFactor: u.conversionFactor })) || []);
    setCurrentStock(material.currentStock != null ? String(material.currentStock) : '');
    setReorderLevel(material.reorderLevel != null ? String(material.reorderLevel) : '');
    setLeadTimeDays(material.leadTimeDays != null ? String(material.leadTimeDays) : '');
    setSuppliers(material.preferredSuppliers || []);
    setRateHistory(material.rateHistory || []);
    setHasChanges(false);
    setError(null);
    setPricingSuccess(false);
  }, [material]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  // ─── Save ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!material) return;
    setIsSaving(true);
    setError(null);
    try {
      const rateChanged =
        rateAmount !== (material.standardRate?.amount ?? 0) ||
        rateCurrency !== (material.standardRate?.currency || 'UGX');

      // If rate changed, use updateMaterialRate to record in history
      if (rateChanged) {
        await materialService.updateMaterialRate(
          material.id,
          { amount: rateAmount, currency: rateCurrency },
          'standard',
          userId
        );
      }

      await materialService.updateMaterial(material.id, {
        name,
        code,
        description,
        category,
        subcategory: subcategory || undefined,
        baseUnit,
        specifications: specs.filter(s => s.name).map(s => ({
          name: s.name, value: s.value, unit: s.unit || undefined,
        })),
        alternativeUnits: altUnits.filter(u => u.unit).map(u => ({
          unit: u.unit, conversionFactor: Number(u.conversionFactor) || 1,
        })),
        currentStock: currentStock !== '' ? Number(currentStock) : undefined,
        reorderLevel: reorderLevel !== '' ? Number(reorderLevel) : undefined,
        leadTimeDays: leadTimeDays !== '' ? Number(leadTimeDays) : undefined,
        preferredSuppliers: suppliers,
      }, userId);

      // Reload the material so the drawer reflects the latest saved state
      const refreshed = await materialService.getMaterial(material.id);
      if (refreshed) {
        onSaved(refreshed);
        // Update local rate history if rate changed
        if (rateChanged) setRateHistory(refreshed.rateHistory || []);
      }
      setHasChanges(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save material');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Get Market Price ─────────────────────────────────────────────────────

  const handleGetMarketPrice = async () => {
    if (!material) return;
    setIsPricing(true);
    setPricingSuccess(false);
    setError(null);
    try {
      const fn = httpsCallable(getFunctions(), 'priceMaterialAI');
      await fn({
        materialId: material.id,
        materialName: material.name,
        unit: material.baseUnit,
        category: material.category,
      });
      // Reload material to get updated rate + history
      const refreshed = await materialService.getMaterial(material.id);
      if (refreshed) {
        setRateAmount(refreshed.standardRate.amount);
        setRateCurrency(refreshed.standardRate.currency);
        setRateHistory(refreshed.rateHistory || []);
        onSaved(refreshed);
      }
      setPricingSuccess(true);
    } catch (err: any) {
      setError(`Market pricing failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsPricing(false);
    }
  };

  // ─── Specs helpers ────────────────────────────────────────────────────────

  const addSpec = () => { setSpecs(s => [...s, { name: '', value: '', unit: '' }]); markChanged(); };
  const removeSpec = (i: number) => { setSpecs(s => s.filter((_, idx) => idx !== i)); markChanged(); };
  const updateSpec = (i: number, field: keyof SpecRow, val: string) => {
    setSpecs(s => s.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
    markChanged();
  };

  // ─── Alt units helpers ────────────────────────────────────────────────────

  const addAltUnit = () => { setAltUnits(u => [...u, { unit: '', conversionFactor: 1 }]); markChanged(); };
  const removeAltUnit = (i: number) => { setAltUnits(u => u.filter((_, idx) => idx !== i)); markChanged(); };
  const updateAltUnit = (i: number, field: keyof AltUnit, val: string | number) => {
    setAltUnits(u => u.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
    markChanged();
  };

  // ─── Supplier helpers ─────────────────────────────────────────────────────

  const addSupplier = () => {
    const trimmed = newSupplier.trim();
    if (!trimmed || suppliers.includes(trimmed)) return;
    setSuppliers(s => [...s, trimmed]);
    setNewSupplier('');
    markChanged();
  };

  const removeSupplier = (s: string) => { setSuppliers(prev => prev.filter(x => x !== s)); markChanged(); };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!material) return null;

  return (
    <Sheet open={!!material} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-2xl flex flex-col p-0 gap-0">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-50 rounded-lg flex-shrink-0">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold text-gray-900 truncate">
                {name || material.name}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-gray-500">{code || material.code}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOURS[category] || 'bg-gray-100 text-gray-600'}`}>
                  {getCategoryLabel(category)}
                </span>
                {!material.isActive && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    Inactive
                  </span>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Overview */}
          <Section title="Overview" icon={<ClipboardList className="w-4 h-4" />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); markChanged(); }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => { setCode(e.target.value); markChanged(); }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => { setCategory(e.target.value as MaterialCategoryExtended); markChanged(); }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={subcategory}
                    onChange={e => { setSubcategory(e.target.value); markChanged(); }}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => { setDescription(e.target.value); markChanged(); }}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>
          </Section>

          {/* Pricing */}
          <Section title="Pricing" icon={<BarChart2 className="w-4 h-4" />}>
            <div className="space-y-4">
              {/* Current rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Standard Rate</label>
                  <div className="flex gap-2">
                    <select
                      value={rateCurrency}
                      onChange={e => { setRateCurrency(e.target.value); markChanged(); }}
                      className="w-20 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      <option>UGX</option>
                      <option>USD</option>
                      <option>KES</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={rateAmount}
                      onChange={e => { setRateAmount(parseFloat(e.target.value) || 0); markChanged(); }}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Base Unit</label>
                  <input
                    type="text"
                    value={baseUnit}
                    onChange={e => { setBaseUnit(e.target.value); markChanged(); }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Display-only rates */}
              {(material.lastPurchaseRate || material.averageRate) && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {material.lastPurchaseRate && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium mb-0.5">Last Purchase</p>
                      <p className="text-sm font-semibold text-blue-800">
                        {fmt(material.lastPurchaseRate.amount, material.lastPurchaseRate.currency)}
                      </p>
                    </div>
                  )}
                  {material.averageRate && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-medium mb-0.5">Average Rate</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {fmt(material.averageRate.amount, material.averageRate.currency)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Market Pricing button */}
              <div className="border border-dashed border-green-300 rounded-lg p-4 bg-green-50">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">AI Market Pricing</p>
                    <p className="text-xs text-green-600 mt-0.5 mb-3">
                      Searches the internet for 5 current Uganda market prices and averages them.
                    </p>
                    <button
                      type="button"
                      onClick={handleGetMarketPrice}
                      disabled={isPricing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPricing
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching prices…</>
                        : <><TrendingUp className="w-4 h-4" /> Get Market Price</>
                      }
                    </button>
                    {pricingSuccess && (
                      <p className="text-xs text-green-700 mt-2 font-medium">
                        ✓ Market price updated — see Price History below
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Price History */}
          {rateHistory.length > 0 && (
            <Section title={`Price History (${rateHistory.length})`} icon={<Clock className="w-4 h-4" />} defaultOpen={false}>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Rate</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Source</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">From</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rateHistory.map((entry, idx) => (
                      <tr key={idx} className={idx === 0 ? 'bg-green-50' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {fmt(entry.rate.amount, entry.rate.currency || 'UGX')}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLOURS[entry.source] || 'bg-gray-100 text-gray-600'}`}>
                            {SOURCE_LABELS[entry.source] || entry.source}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{fmtDate(entry.effectiveFrom)}</td>
                        <td className="px-3 py-2 text-gray-400">
                          {idx === 0
                            ? <span className="text-green-600 font-medium">Current</span>
                            : fmtDate(entry.effectiveTo)
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rateHistory[0]?.notes && (
                  <div className="px-3 py-2 bg-green-50 border-t border-green-100 text-xs text-green-700">
                    {rateHistory[0].notes}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Specifications */}
          <Section title="Specifications" icon={<Tag className="w-4 h-4" />} defaultOpen={specs.length > 0}>
            <div className="space-y-2">
              {specs.length > 0 && (
                <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 mb-1">
                  <p className="text-xs font-medium text-gray-500">Name</p>
                  <p className="text-xs font-medium text-gray-500">Value</p>
                  <p className="text-xs font-medium text-gray-500">Unit</p>
                  <span />
                </div>
              )}
              {specs.map((spec, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                  <input
                    type="text"
                    value={spec.name}
                    onChange={e => updateSpec(i, 'name', e.target.value)}
                    placeholder="e.g. Grade"
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    type="text"
                    value={spec.value}
                    onChange={e => updateSpec(i, 'value', e.target.value)}
                    placeholder="e.g. C25"
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    type="text"
                    value={spec.unit}
                    onChange={e => updateSpec(i, 'unit', e.target.value)}
                    placeholder="MPa"
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button type="button" onClick={() => removeSpec(i)}
                    className="p-1 text-red-400 hover:text-red-600 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addSpec}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium mt-1">
                <Plus className="w-3.5 h-3.5" /> Add Specification
              </button>
            </div>
          </Section>

          {/* Units */}
          <Section title="Units & Conversions" icon={<Ruler className="w-4 h-4" />} defaultOpen={false}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-500 text-xs font-medium">Base unit:</span>
                <span className="font-semibold text-gray-800">{baseUnit || '—'}</span>
              </div>
              {altUnits.length > 0 && (
                <div className="grid grid-cols-[1fr_1fr_32px] gap-2 mb-1">
                  <p className="text-xs font-medium text-gray-500">Alternative Unit</p>
                  <p className="text-xs font-medium text-gray-500">Factor (→ base)</p>
                  <span />
                </div>
              )}
              {altUnits.map((u, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                  <input
                    type="text"
                    value={u.unit}
                    onChange={e => updateAltUnit(i, 'unit', e.target.value)}
                    placeholder="e.g. tonne"
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={u.conversionFactor}
                    onChange={e => updateAltUnit(i, 'conversionFactor', parseFloat(e.target.value) || 1)}
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button type="button" onClick={() => removeAltUnit(i)}
                    className="p-1 text-red-400 hover:text-red-600 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addAltUnit}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Alternative Unit
              </button>
            </div>
          </Section>

          {/* Stock */}
          <Section title="Stock & Lead Time" icon={<Boxes className="w-4 h-4" />} defaultOpen={false}>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Current Stock</label>
                <input
                  type="number"
                  min="0"
                  value={currentStock}
                  onChange={e => { setCurrentStock(e.target.value); markChanged(); }}
                  placeholder="—"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  value={reorderLevel}
                  onChange={e => { setReorderLevel(e.target.value); markChanged(); }}
                  placeholder="—"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lead Time (days)</label>
                <input
                  type="number"
                  min="0"
                  value={leadTimeDays}
                  onChange={e => { setLeadTimeDays(e.target.value); markChanged(); }}
                  placeholder="—"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </Section>

          {/* Suppliers */}
          <Section title="Preferred Suppliers" icon={<Users className="w-4 h-4" />} defaultOpen={suppliers.length > 0}>
            <div className="space-y-3">
              {suppliers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suppliers.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 text-xs rounded-full border border-amber-200">
                      {s}
                      <button type="button" onClick={() => removeSupplier(s)}
                        className="text-amber-500 hover:text-amber-700">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSupplier}
                  onChange={e => setNewSupplier(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSupplier())}
                  placeholder="Supplier name or ID"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button type="button" onClick={addSupplier}
                  className="px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Section>

        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-white">
          <p className="text-xs text-gray-400">
            Last updated {fmtDate(material.audit?.updatedAt)}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              {hasChanges ? 'Discard' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Changes</>
              }
            </button>
          </div>
        </div>

      </SheetContent>
    </Sheet>
  );
};

export default MaterialDetailDrawer;
