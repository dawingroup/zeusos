/**
 * Cross-Module Service — engagement → client resolution tests (P1 regression guard)
 *
 * Pins the audit-plan P1 fix in `createProjectFromDeal`: a deal's
 * engagement must be resolved to its `clientId` before any project is
 * created. The pre-fix code set
 *
 *   customerId: deal.engagementId   // ← the bridge lie
 *
 * which silently passed an engagementId as the project's customerId.
 * These tests assert the current fail-loud behaviour so a future refactor
 * can't reintroduce the bug.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDoc } from 'firebase/firestore';
import { CrossModuleService } from '../cross-module-service';
import type { ProjectCreationFromDeal } from '../../types/cross-module-link';

// The core project service is invoked on the happy path; stub it so we
// can assert what customerId got passed without hitting real Firestore.
const createProjectMock = vi.fn(
  (_orgId: string, _userId: string, _data: Record<string, unknown>) =>
    Promise.resolve('project-created-id'),
);
vi.mock('../../../core/project/services/project.service', () => ({
  getProjectService: () => ({
    createProject: createProjectMock,
  }),
}));

// `createLink` does further Firestore writes and raises scope; stub the
// class-level persistence path to a no-op so the resolver tests stay
// focused. `createProjectFromDeal` ultimately calls `this.createLink`,
// but that isn't the unit under test here.
// (Simpler approach: we override on the instance in beforeEach.)

const getDocMock = getDoc as unknown as ReturnType<typeof vi.fn>;

function makeDocSnap(exists: boolean, data: Record<string, unknown> = {}) {
  return {
    exists: () => exists,
    data: () => (exists ? data : undefined),
    id: 'mock-id',
  };
}

const DEFAULT_CONFIG: ProjectCreationFromDeal = {
  dealId: 'deal-123',
  programId: 'program-abc',
  projectConfig: {
    name: 'Test Project',
    region: 'Central',
    district: 'Kampala',
    location: 'Main Office',
    implementationType: 'direct',
    startDate: new Date('2026-01-01'),
    expectedEndDate: new Date('2026-06-01'),
    budgetFromDeal: true,
  } as ProjectCreationFromDeal['projectConfig'],
  // Disable every post-create side-effect so the resolver is the only
  // thing under test. Firestore writes beyond `createProject` are out of
  // scope for these regression tests.
  autoLink: {
    documents: false,
    contacts: false,
    milestones: false,
  },
};

describe('CrossModuleService.createProjectFromDeal — engagement→client resolution', () => {
  let service: CrossModuleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CrossModuleService();
    // Stub out the link-creation side-effect so the tests focus on the
    // customerId resolution path. `createLink` runs after the resolution
    // we care about.
    (service as unknown as { createLink: (...a: unknown[]) => Promise<unknown> }).createLink =
      vi.fn().mockResolvedValue({ id: 'link-id' });
  });

  it('throws a clear error when the deal lookup returns no document', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(false)); // deal missing
    await expect(
      service.createProjectFromDeal('org-1', DEFAULT_CONFIG, 'user-1'),
    ).rejects.toThrow(/Deal not found/i);
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('throws when the deal has no engagementId (prevents silent orphan creation)', async () => {
    getDocMock.mockResolvedValueOnce(
      // deal exists but engagementId is absent
      makeDocSnap(true, {
        name: 'Deal X',
        stage: 'closed-won',
        investmentAmount: 1000,
        // engagementId intentionally missing
      }),
    );
    await expect(
      service.createProjectFromDeal('org-1', DEFAULT_CONFIG, 'user-1'),
    ).rejects.toThrow(/no engagementId/i);
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('throws when the referenced engagement does not exist', async () => {
    // First getDoc: the deal (has engagementId).
    // Second getDoc: the engagement — not found.
    getDocMock
      .mockResolvedValueOnce(
        makeDocSnap(true, {
          name: 'Deal Y',
          stage: 'closed-won',
          investmentAmount: 2000,
          engagementId: 'eng-999',
        }),
      )
      .mockResolvedValueOnce(makeDocSnap(false));
    await expect(
      service.createProjectFromDeal('org-1', DEFAULT_CONFIG, 'user-1'),
    ).rejects.toThrow(/has no clientId/i);
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('throws when the engagement exists but has no clientId', async () => {
    getDocMock
      .mockResolvedValueOnce(
        makeDocSnap(true, {
          name: 'Deal Z',
          stage: 'closed-won',
          investmentAmount: 3000,
          engagementId: 'eng-555',
        }),
      )
      .mockResolvedValueOnce(
        makeDocSnap(true, {
          // engagement exists but clientId is empty / missing
          name: 'Orphan Engagement',
          clientId: '',
        }),
      );
    await expect(
      service.createProjectFromDeal('org-1', DEFAULT_CONFIG, 'user-1'),
    ).rejects.toThrow(/has no clientId/i);
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('resolves customerId from engagement.clientId on the happy path — NOT from deal.engagementId', async () => {
    const ENGAGEMENT_ID = 'eng-abc';
    const CLIENT_ID = 'client-xyz';
    getDocMock
      .mockResolvedValueOnce(
        makeDocSnap(true, {
          name: 'Good Deal',
          stage: 'closed-won',
          investmentAmount: 50_000,
          engagementId: ENGAGEMENT_ID,
          currency: 'USD',
        }),
      )
      .mockResolvedValueOnce(
        makeDocSnap(true, {
          name: 'Real Engagement',
          clientId: CLIENT_ID,
        }),
      );

    await service.createProjectFromDeal('org-1', DEFAULT_CONFIG, 'user-1');

    expect(createProjectMock).toHaveBeenCalledTimes(1);
    const [orgId, userId, projectData] = createProjectMock.mock.calls[0];
    expect(orgId).toBe('org-1');
    expect(userId).toBe('user-1');
    const data = projectData as { customerId: string };
    // The crux of P1: customerId MUST be the engagement's clientId,
    // NOT the deal's engagementId.
    expect(data.customerId).toBe(CLIENT_ID);
    expect(data.customerId).not.toBe(ENGAGEMENT_ID);
  });
});
