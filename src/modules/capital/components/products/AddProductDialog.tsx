/**
 * AddProductDialog
 * Modal form for manually adding a capital product to the catalog.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  PRODUCT_TYPE_LABELS,
  PROVIDER_TYPE_LABELS,
  INTEREST_TYPE_LABELS,
} from '../../constants/capital.constants';
import type { CapitalProductType, ProviderType, InterestType } from '../../types/capital.types';
import type { CapitalProductInput } from '../../schemas/capital.schemas';

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CapitalProductInput) => Promise<unknown>;
}

const INITIAL_STATE = {
  name: '',
  provider: '',
  providerType: 'bank' as ProviderType,
  productType: 'term_loan' as CapitalProductType,
  currency: 'UGX' as const,
  collateralRequired: false,
  interestType: '' as InterestType | '',
  minAmount: '',
  maxAmount: '',
  interestRate: '',
  tenorMinMonths: '',
  tenorMaxMonths: '',
  processingFee: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
};

export function AddProductDialog({ open, onOpenChange, onSave }: AddProductDialogProps) {
  const [form, setForm] = useState(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.provider.trim()) {
      setError('Name and provider are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: Record<string, unknown> = {
        name: form.name.trim(),
        provider: form.provider.trim(),
        providerType: form.providerType,
        productType: form.productType,
        currency: form.currency,
        collateralRequired: form.collateralRequired,
        requirements: [],
        status: 'active',
      };
      if (form.minAmount) input.minAmount = Number(form.minAmount);
      if (form.maxAmount) input.maxAmount = Number(form.maxAmount);
      if (form.interestRate) input.interestRate = Number(form.interestRate);
      if (form.interestType) input.interestType = form.interestType;
      if (form.tenorMinMonths) input.tenorMinMonths = Number(form.tenorMinMonths);
      if (form.tenorMaxMonths) input.tenorMaxMonths = Number(form.tenorMaxMonths);
      if (form.processingFee) input.processingFee = Number(form.processingFee);
      if (form.contactPerson.trim()) input.contactPerson = form.contactPerson.trim();
      if (form.contactEmail.trim()) input.contactEmail = form.contactEmail.trim();
      if (form.contactPhone.trim()) input.contactPhone = form.contactPhone.trim();
      if (form.notes.trim()) input.notes = form.notes.trim();

      await onSave(input as CapitalProductInput);
      setForm(INITIAL_STATE);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Capital Product</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g., SME Business Loan"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider">Provider *</Label>
              <Input
                id="provider"
                value={form.provider}
                onChange={e => set('provider', e.target.value)}
                placeholder="e.g., Stanbic Bank"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Provider Type</Label>
              <select
                value={form.providerType}
                onChange={e => set('providerType', e.target.value)}
                className="w-full text-sm border rounded-md px-3 py-2 bg-background"
              >
                {Object.entries(PROVIDER_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Product Type</Label>
              <select
                value={form.productType}
                onChange={e => set('productType', e.target.value)}
                className="w-full text-sm border rounded-md px-3 py-2 bg-background"
              >
                {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <select
                value={form.currency}
                onChange={e => set('currency', e.target.value)}
                className="w-full text-sm border rounded-md px-3 py-2 bg-background"
              >
                <option value="UGX">UGX</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Min Amount</Label>
              <Input
                type="number"
                value={form.minAmount}
                onChange={e => set('minAmount', e.target.value)}
                placeholder="e.g., 5000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Amount</Label>
              <Input
                type="number"
                value={form.maxAmount}
                onChange={e => set('maxAmount', e.target.value)}
                placeholder="e.g., 500000000"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.interestRate}
                onChange={e => set('interestRate', e.target.value)}
                placeholder="e.g., 18.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interest Type</Label>
              <select
                value={form.interestType}
                onChange={e => set('interestType', e.target.value)}
                className="w-full text-sm border rounded-md px-3 py-2 bg-background"
              >
                <option value="">Not specified</option>
                {Object.entries(INTEREST_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Processing Fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.processingFee}
                onChange={e => set('processingFee', e.target.value)}
                placeholder="e.g., 2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Min Tenor (months)</Label>
              <Input
                type="number"
                value={form.tenorMinMonths}
                onChange={e => set('tenorMinMonths', e.target.value)}
                placeholder="e.g., 6"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Tenor (months)</Label>
              <Input
                type="number"
                value={form.tenorMaxMonths}
                onChange={e => set('tenorMaxMonths', e.target.value)}
                placeholder="e.g., 60"
              />
            </div>
            <div className="space-y-1.5 flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.collateralRequired}
                  onChange={e => set('collateralRequired', e.target.checked)}
                  className="rounded"
                />
                Collateral Required
              </label>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input
                value={form.contactPerson}
                onChange={e => set('contactPerson', e.target.value)}
                placeholder="Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input
                value={form.contactEmail}
                onChange={e => set('contactEmail', e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input
                value={form.contactPhone}
                onChange={e => set('contactPhone', e.target.value)}
                placeholder="+256..."
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full text-sm border rounded-md px-3 py-2 bg-background min-h-[60px] resize-y"
              placeholder="Additional details, eligibility criteria, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.provider.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
