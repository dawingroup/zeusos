/**
 * /crm/new — create a new lead. Form covers the minimum to enter the
 * funnel: name, source, currency. All other fields are editable on the
 * detail page.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { createLead } from '../services/lead.service';
import type { LeadSource } from '../types/lead.types';

const DEFAULT_ORG_ID = 'default';

const SOURCES: LeadSource[] = ['REFERRAL', 'INBOUND', 'OUTBOUND', 'EVENT', 'EXISTING_CLIENT', 'OTHER'];
const CURRENCIES = ['UGX', 'USD', 'KES', 'EUR', 'GBP'] as const;

export default function LeadCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid ?? 'unknown-user';

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('INBOUND');
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>('UGX');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [probability, setProbability] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const estValueMinor = estimatedValue
        ? Math.round(Number(estimatedValue) * 100)
        : undefined;
      const prob = probability ? Number(probability) : undefined;

      const created = await createLead({
        name,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        source,
        currency,
        estimatedValueMinor: estValueMinor,
        probability: prob,
        notes: notes.trim() || undefined,
        orgId,
        ownerUserId: userId,
        createdBy: userId,
      });

      navigate(`/crm/${created.id}`);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">New lead</h1>
        <p className="text-sm text-muted-foreground">
          Add a new opportunity to the pipeline. The lead starts in PROSPECT.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded border bg-card p-5" data-testid="lead-form">
        <div>
          <label className="mb-1 block text-sm font-medium">Lead / company name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-2 py-1.5 text-sm"
            placeholder="Acme Beverages Ltd"
            data-testid="lead-name"
          />
        </div>

        <fieldset className="space-y-3 rounded border p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">Primary contact</legend>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Name"
              className="rounded border px-2 py-1.5 text-sm"
            />
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Email"
              className="rounded border px-2 py-1.5 text-sm"
            />
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Phone"
              className="rounded border px-2 py-1.5 text-sm col-span-2"
            />
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Source *</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as LeadSource)}
              className="w-full rounded border px-2 py-1.5 text-sm"
            >
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Currency *</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof CURRENCIES[number])}
              className="w-full rounded border px-2 py-1.5 text-sm"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Estimated value</label>
            <input
              type="number"
              min={0}
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="e.g. 25000000"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">Major units ({currency}). Optional.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Probability (0–1)</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
              placeholder="0.5"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
        </div>

        {error && <p className="text-sm text-destructive" data-testid="lead-form-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/crm')}
            className="rounded border px-4 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
            data-testid="lead-submit"
          >
            {saving ? 'Creating…' : 'Create lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
