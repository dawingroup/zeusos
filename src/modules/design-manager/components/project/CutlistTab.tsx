/**
 * CutlistTab Component
 * Display consolidated cutlist at project level
 * Includes sheet parts, standard parts, and special parts aggregation
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Download, AlertTriangle, ChevronDown, ChevronRight, Package, Wrench, Sparkles, Ruler, TreePine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCutlistAggregation } from '../../hooks/useCutlistAggregation';
import { exportCutlistCSV, exportCutlistSummaryCSV, downloadCSV } from '../../services/cutlistAggregation';
import { subscribeToDesignItems } from '../../services/firestore';
import type { DesignProject, DesignItem, ConsolidatedCutlist, MaterialGroup, StandardPartEntry, SpecialPartEntry } from '../../types';
import { formatDateTime } from '../../utils/formatting';

// Aggregated parts types
interface AggregatedStandardPart {
  name: string;
  category: string;
  totalQuantity: number;
  avgUnitCost: number;
  totalCost: number;
  fromItems: string[];
}

interface AggregatedSpecialPart {
  name: string;
  category: string;
  supplier?: string;
  totalQuantity: number;
  avgUnitCost: number;
  totalCost: number;
  fromItems: string[];
}

interface CutlistTabProps {
  project: DesignProject;
}

function BarGroupCard({ group, defaultExpanded = false }: { group: MaterialGroup; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const profile = group.parts[0]?.barProfile ?? '—';

  return (
    <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-amber-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-amber-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-amber-400" />
          )}
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{group.materialName}</h3>
            <p className="text-sm text-gray-500">
              Profile: {profile} • {group.totalParts} cuts
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-amber-700">{(group.totalLength ?? 0).toFixed(2)} m</p>
          <p className="text-sm text-gray-500">~{group.estimatedBars ?? 0} bars @ 6 m stock</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-amber-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-amber-800">Part #</th>
                  <th className="px-4 py-2 text-left font-medium text-amber-800">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-amber-800">Design Item</th>
                  <th className="px-4 py-2 text-left font-medium text-amber-800">Profile</th>
                  <th className="px-4 py-2 text-right font-medium text-amber-800">Length (mm)</th>
                  <th className="px-4 py-2 text-center font-medium text-amber-800">Qty</th>
                  <th className="px-4 py-2 text-right font-medium text-amber-800">Total (mm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {group.parts.map((part, pidx) => (
                  <tr key={`${part.partId}-${pidx}`} className="hover:bg-amber-50/50">
                    <td className="px-4 py-2 font-mono text-gray-600">{part.partNumber}</td>
                    <td className="px-4 py-2 text-gray-900">{part.partName}</td>
                    <td className="px-4 py-2 text-gray-600">{part.designItemName}</td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                        {part.barProfile ?? profile}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">{part.length}</td>
                    <td className="px-4 py-2 text-center text-gray-700">{part.quantity}</td>
                    <td className="px-4 py-2 text-right font-medium text-amber-700">
                      {(part.length * part.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-amber-50 border-t border-amber-200">
                <tr>
                  <td colSpan={6} className="px-4 py-2 text-right text-sm font-medium text-amber-800">
                    Total linear: {(group.totalLength ?? 0).toFixed(2)} m
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-amber-900">
                    {Math.round((group.totalLength ?? 0) * 1000).toLocaleString()} mm
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialGroupCard({ group, defaultExpanded = false }: { group: MaterialGroup; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{group.materialName}</h3>
            <p className="text-sm text-gray-500">{group.thickness}mm • {group.totalParts} parts</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-gray-900">{group.totalArea.toFixed(2)} m²</p>
          <p className="text-sm text-gray-500">~{group.estimatedSheets} sheets</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Part #</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Design Item</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">L (mm)</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">W (mm)</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700">Qty</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700">Grain</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700">Edge Code</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Edging L</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Edging W</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.parts.map((part, idx) => {
                  const lCount = (part.edgeBanding?.top ? 1 : 0) + (part.edgeBanding?.bottom ? 1 : 0);
                  const wCount = (part.edgeBanding?.left ? 1 : 0) + (part.edgeBanding?.right ? 1 : 0);
                  const codeParts: string[] = [];
                  if (lCount > 0) codeParts.push(`${lCount}L`);
                  if (wCount > 0) codeParts.push(`${wCount}W`);
                  const edgeCode = codeParts.length > 0 ? codeParts.join('') : '-';
                  const edgingL = (part.edgeBanding?.top ? part.length : 0) + (part.edgeBanding?.bottom ? part.length : 0);
                  const edgingW = (part.edgeBanding?.left ? part.width : 0) + (part.edgeBanding?.right ? part.width : 0);

                  return (
                  <tr key={`${part.partId}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-600">{part.partNumber}</td>
                    <td className="px-4 py-2 text-gray-900">{part.partName}</td>
                    <td className="px-4 py-2 text-gray-600">{part.designItemName}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{part.length}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{part.width}</td>
                    <td className="px-4 py-2 text-center text-gray-700">{part.quantity}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        part.grainDirection === 'length' ? 'bg-blue-100 text-blue-700' :
                        part.grainDirection === 'width' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {part.grainDirection === 'length' ? 'L' : part.grainDirection === 'width' ? 'W' : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        edgeCode === '-' ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-700'
                      }`}>
                        {edgeCode}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-gray-600">
                      {edgingL > 0 ? `${edgingL}` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-gray-600">
                      {edgingW > 0 ? `${edgingW}` : '-'}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function CutlistTab({ project }: CutlistTabProps) {
  const { user } = useAuth();
  // Pass material palette so aggregation can resolve materialType per part
  const paletteEntries = (project as any).materialPalette?.entries;
  const { regenerate, loading, error } = useCutlistAggregation(project.id, paletteEntries);

  // Local state to hold cutlist (updated after regeneration)
  const [localCutlist, setLocalCutlist] = useState<ConsolidatedCutlist | null>(null);
  const [designItems, setDesignItems] = useState<DesignItem[]>([]);
  const [activeTab, setActiveTab] = useState<'sheet' | 'bar' | 'slab' | 'fabric' | 'component' | 'timber' | 'standard' | 'special'>('sheet');
  
  // Subscribe to design items for parts aggregation
  useEffect(() => {
    const unsubscribe = subscribeToDesignItems(project.id, (items) => {
      setDesignItems(items);
    });
    return () => unsubscribe();
  }, [project.id]);
  
  // Aggregate standard parts from all design items
  const aggregatedStandardParts: AggregatedStandardPart[] = (() => {
    const partsMap = new Map<string, AggregatedStandardPart>();
    
    designItems.forEach(item => {
      const manufacturing = (item as any).manufacturing;
      const standardParts: StandardPartEntry[] = manufacturing?.standardParts || [];
      const requiredQuantity = Math.max(1, Number((item as any).requiredQuantity) || 1);
      
      standardParts.forEach(part => {
        const key = `${part.name}-${part.category}`;
        const existing = partsMap.get(key);
        const lineQuantity = (part.quantity || 1) * requiredQuantity;
        const lineCost = lineQuantity * (part.unitCost || 0);
        
        if (existing) {
          existing.totalQuantity += lineQuantity;
          existing.totalCost += lineCost;
          if (!existing.fromItems.includes(item.name)) {
            existing.fromItems.push(item.name);
          }
          existing.avgUnitCost = existing.totalCost / existing.totalQuantity;
        } else {
          partsMap.set(key, {
            name: part.name,
            category: part.category,
            totalQuantity: lineQuantity,
            avgUnitCost: part.unitCost || 0,
            totalCost: lineCost,
            fromItems: [item.name],
          });
        }
      });
    });
    
    return Array.from(partsMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  })();
  
  // Aggregate special parts from all design items
  const aggregatedSpecialParts: AggregatedSpecialPart[] = (() => {
    const partsMap = new Map<string, AggregatedSpecialPart>();

    designItems.forEach(item => {
      const manufacturing = (item as any).manufacturing;
      const specialParts: SpecialPartEntry[] = manufacturing?.specialParts || [];
      const requiredQuantity = Math.max(1, Number((item as any).requiredQuantity) || 1);

      specialParts.forEach(part => {
        const key = `${part.name}-${part.category}-${part.supplier || ''}`;
        const existing = partsMap.get(key);
        // Use costing.landedUnitCost (primary) → unitCost (denormalized fallback) → 0
        const effectiveUnitCost = part.costing?.landedUnitCost || part.unitCost || 0;
        // Use costing.totalLandedCost if available, otherwise calculate from unit cost
        const effectiveTotalCostPerItem = part.costing?.totalLandedCost || ((part.quantity || 1) * effectiveUnitCost);
        const lineQuantity = (part.quantity || 1) * requiredQuantity;
        const lineTotalCost = effectiveTotalCostPerItem * requiredQuantity;

        if (existing) {
          existing.totalQuantity += lineQuantity;
          existing.totalCost += lineTotalCost;
          if (!existing.fromItems.includes(item.name)) {
            existing.fromItems.push(item.name);
          }
          existing.avgUnitCost = existing.totalCost / existing.totalQuantity;
        } else {
          partsMap.set(key, {
            name: part.name,
            category: part.category,
            supplier: part.supplier,
            totalQuantity: lineQuantity,
            avgUnitCost: effectiveUnitCost,
            totalCost: lineTotalCost,
            fromItems: [item.name],
          });
        }
      });
    });

    return Array.from(partsMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  })();
  
  // Calculate totals
  const standardPartsTotal = aggregatedStandardParts.reduce((sum, p) => sum + p.totalCost, 0);
  const specialPartsTotal = aggregatedSpecialParts.reduce((sum, p) => sum + p.totalCost, 0);
  
  // Use local cutlist if available, otherwise use project's cutlist
  const projectCutlist = (project as any).consolidatedCutlist as ConsolidatedCutlist | undefined;
  const cutlist = localCutlist || projectCutlist;

  // Resolve materialType for each group: stored materialType → palette lookup → partType default
  // This ensures correct classification even with cutlists generated before materialType was added
  const resolveGroupMaterialType = (g: MaterialGroup): string | undefined => {
    if (g.materialType) return g.materialType;
    // Fall back to palette lookup by group material name + thickness
    if (paletteEntries) {
      const normalizedName = g.materialName.toLowerCase().trim();
      const match = paletteEntries.find((e: any) => {
        const entryName = (e.designName || e.normalizedName || '').toLowerCase().trim();
        return entryName === normalizedName && Math.abs((e.thickness || 0) - g.thickness) < 0.1;
      });
      if (match?.materialType) return match.materialType;
    }
    return undefined;
  };

  // Split material groups by resolved material type and explicit part type.
  // Timber is isolated from bars to prevent linear-meter bar heuristics from
  // bleeding into timber planning/costing.
  const allSheetLike = cutlist?.materialGroups?.filter(g => !g.partType || g.partType === 'sheet') ?? [];
  const paletteTimberGroups = allSheetLike.filter(g => resolveGroupMaterialType(g) === 'TIMBER');
  const structuralTimberGroups = cutlist?.materialGroups?.filter(g => g.partType === 'timber') ?? [];
  const timberGroups = [...paletteTimberGroups, ...structuralTimberGroups];
  const sheetGroups = allSheetLike.filter(g => resolveGroupMaterialType(g) !== 'TIMBER');
  const linearBarGroups = cutlist?.materialGroups?.filter(g => g.partType === 'bar') ?? [];
  const slabGroups = cutlist?.materialGroups?.filter(g => g.partType === 'slab') ?? [];
  const fabricGroups = cutlist?.materialGroups?.filter(g => g.partType === 'fabric') ?? [];
  const componentGroups = cutlist?.materialGroups?.filter(g => g.partType === 'component') ?? [];
  const totalTimberParts = timberGroups.reduce((sum, g) => sum + g.totalParts, 0);
  const totalBarParts = linearBarGroups.reduce((sum, g) => sum + g.totalParts, 0);
  const totalSlabParts = slabGroups.reduce((sum, g) => sum + g.totalParts, 0);
  const totalFabricParts = fabricGroups.reduce((sum, g) => sum + g.totalParts, 0);
  const totalComponentParts = componentGroups.reduce((sum, g) => sum + (g.totalQuantity ?? g.totalParts), 0);

  const handleRegenerate = async () => {
    if (!user?.email) return;
    try {
      const result = await regenerate(user.email);
      setLocalCutlist(result);
    } catch (err) {
      // Error handled by hook
      console.error('Failed to regenerate cutlist:', err);
    }
  };

  const handleExportDetails = () => {
    if (!cutlist) return;
    const csv = exportCutlistCSV(cutlist);
    downloadCSV(csv, `${project.code}-cutlist-details.csv`);
  };

  const handleExportSummary = () => {
    if (!cutlist) return;
    const csv = exportCutlistSummaryCSV(cutlist);
    downloadCSV(csv, `${project.code}-cutlist-summary.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Stale Warning */}
      {cutlist?.isStale && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium text-amber-800">Cutlist is outdated</p>
              <p className="text-sm text-amber-700">{cutlist.staleReason || 'Parts have been modified since last generation'}</p>
            </div>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase">Sheet Parts</p>
          <p className="text-xl font-bold text-gray-900">{sheetGroups.reduce((s, g) => s + g.totalParts, 0)}</p>
        </div>
        {totalTimberParts > 0 && (
          <div className="bg-emerald-50 rounded-lg p-3 border-l-4 border-emerald-400">
            <p className="text-xs text-emerald-600 uppercase">Timber Parts</p>
            <p className="text-xl font-bold text-emerald-700">{totalTimberParts}</p>
          </div>
        )}
        <div className="bg-amber-50 rounded-lg p-3">
          <p className="text-xs text-amber-600 uppercase">Bar Parts</p>
          <p className="text-xl font-bold text-amber-700">{totalBarParts}</p>
        </div>
        {totalSlabParts > 0 && (
          <div className="bg-orange-50 rounded-lg p-3 border-l-4 border-orange-400">
            <p className="text-xs text-orange-600 uppercase">Slab Parts</p>
            <p className="text-xl font-bold text-orange-700">{totalSlabParts}</p>
          </div>
        )}
        {totalFabricParts > 0 && (
          <div className="bg-violet-50 rounded-lg p-3 border-l-4 border-violet-400">
            <p className="text-xs text-violet-600 uppercase">Fabric Parts</p>
            <p className="text-xl font-bold text-violet-700">{totalFabricParts}</p>
          </div>
        )}
        {totalComponentParts > 0 && (
          <div className="bg-slate-50 rounded-lg p-3 border-l-4 border-slate-400">
            <p className="text-xs text-slate-600 uppercase">Components</p>
            <p className="text-xl font-bold text-slate-700">{totalComponentParts}</p>
          </div>
        )}
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="text-xs text-orange-600 uppercase">Standard Parts</p>
          <p className="text-xl font-bold text-orange-700">{aggregatedStandardParts.reduce((sum, p) => sum + p.totalQuantity, 0)}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <p className="text-xs text-purple-600 uppercase">Special Parts</p>
          <p className="text-xl font-bold text-purple-700">{aggregatedSpecialParts.reduce((sum, p) => sum + p.totalQuantity, 0)}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('sheet')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'sheet'
              ? 'text-primary border-primary'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Sheet Parts ({sheetGroups.reduce((s, g) => s + g.totalParts, 0)})
        </button>
        {timberGroups.length > 0 && (
          <button
            onClick={() => setActiveTab('timber')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'timber'
                ? 'text-emerald-600 border-emerald-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <TreePine className="w-4 h-4 inline mr-2" />
            Timber ({totalTimberParts})
          </button>
        )}
        <button
          onClick={() => setActiveTab('bar')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'bar'
              ? 'text-amber-600 border-amber-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Ruler className="w-4 h-4 inline mr-2" />
          Bar / Section ({totalBarParts})
        </button>
        {slabGroups.length > 0 && (
          <button
            onClick={() => setActiveTab('slab')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'slab'
                ? 'text-orange-600 border-orange-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Slabs ({totalSlabParts})
          </button>
        )}
        {fabricGroups.length > 0 && (
          <button
            onClick={() => setActiveTab('fabric')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'fabric'
                ? 'text-violet-600 border-violet-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Fabric ({totalFabricParts})
          </button>
        )}
        {componentGroups.length > 0 && (
          <button
            onClick={() => setActiveTab('component')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'component'
                ? 'text-slate-600 border-slate-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Components ({totalComponentParts})
          </button>
        )}
        <button
          onClick={() => setActiveTab('standard')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'standard'
              ? 'text-orange-600 border-orange-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Wrench className="w-4 h-4 inline mr-2" />
          Standard Parts ({aggregatedStandardParts.length})
        </button>
        <button
          onClick={() => setActiveTab('special')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'special'
              ? 'text-purple-600 border-purple-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Special Parts ({aggregatedSpecialParts.length})
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating...' : 'Regenerate Cutlist'}
          </button>
          {cutlist && (
            <>
              <button
                onClick={handleExportDetails}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export Details
              </button>
              <button
                onClick={handleExportSummary}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export Summary
              </button>
            </>
          )}
        </div>
        {cutlist && (
          <span className="text-sm text-gray-500">
            Generated: {formatDateTime(cutlist.generatedAt)}
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error.message}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'sheet' && (
        <>
          {!cutlist ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No cutlist generated</h3>
              <p className="text-gray-500 mt-1">Click "Regenerate Cutlist" to aggregate parts from all design items</p>
            </div>
          ) : sheetGroups.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No sheet parts found</h3>
              <p className="text-gray-500 mt-1">Add panel parts to design items to generate the cutlist</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sheetGroups.map((group, idx) => (
                <MaterialGroupCard key={group.materialCode} group={group} defaultExpanded={idx === 0} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'bar' && (
        <>
          {!cutlist ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Ruler className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No cutlist generated</h3>
              <p className="text-gray-500 mt-1">Click "Regenerate Cutlist" to aggregate parts from all design items</p>
            </div>
          ) : linearBarGroups.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Ruler className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No bar / section parts found</h3>
              <p className="text-gray-500 mt-1">
                Import a Polyboard bar cutting list (Cabinet;Label;Material;Profile;Qty;Length) to add linear materials
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {linearBarGroups.map((group, idx) => (
                <BarGroupCard key={group.materialCode} group={group} defaultExpanded={idx === 0} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'timber' && (
        <div className="space-y-3">
          {timberGroups.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <TreePine className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No timber parts found</h3>
              <p className="text-gray-500 mt-1">Timber parts come from explicit timber part types and palette-classified timber materials</p>
            </div>
          ) : (
            timberGroups.map((group) => {
              const planingMm = 3; // default planing allowance per side
              const kerfMm = 4;    // default kerf per cut
              const totalVolume = group.parts.reduce(
                (sum, p) => sum + ((p.thickness ?? group.thickness) / 1000) * (p.width / 1000) * (p.length / 1000) * p.quantity,
                0
              );
              const rawVolume = group.parts.reduce(
                (sum, p) => {
                  const t = ((p.thickness ?? group.thickness) + 2 * planingMm) / 1000;
                  const w = (p.width + 2 * planingMm) / 1000;
                  const l = (p.length + kerfMm) / 1000;
                  return sum + t * w * l * p.quantity;
                },
                0
              );
              const yf = group.yieldFactor || 0.85;
              const requiredVolume = rawVolume / yf;
              const totalLm = group.parts.reduce(
                (sum, p) => sum + (p.length / 1000) * p.quantity,
                0
              );
              return (
                <div key={group.materialCode} className="bg-white rounded-lg border border-emerald-200 border-l-4 border-l-emerald-500 overflow-hidden">
                  <div className="p-4 bg-emerald-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-emerald-900">{group.materialName}</h4>
                        <p className="text-sm text-emerald-700">
                          {group.thickness}mm thick · {group.totalParts} parts · {totalLm.toFixed(1)} lm
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">
                          Net: {totalVolume.toFixed(4)} m³ → Raw: {rawVolume.toFixed(4)} m³ (planing +{planingMm}mm/side) → Required: {requiredVolume.toFixed(4)} m³ ({Math.round(yf * 100)}% yield)
                        </p>
                      </div>
                      <div className="text-right flex gap-6">
                        <div>
                          <p className="text-xs text-emerald-600">Net Vol</p>
                          <p className="text-lg font-bold text-emerald-800">{totalVolume.toFixed(4)} m³</p>
                        </div>
                        <div>
                          <p className="text-xs text-emerald-600">Required</p>
                          <p className="text-lg font-bold text-amber-700">{requiredVolume.toFixed(4)} m³</p>
                        </div>
                        <div>
                          <p className="text-xs text-emerald-600">Linear</p>
                          <p className="text-lg font-bold text-emerald-800">{totalLm.toFixed(1)} m</p>
                        </div>
                        {group.yieldFactor != null && (
                          <div>
                            <p className="text-xs text-emerald-600">Yield</p>
                            <p className="text-lg font-bold text-emerald-800">{Math.round(group.yieldFactor * 100)}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-emerald-50/50 border-t border-emerald-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-emerald-800">Part#</th>
                        <th className="px-4 py-2 text-left font-medium text-emerald-800">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-emerald-800">Design Item</th>
                        <th className="px-4 py-2 text-right font-medium text-emerald-800">L (mm)</th>
                        <th className="px-4 py-2 text-right font-medium text-emerald-800">W (mm)</th>
                        <th className="px-4 py-2 text-right font-medium text-emerald-800">T (mm)</th>
                        <th className="px-4 py-2 text-center font-medium text-emerald-800">Qty</th>
                        <th className="px-4 py-2 text-right font-medium text-emerald-800">Vol (m³)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {group.parts.map((part) => {
                        const t = part.thickness ?? group.thickness;
                        const vol = (t / 1000) * (part.width / 1000) * (part.length / 1000) * part.quantity;
                        return (
                          <tr key={part.partId} className="hover:bg-emerald-50/30">
                            <td className="px-4 py-2 font-mono text-xs">{part.partNumber}</td>
                            <td className="px-4 py-2">{part.partName}</td>
                            <td className="px-4 py-2 text-gray-500">{part.designItemName}</td>
                            <td className="px-4 py-2 text-right">{part.length}</td>
                            <td className="px-4 py-2 text-right">{part.width}</td>
                            <td className="px-4 py-2 text-right">{t}</td>
                            <td className="px-4 py-2 text-center">{part.quantity}</td>
                            <td className="px-4 py-2 text-right">{vol.toFixed(4)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'slab' && (
        <div className="space-y-3">
          {slabGroups.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No slab parts found</h3>
              <p className="text-gray-500 mt-1">Add stone/granite slab parts to design items</p>
            </div>
          ) : (
            slabGroups.map((group) => (
              <div key={group.materialCode} className="bg-white rounded-lg border border-orange-200 border-l-4 border-l-orange-400 overflow-hidden">
                <div className="p-4 bg-orange-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-orange-900">{group.materialName}</h4>
                      <p className="text-sm text-orange-700">
                        {group.slabSize ? `${group.slabSize.length} × ${group.slabSize.width} mm slab` : 'Standard slab'}
                        {' · '}{group.totalParts} parts · {group.totalArea.toFixed(2)} m²
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-orange-600">Est. Slabs</p>
                      <p className="text-2xl font-bold text-orange-800">{group.estimatedSlabs ?? 0}</p>
                    </div>
                  </div>
                </div>
                {(group.parts?.length ?? 0) === 0 ? (
                  <p className="px-4 py-3 text-xs text-amber-700 bg-amber-50">
                    Group has no part detail stored — regenerate the cutlist to rebuild it from the source DesignItem parts.
                  </p>
                ) : (
                <table className="w-full text-sm">
                  <thead className="bg-orange-50/50 border-t border-orange-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-orange-800">Part#</th>
                      <th className="px-4 py-2 text-left font-medium text-orange-800">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-orange-800">Design Item</th>
                      <th className="px-4 py-2 text-right font-medium text-orange-800">Length (mm)</th>
                      <th className="px-4 py-2 text-right font-medium text-orange-800">Width (mm)</th>
                      <th className="px-4 py-2 text-center font-medium text-orange-800">Qty</th>
                      <th className="px-4 py-2 text-right font-medium text-orange-800">Area (m²)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50">
                    {group.parts.map((part) => (
                      <tr key={part.partId} className="hover:bg-orange-50/30">
                        <td className="px-4 py-2 font-mono text-xs">{part.partNumber}</td>
                        <td className="px-4 py-2">{part.partName}</td>
                        <td className="px-4 py-2 text-gray-500">{part.designItemName}</td>
                        <td className="px-4 py-2 text-right">{part.length}</td>
                        <td className="px-4 py-2 text-right">{part.width}</td>
                        <td className="px-4 py-2 text-center">{part.quantity}</td>
                        <td className="px-4 py-2 text-right">{((part.length * part.width * part.quantity) / 1_000_000).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'fabric' && (
        <div className="space-y-3">
          {fabricGroups.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No fabric parts found</h3>
              <p className="text-gray-500 mt-1">Add upholstery/fabric parts to design items</p>
            </div>
          ) : (
            fabricGroups.map((group) => (
              <div key={group.materialCode} className="bg-white rounded-lg border border-violet-200 border-l-4 border-l-violet-400 overflow-hidden">
                <div className="p-4 bg-violet-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-violet-900">{group.materialName}</h4>
                      <p className="text-sm text-violet-700">
                        Roll width: {group.rollWidth ?? 1400} mm
                        {' · '}{group.totalParts} parts · {group.totalArea.toFixed(2)} m²
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-violet-600">Est. Roll Length</p>
                      <p className="text-2xl font-bold text-violet-800">{(group.estimatedRollLength ?? 0).toFixed(1)} m</p>
                    </div>
                  </div>
                </div>
                {(group.parts?.length ?? 0) === 0 ? (
                  <p className="px-4 py-3 text-xs text-amber-700 bg-amber-50">
                    Group has no part detail stored — regenerate the cutlist to rebuild it from the source DesignItem parts.
                  </p>
                ) : (
                <table className="w-full text-sm">
                  <thead className="bg-violet-50/50 border-t border-violet-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-violet-800">Part#</th>
                      <th className="px-4 py-2 text-left font-medium text-violet-800">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-violet-800">Design Item</th>
                      <th className="px-4 py-2 text-right font-medium text-violet-800">Length (mm)</th>
                      <th className="px-4 py-2 text-right font-medium text-violet-800">Width (mm)</th>
                      <th className="px-4 py-2 text-center font-medium text-violet-800">Qty</th>
                      <th className="px-4 py-2 text-right font-medium text-violet-800">Area (m²)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-50">
                    {group.parts.map((part) => (
                      <tr key={part.partId} className="hover:bg-violet-50/30">
                        <td className="px-4 py-2 font-mono text-xs">{part.partNumber}</td>
                        <td className="px-4 py-2">{part.partName}</td>
                        <td className="px-4 py-2 text-gray-500">{part.designItemName}</td>
                        <td className="px-4 py-2 text-right">{part.length}</td>
                        <td className="px-4 py-2 text-right">{part.width}</td>
                        <td className="px-4 py-2 text-center">{part.quantity}</td>
                        <td className="px-4 py-2 text-right">{((part.length * part.width * part.quantity) / 1_000_000).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'component' && (
        <div className="space-y-3">
          {componentGroups.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No component parts found</h3>
              <p className="text-gray-500 mt-1">Add bought-out component parts to design items</p>
            </div>
          ) : (
            componentGroups.map((group) => (
              <div key={group.materialCode} className="bg-white rounded-lg border border-slate-200 border-l-4 border-l-slate-400 overflow-hidden">
                <div className="p-4 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900">{group.materialName}</h4>
                      <p className="text-sm text-slate-700">
                        {group.parts.length} line{group.parts.length === 1 ? '' : 's'} · Total qty {group.totalQuantity ?? group.totalParts}
                      </p>
                    </div>
                  </div>
                </div>
                {(group.parts?.length ?? 0) === 0 ? (
                  <p className="px-4 py-3 text-xs text-amber-700 bg-amber-50">
                    Group has no part detail stored — regenerate the cutlist to rebuild it from the source DesignItem parts.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 border-t border-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-slate-800">Part #</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-800">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-800">Design Item</th>
                        <th className="px-4 py-2 text-center font-medium text-slate-800">Qty</th>
                        <th className="px-4 py-2 text-right font-medium text-slate-800">Dimensions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {group.parts.map((part, idx) => (
                        <tr key={`${part.partId}-${idx}`} className="hover:bg-slate-50/30">
                          <td className="px-4 py-2 font-mono text-xs text-gray-600">{part.partNumber}</td>
                          <td className="px-4 py-2 text-gray-900">{part.partName}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{part.designItemName}</td>
                          <td className="px-4 py-2 text-center font-medium">{part.quantity}</td>
                          <td className="px-4 py-2 text-right text-xs text-gray-600">
                            {(part.length ?? 0) > 0 || (part.width ?? 0) > 0 || (part.thickness ?? 0) > 0
                              ? `${part.length ?? 0}×${part.width ?? 0}×${part.thickness ?? 0}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'standard' && (
        <>
          {aggregatedStandardParts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No standard parts</h3>
              <p className="text-gray-500 mt-1">Add standard parts (hinges, slides, screws) in the Parts tab of each design item</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm table-sticky-first-col">
                <thead className="bg-orange-50 border-b border-orange-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-orange-800">Part Name</th>
                    <th className="px-4 py-3 text-left font-medium text-orange-800">Category</th>
                    <th className="px-4 py-3 text-center font-medium text-orange-800">Total Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-orange-800">Avg Unit Cost</th>
                    <th className="px-4 py-3 text-right font-medium text-orange-800">Total Cost</th>
                    <th className="px-4 py-3 text-left font-medium text-orange-800">Used In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {aggregatedStandardParts.map((part, idx) => (
                    <tr key={idx} className="hover:bg-orange-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{part.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs capitalize">
                          {part.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{part.totalQuantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">UGX {Math.round(part.avgUnitCost).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-orange-700">UGX {Math.round(part.totalCost).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{part.fromItems.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-orange-50 border-t border-orange-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right font-medium text-orange-800">Total Standard Parts Cost</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-900">UGX {standardPartsTotal.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'special' && (
        <>
          {aggregatedSpecialParts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No special parts</h3>
              <p className="text-gray-500 mt-1">Add special parts (custom handles, locks) in the Parts tab of each design item</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm table-sticky-first-col">
                <thead className="bg-purple-50 border-b border-purple-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-purple-800">Part Name</th>
                    <th className="px-4 py-3 text-left font-medium text-purple-800">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-purple-800">Supplier</th>
                    <th className="px-4 py-3 text-center font-medium text-purple-800">Total Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-purple-800">Avg Unit Cost</th>
                    <th className="px-4 py-3 text-right font-medium text-purple-800">Total Cost</th>
                    <th className="px-4 py-3 text-left font-medium text-purple-800">Used In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {aggregatedSpecialParts.map((part, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{part.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs capitalize">
                          {part.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{part.supplier || '-'}</td>
                      <td className="px-4 py-3 text-center font-medium">{part.totalQuantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">UGX {Math.round(part.avgUnitCost).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-purple-700">UGX {Math.round(part.totalCost).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{part.fromItems.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-purple-50 border-t border-purple-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-medium text-purple-800">Total Special Parts Cost</td>
                    <td className="px-4 py-3 text-right font-bold text-purple-900">UGX {specialPartsTotal.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CutlistTab;
