/**
 * sceneScheduleSheets — scene-level PDF section renderers for the
 * post-cabinet-pass: finish schedule, hardware schedule, render gallery,
 * architectural plans.
 *
 * Each renderer draws a single jsPDF page (or a page per asset in the
 * case of architectural plans) and returns the number of pages it
 * consumed, so the caller can track numbering.
 *
 * Kept separate from `printPackageService.ts` because that file is
 * already ~900 LOC of cabinet-level rendering; these are project-wide
 * aggregates that iterate the whole scene once, not per cabinet.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  A3_DIMENSIONS,
  DF_BRAND_COLORS,
  SHEET_NUMBERING,
  ASSEMBLY_COLOURS,
  ASSEMBLY_COLOUR_FALLBACK,
} from '../constants/workshop-viewer.constants';
import type { EnrichedHardwareEntry } from './hardwareScheduleEnricher';
import type { AssemblyTypeEnum } from '../constants/assembly.constants';
import { drawTitleBlock } from '../utils/titleBlockRenderer';
import type { PrintPackageConfig } from '../types/workshop-viewer.types';
import type {
  SceneCabinet,
  SceneArchitecturalAsset,
  FinishScheduleEntry,
} from '../types/scene.types';
import type { HardwareScheduleEntry } from '../types/mdp.types';

const MARGIN = 10;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Open a new page + render a brand-consistent title strip. */
function openSheet(
  doc: jsPDF,
  config: PrintPackageConfig,
  title: string,
  dwgNum: string,
  hasOutfitFont: boolean,
  logoBase64?: string,
  logoFormat?: 'PNG' | 'JPEG',
): void {
  doc.addPage();
  drawTitleBlock(
    doc, config.projectInfo, title, dwgNum, hasOutfitFont,
    logoBase64, logoFormat, config.paperSize,
  );
}

/** Fetch a URL and return it as a dataURL suitable for jsPDF.addImage. */
async function urlToDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const format: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sub-cover divider — single-page section intro
//
// Paints a full-page border + centred section number + big title +
// optional subtitle, using the same brand palette as the main cover
// so the package reads as one coherent document rather than a pile
// of pages. Intended to be emitted once before each major section:
// project drawings, cabinet details, schedules, renders, architectural.
// ---------------------------------------------------------------------------

export function drawSubCoverSheet(
  doc: jsPDF,
  _config: PrintPackageConfig,
  sheetNumber: string,
  title: string,
  subtitle: string | string[] | undefined,
  hasOutfitFont: boolean,
  _logoBase64?: string,
  _logoFormat?: 'PNG' | 'JPEG',
): number {
  doc.addPage();
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';
  const M = 10;
  const pageW = A3_DIMENSIONS.width;
  const pageH = A3_DIMENSIONS.height;

  // Section dividers should read as DIVIDERS — not mini drawing sheets.
  // Drop the title block entirely; a simple brand-coloured border and
  // centred typography says "new section" at a glance.
  doc.setDrawColor(DF_BRAND_COLORS.separator);
  doc.setLineWidth(0.25);
  doc.rect(M, M, pageW - 2 * M, pageH - 2 * M);

  const cx = pageW / 2;
  const cy = pageH / 2;

  // Section tag — the sheet-number prefix blown up as the visual anchor.
  const seriesTag = sheetNumber.match(/^[A-Z]+\d?/)?.[0] ?? sheetNumber;
  doc.setFont(font, 'bold');
  doc.setFontSize(96);
  doc.setTextColor(DF_BRAND_COLORS.boysenberry);
  doc.text(seriesTag, cx, cy - 25, { align: 'center', baseline: 'middle' });

  // Horizontal rule under the tag.
  doc.setDrawColor(DF_BRAND_COLORS.boysenberry);
  doc.setLineWidth(0.6);
  doc.line(cx - 50, cy + 2, cx + 50, cy + 2);

  // Title.
  doc.setFont(font, 'bold');
  doc.setFontSize(26);
  doc.setTextColor(DF_BRAND_COLORS.navy);
  doc.text(title, cx, cy + 20, { align: 'center', baseline: 'middle' });

  // Subtitle(s).
  if (subtitle) {
    const lines = Array.isArray(subtitle) ? subtitle : [subtitle];
    doc.setFont(font, 'normal');
    doc.setFontSize(11);
    doc.setTextColor('#555555');
    let y = cy + 36;
    for (const line of lines) {
      doc.text(line, cx, y, { align: 'center', baseline: 'middle' });
      y += 7;
    }
  }

  // Sheet number anchored in the bottom-right corner — still readable
  // from the drawing set spine without a full title block.
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#888888');
  doc.text(sheetNumber, pageW - M - 4, pageH - M - 4, { align: 'right' });

  return 1;
}

// ---------------------------------------------------------------------------
// Hardware schedule
// ---------------------------------------------------------------------------

/**
 * Accepts EITHER the raw HardwareScheduleEntry (backwards-compat path
 * when no inventory resolver is available) OR an EnrichedHardwareEntry
 * (Materials-library-resolved). When enriched rows land, the schedule
 * paints extra columns (SKU, supplier, unit cost) that match the
 * procurement-facing format a workshop PDF requires.
 */
export function drawHardwareScheduleSheet(
  doc: jsPDF,
  config: PrintPackageConfig,
  entries: ReadonlyArray<HardwareScheduleEntry | EnrichedHardwareEntry>,
  hasOutfitFont: boolean,
  logoBase64?: string,
  logoFormat?: 'PNG' | 'JPEG',
  sheetNumber: string = SHEET_NUMBERING.hardwareSchedule,
): number {
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';
  openSheet(doc, config, 'Hardware & Ironmongery Schedule', sheetNumber, hasOutfitFont, logoBase64, logoFormat);

  if (entries.length === 0) {
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DF_BRAND_COLORS.navy);
    doc.text('No hardware items across this scene yet.', MARGIN + 4, 40);
    return 1;
  }

  const hasEnriched = entries.some(e => 'resolved' in e);

  const fmtMoney = (cost?: number, currency?: string) => {
    if (cost === undefined || cost === null || !Number.isFinite(cost)) return '—';
    const formatted = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(cost);
    return `${formatted}${currency ? ` ${currency}` : ''}`;
  };

  if (hasEnriched) {
    // Rich schedule — Materials library spec alongside scene counts.
    const rich = entries as ReadonlyArray<EnrichedHardwareEntry>;
    autoTable(doc, {
      startY: 30,
      margin: { left: MARGIN + 4, right: MARGIN + 4 },
      head: [[
        '#', 'SKU', 'Hardware', 'Category', 'Brand', 'Supplier',
        'Qty', 'Unit', 'Unit cost', 'Boring', 'Notes',
      ]],
      body: rich.map((e, i) => [
        String(i + 1),
        e.sku || (e.inventoryItemId ? `⚠ ${e.inventoryItemId}` : '—'),
        e.resolvedName || e.hardwareName || '—',
        [e.category, e.subcategory].filter(Boolean).join(' / ') || '—',
        e.brand || '—',
        e.supplier || '—',
        String(e.quantity ?? '—'),
        e.unit || e.perUnit || '—',
        fmtMoney(e.unitCost, e.currency),
        e.boringRequired ? 'Yes' : 'No',
        e.notes || '',
      ]),
      styles: { font, fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', valign: 'middle' },
      headStyles: {
        fillColor: DF_BRAND_COLORS.boysenberry,
        textColor: '#ffffff',
        font,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: '#f8f9fa' },
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        1: { cellWidth: 28, font: 'courier' },
        6: { cellWidth: 12, halign: 'right' },
        7: { cellWidth: 14 },
        8: { cellWidth: 22, halign: 'right' },
        9: { cellWidth: 14 },
      },
      didParseCell: (data) => {
        // Flag unresolved rows in red so the user sees "fix the inventoryItemId link".
        if (data.section !== 'body') return;
        const row = rich[data.row.index];
        if (!row?.resolved) {
          data.cell.styles.textColor = '#a33';
          data.cell.styles.fontStyle = 'italic';
        }
      },
    });

    // Footer note — count of unresolved rows, same tone as the Finish schedule.
    const unresolvedCount = rich.filter(r => !r.resolved).length;
    if (unresolvedCount > 0) {
      doc.setFont(font, 'italic');
      doc.setFontSize(8);
      doc.setTextColor('#a33');
      doc.text(
        `${unresolvedCount} row${unresolvedCount === 1 ? '' : 's'} not linked to the Materials library — fix the inventoryItemId on those parts.`,
        MARGIN + 4,
        A3_DIMENSIONS.height - MARGIN - 4,
      );
    }
  } else {
    // Plain schedule — raw HardwareScheduleEntry (no Materials resolver).
    const plain = entries as ReadonlyArray<HardwareScheduleEntry>;
    autoTable(doc, {
      startY: 30,
      margin: { left: MARGIN + 4, right: MARGIN + 4 },
      head: [['#', 'Hardware', 'Inventory ref', 'Per cabinet', 'Total qty', 'Boring', 'Notes']],
      body: plain.map((e, i) => [
        String(i + 1),
        e.hardwareName || '—',
        e.inventoryItemId || '—',
        String(e.perUnit ?? '—'),
        String(e.quantity ?? '—'),
        e.boringRequired ? 'Yes' : 'No',
        e.notes || '',
      ]),
      styles: { font, fontSize: 8, cellPadding: 1.5 },
      headStyles: {
        fillColor: DF_BRAND_COLORS.boysenberry,
        textColor: '#ffffff',
        font,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: '#f8f9fa' },
      columnStyles: {
        0: { cellWidth: 10 },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 18 },
      },
    });
  }

  return 1;
}

// ---------------------------------------------------------------------------
// Finish schedule — colour swatch + details
// ---------------------------------------------------------------------------

export function drawFinishScheduleSheet(
  doc: jsPDF,
  config: PrintPackageConfig,
  entries: ReadonlyArray<FinishScheduleEntry>,
  hasOutfitFont: boolean,
  logoBase64?: string,
  logoFormat?: 'PNG' | 'JPEG',
  sheetNumber: string = SHEET_NUMBERING.finishSchedule,
): number {
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';
  openSheet(doc, config, 'Finish Schedule', sheetNumber, hasOutfitFont, logoBase64, logoFormat);

  if (entries.length === 0) {
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DF_BRAND_COLORS.navy);
    doc.text('No finishes selected on any cabinet yet.', MARGIN + 4, 40);
    return 1;
  }

  autoTable(doc, {
    startY: 30,
    margin: { left: MARGIN + 4, right: MARGIN + 4 },
    head: [['#', 'Swatch', 'Finish', 'Code', 'Applied to', 'Cabinets', 'Parts']],
    body: entries.map((e, i) => [
      String(i + 1),
      '', // rendered in didDrawCell below
      e.name + (e.description ? `\n${e.description}` : ''),
      e.code || '—',
      e.appliedTo.join(', ') || '—',
      `${e.cabinetCount}\n${e.cabinetLabels.join(', ')}`,
      String(e.partCount),
    ]),
    styles: { font, fontSize: 8, cellPadding: 1.5, valign: 'middle' },
    headStyles: {
      fillColor: DF_BRAND_COLORS.boysenberry,
      textColor: '#ffffff',
      font,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: '#f8f9fa' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 18 },
      3: { cellWidth: 28 },
      6: { cellWidth: 14, halign: 'right' },
    },
    didDrawCell: (data) => {
      // Paint the colour swatch inside column 1 for body rows.
      if (data.section !== 'body' || data.column.index !== 1) return;
      const entry = entries[data.row.index];
      if (!entry) return;
      const swatchPad = 2;
      const x = data.cell.x + swatchPad;
      const y = data.cell.y + swatchPad;
      const w = data.cell.width - swatchPad * 2;
      const h = data.cell.height - swatchPad * 2;
      if (entry.colorHex) {
        doc.setFillColor(entry.colorHex);
      } else {
        doc.setFillColor('#cccccc');
      }
      doc.setDrawColor(DF_BRAND_COLORS.separator);
      doc.setLineWidth(0.2);
      doc.rect(x, y, w, h, 'FD');
      if (!entry.colorHex) {
        doc.setFont(font, 'italic');
        doc.setFontSize(6);
        doc.setTextColor('#666666');
        doc.text('no\ncolour', x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' });
      }
    },
  });

  return 1;
}

// ---------------------------------------------------------------------------
// Render gallery — grid of cabinet renders
// ---------------------------------------------------------------------------

export async function drawRenderGallerySheet(
  doc: jsPDF,
  config: PrintPackageConfig,
  cabinets: ReadonlyArray<Pick<SceneCabinet, 'id' | 'cabinetCode' | 'displayName' | 'renderUrl' | 'thumbnailUrl'>>,
  hasOutfitFont: boolean,
  logoBase64?: string,
  logoFormat?: 'PNG' | 'JPEG',
  sheetNumber: string = SHEET_NUMBERING.renderGallery,
): Promise<number> {
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';
  openSheet(doc, config, 'Rendered Views', sheetNumber, hasOutfitFont, logoBase64, logoFormat);

  const withImage = cabinets.filter(c => c.renderUrl || c.thumbnailUrl);
  if (withImage.length === 0) {
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DF_BRAND_COLORS.navy);
    doc.text('No rendered images available for this scene yet.', MARGIN + 4, 40);
    return 1;
  }

  // Grid: 2 columns × 2 rows per page = 4 per page.
  const COLS = 2;
  const ROWS = 2;
  const AVAILABLE_W = A3_DIMENSIONS.width - MARGIN * 2 - 8;
  const AVAILABLE_H = A3_DIMENSIONS.height - 30 - MARGIN - 4; // 30 = title block offset
  const CELL_W = AVAILABLE_W / COLS;
  const CELL_H = AVAILABLE_H / ROWS;
  const TEXT_H = 8;
  const IMG_PAD = 2;

  let pages = 1;
  let idx = 0;
  for (const cab of withImage) {
    const slot = idx % (COLS * ROWS);
    if (idx > 0 && slot === 0) {
      doc.addPage();
      drawTitleBlock(
        doc, config.projectInfo, 'Rendered Views', `${sheetNumber}-${++pages}`,
        hasOutfitFont, logoBase64, logoFormat, config.paperSize,
      );
    }
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x = MARGIN + 4 + col * CELL_W;
    const y = 30 + row * CELL_H;

    const url = cab.renderUrl || cab.thumbnailUrl || '';
    const fetched = url ? await urlToDataUrl(url) : null;
    if (fetched) {
      try {
        doc.addImage(
          fetched.dataUrl, fetched.format,
          x + IMG_PAD, y + IMG_PAD,
          CELL_W - IMG_PAD * 2, CELL_H - IMG_PAD * 2 - TEXT_H,
        );
      } catch {
        // Ignore bad image — label still renders.
      }
    }
    doc.setDrawColor(DF_BRAND_COLORS.separator);
    doc.setLineWidth(0.2);
    doc.rect(x, y, CELL_W, CELL_H);

    doc.setFont(font, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(DF_BRAND_COLORS.navy);
    const label = cab.cabinetCode ? `${cab.cabinetCode} — ${cab.displayName}` : cab.displayName;
    doc.text(label ?? cab.id, x + 2, y + CELL_H - 2);

    idx++;
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Architectural plans — user-uploaded plan / section images
// ---------------------------------------------------------------------------

// Canonical grouping order — matches the AIA series (plans before
// elevations before sections before details before misc).
const ARCHITECTURAL_ORDER: ReadonlyArray<SceneArchitecturalAsset['kind']> = [
  'plan', 'elevation', 'section', 'detail', 'other',
];

const ARCHITECTURAL_HEADING: Record<SceneArchitecturalAsset['kind'], string> = {
  plan:      'Architectural Plan',
  elevation: 'Architectural Elevation',
  section:   'Architectural Section',
  detail:    'Architectural Detail',
  other:     'Architectural Drawing',
};

export async function drawArchitecturalPlansSheets(
  doc: jsPDF,
  config: PrintPackageConfig,
  assets: ReadonlyArray<SceneArchitecturalAsset>,
  hasOutfitFont: boolean,
  logoBase64?: string,
  logoFormat?: 'PNG' | 'JPEG',
): Promise<number> {
  if (assets.length === 0) return 0;
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';

  // Group by kind in canonical AIA order; per-kind sequence so
  // plans land in A1xx, elevations A2xx, sections A3xx, details A5xx,
  // misc A9xx. Preserve upload order within a kind.
  const byKind = new Map<SceneArchitecturalAsset['kind'], SceneArchitecturalAsset[]>();
  for (const a of assets) {
    const bucket = byKind.get(a.kind) ?? [];
    bucket.push(a);
    byKind.set(a.kind, bucket);
  }

  let pageCount = 0;
  for (const kind of ARCHITECTURAL_ORDER) {
    const group = byKind.get(kind);
    if (!group || group.length === 0) continue;

    for (let i = 0; i < group.length; i++) {
      const asset = group[i];
      const sheetNum = SHEET_NUMBERING.architectural(kind, i + 1);
      const heading = ARCHITECTURAL_HEADING[kind];
      openSheet(doc, config, `${heading} — ${asset.label}`, sheetNum, hasOutfitFont, logoBase64, logoFormat);

      const fetched = await urlToDataUrl(asset.fileUrl);
      const top = 30;
      const bottom = A3_DIMENSIONS.height - MARGIN - 12;
      const left = MARGIN + 4;
      const right = A3_DIMENSIONS.width - MARGIN - 4;
      const w = right - left;
      const h = bottom - top;

      if (fetched) {
        try {
          doc.addImage(fetched.dataUrl, fetched.format, left, top, w, h);
        } catch {
          doc.setFont(font, 'italic');
          doc.setFontSize(10);
          doc.setTextColor('#a33');
          doc.text('Could not render image — re-export as PNG/JPEG and re-upload.', left, top + 10);
        }
      } else {
        doc.setFont(font, 'italic');
        doc.setFontSize(10);
        doc.setTextColor('#a33');
        doc.text(`Failed to fetch ${asset.fileName}`, left, top + 10);
      }

      if (asset.caption) {
        doc.setFont(font, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(DF_BRAND_COLORS.navy);
        doc.text(asset.caption, left, bottom + 8, { maxWidth: w });
      }

      pageCount++;
    }
  }
  return pageCount;
}

// ---------------------------------------------------------------------------
// Section summaries — short, human-readable breakdowns used as the
// subtitle on sub-cover sheets.
// ---------------------------------------------------------------------------

/** "3 plans · 2 elevations · 1 section" — drives the architectural
 *  sub-cover subtitle so the divider page shows what's coming. */
export function architecturalSubtitle(
  assets: ReadonlyArray<SceneArchitecturalAsset>,
): string {
  const counts: Record<SceneArchitecturalAsset['kind'], number> = {
    plan: 0, elevation: 0, section: 0, detail: 0, other: 0,
  };
  for (const a of assets) counts[a.kind]++;
  const bits: string[] = [];
  const pick = (n: number, singular: string, plural: string) => {
    if (n === 0) return;
    bits.push(`${n} ${n === 1 ? singular : plural}`);
  };
  pick(counts.plan,      'plan',      'plans');
  pick(counts.elevation, 'elevation', 'elevations');
  pick(counts.section,   'section',   'sections');
  pick(counts.detail,    'detail',    'details');
  pick(counts.other,     'other',     'other');
  return bits.join(' · ');
}

// ---------------------------------------------------------------------------
// Assembly legend — colour key rendered on the scene contents sheet so
// the recipient knows which swatch maps to which assembly type.
// ---------------------------------------------------------------------------

const ASSEMBLY_DISPLAY_NAMES: Partial<Record<AssemblyTypeEnum, string>> = {
  carcass: 'Carcass',
  drawer_box: 'Drawer box',
  drawer_front: 'Drawer front',
  door_assembly: 'Door assembly',
  shelf_pack: 'Shelves',
  hardware_kit: 'Hardware',
  plinth_assembly: 'Plinth / toe-kick',
  cornice_run: 'Cornice',
  panel_run: 'Panel run',
  work_surface: 'Work surface',
  counter_front: 'Counter front',
  modesty_panel: 'Modesty panel',
  cable_tray: 'Cable tray',
  gable_run: 'Gable uprights',
  display_shelf_pack: 'Display shelves',
  display_back: 'Display back',
  cover_panel_run: 'Cover panels',
  security_grille: 'Security grille',
  bookcase_frame: 'Bookcase frame',
  custom: 'Custom',
};

/** Count per AssemblyType across an arbitrary bag of assemblies. */
export function assemblyCountsAcross(
  assemblyGroups: ReadonlyArray<ReadonlyArray<{ assemblyType: AssemblyTypeEnum }>>,
): Array<{ type: AssemblyTypeEnum; count: number }> {
  const counts = new Map<AssemblyTypeEnum, number>();
  for (const group of assemblyGroups) {
    for (const a of group) {
      counts.set(a.assemblyType, (counts.get(a.assemblyType) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

interface LegendOptions {
  x: number;
  y: number;
  width: number;
  /** Size per row — the legend laps out columns to fit. */
  rowHeight?: number;
  columns?: number;
}

/**
 * Render a compact colour-key box. Call-sites pass pre-filtered
 * entries (typically only assembly types actually present in the
 * scene). Returns the final Y after the legend.
 */
export function drawAssemblyLegend(
  doc: jsPDF,
  entries: ReadonlyArray<{ type: AssemblyTypeEnum; count: number }>,
  hasOutfitFont: boolean,
  opts: LegendOptions,
): number {
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';
  const rowH = opts.rowHeight ?? 5;
  const cols = opts.columns ?? 2;
  const colW = opts.width / cols;

  doc.setFont(font, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(DF_BRAND_COLORS.navy);
  doc.text('ASSEMBLY LEGEND', opts.x, opts.y);
  doc.setDrawColor(DF_BRAND_COLORS.cashmere);
  doc.setLineWidth(0.4);
  doc.line(opts.x, opts.y + 1.5, opts.x + opts.width, opts.y + 1.5);

  doc.setFont(font, 'normal');
  doc.setFontSize(7);
  let top = opts.y + 6;
  for (let i = 0; i < entries.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = opts.x + col * colW;
    const cy = top + row * rowH;
    const entry = entries[i];
    const colour = ASSEMBLY_COLOURS[entry.type] ?? ASSEMBLY_COLOUR_FALLBACK;

    // Swatch.
    doc.setFillColor(colour);
    doc.setDrawColor('#c5c0b8');
    doc.setLineWidth(0.15);
    doc.rect(cx, cy - 2.5, 3, 3, 'FD');

    // Label + count.
    doc.setTextColor('#333333');
    const label = ASSEMBLY_DISPLAY_NAMES[entry.type] ?? entry.type;
    doc.text(`${label} · ${entry.count}`, cx + 4, cy);
  }
  const rowsUsed = Math.ceil(entries.length / cols);
  return top + rowsUsed * rowH;
}

// ---------------------------------------------------------------------------
// Assembly banner — compact coloured pill painted at the top-left of
// a cabinet detail sheet to give the assembly a visual identity that
// matches the legend on the contents page.
//
// Sits in the top-left of the content area (outside the title block's
// footprint) so it doesn't shift the existing detail body layout.
// ---------------------------------------------------------------------------

export function drawAssemblyBanner(
  doc: jsPDF,
  assemblyType: string,
  partCount: number,
  hasOutfitFont: boolean,
  opts: { x: number; y: number; maxWidth?: number } = { x: 14, y: 15 },
): void {
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';
  const colour = ASSEMBLY_COLOURS[assemblyType] ?? ASSEMBLY_COLOUR_FALLBACK;
  const label = ASSEMBLY_DISPLAY_NAMES[assemblyType as AssemblyTypeEnum] ?? assemblyType;

  const height = 5;
  const text = `${label.toUpperCase()} · ${partCount} ${partCount === 1 ? 'PART' : 'PARTS'}`;

  doc.setFont(font, 'bold');
  doc.setFontSize(7);
  const textWidth = doc.getTextWidth(text);
  const padding = 3;
  const width = Math.min(opts.maxWidth ?? 80, textWidth + padding * 2 + 5);

  // Pill body.
  doc.setFillColor(colour);
  doc.setDrawColor(colour);
  doc.setLineWidth(0.15);
  doc.roundedRect(opts.x, opts.y, width, height, 1, 1, 'F');

  // Text — white for legibility on the saturated pill.
  doc.setTextColor('#ffffff');
  doc.text(text, opts.x + padding, opts.y + 3.5);
}

// ---------------------------------------------------------------------------
// Assembly inventory sheet — project-wide table of every assembly with
// colour dot, type, parent cabinet, part count, dwg reference. Acts as
// the drawing-to-assembly navigation index: "where's the detail page
// for the drawer boxes? → C02-I203".
// ---------------------------------------------------------------------------

export interface AssemblyInventoryRow {
  /** Cabinet reference (e.g. "C01"). */
  cabinetRef: string;
  /** Human cabinet label (e.g. "KB-A — Kitchen Base"). */
  cabinetLabel: string;
  /** AssemblyTypeEnum string. */
  assemblyType: string;
  /** Display title (from SceneAssembly.displayName or the grouper). */
  assemblyTitle: string;
  /** Parts count in the assembly. */
  partCount: number;
  /** Target detail drawing number, when computable (e.g. "C01-I201"). */
  detailDrawing?: string;
}

export function drawAssemblyInventorySheet(
  doc: jsPDF,
  config: PrintPackageConfig,
  rows: ReadonlyArray<AssemblyInventoryRow>,
  hasOutfitFont: boolean,
  logoBase64?: string,
  logoFormat?: 'PNG' | 'JPEG',
  sheetNumber: string = SHEET_NUMBERING.assemblyInventory ?? 'I003',
): number {
  const font = hasOutfitFont ? 'Outfit' : 'helvetica';
  openSheet(doc, config, 'Assembly Inventory', sheetNumber, hasOutfitFont, logoBase64, logoFormat);

  if (rows.length === 0) {
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DF_BRAND_COLORS.navy);
    doc.text('No assemblies have been authored in this scene yet.', MARGIN + 4, 40);
    return 1;
  }

  // Group summary — quick headline above the table.
  const totalAssemblies = rows.length;
  const totalParts = rows.reduce((s, r) => s + r.partCount, 0);
  const uniqueTypes = new Set(rows.map(r => r.assemblyType)).size;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(DF_BRAND_COLORS.navy);
  doc.text(
    `${totalAssemblies} assembl${totalAssemblies === 1 ? 'y' : 'ies'} · ${uniqueTypes} type${uniqueTypes === 1 ? '' : 's'} · ${totalParts} parts across every cabinet in this scene.`,
    MARGIN + 4,
    28,
  );

  autoTable(doc, {
    startY: 34,
    margin: { left: MARGIN + 4, right: MARGIN + 4 },
    head: [['#', '', 'Type', 'Assembly', 'Cabinet', 'Parts', 'Drawing']],
    body: rows.map((r, i) => [
      String(i + 1),
      '',                                         // colour swatch painted in didDrawCell
      ASSEMBLY_DISPLAY_NAMES[r.assemblyType as AssemblyTypeEnum] ?? r.assemblyType,
      r.assemblyTitle,
      `${r.cabinetRef} · ${r.cabinetLabel}`,
      String(r.partCount),
      r.detailDrawing ?? '—',
    ]),
    styles: { font, fontSize: 8, cellPadding: 1.5, valign: 'middle' },
    headStyles: {
      fillColor: DF_BRAND_COLORS.boysenberry,
      textColor: '#ffffff',
      font,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: '#f8f9fa' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'right' },
      1: { cellWidth: 8 },
      2: { cellWidth: 38 },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 24, font: 'courier' },
    },
    didDrawCell: (data) => {
      // Paint the colour swatch in column 1 for body rows.
      if (data.section !== 'body' || data.column.index !== 1) return;
      const row = rows[data.row.index];
      if (!row) return;
      const colour = ASSEMBLY_COLOURS[row.assemblyType] ?? ASSEMBLY_COLOUR_FALLBACK;
      const pad = 2;
      doc.setFillColor(colour);
      doc.setDrawColor('#c5c0b8');
      doc.setLineWidth(0.15);
      doc.rect(data.cell.x + pad, data.cell.y + pad, data.cell.width - pad * 2, data.cell.height - pad * 2, 'FD');
    },
  });

  return 1;
}

/**
 * Build inventory rows from a list of cabinet inputs. Pure — call-site
 * passes the cabinet label + per-cabinet assembly list; we flatten
 * and compute the detail drawing reference from the assembly index
 * within the cabinet.
 */
export function buildAssemblyInventoryRows(
  cabinets: ReadonlyArray<{
    cabinetRef: string;
    cabinetLabel: string;
    assemblies: ReadonlyArray<{ assemblyType: string; displayName: string; partCount: number }>;
  }>,
): AssemblyInventoryRow[] {
  const rows: AssemblyInventoryRow[] = [];
  for (const cab of cabinets) {
    cab.assemblies.forEach((asm, i) => {
      rows.push({
        cabinetRef: cab.cabinetRef,
        cabinetLabel: cab.cabinetLabel,
        assemblyType: asm.assemblyType,
        assemblyTitle: asm.displayName || asm.assemblyType,
        partCount: asm.partCount,
        detailDrawing: SHEET_NUMBERING.partDetail
          ? `${cab.cabinetRef}-${SHEET_NUMBERING.partDetail(i + 1)}`
          : undefined,
      });
    });
  }
  return rows;
}
