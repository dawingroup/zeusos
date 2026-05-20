/**
 * Nesting Studio Component
 * Optimization interface for ESTIMATION and PRODUCTION modes
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Settings,
  Layers,
  Package,
  Scissors,
  BarChart3,
  ChevronDown,
  ChevronUp,
  TreePine,
  Recycle,
  Wrench,
  Shirt,
} from 'lucide-react';
import type {
  Project,
  EstimationResult,
  ProductionResult,
  OptimizationConfig,
  NestingSheet,
  MaterialProcessingSummary,
  TimberStickOperation,
  TimberStockChoiceRationale,
  FabricBay,
} from '@/shared/types';
import { 
  runProjectEstimation, 
  runProjectProduction,
  updateProjectConfig
} from '@/shared/services/optimization/projectOptimization';

// ============================================
// Types
// ============================================

interface NestingStudioProps {
  projectId: string;
  project: Project;
  mode: 'ESTIMATION' | 'PRODUCTION';
  onComplete?: () => void;
  onRefresh?: () => void;
  userId: string;
  className?: string;
}

// ============================================
// Sub-Components
// ============================================

/**
 * Shared per-sheet card with inline cutting-map visualization.
 * Used by both Estimation (now that estimation produces nestingSheets) and
 * Production results so the visual is consistent across modes.
 */
interface NestingSheetCardProps {
  sheet: NestingSheet;
  // 12 distinct hues so duplicate part names get distinct colors but the
  // visual stays calm. Index by part name hash.
}

const SHEET_PART_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4',
  '#EF4444', '#84CC16', '#6366F1', '#14B8A6', '#F97316', '#A855F7',
];
function hashColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return SHEET_PART_PALETTE[Math.abs(h) % SHEET_PART_PALETTE.length];
}

const NestingSheetCard: React.FC<NestingSheetCardProps> = ({ sheet }) => {
  const totalParts = sheet.placements.length;
  // sheetSize.length is the LONG side, sheetSize.width is the SHORT side.
  // Render with the long side horizontal.
  const aspectPct = (sheet.sheetSize.width / sheet.sheetSize.length) * 100;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-baseline justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">
            Sheet {sheet.sheetIndex + 1}
          </span>
          <span className="text-xs text-gray-500 truncate">{sheet.materialName}</span>
        </div>
        <span className="text-xs text-gray-600 font-medium flex-shrink-0">
          {sheet.utilizationPercent.toFixed(0)}%
        </span>
      </div>

      {/* Cutting-map visualization */}
      <div className="p-2">
        <div
          className="relative bg-amber-100 border border-amber-300 rounded overflow-hidden"
          style={{ width: '100%', paddingBottom: `${aspectPct}%` }}
        >
          {sheet.placements.map((placement, idx) => {
            const scaleX = 100 / sheet.sheetSize.length;
            const scaleY = 100 / sheet.sheetSize.width;
            const widthPct = placement.length * scaleX;
            const heightPct = placement.width * scaleY;
            const showLabel = widthPct > 12 && heightPct > 8;
            return (
              <div
                key={idx}
                className="absolute border border-black/30 flex items-center justify-center text-[9px] text-white font-medium overflow-hidden leading-tight"
                style={{
                  left: `${placement.x * scaleX}%`,
                  top: `${placement.y * scaleY}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  backgroundColor: hashColor(placement.partName),
                }}
                title={`${placement.partName} — ${placement.length}×${placement.width}mm`}
              >
                {showLabel ? placement.partName.slice(0, 14) : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-600 flex items-center justify-between">
        <span>{totalParts} part{totalParts === 1 ? '' : 's'}</span>
        <span className="font-mono text-gray-500">
          {sheet.sheetSize.length}×{sheet.sheetSize.width}mm
        </span>
      </div>
    </div>
  );
};

/**
 * Shared card for a single timber stick or linear bar — horizontal stock with
 * cut placements drawn proportionally along its length. Used in production
 * results where we have per-stick `LinearCuttingResult` data.
 */
interface LinearStickCardProps {
  stick: import('@/shared/types').LinearCuttingResult;
  index: number;
  variant: 'timber' | 'linear';
}

const LINEAR_PART_PALETTE = [
  '#92400E', '#15803D', '#0E7490', '#7C3AED', '#BE185D',
  '#1D4ED8', '#9F1239', '#A16207', '#0F766E', '#6D28D9',
];
function hashLinearColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return LINEAR_PART_PALETTE[Math.abs(h) % LINEAR_PART_PALETTE.length];
}

const LinearStickCard: React.FC<LinearStickCardProps> = ({ stick, index, variant }) => {
  const stockLen = stick.stockLength || 1;
  // Build the horizontal layout segments: cuts (colored) + waste (light) drawn
  // proportionally to the stock length. We position by startPosition.
  const cutSegments = stick.cuts
    .map(c => ({
      label: c.partName,
      start: c.startPosition,
      length: c.cutLength,
      color: hashLinearColor(c.partName),
    }))
    .sort((a, b) => a.start - b.start);

  // Waste segments (gaps not used by cuts). Show only large/reusable ones.
  const wasteSegments = (stick.wasteSegments || []).filter(w => w.length > 50);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {variant === 'timber'
            ? <TreePine className="w-4 h-4 text-amber-600 flex-shrink-0" />
            : <Layers className="w-4 h-4 text-slate-500 flex-shrink-0" />}
          <span className="font-medium text-gray-900 truncate">
            {variant === 'timber' ? 'Stick' : 'Bar'} {index + 1}
          </span>
          <span className="text-xs text-gray-500 truncate">{stick.materialName}</span>
          {stick.isOffcut && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase font-semibold flex-shrink-0">
              from offcut
            </span>
          )}
        </div>
        <span className="text-xs text-gray-600 font-medium flex-shrink-0">
          {stick.utilizationPercent.toFixed(0)}%
        </span>
      </div>

      {/* 1D stock visualization */}
      <div className="p-2">
        <div className="relative bg-amber-50 border border-amber-200 rounded h-8 overflow-hidden">
          {wasteSegments.map((w, idx) => (
            <div
              key={`w${idx}`}
              className={`absolute top-0 bottom-0 ${w.reusable ? 'bg-emerald-100/70' : 'bg-stone-200/50'}`}
              style={{
                left: `${(w.startPosition / stockLen) * 100}%`,
                width: `${(w.length / stockLen) * 100}%`,
              }}
              title={`${w.reusable ? 'Reusable offcut' : 'Waste'}: ${w.length}mm`}
            />
          ))}
          {cutSegments.map((seg, idx) => {
            const widthPct = (seg.length / stockLen) * 100;
            return (
              <div
                key={`c${idx}`}
                className="absolute top-0 bottom-0 border-r border-black/30 flex items-center justify-center text-[9px] text-white font-medium overflow-hidden leading-tight"
                style={{
                  left: `${(seg.start / stockLen) * 100}%`,
                  width: `${widthPct}%`,
                  backgroundColor: seg.color,
                }}
                title={`${seg.label} — ${seg.length}mm`}
              >
                {widthPct > 8 ? seg.label.slice(0, 10) : ''}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-600 flex items-center justify-between">
        <span className="font-mono text-gray-500">
          {stick.crossSection.thickness}×{stick.crossSection.width} × {stick.stockLength}mm
        </span>
        <span>{stick.cuts.length} cut{stick.cuts.length === 1 ? '' : 's'}</span>
      </div>

      {/* Operations sequence (timber only) */}
      {stick.operations && stick.operations.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          <div className="text-[10px] font-medium text-gray-500 uppercase mb-1">Operations</div>
          <ol className="space-y-0.5">
            {stick.operations.map((op, opIdx) => (
              <li key={opIdx} className="flex items-start gap-1.5 text-[11px] text-gray-700 leading-snug">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-medium flex-shrink-0 text-[9px]">
                  {op.sequence}
                </span>
                <span className="font-medium">{op.label}</span>
                <span className="text-gray-500 truncate">
                  · {op.quantity} {op.unit.replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

/**
 * Timber summary card for ESTIMATION mode. Surfaces the stockChoice rationale
 * + offcut usage so the user can see WHY a particular stock size was
 * selected — exactly the visibility the user asked for ("identify the most
 * ideal stock sizes" and "rely on offcuts that remained from previous jobs").
 */
const TimberSummaryCard: React.FC<{
  summary: import('@/shared/types').TimberSummary;
}> = ({ summary }) => {
  const cs = summary.crossSection;
  const raw = summary.rawCrossSection;
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TreePine className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">{summary.materialName}</span>
        </div>
        <span className="text-xs text-gray-600 font-medium flex-shrink-0">
          {summary.averageUtilizationPercent != null
            ? `${summary.averageUtilizationPercent.toFixed(0)}%`
            : '—'}
        </span>
      </div>
      <div className="p-3 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span className="text-gray-500">Finished section</span>
          <span className="font-mono text-gray-800">{cs.thickness}×{cs.width}mm</span>
          {raw && (raw.thickness !== cs.thickness || raw.width !== cs.width) && (
            <>
              <span className="text-gray-500">Raw section</span>
              <span className="font-mono text-gray-800">{raw.thickness}×{raw.width}mm <span className="text-gray-400">(rough-sawn)</span></span>
            </>
          )}
          <span className="text-gray-500">Stock length</span>
          <span className="font-mono text-gray-800">{summary.stockLength}mm</span>
          <span className="text-gray-500">Sticks needed</span>
          <span className="font-medium text-gray-900">{summary.sticksRequired}</span>
          <span className="text-gray-500">Parts on sticks</span>
          <span className="text-gray-800">{summary.partsOnSticks}</span>
          {summary.pricingMethod && (
            <>
              <span className="text-gray-500">Pricing</span>
              <span className="text-gray-800 capitalize">{summary.pricingMethod.replace('-', ' ')}</span>
            </>
          )}
        </div>
        {summary.offcutsUsed != null && summary.offcutsUsed > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
            <Recycle className="w-3 h-3" />
            <span>{summary.offcutsUsed} offcut{summary.offcutsUsed === 1 ? '' : 's'} consumed from library</span>
          </div>
        )}
        {summary.stockChoice && (
          <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1.5 rounded leading-snug">
            <span className="font-medium text-gray-700">Stock choice: </span>
            {summary.stockChoice.rationale}
            <span className="ml-1 text-gray-400">
              ({(summary.stockChoice.wasteRatio * 100).toFixed(0)}% waste)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Linear stock (metal bars, aluminium) summary card for ESTIMATION mode.
 * Different shape than TimberSummary — uses `profile` + `barsRequired`.
 */
const LinearStockSummaryCard: React.FC<{
  summary: import('@/shared/types').LinearStockSummary;
}> = ({ summary }) => {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">{summary.materialName}</span>
          <span className="text-xs text-gray-500 truncate">{summary.profile}</span>
        </div>
        <span className="text-xs text-gray-600 font-medium flex-shrink-0">
          {summary.averageUtilizationPercent.toFixed(0)}%
        </span>
      </div>
      <div className="p-3 space-y-1 text-xs">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span className="text-gray-500">Stock length</span>
          <span className="font-mono text-gray-800">{summary.stockLength}mm</span>
          <span className="text-gray-500">Bars needed</span>
          <span className="font-medium text-gray-900">{summary.barsRequired}</span>
          <span className="text-gray-500">Parts on bars</span>
          <span className="text-gray-800">{summary.partsOnBars}</span>
          <span className="text-gray-500">Linear meters</span>
          <span className="font-mono text-gray-800">{summary.totalLinearMeters.toFixed(1)} m</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Per-bay card for fabric / upholstery. One bay = one cut-section the
 * upholsterer takes from the roll. Long-narrow horizontal layout because
 * the roll runs along the bay's length (rollWidth is fixed across the
 * bay). Cuts colored by part name; visualization mirrors the
 * NestingSheetCard but oriented for the roll-strip aspect ratio.
 */
const FabricBayCard: React.FC<{ bay: FabricBay }> = ({ bay }) => {
  const totalParts = bay.placements.length;
  // Long edge runs horizontally — visualize the strip with bayLength as
  // the horizontal axis and rollWidth as the vertical axis.
  const aspectPct = (bay.rollWidth / Math.max(bay.bayLength, 1)) * 100;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shirt className="w-4 h-4 text-fuchsia-600 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">
            Bay {bay.bayIndex + 1}
          </span>
          <span className="text-xs text-gray-500 truncate">{bay.materialName}</span>
        </div>
        <span className="text-xs text-gray-600 font-medium flex-shrink-0">
          {bay.utilizationPercent.toFixed(0)}%
        </span>
      </div>

      <div className="p-2">
        <div
          className="relative bg-fuchsia-50 border border-fuchsia-200 rounded overflow-hidden"
          style={{ width: '100%', paddingBottom: `${aspectPct}%` }}
        >
          {bay.placements.map((placement, idx) => {
            const scaleX = 100 / bay.bayLength;
            const scaleY = 100 / bay.rollWidth;
            const widthPct = placement.length * scaleX;
            const heightPct = placement.width * scaleY;
            const showLabel = widthPct > 12 && heightPct > 8;
            return (
              <div
                key={idx}
                className="absolute border border-black/30 flex items-center justify-center text-[9px] text-white font-medium overflow-hidden leading-tight"
                style={{
                  left: `${placement.x * scaleX}%`,
                  top: `${placement.y * scaleY}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  backgroundColor: hashColor(placement.partName),
                }}
                title={`${placement.partName} — ${placement.length}×${placement.width}mm`}
              >
                {showLabel ? placement.partName.slice(0, 14) : ''}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-600 flex items-center justify-between">
        <span>{totalParts} part{totalParts === 1 ? '' : 's'}</span>
        <span className="font-mono text-gray-500">
          {bay.bayLength}mm × {bay.rollWidth}mm
        </span>
      </div>
    </div>
  );
};

/**
 * Estimation-mode summary card for fabric. Mirrors TimberSummaryCard
 * conceptually — one card per fabric material, surfacing roll
 * dimensions and total length consumed.
 */
const FabricSummaryCard: React.FC<{
  summary: import('@/shared/types').FabricSummary;
}> = ({ summary }) => (
  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-baseline justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Shirt className="w-4 h-4 text-fuchsia-600 flex-shrink-0" />
        <span className="font-medium text-gray-900 truncate">{summary.materialName}</span>
      </div>
      <span className="text-xs text-gray-600 font-medium flex-shrink-0">
        {summary.averageUtilizationPercent.toFixed(0)}%
      </span>
    </div>
    <div className="p-3 space-y-1 text-xs">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-gray-500">Roll width</span>
        <span className="font-mono text-gray-800">{summary.rollWidth}mm</span>
        <span className="text-gray-500">Bay length</span>
        <span className="font-mono text-gray-800">{summary.bayLength}mm</span>
        <span className="text-gray-500">Bays needed</span>
        <span className="font-medium text-gray-900">{summary.baysRequired}</span>
        <span className="text-gray-500">Linear meters</span>
        <span className="font-mono text-gray-800">{summary.totalLinearMetersConsumed.toFixed(2)} m</span>
        <span className="text-gray-500">Parts on roll</span>
        <span className="text-gray-800">{summary.partsOnRoll}</span>
      </div>
    </div>
  </div>
);

interface ConfigPanelProps {
  config: OptimizationConfig | undefined;
  onChange: (config: Partial<OptimizationConfig>) => void;
  disabled: boolean;
  expanded: boolean;
  onToggle: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
  config, 
  onChange, 
  disabled, 
  expanded, 
  onToggle 
}) => {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-700">Optimization Settings</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Kerf */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Blade Kerf (mm)
            </label>
            <input
              type="number"
              value={config?.kerf || 3.2}
              onChange={(e) => onChange({ kerf: parseFloat(e.target.value) })}
              disabled={disabled}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
              step="0.1"
              min="0"
            />
          </div>

          {/* Target Yield */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Yield (%)
            </label>
            <input
              type="number"
              value={config?.targetYield || 85}
              onChange={(e) => onChange({ targetYield: parseInt(e.target.value) })}
              disabled={disabled}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
              min="50"
              max="100"
            />
          </div>

          {/* Grain Matching */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="grainMatching"
              checked={config?.grainMatching ?? true}
              onChange={(e) => onChange({ grainMatching: e.target.checked })}
              disabled={disabled}
              className="rounded border-gray-300"
            />
            <label htmlFor="grainMatching" className="text-sm text-gray-700">
              Respect grain direction
            </label>
          </div>

          {/* Allow Rotation */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowRotation"
              checked={config?.allowRotation ?? true}
              onChange={(e) => onChange({ allowRotation: e.target.checked })}
              disabled={disabled}
              className="rounded border-gray-300"
            />
            <label htmlFor="allowRotation" className="text-sm text-gray-700">
              Allow part rotation
            </label>
          </div>

          {/* Offcut Library */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useOffcutLibrary"
              checked={config?.useOffcutLibrary ?? true}
              onChange={(e) => onChange({ useOffcutLibrary: e.target.checked })}
              disabled={disabled}
              className="rounded border-gray-300"
            />
            <label htmlFor="useOffcutLibrary" className="text-sm text-gray-700">
              Use offcut library (reuse remnants from previous jobs)
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

interface EstimationResultsProps {
  results: EstimationResult;
}

const EstimationResults: React.FC<EstimationResultsProps> = ({ results }) => {
  const [showProcessingDetail, setShowProcessingDetail] = useState(false);
  const [expandedTimberIdx, setExpandedTimberIdx] = useState<number | null>(null);

  const formatCost = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">
            {results.totalSheetsCount + (results.totalTimberSticks || 0) + (results.totalLinearBars || 0)}
          </div>
          <div className="text-sm text-blue-600">Stock Units</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">{results.totalPartsCount}</div>
          <div className="text-sm text-green-600">Total Parts</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-amber-700">{results.wasteEstimate.toFixed(1)}%</div>
          <div className="text-sm text-amber-600">Est. Waste</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-700">
            {formatCost(results.totalCost || results.roughCost)}
          </div>
          <div className="text-sm text-purple-600">Total Est. Cost</div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-bold text-gray-700">
            {formatCost(results.roughCost)}
          </div>
          <div className="text-xs text-gray-500">Sheet Materials</div>
        </div>
        {(results.timberCost ?? 0) > 0 && (
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="text-lg font-bold text-amber-700">
              {formatCost(results.timberCost || 0)}
            </div>
            <div className="text-xs text-amber-600">
              Timber ({results.totalTimberSticks || 0} sticks)
            </div>
          </div>
        )}
        {(results.fabricCost ?? 0) > 0 && (
          <div className="bg-fuchsia-50 rounded-lg p-3">
            <div className="text-lg font-bold text-fuchsia-700">
              {formatCost(results.fabricCost || 0)}
            </div>
            <div className="text-xs text-fuchsia-600 flex items-center gap-1">
              <Shirt className="w-3 h-3" />
              Upholstery ({results.totalFabricBays || 0} bay{(results.totalFabricBays || 0) === 1 ? '' : 's'})
            </div>
          </div>
        )}
        {(results.totalProcessingCost ?? 0) > 0 && (
          <div className="bg-indigo-50 rounded-lg p-3">
            <div className="text-lg font-bold text-indigo-700">
              {formatCost(results.totalProcessingCost || 0)}
            </div>
            <div className="text-xs text-indigo-600 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Processing
            </div>
          </div>
        )}
        {(results.standardPartsCost ?? 0) > 0 && (
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="text-lg font-bold text-orange-700">
              {formatCost(results.standardPartsCost || 0)}
            </div>
            <div className="text-xs text-orange-500">
              Standard Parts ({results.totalStandardParts || 0})
            </div>
          </div>
        )}
        {(results.specialPartsCost ?? 0) > 0 && (
          <div className="bg-pink-50 rounded-lg p-3">
            <div className="text-lg font-bold text-pink-700">
              {formatCost(results.specialPartsCost || 0)}
            </div>
            <div className="text-xs text-pink-500">
              Special Parts ({results.totalSpecialParts || 0})
            </div>
          </div>
        )}
      </div>

      {/* Offcut Savings */}
      {results.offcutsUsed && results.offcutsUsed.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Recycle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-medium text-green-800">
              {results.offcutsUsed.length} offcut{results.offcutsUsed.length > 1 ? 's' : ''} reused
            </span>
            <span className="text-green-600 ml-2">
              — saved {formatCost(results.offcutSavings || 0)} UGX
            </span>
          </div>
        </div>
      )}

      {/* Audit warnings — surfaces silent fallbacks, ignored material types,
          unpriced parts, etc. so the user can fix data before quoting. */}
      {results.warnings && results.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="font-medium text-amber-900">
              {results.warnings.length} estimation warning{results.warnings.length > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-1 text-sm text-amber-900">
            {results.warnings.map((w, idx) => (
              <li key={idx} className="leading-snug">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sheet Goods — 2D layouts (quick-pack preview). */}
      {results.nestingSheets && results.nestingSheets.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <h4 className="font-medium text-gray-700">Sheet Goods</h4>
            </div>
            <span className="text-sm text-gray-500">
              {results.nestingSheets.length} sheet{results.nestingSheets.length === 1 ? '' : 's'} · quick-pack preview
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.nestingSheets.map((sheet) => (
              <NestingSheetCard key={sheet.id} sheet={sheet} />
            ))}
          </div>
        </div>
      )}

      {/* Timber — summary cards by cross-section. Surfaces stockChoice
          (so the user sees WHY each stock size was selected) and offcut
          consumption. The detailed cost table further down is still here
          for reference. */}
      {results.timberSummary && results.timberSummary.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TreePine className="w-4 h-4 text-amber-600" />
              <h4 className="font-medium text-gray-700">Timber Cuts</h4>
            </div>
            <span className="text-sm text-amber-700 font-medium">
              {results.timberSummary.length} cross-section group{results.timberSummary.length === 1 ? '' : 's'}
              {results.timberSummary.some(s => (s.offcutsUsed ?? 0) > 0) && (
                <span className="ml-2 text-emerald-700">
                  · {results.timberSummary.reduce((sum, s) => sum + (s.offcutsUsed ?? 0), 0)} offcut(s) used
                </span>
              )}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.timberSummary.map((summary, idx) => (
              <TimberSummaryCard key={idx} summary={summary} />
            ))}
          </div>
        </div>
      )}

      {/* Linear Bars (metal/aluminium) — summary cards by profile. */}
      {results.linearStockSummary && results.linearStockSummary.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <h4 className="font-medium text-gray-700">Linear Bars</h4>
            </div>
            <span className="text-sm text-gray-500">
              {results.linearStockSummary.length} profile{results.linearStockSummary.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.linearStockSummary.map((summary, idx) => (
              <LinearStockSummaryCard key={idx} summary={summary} />
            ))}
          </div>
        </div>
      )}

      {/* Upholstery — fabric roll summaries (one card per fabric type). */}
      {results.fabricSummary && results.fabricSummary.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shirt className="w-4 h-4 text-fuchsia-600" />
              <h4 className="font-medium text-gray-700">Upholstery</h4>
            </div>
            <span className="text-sm text-gray-500">
              {results.fabricSummary.length} material{results.fabricSummary.length === 1 ? '' : 's'}
              {' · '}
              {results.fabricSummary.reduce((s, f) => s + f.baysRequired, 0)} bay
              {results.fabricSummary.reduce((s, f) => s + f.baysRequired, 0) === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.fabricSummary.map((summary, idx) => (
              <FabricSummaryCard key={idx} summary={summary} />
            ))}
          </div>
        </div>
      )}

      {/* Upholstery bay layouts — one card per cut-section the
          upholsterer takes from the roll. */}
      {results.fabricBays && results.fabricBays.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shirt className="w-4 h-4 text-fuchsia-600" />
              <h4 className="font-medium text-gray-700">Upholstery Bays</h4>
            </div>
            <span className="text-sm text-gray-500">
              {results.fabricBays.length} bay{results.fabricBays.length === 1 ? '' : 's'} · cut from roll
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.fabricBays.map((bay, idx) => (
              <FabricBayCard key={bay.id || idx} bay={bay} />
            ))}
          </div>
        </div>
      )}

      {/* Sheet Summary Table */}
      {results.sheetSummary.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="font-medium text-gray-700">Sheet Summary by Material</h4>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Thickness</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sheets</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Utilization</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.sheetSummary.map((summary, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{summary.materialName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{summary.thickness}mm</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{summary.sheetsRequired}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            summary.utilizationPercent >= 80 ? 'bg-green-500' :
                            summary.utilizationPercent >= 60 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(summary.utilizationPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{summary.utilizationPercent.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {summary.estimatedCost.toLocaleString()} UGX
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Timber Summary Table */}
      {results.timberSummary && results.timberSummary.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <TreePine className="w-4 h-4 text-amber-600" />
            <h4 className="font-medium text-gray-700">Timber Summary by Cross-Section</h4>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-2 py-2"></th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sticks</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Volume (m³)</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Utilization</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material Cost</th>
                {results.timberSummary.some(s => s.totalProcessingCost) && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Processing</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.timberSummary.map((summary, idx) => {
                const hasDetails = !!(summary.stockChoice || (summary.operationsPerStick && summary.operationsPerStick.length));
                const isExpanded = expandedTimberIdx === idx;
                const showProcessingCol = results.timberSummary!.some(s => s.totalProcessingCost);
                const colSpan = 7 + (showProcessingCol ? 1 : 0);
                return (
                  <React.Fragment key={idx}>
                    <tr
                      className={`${hasDetails ? 'cursor-pointer' : ''} hover:bg-gray-50`}
                      onClick={() => hasDetails && setExpandedTimberIdx(isExpanded ? null : idx)}
                    >
                      <td className="px-2 py-3 text-gray-400">
                        {hasDetails ? (
                          isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {summary.materialName}
                        {summary.stockChoice && (
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                            summary.stockChoice.mode === 'par_exact' ? 'bg-green-100 text-green-700' :
                            summary.stockChoice.mode === 'rip_only' ? 'bg-blue-100 text-blue-700' :
                            summary.stockChoice.mode === 'rip_and_plane' ? 'bg-purple-100 text-purple-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {summary.stockChoice.mode.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {summary.crossSection.thickness}×{summary.crossSection.width}mm
                        {summary.rawCrossSection && (
                          <span className="text-xs text-gray-400 ml-1">
                            (raw: {summary.rawCrossSection.thickness}×{summary.rawCrossSection.width})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {summary.sticksRequired}
                        {summary.offcutsUsed ? (
                          <span className="text-xs text-green-600 ml-1">
                            ({summary.offcutsUsed} offcut{summary.offcutsUsed > 1 ? 's' : ''})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {summary.totalVolumeCubicMeters != null
                          ? summary.totalVolumeCubicMeters.toFixed(4)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                summary.averageUtilizationPercent >= 80 ? 'bg-green-500' :
                                summary.averageUtilizationPercent >= 60 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(summary.averageUtilizationPercent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{summary.averageUtilizationPercent.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {summary.estimatedCost.toLocaleString()} UGX
                        {summary.pricingMethod && (
                          <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${
                            summary.pricingMethod === 'volumetric'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {summary.pricingMethod === 'volumetric' ? 'm³' : summary.pricingMethod === 'per-piece' ? '/pc' : '/m'}
                          </span>
                        )}
                      </td>
                      {showProcessingCol && (
                        <td className="px-4 py-3 text-sm text-indigo-600">
                          {(summary.totalProcessingCost || 0).toLocaleString()} UGX
                        </td>
                      )}
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr className="bg-gray-50">
                        <td colSpan={colSpan} className="px-6 py-4">
                          <TimberStockPlanDetail
                            stockChoice={summary.stockChoice}
                            operationsPerStick={summary.operationsPerStick}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Processing Cost Breakdown */}
      {results.processingSummary && results.processingSummary.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowProcessingDetail(!showProcessingDetail)}
            className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-500" />
              <h4 className="font-medium text-gray-700">Processing Cost Breakdown</h4>
              <span className="text-sm text-indigo-600 font-medium ml-2">
                {formatCost(results.totalProcessingCost || 0)} UGX
              </span>
            </div>
            {showProcessingDetail ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {showProcessingDetail && (
            <ProcessingBreakdown summaries={results.processingSummary} />
          )}
        </div>
      )}
    </div>
  );
};

/** Processing cost breakdown table (shared by estimation and production) */
const ProcessingBreakdown: React.FC<{ summaries: MaterialProcessingSummary[] }> = ({ summaries }) => (
  <div className="divide-y divide-gray-100">
    {summaries.map((summary, idx) => (
      <div key={idx} className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-800 text-sm">
            {summary.materialName} ({summary.materialType})
          </span>
          <span className="text-sm text-gray-600">
            {summary.totalProcessingCost.toLocaleString()} UGX
            <span className="text-gray-400 ml-2">
              ({Math.round(summary.totalProcessingTimeMinutes)} min)
            </span>
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left py-1 font-medium">Step</th>
              <th className="text-right py-1 font-medium">Qty</th>
              <th className="text-right py-1 font-medium">Rate</th>
              <th className="text-right py-1 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {summary.steps.map((step, sIdx) => (
              <tr key={sIdx} className="text-gray-600">
                <td className="py-1">{step.label}</td>
                <td className="py-1 text-right">{step.quantity} {step.unit}</td>
                <td className="py-1 text-right">{step.ratePerUnit.toLocaleString()}</td>
                <td className="py-1 text-right">{step.totalCost.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ))}
  </div>
);

/** Timber stock-choice rationale + per-stick operations list */
const TimberStockPlanDetail: React.FC<{
  stockChoice?: TimberStockChoiceRationale;
  operationsPerStick?: TimberStickOperation[][];
}> = ({ stockChoice, operationsPerStick }) => (
  <div className="space-y-4">
    {stockChoice && (
      <div className="bg-white border border-gray-200 rounded-md p-3">
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">Stock Choice</div>
        <div className="text-sm text-gray-800">{stockChoice.rationale}</div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
          <span>Strips per board: <span className="font-medium text-gray-700">{stockChoice.stripsPerBoard}</span></span>
          <span>Waste ratio: <span className="font-medium text-gray-700">{(stockChoice.wasteRatio * 100).toFixed(1)}%</span></span>
        </div>
      </div>
    )}
    {operationsPerStick && operationsPerStick.length > 0 && (
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase mb-2">
          Operations per Stick ({operationsPerStick.length})
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {operationsPerStick.map((ops, stickIdx) => (
            <div key={stickIdx} className="bg-white border border-gray-200 rounded-md p-2">
              <div className="text-xs font-medium text-gray-600 mb-1">Stick {stickIdx + 1}</div>
              <ol className="space-y-1">
                {ops.map((op, opIdx) => (
                  <li key={opIdx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-medium flex-shrink-0">
                      {op.sequence}
                    </span>
                    <div className="flex-1">
                      <span className="font-medium">{op.label}</span>
                      <span className="ml-2 text-gray-500">
                        {op.quantity} {op.unit.replace(/_/g, ' ')}
                      </span>
                      {op.note && (
                        <div className="text-[11px] text-gray-400 mt-0.5">{op.note}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

interface ProductionResultsProps {
  results: ProductionResult;
}

const ProductionResults: React.FC<ProductionResultsProps> = ({ results }) => {
  const [showProcessingDetail, setShowProcessingDetail] = useState(false);

  const formatCost = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toLocaleString();
  };

  const timberStickCount = results.timberCuttingResults?.length || 0;
  const linearBarCount = results.linearStockCuttingResults?.length || 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">
            {results.nestingSheets.length + timberStickCount + linearBarCount}
          </div>
          <div className="text-sm text-blue-600">Stock Units</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">{results.optimizedYield.toFixed(1)}%</div>
          <div className="text-sm text-green-600">Optimized Yield</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-amber-700">{results.cutSequence.length}</div>
          <div className="text-sm text-amber-600">Cut Operations</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-700">{results.estimatedCutTime}</div>
          <div className="text-sm text-purple-600">Est. Minutes</div>
        </div>
      </div>

      {/* Processing Cost Summary */}
      {results.totalProcessingCost && results.totalProcessingCost > 0 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <Wrench className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          <span className="font-medium text-indigo-800">
            Processing Cost: {formatCost(results.totalProcessingCost)} UGX
          </span>
        </div>
      )}

      {/* Offcuts Used + Generated */}
      {(results.offcutsUsed?.length || results.offcutsGenerated?.length) ? (
        <div className="flex flex-col gap-2">
          {results.offcutsUsed && results.offcutsUsed.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Recycle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-green-800">
                <span className="font-medium">{results.offcutsUsed.length} offcut{results.offcutsUsed.length > 1 ? 's' : ''} consumed</span>
                {' '}from library
              </span>
            </div>
          )}
          {results.offcutsGenerated && results.offcutsGenerated.filter(o => o.reusable).length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <Recycle className="w-5 h-5 text-teal-600 flex-shrink-0" />
              <span className="text-teal-800">
                <span className="font-medium">
                  {results.offcutsGenerated.filter(o => o.reusable).length} reusable offcut{results.offcutsGenerated.filter(o => o.reusable).length > 1 ? 's' : ''}
                </span>
                {' '}registered for future use
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Sheet Goods — 2D cutting maps */}
      {results.nestingSheets.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <h4 className="font-medium text-gray-700">Sheet Goods</h4>
            </div>
            <span className="text-sm text-gray-500">
              {results.nestingSheets.length} sheet{results.nestingSheets.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.nestingSheets.map((sheet) => (
              <NestingSheetCard key={sheet.id} sheet={sheet} />
            ))}
          </div>
        </div>
      )}

      {/* Timber — 1D stick cutting layouts */}
      {results.timberCuttingResults && results.timberCuttingResults.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TreePine className="w-4 h-4 text-amber-600" />
              <h4 className="font-medium text-gray-700">Timber Cuts</h4>
            </div>
            <span className="text-sm text-amber-700 font-medium">
              {results.timberCuttingResults.length} stick{results.timberCuttingResults.length === 1 ? '' : 's'}
              {results.timberCuttingResults.some(s => s.isOffcut) && (
                <span className="ml-2 text-emerald-700">
                  · {results.timberCuttingResults.filter(s => s.isOffcut).length} from offcuts
                </span>
              )}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.timberCuttingResults.map((stick, idx) => (
              <LinearStickCard
                key={stick.id || idx}
                stick={stick}
                index={idx}
                variant="timber"
              />
            ))}
          </div>
        </div>
      )}

      {/* Linear Bars (metal/aluminium) — 1D bar cutting layouts */}
      {results.linearStockCuttingResults && results.linearStockCuttingResults.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <h4 className="font-medium text-gray-700">Linear Bars</h4>
            </div>
            <span className="text-sm text-gray-500">
              {results.linearStockCuttingResults.length} bar{results.linearStockCuttingResults.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.linearStockCuttingResults.map((bar, idx) => (
              <LinearStickCard
                key={bar.id || idx}
                stick={bar}
                index={idx}
                variant="linear"
              />
            ))}
          </div>
        </div>
      )}

      {/* Processing Cost Breakdown (expandable) */}
      {results.processingSummary && results.processingSummary.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowProcessingDetail(!showProcessingDetail)}
            className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-500" />
              <h4 className="font-medium text-gray-700">Processing Cost Breakdown</h4>
              <span className="text-sm text-indigo-600 font-medium ml-2">
                {formatCost(results.totalProcessingCost || 0)} UGX
              </span>
            </div>
            {showProcessingDetail ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {showProcessingDetail && (
            <ProcessingBreakdown summaries={results.processingSummary} />
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const NestingStudio: React.FC<NestingStudioProps> = ({ 
  projectId, 
  project,
  mode, 
  onComplete,
  onRefresh,
  userId,
  className = '',
}) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Get optimization state based on mode
  const modeKey = mode.toLowerCase() as 'estimation' | 'production';
  const optimizationState = project?.optimizationState?.[modeKey];
  const isInvalidated = !!optimizationState?.invalidatedAt;
  const hasResults = !!optimizationState && !isInvalidated;
  const config = project?.optimizationState?.config;
  
  // Get asset warnings (e.g., CNC machines in maintenance)
  const assetWarnings = (project as any)?.activeWarnings?.filter(
    (w: any) => w.type === 'ASSET_UNAVAILABLE'
  ) || [];
  
  // Track if auto-estimation has been attempted
  const autoRunAttemptedRef = useRef(false);

  // Run optimization
  const handleRunOptimization = async () => {
    setIsOptimizing(true);
    setError(null);

    try {
      if (mode === 'ESTIMATION') {
        await runProjectEstimation(projectId, userId);
      } else {
        await runProjectProduction(projectId, userId);
      }
      
      onRefresh?.();
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Auto-run estimation when entering the tab if stale or no results
  useEffect(() => {
    // Only auto-run for estimation mode, not production (which is more expensive)
    if (mode !== 'ESTIMATION') return;
    
    // Skip if already attempted, already running, or has valid results
    if (autoRunAttemptedRef.current || isOptimizing || hasResults) return;
    
    // Auto-run if no results or invalidated
    if (!optimizationState || isInvalidated) {
      autoRunAttemptedRef.current = true;
      console.log('[NestingStudio] Auto-running estimation...');
      handleRunOptimization();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hasResults, isInvalidated, isOptimizing]);

  // Handle config change
  const handleConfigChange = async (changes: Partial<OptimizationConfig>) => {
    console.log('Config change:', changes);
    try {
      await updateProjectConfig(projectId, changes, userId);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  // Get button state
  const getButtonState = () => {
    if (isOptimizing) {
      return { 
        label: 'Optimizing...', 
        icon: RefreshCw, 
        variant: 'secondary' as const,
        spin: true,
      };
    }
    if (isInvalidated) {
      return { 
        label: 'Re-optimize', 
        icon: RefreshCw, 
        variant: 'warning' as const,
        spin: false,
      };
    }
    if (hasResults) {
      return { 
        label: 'Results Current', 
        icon: CheckCircle, 
        variant: 'success' as const,
        spin: false,
      };
    }
    return { 
      label: `Run ${mode === 'ESTIMATION' ? 'Estimation' : 'Production'}`, 
      icon: Play, 
      variant: 'primary' as const,
      spin: false,
    };
  };

  const buttonState = getButtonState();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {mode === 'ESTIMATION' ? (
            <BarChart3 className="w-5 h-5 text-blue-600" />
          ) : (
            <Scissors className="w-5 h-5 text-purple-600" />
          )}
          <div>
            <h3 className="font-semibold text-gray-900">
              {mode === 'ESTIMATION' ? 'Material Estimation' : 'Production Nesting'}
            </h3>
            <p className="text-sm text-gray-500">
              {mode === 'ESTIMATION'
                ? 'Quick estimate with FFD simulation and processing costs'
                : 'Full optimization for 85%+ yield'}
            </p>
          </div>
        </div>
      </div>

      {/* Asset Warnings (CNC machines in maintenance, etc.) */}
      {assetWarnings.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-orange-800">Machine Status Warning</h4>
            <div className="text-sm text-orange-700 mt-1 space-y-1">
              {assetWarnings.map((warning: any) => (
                <p key={warning.assetId}>{warning.message}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invalidation Warning */}
      {isInvalidated && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Optimization Outdated</h4>
            <p className="text-sm text-amber-700 mt-1">
              Changes detected: {optimizationState?.invalidationReasons?.join(', ') || 'Project data modified'}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800">Optimization Failed</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Configuration Panel */}
      <ConfigPanel
        config={config}
        onChange={handleConfigChange}
        disabled={isOptimizing}
        expanded={showConfig}
        onToggle={() => setShowConfig(!showConfig)}
      />

      {/* Action Button */}
      <button
        onClick={handleRunOptimization}
        disabled={isOptimizing}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
          buttonState.variant === 'primary' 
            ? 'bg-blue-600 text-white hover:bg-blue-700' 
            : buttonState.variant === 'warning'
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : buttonState.variant === 'success'
            ? 'bg-green-600 text-white hover:bg-green-700'
            : buttonState.variant === 'secondary'
            ? 'bg-blue-400 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <buttonState.icon className={`w-5 h-5 ${buttonState.spin ? 'animate-spin' : ''}`} />
        {buttonState.label}
      </button>

      {/* Results */}
      {hasResults && (
        <div className="mt-6">
          {mode === 'ESTIMATION' && optimizationState ? (
            <EstimationResults results={optimizationState as EstimationResult} />
          ) : mode === 'PRODUCTION' && optimizationState ? (
            <ProductionResults results={optimizationState as ProductionResult} />
          ) : null}
        </div>
      )}

      {/* No results message */}
      {!hasResults && !isOptimizing && (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Run optimization to see material requirements</p>
        </div>
      )}
    </div>
  );
};

export default NestingStudio;
