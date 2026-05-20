/**
 * Print Package Service — PDF Generation Orchestrator
 * Generates A3 landscape PDF using jsPDF with DF-Style 1 title block.
 *
 * Sheet sequence: I001 cover, I100 isometric SW, I101 front, I102 rear,
 * I103 plan, I104 three-view, I2xx assembly/part details, I301 cut list
 *
 * Key features:
 * - Proper dimension lines with extension lines, tick marks, and labels
 * - Chain dimensions for intermediate measurements (Tier 2/3)
 * - Assembly-based part detail sheets (not per-leaf-node)
 * - Isometric SW view as first drawing sheet
 * - Consistent Outfit font throughout
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ParsedModel,
  CutListEntry,
  PrintPackageConfig,
  PartTreeNode,
  MeshCutListLink,
  DimensionSet,
  ViewDirection,
  ProjectedEdge,
  BoundingBox3D,
  AssemblyGroup,
} from '../types/workshop-viewer.types';
import {
  A3_DIMENSIONS,
  SHEET_NUMBERING,
  DIMENSION_COLORS,
  DIMENSION_TEXT,
  DF_BRAND_COLORS,
} from '../constants/workshop-viewer.constants';
import { extractSilhouetteEdges } from '../utils/silhouetteExtractor';
import { createProjectedView } from '../utils/projectionUtils';
import { computeBoundingBox, selectBestView, mergeBoundingBoxes } from './geometryEngine';
import { classifyEdgeVisibility, classifyWithRaycaster, generateProjectedEdges, VIEW_DIRECTIONS } from './hiddenLineEngine';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { drawTitleBlock, loadOutfitFont, loadISOFont, fetchLogoAsBase64 } from '../utils/titleBlockRenderer';
import { processWithAI } from './aiPrintProcessor';
import { suggestAssemblyGroups } from './assemblyEngine';
import { drawAssemblyBanner } from './sceneScheduleSheets';

const { margin: M } = A3_DIMENSIONS;
const CONTENT_LEFT = M;
const CONTENT_TOP = M;
const CONTENT_WIDTH = A3_DIMENSIONS.contentWidth;
const CONTENT_HEIGHT = A3_DIMENSIONS.contentHeight;

// Dimension tier offsets from model edge (mm in PDF space)
const DIM_TIER_1_OFFSET = 14;
const DIM_TIER_2_OFFSET = 8;
const DIM_TIER_3_OFFSET = 4;
const DIM_TICK_SIZE = 1.5; // mm — tick mark half-length
const DIM_EXT_GAP = 1;     // mm — gap between model edge and extension line start
const DIM_LABEL_SIZES: Record<string, Record<number, number>> = {
  A3: { 1: 10, 2: 8, 3: 7 },
  A4: { 1: 8, 2: 6.5, 3: 5.5 },
};
let currentPaperSize: 'A3' | 'A4' = 'A3';
let currentDimFont: string = 'helvetica';
const DIM_TEXT_SIZE = 9;    // pt — fallback for artisan readability

export interface GenerationProgress {
  phase: string;
  percent: number;
}

// ─── Two-pass edge rendering helpers ─────────────────────────────────────────

function setDocAlpha(doc: jsPDF, alpha: number): void {
  try {
    // @ts-ignore — jsPDF GState
    const gs = (doc as any).GState({ opacity: alpha, 'stroke-opacity': alpha });
    (doc as any).setGState(gs);
  } catch {
    // GState not available — ignore
  }
}

export function drawBufferGeometryLines(
  doc: jsPDF,
  geometry: import('three').BufferGeometry,
  offsetX: number,
  offsetY: number,
  scale: number,
  flipY: boolean,
): void {
  const positions = geometry.getAttribute('position');
  if (!positions || positions.count === 0) return;
  for (let i = 0; i < positions.count; i += 2) {
    const x1 = offsetX + positions.getX(i) * scale;
    const screenY1 = flipY
      ? offsetY - positions.getZ(i) * scale
      : offsetY + positions.getZ(i) * scale;
    const x2 = offsetX + positions.getX(i + 1) * scale;
    const screenY2 = flipY
      ? offsetY - positions.getZ(i + 1) * scale
      : offsetY + positions.getZ(i + 1) * scale;
    doc.line(x1, screenY1, x2, screenY2);
  }
}

/** Build a THREE.Group from ParsedModel for BVH projection (PolyBoard Z-up coords preserved). */
function buildModelGroup(model: ParsedModel): THREE.Group {
  const group = new THREE.Group();
  for (const obj of model.objects) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(obj.vertices.slice(), 3));
    geom.setIndex(new THREE.BufferAttribute(
      obj.faces instanceof Uint32Array ? new Uint32Array(obj.faces) :
      obj.faces.length <= 65535 ? new Uint16Array(obj.faces) : new Uint32Array(obj.faces),
      1,
    ));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom);
    mesh.name = obj.name;
    group.add(mesh);
  }
  // For GLB models, auto-scale meters → mm if model is small
  if (model.source === 'glb') {
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim < 100) {
      group.scale.setScalar(1000);
      group.updateMatrixWorld(true);
    }
  }
  return group;
}

async function buildModelGroupFromGlb(buffer: ArrayBuffer): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buffer, '', (gltf) => {
      const group = new THREE.Group();
      group.add(gltf.scene);
      // Auto-scale meters → mm
      const box = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim < 100) {
        group.scale.setScalar(1000);
        group.updateMatrixWorld(true);
      }
      resolve(group);
    }, reject);
  });
}

/** BVH output is in XZ plane. flipY=true for views where Z-up = screen-up (ortho elevation views). */
function bvhFlipY(view: string): boolean {
  return view !== 'top' && view !== 'bottom' && !view.startsWith('iso');
}

// ── BVH ISO projection helpers (corrected rotation) ────────────────────────
// The BVH projects along -Y after a quaternion rotation. This produces accurate
// visible/hidden edges but the Z-axis (height) maps to a TILTED direction in
// BVH XZ space — making the cabinet look "fallen over".
//
// Fix: compute a 2D correction rotation angle so that the Z-axis projects
// VERTICALLY in the corrected space. All BVH XZ points are counter-rotated
// by this angle before mapping to the page. This keeps BVH accuracy while
// giving the standard 30-30-90 isometric look with upright vertical edges.

/** Compute the BVH alignment quaternion (rotates viewDir → -Y projection axis). */
function getBvhQuaternion(direction: string): THREE.Quaternion {
  const viewDir = VIEW_DIRECTIONS[direction];
  if (!viewDir) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(
    viewDir.clone().normalize(),
    new THREE.Vector3(0, -1, 0),
  );
}

/**
 * Compute the 2D correction angle so that the world Z-axis (height) projects
 * to perfectly vertical in corrected BVH XZ space.
 */
function getBvhCorrectionAngle(bvhQuat: THREE.Quaternion): number {
  // Project world Z-axis (0,0,1) through the BVH quaternion
  const zUp = new THREE.Vector3(0, 0, 1).applyQuaternion(bvhQuat);
  // In BVH XZ space: (zUp.x, zUp.z). We want this to point straight up (+Z).
  // The 2D rotation x'=x*cosθ-z*sinθ zeros the X component when θ = atan2(x, z).
  // (No negation — the rotation formula already rotates TOWARD +Z.)
  return Math.atan2(zUp.x, zUp.z);
}

/** Project a 3D point through BVH quaternion + 2D correction rotation → corrected XZ. */
function bvhProjectCorrected(
  pt: { x: number; y: number; z: number },
  quat: THREE.Quaternion,
  cosA: number, sinA: number,
): { x: number; z: number } {
  const v = new THREE.Vector3(pt.x, pt.y, pt.z).applyQuaternion(quat);
  // 2D rotation in XZ plane
  return {
    x: v.x * cosA - v.z * sinA,
    z: v.x * sinA + v.z * cosA,
  };
}

/**
 * Apply 2D correction rotation to BVH geometry positions IN PLACE.
 * After this, getX/getZ return corrected coordinates where Z-axis is vertical.
 */
function correctBvhGeometry(
  geom: THREE.BufferGeometry,
  cosA: number, sinA: number,
): void {
  const pos = geom.getAttribute('position');
  if (!pos) return;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setX(i, x * cosA - z * sinA);
    pos.setZ(i, x * sinA + z * cosA);
  }
}

/**
 * Compute a page ViewTransform for corrected BVH ISO coordinate space.
 * Scans all edge 3D endpoints through the BVH quaternion + 2D correction
 * to determine bounds, then fits to the given page area.
 */
function computeBvhIsoTransform(
  allEdges: ProjectedEdge[],
  bvhQuat: THREE.Quaternion,
  cosA: number, sinA: number,
  areaX: number, areaY: number, areaW: number, areaH: number,
): ViewTransform {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const edge of allEdges) {
    for (const pt of [edge.a3d, edge.b3d]) {
      const p = bvhProjectCorrected(pt, bvhQuat, cosA, sinA);
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }
  }
  if (!isFinite(minX)) {
    return { scale: 1, offsetX: areaX, offsetY: areaY, bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 } };
  }
  const bounds = { minX, minY: minZ, maxX, maxY: maxZ };
  const viewW = maxX - minX;
  const viewH = maxZ - minZ;
  if (viewW === 0 || viewH === 0) return { scale: 1, offsetX: areaX, offsetY: areaY, bounds };

  const scaleX = areaW / viewW;
  const scaleY = areaH / viewH;
  const scale = Math.min(scaleX, scaleY) * 0.85;

  return {
    scale,
    offsetX: areaX + (areaW - viewW * scale) / 2 - minX * scale,
    offsetY: areaY + (areaH - viewH * scale) / 2 + maxZ * scale, // Y-flip: maxZ → top of area
    bounds,
  };
}

// ── Label collision avoidance state ──
let drawnLabelRects: Array<{x: number; y: number; w: number; h: number}> = [];
function resetLabelRects() { drawnLabelRects = []; }

function resolveCollision(rect: {x: number; y: number; w: number; h: number}): {x: number; y: number} {
  for (const prev of drawnLabelRects) {
    const overlapX = rect.x < prev.x + prev.w && rect.x + rect.w > prev.x;
    const overlapY = rect.y < prev.y + prev.h && rect.y + rect.h > prev.y;
    if (overlapX && overlapY) {
      // Shift down by the overlap amount + 1mm gap
      rect.y = prev.y + prev.h + 1;
    }
  }
  drawnLabelRects.push({ ...rect });
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

// Shared font helper
function getFont(hasOutfit: boolean): string {
  return hasOutfit ? 'Outfit' : 'helvetica';
}

/**
 * Draw a dimension label with a white pill background for legibility.
 */
function drawDimensionLabel(
  doc: jsPDF, _font: string,
  text: string, x: number, y: number,
  color: string, fontSize: number,
  align: 'center' | 'left' = 'center',
  _angle?: number,
  tier: 1 | 2 | 3 = 1,
) {
  const effectiveSize = DIM_LABEL_SIZES[currentPaperSize]?.[tier] || fontSize;
  // Use ISOCPEUR (ISO 3098 technical lettering) for dimensions
  doc.setFont(currentDimFont, 'bold');
  doc.setFontSize(effectiveSize);
  const tw = doc.getTextWidth(text);
  const pad = DIMENSION_TEXT.pillPadX;
  const padY = DIMENSION_TEXT.pillPadY;
  const h = effectiveSize * 0.4 + padY * 2; // approximate text height in mm
  const w = tw + pad * 2;

  // Compute pill rect position
  let rx = align === 'center' ? x - tw / 2 - pad : x - pad;
  let ry = y - h / 2;

  // Collision avoidance — shift if overlapping a previously drawn label
  const resolved = resolveCollision({ x: rx, y: ry, w, h });
  rx = resolved.x - w / 2;
  ry = resolved.y - h / 2;
  const labelX = align === 'center' ? resolved.x : rx + pad;
  const labelY = resolved.y;

  // White pill background
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rx, ry, w, h, DIMENSION_TEXT.pillRadius, DIMENSION_TEXT.pillRadius, 'F');

  // Colored text on top
  doc.setTextColor(color);
  doc.text(text, labelX, labelY, { align, baseline: 'middle' });
}

/**
 * Shared per-document context produced by `preparePackageContext`.
 * Holds the jsPDF doc, loaded fonts, and optional logo so callers
 * (Quick Review single-model export OR scene multi-cabinet export)
 * can reuse the same doc across multiple `appendCabinetSheets` calls.
 */
export interface PackageContext {
  doc: jsPDF;
  pdfFormat: 'a3' | 'a4';
  orientation: 'portrait' | 'landscape';
  hasOutfit: boolean;
  hasISOFont: boolean;
  font: string;
  logoBase64?: string;
  logoFormat?: 'PNG' | 'JPEG';
}

/**
 * Prepare a fresh jsPDF document with fonts loaded and logo fetched.
 * Side effect: updates module-level `currentPaperSize` / `currentDimFont`
 * so dimension drawing uses the right font metrics.
 */
export async function preparePackageContext(
  config: PrintPackageConfig,
  logoUrl: string | undefined,
  onProgress?: (progress: GenerationProgress) => void,
): Promise<PackageContext> {
  currentPaperSize = config.paperSize || 'A3';
  const pdfFormat: 'a3' | 'a4' = currentPaperSize === 'A4' ? 'a4' : 'a3';
  const orientation: 'portrait' | 'landscape' = config.orientation || 'landscape';

  const doc = new jsPDF({ orientation, unit: 'mm', format: pdfFormat });

  onProgress?.({ phase: 'Loading fonts', percent: 5 });
  const hasOutfit = await loadOutfitFont(doc);
  const hasISOFont = await loadISOFont(doc);
  const font = getFont(hasOutfit);
  currentDimFont = hasISOFont ? 'ISOCPEUR' : 'helvetica';

  let logoBase64: string | undefined;
  let logoFormat: 'PNG' | 'JPEG' | undefined;
  if (logoUrl) {
    onProgress?.({ phase: 'Loading logo', percent: 7 });
    const logoData = await fetchLogoAsBase64(logoUrl);
    if (logoData) {
      logoBase64 = logoData.base64;
      logoFormat = logoData.format;
    }
  }

  return { doc, pdfFormat, orientation, hasOutfit, hasISOFont, font, logoBase64, logoFormat };
}

/**
 * Append one cabinet/model's worth of sheets onto an already-prepared
 * PackageContext. Returns the page index after appending. Shared between
 * Quick Review's single-model export and scene-level multi-cabinet export.
 */
export async function appendCabinetSheets(
  ctx: PackageContext,
  model: ParsedModel,
  cutList: CutListEntry[],
  config: PrintPackageConfig,
  partTree: PartTreeNode[],
  _meshLinks: MeshCutListLink[],
  dimensions: DimensionSet,
  startPageIndex: number,
  onProgress?: (progress: GenerationProgress) => void,
  confirmedGroups?: AssemblyGroup[],
): Promise<number> {
  if (!Array.isArray(cutList)) cutList = [];

  const { doc, pdfFormat, font, hasOutfit, logoBase64, logoFormat } = ctx;
  let pageIndex = startPageIndex;

  // Ensure module-level paper size matches this call — important when the
  // same ctx is reused across cabinets with the same config.
  currentPaperSize = config.paperSize || 'A3';

  // AI-enhanced dimension and visibility processing
  onProgress?.({ phase: 'AI analysis', percent: 8 });
  let enhancedDimensions = dimensions;
  try {
    const aiResult = await processWithAI(
      model, cutList, partTree, dimensions,
      (phase) => onProgress?.({ phase: `AI: ${phase}`, percent: 9 }),
    );
    enhancedDimensions = aiResult.enhancedDimensions;
    console.log(`AI processing complete in ${aiResult.meta.processingTimeMs}ms (${aiResult.meta.aiModel}, confidence: ${aiResult.meta.confidence})`);
  } catch (err) {
    console.warn('AI processing skipped, using deterministic dimensions:', err);
    onProgress?.({ phase: 'Dimensions (deterministic)', percent: 9 });
  }

  onProgress?.({ phase: 'Extracting geometry', percent: 10 });
  // For GLB/organic meshes, use a much stricter angle threshold (60°) to reduce edge noise
  const isGlb = model.source === 'glb';
  const edgeThreshold = isGlb ? 0.5 : 0.95;
  const allEdges = model.objects.flatMap(obj =>
    extractSilhouetteEdges(obj.vertices, obj.faces, obj.name, edgeThreshold)
  );
  const partBboxes = model.objects.map(obj => ({
    partName: obj.name,
    bbox: computeBoundingBox(obj.vertices),
  }));

  // ── Pre-compute BVH edge projections for all main views ──
  onProgress?.({ phase: 'BVH edge projection', percent: 11 });
  const bvhGeometries = new Map<string, THREE.BufferGeometry | null>();
  const modelGroup = (isGlb && model.glbBuffer)
    ? await buildModelGroupFromGlb(model.glbBuffer)
    : buildModelGroup(model);
  for (const viewKey of ['front', 'back', 'right', 'top', 'iso', 'iso_ne'] as const) {
    try {
      const result = await generateProjectedEdges(modelGroup, viewKey);
      bvhGeometries.set(viewKey, result.visibleGeometry);
    } catch (err) {
      console.warn(`[BVH] Failed for view "${viewKey}":`, err);
      bvhGeometries.set(viewKey, null);
    }
  }

  // Helper to draw title block on every sheet. Applies `sheetPrefix` (used
  // by scene export to keep sheet numbers unique across cabinets) and
  // `itemLabel` (used by scene export so the title block shows the cabinet
  // subject without polluting the project name).
  const prefix = config.sheetPrefix ?? '';
  const subjectLabel = config.itemLabel;
  const tb = (title: string, dwgNum: string) => {
    const fullTitle = subjectLabel ? `${subjectLabel} — ${title}` : title;
    drawTitleBlock(doc, config.projectInfo, fullTitle, `${prefix}${dwgNum}`, hasOutfit, logoBase64, logoFormat, config.paperSize);
  };

  // ── COVER (I001) ──
  if (config.includeSheets.cover) {
    onProgress?.({ phase: 'Cover sheet', percent: 12 });
    if (pageIndex > 0) doc.addPage(pdfFormat, 'landscape');
    drawCoverSheet(doc, config, enhancedDimensions, font, logoBase64, logoFormat, hasOutfit);
    pageIndex++;

    // ── CONTENTS & CABINET SUMMARY (I002) — always follows cover ──
    onProgress?.({ phase: 'Contents & summary', percent: 14 });
    doc.addPage(pdfFormat, 'landscape');
    drawContentsSheet(doc, config, model, enhancedDimensions, partTree, cutList, font, tb);
    pageIndex++;
  }

  // Compute overall 3D bbox from all parts (needed for iso dimension alignment)
  const overallBbox3D = mergeBoundingBoxes(partBboxes.map(pb => pb.bbox));

  // ── ISOMETRIC SW VIEW (I1100) ──
  if (config.includeSheets.isometricView) {
    onProgress?.({ phase: 'Isometric SW view', percent: 18 });
    if (pageIndex > 0) doc.addPage(pdfFormat, 'landscape');
    drawIsometricSheet(doc, allEdges, partBboxes, config, enhancedDimensions, font, tb, overallBbox3D, 'sw', bvhGeometries.get('iso') ?? null);
    pageIndex++;

    // ── ISOMETRIC NE VIEW (I1101) ──
    onProgress?.({ phase: 'Isometric NE view', percent: 22 });
    doc.addPage(pdfFormat, 'landscape');
    drawIsometricSheet(doc, allEdges, partBboxes, config, enhancedDimensions, font, tb, overallBbox3D, 'ne', bvhGeometries.get('iso_ne') ?? null);
    pageIndex++;
  }

  // ── FRONT ELEVATION (I101) ──
  if (config.includeSheets.frontElevation) {
    onProgress?.({ phase: 'Front elevation', percent: 25 });
    if (pageIndex > 0) doc.addPage(pdfFormat, 'landscape');
    drawElevationSheet(doc, 'front', 'Front Elevation', SHEET_NUMBERING.frontElevation,
      allEdges, partBboxes, config, enhancedDimensions, font, tb, bvhGeometries.get('front') ?? null, modelGroup);
    pageIndex++;
  }

  // ── REAR ELEVATION (I102) ──
  if (config.includeSheets.rearElevation) {
    onProgress?.({ phase: 'Rear elevation', percent: 35 });
    if (pageIndex > 0) doc.addPage(pdfFormat, 'landscape');
    drawElevationSheet(doc, 'back', 'Rear Elevation', SHEET_NUMBERING.rearElevation,
      allEdges, partBboxes, config, enhancedDimensions, font, tb, bvhGeometries.get('back') ?? null, modelGroup);
    pageIndex++;
  }

  // ── PLAN VIEW (I103) ──
  if (config.includeSheets.planView) {
    onProgress?.({ phase: 'Plan view', percent: 45 });
    if (pageIndex > 0) doc.addPage(pdfFormat, 'landscape');
    drawElevationSheet(doc, 'top', 'Plan View', SHEET_NUMBERING.planView,
      allEdges, partBboxes, config, enhancedDimensions, font, tb, bvhGeometries.get('top') ?? null, modelGroup);
    pageIndex++;
  }

  // ── THREE-VIEW (I104) ──
  if (config.includeSheets.threeView) {
    onProgress?.({ phase: 'Three-view', percent: 55 });
    if (pageIndex > 0) doc.addPage(pdfFormat, 'landscape');
    drawThreeViewSheet(doc, allEdges, partBboxes, config, enhancedDimensions, font, tb, bvhGeometries, modelGroup);
    pageIndex++;
  }

  // ── ASSEMBLY / PART DETAIL SHEETS ──
  // Both assemblyExploded and partDetails use the same detail group rendering.
  // Generate one set of sheets from whichever is checked (avoid duplicating if both are on).
  {
    const wantAssembly = config.includeSheets.assemblyExploded;
    const wantPartDetails = config.includeSheets.partDetails;
    if ((wantAssembly || wantPartDetails) && partTree.length > 0) {
      onProgress?.({ phase: 'Assembly & detail sheets', percent: 52 });
      const detailGroups = buildDetailGroups(partTree, cutList, confirmedGroups);
      const sheetLabel = wantAssembly ? 'Assembly' : 'Detail';
      for (let i = 0; i < detailGroups.length; i++) {
        onProgress?.({ phase: `${sheetLabel} ${i + 1}/${detailGroups.length}`, percent: 55 + (i / detailGroups.length) * 20 });
        if (pageIndex > 0) doc.addPage(pdfFormat, 'landscape');
        drawDetailSheet(doc, detailGroups[i], model, cutList,
          SHEET_NUMBERING.partDetail(i + 1), config, font, tb);
        pageIndex++;
      }
    }
  }

  // ── CUT LIST (I301) ──
  if (config.includeSheets.cutList) {
    onProgress?.({ phase: 'Cut list', percent: 80 });
    if (pageIndex > 0) doc.addPage(pdfFormat, 'landscape');
    drawCutListSheet(doc, cutList, config, font, tb);
    pageIndex++;
  }

  return pageIndex;
}

/**
 * Quick Review entry point — backwards-compatible single-model export.
 * Thin wrapper over `preparePackageContext` + `appendCabinetSheets`.
 */
export async function generatePrintPackage(
  model: ParsedModel,
  cutList: CutListEntry[],
  config: PrintPackageConfig,
  partTree: PartTreeNode[],
  meshLinks: MeshCutListLink[],
  dimensions: DimensionSet,
  onProgress?: (progress: GenerationProgress) => void,
  logoUrl?: string,
  confirmedGroups?: AssemblyGroup[],
): Promise<Blob> {
  const ctx = await preparePackageContext(config, logoUrl, onProgress);
  await appendCabinetSheets(
    ctx, model, cutList, config, partTree, meshLinks, dimensions,
    0, onProgress, confirmedGroups,
  );
  onProgress?.({ phase: 'Complete', percent: 100 });
  return ctx.doc.output('blob');
}

// Type for the title block helper
export type TitleBlockFn = (title: string, dwgNum: string) => void;

// ============================================================================
// COVER SHEET
// ============================================================================

export function drawCoverSheet(
  doc: jsPDF, config: PrintPackageConfig, dimensions: DimensionSet,
  font: string, logoBase64?: string, logoFormat?: 'PNG' | 'JPEG', _hasOutfitFont?: boolean,
) {
  // Page border only (no title block on cover)
  doc.setDrawColor(DF_BRAND_COLORS.separator);
  doc.setLineWidth(0.25);
  doc.rect(M, M, A3_DIMENSIONS.width - 2 * M, A3_DIMENSIONS.height - 2 * M);

  const cx = A3_DIMENSIONS.width / 2;
  const cy = A3_DIMENSIONS.height / 2;
  const boy = DF_BRAND_COLORS.boysenberry;
  const navy = DF_BRAND_COLORS.navy;

  // ── Logo or Brand name (centered vertically above title) ──
  let logoBottom = cy - 50;
  if (logoBase64 && logoFormat) {
    const logoH = 24;
    const logoW = logoH * 2.5;
    try {
      doc.addImage(logoBase64, logoFormat, cx - logoW / 2, logoBottom - logoH, logoW, logoH);
    } catch {
      doc.setFont(font, 'bold');
      doc.setFontSize(12);
      doc.setTextColor(boy);
      doc.text('DAWIN FINISHES', cx, logoBottom - 6, { align: 'center' });
    }
  } else {
    doc.setFont(font, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(boy);
    doc.text('DAWIN FINISHES', cx, logoBottom - 6, { align: 'center' });
  }

  // ── Title ──
  doc.setFont(font, 'bold');
  doc.setFontSize(42);
  doc.setTextColor(boy);
  doc.text('SHOP DRAWINGS', cx, cy - 18, { align: 'center' });

  // ── Cashmere divider ──
  doc.setDrawColor(DF_BRAND_COLORS.cashmere);
  doc.setLineWidth(1.5);
  doc.line(cx - 50, cy - 8, cx + 50, cy - 8);

  // ── Project code ──
  doc.setFont(font, 'bold');
  doc.setFontSize(28);
  doc.setTextColor(navy);
  doc.text(config.projectInfo.projectNo || config.projectInfo.projectName, cx, cy + 8, { align: 'center' });

  // ── Project name (if different from code) ──
  let infoY = cy + 22;
  if (config.projectInfo.projectNo && config.projectInfo.projectName !== config.projectInfo.projectNo) {
    doc.setFont(font, 'normal');
    doc.setFontSize(16);
    doc.setTextColor(navy);
    doc.text(config.projectInfo.projectName, cx, infoY, { align: 'center' });
    infoY += 14;
  }

  // ── Client ──
  if (config.projectInfo.client) {
    doc.setFont(font, 'normal');
    doc.setFontSize(14);
    doc.setTextColor('#666666');
    doc.text(config.projectInfo.client, cx, infoY, { align: 'center' });
    infoY += 12;
  }

  // ── Address ──
  if (config.projectInfo.address) {
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor('#888888');
    doc.text(config.projectInfo.address, cx, infoY, { align: 'center' });
    infoY += 14;
  }

  // ── Stats row (Overall Dimensions) ──
  const statsY = infoY + 5;
  const statW = 65;
  const statH = 28;
  const statGap = 8;
  const stats = [
    { label: 'WIDTH', value: `${Math.round(dimensions.overall.width)}`, unit: 'mm' },
    { label: 'DEPTH', value: `${Math.round(dimensions.overall.depth)}`, unit: 'mm' },
    { label: 'HEIGHT', value: `${Math.round(dimensions.overall.height)}`, unit: 'mm' },
  ];
  const totalStatsW = stats.length * statW + (stats.length - 1) * statGap;
  let statX = cx - totalStatsW / 2;

  for (const stat of stats) {
    doc.setFillColor('#F8F6F2');
    doc.roundedRect(statX, statsY, statW, statH, 3, 3, 'F');
    doc.setFont(font, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(boy);
    doc.text(stat.value, statX + statW / 2, statsY + 12, { align: 'center' });
    doc.setFont(font, 'normal');
    doc.setFontSize(7);
    doc.setTextColor('#888888');
    doc.text(`${stat.label} (${stat.unit})`, statX + statW / 2, statsY + 22, { align: 'center' });
    statX += statW + statGap;
  }

  // ── Footer ──
  doc.setFont(font, 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#AAAAAA');
  doc.text(`${config.projectInfo.date}  \u00B7  ${config.projectInfo.stage}`, cx, A3_DIMENSIONS.height - M - 5, { align: 'center' });
}

// ============================================================================
// CONTENTS & CABINET SUMMARY (I002)
// ============================================================================

export function drawContentsSheet(
  doc: jsPDF, config: PrintPackageConfig, model: ParsedModel,
  dimensions: DimensionSet, partTree: PartTreeNode[],
  cutList: CutListEntry[], font: string, tb: TitleBlockFn,
) {
  tb('Contents & Cabinet Summary', SHEET_NUMBERING.contentsLegend);

  const navy = DF_BRAND_COLORS.navy;
  const left = CONTENT_LEFT + 8;
  const colWidth = CONTENT_WIDTH - 16;

  // ── CABINET SUMMARY ──
  let y = CONTENT_TOP + 10;
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(navy);
  doc.text('CABINET SUMMARY', left, y);
  y += 8;

  // Separator
  doc.setDrawColor(DF_BRAND_COLORS.cashmere);
  doc.setLineWidth(0.5);
  doc.line(left, y, left + colWidth, y);
  y += 6;

  // Summary details
  const totalParts = model.objects.length;
  const uniquePartNames = new Set(model.objects.map(o => o.name.replace(/\s+\d+$/, '').trim()));
  const uniqueMaterials = new Set(model.objects.map(o => o.material).filter(Boolean));
  const assemblies = partTree.filter(n => !n.isLeaf);
  const cutEntryCount = cutList.length;

  const summaryRows = [
    { label: 'Item', value: config.projectInfo.projectName },
    { label: 'Overall Dimensions', value: `${Math.round(dimensions.overall.width)} \u00D7 ${Math.round(dimensions.overall.depth)} \u00D7 ${Math.round(dimensions.overall.height)} mm (W \u00D7 D \u00D7 H)` },
    { label: 'Total Components', value: `${totalParts} mesh objects, ${uniquePartNames.size} unique part types` },
    { label: 'Materials', value: `${uniqueMaterials.size} materials used` },
    { label: 'Assemblies', value: `${assemblies.length} assemblies detected` },
    { label: 'Cut List Entries', value: cutEntryCount > 0 ? `${cutEntryCount} parts` : 'No CSV loaded' },
    { label: 'Drawn By', value: config.projectInfo.drawnBy || '\u2014' },
    { label: 'Checked By', value: config.projectInfo.checkedBy || '\u2014' },
    { label: 'Revision', value: config.projectInfo.revision || 'A' },
  ];

  for (const row of summaryRows) {
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.setTextColor('#888888');
    doc.text(row.label.toUpperCase(), left, y);
    doc.setFont(font, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(navy);
    doc.text(row.value, left + 60, y);
    y += 8;
  }

  // ── DRAWING INDEX ──
  y += 10;
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(navy);
  doc.text('DRAWING INDEX', left, y);
  y += 8;

  doc.setDrawColor(DF_BRAND_COLORS.cashmere);
  doc.setLineWidth(0.5);
  doc.line(left, y, left + colWidth, y);
  y += 6;

  // Table header
  doc.setFont(font, 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#666666');
  doc.text('DWG NO.', left, y);
  doc.text('TITLE', left + 30, y);
  doc.text('DESCRIPTION', left + 120, y);
  y += 3;
  doc.setDrawColor('#DDDDDD');
  doc.setLineWidth(0.2);
  doc.line(left, y, left + colWidth, y);
  y += 6;

  const sheetList = [
    { num: 'I001', title: 'Cover', desc: 'Project title, client, overall dimensions' },
    { num: 'I002', title: 'Contents & Summary', desc: 'This page \u2014 cabinet summary and drawing index' },
    { num: 'I100', title: 'Isometric SW View', desc: '3D overview with overall dimension annotations' },
    { num: 'I101', title: 'Front Elevation', desc: 'Front view with multi-tier dimensioning' },
    { num: 'I102', title: 'Rear Elevation', desc: 'Rear view with dimensions' },
    { num: 'I103', title: 'Plan View', desc: 'Top-down view with width and depth dimensions' },
    { num: 'I104', title: 'Three-View', desc: 'Front + Right + Plan in standard projection layout' },
    { num: 'I2xx', title: 'Assembly & Part Details', desc: `${assemblies.length > 0 ? assemblies.length + ' assembly sheets' : 'Component detail sheets'}` },
    { num: 'I301', title: 'Cut List Schedule', desc: cutEntryCount > 0 ? `${cutEntryCount} parts with edge banding data` : 'Requires CSV import' },
  ];

  for (const s of sheetList) {
    doc.setFont(font, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(navy);
    doc.text(s.num, left, y);
    doc.setFont(font, 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#333333');
    doc.text(s.title, left + 30, y);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#777777');
    doc.text(s.desc, left + 120, y, { maxWidth: colWidth - 120 });
    y += 8;
  }

  // ── MATERIAL LIST ──
  if (uniqueMaterials.size > 0) {
    y += 8;
    doc.setFont(font, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(navy);
    doc.text('MATERIALS', left, y);
    y += 6;
    doc.setDrawColor(DF_BRAND_COLORS.cashmere);
    doc.setLineWidth(0.5);
    doc.line(left, y, left + colWidth, y);
    y += 5;

    let col = 0;
    const matColW = colWidth / 3;
    for (const mat of uniqueMaterials) {
      doc.setFont(font, 'normal');
      doc.setFontSize(7);
      doc.setTextColor('#555555');
      doc.text(`\u2022  ${mat}`, left + col * matColW, y);
      col++;
      if (col >= 3) { col = 0; y += 5; }
    }
  }
}

// ============================================================================
// ISOMETRIC SW VIEW SHEET
// ============================================================================

function drawIsometricSheet(
  doc: jsPDF,
  allEdges: ReturnType<typeof extractSilhouetteEdges>,
  partBboxes: { partName: string; bbox: ReturnType<typeof computeBoundingBox> }[],
  config: PrintPackageConfig,
  dimensions: DimensionSet,
  font: string,
  tb: TitleBlockFn,
  bbox3d: BoundingBox3D,
  isoDir: 'sw' | 'ne' = 'sw',
  bvhGeometry?: THREE.BufferGeometry | null,
) {
  const viewLabel = isoDir === 'sw' ? 'Isometric SW View' : 'Isometric NE View';
  const dwgNum = isoDir === 'sw' ? SHEET_NUMBERING.isometricSW : SHEET_NUMBERING.isometricNE;
  tb(viewLabel, dwgNum);

  // Project all edges using isometric projection (SW or NE)
  const projDir: ViewDirection = isoDir === 'sw' ? 'iso' : 'iso_ne';
  const view = createProjectedView(allEdges, projDir);

  // Leave room for dimension annotations
  const dimPad = 30; // Reserve space for page-space-offset dimension annotations
  const pad = 15;
  const areaX = CONTENT_LEFT + pad + dimPad;
  const areaY = CONTENT_TOP + pad;
  const areaW = CONTENT_WIDTH - pad * 2 - dimPad;
  const areaH = CONTENT_HEIGHT - pad * 2 - dimPad;

  const isoTransform = computeIsoViewTransform(view.bounds, areaX, areaY, areaW, areaH);

  // Compute BVH corrected rotation context (if BVH geometry available)
  let bvhIsoCtx: { bvhTransform: ViewTransform; bvhQuat: THREE.Quaternion; cosA: number; sinA: number } | null = null;
  if (bvhGeometry && bvhGeometry.getAttribute('position')?.count > 0) {
    const bvhQuat = getBvhQuaternion(projDir);
    const angle = getBvhCorrectionAngle(bvhQuat);
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    // Apply 2D correction rotation to BVH geometry in-place (so drawBufferGeometryLines reads corrected coords)
    correctBvhGeometry(bvhGeometry, cosA, sinA);
    // Compute page transform from the corrected bounds
    const bvhTransform = computeBvhIsoTransform(view.edges, bvhQuat, cosA, sinA, areaX, areaY, areaW, areaH);
    bvhIsoCtx = { bvhTransform, bvhQuat, cosA, sinA };
  }

  // Draw edges: BVH directly for accuracy, with corrected rotation for upright orientation
  drawEdgesWithBvh(doc, view.edges, bvhGeometry, isoTransform, config.hiddenLineMode, true, partBboxes, projDir, bvhIsoCtx);

  // Draw dimension lines — when BVH active, use corrected BVH transform for alignment
  if (bvhIsoCtx) {
    drawIsoDimensionLabelsBvh(doc, dimensions, bvhIsoCtx, font, bbox3d, isoDir);
  } else {
    drawIsoDimensionLabels(doc, dimensions, isoTransform, font, bbox3d, isoDir);
  }

  // View label
  doc.setFont(font, 'bold');
  doc.setFontSize(7);
  doc.setTextColor('#666666');
  doc.text(`ISOMETRIC ${isoDir.toUpperCase()}`, CONTENT_LEFT + 5, CONTENT_TOP + 4);

  // Scale info
  doc.setFont(font, 'normal');
  doc.setFontSize(6);
  doc.setTextColor('#999999');
  doc.text(`Scale approx. 1:${Math.round(1 / isoTransform.scale)}`, CONTENT_LEFT + 5, CONTENT_TOP + CONTENT_HEIGHT - 2);
}

/**
 * Compute view transform for isometric projection.
 * NO Y-flip: iso projection already has screen-oriented Y
 * (negative isoY = top of model, positive isoY = bottom of model).
 * So we map minY (most negative = top) to top of area directly.
 */
function computeIsoViewTransform(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  areaX: number, areaY: number, areaW: number, areaH: number,
): ViewTransform {
  const viewW = bounds.maxX - bounds.minX;
  const viewH = bounds.maxY - bounds.minY;
  if (viewW === 0 || viewH === 0) return { scale: 1, offsetX: areaX, offsetY: areaY, bounds };

  const scaleX = areaW / viewW;
  const scaleY = areaH / viewH;
  const scale = Math.min(scaleX, scaleY) * 0.85; // 85% — use more space

  return {
    scale,
    offsetX: areaX + (areaW - viewW * scale) / 2 - bounds.minX * scale,
    // NO Y-flip: map minY (top of model) to top of area
    offsetY: areaY + (areaH - viewH * scale) / 2 - bounds.minY * scale,
    bounds,
  };
}

/**
 * Map isometric model coords to page — NO Y-flip.
 * Iso projection Y is already screen-oriented: negative=up, positive=down.
 * Higher isoY (bottom of model) → higher py (lower on page) — correct!
 */
function isoToPage(t: ViewTransform, mx: number, my: number): { px: number; py: number } {
  return {
    px: t.offsetX + mx * t.scale,
    py: t.offsetY + my * t.scale, // NO flip — iso Y already screen-oriented
  };
}

/**
 * Draw dimension labels on the isometric view aligned to the 30deg iso axes.
 * Projects actual 3D bbox corners to iso 2D, then draws dim lines along the
 * resulting angled directions (not flat horizontal/vertical).
 */
function drawIsoDimensionLabels(
  doc: jsPDF, dimensions: DimensionSet,
  transform: ViewTransform, font: string,
  bbox3d?: BoundingBox3D,
  isoDir: 'sw' | 'ne' = 'sw',
) {
  if (!bbox3d) {
    // Fallback: use flat labels if no 3D bbox provided
    const { minX, maxX, maxY } = transform.bounds;
    const center = isoToPage(transform, (minX + maxX) / 2, maxY + 8);
    drawDimensionLabel(doc, font, `${Math.round(dimensions.overall.width)}`, center.px, center.py, DIMENSION_COLORS.overall_width, DIM_TEXT_SIZE, 'center', undefined, 1);
    return;
  }

  const COS30 = Math.cos(Math.PI / 6);
  const SIN30 = Math.sin(Math.PI / 6);
  const flip = isoDir === 'sw' ? 1 : -1;

  // Project a 3D point to iso 2D then to page coords.
  function isoProjectToPage(p: { x: number; y: number; z: number }): { px: number; py: number } {
    const isoX = (p.x - p.y) * COS30 * flip;
    const isoY = -p.z + (p.x + p.y) * SIN30;
    return isoToPage(transform, isoX, isoY);
  }

  // Page-space offset (mm on the PDF page) — consistent regardless of model scale
  const PAGE_OFF = 18;
  const min = bbox3d.min, max = bbox3d.max;

  // Compute ISO axis directions in page space
  const origin = isoProjectToPage({ x: 0, y: 0, z: 0 });
  const xRef = isoProjectToPage({ x: 100, y: 0, z: 0 });
  const yRef = isoProjectToPage({ x: 0, y: 100, z: 0 });

  const yDx = yRef.px - origin.px, yDy = yRef.py - origin.py;
  const yLen = Math.sqrt(yDx * yDx + yDy * yDy);
  const yDir = { x: -yDx / yLen, y: -yDy / yLen }; // -Y = away from viewer

  const xDx = xRef.px - origin.px, xDy = xRef.py - origin.py;
  const xLen = Math.sqrt(xDx * xDx + xDy * xDy);
  const xDir = { x: -xDx / xLen, y: -xDy / xLen }; // -X = away from right side

  // ── WIDTH (X-axis) — front bottom edge, ext lines along -Y axis ──
  const wS = isoProjectToPage({ x: min.x, y: min.y, z: min.z });
  const wE = isoProjectToPage({ x: max.x, y: min.y, z: min.z });
  drawIsoDimension(doc, font, wS, wE, dimensions.overall.width,
    DIMENSION_COLORS.overall_width, yDir, PAGE_OFF);

  // ── DEPTH (Y-axis) — right bottom edge, ext lines along -X axis ──
  const dS = isoProjectToPage({ x: max.x, y: min.y, z: min.z });
  const dE = isoProjectToPage({ x: max.x, y: max.y, z: min.z });
  drawIsoDimension(doc, font, dS, dE, dimensions.overall.depth,
    DIMENSION_COLORS.vertical, xDir, PAGE_OFF);

  // ── HEIGHT (Z-axis) — left vertical edge, ext lines along -Y axis ──
  const hS = isoProjectToPage({ x: min.x, y: min.y, z: min.z });
  const hE = isoProjectToPage({ x: min.x, y: min.y, z: max.z });
  drawIsoDimension(doc, font, hS, hE, dimensions.overall.height,
    DIMENSION_COLORS.overall_height, yDir, PAGE_OFF);
}

/**
 * Draw a single isometric dimension with ISO-axis-aligned extension lines.
 * Extension lines follow a 3D axis direction (projected to page), not 2D perpendicular.
 * This matches engineering isometric dimensioning standards.
 *
 * @param extDir  Page-space unit vector for extension line direction (along an ISO axis)
 * @param offsetDist  Distance in mm along extDir from model edge to dimension line
 */
function drawIsoDimension(
  doc: jsPDF, font: string,
  p1: { px: number; py: number },
  p2: { px: number; py: number },
  value: number, color: string,
  extDir: { x: number; y: number },
  offsetDist: number,
  labelOffset?: number,
): void {
  const dx = p2.px - p1.px, dy = p2.py - p1.py;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return;

  // Unit vectors: along dimension line
  const ux = dx / len, uy = dy / len;

  // Extension direction (pre-computed ISO axis direction, already normalized)
  const ex = extDir.x, ey = extDir.y;

  // Dimension line endpoints (offset along extension direction from model edge)
  const d1x = p1.px + ex * offsetDist, d1y = p1.py + ey * offsetDist;
  const d2x = p2.px + ex * offsetDist, d2y = p2.py + ey * offsetDist;

  doc.setDrawColor(color);
  doc.setLineWidth(0.25);

  // Extension lines: from model edge (with gap) to dimension line (with overshoot)
  const gap = DIM_EXT_GAP;
  const ext = 2; // mm past dimension line
  doc.line(p1.px + ex * gap, p1.py + ey * gap,
           d1x + ex * ext, d1y + ey * ext);
  doc.line(p2.px + ex * gap, p2.py + ey * gap,
           d2x + ex * ext, d2y + ey * ext);

  // Dimension line
  doc.line(d1x, d1y, d2x, d2y);

  // Tick marks (along dimension line direction at each endpoint)
  const ts = DIM_TICK_SIZE;
  doc.line(d1x - ux * ts, d1y - uy * ts, d1x + ux * ts, d1y + uy * ts);
  doc.line(d2x - ux * ts, d2y - uy * ts, d2x + ux * ts, d2y + uy * ts);

  // Label at midpoint, offset along extension direction
  const lo = labelOffset ?? 3;
  const mx = (d1x + d2x) / 2 + ex * lo;
  const my = (d1y + d2y) / 2 + ey * lo;
  drawDimensionLabel(doc, font, `${Math.round(value)}`, mx, my,
    color, DIM_TEXT_SIZE, 'center', undefined, 1);
}

/**
 * Draw ISO dimension labels using corrected BVH projection (matches BVH edge positions).
 * Projects 3D bounding box corners through BVH quaternion + 2D correction, then
 * uses perpendicular extension lines aligned with isometric axes.
 */
function drawIsoDimensionLabelsBvh(
  doc: jsPDF, dimensions: DimensionSet,
  ctx: { bvhTransform: ViewTransform; bvhQuat: THREE.Quaternion; cosA: number; sinA: number },
  font: string, bbox3d?: BoundingBox3D, _isoDir: 'sw' | 'ne' = 'sw',
) {
  if (!bbox3d) return;
  const { bvhTransform: t, bvhQuat, cosA, sinA } = ctx;
  const PAGE_OFF = 18;
  const min = bbox3d.min, max = bbox3d.max;

  /** Project 3D point → corrected BVH XZ → page coordinates */
  function toPage(p: { x: number; y: number; z: number }): { px: number; py: number } {
    const c = bvhProjectCorrected(p, bvhQuat, cosA, sinA);
    return { px: t.offsetX + c.x * t.scale, py: t.offsetY - c.z * t.scale };
  }

  // Compute ISO axis directions in page space (for extension line alignment)
  const origin = toPage({ x: 0, y: 0, z: 0 });
  const xRef = toPage({ x: 100, y: 0, z: 0 });
  const yRef = toPage({ x: 0, y: 100, z: 0 });

  // Y-axis direction in page space (for width extension lines — offset along front-to-back)
  const yDx = yRef.px - origin.px, yDy = yRef.py - origin.py;
  const yLen = Math.sqrt(yDx * yDx + yDy * yDy);
  // Width ext lines go AWAY from viewer → negative Y direction
  const yDir = { x: -yDx / yLen, y: -yDy / yLen };

  // X-axis direction in page space (for depth extension lines — offset along left-to-right)
  const xDx = xRef.px - origin.px, xDy = xRef.py - origin.py;
  const xLen = Math.sqrt(xDx * xDx + xDy * xDy);
  // Depth ext lines go AWAY from model → negative X direction
  const xDir = { x: -xDx / xLen, y: -xDy / xLen };

  // ── WIDTH (X-axis) — front bottom edge, ext lines along -Y axis ──
  const wS = toPage({ x: min.x, y: min.y, z: min.z });
  const wE = toPage({ x: max.x, y: min.y, z: min.z });
  drawIsoDimension(doc, font, wS, wE, dimensions.overall.width,
    DIMENSION_COLORS.overall_width, yDir, PAGE_OFF);

  // ── DEPTH (Y-axis) — right bottom edge, ext lines along -X axis ──
  const dS = toPage({ x: max.x, y: min.y, z: min.z });
  const dE = toPage({ x: max.x, y: max.y, z: min.z });
  drawIsoDimension(doc, font, dS, dE, dimensions.overall.depth,
    DIMENSION_COLORS.vertical, xDir, PAGE_OFF);

  // ── HEIGHT (Z-axis) — left vertical edge, ext lines along -Y axis (horizontal in ISO) ──
  const hS = toPage({ x: min.x, y: min.y, z: min.z });
  const hE = toPage({ x: min.x, y: min.y, z: max.z });
  drawIsoDimension(doc, font, hS, hE, dimensions.overall.height,
    DIMENSION_COLORS.overall_height, yDir, PAGE_OFF);
}

// ============================================================================
// ELEVATION / VIEW SHEET
// ============================================================================

/** Transform context: maps model coordinates to PDF page coordinates */
interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function computeViewTransform(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  areaX: number, areaY: number, areaW: number, areaH: number,
): ViewTransform {
  const viewW = bounds.maxX - bounds.minX;
  const viewH = bounds.maxY - bounds.minY;
  if (viewW === 0 || viewH === 0) return { scale: 1, offsetX: areaX, offsetY: areaY, bounds };

  const scaleX = areaW / viewW;
  const scaleY = areaH / viewH;
  const scale = Math.min(scaleX, scaleY) * 0.70; // 70% to leave room for dimensions

  return {
    scale,
    offsetX: areaX + (areaW - viewW * scale) / 2 - bounds.minX * scale,
    offsetY: areaY + (areaH - viewH * scale) / 2 + bounds.maxY * scale,
    bounds,
  };
}

function modelToPage(t: ViewTransform, mx: number, my: number): { px: number; py: number } {
  return {
    px: t.offsetX + mx * t.scale,
    py: t.offsetY - my * t.scale, // Y flipped for PDF
  };
}

function drawElevationSheet(
  doc: jsPDF, direction: ViewDirection, title: string, drawingNumber: string,
  allEdges: ReturnType<typeof extractSilhouetteEdges>,
  partBboxes: { partName: string; bbox: any }[],
  config: PrintPackageConfig, dimensions: DimensionSet, font: string,
  tb: TitleBlockFn,
  bvhGeometry?: THREE.BufferGeometry | null,
  modelGroup?: THREE.Group,
) {
  tb(title, drawingNumber);

  const view = createProjectedView(allEdges, direction);

  // Compute transform with padding for dimension annotations
  const dimPad = DIM_TIER_1_OFFSET + 12;
  const drawArea = {
    x: CONTENT_LEFT + dimPad,
    y: CONTENT_TOP + dimPad,
    w: CONTENT_WIDTH - dimPad * 2,
    h: CONTENT_HEIGHT - dimPad * 2,
  };
  const transform = computeViewTransform(view.bounds, drawArea.x, drawArea.y, drawArea.w, drawArea.h);

  // Draw model edges with BVH or legacy fallback
  drawEdgesWithBvh(doc, view.edges, bvhGeometry, transform, config.hiddenLineMode, false, partBboxes, direction, undefined, modelGroup);

  // Draw dimensions
  drawAllDimensions(doc, dimensions, direction, transform, config, font);

  // View label
  doc.setFont(font, 'bold');
  doc.setFontSize(7);
  doc.setTextColor('#666666');
  doc.text(title.toUpperCase(), CONTENT_LEFT + 5, CONTENT_TOP + 4);

  // Scale info
  doc.setFont(font, 'normal');
  doc.setFontSize(6);
  doc.setTextColor('#999999');
  doc.text(`Scale approx. 1:${Math.round(1 / transform.scale)}`, CONTENT_LEFT + 5, CONTENT_TOP + CONTENT_HEIGHT - 2);
}

// ============================================================================
// DIMENSION DRAWING SYSTEM
// ============================================================================

/**
 * Draw a single dimension line with extension lines, ticks, and centered label.
 * Works for both horizontal and vertical orientations.
 * Includes bounds checking to prevent off-page rendering.
 */
function drawSingleDimension(
  doc: jsPDF, font: string,
  x1: number, y1: number, x2: number, y2: number,
  value: number, color: string,
  orientation: 'horizontal' | 'vertical',
  offset: number, // perpendicular offset from the line (positive = away from model)
  tier: 1 | 2 | 3 = 1,
) {
  // Skip very small dimensions
  if (Math.round(value) < 1) return;

  doc.setDrawColor(color);
  doc.setLineWidth(0.2);

  if (orientation === 'horizontal') {
    const dimY = y1 + offset; // offset below (positive Y = down in PDF)

    // Bounds check
    if (dimY > CONTENT_TOP + CONTENT_HEIGHT + M || dimY < CONTENT_TOP - M) return;
    if (x1 < CONTENT_LEFT - M || x2 > CONTENT_LEFT + CONTENT_WIDTH + M) return;

    // Extension lines
    doc.line(x1, y1 + DIM_EXT_GAP, x1, dimY + DIM_TICK_SIZE);
    doc.line(x2, y2 + DIM_EXT_GAP, x2, dimY + DIM_TICK_SIZE);
    // Main dimension line
    doc.line(x1, dimY, x2, dimY);
    // Tick marks (45° slashes)
    doc.line(x1 - DIM_TICK_SIZE, dimY - DIM_TICK_SIZE, x1 + DIM_TICK_SIZE, dimY + DIM_TICK_SIZE);
    doc.line(x2 - DIM_TICK_SIZE, dimY - DIM_TICK_SIZE, x2 + DIM_TICK_SIZE, dimY + DIM_TICK_SIZE);
    // Label with pill background
    const midX = (x1 + x2) / 2;
    drawDimensionLabel(doc, font, `${Math.round(value)}`, midX, dimY - 1, color, DIM_TEXT_SIZE, 'center', undefined, tier);
  } else {
    const dimX = x1 + offset; // offset to the right

    // Bounds check
    if (dimX > CONTENT_LEFT + CONTENT_WIDTH + M || dimX < CONTENT_LEFT - M) return;
    if (y1 < CONTENT_TOP - M || y2 > CONTENT_TOP + CONTENT_HEIGHT + M) return;

    // Ensure y1 > y2 (y1 is lower on page = model bottom, y2 is higher = model top)
    const yBottom = Math.max(y1, y2);
    const yTop = Math.min(y1, y2);

    // Extension lines (from model edge to dimension line, going right)
    doc.line(x1 + DIM_EXT_GAP, yBottom, dimX + DIM_TICK_SIZE, yBottom);
    doc.line(x2 + DIM_EXT_GAP, yTop, dimX + DIM_TICK_SIZE, yTop);
    // Main dimension line
    doc.line(dimX, yTop, dimX, yBottom);
    // Tick marks
    doc.line(dimX - DIM_TICK_SIZE, yTop - DIM_TICK_SIZE, dimX + DIM_TICK_SIZE, yTop + DIM_TICK_SIZE);
    doc.line(dimX - DIM_TICK_SIZE, yBottom - DIM_TICK_SIZE, dimX + DIM_TICK_SIZE, yBottom + DIM_TICK_SIZE);
    // Label with pill background (rotated 90°)
    const midY = (yTop + yBottom) / 2;
    drawDimensionLabel(doc, font, `${Math.round(value)}`, dimX + 2, midY, color, DIM_TEXT_SIZE, 'center', undefined, tier);
  }
}

/**
 * Draw a chain of dimensions (multiple segments along an axis).
 */
function drawChainDimension(
  doc: jsPDF, font: string,
  positions: number[], // model-space positions, already sorted
  transform: ViewTransform,
  axis: 'horizontal' | 'vertical',
  tierOffset: number, // mm offset in PDF space
  color: string,
  _direction: ViewDirection,
  tier: 1 | 2 | 3 = 2,
) {
  if (positions.length < 2) return;

  for (let i = 0; i < positions.length - 1; i++) {
    const pos1 = positions[i];
    const pos2 = positions[i + 1];
    const gap = Math.abs(pos2 - pos1);
    if (gap < 1) continue;

    if (axis === 'horizontal') {
      const p1 = modelToPage(transform, pos1, transform.bounds.minY);
      const p2 = modelToPage(transform, pos2, transform.bounds.minY);
      drawSingleDimension(doc, font, p1.px, p1.py, p2.px, p2.py, gap, color, 'horizontal', tierOffset, tier);
    } else {
      const p1 = modelToPage(transform, transform.bounds.maxX, pos1);
      const p2 = modelToPage(transform, transform.bounds.maxX, pos2);
      drawSingleDimension(doc, font, p1.px, p1.py, p2.px, p2.py, gap, color, 'vertical', tierOffset, tier);
    }
  }
}

/**
 * Draw all dimension tiers on an elevation view.
 */
function drawAllDimensions(
  doc: jsPDF, dimensions: DimensionSet, direction: ViewDirection,
  transform: ViewTransform, config: PrintPackageConfig, font: string,
  scaleFactor = 1, // For three-view, use reduced offsets
) {
  // Reset label collision tracking for each view's dimension pass
  resetLabelRects();

  const t1 = DIM_TIER_1_OFFSET * scaleFactor;
  const t2 = DIM_TIER_2_OFFSET * scaleFactor;
  const t3 = DIM_TIER_3_OFFSET * scaleFactor;

  // Tier 1: Overall dimensions (outermost)
  if (config.dimensionTiers.overall) {
    // Width / horizontal overall (bottom of model)
    const bl = modelToPage(transform, transform.bounds.minX, transform.bounds.minY);
    const br = modelToPage(transform, transform.bounds.maxX, transform.bounds.minY);
    const overallH = getOverallForAxis(dimensions, direction, 'horizontal');
    drawSingleDimension(doc, font, bl.px, bl.py, br.px, br.py,
      overallH, DIMENSION_COLORS.overall_width, 'horizontal', t1, 1);

    // Height / vertical overall (right of model)
    const tr = modelToPage(transform, transform.bounds.maxX, transform.bounds.maxY);
    const overallV = getOverallForAxis(dimensions, direction, 'vertical');
    drawSingleDimension(doc, font, br.px, br.py, tr.px, tr.py,
      overallV, DIMENSION_COLORS.overall_height, 'vertical', t1, 1);
  }

  // Tier 2: Intermediate chain dimensions
  if (config.dimensionTiers.intermediate) {
    // Filter dimensions for this view direction
    // Also check for matching ortho directions (e.g. 'front' dims apply to 'back' too)
    const matchingViews = getMatchingViews(direction);
    const relevantDims = dimensions.intermediate.filter(
      d => d.tier === 2 && matchingViews.includes(d.view)
    );
    for (const dim of relevantDims) {
      if (dim.positions.length < 2) continue;
      const isHoriz = dim.type === 'horizontal_chain' || dim.type === 'single_horizontal';
      drawChainDimension(doc, font, dim.positions, transform,
        isHoriz ? 'horizontal' : 'vertical',
        t2, dim.color, direction, 2);
    }
  }

  // Tier 3: Detail dimensions (openings)
  if (config.dimensionTiers.openings) {
    const matchingViews = getMatchingViews(direction);
    const detailDims = dimensions.intermediate.filter(
      d => d.tier === 3 && matchingViews.includes(d.view)
    );
    for (const dim of detailDims) {
      if (dim.positions.length < 2) continue;
      const isHoriz = dim.type === 'single_horizontal' || dim.type === 'horizontal_chain';
      drawChainDimension(doc, font, dim.positions, transform,
        isHoriz ? 'horizontal' : 'vertical',
        t3, dim.color, direction, 3);
    }
  }
}

/**
 * Get matching view directions for dimension filtering.
 * Front/back share X-axis dims, left/right share Y-axis dims, etc.
 */
function getMatchingViews(direction: ViewDirection): ViewDirection[] {
  switch (direction) {
    case 'front': return ['front'];
    case 'back': return ['back', 'front']; // back can use front X-positions mirrored
    case 'right': return ['right'];
    case 'left': return ['left', 'right'];
    case 'top': return ['top'];
    case 'bottom': return ['bottom', 'top'];
    default: return [direction];
  }
}

function getOverallForAxis(dims: DimensionSet, direction: ViewDirection, axis: 'horizontal' | 'vertical'): number {
  switch (direction) {
    case 'front': case 'back': return axis === 'horizontal' ? dims.overall.width : dims.overall.height;
    case 'right': case 'left': return axis === 'horizontal' ? dims.overall.depth : dims.overall.height;
    case 'top': case 'bottom': return axis === 'horizontal' ? dims.overall.width : dims.overall.depth;
    default: return axis === 'horizontal' ? dims.overall.width : dims.overall.height;
  }
}

// ============================================================================
// THREE-VIEW SHEET
// ============================================================================

function drawThreeViewSheet(
  doc: jsPDF,
  allEdges: ReturnType<typeof extractSilhouetteEdges>,
  partBboxes: { partName: string; bbox: any }[],
  config: PrintPackageConfig,
  dimensions: DimensionSet,
  font: string,
  tb: TitleBlockFn,
  bvhGeometries?: Map<string, THREE.BufferGeometry | null>,
  modelGroup?: THREE.Group,
) {
  tb('Three-View Arrangement', SHEET_NUMBERING.threeView);

  const halfW = CONTENT_WIDTH / 2 - 5;
  const halfH = CONTENT_HEIGHT / 2 - 5;
  const pad = 8;

  // Front (top-left)
  const fv = createProjectedView(allEdges, 'front');
  const ft = computeViewTransform(fv.bounds, CONTENT_LEFT + pad, CONTENT_TOP + pad + 5, halfW - pad * 2, halfH - pad * 2);
  drawEdgesWithBvh(doc, fv.edges, bvhGeometries?.get('front') ?? null, ft, config.hiddenLineMode, false, partBboxes, 'front', undefined, modelGroup);
  drawAllDimensions(doc, dimensions, 'front', ft, config, font, 0.6);

  // Right (top-right)
  const rv = createProjectedView(allEdges, 'right');
  const rt = computeViewTransform(rv.bounds, CONTENT_LEFT + halfW + pad + 5, CONTENT_TOP + pad + 5, halfW - pad * 2, halfH - pad * 2);
  drawEdgesWithBvh(doc, rv.edges, bvhGeometries?.get('right') ?? null, rt, config.hiddenLineMode, false, partBboxes, 'right', undefined, modelGroup);
  drawAllDimensions(doc, dimensions, 'right', rt, config, font, 0.6);

  // Plan (bottom-left)
  const tv = createProjectedView(allEdges, 'top');
  const tt = computeViewTransform(tv.bounds, CONTENT_LEFT + pad, CONTENT_TOP + halfH + pad + 10, halfW - pad * 2, halfH - pad * 2);
  drawEdgesWithBvh(doc, tv.edges, bvhGeometries?.get('top') ?? null, tt, config.hiddenLineMode, false, partBboxes, 'top', undefined, modelGroup);
  drawAllDimensions(doc, dimensions, 'top', tt, config, font, 0.6);

  // Labels
  doc.setFont(font, 'bold');
  doc.setFontSize(7);
  doc.setTextColor('#666666');
  doc.text('FRONT ELEVATION', CONTENT_LEFT + 5, CONTENT_TOP + 4);
  doc.text('RIGHT SIDE', CONTENT_LEFT + halfW + 10, CONTENT_TOP + 4);
  doc.text('PLAN VIEW', CONTENT_LEFT + 5, CONTENT_TOP + halfH + 9);
}

// ============================================================================
// ASSEMBLY / PART DETAIL SHEETS
// ============================================================================

interface DetailGroup {
  title: string;
  type: 'assembly' | 'carcase-panels' | 'misc';
  nodes: PartTreeNode[];
  /** Deduplicated nodes with quantities (populated for carcase-panels) */
  deduplicatedNodes?: DeduplicatedNode[];
  cutEntries: CutListEntry[];
  /** Assembly category from the assembly engine (construction sequence ordering) */
  assemblyCategory?: string;
}

interface DeduplicatedNode {
  node: PartTreeNode;
  qty: number;
}

/**
 * Deduplicate parts that share the same name and dimensions (within 1mm tolerance).
 * Identical parts are collapsed into a single entry with a quantity count.
 */
function deduplicateParts(nodes: PartTreeNode[]): DeduplicatedNode[] {
  const groups: DeduplicatedNode[] = [];
  const used = new Set<number>();

  for (let i = 0; i < nodes.length; i++) {
    if (used.has(i)) continue;
    let qty = 1;
    for (let j = i + 1; j < nodes.length; j++) {
      if (used.has(j)) continue;
      const a = nodes[i].dims;
      const b = nodes[j].dims;
      if (!a || !b) continue;
      const nameMatch = nodes[i].name === nodes[j].name;
      const dimsMatch = Math.abs(a.w - b.w) < 1 && Math.abs(a.d - b.d) < 1 && Math.abs(a.h - b.h) < 1;
      if (nameMatch && dimsMatch) {
        qty++;
        used.add(j);
      }
    }
    used.add(i);
    groups.push({ node: nodes[i], qty });
  }
  return groups;
}

/**
 * Build detail groups from part tree using assembly engine grouping.
 * Produces structured construction-sequence-ordered sheets:
 * 1. Carcase (empty) — sides, top, bottom, back, divisions
 * 2. Carcase + Shelves — adds fixed shelves to carcase view
 * 3. Door assemblies — one per unique door type
 * 4. Drawer assemblies — one per drawer box
 * 5. Other/misc parts
 */
function buildDetailGroups(partTree: PartTreeNode[], cutList: CutListEntry[], confirmedGroups?: AssemblyGroup[]): DetailGroup[] {
  const groups: DetailGroup[] = [];

  // Flatten the part tree to get all leaf nodes
  function collectAllNodes(nodes: PartTreeNode[]): PartTreeNode[] {
    const result: PartTreeNode[] = [];
    for (const n of nodes) {
      result.push(n);
      if (n.children?.length) result.push(...collectAllNodes(n.children));
    }
    return result;
  }
  const allNodes = collectAllNodes(partTree);
  const nodeById = new Map<string, PartTreeNode>(allNodes.map(n => [n.id, n]));
  const assignedIds = new Set<string>();

  // Use confirmed groups from review panel if provided, otherwise auto-suggest
  const assemblyGroups = confirmedGroups ?? suggestAssemblyGroups(partTree);

  for (const ag of assemblyGroups) {
    const nodes = ag.partIds.map(id => nodeById.get(id)).filter(Boolean) as PartTreeNode[];
    if (nodes.length === 0) continue;

    // Recursively collect mesh names from descendants when node's own list is empty
    function collectMeshNames(n: PartTreeNode): string[] {
      if (n.meshObjectNames.length > 0) return n.meshObjectNames;
      if (!n.children?.length) return [];
      return n.children.flatMap(c => collectMeshNames(c));
    }
    for (const node of nodes) {
      if (node.meshObjectNames.length === 0) {
        node.meshObjectNames = collectMeshNames(node);
      }
    }

    const entries = nodes.flatMap(n =>
      n.cutListEntryIds.map(i => cutList[i]).filter(Boolean)
    );
    nodes.forEach(n => assignedIds.add(n.id));

    let type: DetailGroup['type'] = 'assembly';
    if (ag.category === 'carcase') type = 'carcase-panels';

    groups.push({
      title: ag.name,
      type,
      nodes,
      deduplicatedNodes: type === 'carcase-panels' ? deduplicateParts(nodes) : undefined,
      cutEntries: entries,
      assemblyCategory: ag.category,
    });
  }

  // Collect any unassigned parts into a misc group
  const miscNodes = allNodes.filter(n => n.isLeaf && !assignedIds.has(n.id));
  if (miscNodes.length > 0) {
    const deduplicated = deduplicateParts(miscNodes);
    groups.push({
      title: 'Other Components',
      type: 'misc',
      nodes: deduplicated.map(d => d.node),
      deduplicatedNodes: deduplicated,
      cutEntries: miscNodes.flatMap(n => n.cutListEntryIds.map(i => cutList[i]).filter(Boolean)),
    });
  }

  return groups;
}

function drawDetailSheet(
  doc: jsPDF, group: DetailGroup, model: ParsedModel, _cutList: CutListEntry[],
  drawingNumber: string, _config: PrintPackageConfig, font: string,
  tb: TitleBlockFn,
) {
  // Title includes assembly sequence info
  const seqLabel = group.assemblyCategory
    ? `${group.title} (${group.assemblyCategory.replace(/_/g, ' ')})`
    : group.title;
  tb(seqLabel, drawingNumber);

  // Coloured assembly banner — the visual identity that links this
  // detail sheet back to the ASSEMBLY LEGEND on the contents page.
  // Sits in the top-left of the content area, above the existing body
  // layout (doesn't shift drawAssemblyDetail's measurements).
  if (group.assemblyCategory) {
    const partCount = group.nodes.reduce(
      (sum, n) => sum + (n.meshObjectNames?.length ?? 0), 0,
    );
    const hasOutfitFont = font === 'Outfit';
    drawAssemblyBanner(doc, group.assemblyCategory, partCount, hasOutfitFont, {
      x: 14, y: 15,
    });
  }

  // Try to render a 2D assembly drawing for all group types (carcase, assembly, misc).
  // Only fall back to the parts table when there's no drawable mesh geometry.
  const hasMeshGeometry = group.nodes.some(n => n.meshObjectNames.length > 0);
  if (hasMeshGeometry) {
    drawAssemblyDetail(doc, group, model, font);
  } else {
    drawPanelsTable(doc, group, font);
  }
}

function drawAssemblyDetail(doc: jsPDF, group: DetailGroup, model: ParsedModel, font: string) {
  const allMeshNames = group.nodes.flatMap(n => n.meshObjectNames);
  let partObjects = model.objects.filter(o => allMeshNames.includes(o.name));

  // Fallback 1: normalized (trim + lowercase) matching
  if (partObjects.length === 0 && allMeshNames.length > 0) {
    const normNames = new Set(allMeshNames.map(n => n.trim().toLowerCase()));
    partObjects = model.objects.filter(o => normNames.has(o.name.trim().toLowerCase()));
  }
  // Fallback 2: substring contains check
  if (partObjects.length === 0 && allMeshNames.length > 0) {
    partObjects = model.objects.filter(o => {
      const oLow = o.name.trim().toLowerCase();
      return allMeshNames.some(mn => {
        const mLow = mn.trim().toLowerCase();
        return oLow.includes(mLow) || mLow.includes(oLow);
      });
    });
  }
  // Fallback 3: spatial bbox overlap — match model objects whose bbox overlaps the group bbox
  if (partObjects.length === 0 && group.nodes.some(n => n.bbox)) {
    const validBboxes = group.nodes.filter(n => n.bbox).map(n => n.bbox!);
    if (validBboxes.length > 0) {
      const groupBbox = mergeBoundingBoxes(validBboxes);
      partObjects = model.objects.filter(o => {
        const ob = computeBoundingBox(o.vertices);
        // Check 3D overlap (any axis intersection)
        return ob.min.x < groupBbox.max.x && ob.max.x > groupBbox.min.x
            && ob.min.y < groupBbox.max.y && ob.max.y > groupBbox.min.y
            && ob.min.z < groupBbox.max.z && ob.max.z > groupBbox.min.z;
      });
    }
  }

  // Diagnostic warning
  if (partObjects.length === 0) {
    console.warn('[printPackage] Assembly geometry match failed for group:', group.title,
      'meshNames:', allMeshNames.slice(0, 8),
      'modelObjects:', model.objects.slice(0, 8).map(o => o.name));
  }
  // Graceful fallback: render parts table only
  if (partObjects.length === 0) {
    drawPanelsTable(doc, group, font);
    return;
  }

  if (partObjects.length > 0) {
    const partEdges = partObjects.flatMap(obj =>
      extractSilhouetteEdges(obj.vertices, obj.faces, obj.name)
    );
    const partBboxes = partObjects.map(o => ({
      partName: o.name,
      bbox: computeBoundingBox(o.vertices),
    }));
    const overallBbox = mergeBoundingBoxes(partObjects.map(o => computeBoundingBox(o.vertices)));
    const bestView = selectBestView(group.nodes[0]?.bbox || overallBbox);

    // Determine secondary view based on assembly type
    const secondaryView: ViewDirection = bestView === 'front' ? 'right' : 'front';

    // ── PRIMARY VIEW (left 55% of content area, larger) ──
    const primaryW = CONTENT_WIDTH * 0.38;
    const primaryH = CONTENT_HEIGHT - 40;
    const view1 = createProjectedView(partEdges, bestView);
    const t1 = computeViewTransform(view1.bounds,
      CONTENT_LEFT + 8, CONTENT_TOP + 18, primaryW, primaryH);

    drawEdgesWithBvh(doc, view1.edges, null, t1, 'faint', false, partBboxes, bestView);

    // Primary view label
    doc.setFont(font, 'bold');
    doc.setFontSize(6);
    doc.setTextColor('#666666');
    doc.text(bestView.toUpperCase(), CONTENT_LEFT + 8, CONTENT_TOP + 14);

    // Primary view dimensions
    const bl1 = modelToPage(t1, view1.bounds.minX, view1.bounds.minY);
    const br1 = modelToPage(t1, view1.bounds.maxX, view1.bounds.minY);
    const tr1 = modelToPage(t1, view1.bounds.maxX, view1.bounds.maxY);
    const node = group.nodes[0];
    drawSingleDimension(doc, font, bl1.px, bl1.py, br1.px, br1.py,
      node.dims.w, DIMENSION_COLORS.overall_width, 'horizontal', 8, 2);
    drawSingleDimension(doc, font, br1.px, br1.py, tr1.px, tr1.py,
      node.dims.h, DIMENSION_COLORS.overall_height, 'vertical', 8, 2);

    // ── SECONDARY VIEW (top-right corner, smaller) ──
    const secX = CONTENT_LEFT + primaryW + 20;
    const secW = CONTENT_WIDTH * 0.12;
    const secH = CONTENT_HEIGHT * 0.35;
    const view2 = createProjectedView(partEdges, secondaryView);
    const t2 = computeViewTransform(view2.bounds, secX, CONTENT_TOP + 18, secW, secH);

    drawEdgesWithBvh(doc, view2.edges, null, t2, 'faint', false, partBboxes, secondaryView);

    // Secondary view label
    doc.setFont(font, 'bold');
    doc.setFontSize(5);
    doc.setTextColor('#666666');
    doc.text(secondaryView.toUpperCase(), secX, CONTENT_TOP + 14);

    // Secondary view dimension (depth)
    const bl2 = modelToPage(t2, view2.bounds.minX, view2.bounds.minY);
    const br2 = modelToPage(t2, view2.bounds.maxX, view2.bounds.minY);
    drawSingleDimension(doc, font, bl2.px, bl2.py, br2.px, br2.py,
      node.dims.d, DIMENSION_COLORS.vertical, 'horizontal', 6, 2);
  }

  // Right half: sub-parts table
  const tableX = CONTENT_LEFT + CONTENT_WIDTH * 0.48;
  const tableY = CONTENT_TOP + 10;

  doc.setFont(font, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(DF_BRAND_COLORS.navy);
  doc.text('COMPONENTS', tableX, tableY);

  if (group.cutEntries.length > 0) {
    const tableData = group.cutEntries.map(e => [
      e.partName,
      e.material,
      `${e.length}\u00D7${e.width}\u00D7${e.thickness}`,
      String(e.qty),
      [e.edgeBanding.L1, e.edgeBanding.L2, e.edgeBanding.W1, e.edgeBanding.W2]
        .map((v, i) => v ? ['L1', 'L2', 'W1', 'W2'][i] : '').filter(Boolean).join(' ') || '\u2014',
    ]);

    autoTable(doc, {
      startY: tableY + 3,
      margin: { left: tableX, right: A3_DIMENSIONS.width - CONTENT_LEFT - CONTENT_WIDTH + 5 },
      head: [['Part', 'Material', 'L\u00D7W\u00D7T (mm)', 'Qty', 'Edge']],
      body: tableData,
      styles: { font, fontSize: 5.5, cellPadding: 1.2 },
      headStyles: { fillColor: [27, 42, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [27, 42, 74] },
        3: { fontStyle: 'bold', textColor: [200, 150, 46], halign: 'center' },
        4: { fontSize: 5, halign: 'center' },
      },
    });
  } else {
    doc.setFont(font, 'normal');
    doc.setFontSize(6);
    doc.setTextColor('#999999');
    doc.text('No cut list data linked', tableX, tableY + 8);
  }

  // Sub-parts list
  const node = group.nodes[0];
  if (node.children.length > 0) {
    const childListY = CONTENT_TOP + CONTENT_HEIGHT - 30;
    doc.setFont(font, 'bold');
    doc.setFontSize(6);
    doc.setTextColor('#666666');
    doc.text(`SUB-PARTS: ${node.children.map(c => c.name).join(', ')}`, CONTENT_LEFT + 10, childListY);
  }
}

function drawPanelsTable(doc: jsPDF, group: DetailGroup, font: string) {
  doc.setFont(font, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(DF_BRAND_COLORS.navy);
  doc.text(group.title, CONTENT_LEFT + 5, CONTENT_TOP + 8);

  doc.setFont(font, 'normal');
  doc.setFontSize(6);
  doc.setTextColor('#666666');
  doc.text(`${group.deduplicatedNodes ? group.deduplicatedNodes.reduce((sum, d) => sum + d.qty, 0) : group.nodes.length} parts (${group.nodes.length} unique)`, CONTENT_LEFT + 5, CONTENT_TOP + 13);

  const deduped = group.deduplicatedNodes ?? group.nodes.map(n => ({ node: n, qty: 1 }));
  const tableData = deduped.map(({ node: n, qty }) => {
    const entry = group.cutEntries.find(e =>
      n.cutListEntryIds.some(id => group.cutEntries.indexOf(e) === id - (group.cutEntries[0]?.originalRow ?? 0))
    );
    return [
      n.name,
      n.role,
      entry?.material ?? '\u2014',
      `${Math.round(n.dims.w)}`,
      `${Math.round(n.dims.d)}`,
      `${Math.round(n.dims.h)}`,
      String(qty),
      entry ? [entry.edgeBanding.L1, entry.edgeBanding.L2, entry.edgeBanding.W1, entry.edgeBanding.W2]
        .map((v, i) => v ? ['L1', 'L2', 'W1', 'W2'][i] : '').filter(Boolean).join(' ') || '\u2014' : '\u2014',
    ];
  });

  autoTable(doc, {
    startY: CONTENT_TOP + 17,
    margin: { left: CONTENT_LEFT + 5, right: A3_DIMENSIONS.width - CONTENT_LEFT - CONTENT_WIDTH + 5 },
    head: [['Part', 'Role', 'Material', 'W (mm)', 'D (mm)', 'H (mm)', 'Qty', 'Edge Banding']],
    body: tableData,
    styles: { font, fontSize: 6, cellPadding: 1.5 },
    headStyles: { fillColor: [27, 42, 74], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [27, 42, 74] },
      1: { fontSize: 5, textColor: [120, 120, 120] },
      6: { fontStyle: 'bold', textColor: [200, 150, 46], halign: 'center' },
      7: { fontSize: 5, halign: 'center' },
    },
  });
}

// ============================================================================
// CUT LIST SHEET
// ============================================================================

function drawCutListSheet(doc: jsPDF, cutList: CutListEntry[], _config: PrintPackageConfig, font: string, tb: TitleBlockFn) {
  tb('Cut List Schedule', SHEET_NUMBERING.cutList);

  if (!cutList || cutList.length === 0) {
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#999999');
    doc.text(
      'No cut list data available. Import a PolyBoard CSV file to populate this sheet.',
      CONTENT_LEFT + CONTENT_WIDTH / 2, CONTENT_TOP + CONTENT_HEIGHT / 2,
      { align: 'center' },
    );
    return;
  }

  const tableData = cutList.map(entry => [
    entry.partName,
    entry.material,
    String(entry.thickness),
    String(entry.qty),
    String(entry.length),
    String(entry.width),
    entry.edgeBanding.L1 ? '\u25CF' : '\u2014',
    entry.edgeBanding.L2 ? '\u25CF' : '\u2014',
    entry.edgeBanding.W1 ? '\u25CF' : '\u2014',
    entry.edgeBanding.W2 ? '\u25CF' : '\u2014',
  ]);

  autoTable(doc, {
    startY: CONTENT_TOP + 5,
    margin: { left: CONTENT_LEFT + 5, right: A3_DIMENSIONS.width - CONTENT_LEFT - CONTENT_WIDTH + 5 },
    head: [['Part', 'Material', 'T', 'Qty', 'Length', 'Width', 'L1', 'L2', 'W1', 'W2']],
    body: tableData,
    styles: { font, fontSize: 6, cellPadding: 1.5 },
    headStyles: { fillColor: [27, 42, 74], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold', textColor: [27, 42, 74] },
      3: { fontStyle: 'bold', textColor: [200, 150, 46], halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      9: { halign: 'center' },
    },
  });
}

// ============================================================================
// EDGE DRAWING
// ============================================================================

function drawProjectedEdges(
  doc: jsPDF, edges: ProjectedEdge[],
  hiddenLineMode: 'off' | 'faint' | 'hidden',
  transform: ViewTransform,
) {
  const [nr, ng, nb] = [27, 42, 74]; // DF Navy #1B2A4A

  // Pass 1: Visible edges
  doc.setDrawColor(nr, ng, nb);
  doc.setLineWidth(0.35);
  setDocAlpha(doc, 1.0);
  for (const edge of edges) {
    if (edge.visibility !== 'visible') continue;
    const { px: x1, py: y1 } = modelToPage(transform, edge.a2d.x, edge.a2d.y);
    const { px: x2, py: y2 } = modelToPage(transform, edge.b2d.x, edge.b2d.y);
    doc.line(x1, y1, x2, y2);
  }

  // Pass 2: Hidden edges (faint mode only)
  if (hiddenLineMode === 'faint') {
    doc.setDrawColor(nr, ng, nb);
    doc.setLineWidth(0.08);
    setDocAlpha(doc, 0.10);
    for (const edge of edges) {
      if (edge.visibility !== 'hidden') continue;
      const { px: x1, py: y1 } = modelToPage(transform, edge.a2d.x, edge.a2d.y);
      const { px: x2, py: y2 } = modelToPage(transform, edge.b2d.x, edge.b2d.y);
      doc.line(x1, y1, x2, y2);
    }
    setDocAlpha(doc, 1.0); // Reset alpha
  }
}

/**
 * Two-pass edge rendering with BVH-accurate visible outline overdraw.
 *
 * ORTHO views:
 *   Pass 1 (faint mode): all legacy edges faint → creates hidden line effect.
 *   Pass 2: BVH visible geometry bold on top → accurate visible outline.
 *
 * ISO views (with BVH + bvhIsoTransform):
 *   All edges are projected through the BVH quaternion to BVH XZ space.
 *   Pass 1 (faint mode): all edges drawn faint in BVH coordinate space.
 *   Pass 2: BVH visible geometry bold on top in same space → proper hidden line removal.
 *
 * ISO views (fallback, no BVH):
 *   All edges drawn as visible (bbox classifier is unreliable for ISO oblique projection).
 */
function drawEdgesWithBvh(
  doc: jsPDF,
  allEdges: ProjectedEdge[],
  bvhGeometry: THREE.BufferGeometry | null | undefined,
  transform: ViewTransform,
  hiddenLineMode: 'off' | 'faint' | 'hidden',
  isIso: boolean,
  partBboxes: { partName: string; bbox: any }[],
  direction: import('../types/workshop-viewer.types').ViewDirection,
  /** For ISO with BVH: corrected transform, quaternion, and trig values */
  bvhIsoCtx?: { bvhTransform: ViewTransform; bvhQuat: THREE.Quaternion; cosA: number; sinA: number } | null,
  /** Model group for raycaster-based occlusion (ortho views) */
  modelGroup?: THREE.Object3D,
): void {
  const [nr, ng, nb] = [27, 42, 74]; // DF Navy
  const bvhAvailable = bvhGeometry && bvhGeometry.getAttribute('position')?.count > 0;

  if (isIso) {
    if (bvhAvailable && bvhIsoCtx) {
      // ── ISO with BVH: draw corrected BVH geometry directly ──
      const { bvhTransform, bvhQuat, cosA, sinA } = bvhIsoCtx;

      if (hiddenLineMode === 'faint') {
        doc.setDrawColor(nr, ng, nb);
        doc.setLineWidth(0.08);
        setDocAlpha(doc, 0.10);
        for (const edge of allEdges) {
          const a = bvhProjectCorrected(edge.a3d, bvhQuat, cosA, sinA);
          const b = bvhProjectCorrected(edge.b3d, bvhQuat, cosA, sinA);
          const x1 = bvhTransform.offsetX + a.x * bvhTransform.scale;
          const y1 = bvhTransform.offsetY - a.z * bvhTransform.scale;
          const x2 = bvhTransform.offsetX + b.x * bvhTransform.scale;
          const y2 = bvhTransform.offsetY - b.z * bvhTransform.scale;
          doc.line(x1, y1, x2, y2);
        }
        setDocAlpha(doc, 1.0);
      }

      // Bold pass: BVH visible geometry (already corrected)
      doc.setDrawColor(nr, ng, nb);
      doc.setLineWidth(0.35);
      setDocAlpha(doc, 1.0);
      drawBufferGeometryLines(doc, bvhGeometry!, bvhTransform.offsetX, bvhTransform.offsetY, bvhTransform.scale, true);

    } else {
      // ── ISO fallback: no BVH → draw all edges visible ──
      doc.setDrawColor(nr, ng, nb);
      doc.setLineWidth(0.35);
      setDocAlpha(doc, 1.0);
      for (const edge of allEdges) {
        const { px: x1, py: y1 } = isoToPage(transform, edge.a2d.x, edge.a2d.y);
        const { px: x2, py: y2 } = isoToPage(transform, edge.b2d.x, edge.b2d.y);
        doc.line(x1, y1, x2, y2);
      }
    }
    setDocAlpha(doc, 1.0);
    return;
  }

  // ── ORTHO views ──
  // Classify per-part edges: raycaster (accurate) or bbox (fallback)
  const classifiedEdges = modelGroup
    ? classifyWithRaycaster(allEdges, modelGroup, direction)
    : classifyEdgeVisibility(allEdges, partBboxes, direction);

  if (bvhAvailable) {
    // Two-layer approach: raycaster-classified hidden edges faint + BVH bold visible
    if (hiddenLineMode === 'faint') {
      const hiddenEdges = classifiedEdges.filter(e => e.visibility === 'hidden');
      if (hiddenEdges.length > 0) {
        doc.setDrawColor(nr, ng, nb);
        doc.setLineWidth(0.08);
        setDocAlpha(doc, 0.10);
        for (const edge of hiddenEdges) {
          const { px: x1, py: y1 } = modelToPage(transform, edge.a2d.x, edge.a2d.y);
          const { px: x2, py: y2 } = modelToPage(transform, edge.b2d.x, edge.b2d.y);
          doc.line(x1, y1, x2, y2);
        }
        setDocAlpha(doc, 1.0);
      }
    }

    // Bold pass: BVH visible geometry (accurate silhouette including intersection edges)
    doc.setDrawColor(nr, ng, nb);
    doc.setLineWidth(0.35);
    setDocAlpha(doc, 1.0);
    drawBufferGeometryLines(doc, bvhGeometry!, transform.offsetX, transform.offsetY, transform.scale, bvhFlipY(direction));
  } else {
    // No BVH available: pure classified edges
    drawProjectedEdges(doc, classifiedEdges, hiddenLineMode, transform);
  }
}
