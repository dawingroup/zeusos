/**
 * CesLineItemDialog — Phase 6.UI.D.3 (PR 5).
 *
 * Modal for adding a single CES line item. Calls `postCesLineItemFn`
 * (the Phase 6.D callable). The CES currency is locked to whatever
 * existing line items use; we surface that as a read-only badge.
 */

import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { X } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import type { CESLineItem } from '@/modules/contracts/types/ces.types';
import { postCesLineItemFn } from '../services/brief-ces.service';

type Category = CESLineItem['category'];
type Currency = CESLineItem['currency'];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'LABOR_INTERNAL',  label: 'Internal labour' },
  { value: 'LABOR_FREELANCE', label: 'Freelance labour' },
  { value: 'PRODUCTION',      label: 'Production' },
  { value: 'TALENT',          label: 'Talent' },
  { value: 'MEDIA_BUY',       label: 'Media buy' },
  { value: 'OTHER',           label: 'Other' },
];

interface Props {
  open: boolean;
  masterJobId: string;
  /** CES currency, if any line items already exist. New CES — caller
   *  may pass `'UGX'` etc. as the default. */
  lockedCurrency?: Currency;
  defaultCurrency?: Currency;
  onClose: () => void;
  onAdded?: () => void;
}

export function CesLineItemDialog({
  open,
  masterJobId,
  lockedCurrency,
  defaultCurrency = 'UGX',
  onClose,
  onAdded,
}: Props) {
  const [category, setCategory] = useState<Category>('LABOR_INTERNAL');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [amountMajor, setAmountMajor] = useState('');
  const [currency, setCurrency] = useState<Currency>(lockedCurrency ?? defaultCurrency);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setCategory('LABOR_INTERNAL');
    setDescription('');
    setQuantity('');
    setUnit('');
    setAmountMajor('');
    setNotes('');
    setErr(null);
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const major = Number(amountMajor.replace(/,/g, ''));
      if (!Number.isFinite(major) || major < 0) {
        throw new Error('Amount must be a non-negative number.');
      }
      const amountMinor = Math.round(major * 100);
      await postCesLineItemFn({
        masterJobId,
        lineItem: {
          category,
          description: description.trim(),
          quantity: quantity ? Number(quantity) : undefined,
          unit: unit || undefined,
          amountMinor,
          currency,
          notes: notes.trim() || undefined,
        },
      });
      reset();
      onAdded?.();
      onClose();
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="ces-line-item-dialog"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 p-3 border-b border-[var(--border-default)]">
          <h2 className="text-[14px] font-semibold text-[var(--fg-primary)]">Add CES line item</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-4 space-y-3">
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Category
            </span>
            <select
              data-testid="ces-category-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Description
            </span>
            <Input
              data-testid="ces-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Senior designer × 8h, photographer day rate, …"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                Quantity (optional)
              </span>
              <Input
                data-testid="ces-quantity-input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="8"
                inputMode="decimal"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                Unit (optional)
              </span>
              <Input
                data-testid="ces-unit-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="hour, day, piece"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                Amount
              </span>
              <Input
                data-testid="ces-amount-input"
                value={amountMajor}
                onChange={(e) => setAmountMajor(e.target.value)}
                placeholder="1,000.00"
                inputMode="decimal"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                Currency
                {lockedCurrency && (
                  <span className="ml-1 text-[var(--fg-tertiary)] normal-case font-normal">(locked)</span>
                )}
              </span>
              <select
                data-testid="ces-currency-input"
                value={currency}
                disabled={!!lockedCurrency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px] disabled:opacity-60"
              >
                {(['UGX', 'USD', 'KES', 'EUR', 'GBP'] as Currency[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Notes (optional)
            </span>
            <Input
              data-testid="ces-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {err && (
            <p
              role="alert"
              data-testid="ces-line-item-error"
              className="text-[12px] text-[var(--rag-red)]"
            >
              {err}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 p-3 border-t border-[var(--border-default)]">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            data-testid="ces-submit-line-item"
            disabled={busy || !description || !amountMajor}
            onClick={submit}
          >
            {busy ? 'Saving…' : 'Add line item'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
