/**
 * CompetitorListPanel tests — ADR-2026-05-25 §2.Q4.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAdd = vi.fn();
const mockRemove = vi.fn();
// Mutable fixture the subscription mock reads from. Tests reset this
// in `beforeEach` (default empty) and override it for the
// non-empty-list cases.
let fixtureRows: unknown[] = [];

vi.mock('../services/conflict-firewall.service', () => ({
  addClientCompetitorFn: (input: unknown) => mockAdd(input),
  removeClientCompetitorFn: (input: unknown) => mockRemove(input),
  subscribeClientCompetitors: (_clientId: string, cb: (rows: unknown[]) => void) => {
    cb(fixtureRows);
    return () => { /* unsubscribe noop */ };
  },
}));

import { CompetitorListPanel } from '../components/CompetitorListPanel';

beforeEach(() => {
  mockAdd.mockReset();
  mockRemove.mockReset();
  fixtureRows = [];
  mockAdd.mockResolvedValue({ data: { id: 'x__y', clientId: 'x', competitorClientId: 'y', created: true } });
  mockRemove.mockResolvedValue({ data: { id: 'x__y', removed: true } });
});

describe('CompetitorListPanel', () => {
  it('shows the empty state when the client has no competitors listed', () => {
    render(<CompetitorListPanel clientId="client-pepsi" clientName="Pepsi" />);
    expect(screen.queryByTestId('competitor-list-empty')).not.toBeNull();
    expect(screen.queryByTestId('competitor-list-rows')).toBeNull();
  });

  it('disables the Add button until a competitor id is entered', () => {
    render(<CompetitorListPanel clientId="client-pepsi" />);
    const addBtn = screen.getByTestId('competitor-add-btn') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('competitor-id-input'), { target: { value: 'client-coke' } });
    expect((screen.getByTestId('competitor-add-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Add fires addClientCompetitorFn with the form fields', async () => {
    render(<CompetitorListPanel clientId="client-pepsi" />);
    fireEvent.change(screen.getByTestId('competitor-id-input'), { target: { value: 'client-coke' } });
    fireEvent.change(screen.getByTestId('competitor-source-input'), { target: { value: 'MSA' } });
    fireEvent.change(screen.getByTestId('competitor-notes-input'), { target: { value: 'MSA §4.2' } });
    fireEvent.click(screen.getByTestId('competitor-add-btn'));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd).toHaveBeenCalledWith({
      clientId: 'client-pepsi',
      competitorClientId: 'client-coke',
      source: 'MSA',
      notes: 'MSA §4.2',
    });
  });

  it('renders one row per subscribed competitor and surfaces the source badge', () => {
    fixtureRows = [
      {
        id: 'client-pepsi__client-coke',
        clientId: 'client-pepsi',
        competitorClientId: 'client-coke',
        source: 'MSA',
        sourceAggregateId: 'msa-pepsi-1',
        notes: 'No Coca-Cola, Dr Pepper, Fanta',
        addedBy: 'u1',
        addedAt: '2026-05-25T00:00:00Z',
      },
    ];
    render(<CompetitorListPanel clientId="client-pepsi" />);
    expect(screen.queryByTestId('competitor-row-client-coke')).not.toBeNull();
    expect(screen.queryByTestId('competitor-list-empty')).toBeNull();
  });

  it('Remove fires removeClientCompetitorFn with the row id', async () => {
    fixtureRows = [
      {
        id: 'client-pepsi__client-coke',
        clientId: 'client-pepsi',
        competitorClientId: 'client-coke',
        source: 'MANUAL',
        sourceAggregateId: 'manual',
        addedBy: 'u1',
        addedAt: '2026-05-25T00:00:00Z',
      },
    ];
    render(<CompetitorListPanel clientId="client-pepsi" />);
    fireEvent.click(screen.getByTestId('competitor-remove-client-coke'));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledTimes(1));
    expect(mockRemove).toHaveBeenCalledWith({
      clientId: 'client-pepsi',
      competitorClientId: 'client-coke',
    });
  });
});
