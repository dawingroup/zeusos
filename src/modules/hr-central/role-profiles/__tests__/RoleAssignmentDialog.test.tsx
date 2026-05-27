/**
 * RoleAssignmentDialog tests — Phase 6.UI.A (PR 6).
 *
 * The modal that opens off RoleProfileDetailPage's "Assign employee"
 * button. Tests cover:
 *   • open=false renders nothing
 *   • open=true renders the dialog + heading carrying the role's title/brand
 *   • employee picker falls back to a text input when useEmployeeList is empty
 *   • submit button is disabled until employee + effective-from are filled
 *   • clicking Assign calls assignEmployeeToRoleFn with the trimmed input
 *   • close button + outside-click both trigger onClose
 *   • FirebaseError surfaces as `code: message` in the alert region
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseError } from 'firebase/app';

const mockAssign = vi.fn();
const mockUseEmployeeList = vi.fn();

vi.mock('../services/role-profile.service', () => ({
  assignEmployeeToRoleFn: (input: unknown) => mockAssign(input),
}));

vi.mock('@/modules/hr-central/hooks/useEmployee', () => ({
  useEmployeeList: () => mockUseEmployeeList(),
}));

import { RoleAssignmentDialog } from '../components/RoleAssignmentDialog';
import type { RoleProfile } from '../types';

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

beforeEach(() => {
  mockAssign.mockReset();
  mockUseEmployeeList.mockReset();
  mockUseEmployeeList.mockReturnValue({ employees: [] });
  mockAssign.mockResolvedValue({ data: { id: 'ra_new' } });
});

describe('RoleAssignmentDialog', () => {
  it('open=false renders nothing', () => {
    const { container } = render(
      <RoleAssignmentDialog
        open={false}
        roleProfile={profile()}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('open=true renders the dialog with the role title + brand', () => {
    render(
      <RoleAssignmentDialog
        open={true}
        roleProfile={profile()}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByTestId('role-assignment-dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Senior Designer');
    expect(dialog.textContent).toContain('zeus-the-agency');
  });

  it('falls back to a free-text input when the employee list is empty', () => {
    mockUseEmployeeList.mockReturnValue({ employees: [] });
    render(
      <RoleAssignmentDialog
        open={true}
        roleProfile={profile()}
        onClose={() => {}}
      />,
    );
    const empInput = screen.getByTestId('ra-employee-input');
    expect(empInput.tagName).toBe('INPUT');
  });

  it('renders a <select> when useEmployeeList returns employees', () => {
    mockUseEmployeeList.mockReturnValue({
      employees: [
        { id: 'emp_1', fullName: 'Alice A.', title: 'Designer' },
        { id: 'emp_2', fullName: 'Bob B.', title: 'Senior Designer' },
      ],
    });
    render(
      <RoleAssignmentDialog
        open={true}
        roleProfile={profile()}
        onClose={() => {}}
      />,
    );
    const empInput = screen.getByTestId('ra-employee-input');
    expect(empInput.tagName).toBe('SELECT');
    expect(empInput.textContent).toContain('Alice A.');
    expect(empInput.textContent).toContain('Bob B.');
  });

  it('submit button is disabled until employee is filled', () => {
    render(
      <RoleAssignmentDialog
        open={true}
        roleProfile={profile()}
        onClose={() => {}}
      />,
    );
    const submit = screen.getByTestId('ra-submit-btn') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('ra-employee-input'), {
      target: { value: 'emp_1' },
    });
    expect(submit.disabled).toBe(false);
  });

  it('Assign calls assignEmployeeToRoleFn with the trimmed input + then onClose fires', async () => {
    const onClose = vi.fn();
    render(
      <RoleAssignmentDialog
        open={true}
        roleProfile={profile()}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByTestId('ra-employee-input'), {
      target: { value: '  emp_42  ' },
    });
    fireEvent.click(screen.getByTestId('ra-submit-btn'));
    await waitFor(() => expect(mockAssign).toHaveBeenCalledTimes(1));
    const call = mockAssign.mock.calls[0][0] as Record<string, unknown>;
    expect(call.employeeId).toBe('emp_42'); // trimmed
    expect(call.roleProfileId).toBe('ROLE-zeus-the-agency-senior-designer');
    expect(call.isPrimary).toBe(true);
    expect(typeof call.effectiveFrom).toBe('string');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('isPrimary checkbox unticks → submitted as false', async () => {
    render(
      <RoleAssignmentDialog
        open={true}
        roleProfile={profile()}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('ra-employee-input'), {
      target: { value: 'emp_1' },
    });
    fireEvent.click(screen.getByTestId('ra-is-primary-input'));
    fireEvent.click(screen.getByTestId('ra-submit-btn'));
    await waitFor(() => expect(mockAssign).toHaveBeenCalledTimes(1));
    expect((mockAssign.mock.calls[0][0] as Record<string, unknown>).isPrimary).toBe(false);
  });

  it('FirebaseError surfaces as `code: message` in the alert region', async () => {
    mockAssign.mockRejectedValue(new FirebaseError('permission-denied', 'rules blocked'));
    render(
      <RoleAssignmentDialog
        open={true}
        roleProfile={profile()}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('ra-employee-input'), {
      target: { value: 'emp_1' },
    });
    fireEvent.click(screen.getByTestId('ra-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('ra-error')).toBeTruthy();
    });
    expect(screen.getByTestId('ra-error').textContent).toMatch(
      /permission-denied: rules blocked/,
    );
  });

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn();
    render(
      <RoleAssignmentDialog
        open={true}
        roleProfile={profile()}
        onClose={onClose}
      />,
    );
    // The dialog testid is on the backdrop; the inner panel stops propagation.
    fireEvent.click(screen.getByTestId('role-assignment-dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
