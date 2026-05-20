/**
 * PdfExportPreviewPanel — interactive preview of what will land in
 * the generated PDF before the user hits "Generate".
 *
 * Works against the SAME aggregators + resolvers the PDF generator
 * uses (`extractHardwareSchedule`, `aggregateFinishSchedule`,
 * `createFinishLibraryResolver`, `createInventoryResolver`), so what
 * the user sees here is what they get. Lazy-loads each schedule on
 * demand — opening the Finishes panel doesn't trigger the Hardware
 * fetch, and vice versa.
 *
 * Four collapsible groups, one per new sheet:
 *   1. Rendered Views — thumbnails of every cabinet's renderUrl.
 *   2. Hardware Schedule — enriched rows (SKU, brand, supplier, cost).
 *   3. Finish Schedule — resolved rows with colour swatches.
 *   4. Architectural Plans — uploaded image filenames + captions.
 *
 * Each header shows the projected sheet ref (I500, I303, etc.) +
 * a live count + an "auto/on/off" badge reflecting the dialog state,
 * so users see the consequence of every checkbox they tick.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Image as ImageIcon, Wrench, Palette, Layout, Loader2,
} from 'lucide-react';
import type { SceneCabinet, DesignScene, FinishScheduleEntry } from '../../types/scene.types';
import type { HardwareScheduleEntry } from '../../types/mdp.types';
import { extractHardwareSchedule } from '../../services/partProcessing.service';
import {
  enrichHardwareSchedule,
  hardwareInventoryIds,
  type EnrichedHardwareEntry,
} from '../../services/hardwareScheduleEnricher';
import { aggregateFinishSchedule } from '../../services/finishScheduleAggregator';
import {
  createFinishLibraryResolver,
  createInventoryResolver,
} from '../../services/scheduleLibraryResolvers';

interface Props {
  scene: Pick<DesignScene, 'name' | 'architecturalAssets'>;
  cabinets: SceneCabinet[];
  enabled: {
    renderGallery: boolean;
    hardwareSchedule: boolean;
    finishSchedule: boolean;
    architecturalPlans: boolean;
  };
}

type Group = 'renders' | 'hardware' | 'finishes' | 'architectural';

export function PdfExportPreviewPanel({ scene, cabinets, enabled }: Props) {
  const [open, setOpen] = useState<Record<Group, boolean>>({
    renders: false,
    hardware: false,
    finishes: false,
    architectural: false,
  });
  const toggle = (g: Group) => setOpen(prev => ({ ...prev, [g]: !prev[g] }));

  // ── Render gallery — data available from cabinets alone. ────────────
  const renderCabinets = useMemo(
    () => cabinets.filter(c => c.renderUrl || c.thumbnailUrl),
    [cabinets],
  );

  // ── Hardware + finish aggregation (lazy, scoped to the scene). ─────
  const rawHardware = useMemo<HardwareScheduleEntry[]>(() => {
    const parts = cabinets.flatMap(c => (c.assemblies ?? []).flatMap(a => a.parts ?? []));
    return extractHardwareSchedule(parts);
  }, [cabinets]);

  const [hardware, setHardware] = useState<EnrichedHardwareEntry[] | null>(null);
  const [hardwareLoading, setHardwareLoading] = useState(false);
  useEffect(() => {
    if (!open.hardware || !enabled.hardwareSchedule || hardware) return;
    let cancelled = false;
    setHardwareLoading(true);
    (async () => {
      const resolver = await createInventoryResolver(hardwareInventoryIds(rawHardware));
      if (cancelled) return;
      setHardware(enrichHardwareSchedule(rawHardware, resolver));
      setHardwareLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rawHardware ref is memoised
  }, [open.hardware, enabled.hardwareSchedule, rawHardware]);

  const [finishes, setFinishes] = useState<FinishScheduleEntry[] | null>(null);
  const [finishesLoading, setFinishesLoading] = useState(false);
  const finishIds = useMemo(() => {
    const s = new Set<string>();
    for (const cab of cabinets) {
      for (const id of Object.values(cab.finishSelections ?? {})) if (id) s.add(id);
      for (const asm of cab.assemblies ?? []) for (const p of asm.parts ?? []) {
        if (p.finishLibraryId) s.add(p.finishLibraryId);
      }
    }
    return Array.from(s).sort();
  }, [cabinets]);
  useEffect(() => {
    if (!open.finishes || !enabled.finishSchedule || finishes) return;
    let cancelled = false;
    setFinishesLoading(true);
    (async () => {
      const resolver = await createFinishLibraryResolver(finishIds);
      if (cancelled) return;
      setFinishes(aggregateFinishSchedule(cabinets, resolver));
      setFinishesLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open.finishes, enabled.finishSchedule, finishIds.join('|')]);

  const architecturalAssets = scene.architecturalAssets ?? [];

  return (
    <section className="rounded-md border border-gray-200 bg-gray-50 p-2 space-y-1.5">
      <header className="flex items-center justify-between px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Preview — what lands in the PDF
        </h4>
        <p className="text-[10px] text-gray-400">
          Live from the scene · tick a box above to include
        </p>
      </header>

      {/* Rendered Views */}
      <GroupHeader
        open={open.renders}
        toggle={() => toggle('renders')}
        icon={ImageIcon}
        sheetRef="I500"
        title="Rendered Views"
        count={renderCabinets.length}
        enabled={enabled.renderGallery}
        empty={renderCabinets.length === 0 ? 'No cabinet renders available' : undefined}
      />
      {open.renders && renderCabinets.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 px-1 pb-1">
          {renderCabinets.map(c => (
            <div key={c.id} className="rounded border border-gray-200 bg-white overflow-hidden">
              <img
                src={c.renderUrl || c.thumbnailUrl}
                alt={c.displayName}
                className="w-full h-16 object-cover"
                loading="lazy"
              />
              <p className="px-1 py-0.5 text-[9px] truncate" title={c.displayName}>
                {c.cabinetCode || c.displayName}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Hardware */}
      <GroupHeader
        open={open.hardware}
        toggle={() => toggle('hardware')}
        icon={Wrench}
        sheetRef="I303"
        title="Hardware Schedule"
        count={rawHardware.length}
        enabled={enabled.hardwareSchedule}
        empty={rawHardware.length === 0 ? 'No hardware items across this scene' : undefined}
      />
      {open.hardware && rawHardware.length > 0 && (
        <div className="px-1 pb-1">
          {hardwareLoading ? (
            <div className="text-[10px] text-gray-500 inline-flex items-center gap-1 py-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Resolving from Materials library…
            </div>
          ) : hardware ? (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-0.5 font-medium">SKU</th>
                  <th className="py-0.5 font-medium">Hardware</th>
                  <th className="py-0.5 font-medium">Brand / supplier</th>
                  <th className="py-0.5 font-medium text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {hardware.slice(0, 8).map((r, i) => (
                  <tr key={i} className={r.resolved ? '' : 'text-amber-700 italic'}>
                    <td className="py-0.5 font-mono">{r.sku ?? r.inventoryItemId?.slice(0, 10) ?? '—'}</td>
                    <td className="py-0.5 truncate">{r.resolvedName ?? r.hardwareName}</td>
                    <td className="py-0.5 text-gray-500 truncate">
                      {[r.brand, r.supplier].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="py-0.5 text-right">{r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {hardware && hardware.length > 8 && (
            <p className="text-[9px] text-gray-400 italic mt-0.5">
              + {hardware.length - 8} more · full table in the PDF
            </p>
          )}
        </div>
      )}

      {/* Finishes */}
      <GroupHeader
        open={open.finishes}
        toggle={() => toggle('finishes')}
        icon={Palette}
        sheetRef="I304"
        title="Finish Schedule"
        count={finishIds.length}
        enabled={enabled.finishSchedule}
        empty={finishIds.length === 0 ? 'No finishes assigned in this scene' : undefined}
      />
      {open.finishes && finishIds.length > 0 && (
        <div className="px-1 pb-1 space-y-0.5">
          {finishesLoading ? (
            <div className="text-[10px] text-gray-500 inline-flex items-center gap-1 py-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Resolving from Finish Library…
            </div>
          ) : finishes ? (
            <ul className="grid grid-cols-1 gap-0.5">
              {finishes.slice(0, 10).map(f => (
                <li key={f.finishLibraryId} className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className="h-3 w-3 rounded-sm shrink-0 border border-black/10"
                    style={{ backgroundColor: f.colorHex || '#cccccc' }}
                    title={f.colorHex ? f.colorHex : 'no colour in library'}
                  />
                  <span className="flex-1 truncate">
                    {f.name}
                    {f.code && <span className="ml-1 text-gray-500 font-mono">· {f.code}</span>}
                  </span>
                  <span className="text-gray-500 shrink-0">
                    {f.cabinetCount} cab · {f.partCount} parts
                  </span>
                </li>
              ))}
              {finishes.length > 10 && (
                <li className="text-[9px] text-gray-400 italic">
                  + {finishes.length - 10} more · full table in the PDF
                </li>
              )}
            </ul>
          ) : null}
        </div>
      )}

      {/* Architectural */}
      <GroupHeader
        open={open.architectural}
        toggle={() => toggle('architectural')}
        icon={Layout}
        sheetRef="A1xx–A9xx"
        title="Architectural Plans"
        count={architecturalAssets.length}
        enabled={enabled.architecturalPlans}
        empty={architecturalAssets.length === 0
          ? 'None uploaded — attach via the scene Files drawer'
          : undefined}
      />
      {open.architectural && architecturalAssets.length > 0 && (
        <ul className="px-1 pb-1 space-y-0.5">
          {architecturalAssets.map(a => (
            <li key={a.id} className="flex items-center gap-1.5 text-[10px]">
              <span className="h-3 w-3 rounded-sm shrink-0 border border-black/10 bg-white" />
              <span className="flex-1 truncate">
                <span className="uppercase text-gray-500 text-[9px] mr-1">{a.kind}</span>
                {a.label}
              </span>
              <span className="text-gray-400 font-mono truncate">{a.fileName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------

function GroupHeader({
  open, toggle, icon: Icon, sheetRef, title, count, enabled, empty,
}: {
  open: boolean;
  toggle: () => void;
  icon: React.ComponentType<{ className?: string }>;
  sheetRef: string;
  title: string;
  count: number;
  enabled: boolean;
  empty?: string;
}) {
  const disabled = count === 0;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : toggle}
      className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-xs ${
        disabled ? 'opacity-50 cursor-default' : 'hover:bg-gray-100'
      }`}
    >
      {open && !disabled
        ? <ChevronDown className="h-3 w-3 text-gray-400" />
        : <ChevronRight className="h-3 w-3 text-gray-400" />}
      <Icon className="h-3.5 w-3.5 text-gray-600" />
      <span className="font-medium text-gray-800">{title}</span>
      <span className="text-[9px] font-mono text-gray-400">{sheetRef}</span>
      <span className="text-gray-500 text-[10px]">· {count}</span>
      <span className="flex-1" />
      {empty ? (
        <span className="text-[9px] italic text-gray-400">{empty}</span>
      ) : (
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded ${
            enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
          }`}
        >
          {enabled ? 'Will include' : 'Off'}
        </span>
      )}
    </button>
  );
}
