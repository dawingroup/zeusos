#!/usr/bin/env node
/**
 * generate-architecture-doc.mjs
 *
 * Generates a comprehensive Architectural Design Document for the
 * DawinOS Workshop Viewer module as a multi-page A4 portrait PDF.
 *
 * Usage: node scripts/generate-architecture-doc.mjs
 * Output: ~/Downloads/DawinOS_Workshop_Viewer_Architecture_v1.0.pdf
 */

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const { jsPDF } = require('jspdf');

// ─── Constants ───────────────────────────────────────────────────────────────
const NAVY = [27, 42, 74];         // #1B2A4A
const BLACK = [0, 0, 0];
const DARK_GREY = [50, 50, 50];
const MID_GREY = [100, 100, 100];
const LIGHT_GREY = [200, 200, 200];
const WHITE = [255, 255, 255];
const CASHMERE = [226, 202, 169];  // #E2CAA9
const BOYSENBERRY = [135, 46, 92]; // #872E5C

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_L = 20;
const MARGIN_R = 20;
const MARGIN_T = 25;
const MARGIN_B = 25;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

// ─── PDF instance ────────────────────────────────────────────────────────────
const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
let pageNum = 0;
let curY = MARGIN_T;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addPage() {
  doc.addPage();
  pageNum++;
  curY = MARGIN_T;
}

function pageFooter() {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MID_GREY);
  doc.text(`Page ${pageNum}`, PAGE_W / 2, PAGE_H - 12, { align: 'center' });
  doc.text('Confidential - Internal Use Only', PAGE_W / 2, PAGE_H - 7, { align: 'center' });
}

function ensureSpace(needed) {
  if (curY + needed > PAGE_H - MARGIN_B) {
    pageFooter();
    addPage();
    return true;
  }
  return false;
}

function sectionHeading(number, title) {
  ensureSpace(20);
  curY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(`${number}. ${title}`, MARGIN_L, curY);
  curY += 2;
  // Underline
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_L, curY, MARGIN_L + CONTENT_W, curY);
  curY += 8;
}

function subHeading(title) {
  ensureSpace(14);
  curY += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(title, MARGIN_L, curY);
  curY += 6;
}

function bodyText(text, indent = 0) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK_GREY);
  const maxW = CONTENT_W - indent;
  const lines = doc.splitTextToSize(text, maxW);
  for (const line of lines) {
    ensureSpace(5);
    doc.text(line, MARGIN_L + indent, curY);
    curY += 4.5;
  }
  curY += 1;
}

function bulletPoint(text, indent = 4) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK_GREY);
  const maxW = CONTENT_W - indent - 4;
  const lines = doc.splitTextToSize(text, maxW);
  ensureSpace(5);
  doc.text('\u2022', MARGIN_L + indent, curY);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) ensureSpace(5);
    doc.text(lines[i], MARGIN_L + indent + 4, curY);
    curY += 4.5;
  }
}

function codeBlock(lines, indent = 4) {
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  for (const line of lines) {
    ensureSpace(4.5);
    doc.text(line, MARGIN_L + indent, curY);
    curY += 3.8;
  }
  curY += 2;
}

function tableRow(cols, widths, isBold = false, bgColor = null) {
  ensureSpace(6);
  const rowH = 5.5;
  if (bgColor) {
    doc.setFillColor(...bgColor);
    doc.rect(MARGIN_L, curY - 3.8, CONTENT_W, rowH, 'F');
  }
  doc.setFont('helvetica', isBold ? 'bold' : 'normal');
  doc.setFontSize(8);
  const tc = isBold ? NAVY : DARK_GREY;
  doc.setTextColor(tc[0], tc[1], tc[2]);
  let x = MARGIN_L;
  for (let i = 0; i < cols.length; i++) {
    doc.text(String(cols[i]), x + 1, curY);
    x += widths[i];
  }
  curY += rowH;
}

function labelValue(label, value) {
  ensureSpace(6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(label + ':', MARGIN_L + 4, curY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_GREY);
  doc.text(String(value), MARGIN_L + 40, curY);
  curY += 5;
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function renderCover() {
  pageNum = 1;

  // Navy header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 80, 'F');

  // Cashmere accent line
  doc.setFillColor(...CASHMERE);
  doc.rect(0, 80, PAGE_W, 3, 'F');

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  doc.text('DAWIN FINISHES', PAGE_W / 2, 38, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CASHMERE);
  doc.text('Custom Joinery & Interior Finishes', PAGE_W / 2, 50, { align: 'center' });

  // Document title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...NAVY);
  doc.text('DawinOS', PAGE_W / 2, 115, { align: 'center' });
  doc.text('Workshop Viewer', PAGE_W / 2, 130, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(...MID_GREY);
  doc.text('Architectural Design Document', PAGE_W / 2, 150, { align: 'center' });

  // Separator
  doc.setDrawColor(...CASHMERE);
  doc.setLineWidth(1);
  doc.line(60, 163, 150, 163);

  // Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...DARK_GREY);
  const meta = [
    ['Version', '1.0'],
    ['Date', 'March 2026'],
    ['Status', 'Release Candidate'],
    ['Classification', 'Confidential - Internal Use Only'],
    ['Module', 'src/modules/workshop-viewer/'],
    ['Total Files', '34'],
    ['Total Lines', '~8,924'],
  ];
  let my = 178;
  for (const [k, v] of meta) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(k + ':', 55, my);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GREY);
    doc.text(v, 105, my);
    my += 8;
  }

  // Bottom bar
  doc.setFillColor(...NAVY);
  doc.rect(0, PAGE_H - 20, PAGE_W, 20, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text('dawinfinishes.com  |  info@dawinfinishes.com  |  0393 100 493', PAGE_W / 2, PAGE_H - 8, { align: 'center' });

  pageFooter();
}

// ─── Table of Contents ───────────────────────────────────────────────────────

function renderTOC() {
  addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text('Table of Contents', MARGIN_L, curY);
  curY += 4;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_L, curY, MARGIN_L + CONTENT_W, curY);
  curY += 12;

  const sections = [
    ['1', 'Executive Summary', '3'],
    ['2', 'System Architecture Overview', '3'],
    ['3', 'File Structure', '4'],
    ['4', 'Data Flow Architecture', '6'],
    ['5', 'Data Model', '7'],
    ['6', 'Core Algorithms', '9'],
    ['7', 'Three.js Viewport', '11'],
    ['8', 'PDF Print Package', '13'],
    ['9', 'AI Enhancement Layer', '15'],
    ['10', 'Cross-Module Integration', '16'],
    ['11', 'Constants & Configuration', '17'],
    ['12', 'Component Hierarchy', '18'],
    ['13', 'Testing Requirements', '19'],
    ['14', 'Future Roadmap', '20'],
  ];

  for (const [num, title, pg] of sections) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(`${num}.`, MARGIN_L + 2, curY);
    doc.text(title, MARGIN_L + 14, curY);

    // Dotted line
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...LIGHT_GREY);
    const titleW = doc.getTextWidth(title);
    const dotStart = MARGIN_L + 14 + titleW + 3;
    const dotEnd = MARGIN_L + CONTENT_W - 10;
    for (let dx = dotStart; dx < dotEnd; dx += 2.5) {
      doc.text('.', dx, curY);
    }

    doc.setTextColor(...MID_GREY);
    doc.text(pg, MARGIN_L + CONTENT_W - 2, curY, { align: 'right' });
    curY += 8;
  }

  pageFooter();
}

// ─── Section 1: Executive Summary ────────────────────────────────────────────

function renderSection1() {
  addPage();
  sectionHeading('1', 'Executive Summary');

  bodyText('The Workshop Viewer is the core visualization and documentation engine of DawinOS, the operational platform for Dawin Finishes. It ingests 3D cabinetry models exported from PolyBoard (as .3ds files) alongside material cut lists (CSV), and transforms them into interactive 3D previews and production-ready PDF print packages.');

  curY += 2;
  subHeading('Problem Statement');
  bodyText('Before the Workshop Viewer, producing workshop documentation for a single joinery unit required 2-4 hours of manual drafting in AutoCAD. Artisans had to manually cross-reference 3D models with cut lists, draw orthographic elevations, compute intermediate dimensions, and format everything into a consistent print package. This process was error-prone and created a bottleneck between the design and manufacturing stages.');

  curY += 2;
  subHeading('Solution');
  bodyText('The Workshop Viewer automates this entire pipeline:');
  bulletPoint('Parses binary .3ds files client-side with zero server round-trips');
  bulletPoint('Detects sub-assemblies (Shaker doors, drawer boxes, carcases) from PolyBoard naming conventions');
  bulletPoint('Computes overall and intermediate dimensions automatically');
  bulletPoint('Renders interactive 3D viewport with edge highlighting and explode views');
  bulletPoint('Generates multi-sheet A3 landscape PDF print packages with proper title blocks');
  bulletPoint('Links bidirectionally with the Design Manager and Manufacturing modules');

  curY += 2;
  subHeading('Target Users');
  bulletPoint('Workshop artisans: Consume the print package on the shop floor for cutting, assembly, and QC');
  bulletPoint('Designers: Review 3D models, verify dimensions, and generate documentation before handoff');
  bulletPoint('Project managers: Track documentation status and link to manufacturing orders');

  curY += 2;
  subHeading('Key Metrics');
  bulletPoint('Time to produce workshop documentation: 2-4 hours reduced to 5-10 minutes');
  bulletPoint('Dimension accuracy: Computed directly from mesh geometry, eliminating transcription errors');
  bulletPoint('Print package consistency: Every sheet follows DF-Style 1 branding and I-series numbering');

  pageFooter();
}

// ─── Section 2: System Architecture Overview ─────────────────────────────────

function renderSection2() {
  addPage();
  sectionHeading('2', 'System Architecture Overview');

  subHeading('2.1 High-Level Pipeline');
  bodyText('The Workshop Viewer implements a linear pipeline from file upload through to final output:');

  curY += 2;
  codeBlock([
    '  +-------------+     +-----------+     +-------------------+',
    '  | File Upload  | --> |  Parse    | --> | Assembly Detection|',
    '  | (.3ds, .csv) |     | (binary)  |     | (name patterns)   |',
    '  +-------------+     +-----------+     +-------------------+',
    '         |                                       |',
    '         v                                       v',
    '  +-----------------+               +-------------------+',
    '  | Dimension Engine | <---------> | Part Tree Builder  |',
    '  | (bbox analysis)  |             | (hierarchy + links)|',
    '  +-----------------+               +-------------------+',
    '         |                                       |',
    '         v                                       v',
    '  +------------------+              +-------------------+',
    '  | 3D Rendering     |              | PDF Generation    |',
    '  | (Three.js)       |              | (jsPDF, A3)       |',
    '  +------------------+              +-------------------+',
  ]);

  curY += 2;
  subHeading('2.2 Technology Stack');

  const stack = [
    ['Category', 'Technology', 'Purpose'],
    ['UI Framework', 'React 18 + TypeScript', 'Component architecture, type safety'],
    ['3D Rendering', 'Three.js (r161+)', 'WebGL viewport, mesh rendering, edge detection'],
    ['PDF Generation', 'jsPDF 2.5', 'Client-side A3 PDF creation'],
    ['State Management', 'Zustand + React hooks', 'Local viewer state, session persistence'],
    ['Server State', 'TanStack Query v5', 'Firestore data fetching and caching'],
    ['Backend', 'Firebase (Firestore)', 'Session persistence, project context'],
    ['Storage', 'Firebase Storage', '3D file storage, PDF archive'],
    ['Cloud Functions', 'Firebase Cloud Functions', 'AI analysis (Claude API)'],
    ['Styling', 'Tailwind CSS + shadcn/ui', 'Utility-first styling, consistent design'],
    ['Build', 'Vite 5', 'Fast HMR, ESBuild bundling'],
  ];

  const colW = [32, 42, CONTENT_W - 74];
  for (let i = 0; i < stack.length; i++) {
    tableRow(stack[i], colW, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  curY += 4;
  subHeading('2.3 Module Location');
  codeBlock([
    'src/modules/workshop-viewer/',
    '  34 files  |  ~8,924 lines of TypeScript/TSX',
  ]);

  pageFooter();
}

// ─── Section 3: File Structure ───────────────────────────────────────────────

function renderSection3() {
  addPage();
  sectionHeading('3', 'File Structure');

  bodyText('The module is organized into 8 directories following the DawinOS module convention:');
  curY += 2;

  const files = [
    ['Directory', 'File', 'Lines', 'Purpose'],
    ['pages/', 'WorkshopViewerPage.tsx', '338', 'Main page layout, state orchestration'],
    ['components/', 'ThreeViewport.tsx', '712', 'WebGL 3D viewport, camera, lighting'],
    ['', 'FileUploadZone.tsx', '627', 'Drag-drop upload + project browser'],
    ['', 'PrintPackageDialog.tsx', '239', 'PDF export config dialog'],
    ['', 'PartTree.tsx', '206', 'Hierarchical part tree sidebar'],
    ['', 'DimensionPanel.tsx', '183', 'Dimension inspector panel'],
    ['', 'ViewControls.tsx', '155', 'View presets, edge/dim toggles'],
    ['', 'CutListTable.tsx', '137', 'Cut list data table'],
    ['', 'ViewerToolbar.tsx', '69', 'Top toolbar with actions'],
    ['services/', 'printPackageService.ts', '1274', 'Multi-sheet A3 PDF generator'],
    ['', 'aiPrintProcessor.ts', '489', 'AI analysis + dimension merge'],
    ['', 'assemblyEngine.ts', '425', 'Assembly detection + tree build'],
    ['', 'parser3ds.ts', '274', 'Binary .3ds chunk parser'],
    ['', 'dimensionEngine.ts', '249', 'Bbox-based dimension detection'],
    ['', 'parserCsv.ts', '236', 'Cut list CSV parser'],
    ['', 'projectContextService.ts', '226', 'Design Manager context resolver'],
    ['', 'parserDxf.ts', '213', 'DXF 2D drawing parser'],
    ['', 'workshopViewerService.ts', '187', 'Firestore session CRUD'],
    ['', 'geometryEngine.ts', '184', 'Bbox computation, role classify'],
    ['', 'partsSyncService.ts', '179', 'Parts sync to Design Manager'],
    ['', 'deliverableAttachmentService.ts', '136', 'PDF attach to deliverables'],
    ['', 'hiddenLineEngine.ts', '78', 'Visibility classification'],
    ['', 'explodeEngine.ts', '88', 'Explode animation positions'],
    ['hooks/', 'useModelParser.ts', '199', 'File parse orchestration hook'],
    ['', 'usePartSelection.ts', '129', 'Part selection + expand state'],
    ['', 'usePrintPackage.ts', '74', 'PDF generation state hook'],
    ['', 'useViewerSession.ts', '74', 'Firestore session persistence'],
    ['utils/', 'titleBlockRenderer.ts', '381', 'DF-Style 1 title block renderer'],
    ['', 'projectionUtils.ts', '180', 'Orthographic + isometric projection'],
    ['', 'silhouetteExtractor.ts', '138', 'Coplanar face merge + edges'],
    ['types/', 'workshop-viewer.types.ts', '388', 'All TypeScript interfaces'],
    ['constants/', 'workshop-viewer.constants.ts', '301', 'View presets, colours, patterns'],
    ['schemas/', 'printPackageSchema.ts', '47', 'Zod schema for PDF config'],
    ['', 'index.ts', '109', 'Module barrel exports'],
  ];

  const colW2 = [28, 46, 12, CONTENT_W - 86];
  for (let i = 0; i < files.length; i++) {
    tableRow(files[i], colW2, i === 0, i === 0 ? LIGHT_GREY : (i % 2 === 0 ? [245, 245, 250] : null));
  }

  curY += 4;
  bodyText('Total: 34 files, 8,924 lines of TypeScript/TSX.');

  pageFooter();
}

// ─── Section 4: Data Flow Architecture ───────────────────────────────────────

function renderSection4() {
  addPage();
  sectionHeading('4', 'Data Flow Architecture');

  subHeading('4.1 File Upload to Rendering Pipeline');
  bodyText('The data flow proceeds through five distinct stages:');
  curY += 1;

  bulletPoint('Stage 1 - File Ingestion: User drops .3ds and/or .csv file(s) onto FileUploadZone. The useModelParser hook dispatches to the appropriate parser based on file extension.');
  bulletPoint('Stage 2 - Binary Parsing: parser3ds.ts reads the binary chunk hierarchy (0x4D4D main, 0x3D3D editor, 0x4000 objects, 0x4100 mesh) and extracts vertices, faces, and material mappings into a ParsedModel.');
  bulletPoint('Stage 3 - Assembly Detection: assemblyEngine.ts normalizes PolyBoard names, classifies part roles using 22 regex patterns, detects sub-assemblies (shaker doors, drawer boxes) via spatial proximity + role matching, and builds the PartTreeNode hierarchy.');
  bulletPoint('Stage 4 - Dimension Computation: dimensionEngine.ts analyzes bounding boxes of classified parts to detect horizontal chains (shelves, divisions), vertical chains (fixed shelves, rails), and opening dimensions. Results are tagged with tiers (1=overall, 2=intermediate, 3=detail) and colour codes.');
  bulletPoint('Stage 5 - Rendering: ThreeViewport.tsx creates the Three.js scene from ParsedModel geometry. printPackageService.ts renders orthographic and isometric projections to PDF via jsPDF.');

  curY += 4;
  subHeading('4.2 State Management Architecture');
  bodyText('State is managed at three levels:');
  curY += 1;

  bulletPoint('Component-local state: ViewerState (current view, edge/dim toggles) managed via useState in WorkshopViewerPage');
  bulletPoint('Custom hooks: useModelParser (ParsedModel, CutListEntry[], PartTreeNode[], MeshCutListLink[], DimensionSet), usePartSelection (selectedPartId, expandedIds, explodedIds), usePrintPackage (PDF blob, progress, loading)');
  bulletPoint('Firestore persistence: useViewerSession reads/writes ViewerSession documents to persist sessions across page reloads and share between team members');

  curY += 4;
  subHeading('4.3 Cross-Module Data Flow');

  codeBlock([
    '  Design Manager                Workshop Viewer              Manufacturing',
    '  +----------------+           +------------------+         +---------------+',
    '  | designProjects | --------> | projectContext   | ------> | mfgOrders     |',
    '  | designItems    |  resolve  | viewerSessions   |  attach | mfgOrderDocs  |',
    '  | deliverables   | <-------- | (PDF, model)     | ------> |               |',
    '  +----------------+           +------------------+         +---------------+',
    '',
    '  Flow: URL params (projectId, itemId, moId) -> resolveFromUrlParams()',
    '       -> Firestore reads -> ProjectContext populated',
    '       -> Auto-load model from Storage -> Generate PDF -> Attach as deliverable',
  ]);

  pageFooter();
}

// ─── Section 5: Data Model ───────────────────────────────────────────────────

function renderSection5() {
  addPage();
  sectionHeading('5', 'Data Model');

  subHeading('5.1 Core TypeScript Interfaces');
  bodyText('The module defines 25+ interfaces across 388 lines in workshop-viewer.types.ts. The key types and their relationships:');
  curY += 2;

  const types = [
    ['Interface', 'Key Fields', 'Used By'],
    ['ParsedModel', 'source, fileName, objects[], materials{}', 'All services, ThreeViewport'],
    ['MeshObject', 'name, vertices (F32), faces (U16), material', 'parser3ds, geometryEngine'],
    ['MaterialDef', 'diffuse: [r,g,b]', 'ThreeViewport materials'],
    ['PartTreeNode', 'id, name, role, assemblyType, children[]', 'PartTree, assemblyEngine'],
    ['CutListEntry', 'cabinet, partName, material, dims, edge', 'CutListTable, printPkg'],
    ['MeshCutListLink', 'meshObjectName, cutListIndex, confidence', 'assemblyEngine, PDF'],
    ['DimensionSet', 'overall{w,d,h}, intermediate[]', 'DimensionPanel, PDF'],
    ['IntermediateDim', 'type, view, positions[], tier, color', 'dimensionEngine, PDF'],
    ['PrintPackageConfig', 'projectInfo, includeSheets{}, tiers{}', 'PrintPackageDialog'],
    ['ViewerSession', 'id, orgId, modelUrl, projectInfo, status', 'workshopViewerService'],
    ['ProjectContext', 'projectId, clientName, source, parts[]', 'projectContextService'],
    ['ProjectedEdge', 'id, partName, a2d, b2d, visibility', 'projectionUtils, PDF'],
    ['ProjectedView', 'direction, edges[], bounds, w, h', 'printPackageService'],
  ];

  const colW3 = [32, 58, CONTENT_W - 90];
  for (let i = 0; i < types.length; i++) {
    tableRow(types[i], colW3, i === 0, i === 0 ? LIGHT_GREY : (i % 2 === 0 ? [245, 245, 250] : null));
  }

  curY += 6;
  subHeading('5.2 Type Relationships');
  codeBlock([
    '  ParsedModel',
    '    |-- objects: MeshObject[]',
    '    |     |-- name  <------> MeshCutListLink.meshObjectName',
    '    |-- materials: Record<string, MaterialDef>',
    '    |',
    '    +-- (assemblyEngine) --> PartTreeNode[]',
    '    |     |-- meshObjectNames[]  (links to MeshObject)',
    '    |     |-- cutListEntryIds[]  (links to CutListEntry)',
    '    |     |-- children[]         (recursive hierarchy)',
    '    |',
    '    +-- (dimensionEngine) --> DimensionSet',
    '    |     |-- overall: { width, depth, height }',
    '    |     |-- intermediate: IntermediateDimension[]',
    '    |',
    '    +-- (projectionUtils) --> ProjectedView[]',
    '          |-- edges: ProjectedEdge[]',
    '          |-- bounds, width, height',
  ]);

  curY += 4;
  subHeading('5.3 Firestore Document Structure');

  codeBlock([
    '  Firestore Collections:',
    '  ',
    '  organizations/{orgId}/viewerSessions/{sessionId}',
    '    -> ViewerSession document (model URL, project info, status)',
    '  ',
    '  organizations/{orgId}/designProjects/{projectId}',
    '    -> Source for ProjectContext.projectName, clientName, etc.',
    '  ',
    '  organizations/{orgId}/designProjects/{projectId}/items/{itemId}',
    '    -> Source for designItemParts[], materialPalette[], modelFileUrl',
    '  ',
    '  organizations/{orgId}/designProjects/{projectId}/items/{itemId}/deliverables/{delivId}',
    '    -> PDF print packages are attached here as deliverables',
    '  ',
    '  organizations/{orgId}/mfgOrders/{moId}',
    '    -> Manufacturing order context for Workshop Viewer',
    '  ',
    '  organizations/{orgId}/mfgOrders/{moId}/documents/{docId}',
    '    -> Reference documents attached from Workshop Viewer',
  ]);

  pageFooter();
}

// ─── Section 6: Core Algorithms ──────────────────────────────────────────────

function renderSection6() {
  addPage();
  sectionHeading('6', 'Core Algorithms');

  subHeading('6.1 3DS Binary Parsing (parser3ds.ts, 274 lines)');
  bodyText('The parser reads Autodesk 3DS binary files by traversing a chunk hierarchy. Each chunk has a 2-byte ID and 4-byte length. The parser extracts geometry from:');
  bulletPoint('0x4D4D (Main) -> 0x3D3D (Editor) -> 0x4000 (Object)');
  bulletPoint('0x4100 (Mesh) -> 0x4110 (Vertices), 0x4120 (Faces), 0x4130 (Material Assignment)');
  bulletPoint('0xAFFF (Material) -> 0xA000 (Name), 0xA020 (Diffuse Color)');
  bodyText('The parser handles PolyBoard-specific conventions: Z-up coordinate system, multi-mesh objects sharing materials, and instance naming patterns (e.g., "Door 1 [1]").');

  curY += 2;
  subHeading('6.2 Silhouette Edge Extraction (silhouetteExtractor.ts, 138 lines)');
  bodyText('Extracts visible boundary edges from 3D meshes for 2D projection:');
  bulletPoint('Build an edge map from triangle faces (shared edges have 2 face references)');
  bulletPoint('For each edge, test if the two adjacent face normals point in opposite directions relative to the view vector (dot product sign change)');
  bulletPoint('Merge coplanar faces to reduce edge count and eliminate internal subdivision lines');
  bulletPoint('Output: array of edge segments in 3D, tagged as "silhouette" or "crease" (angle > 15 degrees)');

  curY += 2;
  subHeading('6.3 Orthographic Projection (projectionUtils.ts, 180 lines)');
  bodyText('Projects 3D edges onto 2D planes for PDF elevation drawings. View mapping table:');

  const viewMap = [
    ['View', 'X-axis maps to', 'Y-axis maps to', 'Drop axis'],
    ['Front', '3D X (left-right)', '3D Z (up-down)', 'Y (depth)'],
    ['Back', '-3D X (mirrored)', '3D Z (up-down)', 'Y (depth)'],
    ['Right', '3D Y (depth)', '3D Z (up-down)', 'X (width)'],
    ['Left', '-3D Y (mirrored)', '3D Z (up-down)', 'X (width)'],
    ['Top', '3D X (left-right)', '3D Y (depth)', 'Z (height)'],
    ['Bottom', '3D X (left-right)', '-3D Y (mirrored)', 'Z (height)'],
  ];
  const colW4 = [22, 38, 38, CONTENT_W - 98];
  for (let i = 0; i < viewMap.length; i++) {
    tableRow(viewMap[i], colW4, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  curY += 4;
  subHeading('6.4 Isometric Projection');
  bodyText('Standard 30-degree isometric projection. The isometric matrix applies rotations of 30 degrees to the X and Y axes while preserving equal scaling on all three axes. PolyBoard models use Z-up, so a coordinate swap (Z to Y) is applied before projection.');

  curY += 2;
  subHeading('6.5 Hidden Line Classification (hiddenLineEngine.ts, 78 lines)');
  bodyText('For each projected edge, determines whether it is occluded by other geometry:');
  bulletPoint('Orthographic: For each edge midpoint, cast a ray along the view direction and test for mesh intersections closer to the camera');
  bulletPoint('Isometric: Same ray-cast but along the isometric view vector');
  bulletPoint('Hidden edges are rendered in "faint" mode (0.15px, 20% opacity) or fully hidden based on user preference');

  ensureSpace(40);
  curY += 2;
  subHeading('6.6 Intermediate Dimension Detection (dimensionEngine.ts, 249 lines)');
  bodyText('Automatically detects shelf positions, division spacing, and opening sizes:');
  bulletPoint('Step 1: Classify all mesh objects into structural roles using geometryEngine.classifyPartRole()');
  bulletPoint('Step 2: For each view direction, collect parts with matching roles (e.g., shelves on front view)');
  bulletPoint('Step 3: Sort by position along the relevant axis and extract position chains');
  bulletPoint('Step 4: Assign to Tier 2 (intermediate) or Tier 3 (detail/openings) based on role significance');
  bulletPoint('Step 5: Tag with colour codes from DIMENSION_COLORS constant');

  pageFooter();
}

function renderSection6b() {
  addPage();

  subHeading('6.7 Assembly Detection (assemblyEngine.ts, 425 lines)');
  bodyText('The assembly engine builds a hierarchical tree from flat mesh objects:');
  bulletPoint('Pass 1 - Name Normalization: Parse PolyBoard names into baseName, instance, variant, subIndex using regex');
  bulletPoint('Pass 2 - Role Classification: Match 22 regex patterns from PART_ROLE_PATTERNS to assign structural roles (side, shelf, door, drawer, rail, stile, panel, etc.)');
  bulletPoint('Pass 3 - Assembly Grouping: Group parts by spatial proximity (bounding box overlap) and match child role sets against 7 ASSEMBLY_PATTERNS (shaker_door, drawer_box, carcase, etc.)');
  bulletPoint('Pass 4 - Tree Construction: Build PartTreeNode hierarchy with computed bounding boxes and dimension summaries');

  curY += 3;
  subHeading('6.8 Mesh-to-CutList Linking (assemblyEngine.ts)');
  bodyText('Bidirectional linkage between 3D mesh objects and CSV cut list rows using a 4-pass matching strategy:');
  curY += 1;

  const passes = [
    ['Pass', 'Strategy', 'Confidence', 'Match Rate'],
    ['1', 'Exact name match (normalized)', 'exact', '~60-70%'],
    ['2', 'Dimension match (L x W within 1mm)', 'fuzzy', '~15-20%'],
    ['3', 'Material + dimension match', 'fuzzy', '~5-10%'],
    ['4', 'Unmatched remainder', 'unmatched', '~5-10%'],
  ];
  const colW5 = [14, 55, 30, CONTENT_W - 99];
  for (let i = 0; i < passes.length; i++) {
    tableRow(passes[i], colW5, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  pageFooter();
}

// ─── Section 7: Three.js Viewport ────────────────────────────────────────────

function renderSection7() {
  addPage();
  sectionHeading('7', 'Three.js Viewport');

  bodyText('ThreeViewport.tsx (712 lines) is the primary interactive component. It creates a full WebGL scene from the ParsedModel geometry.');

  subHeading('7.1 Scene Setup');
  bulletPoint('Renderer: WebGLRenderer with antialiasing enabled, pixel ratio = devicePixelRatio');
  bulletPoint('Camera: PerspectiveCamera, FOV 45, near 1mm, far 50,000mm');
  bulletPoint('Lighting: Ambient (intensity 0.5) + directional key light (0.8) + rim light (0.3, steel-blue #B0C4DE)');
  bulletPoint('Background: Off-white #F5F3EE matching DF brand palette');
  bulletPoint('Grid: 20 subdivisions, colours #CCCCCC / #E8E8E8');

  curY += 2;
  subHeading('7.2 Coordinate Transform');
  bodyText('PolyBoard exports 3DS files in a Z-up coordinate system, while Three.js uses Y-up. The transform applied at mesh creation:');
  codeBlock([
    '  PolyBoard (Z-up)    Three.js (Y-up)',
    '  X  ->  X            (unchanged)',
    '  Y  ->  Z            (PolyBoard depth -> Three.js depth)',
    '  Z  ->  Y            (PolyBoard height -> Three.js up)',
  ]);

  curY += 2;
  subHeading('7.3 View Presets (8 views)');

  const presets = [
    ['View', 'Theta', 'Phi', 'Description'],
    ['Front', '0', 'pi/2', 'Front elevation'],
    ['Back', 'pi', 'pi/2', 'Rear elevation'],
    ['Right', 'pi/2', 'pi/2', 'Right side elevation'],
    ['Left', '-pi/2', 'pi/2', 'Left side elevation'],
    ['Top', '0', '0.01', 'Plan view (near-zero phi)'],
    ['Bottom', '0', 'pi-0.01', 'Bottom view'],
    ['Iso SW', 'pi/4', 'pi/3', 'Standard isometric (SW)'],
    ['Iso NE', 'pi+pi/4', 'pi/3', 'Rear isometric (NE)'],
  ];
  const colW6 = [22, 22, 22, CONTENT_W - 66];
  for (let i = 0; i < presets.length; i++) {
    tableRow(presets[i], colW6, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  curY += 4;
  subHeading('7.4 Part Selection & Highlighting');
  bulletPoint('Raycasting: On click, cast a ray from the camera through the mouse position and find the first intersected mesh');
  bulletPoint('Selection: Selected part is highlighted with #C8962E (gold) material colour');
  bulletPoint('Dimming: Non-selected parts are dimmed to 12% opacity to isolate the selection');
  bulletPoint('Assembly selection: When a part belongs to an assembly, the entire assembly is highlighted');

  curY += 2;
  subHeading('7.5 3D Dimension Rendering');
  bulletPoint('Tier 1 (Overall): Red #E63946 for width/depth, Blue #2563EB for height');
  bulletPoint('Tier 2 (Intermediate): Gold #C8962E for horizontal chains, Green #16A34A for vertical chains');
  bulletPoint('Tier 3 (Detail): Purple #9333EA for opening dimensions');
  bulletPoint('Labels: White pill-shaped backgrounds (radius 0.8mm) with dimension text');
  bulletPoint('Lines: Extension lines from part edges to dimension lines with arrow heads');

  curY += 2;
  subHeading('7.6 Explode Animation');
  bodyText('When an assembly node is selected, the user can toggle explode mode. Parts are displaced outward along their offset from the assembly centroid. Gap = part dimension x 1.5 multiplier, minimum 20mm. Animation duration: 300ms with ease-in-out.');

  pageFooter();
}

// ─── Section 8: PDF Print Package ────────────────────────────────────────────

function renderSection8() {
  addPage();
  sectionHeading('8', 'PDF Print Package');

  bodyText('The print package is the primary deliverable. printPackageService.ts (1,274 lines) generates a multi-sheet A3 landscape PDF using jsPDF.');

  subHeading('8.1 A3 Landscape Layout');
  codeBlock([
    '  +-------------------------------------------------------+--------+',
    '  |                                                       | Title  |',
    '  |            Content Area (332 x 277mm)                 | Block  |',
    '  |                                                       | (68mm) |',
    '  |  10mm margins on all sides                           |        |',
    '  |                                                       |        |',
    '  |  Total: 420 x 297mm (A3 landscape)                   |        |',
    '  +-------------------------------------------------------+--------+',
  ]);
  bodyText('Page dimensions: 420 x 297mm. Margins: 10mm all sides. Title block: 68mm wide, right side. Content area: 332 x 277mm.');

  curY += 2;
  subHeading('8.2 Sheet Sequence');

  const sheets = [
    ['Sheet #', 'Drawing Number', 'Content', 'Views/Data'],
    ['1', 'I001', 'Cover Sheet', 'Project info, DF branding'],
    ['2', 'I002', 'Contents & Legend', 'Sheet index, dim. legend'],
    ['3', 'I100', 'Isometric View', 'SW isometric with dims'],
    ['4', 'I101', 'Front Elevation', 'Front view with dims'],
    ['5', 'I102', 'Rear Elevation', 'Back view with dims'],
    ['6', 'I103', 'Plan View', 'Top-down view with dims'],
    ['7', 'I104', 'Three-View', 'Front + right + top'],
    ['8+', 'I2xx', 'Part Details', 'Per-part/assembly detail'],
    ['N', 'I301', 'Cut List', 'Full material cut list'],
    ['N+1', 'I302', 'Edge Band Schedule', 'Edge banding summary'],
  ];
  const colW7 = [16, 28, 38, CONTENT_W - 82];
  for (let i = 0; i < sheets.length; i++) {
    tableRow(sheets[i], colW7, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  curY += 4;
  subHeading('8.3 Title Block Specification (DF-Style 1)');
  bodyText('The title block occupies a 68mm-wide strip on the right side of every sheet. It is rendered by titleBlockRenderer.ts (381 lines) and contains 15 fields:');
  curY += 1;

  const tbFields = [
    ['Field', 'Size', 'Content'],
    ['Logo', '16pt', 'DF logo image (from Firestore)'],
    ['Contact', '6pt', 'Website, phone, email'],
    ['General Notes', '6pt', 'Standard production notes'],
    ['Project Name', '7pt bold', 'From ProjectContext'],
    ['Client', '7pt bold', 'Client name'],
    ['Address', '7pt bold', 'Project address'],
    ['Date Modified', '7pt bold', 'Generation date'],
    ['Project No.', '7pt bold', 'Project code'],
    ['Drawn', '7pt bold', 'Author initials'],
    ['Checked', '7pt bold', 'Reviewer initials'],
    ['Drawing Title', '7pt bold', 'Sheet-specific title'],
    ['Project Stage', '7pt bold', 'Design/tender/construct'],
    ['Paper Size', '7pt bold', 'Always "A3"'],
    ['Drawing Number', '36pt bold', 'I-series number'],
    ['Revision', '8pt bold', 'Rev letter (A, B, C...)'],
  ];
  const colW8 = [30, 20, CONTENT_W - 50];
  for (let i = 0; i < tbFields.length; i++) {
    tableRow(tbFields[i], colW8, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  pageFooter();
}

function renderSection8b() {
  addPage();

  subHeading('8.4 Dimension Rendering System');
  bodyText('Dimensions are rendered on PDF sheets using a 3-tier colour coding system:');
  curY += 1;

  const dimTiers = [
    ['Tier', 'Colour', 'Hex', 'Content'],
    ['1 (Overall)', 'Red / Blue', '#E63946 / #2563EB', 'Overall W, D, H'],
    ['2 (Intermediate)', 'Gold / Green', '#C8962E / #16A34A', 'Shelf spacing, divisions'],
    ['3 (Detail)', 'Purple', '#9333EA', 'Opening sizes, recesses'],
  ];
  const colW9 = [28, 28, 38, CONTENT_W - 94];
  for (let i = 0; i < dimTiers.length; i++) {
    tableRow(dimTiers[i], colW9, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  bodyText('Labels use white pill backgrounds (corner radius 0.8mm, padding 1.5mm x 0.8mm) to ensure readability against drawing lines. Font sizes decrease with tier: 5.5pt, 5pt, 4.5pt.');

  curY += 3;
  subHeading('8.5 Edge Rendering');
  bulletPoint('Visible edges: #1B2A4A (navy), 0.5pt weight, 100% opacity');
  bulletPoint('Hidden edges (faint mode): #1B2A4A, 0.15pt weight, 20% opacity');
  bulletPoint('Crease angle threshold: 15 degrees (edges between faces angled more than this are shown as creases)');

  curY += 3;
  subHeading('8.6 Cut List Table Format');
  bodyText('The cut list sheet (I301) renders a table with the following column proportions:');

  const clCols = [
    ['Column', 'Width %', 'Content'],
    ['Part', '28%', 'Part name (cabinet prefix)'],
    ['Material', '18%', 'Board material name'],
    ['T', '5%', 'Thickness (mm)'],
    ['Qty', '5%', 'Quantity'],
    ['Length', '10%', 'Cut length (mm)'],
    ['Width', '10%', 'Cut width (mm)'],
    ['L1, L2', '12%', 'Length edge banding (Y/N)'],
    ['W1, W2', '12%', 'Width edge banding (Y/N)'],
  ];
  const colWCL = [22, 18, CONTENT_W - 40];
  for (let i = 0; i < clCols.length; i++) {
    tableRow(clCols[i], colWCL, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  pageFooter();
}

// ─── Section 9: AI Enhancement Layer ─────────────────────────────────────────

function renderSection9() {
  addPage();
  sectionHeading('9', 'AI Enhancement Layer');

  bodyText('The AI enhancement layer (aiPrintProcessor.ts, 489 lines) uses a Cloud Function to analyse models and enrich the print package with intelligent annotations.');

  subHeading('9.1 Cloud Function: analyzeWorkshopModel');
  bodyText('A Firebase Cloud Function that accepts a model summary and returns enriched analysis:');
  bulletPoint('Input: Serialized part list with dimensions, materials, assembly types, and cut list');
  bulletPoint('Processing: Calls the Claude API with a structured prompt asking for material matches, discrepancy detection, and production notes');
  bulletPoint('Output: WorkshopAnalysisResult with materialMatches[], partDiscrepancies[], and productionNotes[]');
  bulletPoint('Caching: Results are stored on the ViewerSession document to avoid re-analysis');

  curY += 3;
  subHeading('9.2 Model Summarization Pipeline');
  bodyText('Before sending to the AI, the model is summarized client-side:');
  bulletPoint('Part summary: For each PartTreeNode, extract name, role, dimensions, material, and assembly membership');
  bulletPoint('Material palette: List of materials from ProjectContext.materialPalette with codes and thicknesses');
  bulletPoint('Cut list summary: Condensed version of CSV data with totals per material');
  bulletPoint('Assembly summary: Detected assemblies with child part counts and types');

  curY += 3;
  subHeading('9.3 Rule-Based Fallback (Layer 1)');
  bodyText('When the AI Cloud Function is unavailable or the analysis confidence is low, a deterministic Layer 1 provides baseline functionality:');
  bulletPoint('Material matching: Exact string comparison between model material names and palette entries');
  bulletPoint('Dimension validation: Compare mesh bbox dimensions against cut list L x W within 1mm tolerance');
  bulletPoint('Missing part detection: Parts in cut list but not in model, and vice versa');

  curY += 3;
  subHeading('9.4 Dimension Merging Strategy');
  bodyText('When AI-suggested dimensions conflict with computed dimensions, the merge strategy is:');
  bulletPoint('Priority 1: Computed dimensions from mesh geometry (always accurate)');
  bulletPoint('Priority 2: AI-suggested corrections for intermediate dimensions (e.g., noting that a shelf is adjustable)');
  bulletPoint('Priority 3: AI-generated annotations (production notes, assembly sequence)');

  pageFooter();
}

// ─── Section 10: Cross-Module Integration ────────────────────────────────────

function renderSection10() {
  addPage();
  sectionHeading('10', 'Cross-Module Integration');

  subHeading('10.1 Design Manager Integration');
  bodyText('The Workshop Viewer integrates with the Design Manager through projectContextService.ts (226 lines):');
  bulletPoint('Context resolution: URL parameters (projectId, itemId) are resolved to a ProjectContext by reading Firestore documents from designProjects and their items/deliverables sub-collections');
  bulletPoint('Parts synchronization: partsSyncService.ts (179 lines) syncs detected parts back to the design item, updating part dimensions and materials from the 3D model analysis');
  bulletPoint('Deliverable attachment: deliverableAttachmentService.ts (136 lines) uploads the generated PDF print package to Firebase Storage and creates a deliverable document linked to the design item');
  bulletPoint('Model file browser: FileUploadZone includes a project browser that lists all .3ds/.obj/.fbx model files found across design item deliverables, allowing direct loading without manual upload');

  curY += 3;
  subHeading('10.2 Manufacturing Integration');
  bodyText('When launched from a manufacturing order (moId URL parameter):');
  bulletPoint('The MO context populates ProjectContext with manufacturing-specific fields');
  bulletPoint('Generated PDF print packages can be attached as reference documents on the MO');
  bulletPoint('The viewer session is linked to the MO for traceability');

  curY += 3;
  subHeading('10.3 Firebase Storage Paths');
  codeBlock([
    '  organizations/{orgId}/workshop-models/{sessionId}/{fileName}',
    '    -> Uploaded 3DS/DXF model files',
    '  ',
    '  organizations/{orgId}/workshop-packages/{sessionId}/{drawingNo}.pdf',
    '    -> Generated PDF print packages',
    '  ',
    '  organizations/{orgId}/design-projects/{projectId}/items/{itemId}/deliverables/',
    '    -> Attached deliverables (PDF, model files)',
  ]);

  curY += 3;
  subHeading('10.4 Firestore Collections Summary');

  const collections = [
    ['Collection Path', 'Purpose'],
    ['organizations/{orgId}/viewerSessions/{id}', 'Workshop Viewer session state'],
    ['organizations/{orgId}/designProjects/{id}', 'Design project context source'],
    ['.../designProjects/{id}/items/{itemId}', 'Design item parts & materials'],
    ['.../items/{itemId}/deliverables/{delivId}', 'Attached PDF/model files'],
    ['organizations/{orgId}/mfgOrders/{moId}', 'Manufacturing order context'],
    ['.../mfgOrders/{moId}/documents/{docId}', 'MO reference documents'],
  ];
  const colW10 = [85, CONTENT_W - 85];
  for (let i = 0; i < collections.length; i++) {
    tableRow(collections[i], colW10, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  pageFooter();
}

// ─── Section 11: Constants & Configuration ───────────────────────────────────

function renderSection11() {
  addPage();
  sectionHeading('11', 'Constants & Configuration');

  bodyText('All configuration is centralized in workshop-viewer.constants.ts (301 lines). Key constant groups:');

  curY += 2;
  subHeading('11.1 View Presets');
  bodyText('8 camera positions defined as {name, theta, phi} records. Theta = azimuth rotation, Phi = polar angle from top.');

  subHeading('11.2 Dimension Colours');
  const dimCols = [
    ['Key', 'Hex', 'Usage'],
    ['overall_width', '#E63946 (Red)', 'Tier 1 overall W/D'],
    ['overall_height', '#2563EB (Blue)', 'Tier 1 overall height'],
    ['horizontal', '#C8962E (Gold)', 'Tier 2 horizontal chains'],
    ['vertical', '#16A34A (Green)', 'Tier 2 vertical chains'],
    ['detail', '#9333EA (Purple)', 'Tier 3 openings/detail'],
  ];
  const colWDC = [28, 32, CONTENT_W - 60];
  for (let i = 0; i < dimCols.length; i++) {
    tableRow(dimCols[i], colWDC, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  curY += 3;
  subHeading('11.3 DF Brand Colours');
  const brandCols = [
    ['Name', 'Hex', 'Usage'],
    ['Boysenberry', '#872E5C', 'Primary accent'],
    ['Cashmere', '#E2CAA9', 'Warm accent, separators'],
    ['Seafoam', '#7ABDCD', 'Info highlights'],
    ['Pesto', '#8A7D4B', 'Earth tone accent'],
    ['Navy', '#1B2A4A', 'Headings, borders, text'],
    ['Off-White', '#F5F3EE', 'Backgrounds, viewport'],
  ];
  const colWBC = [25, 20, CONTENT_W - 45];
  for (let i = 0; i < brandCols.length; i++) {
    tableRow(brandCols[i], colWBC, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  curY += 3;
  subHeading('11.4 Part Role Patterns');
  bodyText('22 regex patterns (PART_ROLE_PATTERNS) classify PolyBoard mesh names into 16 structural roles: side, top_bottom, vertical_division, shelf, back, door, drawer, drawer_component, bar, rail, stile, panel, muntin, counter_front, and other. Patterns handle negative lookaheads (e.g., "Top" but not "Top Rail" or "Top Drawer").');

  curY += 2;
  subHeading('11.5 Assembly Detection Patterns');
  bodyText('7 ASSEMBLY_PATTERNS define sub-assembly types by keyword matching and expected child roles: shaker_door (rail + stile + panel), slab_door (single piece), raised_panel_door, drawer_box (4 sides + bottom), drawer_front, shelf_unit, and countertop.');

  curY += 2;
  subHeading('11.6 Scene Defaults');
  bulletPoint('Background: 0xF5F3EE | Ambient: 0.5 | Key light: 0.8 | Rim: 0.3');
  bulletPoint('Default material: 0xCEA264 (warm oak) | Selected: 0xC8962E (gold)');
  bulletPoint('Camera FOV: 45 | Near: 1mm | Far: 50,000mm | Grid: 20 subdivisions');

  curY += 2;
  subHeading('11.7 Edge Rendering');
  bulletPoint('Visible: navy #1B2A4A, 0.5pt, 100% opacity');
  bulletPoint('Hidden (faint): navy #1B2A4A, 0.15pt, 20% opacity');
  bulletPoint('Crease threshold: 15 degrees');

  pageFooter();
}

// ─── Section 12: Component Hierarchy ─────────────────────────────────────────

function renderSection12() {
  addPage();
  sectionHeading('12', 'Component Hierarchy');

  bodyText('The Workshop Viewer page is composed of 9 components arranged in a sidebar + viewport layout:');
  curY += 2;

  codeBlock([
    '  WorkshopViewerPage (338 lines)',
    '  |',
    '  +-- ViewerToolbar',
    '  |     Props: modelFileName, csvFileName, meshLinks, onExportPdf, hasModel',
    '  |',
    '  +-- [Design Context Banner]  (conditional: when projectContext exists)',
    '  |',
    '  +-- Sidebar (260px, shown when model loaded)',
    '  |   |',
    '  |   +-- ViewControls',
    '  |   |     Props: viewerState, onViewChange, onToggleEdges,',
    '  |   |            onToggleDimensions, onHiddenLineModeChange,',
    '  |   |            onResetView, onExplodeToggle, canExplode',
    '  |   |',
    '  |   +-- Tabs (Parts | Cut List | Dims)',
    '  |   |   |',
    '  |   |   +-- PartTree',
    '  |   |   |     Props: nodes, selectedId, expandedIds, meshLinks,',
    '  |   |   |            onSelect, onToggleExpand, onExplode',
    '  |   |   |',
    '  |   |   +-- CutListTable',
    '  |   |   |     Props: entries, meshLinks, partTree, selectedPartId, onRowClick',
    '  |   |   |',
    '  |   |   +-- DimensionPanel',
    '  |   |         Props: dimensions, selectedNode, cutList, meshLinks',
    '  |   |',
    '  |   +-- FileUploadZone (compact mode)',
    '  |         Props: onModelFile, onMultipleModelFiles, onCsvFile,',
    '  |                modelFileName, csvFileName, projectContext',
    '  |',
    '  +-- Viewport Area (flex-1)',
    '  |   |',
    '  |   +-- ThreeViewport  (when model loaded)',
    '  |   |     Props: model, viewerState, partTree, dimensions, onPartSelect',
    '  |   |',
    '  |   +-- FileUploadZone  (when no model, full-page mode)',
    '  |         Props: + onProjectContextChange',
    '  |',
    '  +-- PrintPackageDialog',
    '        Props: open, onClose, onGenerate, progress, loading, projectContext',
  ]);

  curY += 4;
  subHeading('Hook Dependencies');
  codeBlock([
    '  useModelParser     -> parser3ds, parserCsv, assemblyEngine, dimensionEngine',
    '  usePartSelection   -> (operates on PartTreeNode[])',
    '  usePrintPackage    -> printPackageService, titleBlockRenderer, projectionUtils',
    '  useViewerSession   -> workshopViewerService (Firestore CRUD)',
  ]);

  pageFooter();
}

// ─── Section 13: Testing Requirements ────────────────────────────────────────

function renderSection13() {
  addPage();
  sectionHeading('13', 'Testing Requirements');

  subHeading('13.1 Unit Test Targets');
  bodyText('The following services contain pure functions suitable for unit testing:');
  curY += 1;

  const unitTests = [
    ['Service', 'Functions to Test', 'Test Strategy'],
    ['parser3ds.ts', 'parse3dsBuffer()', 'Binary fixture files, known vertex/face counts'],
    ['parserCsv.ts', 'parseCutListCsv()', 'Sample CSV strings, edge cases (empty rows, quotes)'],
    ['geometryEngine.ts', 'computeBoundingBox(), classifyPartRole()', 'Known geometry arrays, name pattern coverage'],
    ['assemblyEngine.ts', 'normalizePartName(), buildPartTree()', 'PolyBoard naming edge cases, assembly groupings'],
    ['dimensionEngine.ts', 'computeDimensions()', 'Mock ParsedModel with known shelf positions'],
    ['silhouetteExtractor.ts', 'extractSilhouetteEdges()', 'Simple box geometry (12 edges expected)'],
    ['projectionUtils.ts', 'projectEdges()', 'Known 3D points -> expected 2D coordinates'],
    ['hiddenLineEngine.ts', 'classifyVisibility()', 'Two-box occlusion scenario'],
  ];
  const colWUT = [35, 52, CONTENT_W - 87];
  for (let i = 0; i < unitTests.length; i++) {
    tableRow(unitTests[i], colWUT, i === 0, i === 0 ? LIGHT_GREY : null);
  }

  curY += 5;
  subHeading('13.2 Integration Test Scenarios');
  bulletPoint('End-to-end parse: Load a real PolyBoard .3ds file -> verify ParsedModel -> verify PartTreeNode hierarchy -> verify DimensionSet');
  bulletPoint('PDF generation: Load model + CSV -> generate print package -> verify page count, sheet numbering, title block fields');
  bulletPoint('Design Manager flow: Navigate with URL params -> verify ProjectContext population -> verify model auto-load');
  bulletPoint('Session persistence: Create session -> reload page -> verify session restoration from Firestore');

  curY += 4;
  subHeading('13.3 Verification Checklist');

  bodyText('3D Viewport:');
  bulletPoint('All mesh objects rendered with correct materials', 4);
  bulletPoint('View presets snap to correct camera positions', 4);
  bulletPoint('Part selection highlights correct mesh and dims selection', 4);
  bulletPoint('Explode animation separates assembly parts correctly', 4);
  bulletPoint('Edge rendering toggles between visible/hidden/faint', 4);
  bulletPoint('Dimension sprites visible and correctly positioned in 3D', 4);

  curY += 2;
  bodyText('PDF Export:');
  bulletPoint('Cover page shows correct project info and branding', 4);
  bulletPoint('Isometric and elevation views have correct orientation', 4);
  bulletPoint('Dimensions match 3D viewport values exactly', 4);
  bulletPoint('Hidden lines rendered in faint mode by default', 4);
  bulletPoint('Cut list table includes all entries from CSV', 4);
  bulletPoint('Title block fields populated from ProjectContext', 4);
  bulletPoint('Drawing numbers follow I-series convention', 4);

  pageFooter();
}

// ─── Section 14: Future Roadmap ──────────────────────────────────────────────

function renderSection14() {
  addPage();
  sectionHeading('14', 'Future Roadmap');

  bodyText('Planned enhancements to the Workshop Viewer module, organized by development phase:');
  curY += 3;

  subHeading('Phase 2: Cloud Function PDF Generation');
  bodyText('Target: Q2 2026');
  bulletPoint('Move PDF generation from client-side to a Firebase Cloud Function for reliability and performance');
  bulletPoint('Accept a JSON payload (ParsedModel summary + config) and return a Storage URL');
  bulletPoint('Enable background generation for large models (50+ parts) without blocking the UI');
  bulletPoint('Support batch generation: multiple design items in a single request');

  curY += 3;
  subHeading('Phase 3: CNC Export (DXF per-part)');
  bodyText('Target: Q3 2026');
  bulletPoint('Generate individual DXF files for each part, suitable for CNC routing');
  bulletPoint('Include edge banding annotations and grain direction markers');
  bulletPoint('Export nested cutting layouts as DXF for sheet-good optimization');
  bulletPoint('Integration with the Manufacturing module CNC workflow');

  curY += 3;
  subHeading('Phase 4: Interactive Dimensioning');
  bodyText('Target: Q4 2026');
  bulletPoint('Allow users to add custom dimensions by clicking two points on the 3D model');
  bulletPoint('Persist custom dimensions on the ViewerSession for reuse');
  bulletPoint('Include user-defined dimensions in PDF export alongside computed ones');
  bulletPoint('Snap-to-edge and snap-to-vertex for precise point selection');

  curY += 3;
  subHeading('Phase 5: PolyBoard .ppb Direct Parsing');
  bodyText('Target: Q1 2027');
  bulletPoint('Parse PolyBoard native .ppb project files directly, eliminating the .3ds export step');
  bulletPoint('Access richer metadata: material assignments, hardware schedules, machining operations');
  bulletPoint('Automatic cut list extraction from .ppb (no separate CSV required)');
  bulletPoint('Bi-directional sync: push dimension corrections back to PolyBoard');

  curY += 3;
  subHeading('Phase 6: AR Viewer (QR Code Scan)');
  bodyText('Target: Q2 2027');
  bulletPoint('Generate a QR code on each print package sheet that links to a WebXR viewer');
  bulletPoint('Artisans scan the QR on the shop floor to see a 3D overlay of the assembly');
  bulletPoint('AR annotations show dimension values, material names, and assembly sequence');
  bulletPoint('Real-time comparison: hold the device over the physical piece to verify dimensions');

  pageFooter();
}

// ─── Back Cover ──────────────────────────────────────────────────────────────

function renderBackCover() {
  addPage();

  // Navy band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 60, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text('DAWIN FINISHES', PAGE_W / 2, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...CASHMERE);
  doc.text('Custom Joinery & Interior Finishes', PAGE_W / 2, 42, { align: 'center' });

  // Document info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MID_GREY);

  const endNotes = [
    'DawinOS Workshop Viewer - Architectural Design Document v1.0',
    'March 2026',
    '',
    'This document is confidential and intended for internal use only.',
    'It describes the technical architecture of the Workshop Viewer module',
    'within the DawinOS platform, operated by Dawin Finishes Pty Ltd.',
    '',
    'For questions or clarification, contact the development team at:',
    'info@dawinfinishes.com',
    '',
    'Module: src/modules/workshop-viewer/',
    'Files: 34 | Lines: ~8,924 | TypeScript + React',
  ];

  let ey = 100;
  for (const line of endNotes) {
    doc.text(line, PAGE_W / 2, ey, { align: 'center' });
    ey += 7;
  }

  // Bottom bar
  doc.setFillColor(...NAVY);
  doc.rect(0, PAGE_H - 20, PAGE_W, 20, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text('dawinfinishes.com  |  info@dawinfinishes.com  |  0393 100 493', PAGE_W / 2, PAGE_H - 8, { align: 'center' });

  pageFooter();
}

// ─── Generate ────────────────────────────────────────────────────────────────

console.log('Generating Workshop Viewer Architecture Document...');

renderCover();
renderTOC();
renderSection1();
renderSection2();
renderSection3();
renderSection4();
renderSection5();
renderSection6();
renderSection6b();
renderSection7();
renderSection8();
renderSection8b();
renderSection9();
renderSection10();
renderSection11();
renderSection12();
renderSection13();
renderSection14();
renderBackCover();

const outputPath = join(homedir(), 'Downloads', 'DawinOS_Workshop_Viewer_Architecture_v1.0.pdf');
const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
writeFileSync(outputPath, pdfBuffer);

console.log(`PDF generated: ${outputPath}`);
console.log(`Total pages: ${pageNum}`);
console.log(`File size: ${(pdfBuffer.length / 1024).toFixed(0)} KB`);
