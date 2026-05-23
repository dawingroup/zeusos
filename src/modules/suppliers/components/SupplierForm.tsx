/**
 * SupplierForm — shared create/edit form for a supplier directory entry.
 */

import { useState } from 'react';
import type {
  Supplier,
  SupplierKind,
  PaymentTerms,
  CurrencyCode,
} from '../types/supplier.types';

const KIND_OPTIONS: SupplierKind[] = [
  'MEDIA_HOUSE',
  'TALENT_AGENCY',
  'PRODUCTION_HOUSE',
  'PRINT_SHOP',
  'TECH_VENDOR',
  'VENDOR_OTHER',
];

const PAYMENT_TERMS: PaymentTerms[] = [
  'ON_RECEIPT',
  'NET_15',
  'NET_30',
  'NET_60',
  'NET_90',
  'PREPAID',
];

const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

export type SupplierFormValues = {
  name: string;
  kind: SupplierKind;
  currency: CurrencyCode;
  paymentTerms: PaymentTerms;
  countryCode: string;
  taxId: string;
  address: string;
  notes: string;
  tagsCsv: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
};

interface Props {
  initial?: Partial<Supplier>;
  submitLabel: string;
  onSave: (values: SupplierFormValues) => Promise<void>;
  onCancel: () => void;
}

export function SupplierForm({ initial, submitLabel, onSave, onCancel }: Props) {
  const [values, setValues] = useState<SupplierFormValues>({
    name: initial?.name ?? '',
    kind: initial?.kind ?? 'MEDIA_HOUSE',
    currency: initial?.currency ?? 'UGX',
    paymentTerms: initial?.paymentTerms ?? 'NET_30',
    countryCode: initial?.countryCode ?? 'UG',
    taxId: initial?.taxId ?? '',
    address: initial?.address ?? '',
    notes: initial?.notes ?? '',
    tagsCsv: (initial?.tags ?? []).join(', '),
    contactName: initial?.primaryContact?.name ?? '',
    contactRole: initial?.primaryContact?.role ?? '',
    contactEmail: initial?.primaryContact?.email ?? '',
    contactPhone: initial?.primaryContact?.phone ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SupplierFormValues>(key: K, val: SupplierFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded border bg-card p-5" data-testid="supplier-form">
      <div>
        <label className="mb-1 block text-sm font-medium">Supplier name *</label>
        <input
          required
          value={values.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
          placeholder="Next Media Services Ltd"
          data-testid="supplier-name-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Kind *</label>
          <select
            value={values.kind}
            onChange={(e) => update('kind', e.target.value as SupplierKind)}
            className="w-full rounded border px-2 py-1.5 text-sm"
            data-testid="supplier-kind-input"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Country (ISO)</label>
          <input
            value={values.countryCode}
            onChange={(e) => update('countryCode', e.target.value.toUpperCase().slice(0, 2))}
            className="w-full rounded border px-2 py-1.5 text-sm uppercase"
            maxLength={2}
            placeholder="UG"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Currency *</label>
          <select
            value={values.currency}
            onChange={(e) => update('currency', e.target.value as CurrencyCode)}
            className="w-full rounded border px-2 py-1.5 text-sm"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Payment terms *</label>
          <select
            value={values.paymentTerms}
            onChange={(e) => update('paymentTerms', e.target.value as PaymentTerms)}
            className="w-full rounded border px-2 py-1.5 text-sm"
          >
            {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Tax ID / TIN</label>
        <input
          value={values.taxId}
          onChange={(e) => update('taxId', e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
        />
      </div>

      <fieldset className="space-y-3 rounded border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">Primary contact</legend>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={values.contactName}
            onChange={(e) => update('contactName', e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Name"
          />
          <input
            value={values.contactRole}
            onChange={(e) => update('contactRole', e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Role"
          />
          <input
            type="email"
            value={values.contactEmail}
            onChange={(e) => update('contactEmail', e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="email@supplier.tld"
          />
          <input
            value={values.contactPhone}
            onChange={(e) => update('contactPhone', e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="+256 …"
          />
        </div>
      </fieldset>

      <div>
        <label className="mb-1 block text-sm font-medium">Address</label>
        <textarea
          value={values.address}
          onChange={(e) => update('address', e.target.value)}
          rows={2}
          className="w-full rounded border px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          value={values.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
          className="w-full rounded border px-2 py-1.5 text-sm"
          placeholder="Risks, capacity, preferred slots…"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
        <input
          value={values.tagsCsv}
          onChange={(e) => update('tagsCsv', e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
          placeholder="radio, luganda, northern-uganda"
        />
      </div>

      {error && <p className="text-sm text-destructive" data-testid="supplier-form-error">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded border px-4 py-1.5 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          data-testid="supplier-submit"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
