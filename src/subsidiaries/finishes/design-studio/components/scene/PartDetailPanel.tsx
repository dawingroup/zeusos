/**
 * PartDetailPanel — scene-drawer surface for a single selected ScenePart.
 *
 * Exists because in Quick View a user can click a part and immediately
 * see dimensions + material + neighbours in the right sidebar. Scene
 * View had the SELECTION wiring (mode='part' + handleMeshClick) but
 * no dedicated panel, so clicking a part was a dead-end for anyone
 * trying to inspect a single component in a multi-cabinet scene.
 *
 * Renders five ordered sections:
 *   1. Identity — code / name / category / assembly
 *   2. Dimensions — length × width × thickness + grain + area
 *   3. Material — inventory item + description + finish library id
 *   4. Edge banding — per-edge type / length
 *   5. Connections — same-assembly siblings + joined + name-adjacent
 *
 * Connection rows are clickable; clicking navigates scene selection
 * to that part so the user can walk the cabinet structurally.
 */
import { useMemo } from 'react';
import { lookupMeshBbox } from '../../hooks/useMeshBboxes';
import { Ruler, Layers, Palette, Link2, Box, ChevronRight, Wrench, Boxes } from 'lucide-react';
import type { ScenePart, SceneAssembly } from '../../types/assembly.types';
import type { SceneCabinet } from '../../types/scene.types';
import { findPartConnections, type HardwareTarget } from '../../services/partConnections';
import type { GeomBox } from '../../services/partGeometryClassifier';
import type { InventoryResolver } from '../../services/scheduleLibraryResolvers';
import { ASSEMBLY_COLOURS, ASSEMBLY_COLOUR_FALLBACK } from '../../constants/workshop-viewer.constants';

interface Props {
  part: ScenePart;
  cabinet: SceneCabinet;
  /** Called when the user clicks a connected part — hands back the
   *  ScenePart.id so the parent can update scene selection. */
  onNavigateToPart?: (partId: string) => void;
  /** Optional mesh-bbox map (usually from parsedModel) — enables the
   *  "Touching" bucket. Panel still renders fully without it. */
  meshBboxes?: ReadonlyMap<string, GeomBox>;
  /** Optional Materials-library resolver — enriches hardware target
   *  rows with sku / supplier / unit cost. Panel still renders the
   *  raw boringSpec labels when omitted. */
  inventoryResolver?: InventoryResolver;
}

export function PartDetailPanel({
  part, cabinet, onNavigateToPart, meshBboxes, inventoryResolver,
}: Props) {
  const connections = useMemo(
    () => findPartConnections(part, cabinet, { bboxByMesh: meshBboxes }),
    [part, cabinet, meshBboxes],
  );
  const parentAssembly = connections.parentAssembly;

  const assemblyColour = parentAssembly
    ? (ASSEMBLY_COLOURS[parentAssembly.assemblyType] ?? ASSEMBLY_COLOUR_FALLBACK)
    : ASSEMBLY_COLOUR_FALLBACK;

  const dims = part.dimensions;
  const areaM2 = dims?.length && dims?.width
    ? ((dims.length * dims.width) / 1_000_000).toFixed(3)
    : null;

  const liveDims = useMemo(() => {
    if (dims) return null;
    if (!part.meshNodeId || !meshBboxes) return null;
    const box = lookupMeshBbox(meshBboxes, part.meshNodeId);
    return box ? lwtFromAxisAlignedBbox(box) : null;
  }, [dims, part.meshNodeId, meshBboxes]);

  return (
    <div className="p-3 space-y-3 overflow-auto">
      {/* Header */}
      <header className="rounded-md border border-border bg-card p-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className="shrink-0 h-3 w-3 rounded-sm border border-black/10"
            style={{ backgroundColor: assemblyColour }}
            title={parentAssembly?.assemblyType ?? 'no assembly'}
          />
          <span className="text-[10px] font-mono text-muted-foreground">{part.partCode || '—'}</span>
        </div>
        <p className="text-sm font-semibold leading-tight truncate" title={part.partName}>
          {part.partName || part.partCode || part.id}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {part.partCategory}
          {parentAssembly && (
            <>
              <span className="mx-1">·</span>
              <span>{parentAssembly.displayName || parentAssembly.assemblyType}</span>
            </>
          )}
        </p>
      </header>

      {/* Dimensions */}
      <Section icon={Ruler} title="Dimensions">
        {dims ? (
          <div className="grid grid-cols-3 gap-1 text-[11px]">
            <Cell label="Length"    value={dims.length ? `${Math.round(dims.length)} mm` : '—'} />
            <Cell label="Width"     value={dims.width ? `${Math.round(dims.width)} mm` : '—'} />
            <Cell label="Thickness" value={dims.thickness ? `${Math.round(dims.thickness)} mm` : '—'} />
            <Cell label="Grain"     value={dims.grainDirection ?? '—'} />
            <Cell label="Quantity"  value={String(part.quantity ?? 1)} />
            {areaM2 && <Cell label="Area" value={`${areaM2} m²`} />}
          </div>
        ) : liveDims ? (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground leading-snug">
              From loaded mesh (axis-aligned) — re-run model processing to persist to the part record.
            </p>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <Cell label="Length"    value={`${liveDims.length} mm`} />
              <Cell label="Width"     value={`${liveDims.width} mm`} />
              <Cell label="Thickness" value={`${liveDims.thickness} mm`} />
              <Cell label="Quantity"  value={String(part.quantity ?? 1)} />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">No dimensions recorded for this part.</p>
        )}
      </Section>

      {/* Material */}
      <Section icon={Palette} title="Material">
        <dl className="space-y-1 text-[11px]">
          <Row label="Inventory" value={part.inventoryItemName || '—'} />
          <Row label="Code"      value={part.inventoryItemId || '—'} mono />
          <Row label="Finish id" value={part.finishLibraryId || '—'} mono />
          <Row label="Spec"      value={part.materialDescription || '—'} />
        </dl>
      </Section>

      {/* Edge banding */}
      {part.edgeBanding && hasAnyEdge(part.edgeBanding) && (
        <Section icon={Layers} title="Edge banding">
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            {(['top','bottom','left','right','front'] as const).map(edge => {
              const e = part.edgeBanding![edge];
              return (
                <Cell
                  key={edge}
                  label={edge[0].toUpperCase() + edge.slice(1)}
                  value={e ? `${e.type} · ${Math.round(e.length)}mm` : '—'}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Connections */}
      <Section icon={Link2} title={`Connections · ${connections.summary.total}`}>
        {connections.summary.total === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            No structural neighbours recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {connections.sameAssembly.length > 0 && (
              <ConnectionGroup
                label={`In this ${parentAssembly?.assemblyType ?? 'assembly'}`}
                hint="Parts of the same assembly the selected member belongs to."
                parts={connections.sameAssembly}
                cabinet={cabinet}
                onNavigate={onNavigateToPart}
              />
            )}
            {connections.joined.length > 0 && (
              <ConnectionGroup
                label="Joined"
                hint="Parts linked via joint / boring spec (dowel, cam-lock, screw)."
                parts={connections.joined}
                cabinet={cabinet}
                onNavigate={onNavigateToPart}
              />
            )}
            {connections.neighbouringByName.length > 0 && (
              <ConnectionGroup
                label="Nearby by mesh name"
                hint="Same-name-family meshes (side_L + side_L_cover) — heuristic."
                parts={connections.neighbouringByName}
                cabinet={cabinet}
                onNavigate={onNavigateToPart}
              />
            )}
            {connections.touching.length > 0 && (
              <ConnectionGroup
                label="Touching"
                hint="Parts whose mesh bbox meets or overlaps this one (from the parsed model)."
                parts={connections.touching}
                cabinet={cabinet}
                onNavigate={onNavigateToPart}
                icon={Boxes}
              />
            )}
          </div>
        )}
      </Section>

      {/* Hardware drill-through */}
      {connections.hardwareTargets.length > 0 && (
        <Section icon={Wrench} title={`Hardware · ${connections.hardwareTargets.length}`}>
          <p className="text-[10px] text-muted-foreground italic leading-snug mb-1">
            Inventory-library items the part's boring spec drills for
            (hinge cups, runner brackets, cam-lock receptacles).
          </p>
          <ul className="space-y-0.5">
            {connections.hardwareTargets.map(t => (
              <HardwareRow key={t.key} target={t} resolver={inventoryResolver} />
            ))}
          </ul>
        </Section>
      )}

      {/* Notes / boring */}
      {(part.notes || part.boringSpec) && (
        <Section icon={Box} title="Fabrication">
          {part.notes && (
            <p className="text-[11px] text-foreground leading-snug whitespace-pre-wrap">{part.notes}</p>
          )}
          {part.boringSpec && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">
              Boring spec attached — see shop traveller for the drill pattern.
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small UI primitives
// ---------------------------------------------------------------------------

/**
 * Same L/W/T convention as `makePartStub` / workshop pipeline: sorted edge
 * lengths so thickness is the smallest span.
 */
function lwtFromAxisAlignedBbox(box: {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}): { length: number; width: number; thickness: number } {
  const dx = Math.abs(box.max.x - box.min.x);
  const dy = Math.abs(box.max.y - box.min.y);
  const dz = Math.abs(box.max.z - box.min.z);
  const sorted = [dx, dy, dz].sort((a, b) => a - b) as [number, number, number];
  return {
    thickness: Math.round(sorted[0]),
    width: Math.round(sorted[1]),
    length: Math.round(sorted[2]),
  };
}

function Section({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-2.5 space-y-1.5">
      <header className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {title}
      </header>
      {children}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[11px] font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-right truncate ${mono ? 'font-mono text-[10px]' : ''}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function ConnectionGroup({
  label, hint, parts, cabinet, onNavigate,
}: {
  label: string;
  hint: string;
  parts: ScenePart[];
  cabinet: SceneCabinet;
  onNavigate?: (partId: string) => void;
  /** Optional indicator icon shown before the label — lets callers
   *  distinguish the 'touching' bucket from name-based kin. */
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const assembliesById = useMemo(() => {
    const m = new Map<string, SceneAssembly>();
    for (const a of cabinet.assemblies ?? []) m.set(a.id, a);
    return m;
  }, [cabinet]);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
        {label} <span className="text-muted-foreground font-normal">· {parts.length}</span>
      </p>
      <p className="text-[10px] text-muted-foreground italic leading-snug">{hint}</p>
      <ul className="mt-1 space-y-0.5">
        {parts.map(p => {
          const asm = assembliesById.get(p.assemblyId);
          const colour = asm
            ? (ASSEMBLY_COLOURS[asm.assemblyType] ?? ASSEMBLY_COLOUR_FALLBACK)
            : ASSEMBLY_COLOUR_FALLBACK;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onNavigate?.(p.id)}
                disabled={!onNavigate}
                className="w-full text-left flex items-center gap-2 px-1.5 py-1 rounded hover:bg-accent disabled:cursor-default"
              >
                <span
                  className="h-2 w-2 rounded-sm shrink-0 border border-black/10"
                  style={{ backgroundColor: colour }}
                />
                <span className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">
                    {p.partName || p.partCode || p.id}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {asm?.displayName || asm?.assemblyType} · {p.partCategory}
                  </p>
                </span>
                {onNavigate && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function hasAnyEdge(eb: NonNullable<ScenePart['edgeBanding']>): boolean {
  return !!(eb.top || eb.bottom || eb.left || eb.right || eb.front);
}

/**
 * Row for a single hardware drill-target. Resolves the inventory
 * reference when a resolver is provided; otherwise shows the raw
 * boring-spec label.
 */
function HardwareRow({
  target, resolver,
}: {
  target: HardwareTarget;
  resolver?: InventoryResolver;
}) {
  const resolved = target.inventoryItemId && resolver
    ? resolver(target.inventoryItemId)
    : undefined;
  const displayName = resolved?.name ?? target.label;
  const sku = resolved?.sku ?? target.inventoryItemId;
  const supplier = resolved?.supplier;

  return (
    <li className="flex items-start gap-2 px-1.5 py-1 rounded border border-border bg-background">
      <span className="h-2 w-2 rounded-sm shrink-0 mt-1 bg-neutral-600" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium truncate">
          {displayName}
          {target.quantity !== undefined && target.quantity > 1 && (
            <span className="ml-1.5 text-muted-foreground font-normal">× {target.quantity}</span>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono truncate">
          {sku ?? 'no inventory link'}
          {supplier && <span className="font-sans"> · {supplier}</span>}
        </p>
      </div>
      {target.inventoryItemId && !resolved && (
        <span
          className="shrink-0 text-[9px] text-amber-700 italic"
          title="Inventory resolver not supplied — pass one via PartDetailPanel's inventoryResolver prop"
        >
          unresolved
        </span>
      )}
    </li>
  );
}
