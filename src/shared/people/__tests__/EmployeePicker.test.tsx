/**
 * The picker hands back the KEY to store and the NAME to stamp — the writer
 * contract's pair — and never lets an id reach the screen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/shared/services/firebase/firestore', () => ({ db: {} }));

import { EmployeePicker } from '../EmployeePicker';
import { primePeopleDirectory, resetPeopleDirectory, listPeople, personKey } from '../peopleDirectoryStore';

const jane = { name: 'Jane Okello', employeeId: 'emp-jane', uid: 'uid-jane', email: 'jane@zeustheagency.com', source: 'employee' as const };
const amos = { name: 'Amos Byaruhanga', employeeId: 'emp-amos', source: 'employee' as const };
const gone = { name: 'Gone Person', employeeId: 'emp-gone', source: 'employee' as const, isDeleted: true };
const portal = { name: 'Portal Admin', uid: 'uid-admin', email: 'admin@zeustheagency.com', source: 'user' as const };

describe('listPeople / personKey', () => {
  beforeEach(() => resetPeopleDirectory());

  it('lists each person once, sorted, without deleted records', () => {
    primePeopleDirectory([jane, amos, gone, portal]);
    expect(listPeople().map((p) => p.name)).toEqual(['Amos Byaruhanga', 'Jane Okello', 'Portal Admin']);
    expect(personKey(jane)).toBe('emp-jane');
    expect(personKey(portal)).toBe('uid-admin');
  });
});

describe('<EmployeePicker>', () => {
  beforeEach(() => resetPeopleDirectory());

  it('filters by name or email and returns the key + name pair', () => {
    primePeopleDirectory([jane, amos, portal]);
    const onChange = vi.fn();
    render(<EmployeePicker value={null} onChange={onChange} placeholder="Assigned to" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'admin@' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole('option'));
    expect(onChange).toHaveBeenCalledWith({ id: 'uid-admin', name: 'Portal Admin', email: 'admin@zeustheagency.com', employeeId: undefined, uid: 'uid-admin' });
  });

  it('arrow keys move the highlight and Enter picks; Escape closes without reaching the parent', () => {
    primePeopleDirectory([jane, amos, portal]);
    const onChange = vi.fn();
    const parentKeyDown = vi.fn();
    render(
      <div onKeyDown={parentKeyDown}>
        <EmployeePicker value={null} onChange={onChange} />
      </div>,
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getAllByRole('option')).toHaveLength(3); // Amos, Jane, Portal
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'emp-jane', name: 'Jane Okello' }));

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    // Arrow/Enter may bubble (nothing above cares); Escape must not, or the dialog closes.
    expect(parentKeyDown.mock.calls.some(([e]) => (e as React.KeyboardEvent).key === 'Escape')).toBe(false);
  });

  it('matches word by word — "okello jane" finds Jane Okello; the employee id counts too', () => {
    primePeopleDirectory([jane, amos, portal]);
    render(<EmployeePicker value={null} onChange={() => {}} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'okello jane' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Jane Okello')]);
    fireEvent.change(input, { target: { value: 'emp-amos' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Amos Byaruhanga')]);
  });

  it('shows the picked person by NAME when closed, never the id', () => {
    primePeopleDirectory([jane, amos]);
    render(<EmployeePicker value="uid-jane" onChange={() => {}} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('Jane Okello');
    expect(screen.queryByText('uid-jane')).toBeNull();
  });

  it('keeps a legacy free-text value visible rather than blanking the row', () => {
    primePeopleDirectory([jane]);
    render(<EmployeePicker value="Typed Name" onChange={() => {}} />);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Typed Name');
  });

  it('clears to null', () => {
    primePeopleDirectory([jane]);
    const onChange = vi.fn();
    render(<EmployeePicker value="emp-jane" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear person'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
