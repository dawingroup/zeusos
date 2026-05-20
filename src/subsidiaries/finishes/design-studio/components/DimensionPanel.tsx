/**
 * DimensionPanel — Side-by-side model vs cut list dimensions display
 */

import type {
  DimensionSet,
  PartTreeNode,
  CutListEntry,
  MeshCutListLink,
} from '../types/workshop-viewer.types';
import { DIMENSION_COLORS } from '../constants/workshop-viewer.constants';

interface DimensionPanelProps {
  dimensions: DimensionSet | null;
  selectedNode: PartTreeNode | null;
  cutList: CutListEntry[];
  meshLinks: MeshCutListLink[];
}

export default function DimensionPanel({
  dimensions,
  selectedNode,
  cutList,
  meshLinks,
}: DimensionPanelProps) {
  if (!dimensions) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Load a model to see dimensions
      </div>
    );
  }

  // Find linked cut list entry for selected part
  const linkedCutEntry = selectedNode
    ? findLinkedCutEntry(selectedNode, cutList, meshLinks)
    : null;

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      {/* Overall dimensions */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Overall
        </div>
        <DimRow label="Width (X)" value={dimensions.overall.width} color={DIMENSION_COLORS.overall_width} />
        <DimRow label="Depth (Y)" value={dimensions.overall.depth} color={DIMENSION_COLORS.overall_width} />
        <DimRow label="Height (Z)" value={dimensions.overall.height} color={DIMENSION_COLORS.overall_height} />
      </div>

      {/* Selected part dimensions */}
      {selectedNode && (
        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {selectedNode.name}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <div className="text-muted-foreground">3D Model</div>
            <div className="text-muted-foreground">Cut List</div>

            {/* Width */}
            <div className="font-mono">{Math.round(selectedNode.dims.w)} mm</div>
            <DimCompare
              modelVal={selectedNode.dims.w}
              cutVal={linkedCutEntry?.length ?? null}
            />

            {/* Depth */}
            <div className="font-mono">{Math.round(selectedNode.dims.d)} mm</div>
            <DimCompare
              modelVal={selectedNode.dims.d}
              cutVal={linkedCutEntry?.width ?? null}
            />

            {/* Height */}
            <div className="font-mono">{Math.round(selectedNode.dims.h)} mm</div>
            <DimCompare
              modelVal={selectedNode.dims.h}
              cutVal={linkedCutEntry?.thickness ?? null}
            />
          </div>

          {/* Cut list details */}
          {linkedCutEntry && (
            <div className="mt-2 space-y-0.5 text-muted-foreground">
              <div><span className="text-muted-foreground">Material:</span> {linkedCutEntry.material}</div>
              <div><span className="text-muted-foreground">Qty:</span> {linkedCutEntry.qty}</div>
              {linkedCutEntry.grainDirection && linkedCutEntry.grainDirection !== 'none' && (
                <div><span className="text-muted-foreground">Grain:</span> {linkedCutEntry.grainDirection}</div>
              )}
              <div className="flex gap-1.5 mt-1">
                <EdgeBadge label="L1" active={linkedCutEntry.edgeBanding.L1} />
                <EdgeBadge label="L2" active={linkedCutEntry.edgeBanding.L2} />
                <EdgeBadge label="W1" active={linkedCutEntry.edgeBanding.W1} />
                <EdgeBadge label="W2" active={linkedCutEntry.edgeBanding.W2} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Intermediate dimensions */}
      {dimensions.intermediate.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Intermediate
          </div>
          {dimensions.intermediate.map((dim, i) => (
            <div key={i} className="mb-1.5">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: dim.color }}
                />
                <span className="text-muted-foreground">{dim.label}</span>
              </div>
              <div className="font-mono text-foreground ml-3.5">
                {dim.positions.map((p, j) => {
                  if (j === 0) return null;
                  const gap = Math.round(p - dim.positions[j - 1]);
                  return (
                    <span key={j} className="mr-1.5">
                      {gap}
                    </span>
                  );
                })}
                mm
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DimRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-mono font-medium">{Math.round(value)}</span>
      <span className="text-muted-foreground">mm</span>
    </div>
  );
}

function DimCompare({ modelVal, cutVal }: { modelVal: number; cutVal: number | null }) {
  if (cutVal === null) {
    return <span className="font-mono text-muted-foreground/50">—</span>;
  }
  const delta = Math.abs(modelVal - cutVal);
  const isOff = delta > 2;
  return (
    <span className={`font-mono ${isOff ? 'text-red-500 font-medium' : ''}`}>
      {Math.round(cutVal)} mm
      {isOff && <span className="text-[9px] ml-0.5">({delta > 0 ? '+' : ''}{Math.round(cutVal - modelVal)})</span>}
    </span>
  );
}

function EdgeBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center w-6 h-5 rounded text-[9px] font-medium ${
      active ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
    }`}>
      {label}
    </span>
  );
}

function findLinkedCutEntry(
  node: PartTreeNode,
  cutList: CutListEntry[],
  meshLinks: MeshCutListLink[],
): CutListEntry | null {
  for (const meshName of node.meshObjectNames) {
    const link = meshLinks.find(l => l.meshObjectName === meshName && l.cutListIndex >= 0);
    if (link) return cutList[link.cutListIndex] ?? null;
  }
  return null;
}
