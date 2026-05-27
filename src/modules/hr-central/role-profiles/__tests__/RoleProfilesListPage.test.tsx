/**
 * RoleProfilesListPage tests — Phase 6.UI.A (PR 6).
 *
 * Covers the parent-org admin's list view: subscription wiring, filter
 * interactions, empty states, and the inline "New role profile" affordance
 * that opens the existing RoleProfileForm in a create section.
 *
 * Pattern mirrors RoleProfileForm.test.tsx (the only existing test in
 * this module): vi.mock the service exports + the subscription factory,
 * then render with React Router's MemoryRouter so the row's <Link>
 * works.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockSubscribe = vi.fn();
const mockCreate = vi.fn();

vi.mock('../services/role-profile.service', () => ({
  subscribeRoleProfiles: (
    cb: (rows: unknown[]) => void,
    onErr: (e: Error) => void,
  ) => mockSubscribe(cb, onErr),
  createRoleProfileFn: (input: unknown) => mockCreate(input),
}));

import RoleProfilesListPage from '../pages/RoleProfilesListPage';
import type { RoleProfile } from '../types';

// Loose override type — we want tests to be readable (string-literal
// brand ids) without fighting `SubsidiaryId`'s union narrowing.
type ProfileOverride = Partial<Omit<RoleProfile, 'brandId'>> & {
  brandId?: string;
};

function profile(over: ProfileOverride = {}): RoleProfile {
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

beforeEach(() => {
  mockSubscribe.mockReset();
  mockCreate.mockReset();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <RoleProfilesListPage />
    </MemoryRouter>,
  );
}

describe('RoleProfilesListPage', () => {
  it('shows the empty state when there are no profiles', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('role-profiles-empty')).toBeTruthy();
    });
    expect(screen.getByTestId('role-profiles-empty').textContent).toMatch(
      /No role profiles yet/,
    );
  });

  it('renders one row per profile from the subscription', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([
        profile({ id: 'ROLE-a', title: 'AAA' }),
        profile({ id: 'ROLE-b', title: 'BBB', brandId: 'labyrinth' }),
      ]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('role-profile-row-ROLE-a')).toBeTruthy();
    });
    expect(screen.getByTestId('role-profile-row-ROLE-b')).toBeTruthy();
  });

  it('brand filter narrows the list', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([
        profile({ id: 'ROLE-zta', brandId: 'zeus-the-agency' }),
        profile({ id: 'ROLE-lab', brandId: 'labyrinth' }),
      ]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('role-profile-row-ROLE-zta')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('rp-brand-filter'), {
      target: { value: 'labyrinth' },
    });
    expect(screen.queryByTestId('role-profile-row-ROLE-zta')).toBeNull();
    expect(screen.getByTestId('role-profile-row-ROLE-lab')).toBeTruthy();
  });

  it('status filter narrows the list', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([
        profile({ id: 'ROLE-active', status: 'active' }),
        profile({ id: 'ROLE-draft', status: 'draft' }),
        profile({ id: 'ROLE-arch', status: 'archived' }),
      ]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('role-profile-row-ROLE-active')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('rp-status-filter'), {
      target: { value: 'draft' },
    });
    expect(screen.queryByTestId('role-profile-row-ROLE-active')).toBeNull();
    expect(screen.queryByTestId('role-profile-row-ROLE-arch')).toBeNull();
    expect(screen.getByTestId('role-profile-row-ROLE-draft')).toBeTruthy();
  });

  it('post-filter empty state distinguishes "no matches" from "none yet"', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([profile({ id: 'ROLE-zta', brandId: 'zeus-the-agency' })]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('role-profile-row-ROLE-zta')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('rp-brand-filter'), {
      target: { value: 'labyrinth' },
    });
    const empty = screen.getByTestId('role-profiles-empty');
    expect(empty.textContent).toMatch(/No role profiles match the current filters/);
  });

  it('"New role profile" button reveals the inline create form', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('open-create-role-profile')).toBeTruthy();
    });
    expect(screen.queryByTestId('role-profile-create')).toBeNull();
    fireEvent.click(screen.getByTestId('open-create-role-profile'));
    expect(screen.getByTestId('role-profile-create')).toBeTruthy();
    // The "New role profile" button hides while the form is open.
    expect(screen.queryByTestId('open-create-role-profile')).toBeNull();
  });

  it('surfaces subscription errors via the alert region', async () => {
    mockSubscribe.mockImplementation((_cb, onErr) => {
      onErr(new Error('boom'));
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('role-profiles-error')).toBeTruthy();
    });
    expect(screen.getByTestId('role-profiles-error').textContent).toMatch(/boom/);
  });
});
