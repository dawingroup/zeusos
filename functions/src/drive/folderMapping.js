/**
 * Maps a `ManagedFile` to the correct `01..07` subfolder under
 * `01_Active-Projects/{code}_{client}_{type}/`.
 *
 * Policy source: `Dawin-Shared-Drive-Architecture v3` §01_Active-Projects.
 * The seven subfolders, in order:
 *
 *   01_Brief-&-Scope
 *   02_Design
 *   03_Engineering
 *   04_Procurement
 *   05_Production
 *   06_Delivery
 *   07_Client-Communications
 *
 * Routing rules (audit Phase 2 proposal, confirmed mapping):
 *   - client-document          → 01_Brief-&-Scope (briefs + client inputs)
 *   - deliverable / mood-board   ──┐
 *   - deliverable / concept-sketch │
 *   - deliverable / 3d-model       ├→ 02_Design
 *   - deliverable / rendering      │
 *   - deliverable / client-presentation │
 *   - cad-model                          │ (CAD models = Design by default)
 *   - deliverable / shop-drawing       ──┘ (unless manufacturing; see below)
 *   - deliverable / specification-sheet → 03_Engineering
 *   - deliverable / cut-list            → 03_Engineering
 *   - deliverable / bom                 → 03_Engineering
 *   - deliverable / assembly-instructions → 03_Engineering
 *   - production-doc            → 05_Production
 *   - deliverable / handoff-bundle → 05_Production (Phase 3)
 *   - report (category)         → 07_Client-Communications
 *
 * Manufacturing-context overrides: if the file carries a
 * `manufacturingOrderId`, shop-drawings are routed to 05_Production
 * instead of 02_Design — because at handoff time the drawing's
 * canonical home is with the MO paperwork.
 *
 * Unmapped / unknown combinations fall back to 02_Design (the most
 * common non-destructive destination) and are logged by the caller.
 */

const SUBFOLDERS = Object.freeze({
  BRIEF: '01_Brief-&-Scope',
  DESIGN: '02_Design',
  ENGINEERING: '03_Engineering',
  PROCUREMENT: '04_Procurement',
  PRODUCTION: '05_Production',
  DELIVERY: '06_Delivery',
  CLIENT_COMMS: '07_Client-Communications',
});

/**
 * The canonical ordered list — used when scaffolding a new project
 * folder so the `01..07` subfolders come into existence as a set.
 */
const ALL_SUBFOLDERS = Object.freeze([
  SUBFOLDERS.BRIEF,
  SUBFOLDERS.DESIGN,
  SUBFOLDERS.ENGINEERING,
  SUBFOLDERS.PROCUREMENT,
  SUBFOLDERS.PRODUCTION,
  SUBFOLDERS.DELIVERY,
  SUBFOLDERS.CLIENT_COMMS,
]);

const ENGINEERING_DELIVERABLE_TYPES = new Set([
  'specification-sheet',
  'cut-list',
  'bom',
  'assembly-instructions',
]);

const DESIGN_DELIVERABLE_TYPES = new Set([
  'mood-board',
  'concept-sketch',
  '3d-model',
  'rendering',
  'client-presentation',
]);

const PRODUCTION_DELIVERABLE_TYPES = new Set([
  'handoff-bundle', // Phase 3
]);

/**
 * @param {object} file — the ManagedFile-shaped doc
 * @param {string} file.category
 * @param {string} [file.deliverableType]
 * @param {string} [file.manufacturingOrderId]
 * @returns {string} one of SUBFOLDERS — never null; unknown inputs map to DESIGN
 */
function resolveDriveSubfolder(file) {
  const { category, deliverableType, manufacturingOrderId } = file || {};

  // Manufacturing-context override: shop drawings attached to an MO
  // belong with production paperwork, not design iterations.
  if (manufacturingOrderId && deliverableType === 'shop-drawing') {
    return SUBFOLDERS.PRODUCTION;
  }

  switch (category) {
    case 'client-document':
      return SUBFOLDERS.BRIEF;
    case 'production-doc':
      return SUBFOLDERS.PRODUCTION;
    case 'cad-model':
      return SUBFOLDERS.DESIGN;
    case 'report':
      return SUBFOLDERS.CLIENT_COMMS;
    case 'deliverable':
      if (deliverableType && ENGINEERING_DELIVERABLE_TYPES.has(deliverableType)) {
        return SUBFOLDERS.ENGINEERING;
      }
      if (deliverableType && PRODUCTION_DELIVERABLE_TYPES.has(deliverableType)) {
        return SUBFOLDERS.PRODUCTION;
      }
      if (deliverableType && DESIGN_DELIVERABLE_TYPES.has(deliverableType)) {
        return SUBFOLDERS.DESIGN;
      }
      if (deliverableType === 'shop-drawing') {
        return SUBFOLDERS.DESIGN;
      }
      return SUBFOLDERS.DESIGN;
    default:
      return SUBFOLDERS.DESIGN;
  }
}

module.exports = {
  SUBFOLDERS,
  ALL_SUBFOLDERS,
  resolveDriveSubfolder,
};
