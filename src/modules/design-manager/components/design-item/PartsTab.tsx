/**
 * PartsTab Component
 * Display and manage parts within a design item
 * Includes: Sheet parts, Standard parts (from inventory), and Special parts (approved for luxury)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Upload, Trash2, Edit2, Package, AlertCircle, Wrench, Sparkles, Save, Check, Library, Loader2, Search, DollarSign, RefreshCw, Calculator, ArrowUpDown, TreePine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useParts } from '../../hooks/useParts';
import { useProject } from '../../hooks';
import type { DesignItem, PartEntry, StandardPartEntry, SpecialPartEntry, ProjectPart } from '../../types';
import { PartForm } from './PartForm';
import { PartDetailDrawer } from './PartDetailDrawer';
import { FabricPartDetailDrawer } from './FabricPartDetailDrawer';
import { PartsImportDialog } from './PartsImportDialog';
import { ProjectPartsPicker } from './ProjectPartsPicker';
import { updateDesignItem } from '../../services/firestore';
import { useInventory } from '@/modules/inventory/hooks/useInventory';
import { getFinishes } from '@/modules/inventory/services/finishLibraryService';
import { resolveMaterialByName, resolveMaterialByPalette, paletteEntriesToFinishIds } from '@/subsidiaries/finishes/design-studio/services/materialResolverService';
import type { FinishDocument } from '@/modules/inventory/types/finishLibrary';
import { SupplierPicker } from '@/modules/procurement/components/SupplierPicker';
import { useOrganizationSettings } from '@/core/settings';
import {
  resolveEffectiveLaborRateWithSource,
  type LaborRateSource,
} from '@/modules/finance/services/laborRateCalculator';
import type { MaterialType, MaterialPaletteEntry } from '@/shared/types';
import { PartPurchasePriorityList } from './PartPurchasePriorityList';

interface PartsTabProps {
  item: DesignItem;
  projectId: string;
}

type PartsSection = 'sheet' | 'bar' | 'timber' | 'slab' | 'fabric' | 'component' | 'standard' | 'special' | 'costing' | 'priority';
type LaborRateBadgeSource = LaborRateSource | 'item_custom';

export function PartsTab({ item, projectId }: PartsTabProps) {
  const { user } = useAuth();
  const parts = useParts(projectId, item, user?.email || '');
  const { project } = useProject(projectId);
  const { settings: orgSettings } = useOrganizationSettings();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingPart, setEditingPart] = useState<PartEntry | null>(null);
  const [drawerPart, setDrawerPart] = useState<PartEntry | null>(null);
  const [fabricDrawerPart, setFabricDrawerPart] = useState<PartEntry | null>(null);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<PartsSection>('sheet');

  // Standard parts state (hinges, screws, edging from inventory)
  const manufacturing = (item as any).manufacturing || {};
  const [standardParts, setStandardParts] = useState<StandardPartEntry[]>(manufacturing.standardParts || []);
  const [_newStandardPart, setNewStandardPart] = useState({ name: '', category: 'hinge', quantity: 1, sku: '' });

  // Inventory module state
  const { items: inventoryItems, loading: loadingInventory, search: searchInventory, searchResults, isSearching, clearSearch } = useInventory({ tier: 'catalogue', status: 'active' });
  const [inventorySearch, setInventorySearch] = useState('');
  
  // Exchange rates for special parts
  const EXCHANGE_RATES: Record<string, number> = {
    'USD': 3700, 'EUR': 4000, 'GBP': 4600, 'AED': 1000, 'CNY': 510, 'KES': 29, 'UGX': 1
  };
  const TARGET_CURRENCY = 'UGX';
  
  // Special parts state (for luxury projects) - includes inline costing
  const [specialParts, setSpecialParts] = useState<SpecialPartEntry[]>(manufacturing.specialParts || []);
  const [newSpecialPart, setNewSpecialPart] = useState({ name: '', category: 'handle', quantity: 1, supplier: '', supplierId: '' });
  const [editingSpecialPartId, setEditingSpecialPartId] = useState<string | null>(null);
  const [editingCostingId, setEditingCostingId] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPartsPicker, setShowPartsPicker] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle');
  
  // Costing state (materials auto-calculated from parts, type-aware)
  const [sheetMaterials, setSheetMaterials] = useState<any[]>(manufacturing.sheetMaterials || []);
  const [sheetMaterialsCost, setSheetMaterialsCost] = useState<number>(manufacturing.sheetMaterialsCost || 0);
  const [timberMaterials, setTimberMaterials] = useState<any[]>((manufacturing as any).timberMaterials || []);
  const [timberMaterialsCost, setTimberMaterialsCost] = useState<number>((manufacturing as any).timberMaterialsCost || 0);
  const [linearMaterials, setLinearMaterials] = useState<any[]>((manufacturing as any).linearMaterials || []);
  const [linearMaterialsCost, setLinearMaterialsCost] = useState<number>((manufacturing as any).linearMaterialsCost || 0);
  const [slabMaterials, setSlabMaterials] = useState<any[]>((manufacturing as any).slabMaterials || []);
  const [slabMaterialsCost, setSlabMaterialsCost] = useState<number>((manufacturing as any).slabMaterialsCost || 0);
  const [fabricMaterials, setFabricMaterials] = useState<any[]>((manufacturing as any).fabricMaterials || []);
  const [fabricMaterialsCost, setFabricMaterialsCost] = useState<number>((manufacturing as any).fabricMaterialsCost || 0);
  const [componentCostTotal, setComponentCostTotal] = useState<number>((manufacturing as any).componentCost || 0);
  const [edgingMaterials, setEdgingMaterials] = useState<any[]>((manufacturing as any).edgingMaterials || []);
  const [edgingMaterialsCost, setEdgingMaterialsCost] = useState<number>((manufacturing as any).edgingMaterialsCost || 0);
  const [processingSteps, setProcessingSteps] = useState<any[]>((manufacturing as any).processingSteps || []);
  const [processingCost, setProcessingCost] = useState<number>((manufacturing as any).processingCost || 0);
  const [laborHours, setLaborHours] = useState<number>(manufacturing.laborHours || 0);
  const [laborRate, setLaborRate] = useState<number>(manufacturing.laborRate || 15000);
  const [laborRateSource, setLaborRateSource] = useState<LaborRateBadgeSource>(
    manufacturing.laborRate ? 'item_custom' : 'default_fallback'
  );
  const [calculating, setCalculating] = useState(false);

  // P21.11 — material-mapper: re-resolve unresolved parts against the Finish Library.
  const [resolving, setResolving] = useState(false);
  const [resolveSummary, setResolveSummary] = useState<string | null>(null);

  // Resolve org-level labor rate when settings load (if no per-item override)
  useEffect(() => {
    if (manufacturing.laborRate) {
      setLaborRateSource('item_custom');
      return;
    }
    if (!orgSettings?.pricingAssumptions) {
      setLaborRateSource('default_fallback');
      return;
    }

    let cancelled = false;
    const resolveRate = async () => {
      const result = await resolveEffectiveLaborRateWithSource({
        assumptions: orgSettings.pricingAssumptions,
      });
      if (!cancelled && result.rate > 0) {
        setLaborRate(result.rate);
        setLaborRateSource(result.source);
      }
    };

    void resolveRate();
    return () => {
      cancelled = true;
    };
  }, [orgSettings?.pricingAssumptions, manufacturing.laborRate]);

  const laborRateSourceMeta: Record<LaborRateBadgeSource, { label: string; className: string }> = {
    manual_override: {
      label: 'Manual Override',
      className: 'bg-purple-100 text-purple-700 border border-purple-200',
    },
    live_payroll: {
      label: 'Live Payroll',
      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    },
    cached_calculated: {
      label: 'Cached Calculated',
      className: 'bg-amber-100 text-amber-700 border border-amber-200',
    },
    default_fallback: {
      label: 'Default Rate',
      className: 'bg-gray-100 text-gray-700 border border-gray-200',
    },
    item_custom: {
      label: 'Item Custom',
      className: 'bg-blue-100 text-blue-700 border border-blue-200',
    },
  };

  const paletteEntries: MaterialPaletteEntry[] = (project as any)?.materialPalette?.entries || [];

  const resolveMaterialType = useCallback((materialName: string, thickness: number): MaterialType | null => {
    if (!paletteEntries.length || !materialName) return null;
    const normalized = materialName.toLowerCase().trim();
    const entry = paletteEntries.find(e => {
      const entryName = (e.designName || e.normalizedName || '').toLowerCase().trim();
      return entryName === normalized && Math.abs((e.thickness || 0) - thickness) < 0.1;
    });
    return entry?.materialType ?? null;
  }, [paletteEntries]);

  const MATERIAL_TYPE_COLORS: Record<string, string> = {
    TIMBER: 'bg-green-100 text-green-700',
    PANEL: 'bg-blue-100 text-blue-700',
    FABRIC: 'bg-violet-100 text-violet-700',
    STONE: 'bg-orange-100 text-orange-700',
    METAL_BAR: 'bg-teal-100 text-teal-700',
    ALUMINIUM: 'bg-teal-100 text-teal-700',
    GLASS: 'bg-cyan-100 text-cyan-700',
    COMPONENT: 'bg-slate-100 text-slate-700',
    EDGE: 'bg-amber-100 text-amber-700',
    SOLID: 'bg-green-100 text-green-700',
    VENEER: 'bg-yellow-100 text-yellow-700',
  };

  const partsList: PartEntry[] = (item as any).parts || [];

  const handleResolveMaterials = useCallback(async () => {
    if (!user?.email) return;
    setResolving(true);
    setResolveSummary(null);
    try {
      const finishes: FinishDocument[] = await getFinishes({ isActive: true });
      const palette = ((project as any)?.materialPalette?.entries ?? []) as MaterialPaletteEntry[];
      const paletteForResolver = palette.map(e => ({ name: e.designName, code: e.inventorySku }));
      const preferredFinishIds = paletteForResolver.length > 0 && finishes.length > 0
        ? paletteEntriesToFinishIds(paletteForResolver, finishes)
        : undefined;

      let resolvedFinish = 0;
      let resolvedPalette = 0;
      let missed = 0;
      const updated = partsList.map((p) => {
        if (p.materialId) return p;

        // Pass 1 — Finish Library lookup (carries materialId + optional inventoryItemId).
        const r = resolveMaterialByName(p.materialName, finishes, preferredFinishIds);
        if (r) {
          resolvedFinish += 1;
          return {
            ...p,
            materialId: r.finishId,
            materialCode: r.finishCode,
            materialName: r.finishName || p.materialName,
            inventoryItemId: r.inventoryItemId,
            materialResolutionSource: r.source,
            materialResolutionConfidence: r.confidence,
          } as PartEntry;
        }

        // Pass 2 — Project Material Palette fallback. Matches the part's
        // design-time name against mapped palette entries and propagates
        // the palette's inventoryItemId / materialId onto the part.
        // P21.12 — pass `finishes` so palette entries with only `finishId`
        // can have their `inventoryItemId` pulled through the Finish Library.
        const pal = resolveMaterialByPalette(p.materialName, palette, finishes);
        if (pal) {
          resolvedPalette += 1;
          return {
            ...p,
            materialId: pal.materialId ?? p.materialId,
            materialCode: pal.finishCode ?? p.materialCode,
            materialName: pal.finishName ?? p.materialName,
            inventoryItemId: pal.inventoryItemId,
            materialResolutionSource: pal.source,
            materialResolutionConfidence: pal.confidence,
          } as PartEntry;
        }

        missed += 1;
        return {
          ...p,
          materialResolutionSource: 'ai-guess',
          materialResolutionConfidence: 0,
        } as PartEntry;
      });

      const total = resolvedFinish + resolvedPalette + missed;
      if (total > 0) {
        await updateDesignItem(projectId, item.id, { parts: updated } as Partial<DesignItem>, user.email);
      }
      setResolveSummary(
        `Finish lib: ${resolvedFinish}, palette: ${resolvedPalette}, unmatched: ${missed}`,
      );
    } catch (err: any) {
      console.error('Resolve materials failed:', err);
      setResolveSummary(`Failed: ${err?.message ?? 'unknown error'}`);
    } finally {
      setResolving(false);
    }
  }, [user?.email, project, partsList, projectId, item.id]);

  // P21.11 — compact material cell: name + optional code chip + resolution pill.
  const renderMaterialCell = (p: PartEntry) => {
    const src = p.materialResolutionSource;
    const conf = p.materialResolutionConfidence ?? null;
    const pill = (() => {
      if (src === 'manual') return { label: 'manual', cls: 'bg-gray-100 text-gray-600' };
      if (src === 'palette-exact') return { label: '✓ palette', cls: 'bg-emerald-100 text-emerald-700' };
      if (src === 'palette-fuzzy') return { label: '~ palette', cls: 'bg-lime-100 text-lime-700' };
      if (src === 'ai-guess' && conf && conf >= 0.8) return { label: `ai ${Math.round(conf * 100)}%`, cls: 'bg-amber-100 text-amber-700' };
      if (src === 'ai-guess') return { label: 'unresolved', cls: 'bg-rose-100 text-rose-700' };
      if (p.materialId) return { label: 'linked', cls: 'bg-emerald-100 text-emerald-700' };
      return null;
    })();
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span>{p.materialName}</span>
        {p.materialCode && (
          <span className="px-1 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600">{p.materialCode}</span>
        )}
        {pill && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pill.cls}`}>{pill.label}</span>
        )}
      </div>
    );
  };

  const sheetParts = partsList.filter(p => !p.partType || p.partType === 'sheet');
  const barParts = partsList.filter(p => p.partType === 'bar');
  const timberParts = partsList.filter(p => p.partType === 'timber');
  const slabParts = partsList.filter(p => p.partType === 'slab');
  const fabricParts = partsList.filter(p => p.partType === 'fabric');
  const componentParts = partsList.filter(p => p.partType === 'component');
  const summary = (item as any).partsSummary;
  
  // Required quantity multiplier (how many of this design item are needed)
  const requiredQuantity = (item as any).requiredQuantity || 1;
  
  // Calculate totals per unit
  const standardPartsCostPerUnit = standardParts.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0);
  // Special parts cost is calculated from costing data (managed in Costing Tab)
  const specialPartsCostPerUnit = specialParts.reduce((sum, p) => sum + (p.costing?.totalLandedCost || 0), 0);
  
  // Calculate totals with requiredQuantity multiplier
  const standardPartsCost = standardPartsCostPerUnit * requiredQuantity;
  const specialPartsCost = specialPartsCostPerUnit * requiredQuantity;
  const totalStandardPartsQty = standardParts.reduce((sum, p) => sum + p.quantity, 0) * requiredQuantity;
  const totalSpecialPartsQty = specialParts.reduce((sum, p) => sum + p.quantity, 0) * requiredQuantity;

  // Track initial values to detect changes
  const initialStandardPartsRef = useRef(JSON.stringify(manufacturing.standardParts || []));
  const initialSpecialPartsRef = useRef(JSON.stringify(manufacturing.specialParts || []));
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to remove undefined values from objects (Firestore doesn't accept undefined)
  const cleanUndefinedValues = useCallback((obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(cleanUndefinedValues);
    if (typeof obj !== 'object') return obj;
    
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = typeof value === 'object' && value !== null ? cleanUndefinedValues(value) : value;
      }
    }
    return cleaned;
  }, []);

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!user?.email) return;
    
    setAutoSaveStatus('saving');
    try {
      const updatedManufacturing = cleanUndefinedValues({
        ...manufacturing,
        standardParts: standardParts,
        standardPartsCost: standardPartsCost,
        specialParts: specialParts,
        specialPartsCost: specialPartsCost,
      });
      await updateDesignItem(projectId, item.id, {
        manufacturing: updatedManufacturing,
      } as any, user.email);
      
      // Update refs to reflect saved state
      initialStandardPartsRef.current = JSON.stringify(standardParts);
      initialSpecialPartsRef.current = JSON.stringify(specialParts);
      
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setAutoSaveStatus('idle');
    }
  }, [user?.email, manufacturing, standardParts, specialParts, standardPartsCost, specialPartsCost, projectId, item.id]);

  // Auto-save effect - triggers when standard or special parts change
  useEffect(() => {
    const currentStandard = JSON.stringify(standardParts);
    const currentSpecial = JSON.stringify(specialParts);
    
    // Check if there are actual changes from initial state
    const hasChanges = 
      currentStandard !== initialStandardPartsRef.current ||
      currentSpecial !== initialSpecialPartsRef.current;
    
    if (!hasChanges) {
      return;
    }
    
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set pending status and schedule auto-save
    setAutoSaveStatus('pending');
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 1500); // 1.5 second debounce
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [standardParts, specialParts, performAutoSave]);

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
    try {
      await parts.bulkDelete(Array.from(selectedParts));
      setSelectedParts(new Set());
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const handleBulkReclassify = async (targetType: 'sheet' | 'bar') => {
    const count = selectedParts.size;
    if (!confirm(`Reclassify ${count} selected part(s) to ${targetType}?`)) return;
    try {
      const updates = Array.from(selectedParts).map(partId => {
        if (targetType === 'bar') {
          const part = partsList.find(p => p.id === partId);
          const barProfile = part ? `${part.thickness}x${part.width}` : '';
          return { partId, changes: { partType: 'bar' as const, barProfile } };
        } else {
          return { partId, changes: { partType: 'sheet' as const, barProfile: '' } };
        }
      });
      await parts.bulkUpdate(updates);
      setSelectedParts(new Set());
    } catch (err) {
      console.error('Reclassification failed:', err);
    }
  };

  const handleSingleReclassify = async (partId: string, targetType: 'sheet' | 'bar') => {
    try {
      if (targetType === 'bar') {
        const part = partsList.find(p => p.id === partId);
        const barProfile = part ? `${part.thickness}x${part.width}` : '';
        await parts.update(partId, { partType: 'bar', barProfile } as any);
      } else {
        await parts.update(partId, { partType: 'sheet', barProfile: '' } as any);
      }
    } catch (err) {
      console.error('Reclassification failed:', err);
    }
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

  const getActivePartsList = () => {
    switch (activeSection) {
      case 'bar': return barParts;
      case 'timber': return timberParts;
      case 'slab': return slabParts;
      case 'fabric': return fabricParts;
      case 'component': return componentParts;
      default: return sheetParts;
    }
  };

  const selectAll = () => {
    const activeParts = getActivePartsList();
    if (selectedParts.size === activeParts.length) {
      setSelectedParts(new Set());
    } else {
      setSelectedParts(new Set(activeParts.map((p) => p.id)));
    }
  };

  // Map inventory items to standard part picker format
  const inventoryPickerItems = useMemo(() => {
    const source = inventorySearch.trim() && searchResults.length > 0 ? searchResults : inventoryItems;
    return source.slice(0, 30).map(item => ({
      id: item.id,
      name: item.displayName || item.name,
      sku: item.sku,
      category: item.category || 'other',
      unitCost: item.costPerUnit || 0,
    }));
  }, [inventoryItems, searchResults, inventorySearch]);

  // Trigger inventory search on input change
  useEffect(() => {
    if (inventorySearch.trim()) {
      searchInventory(inventorySearch);
    } else {
      clearSearch();
    }
  }, [inventorySearch, searchInventory, clearSearch]);

  // Add standard part from inventory selection
  const addStandardPartFromInventory = (invItem: typeof inventoryPickerItems[0], quantity: number) => {
    setStandardParts([...standardParts, {
      id: `sp-${Date.now()}`,
      sku: invItem.sku,
      name: invItem.name,
      category: (invItem.category || 'other') as StandardPartEntry['category'],
      quantity: quantity,
      unitCost: invItem.unitCost,
      totalCost: quantity * invItem.unitCost,
    }]);
    setInventorySearch('');
    setNewStandardPart({ name: '', category: 'hinge', quantity: 1, sku: '' });
  };



  // Remove standard part
  const removeStandardPart = (id: string) => {
    setStandardParts(standardParts.filter(p => p.id !== id));
  };

  // Update standard part quantity
  const updateStandardPart = (id: string, updates: Partial<StandardPartEntry>) => {
    setStandardParts(standardParts.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // Add special part (identification only - costing handled in Costing Tab)
  const addSpecialPart = () => {
    if (!newSpecialPart.name) return;
    const newPart: any = {
      id: `xp-${Date.now()}`,
      name: newSpecialPart.name,
      category: newSpecialPart.category as SpecialPartEntry['category'],
      quantity: newSpecialPart.quantity,
      supplier: newSpecialPart.supplier || '',
      supplierId: newSpecialPart.supplierId || undefined,
      approvedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    };
    // Only add approvedBy if user email exists
    if (user?.email) {
      newPart.approvedBy = user.email;
    }
    setSpecialParts([...specialParts, newPart]);
    setNewSpecialPart({ name: '', category: 'handle', quantity: 1, supplier: '', supplierId: '' });
  };

  // Remove special part
  const removeSpecialPart = (id: string) => {
    setSpecialParts(specialParts.filter(p => p.id !== id));
  };

  // Update special part
  const updateSpecialPart = (id: string, updates: Partial<SpecialPartEntry>) => {
    // Clean undefined values before updating
    const cleanedUpdates = cleanUndefinedValues(updates);
    setSpecialParts(specialParts.map(p => p.id === id ? { ...p, ...cleanedUpdates } : p));
  };

  // Add special part from project parts library - auto-populate costing from clip price
  const addPartFromLibrary = (part: ProjectPart, quantity: number) => {
    // Default exchange rates
    const exchangeRates: Record<string, number> = {
      'USD': 3700, 'EUR': 4000, 'GBP': 4600, 'AED': 1000, 'CNY': 510, 'KES': 29, 'UGX': 1,
    };
    const targetCurrency = 'UGX';
    const exchangeRate = exchangeRates[part.currency] || 1;
    const totalSourceCost = part.unitCost * quantity;
    const totalLandedCost = totalSourceCost * exchangeRate;
    
    const newPart: SpecialPartEntry = {
      id: `xp-lib-${Date.now()}`,
      name: part.name,
      category: part.category,
      quantity: quantity,
      supplier: part.supplier,
      supplierId: (part as any).supplierId || undefined,
      referenceImageUrl: part.referenceImageUrl,
      purchaseUrl: part.purchaseUrl,
      projectPartId: part.id,
      ...(user?.email && { approvedBy: user.email }),
      approvedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
      // Auto-populate costing from clip price data
      costing: part.unitCost > 0 ? {
        unitCost: part.unitCost,
        currency: part.currency,
        exchangeRate: exchangeRate,
        targetCurrency: targetCurrency,
        totalSourceCost: totalSourceCost,
        landedUnitCost: (totalSourceCost / quantity) * exchangeRate,
        totalLandedCost: totalLandedCost,
        pricedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
        ...(user?.email && { pricedBy: user.email }),
      } : undefined,
    };
    setSpecialParts([...specialParts, newPart]);
    setShowPartsPicker(false);
  };

  // Save standard and special parts to Firestore
  const savePartsToFirestore = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updatedManufacturing = cleanUndefinedValues({
        ...manufacturing,
        standardParts: standardParts,
        standardPartsCost: standardPartsCost,
        specialParts: specialParts,
        specialPartsCost: specialPartsCost,
      });
      await updateDesignItem(projectId, item.id, {
        manufacturing: updatedManufacturing,
      } as any, user?.email || 'system');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save parts:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-UG');
  };

  return (
    <div className="space-y-4">
      {/* Required Quantity Banner */}
      {requiredQuantity > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-blue-700">×{requiredQuantity}</span>
            </div>
            <div>
              <p className="font-medium text-blue-900">Quantity Multiplier Active</p>
              <p className="text-sm text-blue-700">This design item requires {requiredQuantity} units. All part quantities are multiplied accordingly.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-600 uppercase">Total Parts Needed</p>
            <p className="text-xl font-bold text-blue-900">
              {(partsList.length * requiredQuantity) + totalStandardPartsQty + totalSpecialPartsQty}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Required Qty</p>
            <p className="text-xl font-bold text-gray-900">{requiredQuantity}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Sheet Parts</p>
            <p className="text-xl font-bold text-gray-900">
              {sheetParts.reduce((sum, p) => sum + p.quantity, 0)}
              {requiredQuantity > 1 && <span className="text-sm text-gray-500 font-normal"> × {requiredQuantity}</span>}
            </p>
          </div>
          <div className="bg-teal-50 rounded-lg p-3">
            <p className="text-xs text-teal-600 uppercase">Bar Parts</p>
            <p className="text-xl font-bold text-teal-700">
              {barParts.reduce((sum, p) => sum + p.quantity, 0)}
              {requiredQuantity > 1 && <span className="text-sm text-teal-500 font-normal"> × {requiredQuantity}</span>}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Materials</p>
            <p className="text-xl font-bold text-gray-900">{summary.uniqueMaterials}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Total Area</p>
            <p className="text-xl font-bold text-gray-900">
              {(summary.totalArea * requiredQuantity)?.toFixed(2) || 0} m²
              {requiredQuantity > 1 && <span className="text-xs text-gray-500 font-normal block">({summary.totalArea?.toFixed(2)} × {requiredQuantity})</span>}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase">Status</p>
            <p className={`text-xl font-bold ${summary.isComplete ? 'text-green-600' : 'text-amber-600'}`}>
              {summary.isComplete ? 'Complete' : 'Incomplete'}
            </p>
          </div>
        </div>
      )}

      {/* Auto-save Status Indicator */}
      {autoSaveStatus !== 'idle' && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
          autoSaveStatus === 'pending' ? 'bg-amber-50 text-amber-700' :
          autoSaveStatus === 'saving' ? 'bg-blue-50 text-blue-700' :
          'bg-green-50 text-green-700'
        }`}>
          {autoSaveStatus === 'pending' && (
            <>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span>Unsaved changes...</span>
            </>
          )}
          {autoSaveStatus === 'saving' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {autoSaveStatus === 'saved' && (
            <>
              <Check className="w-4 h-4" />
              <span>Saved</span>
            </>
          )}
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => { setActiveSection('sheet'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeSection === 'sheet'
              ? 'border-[#0A7C8E] text-[#0A7C8E]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package className="w-4 h-4" />
          Sheet Parts
          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{sheetParts.length}</span>
        </button>
        <button
          onClick={() => { setActiveSection('bar'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeSection === 'bar'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Bar
          <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">{barParts.length}</span>
        </button>
        <button
          onClick={() => { setActiveSection('timber'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeSection === 'timber'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <TreePine className="w-4 h-4" />
          Timber
          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{timberParts.length}</span>
        </button>
        <button
          onClick={() => { setActiveSection('slab'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeSection === 'slab'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Slabs
          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{slabParts.length}</span>
        </button>
        <button
          onClick={() => { setActiveSection('fabric'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeSection === 'fabric'
              ? 'border-violet-500 text-violet-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Fabric
          <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">{fabricParts.length}</span>
        </button>
        <button
          onClick={() => { setActiveSection('component'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeSection === 'component'
              ? 'border-slate-500 text-slate-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Components
          <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{componentParts.length}</span>
        </button>
        <button
          onClick={() => { setActiveSection('standard'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeSection === 'standard'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Standard Parts
          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{standardParts.length}</span>
        </button>
        <button
          onClick={() => { setActiveSection('special'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeSection === 'special'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Special Parts
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{specialParts.length}</span>
        </button>
        <button
          onClick={() => { setActiveSection('costing'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeSection === 'costing'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Costing Summary
          {manufacturing.totalCost > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
              UGX {formatCurrency(manufacturing.totalCost)}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveSection('priority'); setSelectedParts(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeSection === 'priority'
              ? 'border-rose-500 text-rose-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowUpDown className="w-4 h-4" />
          Purchase Priority
        </button>
      </div>

      {/* PURCHASE PRIORITY SECTION */}
      {activeSection === 'priority' && (
        <PartPurchasePriorityList item={item} projectId={projectId} parts={partsList} />
      )}

      {/* SHEET PARTS SECTION */}
      {activeSection === 'sheet' && (
        <>
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
              <button
                onClick={handleResolveMaterials}
                disabled={resolving || partsList.length === 0}
                title="Match each part's material name against the Finish Library"
                className="flex items-center gap-2 px-3 py-1.5 border border-indigo-200 text-indigo-700 rounded-lg text-sm hover:bg-indigo-50 disabled:opacity-50"
              >
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Resolve materials
              </button>
              {resolveSummary && (
                <span className="text-xs text-gray-500">{resolveSummary}</span>
              )}
              {selectedParts.size > 0 && (
                <>
                  <button
                    onClick={() => handleBulkReclassify('bar')}
                    className="flex items-center gap-2 px-3 py-1.5 text-teal-600 border border-teal-200 rounded-lg text-sm hover:bg-teal-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    To Bar ({selectedParts.size})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedParts.size})
                  </button>
                </>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {sheetParts.length} part{sheetParts.length !== 1 ? 's' : ''}
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
          {sheetParts.length === 0 ? (
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
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedParts.size === sheetParts.length && sheetParts.length > 0}
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
                  <th className="px-3 py-2 text-center font-medium text-gray-700">Type</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">Grain</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">Edges</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700" title="Manufacturing Priority (lower = made first)">Priority</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sheetParts.map((part) => (
                  <tr
                    key={part.id}
                    className={`cursor-pointer ${selectedParts.has(part.id) ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                    onClick={() => setDrawerPart(part)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedParts.has(part.id)}
                        onChange={() => toggleSelect(part.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600">{part.partNumber}</td>
                    <td className="px-3 py-2 font-medium text-[#0A7C8E]">
                      {part.name}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{part.length}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{part.width}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{part.thickness}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{part.quantity}</td>
                    <td className="px-3 py-2 text-gray-700">{renderMaterialCell(part)}</td>
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const mType = resolveMaterialType(part.materialName, part.thickness);
                        if (!mType) return <span className="text-xs text-gray-400">-</span>;
                        return (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${MATERIAL_TYPE_COLORS[mType] || 'bg-gray-100 text-gray-500'}`}>
                            {mType.replace('_', ' ')}
                          </span>
                        );
                      })()}
                    </td>
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
                        {(() => {
                          const lengths = (part.edgeBanding?.top ? 1 : 0) + (part.edgeBanding?.bottom ? 1 : 0);
                          const widths = (part.edgeBanding?.left ? 1 : 0) + (part.edgeBanding?.right ? 1 : 0);
                          if (!lengths && !widths) return '-';
                          return [lengths && `${lengths}L`, widths && `${widths}W`].filter(Boolean).join(' ');
                        })()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={(part as any).manufacturingPriority || ''}
                        onChange={async (e) => {
                          const priority = e.target.value ? parseInt(e.target.value) : undefined;
                          try {
                            await parts.update(part.id, { manufacturingPriority: priority } as any);
                          } catch (err) {
                            console.error('Failed to update priority:', err);
                          }
                        }}
                        className="w-16 px-1 py-0.5 text-xs border border-gray-200 rounded text-center bg-white"
                        title="Manufacturing priority (1=first, 5=last)"
                      >
                        <option value="">-</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSingleReclassify(part.id, 'bar')}
                          className="p-1 text-gray-400 hover:text-teal-600 rounded"
                          title="Reclassify to Bar"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDrawerPart(part)}
                          className="p-1 text-gray-400 hover:text-[#0A7C8E] rounded"
                          title="Edit in drawer"
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

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {/* Select All Header */}
            <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={selectedParts.size === sheetParts.length && sheetParts.length > 0}
                  onChange={selectAll}
                  className="rounded border-gray-300"
                />
                Select All
              </label>
              <span className="text-xs text-gray-500">{sheetParts.length} parts</span>
            </div>
            {sheetParts.map((part) => (
              <div
                key={part.id}
                className={`p-3 cursor-pointer ${selectedParts.has(part.id) ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                onClick={() => setDrawerPart(part)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedParts.has(part.id)}
                    onChange={() => toggleSelect(part.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300 mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    {/* Part Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[#0A7C8E]">{part.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{part.partNumber}</p>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDrawerPart(part)}
                          className="p-1.5 text-gray-400 hover:text-[#0A7C8E] rounded hover:bg-gray-100"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(part.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Dimensions & Info */}
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Dimensions:</span>
                        <span className="font-medium">{part.length} × {part.width} × {part.thickness}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Qty:</span>
                        <span className="font-medium">{part.quantity}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-gray-500">Material:</span>
                        <span className="font-medium truncate ml-2">{renderMaterialCell(part)}</span>
                      </div>
                    </div>
                    
                    {/* Tags Row */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        part.grainDirection === 'length' ? 'bg-blue-100 text-blue-700' :
                        part.grainDirection === 'width' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        Grain: {part.grainDirection === 'length' ? 'L' : part.grainDirection === 'width' ? 'W' : '-'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        Edge: {(() => {
                          const lengths = (part.edgeBanding?.top ? 1 : 0) + (part.edgeBanding?.bottom ? 1 : 0);
                          const widths = (part.edgeBanding?.left ? 1 : 0) + (part.edgeBanding?.right ? 1 : 0);
                          if (!lengths && !widths) return '-';
                          return [lengths && `${lengths}L`, widths && `${widths}W`].filter(Boolean).join(' ');
                        })()}
                      </span>
                      {(part as any).manufacturingPriority && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                          Priority: {(part as any).manufacturingPriority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
        </>
      )}

      {/* BAR / TIMBER PARTS SECTION */}
      {(activeSection === 'bar' || activeSection === 'timber') && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              {selectedParts.size > 0 && (
                <>
                  <button
                    onClick={() => handleBulkReclassify('sheet')}
                    className="flex items-center gap-2 px-3 py-1.5 text-[#0A7C8E] border border-[#0A7C8E]/30 rounded-lg text-sm hover:bg-[#0A7C8E]/5"
                  >
                    <RefreshCw className="h-4 w-4" />
                    To Sheet ({selectedParts.size})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedParts.size})
                  </button>
                </>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {activeSection === 'timber'
                ? `${timberParts.length} timber part${timberParts.length !== 1 ? 's' : ''}`
                : `${barParts.length} bar part${barParts.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {parts.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-800">
              <AlertCircle className="h-4 w-4" />
              {parts.error.message}
            </div>
          )}

          {(activeSection === 'timber' ? timberParts.length : barParts.length) === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">
                {activeSection === 'timber' ? 'No timber parts' : 'No bar parts'}
              </h3>
              <p className="text-gray-500 mt-1">
                {activeSection === 'timber'
                  ? 'Wood section parts with volumetric pricing appear here.'
                  : 'Metal/aluminium linear section parts appear here.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-teal-50 border-b border-teal-200">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={
                            selectedParts.size === (activeSection === 'timber' ? timberParts.length : barParts.length) &&
                            (activeSection === 'timber' ? timberParts.length : barParts.length) > 0
                          }
                          onChange={selectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-teal-800">Part #</th>
                      <th className="px-3 py-2 text-left font-medium text-teal-800">Name</th>
                      <th className="px-3 py-2 text-right font-medium text-teal-800">Length (mm)</th>
                      <th className="px-3 py-2 text-center font-medium text-teal-800">Profile</th>
                      <th className="px-3 py-2 text-center font-medium text-teal-800">Qty</th>
                      <th className="px-3 py-2 text-left font-medium text-teal-800">Material</th>
                      <th className="px-3 py-2 text-right font-medium text-teal-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100">
                    {(activeSection === 'timber' ? timberParts : barParts).map((part) => (
                      <tr
                        key={part.id}
                        className={`cursor-pointer ${selectedParts.has(part.id) ? 'bg-teal-50/50' : 'hover:bg-gray-50'}`}
                        onClick={() => setDrawerPart(part)}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedParts.has(part.id)}
                            onChange={() => toggleSelect(part.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-600">{part.partNumber}</td>
                        <td className="px-3 py-2 font-medium text-[#0A7C8E]">{part.name}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{part.length}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-xs bg-teal-100 text-teal-700">
                            {part.barProfile || `${part.thickness}x${part.width}`}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">{part.quantity}</td>
                        <td className="px-3 py-2 text-gray-700">{renderMaterialCell(part)}</td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSingleReclassify(part.id, 'sheet')}
                              className="p-1 text-gray-400 hover:text-[#0A7C8E] rounded"
                              title="Reclassify to Sheet"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDrawerPart(part)}
                              className="p-1 text-gray-400 hover:text-[#0A7C8E] rounded"
                              title="Edit in drawer"
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

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-teal-100">
                <div className="px-3 py-2 bg-teal-50 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-teal-700">
                    <input
                      type="checkbox"
                      checked={
                        selectedParts.size === (activeSection === 'timber' ? timberParts.length : barParts.length) &&
                        (activeSection === 'timber' ? timberParts.length : barParts.length) > 0
                      }
                      onChange={selectAll}
                      className="rounded border-gray-300"
                    />
                    Select All
                  </label>
                  <span className="text-xs text-teal-600">
                    {activeSection === 'timber'
                      ? `${timberParts.length} timber parts`
                      : `${barParts.length} bar parts`}
                  </span>
                </div>
                {(activeSection === 'timber' ? timberParts : barParts).map((part) => (
                  <div
                    key={part.id}
                    className={`p-3 cursor-pointer ${selectedParts.has(part.id) ? 'bg-teal-50/50' : 'hover:bg-gray-50'}`}
                    onClick={() => setDrawerPart(part)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedParts.has(part.id)}
                        onChange={() => toggleSelect(part.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-[#0A7C8E]">{part.name}</p>
                            <p className="text-xs text-gray-500 font-mono">{part.partNumber}</p>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleSingleReclassify(part.id, 'sheet')}
                              className="p-1.5 text-gray-400 hover:text-[#0A7C8E] rounded hover:bg-teal-50"
                              title="Reclassify to Sheet"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDrawerPart(part)}
                              className="p-1.5 text-gray-400 hover:text-[#0A7C8E] rounded hover:bg-gray-100"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(part.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Length:</span>
                            <span className="font-medium">{part.length} mm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Qty:</span>
                            <span className="font-medium">{part.quantity}</span>
                          </div>
                          <div className="flex justify-between col-span-2">
                            <span className="text-gray-500">Material:</span>
                            <span className="font-medium truncate ml-2">{renderMaterialCell(part)}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-teal-100 text-teal-700">
                            Profile: {part.barProfile || `${part.thickness}x${part.width}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* SLAB PARTS SECTION */}
      {activeSection === 'slab' && (
        <>
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              {selectedParts.size > 0 && (
                <>
                  <button
                    onClick={() => handleBulkReclassify('sheet')}
                    className="flex items-center gap-2 px-3 py-1.5 text-[#0A7C8E] border border-[#0A7C8E]/30 rounded-lg text-sm hover:bg-[#0A7C8E]/5"
                  >
                    <RefreshCw className="h-4 w-4" />
                    To Sheet ({selectedParts.size})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedParts.size})
                  </button>
                </>
              )}
            </div>
            <span className="text-sm text-gray-500">{slabParts.length} slab part{slabParts.length === 1 ? '' : 's'}</span>
          </div>
          {slabParts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No slab parts</h3>
              <p className="text-gray-500 mt-1">Stone / granite / quartz slab parts show here. Tag parts via the material palette (<code className="text-xs">materialType: STONE</code>) or reclassify from Sheet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 border-b border-orange-200">
                  <tr>
                    <th className="px-3 py-2 text-left"><input type="checkbox" checked={slabParts.every(p => selectedParts.has(p.id))} onChange={() => {
                      const all = slabParts.every(p => selectedParts.has(p.id));
                      setSelectedParts(prev => {
                        const next = new Set(prev);
                        slabParts.forEach(p => all ? next.delete(p.id) : next.add(p.id));
                        return next;
                      });
                    }} /></th>
                    <th className="px-3 py-2 text-left font-medium text-orange-800">Part #</th>
                    <th className="px-3 py-2 text-left font-medium text-orange-800">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-orange-800">Material</th>
                    <th className="px-3 py-2 text-right font-medium text-orange-800">L (mm)</th>
                    <th className="px-3 py-2 text-right font-medium text-orange-800">W (mm)</th>
                    <th className="px-3 py-2 text-right font-medium text-orange-800">T (mm)</th>
                    <th className="px-3 py-2 text-center font-medium text-orange-800">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-orange-800">Area (m²)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50">
                  {slabParts.map(part => (
                    <tr key={part.id} className="hover:bg-orange-50/30">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedParts.has(part.id)} onChange={() => setSelectedParts(prev => {
                          const next = new Set(prev);
                          next.has(part.id) ? next.delete(part.id) : next.add(part.id);
                          return next;
                        })} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{part.partNumber}</td>
                      <td className="px-3 py-2 text-gray-900">{part.name}</td>
                      <td className="px-3 py-2 text-gray-600">{part.materialName}</td>
                      <td className="px-3 py-2 text-right">{part.length}</td>
                      <td className="px-3 py-2 text-right">{part.width}</td>
                      <td className="px-3 py-2 text-right">{part.thickness}</td>
                      <td className="px-3 py-2 text-center font-medium">{part.quantity}</td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">{((part.length * part.width * part.quantity) / 1_000_000).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* FABRIC PARTS SECTION */}
      {activeSection === 'fabric' && (
        <>
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              {selectedParts.size > 0 && (
                <>
                  <button
                    onClick={() => handleBulkReclassify('sheet')}
                    className="flex items-center gap-2 px-3 py-1.5 text-[#0A7C8E] border border-[#0A7C8E]/30 rounded-lg text-sm hover:bg-[#0A7C8E]/5"
                  >
                    <RefreshCw className="h-4 w-4" />
                    To Sheet ({selectedParts.size})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedParts.size})
                  </button>
                </>
              )}
            </div>
            <span className="text-sm text-gray-500">{fabricParts.length} fabric part{fabricParts.length === 1 ? '' : 's'}</span>
          </div>
          {fabricParts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No fabric parts</h3>
              <p className="text-gray-500 mt-1">Upholstery / fabric parts show here. Tag parts via the material palette (<code className="text-xs">materialType: FABRIC</code>) or reclassify from Sheet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-violet-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-violet-50 border-b border-violet-200">
                  <tr>
                    <th className="px-3 py-2 text-left"><input type="checkbox" checked={fabricParts.every(p => selectedParts.has(p.id))} onChange={() => {
                      const all = fabricParts.every(p => selectedParts.has(p.id));
                      setSelectedParts(prev => {
                        const next = new Set(prev);
                        fabricParts.forEach(p => all ? next.delete(p.id) : next.add(p.id));
                        return next;
                      });
                    }} /></th>
                    <th className="px-3 py-2 text-left font-medium text-violet-800">Part #</th>
                    <th className="px-3 py-2 text-left font-medium text-violet-800">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-violet-800">Material</th>
                    <th className="px-3 py-2 text-right font-medium text-violet-800">L (mm)</th>
                    <th className="px-3 py-2 text-right font-medium text-violet-800">W (mm)</th>
                    <th className="px-3 py-2 text-right font-medium text-violet-800">Roll W (mm)</th>
                    <th className="px-3 py-2 text-center font-medium text-violet-800">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-violet-800">Area (m²)</th>
                    <th className="px-3 py-2 text-right font-medium text-violet-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-50">
                  {fabricParts.map(part => (
                    <tr
                      key={part.id}
                      className="cursor-pointer hover:bg-violet-50/30"
                      onClick={() => {
                        setDrawerPart(null);
                        setFabricDrawerPart(part);
                      }}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedParts.has(part.id)} onChange={() => setSelectedParts(prev => {
                          const next = new Set(prev);
                          next.has(part.id) ? next.delete(part.id) : next.add(part.id);
                          return next;
                        })} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{part.partNumber}</td>
                      <td className="px-3 py-2 text-gray-900">{part.name}</td>
                      <td className="px-3 py-2 text-gray-600">{renderMaterialCell(part)}</td>
                      <td className="px-3 py-2 text-right">{part.length}</td>
                      <td className="px-3 py-2 text-right">{part.width}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{part.rollWidth || '—'}</td>
                      <td className="px-3 py-2 text-center font-medium">{part.quantity}</td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">{((part.length * part.width * part.quantity) / 1_000_000).toFixed(3)}</td>
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setDrawerPart(null);
                              setFabricDrawerPart(part);
                            }}
                            className="p-1 text-gray-400 hover:text-violet-700 rounded"
                            title="Edit in drawer"
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
          )}
        </>
      )}

      {/* COMPONENT PARTS SECTION */}
      {activeSection === 'component' && (
        <>
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              {selectedParts.size > 0 && (
                <>
                  <button
                    onClick={() => handleBulkReclassify('sheet')}
                    className="flex items-center gap-2 px-3 py-1.5 text-[#0A7C8E] border border-[#0A7C8E]/30 rounded-lg text-sm hover:bg-[#0A7C8E]/5"
                  >
                    <RefreshCw className="h-4 w-4" />
                    To Sheet ({selectedParts.size})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedParts.size})
                  </button>
                </>
              )}
            </div>
            <span className="text-sm text-gray-500">{componentParts.length} component part{componentParts.length === 1 ? '' : 's'}</span>
          </div>
          {componentParts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No component parts</h3>
              <p className="text-gray-500 mt-1">Bought-out components (hinges, slides, handles, fittings) show here. Scene sync maps hardware, fastener, fitting, consumable, and packaging categories to this tab automatically.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left"><input type="checkbox" checked={componentParts.every(p => selectedParts.has(p.id))} onChange={() => {
                      const all = componentParts.every(p => selectedParts.has(p.id));
                      setSelectedParts(prev => {
                        const next = new Set(prev);
                        componentParts.forEach(p => all ? next.delete(p.id) : next.add(p.id));
                        return next;
                      });
                    }} /></th>
                    <th className="px-3 py-2 text-left font-medium text-slate-800">Part #</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-800">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-800">Material</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-800">Dimensions</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-800">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {componentParts.map(part => (
                    <tr key={part.id} className="hover:bg-slate-50/30">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedParts.has(part.id)} onChange={() => setSelectedParts(prev => {
                          const next = new Set(prev);
                          next.has(part.id) ? next.delete(part.id) : next.add(part.id);
                          return next;
                        })} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{part.partNumber}</td>
                      <td className="px-3 py-2 text-gray-900">{part.name}</td>
                      <td className="px-3 py-2 text-gray-600">{part.materialName}</td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">
                        {part.length > 0 || part.width > 0 || part.thickness > 0
                          ? `${part.length}×${part.width}×${part.thickness}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-center font-medium">{part.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* STANDARD PARTS SECTION */}
      {activeSection === 'standard' && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-4">
              <Wrench className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900">Standard Parts</h3>
                <p className="text-sm text-orange-700">Hinges, slides, screws, cams, dowels, and edging from inventory</p>
              </div>
            </div>

            {standardParts.length > 0 && (
              <div className="bg-white rounded-lg border border-orange-200 overflow-hidden mb-4">
                {/* Desktop Table */}
                <table className="hidden sm:table w-full text-sm">
                  <thead className="bg-orange-50 border-b border-orange-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-orange-800">Category</th>
                      <th className="px-3 py-2 text-left font-medium text-orange-800">Name</th>
                      <th className="px-3 py-2 text-right font-medium text-orange-800">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-orange-800">Unit Cost</th>
                      <th className="px-3 py-2 text-right font-medium text-orange-800">Total</th>
                      <th className="px-3 py-2 text-right font-medium text-orange-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-100">
                    {standardParts.map((part) => (
                      <tr key={part.id} className="hover:bg-orange-50/50">
                        <td className="px-3 py-2">
                          <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded capitalize">{part.category}</span>
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">{part.name}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            value={part.quantity}
                            onChange={(e) => updateStandardPart(part.id, { quantity: parseFloat(e.target.value) || 0 })}
                            min="0.01"
                            step="any"
                            className="w-20 text-sm border border-orange-300 rounded px-2 py-0.5 text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">UGX {formatCurrency(part.unitCost)}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">UGX {formatCurrency(part.quantity * part.unitCost)}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => removeStandardPart(part.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Mobile Card View */}
                <div className="sm:hidden divide-y divide-orange-100">
                  {standardParts.map((part) => (
                    <div key={part.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded capitalize">{part.category}</span>
                          </div>
                          <p className="font-medium text-gray-900 mt-1">{part.name}</p>
                          <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                            <span className="flex items-center gap-1">Qty:
                              <input
                                type="number"
                                value={part.quantity}
                                onChange={(e) => updateStandardPart(part.id, { quantity: parseFloat(e.target.value) || 0 })}
                                min="0.01"
                                step="any"
                                className="w-16 text-sm border border-orange-300 rounded px-1 py-0.5 text-right font-bold"
                              />
                            </span>
                            <span>@ UGX {formatCurrency(part.unitCost)}</span>
                          </div>
                          <p className="mt-1 font-semibold text-orange-700">
                            Total: UGX {formatCurrency(part.quantity * part.unitCost)}
                          </p>
                        </div>
                        <button 
                          onClick={() => removeStandardPart(part.id)} 
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventory Search */}
            <div className="bg-white p-3 rounded-lg border border-orange-200 space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search inventory by name or SKU..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Inventory Items List */}
              {inventoryPickerItems.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-orange-100 rounded-lg divide-y divide-orange-100">
                  {inventoryPickerItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 hover:bg-orange-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">SKU: {item.sku} • UGX {formatCurrency(item.unitCost)}/unit</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          defaultValue="1"
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                          id={`qty-${item.id}`}
                        />
                        <button
                          onClick={() => {
                            const qty = parseFloat((document.getElementById(`qty-${item.id}`) as HTMLInputElement)?.value || '1');
                            addStandardPartFromInventory(item, qty);
                          }}
                          className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {inventorySearch && inventoryPickerItems.length === 0 && !loadingInventory && !isSearching && (
                <p className="text-sm text-gray-500 text-center py-2">No items found in inventory</p>
              )}

              {(loadingInventory || isSearching) && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  <span className="ml-2 text-sm text-gray-500">Loading inventory...</span>
                </div>
              )}

              <p className="text-xs text-orange-600">Costs are fetched from the inventory module. Only specify quantity.</p>
            </div>

            {standardPartsCostPerUnit > 0 && (
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-orange-300">
                <div>
                  <span className="text-sm text-orange-800">Standard Parts Total:</span>
                  {requiredQuantity > 1 && (
                    <span className="text-xs text-orange-600 ml-2">(×{requiredQuantity} units)</span>
                  )}
                </div>
                <div className="text-right">
                  {requiredQuantity > 1 && (
                    <p className="text-xs text-orange-600">Per unit: UGX {formatCurrency(standardPartsCostPerUnit)}</p>
                  )}
                  <span className="font-bold text-orange-900 text-lg">UGX {formatCurrency(standardPartsCost)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={savePartsToFirestore}
              disabled={saving}
              className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${
                saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : saveSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Standard Parts'}
            </button>
          </div>
        </div>
      )}

      {/* SPECIAL PARTS SECTION */}
      {activeSection === 'special' && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-purple-900">Special Parts</h3>
                  <p className="text-sm text-purple-700">Custom handles, locks, and accessories for luxury projects (requires approval)</p>
                </div>
              </div>
              <button
                onClick={() => setShowPartsPicker(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
              >
                <Library className="w-4 h-4" />
                Select from Library
              </button>
            </div>

            {specialParts.length > 0 && (
              <div className="bg-white rounded-lg border border-purple-200 overflow-hidden mb-4">
                {/* Desktop Table */}
                <table className="hidden sm:table w-full text-sm">
                  <thead className="bg-purple-50 border-b border-purple-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-purple-800">Category</th>
                      <th className="px-3 py-2 text-left font-medium text-purple-800">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-purple-800">Supplier</th>
                      <th className="px-3 py-2 text-right font-medium text-purple-800">Qty</th>
                      <th className="px-3 py-2 text-center font-medium text-purple-800">Costing</th>
                      <th className="px-3 py-2 text-right font-medium text-purple-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {specialParts.map((part) => (
                      <React.Fragment key={part.id}>
                      <tr className="hover:bg-purple-50/50">
                        <td className="px-3 py-2">
                          {editingSpecialPartId === part.id ? (
                            <select
                              value={part.category}
                              onChange={(e) => updateSpecialPart(part.id, { category: e.target.value as any })}
                              className="text-xs border border-purple-300 rounded px-1 py-0.5"
                            >
                              <option value="handle">Handle</option>
                              <option value="lock">Lock</option>
                              <option value="hinge">Hinge</option>
                              <option value="pull">Pull</option>
                              <option value="knob">Knob</option>
                              <option value="fitting">Fitting</option>
                              <option value="accessory">Accessory</option>
                              <option value="other">Other</option>
                            </select>
                          ) : (
                            <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded capitalize">{part.category}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingSpecialPartId === part.id ? (
                            <input
                              type="text"
                              value={part.name}
                              onChange={(e) => updateSpecialPart(part.id, { name: e.target.value })}
                              className="w-full text-sm border border-purple-300 rounded px-2 py-0.5"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{part.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingSpecialPartId === part.id ? (
                            <SupplierPicker
                              value={part.supplierId ? { supplierId: part.supplierId, supplierName: part.supplier || '' } : null}
                              onChange={(val) => updateSpecialPart(part.id, {
                                supplier: val?.supplierName || '',
                                supplierId: val?.supplierId || undefined
                              })}
                              label=""
                              placeholder="Search suppliers..."
                            />
                          ) : (
                            <span className="text-gray-600">{part.supplier || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editingSpecialPartId === part.id ? (
                            <input
                              type="number"
                              value={part.quantity}
                              onChange={(e) => updateSpecialPart(part.id, { quantity: parseFloat(e.target.value) || 0 })}
                              min="0.01"
                              step="any"
                              className="w-20 text-sm border border-purple-300 rounded px-2 py-0.5 text-right"
                            />
                          ) : (
                            <span className="text-gray-700">{part.quantity}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {part.costing ? (
                            <button
                              onClick={() => setEditingCostingId(editingCostingId === part.id ? null : part.id)}
                              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200"
                            >
                              {part.costing.targetCurrency} {formatCurrency(part.costing.totalLandedCost)}
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingCostingId(part.id)}
                              className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded hover:bg-amber-200 flex items-center gap-1"
                            >
                              <DollarSign className="w-3 h-3" />
                              Add Costing
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editingSpecialPartId === part.id ? (
                              <button 
                                onClick={() => setEditingSpecialPartId(null)} 
                                className="text-green-600 hover:text-green-800 text-xs font-medium"
                              >
                                Done
                              </button>
                            ) : (
                              <button 
                                onClick={() => setEditingSpecialPartId(part.id)} 
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => removeSpecialPart(part.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Inline Costing Editor */}
                      {editingCostingId === part.id && (
                        <tr className="bg-purple-50/50">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="bg-white rounded-lg border border-purple-200 p-4 space-y-4">
                              <div className="flex items-center gap-2 text-sm font-medium text-purple-800">
                                <DollarSign className="w-4 h-4" />
                                Landed Cost Calculation
                              </div>
                              <div className="grid grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Unit Cost</label>
                                  <input
                                    type="number"
                                    value={part.costing?.unitCost || ''}
                                    onChange={(e) => {
                                      const unitCost = parseFloat(e.target.value) || 0;
                                      const costing = part.costing || { unitCost: 0, currency: 'USD', exchangeRate: EXCHANGE_RATES['USD'], targetCurrency: TARGET_CURRENCY, transportCost: 0, logisticsCost: 0, customsCost: 0, totalSourceCost: 0, landedUnitCost: 0, totalLandedCost: 0 };
                                      const transportCost = (costing as any).transportCost || 0;
                                      const logisticsCost = (costing as any).logisticsCost || 0;
                                      const customsCost = (costing as any).customsCost || 0;
                                      const totalPerUnit = unitCost + transportCost + logisticsCost + customsCost;
                                      const totalSourceCost = totalPerUnit * part.quantity;
                                      const totalLandedCost = totalSourceCost * costing.exchangeRate;
                                      updateSpecialPart(part.id, {
                                        costing: { ...costing, unitCost, totalSourceCost, landedUnitCost: totalPerUnit * costing.exchangeRate, totalLandedCost, pricedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any, ...(user?.email && { pricedBy: user.email }) }
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                    placeholder="0.00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Currency</label>
                                  <select
                                    value={part.costing?.currency || 'USD'}
                                    onChange={(e) => {
                                      const currency = e.target.value;
                                      const exchangeRate = EXCHANGE_RATES[currency] || 1;
                                      const costing = part.costing || { unitCost: 0, currency: 'USD', exchangeRate: EXCHANGE_RATES['USD'], targetCurrency: TARGET_CURRENCY, transportCost: 0, logisticsCost: 0, customsCost: 0, totalSourceCost: 0, landedUnitCost: 0, totalLandedCost: 0 };
                                      const totalPerUnit = (costing.unitCost || 0) + ((costing as any).transportCost || 0) + ((costing as any).logisticsCost || 0) + ((costing as any).customsCost || 0);
                                      const totalSourceCost = totalPerUnit * part.quantity;
                                      const totalLandedCost = totalSourceCost * exchangeRate;
                                      updateSpecialPart(part.id, {
                                        costing: { ...costing, currency, exchangeRate, landedUnitCost: totalPerUnit * exchangeRate, totalLandedCost }
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  >
                                    <option value="UGX">UGX</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value="AED">AED</option>
                                    <option value="CNY">CNY</option>
                                    <option value="KES">KES</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Exchange Rate</label>
                                  <input
                                    type="number"
                                    value={part.costing?.exchangeRate || EXCHANGE_RATES['USD']}
                                    onChange={(e) => {
                                      const exchangeRate = parseFloat(e.target.value) || 1;
                                      const costing = part.costing || { unitCost: 0, currency: 'USD', exchangeRate: EXCHANGE_RATES['USD'], targetCurrency: TARGET_CURRENCY, transportCost: 0, logisticsCost: 0, customsCost: 0, totalSourceCost: 0, landedUnitCost: 0, totalLandedCost: 0 };
                                      const totalPerUnit = (costing.unitCost || 0) + ((costing as any).transportCost || 0) + ((costing as any).logisticsCost || 0) + ((costing as any).customsCost || 0);
                                      const totalSourceCost = totalPerUnit * part.quantity;
                                      const totalLandedCost = totalSourceCost * exchangeRate;
                                      updateSpecialPart(part.id, {
                                        costing: { ...costing, exchangeRate, landedUnitCost: totalPerUnit * exchangeRate, totalLandedCost }
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">To {TARGET_CURRENCY}</label>
                                  <div className="px-2 py-1.5 text-sm bg-gray-100 rounded text-gray-700">
                                    1 {part.costing?.currency || 'USD'} = {part.costing?.exchangeRate || EXCHANGE_RATES['USD']} UGX
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Transport/Shipping (per unit)</label>
                                  <input
                                    type="number"
                                    value={part.costing?.transportCost || ''}
                                    onChange={(e) => {
                                      const transportCost = parseFloat(e.target.value) || 0;
                                      const costing = part.costing || { unitCost: 0, currency: 'USD', exchangeRate: EXCHANGE_RATES['USD'], targetCurrency: TARGET_CURRENCY, totalSourceCost: 0, landedUnitCost: 0, totalLandedCost: 0 };
                                      const totalPerUnit = (costing.unitCost || 0) + transportCost + (costing.logisticsCost || 0) + (costing.customsCost || 0);
                                      const totalSourceCost = totalPerUnit * part.quantity;
                                      const totalLandedCost = totalSourceCost * costing.exchangeRate;
                                      updateSpecialPart(part.id, {
                                        costing: { ...costing, transportCost, totalSourceCost, landedUnitCost: totalPerUnit * costing.exchangeRate, totalLandedCost }
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                    placeholder="0.00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Logistics/Handling (per unit)</label>
                                  <input
                                    type="number"
                                    value={part.costing?.logisticsCost || ''}
                                    onChange={(e) => {
                                      const logisticsCost = parseFloat(e.target.value) || 0;
                                      const costing = part.costing || { unitCost: 0, currency: 'USD', exchangeRate: EXCHANGE_RATES['USD'], targetCurrency: TARGET_CURRENCY, totalSourceCost: 0, landedUnitCost: 0, totalLandedCost: 0 };
                                      const totalPerUnit = (costing.unitCost || 0) + (costing.transportCost || 0) + logisticsCost + (costing.customsCost || 0);
                                      const totalSourceCost = totalPerUnit * part.quantity;
                                      const totalLandedCost = totalSourceCost * costing.exchangeRate;
                                      updateSpecialPart(part.id, {
                                        costing: { ...costing, logisticsCost, totalSourceCost, landedUnitCost: totalPerUnit * costing.exchangeRate, totalLandedCost }
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                    placeholder="0.00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Customs/Duties (per unit)</label>
                                  <input
                                    type="number"
                                    value={part.costing?.customsCost || ''}
                                    onChange={(e) => {
                                      const customsCost = parseFloat(e.target.value) || 0;
                                      const costing = part.costing || { unitCost: 0, currency: 'USD', exchangeRate: EXCHANGE_RATES['USD'], targetCurrency: TARGET_CURRENCY, totalSourceCost: 0, landedUnitCost: 0, totalLandedCost: 0 };
                                      const totalPerUnit = (costing.unitCost || 0) + (costing.transportCost || 0) + (costing.logisticsCost || 0) + customsCost;
                                      const totalSourceCost = totalPerUnit * part.quantity;
                                      const totalLandedCost = totalSourceCost * costing.exchangeRate;
                                      updateSpecialPart(part.id, {
                                        costing: { ...costing, customsCost, totalSourceCost, landedUnitCost: totalPerUnit * costing.exchangeRate, totalLandedCost }
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-between items-center pt-3 border-t border-purple-200">
                                <div className="text-sm text-gray-600">
                                  <span>Qty: {part.quantity} × </span>
                                  <span className="font-medium">{part.costing?.currency || 'USD'} {((part.costing?.unitCost || 0) + (part.costing?.transportCost || 0) + (part.costing?.logisticsCost || 0) + (part.costing?.customsCost || 0)).toFixed(2)}</span>
                                  <span> = {part.costing?.currency || 'USD'} {part.costing?.totalSourceCost?.toFixed(2) || '0.00'}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Total Landed Cost</p>
                                  <p className="text-lg font-bold text-purple-900">UGX {formatCurrency(part.costing?.totalLandedCost || 0)}</p>
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => setEditingCostingId(null)}
                                  className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                
                {/* Mobile Card View */}
                <div className="sm:hidden divide-y divide-purple-100">
                  {specialParts.map((part) => (
                    <div key={part.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded capitalize">{part.category}</span>
                            {part.referenceImageUrl && (
                              <img src={part.referenceImageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                            )}
                          </div>
                          <p className="font-medium text-gray-900 mt-1">{part.name}</p>
                          {part.supplier && (
                            <p className="text-sm text-gray-600">Supplier: {part.supplier}</p>
                          )}
                          <div className="mt-1 flex items-center gap-3 text-sm">
                            <span className="text-gray-600">Qty: <strong>{part.quantity}</strong></span>
                          </div>
                          {/* Costing Info */}
                          <div className="mt-2">
                            {part.costing ? (
                              <button
                                onClick={() => setEditingCostingId(editingCostingId === part.id ? null : part.id)}
                                className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                              >
                                Total: UGX {formatCurrency(part.costing.totalLandedCost)}
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditingCostingId(part.id)}
                                className="text-sm bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 flex items-center gap-1"
                              >
                                <DollarSign className="w-3 h-3" />
                                Add Costing
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => setEditingSpecialPartId(editingSpecialPartId === part.id ? null : part.id)} 
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => removeSpecialPart(part.id)} 
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Mobile Costing Editor - Expandable */}
                      {editingCostingId === part.id && (
                        <div className="mt-3 bg-purple-50 rounded-lg p-3 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-purple-800">
                            <DollarSign className="w-4 h-4" />
                            Landed Cost
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Unit Cost</label>
                              <input
                                type="number"
                                value={part.costing?.unitCost || ''}
                                onChange={(e) => {
                                  const unitCost = parseFloat(e.target.value) || 0;
                                  const costing = part.costing || { unitCost: 0, currency: 'USD', exchangeRate: EXCHANGE_RATES['USD'], targetCurrency: TARGET_CURRENCY, totalSourceCost: 0, landedUnitCost: 0, totalLandedCost: 0 };
                                  const totalSourceCost = unitCost * part.quantity;
                                  const totalLandedCost = totalSourceCost * costing.exchangeRate;
                                  updateSpecialPart(part.id, {
                                    costing: { ...costing, unitCost, totalSourceCost, landedUnitCost: unitCost * costing.exchangeRate, totalLandedCost }
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Currency</label>
                              <select
                                value={part.costing?.currency || 'USD'}
                                onChange={(e) => {
                                  const currency = e.target.value;
                                  const exchangeRate = EXCHANGE_RATES[currency] || 1;
                                  const costing = part.costing || { unitCost: 0, currency: 'USD', exchangeRate, targetCurrency: TARGET_CURRENCY, totalSourceCost: 0, landedUnitCost: 0, totalLandedCost: 0 };
                                  const totalSourceCost = (costing.unitCost || 0) * part.quantity;
                                  const totalLandedCost = totalSourceCost * exchangeRate;
                                  updateSpecialPart(part.id, {
                                    costing: { ...costing, currency, exchangeRate, landedUnitCost: (costing.unitCost || 0) * exchangeRate, totalLandedCost }
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                              >
                                <option value="UGX">UGX</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="AED">AED</option>
                                <option value="CNY">CNY</option>
                                <option value="KES">KES</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-purple-200">
                            <p className="text-sm text-gray-600">
                              {part.quantity} × {part.costing?.currency || 'USD'} {(part.costing?.unitCost || 0).toFixed(2)}
                            </p>
                            <div className="text-right">
                              <p className="font-bold text-purple-900">UGX {formatCurrency(part.costing?.totalLandedCost || 0)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setEditingCostingId(null)}
                            className="w-full py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Special Part Form - Identification only, costing in Costing Tab */}
            <div className="grid grid-cols-5 gap-2 bg-white p-3 rounded-lg border border-purple-200">
              <select
                value={newSpecialPart.category}
                onChange={(e) => setNewSpecialPart({ ...newSpecialPart, category: e.target.value })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="handle">Handle</option>
                <option value="lock">Lock</option>
                <option value="hinge">Hinge</option>
                <option value="accessory">Accessory</option>
                <option value="lighting">Lighting</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                value={newSpecialPart.name}
                onChange={(e) => setNewSpecialPart({ ...newSpecialPart, name: e.target.value })}
                placeholder="Part name"
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              />
              <SupplierPicker
                value={newSpecialPart.supplierId ? { supplierId: newSpecialPart.supplierId, supplierName: newSpecialPart.supplier } : null}
                onChange={(val) => setNewSpecialPart({ ...newSpecialPart, supplier: val?.supplierName || '', supplierId: val?.supplierId || '' })}
                label=""
                placeholder="Search suppliers..."
              />
              <input
                type="number"
                value={newSpecialPart.quantity}
                onChange={(e) => setNewSpecialPart({ ...newSpecialPart, quantity: parseFloat(e.target.value) || 0 })}
                min="0.01"
                step="any"
                placeholder="Qty"
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              />
              <button
                onClick={addSpecialPart}
                disabled={!newSpecialPart.name}
                className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <p className="text-xs text-purple-600 mt-1">💡 Expand costing details inline or use the Costing Summary tab</p>

            {specialPartsCostPerUnit > 0 && (
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-purple-300">
                <div>
                  <span className="text-sm text-purple-800">Special Parts Total:</span>
                  {requiredQuantity > 1 && (
                    <span className="text-xs text-purple-600 ml-2">(×{requiredQuantity} units)</span>
                  )}
                </div>
                <div className="text-right">
                  {requiredQuantity > 1 && (
                    <p className="text-xs text-purple-600">Per unit: UGX {formatCurrency(specialPartsCostPerUnit)}</p>
                  )}
                  <span className="font-bold text-purple-900 text-lg">UGX {formatCurrency(specialPartsCost)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={savePartsToFirestore}
              disabled={saving}
              className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${
                saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : saveSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Special Parts'}
            </button>
          </div>
        </div>
      )}

      {/* COSTING SUMMARY SECTION */}
      {activeSection === 'costing' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-start gap-3">
                <Calculator className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900">Costing Summary</h3>
                  <p className="text-sm text-green-700">Auto-calculate costs from all part types</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const hasAnyParts = partsList.length > 0
                    || standardParts.length > 0
                    || specialParts.length > 0;
                  if (!hasAnyParts) {
                    alert('No parts found. Add sheet, bar, standard, or special parts first.');
                    return;
                  }
                  setCalculating(true);
                  try {
                    const { calculateMaterialCostsFromParts, calculateLaborFromParts, calculateItemProcessingCosts } = await import('../../services/estimateService');

                    // Get material palette from project for accurate pricing
                    const materialPalette = (project as any)?.materialPalette?.entries || [];

                    // Calculate material costs only if there are sheet/bar parts
                    let matResult = {
                      sheetMaterials: [] as any[], sheetMaterialsCost: 0,
                      timberMaterials: [] as any[], timberMaterialsCost: 0,
                      linearMaterials: [] as any[], linearMaterialsCost: 0,
                      slabMaterials: [] as any[], slabMaterialsCost: 0,
                      fabricMaterials: [] as any[], fabricMaterialsCost: 0,
                      componentCost: 0,
                      edgingMaterials: [] as any[], edgingMaterialsCost: 0,
                      totalCost: 0,
                    };
                    if (partsList.length > 0) {
                      matResult = await calculateMaterialCostsFromParts(
                        partsList,
                        projectId,
                        materialPalette
                      );
                    }
                    setSheetMaterials(matResult.sheetMaterials);
                    setSheetMaterialsCost(matResult.sheetMaterialsCost);
                    setTimberMaterials(matResult.timberMaterials);
                    setTimberMaterialsCost(matResult.timberMaterialsCost);
                    setLinearMaterials(matResult.linearMaterials);
                    setLinearMaterialsCost(matResult.linearMaterialsCost);
                    setSlabMaterials(matResult.slabMaterials || []);
                    setSlabMaterialsCost(matResult.slabMaterialsCost || 0);
                    setFabricMaterials(matResult.fabricMaterials || []);
                    setFabricMaterialsCost(matResult.fabricMaterialsCost || 0);
                    setComponentCostTotal(matResult.componentCost || 0);
                    setEdgingMaterials(matResult.edgingMaterials || []);
                    setEdgingMaterialsCost(matResult.edgingMaterialsCost || 0);

                    // Calculate processing costs (panel saw, edge banding, planing, etc.)
                    const processing = calculateItemProcessingCosts(partsList, materialPalette);
                    setProcessingSteps(processing.steps);
                    setProcessingCost(processing.totalCost);

                    const labor = calculateLaborFromParts(partsList);
                    setLaborHours(labor.hours);
                  } catch (error) {
                    console.error('Auto-calculation failed:', error);
                  } finally {
                    setCalculating(false);
                  }
                }}
                disabled={calculating || partsList.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {calculating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {calculating ? 'Calculating...' : 'Auto Calculate'}
              </button>
            </div>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {sheetMaterialsCost > 0 && (
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500 uppercase">Sheet Materials</p>
                  <p className="text-lg font-bold text-gray-900">UGX {formatCurrency(sheetMaterialsCost)}</p>
                  <p className="text-xs text-gray-500">{sheetMaterials.length} material types</p>
                </div>
              )}
              {timberMaterialsCost > 0 && (
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-amber-700 uppercase">Timber (m&#179;)</p>
                  <p className="text-lg font-bold text-amber-900">UGX {formatCurrency(timberMaterialsCost)}</p>
                  <p className="text-xs text-gray-500">{timberMaterials.length} timber groups</p>
                </div>
              )}
              {linearMaterialsCost > 0 && (
                <div className="bg-white rounded-lg p-3 border border-sky-200">
                  <p className="text-xs text-sky-700 uppercase">Linear Stock (m)</p>
                  <p className="text-lg font-bold text-sky-900">UGX {formatCurrency(linearMaterialsCost)}</p>
                  <p className="text-xs text-gray-500">{linearMaterials.length} profiles</p>
                </div>
              )}
              {slabMaterialsCost > 0 && (
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-orange-700 uppercase">Stone / Slab</p>
                  <p className="text-lg font-bold text-orange-900">UGX {formatCurrency(slabMaterialsCost)}</p>
                  <p className="text-xs text-gray-500">{slabMaterials.length} slab types</p>
                </div>
              )}
              {fabricMaterialsCost > 0 && (
                <div className="bg-white rounded-lg p-3 border border-violet-200">
                  <p className="text-xs text-violet-700 uppercase">Fabric / Upholstery</p>
                  <p className="text-lg font-bold text-violet-900">UGX {formatCurrency(fabricMaterialsCost)}</p>
                  <p className="text-xs text-gray-500">{fabricMaterials.length} fabric types</p>
                </div>
              )}
              {edgingMaterialsCost > 0 && (
                <div className="bg-white rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-yellow-700 uppercase">Edge Banding</p>
                  <p className="text-lg font-bold text-yellow-900">UGX {formatCurrency(edgingMaterialsCost)}</p>
                  <p className="text-xs text-gray-500">{edgingMaterials.length} edge types</p>
                </div>
              )}
              {componentCostTotal > 0 && (
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-700 uppercase">Components</p>
                  <p className="text-lg font-bold text-slate-900">UGX {formatCurrency(componentCostTotal)}</p>
                  <p className="text-xs text-gray-500">Bought-out items</p>
                </div>
              )}
              <div className="bg-white rounded-lg p-3 border border-orange-200">
                <p className="text-xs text-orange-600 uppercase">Standard Parts</p>
                <p className="text-lg font-bold text-orange-700">UGX {formatCurrency(standardPartsCostPerUnit)}</p>
                <p className="text-xs text-gray-500">{standardParts.length} items</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <p className="text-xs text-purple-600 uppercase">Special Parts</p>
                <p className="text-lg font-bold text-purple-700">UGX {formatCurrency(specialPartsCostPerUnit)}</p>
                <p className="text-xs text-gray-500">{specialParts.length} items</p>
              </div>
              {processingCost > 0 && (
                <div className="bg-white rounded-lg p-3 border border-teal-200">
                  <p className="text-xs text-teal-600 uppercase">Processing</p>
                  <p className="text-lg font-bold text-teal-700">UGX {formatCurrency(processingCost)}</p>
                  <p className="text-xs text-gray-500">{processingSteps.length} operations</p>
                </div>
              )}
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-blue-600 uppercase">Labor</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${laborRateSourceMeta[laborRateSource].className}`}>
                    {laborRateSourceMeta[laborRateSource].label}
                  </span>
                </div>
                <p className="text-lg font-bold text-blue-700">UGX {formatCurrency(laborHours * laborRate)}</p>
                <p className="text-xs text-gray-500">{laborHours} hrs @ {formatCurrency(laborRate)}/hr</p>
              </div>
            </div>

            {/* Labor Rate Adjustment */}
            <div className="bg-white rounded-lg p-3 border border-green-200 mb-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Labor Hours</label>
                  <input
                    type="number"
                    value={laborHours}
                    onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    step="0.5"
                    min="0"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600">Labor Rate (UGX/hr)</label>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${laborRateSourceMeta[laborRateSource].className}`}>
                      {laborRateSourceMeta[laborRateSource].label}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={laborRate}
                    onChange={(e) => {
                      setLaborRate(parseFloat(e.target.value) || 0);
                      setLaborRateSource('item_custom');
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    step="1000"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Sheet Materials Breakdown */}
            {sheetMaterials.length > 0 && (
              <div className="bg-white rounded-lg border border-green-200 overflow-hidden mb-4">
                <div className="px-3 py-2 bg-green-50 border-b border-green-200">
                  <h4 className="text-sm font-medium text-green-800">Sheet Materials Breakdown</h4>
                  <p className="text-xs text-green-600">Pro-rated by area used (incl. 15% waste)</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Material</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Area</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Sheet Rate</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sheetMaterials.map((mat, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{mat.materialName} ({mat.thickness}mm)</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          <span>{mat.totalArea?.toFixed(2)} m²</span>
                          <span className="block text-xs text-gray-400">~{mat.sheetsRequired} sheet{mat.sheetsRequired !== 1 ? 's' : ''}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">UGX {formatCurrency(mat.unitCost)}/sht</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">UGX {formatCurrency(mat.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Timber Materials Breakdown (volumetric m³) */}
            {timberMaterials.length > 0 && (
              <div className="bg-white rounded-lg border border-amber-200 overflow-hidden mb-4">
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                  <h4 className="text-sm font-medium text-amber-800">Timber Materials Breakdown</h4>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Material</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Cross-section</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Volume / Length</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Rate</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {timberMaterials.map((mat: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{mat.materialName}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{mat.crossSection?.thickness}x{mat.crossSection?.width}mm</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          <span>{mat.totalVolumeCubicMeters} m³</span>
                          <span className="block text-xs text-gray-400">{mat.totalLinearMeters} m · {mat.partsCount} pcs</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">UGX {formatCurrency(mat.unitCost)} {mat.costUnit}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">UGX {formatCurrency(mat.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Linear Stock Breakdown (linear meters) */}
            {linearMaterials.length > 0 && (
              <div className="bg-white rounded-lg border border-sky-200 overflow-hidden mb-4">
                <div className="px-3 py-2 bg-sky-50 border-b border-sky-200">
                  <h4 className="text-sm font-medium text-sky-800">Linear Stock Breakdown</h4>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Material</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Profile</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Linear Meters</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Rate/m</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {linearMaterials.map((mat: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{mat.materialName}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{mat.profile}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{mat.totalLinearMeters} m</td>
                        <td className="px-3 py-2 text-right text-gray-700">UGX {formatCurrency(mat.unitCost)}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">UGX {formatCurrency(mat.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Processing Steps Breakdown */}
            {processingSteps.length > 0 && (
              <div className="bg-white rounded-lg border border-teal-200 overflow-hidden mb-4">
                <div className="px-3 py-2 bg-teal-50 border-b border-teal-200">
                  <h4 className="text-sm font-medium text-teal-800">Material Processing Costs</h4>
                  <p className="text-xs text-teal-600">Panel saw, edge banding, planing, routing, etc.</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Operation</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Rate</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processingSteps.map((step: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{step.label}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{step.quantity} {step.unit}</td>
                        <td className="px-3 py-2 text-right text-gray-700">UGX {formatCurrency(step.ratePerUnit)}/{step.unit === 'cuts' ? 'cut' : 'm'}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">UGX {formatCurrency(step.totalCost)}</td>
                      </tr>
                    ))}
                    <tr className="bg-teal-50 font-semibold">
                      <td className="px-3 py-2 text-teal-800" colSpan={3}>Processing Total</td>
                      <td className="px-3 py-2 text-right text-teal-900">UGX {formatCurrency(processingCost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Total Cost Summary */}
            <div className="bg-green-100 rounded-lg p-4 border border-green-300">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-green-800 font-medium">Total Manufacturing Cost (Per Unit)</p>
                  <p className="text-xs text-green-600">
                    {[
                      sheetMaterialsCost > 0 && 'Sheets',
                      timberMaterialsCost > 0 && 'Timber',
                      linearMaterialsCost > 0 && 'Linear stock',
                      slabMaterialsCost > 0 && 'Stone/Slab',
                      fabricMaterialsCost > 0 && 'Fabric',
                      edgingMaterialsCost > 0 && 'Edging',
                      componentCostTotal > 0 && 'Components',
                      'Standard parts',
                      'Special parts',
                      processingCost > 0 && 'Processing',
                      'Labor',
                    ].filter(Boolean).join(' + ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-900">
                    UGX {formatCurrency(sheetMaterialsCost + timberMaterialsCost + linearMaterialsCost + slabMaterialsCost + fabricMaterialsCost + edgingMaterialsCost + componentCostTotal + standardPartsCostPerUnit + specialPartsCostPerUnit + processingCost + (laborHours * laborRate))}
                  </p>
                  {requiredQuantity > 1 && (
                    <p className="text-sm text-green-700">
                      × {requiredQuantity} units = UGX {formatCurrency((sheetMaterialsCost + timberMaterialsCost + linearMaterialsCost + slabMaterialsCost + fabricMaterialsCost + edgingMaterialsCost + componentCostTotal + standardPartsCostPerUnit + specialPartsCostPerUnit + processingCost + (laborHours * laborRate)) * requiredQuantity)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Save Costing Button */}
            <div className="flex justify-end mt-4">
              <button
                onClick={async () => {
                  setSaving(true);
                  setSaveSuccess(false);
                  try {
                    const totalMaterialCost = sheetMaterialsCost + timberMaterialsCost + linearMaterialsCost + slabMaterialsCost + fabricMaterialsCost + edgingMaterialsCost + componentCostTotal + standardPartsCostPerUnit + specialPartsCostPerUnit;
                    const laborCost = laborHours * laborRate;
                    const totalCost = totalMaterialCost + processingCost + laborCost;
                    const quantity = 1;
                    const costPerUnit = totalCost;

                    const manufacturingData: Record<string, any> = {
                      ...manufacturing,
                      sheetMaterials: sheetMaterials,
                      sheetMaterialsCost: sheetMaterialsCost,
                      timberMaterials: timberMaterials,
                      timberMaterialsCost: timberMaterialsCost,
                      linearMaterials: linearMaterials,
                      linearMaterialsCost: linearMaterialsCost,
                      slabMaterials: slabMaterials,
                      slabMaterialsCost: slabMaterialsCost,
                      fabricMaterials: fabricMaterials,
                      fabricMaterialsCost: fabricMaterialsCost,
                      edgingMaterials: edgingMaterials,
                      edgingMaterialsCost: edgingMaterialsCost,
                      componentCost: componentCostTotal,
                      processingSteps: processingSteps,
                      processingCost: processingCost,
                      standardParts: standardParts,
                      standardPartsCost: standardPartsCostPerUnit,
                      specialParts: specialParts,
                      specialPartsCost: specialPartsCostPerUnit,
                      materialCost: totalMaterialCost,
                      laborHours: laborHours,
                      laborRate: laborRate,
                      laborCost: laborCost,
                      totalCost: totalCost,
                      costPerUnit: costPerUnit,
                      quantity: quantity,
                      autoCalculated: sheetMaterials.length > 0 || timberMaterials.length > 0 || linearMaterials.length > 0 || slabMaterials.length > 0 || fabricMaterials.length > 0 || edgingMaterials.length > 0 || componentCostTotal > 0,
                      estimatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                      estimatedBy: user?.email || 'system',
                      lastAutoCalcAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                    };
                    
                    await updateDesignItem(projectId, item.id, {
                      manufacturing: cleanUndefinedValues(manufacturingData),
                    } as any, user?.email || 'system');
                    
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 3000);
                  } catch (error) {
                    console.error('Failed to save costing:', error);
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${
                  saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Costing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Part Form */}
      {(showAddForm || editingPart) && (
        <PartForm
          part={editingPart || undefined}
          materialPalette={(project as any)?.materialPalette?.entries}
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

      {/* Project Parts Picker */}
      {showPartsPicker && (
        <ProjectPartsPicker
          projectId={projectId}
          onSelect={addPartFromLibrary}
          onClose={() => setShowPartsPicker(false)}
          excludePartIds={specialParts.filter(p => p.projectPartId).map(p => p.projectPartId!)}
        />
      )}

      {/* Part Detail Drawer */}
      <PartDetailDrawer
        part={drawerPart}
        isOpen={!!drawerPart}
        onClose={() => setDrawerPart(null)}
        onSave={async (partId, data) => {
          await parts.update(partId, data);
          setDrawerPart(null);
        }}
        saving={parts.loading}
      />

      <FabricPartDetailDrawer
        part={fabricDrawerPart}
        isOpen={!!fabricDrawerPart}
        onClose={() => setFabricDrawerPart(null)}
        onSave={async (partId, data) => {
          await parts.update(partId, data);
          setFabricDrawerPart(null);
        }}
        saving={parts.loading}
      />
    </div>
  );
}

export default PartsTab;
