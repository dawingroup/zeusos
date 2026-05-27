/**
 * RoleProfileForm tests — Phase 6.UI.A (PR 6).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();

vi.mock('../services/role-profile.service', () => ({
  createRoleProfileFn: (input: unknown) => mockCreate(input),
}));

import { RoleProfileForm } from '../components/RoleProfileForm';
import type { RoleProfile } from '../types';

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ data: { id: 'ROLE-zeus-the-agency-senior-designer', created: true } });
});

describe('RoleProfileForm', () => {
  it('disables save until title is filled', () => {
    render(<RoleProfileForm />);
    expect((screen.getByTestId('rp-save-btn') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('rp-title-input'), { target: { value: 'Senior Designer' } });
    expect((screen.getByTestId('rp-save-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls createRoleProfileFn with brand + department + title on save', async () => {
    render(<RoleProfileForm />);
    fireEvent.change(screen.getByTestId('rp-brand-input'), { target: { value: 'zeus-the-agency' } });
    fireEvent.change(screen.getByTestId('rp-department-input'), { target: { value: 'creative' } });
    fireEvent.change(screen.getByTestId('rp-job-level-input'), { target: { value: 'senior' } });
    fireEvent.change(screen.getByTestId('rp-title-input'), { target: { value: 'Senior Designer' } });
    fireEvent.click(screen.getByTestId('rp-save-btn'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const call = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(call.brandId).toBe('zeus-the-agency');
    expect(call.departmentId).toBe('creative');
    expect(call.jobLevel).toBe('senior');
    expect(call.title).toBe('Senior Designer');
  });

  it('adds a task capability and toggles flags before saving', async () => {
    render(<RoleProfileForm />);
    fireEvent.change(screen.getByTestId('rp-title-input'), { target: { value: 'Senior Designer' } });
    fireEvent.click(screen.getByTestId('rp-add-cap-creative.internal_approval_requested'));
    // Toggle Execute on the newly added row — find by partial test id.
    const executeFlag = document.querySelector('[data-testid*="-canExecute"]') as HTMLInputElement | null;
    expect(executeFlag).not.toBeNull();
    fireEvent.click(executeFlag!);
    fireEvent.click(screen.getByTestId('rp-save-btn'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const call = mockCreate.mock.calls[0][0] as { taskCapabilities: Array<{ eventType: string; canExecute: boolean }> };
    expect(call.taskCapabilities).toHaveLength(1);
    expect(call.taskCapabilities[0].eventType).toBe('creative.internal_approval_requested');
    expect(call.taskCapabilities[0].canExecute).toBe(true);
  });

  it('shows the saved banner with the returned id on success', async () => {
    render(<RoleProfileForm />);
    fireEvent.change(screen.getByTestId('rp-title-input'), { target: { value: 'Senior Designer' } });
    fireEvent.click(screen.getByTestId('rp-save-btn'));
    await waitFor(() => expect(screen.queryByTestId('rp-saved-banner')).not.toBeNull());
    expect(screen.getByTestId('rp-saved-banner').textContent).toContain('ROLE-zeus-the-agency-senior-designer');
  });

  it('locks the brand picker when editing an existing profile', () => {
    const profile = {
      id: 'ROLE-zeus-the-agency-senior-designer',
      brandId: 'zeus-the-agency',
      departmentId: 'creative',
      jobLevel: 'senior',
      title: 'Senior Designer',
      status: 'active',
      employmentTypes: ['full_time'],
      reportsTo: [], supervises: [], peers: [], escalationPath: [], delegationPool: [],
      skills: [], taskCapabilities: [], approvalAuthorities: [],
      typicalTaskLoad: { daily: 4, weekly: 20, maxConcurrent: 6 },
      aiContext: { briefingPriorities: [], taskSortingWeights: {}, communicationStyle: 'concise' as const },
      createdBy: 'u_1',
      createdAt: '2026-05-01T00:00:00Z',
      updatedBy: 'u_1',
      updatedAt: '2026-05-01T00:00:00Z',
    } as unknown as RoleProfile;
    render(<RoleProfileForm profile={profile} />);
    expect((screen.getByTestId('rp-brand-input') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId('rp-title-input') as HTMLInputElement).value).toBe('Senior Designer');
  });
});
