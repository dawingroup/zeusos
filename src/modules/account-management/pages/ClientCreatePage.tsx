/**
 * /clients/new — minimal create form.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { upsertClientFn } from '@/modules/contracts/services/firebase';
import type { Client } from '@/modules/contracts/types/client.types';
import type { SubsidiaryId } from '@/core/settings/types';

const CURRENCIES: Client['billingCurrency'][] = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

// ADR-2026-05-25 §2.Q2 — explicit home-brand picker on the create form.
// Pass undefined ("auto") to let the backend default from the caller's
// `homeOrgId`; otherwise pin a specific brand at create time. Useful
// when a parent-org AM is creating a client on a brand's behalf.
const BRAND_OPTIONS: { value: SubsidiaryId | ''; label: string }[] = [
  { value: '',                  label: 'Auto (use my home org)' },
  { value: 'zeus-group',        label: 'Zeus Group (parent-owned)' },
  { value: 'zeus-the-agency',   label: 'Zeus The Agency' },
  { value: 'zeus-digital',      label: 'Zeus Digital' },
  { value: 'labyrinth',         label: 'Labyrinth' },
  { value: 'odd-gorilla',       label: 'Odd Gorilla' },
  { value: 'house-of-zeus',     label: 'House of Zeus' },
];

export default function ClientCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [currency, setCurrency] = useState<Client['billingCurrency']>('USD');
  const [sector, setSector] = useState('');
  const [primaryBrandId, setPrimaryBrandId] = useState<SubsidiaryId | ''>('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return alert('Name required');
    setBusy(true);
    try {
      const { data } = await upsertClientFn({
        name: name.trim(),
        code: code.trim() || undefined,
        billingCurrency: currency,
        sector: sector.trim() || undefined,
        status: 'PROSPECT',
        // Empty string means "auto / let backend default from caller's homeOrgId".
        primaryBrandId: primaryBrandId || undefined,
      });
      navigate(`/clients/${data.id}`);
    } catch (err) {
      alert(`Create failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/clients" className="text-xs text-muted-foreground">← Clients</Link>
      <h1 className="text-xl font-semibold">New client</h1>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="col-span-2 block">
          <span className="block text-xs text-muted-foreground">Name *</span>
          <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" autoFocus />
        </label>
        <label className="block">
          <span className="block text-xs text-muted-foreground">Code</span>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. DIAGEO" className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="block">
          <span className="block text-xs text-muted-foreground">Billing currency *</span>
          <select value={currency} onChange={e => setCurrency(e.target.value as Client['billingCurrency'])} className="mt-1 w-full rounded border px-2 py-1">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="col-span-2 block">
          <span className="block text-xs text-muted-foreground">Sector</span>
          <input value={sector} onChange={e => setSector(e.target.value)} placeholder="e.g. FMCG, Telecom" className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="col-span-2 block">
          <span className="block text-xs text-muted-foreground">
            Home brand (commercial owner)
            <span className="ml-1 font-normal text-[10px] text-[var(--fg-tertiary)]">
              ADR §2.Q2 — primaryBrandId
            </span>
          </span>
          <select
            data-testid="client-primary-brand-input"
            value={primaryBrandId}
            onChange={e => setPrimaryBrandId(e.target.value as SubsidiaryId | '')}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {BRAND_OPTIONS.map(b => <option key={b.value || 'auto'} value={b.value}>{b.label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy} className="rounded bg-[var(--rag-blue)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-blue)] disabled:opacity-50">
          {busy ? 'Creating…' : 'Create'}
        </button>
        <Link to="/clients" className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)]">Cancel</Link>
      </div>
    </div>
  );
}
