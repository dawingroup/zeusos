/**
 * Dawin File Management & Naming Policy v4
 *
 * All files follow kebab-case naming for cross-platform compatibility
 * and AI discoverability.
 *
 * Deliverable pattern:
 *   {ProjectCode}-{TypeCode}-{description}-{version}-{YYYYMMDD}.{ext}
 *   e.g. DF-2025-001-DWG-kitchen-layout-v02-20260328.dwg
 *
 * General file pattern:
 *   {ProjectCode}-{description}-{version}-{YYYYMMDD}.{ext}
 *   e.g. DF-2025-001-site-photos-v01-20260328.jpg
 */

// ─── Deliverable type → policy code mapping ──────────────────────────────────

/** Maps internal deliverableType keys to policy document codes */
export const DELIVERABLE_TYPE_CODES: Record<string, string> = {
  'concept-sketch': 'DWG',
  'mood-board': 'PRZ',
  '3d-model': 'MOC',
  'rendering': 'MOC',
  'shop-drawing': 'DWG',
  'cut-list': 'SPC',
  'bom': 'SPC',
  'assembly-instructions': 'SPC',
  'specification-sheet': 'SPC',
  'client-presentation': 'PRZ',
  // Phase 3 — immutable snapshot created at manufacturing handoff.
  'handoff-bundle': 'HANDOFF',
  'other': 'RPT',
};

/** Item category → policy code */
export const ITEM_CATEGORY_CODES: Record<string, string> = {
  furniture: 'FURN',
  decor: 'DECR',
  fixture: 'FIXT',
  artwork: 'ARTW',
  mockup: 'MOCK',
};

// ─── All type codes selectable in the upload form ────────────────────────────

/** Deliverable type codes */
export const DELIVERABLE_CODES = {
  DWG: 'Drawing',
  SPC: 'Specification',
  RPT: 'Report',
  PRZ: 'Presentation',
  MOC: 'Mockup / 3D Model',
  QTE: 'Quote',
  // Phase 3 — handoff-bundle ZIP carries all files shipped to production at
  // the moment of manufacturing handover. Immutable (status = 'approved'
  // on create, Firestore rule blocks non-admin writes).
  HANDOFF: 'Handoff Bundle',
} as const;

/** Advisory / accountability document type codes */
export const ADVISORY_DOC_CODES = {
  RCT: 'Receipt / Expense',
  INV: 'Invoice',
  DLN: 'Delivery Note',
  PO: 'Purchase Order',
  BL: 'Bill',
} as const;

/** Custom item category codes */
export const ITEM_CODES = {
  FURN: 'Furniture',
  DECR: 'Decor',
  FIXT: 'Fixture',
  ARTW: 'Artwork',
  MOCK: 'Mockup',
} as const;

/** Procured-item type codes (Naming Policy v4 §Procured Items) */
export const PROCURED_ITEM_CODES = {
  EQP: 'Equipment',
  SFT: 'Software',
  SVC: 'Service',
  CPN: 'Component',
  MAT: 'Material',
} as const;

/** All selectable type codes combined */
export const ALL_TYPE_CODES: Record<string, string> = {
  ...DELIVERABLE_CODES,
  ...ITEM_CODES,
  ...ADVISORY_DOC_CODES,
  ...PROCURED_ITEM_CODES,
};

// ─── Utility functions ───────────────────────────────────────────────────────

/** Convert text to kebab-case (lowercase, hyphens, strip special chars) */
export function toKebab(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip special chars
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '');           // trim leading/trailing hyphens
}

/**
 * Format version number per policy:
 *   1 → "v01", 2 → "v02", etc.
 *   If isFinal, returns "Final"
 */
export function formatVersion(version: number, isFinal?: boolean): string {
  if (isFinal) return 'Final';
  return `v${String(version).padStart(2, '0')}`;
}

/** Get today's date as YYYYMMDD */
export function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Extract file extension from a filename */
export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return '';
  return fileName.substring(dot + 1).toLowerCase();
}

/**
 * Build a policy-compliant filename.
 *
 * Pattern: {projectCode}-{typeCode}-{description}-{version}-{date}.{ext}
 * If no typeCode: {projectCode}-{description}-{version}-{date}.{ext}
 *
 * @example
 * buildPolicyName({
 *   projectCode: 'DF-2025-001',
 *   typeCode: 'DWG',
 *   description: 'kitchen-layout',
 *   version: 2,
 *   extension: 'dwg',
 * })
 * // → "DF-2025-001-DWG-kitchen-layout-v02-20260328.dwg"
 */
export function buildPolicyName(params: {
  projectCode: string;
  typeCode?: string;
  description: string;
  version: number;
  isFinal?: boolean;
  extension: string;
}): string {
  const { projectCode, typeCode, description, version, isFinal, extension } = params;

  const parts = [projectCode];
  if (typeCode) parts.push(typeCode);
  if (description) parts.push(toKebab(description));
  parts.push(formatVersion(version, isFinal));
  parts.push(todayStamp());

  const name = parts.join('-');
  return extension ? `${name}.${extension}` : name;
}
