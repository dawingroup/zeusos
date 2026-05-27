/**
 * RoleProfileDetailPage tests — Phase 6.UI.A (PR 6).
 *
 * Per-profile detail surface. Tests:
 *   • loading state when subscription hasn't fired yet
 *   • renders the edit form section + assignment list once data lands
 *   • archive button calls archiveRoleProfileFn
 *   • end-assignment button calls endRoleAssignmentFn
 *   • assignment "Assign employee" CTA opens the dialog
 *   • archived profile hides the archive button
 *   • surface-level error path (subscription failure)
 *
 * Stubs the three service exports the page uses; mocks
 * RoleProfileForm + RoleAssignmentDialog to test boundaries
 * (we already have RoleProfileForm.test.tsx for that surface).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockSubProfile = vi.fn();
const mockSubAssigns = vi.fn();
const mockArchive = vi.fn();
const mockEndAssign = vi.fn();

vi.mock('../services/role-profile.service', () => ({
  subscribeRoleProfile: (id: string, cb: (p: unknown) => void, onErr?: (e: Error) => void) =>
    mockSubProfile(id, cb, onErr),
  subscribeRoleAssignments: (cb: (rows: unknown[]) => void, onErr?: (e: Error) => void, opts?: unknown) =>
    mockSubAssigns(cb, onErr, opts),
  archiveRoleProfileFn: (input: unknown) => mockArchive(input),
  endRoleAssignmentFn: (input: unknown) => mockEndAssign(input),
}));

// RoleProfileForm has its own coverage; we just need a no-op stub here.
vi.mock('../components/RoleProfileForm', () => ({
  RoleProfileForm: () => <div data-testid="role-profile-form-stub" />,
}));

// Same for RoleAssignmentDialog — we verify the open prop via the
// test-id below.
vi.mock('../components/RoleAssignmentDialog', () => ({
  RoleAssignmentDialog: ({ open }: { open: boolean }) => (
    <div data-testid="role-assignment-dialog-stub" data-open={String(open)} />
  ),
}));

import RoleProfileDetailPage from '../pages/RoleProfileDetailPage';
import type { RoleAssignment, RoleProfile } from '../types';

function profile(over: Partial<RoleProfile> = {}): RoleProfile {
  return {
    id: 'ROLE-zeus-the-agency-senior-designer',
    brandId: 'zeus-the-agency',
    departmentId: 'creative',
    jobLevel: 'senior',
    employmentTypes: ['full_time'],
    title: 'Senior Designer',
    reportsTo: [],
    supervises: [],
    peers: [],
    escalationPath: [],
    delegationPool: [],
    skills: [],
    taskCapabilities: [],
    approvalAuthorities: [],
    typicalTaskLoad: { briefsPerWeek: 0, totalMinutesPerWeek: 0, complexity: 'medium' },
    aiContext: { allowAiSuggestions: true, escalateAfter: 0 },
    status: 'active',
    createdBy: 'u1',
    createdAt: { toDate: () => new Date('2026-01-01') } as never,
    updatedBy: 'u1',
    updatedAt: { toDate: () => new Date('2026-01-01') } as never,
    ...over,
  } as RoleProfile;
}

function assign(id: string, over: Partial<RoleAssignment> = {}): RoleAssignment {
  return {
    id,
    employeeId: 'emp_1',
    roleProfileId: 'ROLE-zeus-the-agency-senior-designer',
    effectiveFrom: '2026-01-01T00:00:00Z' as never,
    isPrimary: false,
    status: 'active',
    ...over,
  } as RoleAssignment;
}

beforeEach(() => {
  mockSubProfile.mockReset();
  mockSubAssigns.mockReset();
  mockArchive.mockReset();
  mockEndAssign.mockReset();
  mockArchive.mockResolvedValue({ data: {} });
  mockEndAssign.mockResolvedValue({ data: {} });
});

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/hr/role-profiles/${id}`]}>
      <Routes>
        <Route path="/hr/role-profiles/:id" element={<RoleProfileDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleProfileDetailPage', () => {
  it('shows a loading placeholder while the profile subscription has not delivered', () => {
    mockSubProfile.mockImplementation(() => () => {});
    mockSubAssigns.mockImplementation(() => () => {});
    renderAt('ROLE-x');
    // The page bails to a loading render — detail-page testid is absent,
    // and the "Role profiles" back link is the only visible nav.
    expect(screen.queryByTestId('role-profile-detail-page')).toBeNull();
    expect(screen.getByText(/Loading role profile/)).toBeTruthy();
  });

  it('renders the detail layout once the profile lands', async () => {
    mockSubProfile.mockImplementation((_id, cb) => {
      cb(profile());
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderAt('ROLE-zeus-the-agency-senior-designer');
    await waitFor(() => {
      expect(screen.getByTestId('role-profile-detail-page')).toBeTruthy();
    });
    expect(screen.getByTestId('rp-edit-section')).toBeTruthy();
    expect(screen.getByTestId('role-profile-form-stub')).toBeTruthy();
    expect(screen.getByTestId('rp-assignments-section')).toBeTruthy();
    expect(screen.getByTestId('rp-assignments-empty')).toBeTruthy();
  });

  it('archive button calls archiveRoleProfileFn with the profile id', async () => {
    mockSubProfile.mockImplementation((_id, cb) => {
      cb(profile());
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderAt('ROLE-zeus-the-agency-senior-designer');
    await waitFor(() => {
      expect(screen.getByTestId('rp-archive-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('rp-archive-btn'));
    await waitFor(() => expect(mockArchive).toHaveBeenCalledTimes(1));
    expect(mockArchive.mock.calls[0][0]).toEqual({ id: 'ROLE-zeus-the-agency-senior-designer' });
  });

  it('archived profiles hide the archive button', async () => {
    mockSubProfile.mockImplementation((_id, cb) => {
      cb(profile({ status: 'archived' }));
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderAt('ROLE-x');
    await waitFor(() => {
      expect(screen.getByTestId('role-profile-detail-page')).toBeTruthy();
    });
    expect(screen.queryByTestId('rp-archive-btn')).toBeNull();
  });

  it('renders rows for each assignment and the end-button only on active ones', async () => {
    mockSubProfile.mockImplementation((_id, cb) => {
      cb(profile());
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([
        assign('ra_active', { status: 'active' }),
        assign('ra_ended', { status: 'ended' }),
      ]);
      return () => {};
    });
    renderAt('ROLE-x');
    await waitFor(() => {
      expect(screen.getByTestId('rp-assignment-ra_active')).toBeTruthy();
    });
    expect(screen.getByTestId('rp-assignment-ra_ended')).toBeTruthy();
    expect(screen.getByTestId('rp-end-assignment-ra_active')).toBeTruthy();
    expect(screen.queryByTestId('rp-end-assignment-ra_ended')).toBeNull();
  });

  it('end-button calls endRoleAssignmentFn with the assignment id', async () => {
    mockSubProfile.mockImplementation((_id, cb) => {
      cb(profile());
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([assign('ra_1', { status: 'active' })]);
      return () => {};
    });
    renderAt('ROLE-x');
    await waitFor(() => {
      expect(screen.getByTestId('rp-end-assignment-ra_1')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('rp-end-assignment-ra_1'));
    await waitFor(() => expect(mockEndAssign).toHaveBeenCalledTimes(1));
    expect(mockEndAssign.mock.calls[0][0]).toEqual({ id: 'ra_1' });
  });

  it('"Assign employee" button flips the dialog open prop', async () => {
    mockSubProfile.mockImplementation((_id, cb) => {
      cb(profile());
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderAt('ROLE-x');
    await waitFor(() => {
      expect(screen.getByTestId('role-assignment-dialog-stub')).toBeTruthy();
    });
    expect(
      screen.getByTestId('role-assignment-dialog-stub').getAttribute('data-open'),
    ).toBe('false');
    fireEvent.click(screen.getByTestId('open-assign-dialog'));
    expect(
      screen.getByTestId('role-assignment-dialog-stub').getAttribute('data-open'),
    ).toBe('true');
  });

  it('surfaces profile subscription errors via the alert region', async () => {
    mockSubProfile.mockImplementation((_id, cb, onErr) => {
      // First fire the profile so the rest of the page is around to host the alert.
      cb(profile());
      onErr?.(new Error('rules denied'));
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderAt('ROLE-x');
    await waitFor(() => {
      expect(screen.getByTestId('rp-detail-error')).toBeTruthy();
    });
    expect(screen.getByTestId('rp-detail-error').textContent).toMatch(/rules denied/);
  });
});
