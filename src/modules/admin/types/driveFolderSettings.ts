/**
 * Admin-editable mapping of the Shared-Drive folder IDs that the
 * Unified File Manager + Drive-bridge Cloud Functions use at runtime.
 *
 * Stored as a single document at `systemSettings/driveFolders`. The
 * Cloud Function `functions/src/drive/config.js` reads this doc with
 * a short in-memory cache (60 s), falling back to env vars when a
 * slot is unset. That means an admin can paste a new folder ID in
 * the UI and the triggers pick it up on their next fire — no
 * redeploy.
 *
 * Secrets (service-account email + private key) stay in
 * `defineSecret` and are NOT in this collection. Folder IDs are not
 * secrets — they're share-with-me URLs.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Canonical slot names. Every Drive-bridge code path looks up its
 * folder by one of these keys via `getFolderIdForSlot()` in
 * `functions/src/drive/config.js`. Adding a new slot requires:
 *   1. Extending this type.
 *   2. Adding an entry in `DRIVE_FOLDER_SLOT_CATALOG` below.
 *   3. (When a Cloud Function starts consuming it) a matching row in
 *      `policy/drive-writers.yaml` per v3.1 §7.
 *
 * Most slots outside `activeProjects` / `archive` are "forward-looking"
 * — operators can bind a folder ID now, and the future consuming
 * module will pick it up without a redeploy when its code lands.
 */
export type DriveFolderSlot =
  // ── Projects & Archive (Phase 2/4 — live today) ─────────────────────
  | 'activeProjects'
  | 'archive'
  // ── 04_Templates-Resources (Phase 5 prep) ──────────────────────────
  | 'templatesResources'
  | 'finishLibrary'
  | 'documentTemplates'
  | 'dawinosExports'
  | 'brandAssets'
  // ── 03_Group-Operations — per-subsidiary ops roots (v3 §03) ─────────
  | 'opsFinishes'
  | 'opsAdvisory'
  | 'opsCapital'
  | 'opsTechnology'
  // ── 03_Group-Operations/05_Group-HQ — departmental roots ────────────
  | 'hqRoot'
  | 'hqFinance'
  | 'hqHR'
  | 'hqLegal'
  | 'hqIT'
  | 'hqStrategy'       // CEO & Strategy — new in v3.1 (pending formal §3 amendment)
  | 'hqCompliance'     // new in v3.1 (pending formal §3 amendment)
  | 'hqMarketIntel'    // new in v3.1 (pending formal §3 amendment)
  // ── 03_Group-Operations/06_Clients (v3 §03) ────────────────────────
  | 'clientsRoot'
  // ── 05_AMH-Uganda (v3 §05 — separate shared drive) ────────────────
  | 'programsAMH';

/** Per-slot binding — the folder ID + last-verify metadata. */
export interface FolderBinding {
  /** Google Drive folder ID. Empty string / absent = slot unset. */
  folderId?: string;
  /**
   * Display name captured by the last successful `verifyDriveFolder`
   * callable run. Lets the UI show "DF-2025 Active Projects" next to
   * the opaque ID without an extra round-trip on every page render.
   */
  folderName?: string;
  /** Server timestamp from the last successful verify. */
  lastVerifiedAt?: Timestamp;
  /** UID of the admin who last verified this slot. */
  lastVerifiedBy?: string;
  /** Message from the last FAILED verify attempt; cleared on success. */
  lastVerifyError?: string;
  /**
   * Opaque item count (shallow) from the last verify. Useful as a
   * visual sanity check — "your archive folder has 0 children" hints
   * at a wrong ID even when the folder itself resolves.
   */
  itemCount?: number;
}

export interface DriveFolderSettings {
  /** Document ID is fixed to `driveFolders`. */
  id: 'driveFolders';
  bindings: Partial<Record<DriveFolderSlot, FolderBinding>>;
  updatedAt?: Timestamp;
  updatedBy?: string;
  /**
   * Stamp of the Drive service account the Cloud Functions use, so
   * admins know which email to share folders with. Populated by a
   * small refresh callable; read-only in the UI.
   */
  serviceAccountEmail?: string;
  serviceAccountEmailSyncedAt?: Timestamp;
}

// ─── Catalog (display metadata) ──────────────────────────────────────

/**
 * UI grouping for the settings page. Each group renders as a
 * collapsible section with its own "N/M mapped" progress counter.
 */
export type SlotGroup =
  | 'projects'        // 01_Active-Projects + 02_Archive — the CF-consuming slots
  | 'templates'       // 04_Templates-Resources subtree (Phase 5 prep)
  | 'subsidiaries'    // 03_Group-Operations/[subsidiary]
  | 'hq'              // 03_Group-Operations/05_Group-HQ/[department]
  | 'clients'         // 03_Group-Operations/06_Clients
  | 'programs';       // 05_AMH-Uganda + future partner programs

export const SLOT_GROUP_META: Record<
  SlotGroup,
  { label: string; description: string; defaultOpen: boolean }
> = {
  projects: {
    label: 'Projects & Archive',
    description:
      'Consumed by the Drive bridge today. These are required for the Unified File Manager to mirror project files.',
    defaultOpen: true,
  },
  templates: {
    label: 'Templates-Resources (v3.1 §3)',
    description:
      'Future home for `04_Templates-Resources`. Bind now so Phase 5 Cloud Functions (finish library, ZeusOS exports, template resolver) pick them up on ship.',
    defaultOpen: false,
  },
  subsidiaries: {
    label: 'Subsidiary operations',
    description:
      'Per-subsidiary ops roots under `03_Group-Operations/`. Consumed by subsidiary-scoped exports (advisory reports, strategy docs, etc.).',
    defaultOpen: false,
  },
  hq: {
    label: 'Group HQ departments',
    description:
      'Finance, HR, Legal, IT and strategic functions under `03_Group-Operations/05_Group-HQ/`. Mapped here so ZeusOS modules (finance briefings, HR docs, compliance filings) have a stable target.',
    defaultOpen: false,
  },
  clients: {
    label: 'Client Hub',
    description:
      'Customer-facing root (`03_Group-Operations/06_Clients/`). The customer-hub module creates per-client subfolders under this root.',
    defaultOpen: false,
  },
  programs: {
    label: 'Programs & partnerships',
    description:
      'External programs that ZeusOS integrates with (AMH-Uganda today; add more as partnerships grow).',
    defaultOpen: false,
  },
};

/**
 * Per-slot display metadata consumed by the settings page. Ordered
 * how they appear in the UI — Phase 2/4 slots first since those are
 * the live ones; Phase 5 prep grouped below.
 */
export interface SlotDescriptor {
  slot: DriveFolderSlot;
  label: string;
  hint: string;
  /** The v3/v3.1 policy path this folder should resolve to. */
  policyPath: string;
  /** Which group this slot belongs to (sections the UI). */
  group: SlotGroup;
  /**
   * Phase 2 / 4 / 5 for docs. Phase 2+4 means "Cloud Functions consume
   * this today". Phase 5+ means "forward-looking; admin binds, consumer
   * ships later".
   */
  phase: 2 | 4 | 5 | 6;
  /** Slots that semantically nest under another (display-only grouping). */
  parentSlot?: DriveFolderSlot;
  /**
   * True when the folder doesn't yet exist in the v3 tree and requires
   * a formal v3.1 §3 amendment before the admin creates it. Surfaces
   * a warning badge on the slot card.
   */
  pendingPolicyAmendment?: boolean;
}

export const DRIVE_FOLDER_SLOT_CATALOG: readonly SlotDescriptor[] = [
  // ═══ Projects & Archive ═══════════════════════════════════════════
  {
    slot: 'activeProjects',
    label: 'Active Projects root',
    hint: 'Every new `designProjects` doc creates its `{code}_{client}_{type}/{01..07}/` tree under this folder.',
    policyPath: '01_Active-Projects/',
    group: 'projects',
    phase: 2,
  },
  {
    slot: 'archive',
    label: 'Archive root',
    hint: 'When a project transitions to `status: completed`, its folder is moved to `{this}/{YYYY}/`.',
    policyPath: '02_Archive/',
    group: 'projects',
    phase: 4,
  },

  // ═══ Templates-Resources (v3.1 §3) ════════════════════════════════
  {
    slot: 'templatesResources',
    label: 'Templates-Resources drive root',
    hint: 'The drive/folder that hosts the canonical v3.1 §04 tree. Parent of the four sub-bindings below.',
    policyPath: '04_Templates-Resources/',
    group: 'templates',
    phase: 5,
  },
  {
    slot: 'documentTemplates',
    label: 'Document Templates',
    hint: 'BOQ / PO / MO / Contract templates resolved by ZeusOS tooling (F-B8).',
    policyPath: '04_Templates-Resources/02_Document-Templates/',
    group: 'templates',
    phase: 5,
    parentSlot: 'templatesResources',
  },
  {
    slot: 'brandAssets',
    label: 'Brand Assets',
    hint: 'Canonical brand guidelines + logos per v3.1 §3.2 (master folder + per-subsidiary subtrees).',
    policyPath: '04_Templates-Resources/03_Brand-Assets/',
    group: 'templates',
    phase: 5,
    parentSlot: 'templatesResources',
  },
  {
    slot: 'finishLibrary',
    label: 'Finishes Library',
    hint: 'Persistent home for finish imagery referenced by `dawinos_get_finish_library` (F-B7).',
    policyPath: '04_Templates-Resources/04_Design-Library/Finishes-Library/',
    group: 'templates',
    phase: 5,
    parentSlot: 'templatesResources',
  },
  {
    slot: 'dawinosExports',
    label: 'ZeusOS Exports',
    hint: 'Monthly CFO briefing / production summary / spend plan dumps (F-B6).',
    policyPath: '04_Templates-Resources/06_ZeusOS-Assets/Exports/',
    group: 'templates',
    phase: 5,
    parentSlot: 'templatesResources',
  },

  // ═══ Subsidiary operations (v3 §03) ═══════════════════════════════
  {
    slot: 'opsFinishes',
    label: 'Zeus Group — ops root',
    hint: 'Operational folder for the Finishes subsidiary (SOPs, internal docs, marketing). Consumer modules pick this up when writing Finishes-scoped artefacts.',
    policyPath: '03_Group-Operations/01_Dawin-Finishes/',
    group: 'subsidiaries',
    phase: 6,
  },
  {
    slot: 'opsAdvisory',
    label: 'Zeus Group — ops root',
    hint: 'Operational folder for Advisory. Also the destination for non-project strategy + advisory reports (`google-docs.service.ts`).',
    policyPath: '03_Group-Operations/02_Dawin-Advisory/',
    group: 'subsidiaries',
    phase: 6,
  },
  {
    slot: 'opsCapital',
    label: 'Zeus Capital — ops root',
    hint: 'Operational folder for Capital. Investment memos, portfolio tracking, LP comms.',
    policyPath: '03_Group-Operations/03_Dawin-Capital/',
    group: 'subsidiaries',
    phase: 6,
  },
  {
    slot: 'opsTechnology',
    label: 'Zeus Technology — ops root',
    hint: 'Operational folder for Technology/ZeusOS engineering artefacts outside product code (RFCs, architecture notes, internal demos).',
    policyPath: '03_Group-Operations/04_Dawin-Technology/',
    group: 'subsidiaries',
    phase: 6,
  },

  // ═══ Group HQ departments (v3 §03 + v3.1 amendments) ══════════════
  {
    slot: 'hqRoot',
    label: 'Group HQ root',
    hint: 'Parent folder for HQ departmental subfolders below. Rarely needed directly — bind the individual department slots instead.',
    policyPath: '03_Group-Operations/05_Group-HQ/',
    group: 'hq',
    phase: 6,
  },
  {
    slot: 'hqFinance',
    label: 'Group HQ · Finance',
    hint: 'Finance-module outputs land here: CFO briefings archive, spend plans, month-end packs, budget decisions.',
    policyPath: '03_Group-Operations/05_Group-HQ/Finance/',
    group: 'hq',
    phase: 6,
    parentSlot: 'hqRoot',
  },
  {
    slot: 'hqHR',
    label: 'Group HQ · HR',
    hint: 'HR-module outputs: employee records, contracts, leave policies, offer letters, performance reviews.',
    policyPath: '03_Group-Operations/05_Group-HQ/HR/',
    group: 'hq',
    phase: 6,
    parentSlot: 'hqRoot',
  },
  {
    slot: 'hqLegal',
    label: 'Group HQ · Legal',
    hint: 'Legal documents: entity filings, IP records, vendor contracts, NDAs, board resolutions.',
    policyPath: '03_Group-Operations/05_Group-HQ/Legal/',
    group: 'hq',
    phase: 6,
    parentSlot: 'hqRoot',
  },
  {
    slot: 'hqIT',
    label: 'Group HQ · IT & Systems',
    hint: 'IT & Systems: access-control runbooks, DR plans, vendor licences, infra documentation.',
    policyPath: '03_Group-Operations/05_Group-HQ/IT-&-Systems/',
    group: 'hq',
    phase: 6,
    parentSlot: 'hqRoot',
  },
  {
    slot: 'hqStrategy',
    label: 'Group HQ · CEO & Strategy',
    hint: 'CEO-level strategic artefacts: OKR docs, quarterly reviews, board packs, strategy canvases exported from ZeusOS.',
    policyPath: '03_Group-Operations/05_Group-HQ/CEO-&-Strategy/',
    group: 'hq',
    phase: 6,
    parentSlot: 'hqRoot',
    pendingPolicyAmendment: true,
  },
  {
    slot: 'hqCompliance',
    label: 'Group HQ · Compliance',
    hint: 'Compliance filings, regulatory submissions, audit trails, DPIAs, statutory returns.',
    policyPath: '03_Group-Operations/05_Group-HQ/Compliance/',
    group: 'hq',
    phase: 6,
    parentSlot: 'hqRoot',
    pendingPolicyAmendment: true,
  },
  {
    slot: 'hqMarketIntel',
    label: 'Group HQ · Market Intelligence',
    hint: 'Market-intelligence module outputs: competitor briefs, brand-radar reports, scan snapshots, industry research.',
    policyPath: '03_Group-Operations/05_Group-HQ/Market-Intelligence/',
    group: 'hq',
    phase: 6,
    parentSlot: 'hqRoot',
    pendingPolicyAmendment: true,
  },

  // ═══ Client Hub (v3 §03) ══════════════════════════════════════════
  {
    slot: 'clientsRoot',
    label: 'Clients root',
    hint: 'Customer-facing folders (`{CUSTOMERCODE} - {NAME}/Projects/Documents/`). The customer-hub module creates per-customer subfolders under this root.',
    policyPath: '03_Group-Operations/06_Clients/',
    group: 'clients',
    phase: 6,
  },

  // ═══ Programs & partnerships (v3 §05) ═════════════════════════════
  {
    slot: 'programsAMH',
    label: 'AMH-Uganda program',
    hint: 'AMH (Access to Maternal Health) Uganda program root — sits on its own shared drive per v3 §05. Houses governance, finance-&-accountability, partner hospitals, resources.',
    policyPath: '05_AMH-Uganda/',
    group: 'programs',
    phase: 6,
  },
];
