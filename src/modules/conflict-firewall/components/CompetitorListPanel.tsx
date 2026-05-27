/**
 * CompetitorListPanel — ADR-2026-05-25 §2.Q4.
 *
 * Embedded per-client UI that subscribes to the client's competitor
 * list and lets an AM add/remove rows. The list drives the routing
 * firewall: any candidate brand currently serving a listed competitor
 * is excluded with `rejectionReason='CONFLICTED'`.
 *
 * Default usage: mount on the ClientDetailPage.
 */

import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import type {
  ClientCompetitor,
  ClientCompetitorSource,
} from '@/modules/contracts/types/client-competitor.types';
import {
  addClientCompetitorFn,
  removeClientCompetitorFn,
  subscribeClientCompetitors,
} from '../services/conflict-firewall.service';

interface Props {
  clientId: string;
  clientName?: string;
}

const SOURCE_OPTIONS: { value: ClientCompetitorSource; label: string }[] = [
  { value: 'MSA',    label: 'MSA clause' },
  { value: 'SOW',    label: 'SOW clause' },
  { value: 'MANUAL', label: 'Manual / pre-contract' },
];

export function CompetitorListPanel({ clientId, clientName }: Props) {
  const [rows, setRows] = useState<ClientCompetitor[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Form state
  const [competitorIdInput, setCompetitorIdInput] = useState('');
  const [source, setSource] = useState<ClientCompetitorSource>('MANUAL');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!clientId) return;
    const unsubscribe = subscribeClientCompetitors(clientId, setRows, (e) =>
      setErr(`Competitor list subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, [clientId]);

  const submit = async () => {
    if (!competitorIdInput.trim()) {
      setErr('Competitor client id is required.');
      return;
    }
    setBusy('add');
    setErr(null);
    try {
      await addClientCompetitorFn({
        clientId,
        competitorClientId: competitorIdInput.trim(),
        source,
        notes: notes.trim() || undefined,
      });
      setCompetitorIdInput('');
      setNotes('');
      setSource('MANUAL');
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (competitorClientId: string) => {
    setBusy(competitorClientId);
    setErr(null);
    try {
      await removeClientCompetitorFn({ clientId, competitorClientId });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section data-testid="competitor-list-panel" className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-[14px] font-semibold text-[var(--fg-primary)] flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--rag-amber)]" aria-hidden="true" />
          Competitor list
        </h2>
        <p className="text-[12px] text-[var(--fg-tertiary)]">
          Routing excludes any brand currently serving a listed competitor.
          Named-competitor model per ADR-2026-05-25 §2.Q4 — replaces the
          earlier category-based firewall.
        </p>
      </header>

      {err && (
        <p role="alert" data-testid="competitor-list-error" className="text-[12px] text-[var(--rag-red)]">
          {err}
        </p>
      )}

      {/* Add row */}
      <div
        data-testid="competitor-list-add-form"
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-sunken)] p-3 space-y-2"
      >
        <div className="grid grid-cols-12 gap-2">
          <label className="col-span-5 block">
            <span className="block text-[10.5px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Competitor client id
            </span>
            <Input
              data-testid="competitor-id-input"
              value={competitorIdInput}
              onChange={(e) => setCompetitorIdInput(e.target.value)}
              placeholder="client_ulid_… or external name"
            />
          </label>
          <label className="col-span-3 block">
            <span className="block text-[10.5px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Source
            </span>
            <select
              data-testid="competitor-source-input"
              value={source}
              onChange={(e) => setSource(e.target.value as ClientCompetitorSource)}
              className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
            >
              {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="col-span-4 block">
            <span className="block text-[10.5px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Notes (clause language, etc.)
            </span>
            <Input
              data-testid="competitor-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='"No Coca-Cola, Dr Pepper, Fanta" — MSA §4.2'
            />
          </label>
        </div>
        <Button
          size="sm"
          data-testid="competitor-add-btn"
          disabled={busy === 'add' || !competitorIdInput.trim()}
          onClick={submit}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          {busy === 'add' ? 'Adding…' : 'Add competitor'}
        </Button>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <p
          data-testid="competitor-list-empty"
          className="text-[12px] text-[var(--fg-tertiary)] italic p-3 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          {clientName ? `${clientName} has no listed competitors yet.` : 'No competitors listed yet.'}
          {' '}When added, routing will exclude brands currently serving them.
        </p>
      ) : (
        <ul className="space-y-1.5" data-testid="competitor-list-rows">
          {rows.map((row) => (
            <li
              key={row.id}
              data-testid={`competitor-row-${row.competitorClientId}`}
              className="flex items-center gap-3 p-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-[var(--fg-primary)]">
                  <code className="font-mono">{row.competitorClientId}</code>
                  <span
                    className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)]"
                  >
                    {row.source}
                  </span>
                </p>
                {row.notes && (
                  <p className="text-[11px] text-[var(--fg-tertiary)] mt-0.5">{row.notes}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                data-testid={`competitor-remove-${row.competitorClientId}`}
                disabled={busy === row.competitorClientId}
                onClick={() => remove(row.competitorClientId)}
                aria-label={`Remove ${row.competitorClientId}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-[var(--rag-red)]" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
