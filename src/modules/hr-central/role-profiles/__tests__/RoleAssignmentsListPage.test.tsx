/**
 * RoleAssignmentsListPage tests — Phase 6.UI.A (PR 6).
 *
 * Read-only global view of effective-dated EmployeeId × RoleProfileId
 * edges. The interesting behaviour: two subscriptions (role profiles +
 * role assignments) are joined client-side; assignments group by
 * roleProfileId; the status filter defaults to "active".
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockSubProfiles = vi.fn();
const mockSubAssigns = vi.fn();

vi.mock('../services/role-profile.service', () => ({
  subscribeRoleProfiles: (
    cb: (rows: unknown[]) => void,
    onErr?: (e: Error) => void,
  ) => mockSubProfiles(cb, onErr),
  subscribeRoleAssignments: (
    cb: (rows: unknown[]) => void,
    onErr?: (e: Error) => void,
  ) => mockSubAssigns(cb, onErr),
}));

import RoleAssignmentsListPage from '../pages/RoleAssignmentsListPage';
import type { RoleAssignment, RoleProfile } from '../types';

function profile(id: string, over: Partial<RoleProfile> = {}): RoleProfile {
  return {
    id,
    brandId: 'zeus-the-agency',
    departmentId: 'creative',
    jobLevel: 'senior',
    employmentTypes: ['full_time'],
    title: id.replace(/^ROLE-/, ''),
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

function assign(
  id: string,
  roleProfileId: string,
  over: Partial<RoleAssignment> = {},
): RoleAssignment {
  return {
    id,
    employeeId: 'emp_1',
    roleProfileId,
    effectiveFrom: '2026-01-01T00:00:00Z' as never,
    isPrimary: false,
    status: 'active',
    ...over,
  } as RoleAssignment;
}

beforeEach(() => {
  mockSubProfiles.mockReset();
  mockSubAssigns.mockReset();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleAssignmentsListPage />
    </MemoryRouter>,
  );
}

describe('RoleAssignmentsListPage', () => {
  it('shows the empty state when no assignments match the default active filter', async () => {
    mockSubProfiles.mockImplementation((cb) => {
      cb([profile('ROLE-a')]);
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ra-list-empty')).toBeTruthy();
    });
    expect(screen.getByTestId('ra-list-empty').textContent).toMatch(
      /No assignments match the current filter/,
    );
  });

  it('groups assignments by role profile, with the profile title used as the heading', async () => {
    mockSubProfiles.mockImplementation((cb) => {
      cb([
        profile('ROLE-aaa', { title: 'Alpha Designer' }),
        profile('ROLE-bbb', { title: 'Bravo Director' }),
      ]);
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([
        assign('ra_1', 'ROLE-aaa'),
        assign('ra_2', 'ROLE-bbb'),
        assign('ra_3', 'ROLE-aaa'),
      ]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ra-group-ROLE-aaa')).toBeTruthy();
    });
    const groupA = screen.getByTestId('ra-group-ROLE-aaa');
    expect(groupA.textContent).toContain('Alpha Designer');
    expect(screen.getByTestId('ra-row-ra_1')).toBeTruthy();
    expect(screen.getByTestId('ra-row-ra_3')).toBeTruthy();
    expect(screen.getByTestId('ra-group-ROLE-bbb')).toBeTruthy();
  });

  it('status filter narrows by assignment status', async () => {
    mockSubProfiles.mockImplementation((cb) => {
      cb([profile('ROLE-x')]);
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([
        assign('ra_active', 'ROLE-x', { status: 'active' }),
        assign('ra_ended', 'ROLE-x', { status: 'ended' }),
      ]);
      return () => {};
    });
    renderPage();
    // Default filter is "active".
    await waitFor(() => {
      expect(screen.getByTestId('ra-row-ra_active')).toBeTruthy();
    });
    expect(screen.queryByTestId('ra-row-ra_ended')).toBeNull();

    fireEvent.change(screen.getByTestId('ra-status-filter'), { target: { value: 'ended' } });
    expect(screen.queryByTestId('ra-row-ra_active')).toBeNull();
    expect(screen.getByTestId('ra-row-ra_ended')).toBeTruthy();
  });

  it('"All" status filter shows assignments of every status', async () => {
    mockSubProfiles.mockImplementation((cb) => {
      cb([profile('ROLE-x')]);
      return () => {};
    });
    mockSubAssigns.mockImplementation((cb) => {
      cb([
        assign('ra_a', 'ROLE-x', { status: 'active' }),
        assign('ra_e', 'ROLE-x', { status: 'ended' }),
        assign('ra_p', 'ROLE-x', { status: 'paused' }),
      ]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ra-row-ra_a')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('ra-status-filter'), { target: { value: '' } });
    expect(screen.getByTestId('ra-row-ra_a')).toBeTruthy();
    expect(screen.getByTestId('ra-row-ra_e')).toBeTruthy();
    expect(screen.getByTestId('ra-row-ra_p')).toBeTruthy();
  });

  it('surfaces assignment subscription errors via the alert region', async () => {
    mockSubProfiles.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    mockSubAssigns.mockImplementation((_cb, onErr) => {
      onErr(new Error('rules denied'));
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ra-list-error')).toBeTruthy();
    });
    expect(screen.getByTestId('ra-list-error').textContent).toMatch(/rules denied/);
  });
});
