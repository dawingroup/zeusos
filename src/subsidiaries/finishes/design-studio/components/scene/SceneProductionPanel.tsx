/**
 * SceneProductionPanel — scene-level manufacturing rollup.
 *
 * Lists every cabinet in the scene that has a linked Manufacturing Order
 * (`manufacturingOrderId`). Each row is collapsed by default showing the
 * cabinet label + a tiny status pill; expanding a row renders the full
 * `<ProductionTab>` for that MO (same UI as Quick Review uses). The
 * per-MO fetch (`useProductionContext`) only fires when the row is
 * expanded — keeps the panel cheap for scenes with many cabinets.
 *
 * Empty state surfaces the existing "Release to Production" flow — the
 * dialog is mounted at the page level; we just call `onRelease` to open
 * it for the selected cabinet's DesignItem.
 */
import { useState } from 'react';
import { Factory, ChevronRight, ChevronDown, PlayCircle } from 'lucide-react';
import ProductionTab from '../ProductionTab';
import { useProductionContext } from '../../hooks/useProductionContext';
import type { SceneCabinet } from '../../types/scene.types';

interface SceneProductionPanelProps {
  cabinets: SceneCabinet[];
  /** Called with a cabinet id when the user hits "Release to Production"
   *  on an unlocked cabinet. Opens the existing `ReleaseToProductionDialog`
   *  via the page's `releaseDesignItemId` state. */
  onRelease?: (cabinetId: string) => void;
}

export function SceneProductionPanel({ cabinets, onRelease }: SceneProductionPanelProps) {
  const inProduction = cabinets.filter(c => !!c.manufacturingOrderId);
  const releasable = cabinets.filter(c => !c.manufacturingOrderId && !!c.designItemId);

  return (
    <div className="p-3 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Factory className="h-3.5 w-3.5" /> Production
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {inProduction.length} of {cabinets.length} cabinets released to MOs
        </p>
      </div>

      {/* In-production rows */}
      {inProduction.length > 0 && (
        <div className="space-y-1.5">
          {inProduction.map(cab => (
            <ProductionRow key={cab.id} cabinet={cab} />
          ))}
        </div>
      )}

      {/* Releasable rows */}
      {releasable.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Ready to release
          </p>
          <div className="space-y-1.5">
            {releasable.map(cab => (
              <div key={cab.id} className="rounded-md border border-border p-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {cab.cabinetCode || cab.displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {cab.displayName}
                  </p>
                </div>
                {onRelease ? (
                  <button
                    type="button"
                    onClick={() => onRelease(cab.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-primary text-primary-foreground rounded hover:opacity-90"
                  >
                    <PlayCircle className="h-3 w-3" />
                    Release
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Release from Design Manager
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All-empty state */}
      {inProduction.length === 0 && releasable.length === 0 && (
        <div className="rounded-md border border-border p-3 text-xs text-muted-foreground leading-relaxed">
          Cabinets become releasable once they're bound to a Design Item.
          Assign Design Items from the Cabinet detail panel.
        </div>
      )}
    </div>
  );
}

interface ProductionRowProps {
  cabinet: SceneCabinet;
}

function ProductionRow({ cabinet }: ProductionRowProps) {
  const [expanded, setExpanded] = useState(false);
  // Only subscribe when the user actually expands the row. Saves one
  // Firestore listener per collapsed cabinet — matters for scenes with
  // dozens of MO-linked cabinets.
  const { production, loading, error } = useProductionContext(
    expanded ? cabinet.manufacturingOrderId ?? null : null,
  );

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 p-2 hover:bg-accent text-left"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {cabinet.cabinetCode || cabinet.displayName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            MO: <span className="font-mono">{cabinet.manufacturingOrderId}</span>
          </p>
        </div>
        <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700">
          Locked
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {loading && (
            <p className="p-3 text-[11px] text-muted-foreground">Loading production context…</p>
          )}
          {error && (
            <p className="p-3 text-[11px] text-red-600">Failed to load MO: {error}</p>
          )}
          {!loading && !error && production && (
            <ProductionTab production={production} />
          )}
          {!loading && !error && !production && (
            <p className="p-3 text-[11px] text-muted-foreground">
              MO not found or no access.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
