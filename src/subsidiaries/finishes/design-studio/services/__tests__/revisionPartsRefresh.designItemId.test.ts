/**
 * Belt-and-braces test — the revision → parts refresh flow must never
 * clobber a cabinet's DesignItem binding.
 *
 * The risk this pins down: `applyRevisionToCabinet` (and its rollback
 * sibling) ends with an `updateDoc(cabRef, { ... })` — Firestore
 * `updateDoc` is partial, so silently leaves `designItemId` alone
 * IF the payload doesn't mention it. These tests assert that literal
 * invariant by mocking every I/O boundary and inspecting the exact
 * payload shape the service sends.
 *
 * A regression here would manifest as "cabinet's DesignItem suddenly
 * unbound after a revision sync" — costly to diagnose in production.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { getDoc, updateDoc } from 'firebase/firestore';

// ---- Mock surfaces ---------------------------------------------------------

vi.mock('@/firebase/config', () => ({
  db: {},
}));

// Parsers are pure but the real ones expect actual model bytes.
// Short-circuit to empty ParsedModel — processModel is mocked too, so
// its inputs don't matter here.
vi.mock('../parserGlb', () => ({
  parseGLB: vi.fn(async () => ({ objects: [], materials: [], fileName: '' })),
}));
vi.mock('../parser3ds', () => ({
  parse3DS: vi.fn(() => ({ objects: [], materials: [], fileName: '' })),
}));

// processModel does AI + BOM + package writes. Stub it so our test
// only exercises the orchestrator's own writes.
vi.mock('../processModel.service', () => ({
  processModel: vi.fn(async () => ({
    packageId: 'pkg-new',
    grouping: {
      source: 'ai',
      model: 'mock',
      confidence: 0.9,
      reasoning: 'stub',
      assemblies: [
        {
          id: 'a1',
          cabinetId: 'cab-1',
          assemblyType: 'carcass',
          assemblyCode: 'A1',
          displayName: 'Carcass',
          parts: [],
          meshNodeIds: [],
          boundingBox: {
            min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 },
            center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 },
          },
          jointSpec: [], assemblySequence: [], isComplete: true,
          totalPartCount: 0, totalArea: 0, totalCost: 0, sequence: 0,
        },
      ],
      parts: [],
      unmapped: [],
    },
    materials: { source: 'manual', mappings: [], unresolved: [] },
    renders: {},
    bom: [],
    pricing: null,
    validation: { issues: [], warnings: [] },
    durationMs: 0,
  })),
}));

// The issue resolver is an I/O helper — stub to no-op so the apply
// flow doesn't try to reach design-manager collections.
vi.mock('@/modules/design-manager/services/designItemIssueService', () => ({
  resolveOpenIssuesBySource: vi.fn(async () => 0),
}));

// The revision lookup happens through designRevisionService.
vi.mock('../designRevisionService', () => ({
  getRevision: vi.fn(async () => ({
    id: 'rev-42',
    revisionNumber: 42,
    projectId: 'proj-1',
    status: 'draft',
    source: 'manual_upload',
    files: {
      glbUrl: 'https://example.test/model.glb',
    },
    materialMapping: {},
    annotations: [],
    createdBy: 'u1',
    createdAt: Timestamp.now(),
  })),
}));

// modelPackage.service is only used by rollback in this suite.
vi.mock('../modelPackage.service', () => ({
  createModelPackage: vi.fn(async () => 'pkg-new'),
  getModelPackageVersions: vi.fn(async () => []),
}));

// `fetch` is a global. For the GLB fetch step we just need something
// that resolves with an ArrayBuffer; the parser is mocked so contents
// don't matter.
beforeEach(() => {
  vi.clearAllMocks();
  // Re-install the fetch stub each run so one test doesn't leak.
  (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(0),
  })) as unknown as typeof fetch;
});

// Import AFTER mocks are set up so the service picks up the stubs.
import { applyRevisionToCabinet, rollbackToModelPackageVersion } from '../revisionPartsRefresh';

const getDocMock = getDoc as unknown as ReturnType<typeof vi.fn>;
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>;

// A fully populated cabinet doc — the key invariant is that
// designItemId survives every code path below.
const BOUND_CABINET = {
  id: 'cab-1',
  sceneId: 'scene-1',
  pddId: 'p',
  cabinetCode: 'KB-A',
  displayName: 'Cabinet A',
  configuration: {},
  finishSelections: {},
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  anchorPoint: 'bottom_back_left',
  glbUrl: '',
  thumbnailUrl: '',
  assemblies: [],
  computedBOM: [],
  estimatedPrice: { total: 0, currency: 'UGX' },
  // THE invariant under test.
  designItemId: 'item-xyz',
  isLocked: false,
  sequence: 0,
  lastAppliedRevisionNumber: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

// Collect every cabinet-scoped updateDoc call so assertions can inspect
// the exact payload field set.
function cabinetUpdatePayloads(): Array<Record<string, unknown>> {
  // The cabinet ref is the second arg; our mocked `doc` returns {} so we
  // can't distinguish by ref identity alone. All updateDoc calls in the
  // path we test are cabinet-scoped (processModel is mocked), so every
  // call's second arg IS the payload we want.
  return updateDocMock.mock.calls.map(([, payload]) => payload as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// applyRevisionToCabinet
// ---------------------------------------------------------------------------

describe('applyRevisionToCabinet — DesignItem binding preservation', () => {
  it('never includes designItemId in the cabinet updateDoc payload', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => BOUND_CABINET,
      id: BOUND_CABINET.id,
    });

    await applyRevisionToCabinet(
      'scene-1',
      'cab-1',
      'rev-42',
      {}, // default decisions — nothing to accept, empty parts
      { uid: 'u1', displayName: 'Tester', email: 't@example.test' },
    );

    const payloads = cabinetUpdatePayloads();
    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) {
      expect(payload).not.toHaveProperty('designItemId');
    }
  });

  it('writes the expected revision-tracking fields (positive assertion)', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => BOUND_CABINET,
      id: BOUND_CABINET.id,
    });

    await applyRevisionToCabinet(
      'scene-1', 'cab-1', 'rev-42', {},
      { uid: 'u1' },
    );

    // One of the updateDoc calls must carry the revision tracking.
    const matching = cabinetUpdatePayloads().find(
      p => 'lastAppliedRevisionNumber' in p && 'lastAppliedRevisionId' in p,
    );
    expect(matching).toBeTruthy();
    expect(matching!.lastAppliedRevisionNumber).toBe(42);
    expect(matching!.lastAppliedRevisionId).toBe('rev-42');
    expect(matching).toHaveProperty('assemblies');
    expect(matching).toHaveProperty('updatedAt');
    // And still — no designItemId.
    expect(matching).not.toHaveProperty('designItemId');
  });

  it('preserves designItemId when the cabinet was unbound (absence stays absent)', async () => {
    const unbound = { ...BOUND_CABINET };
    delete (unbound as Record<string, unknown>).designItemId;

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => unbound,
      id: unbound.id,
    });

    await applyRevisionToCabinet(
      'scene-1', 'cab-1', 'rev-42', {},
      { uid: 'u1' },
    );

    for (const payload of cabinetUpdatePayloads()) {
      // Neither set nor cleared — the rule layer enforces "non-empty string"
      // on project-backed scenes, and we never want a stray empty-string
      // here that would trip it.
      expect(payload).not.toHaveProperty('designItemId');
    }
  });
});

// ---------------------------------------------------------------------------
// rollbackToModelPackageVersion
// ---------------------------------------------------------------------------

describe('rollbackToModelPackageVersion — DesignItem binding preservation', () => {
  it('never includes designItemId in the cabinet updateDoc payload', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => BOUND_CABINET,
      id: BOUND_CABINET.id,
    });

    const targetVersion = {
      id: 'cab-1-package',
      version: 3,
      sourceType: 'cabinet' as const,
      sourceId: 'cab-1',
      modelRef: { fileType: 'glb' as const },
      grouping: {
        source: 'ai' as const,
        model: 'mock',
        confidence: 0.8,
        reasoning: '',
        assemblies: [],
        parts: [],
        unmapped: [],
      },
      materials: { source: 'manual' as const, mappings: [], unresolved: [] },
      renders: {},
      bom: [],
      pricing: null,
      context: {},
      metadata: {
        processedAt: Timestamp.now(),
        processedBy: 'test',
        processingDurationMs: 0,
        errors: [],
        steps: [],
      },
    };

    await rollbackToModelPackageVersion(
      'scene-1', 'cab-1', targetVersion,
      { uid: 'u1' },
    );

    const payloads = cabinetUpdatePayloads();
    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) {
      expect(payload).not.toHaveProperty('designItemId');
    }
  });

  it('nulls revision tracking but does not touch designItemId', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => BOUND_CABINET,
      id: BOUND_CABINET.id,
    });

    const targetVersion = {
      id: 'cab-1-package', version: 3,
      sourceType: 'cabinet' as const, sourceId: 'cab-1',
      modelRef: { fileType: 'glb' as const },
      grouping: { source: 'ai' as const, model: 'mock', confidence: 0.8, reasoning: '', assemblies: [], parts: [], unmapped: [] },
      materials: { source: 'manual' as const, mappings: [], unresolved: [] },
      renders: {}, bom: [], pricing: null, context: {},
      metadata: { processedAt: Timestamp.now(), processedBy: 'test', processingDurationMs: 0, errors: [], steps: [] },
    };

    await rollbackToModelPackageVersion('scene-1', 'cab-1', targetVersion, { uid: 'u1' });

    const match = cabinetUpdatePayloads().find(p => 'lastAppliedRevisionNumber' in p);
    expect(match).toBeTruthy();
    expect(match!.lastAppliedRevisionNumber).toBeNull();
    expect(match!.lastAppliedRevisionId).toBeNull();
    expect(match).not.toHaveProperty('designItemId');
  });
});
