/**
 * ProductDetailDrawer
 * Slide-out drawer showing full capital product details with edit/delete actions.
 */

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Building2,
  DollarSign,
  Clock,
  Shield,
  Phone,
  Mail,
  User,
  Percent,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { StatusChip } from '../shared/StatusChip';
import { formatCurrency } from '../shared/CurrencyDisplay';
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_COLORS,
  PROVIDER_TYPE_LABELS,
  INTEREST_TYPE_LABELS,
  PRODUCT_STATUS_LABELS,
} from '../../constants/capital.constants';
import type { CapitalProduct } from '../../types/capital.types';
import type { CapitalProductInput } from '../../schemas/capital.schemas';

interface ProductDetailDrawerProps {
  product: CapitalProduct | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (productId: string, updates: Partial<CapitalProductInput>) => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground block">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg">
      <div className="px-4 py-2.5 border-b bg-muted/30">
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

export function ProductDetailDrawer({ product, open, onClose, onUpdate, onDelete }: ProductDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});

  if (!product) return null;

  const startEdit = () => {
    setEditForm({
      name: product.name,
      provider: product.provider,
      providerType: product.providerType,
      productType: product.productType,
      currency: product.currency,
      minAmount: product.minAmount ?? '',
      maxAmount: product.maxAmount ?? '',
      interestRate: product.interestRate ?? '',
      interestType: product.interestType ?? '',
      tenorMinMonths: product.tenorMinMonths ?? '',
      tenorMaxMonths: product.tenorMaxMonths ?? '',
      processingFee: product.processingFee ?? '',
      collateralRequired: product.collateralRequired,
      contactPerson: product.contactPerson ?? '',
      contactEmail: product.contactEmail ?? '',
      contactPhone: product.contactPhone ?? '',
      notes: product.notes ?? '',
      status: product.status,
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (editForm.name) updates.name = editForm.name;
      if (editForm.provider) updates.provider = editForm.provider;
      updates.providerType = editForm.providerType;
      updates.productType = editForm.productType;
      updates.currency = editForm.currency;
      updates.collateralRequired = editForm.collateralRequired;
      updates.status = editForm.status;
      if (editForm.minAmount !== '') updates.minAmount = Number(editForm.minAmount);
      if (editForm.maxAmount !== '') updates.maxAmount = Number(editForm.maxAmount);
      if (editForm.interestRate !== '') updates.interestRate = Number(editForm.interestRate);
      if (editForm.interestType) updates.interestType = editForm.interestType;
      if (editForm.tenorMinMonths !== '') updates.tenorMinMonths = Number(editForm.tenorMinMonths);
      if (editForm.tenorMaxMonths !== '') updates.tenorMaxMonths = Number(editForm.tenorMaxMonths);
      if (editForm.processingFee !== '') updates.processingFee = Number(editForm.processingFee);
      if (editForm.contactPerson) updates.contactPerson = editForm.contactPerson;
      if (editForm.contactEmail) updates.contactEmail = editForm.contactEmail;
      if (editForm.contactPhone) updates.contactPhone = editForm.contactPhone;
      if (editForm.notes) updates.notes = editForm.notes;

      await onUpdate(product.id, updates as Partial<CapitalProductInput>);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(product.id);
      onClose();
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const set = (field: string, value: unknown) =>
    setEditForm(prev => ({ ...prev, [field]: value }));

  const statusColor = product.status === 'active' ? 'text-green-600' : product.status === 'inactive' ? 'text-gray-500' : 'text-red-500';

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { cancelEdit(); setConfirmDelete(false); onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between pr-8">
            <div className="space-y-1">
              <SheetTitle className="text-xl">{product.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" />
                {product.provider}
              </SheetDescription>
            </div>
            <StatusChip
              label={PRODUCT_TYPE_LABELS[product.productType]}
              color={PRODUCT_TYPE_COLORS[product.productType]}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant={confirmDelete ? 'destructive' : 'ghost'}
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {confirmDelete ? 'Confirm Delete' : 'Delete'}
                </Button>
                {confirmDelete && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                )}
              </>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-5 pb-6">
          {/* Status & Classification */}
          <Section title="Classification">
            {isEditing ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Product Name</Label>
                  <Input value={editForm.name as string} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Provider</Label>
                  <Input value={editForm.provider as string} onChange={e => set('provider', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Provider Type</Label>
                  <select value={editForm.providerType as string} onChange={e => set('providerType', e.target.value)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                    {Object.entries(PROVIDER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Product Type</Label>
                  <select value={editForm.productType as string} onChange={e => set('productType', e.target.value)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                    {Object.entries(PRODUCT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <select value={editForm.status as string} onChange={e => set('status', e.target.value)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                    {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <select value={editForm.currency as string} onChange={e => set('currency', e.target.value)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                    <option value="UGX">UGX</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6">
                <InfoRow icon={Building2} label="Provider Type" value={PROVIDER_TYPE_LABELS[product.providerType]} />
                <InfoRow icon={AlertCircle} label="Status" value={<span className={statusColor}>{PRODUCT_STATUS_LABELS[product.status]}</span>} />
                {product.sectors && product.sectors.length > 0 && (
                  <div className="col-span-2 py-2">
                    <span className="text-xs text-muted-foreground block mb-1">Target Sectors</span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.sectors.map((s, i) => (
                        <span key={i} className="text-xs bg-muted rounded-full px-2.5 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Financial Terms */}
          <Section title="Financial Terms">
            {isEditing ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min Amount</Label>
                  <Input type="number" value={editForm.minAmount as string} onChange={e => set('minAmount', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Amount</Label>
                  <Input type="number" value={editForm.maxAmount as string} onChange={e => set('maxAmount', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Interest Rate (%)</Label>
                  <Input type="number" step="0.1" value={editForm.interestRate as string} onChange={e => set('interestRate', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Interest Type</Label>
                  <select value={editForm.interestType as string} onChange={e => set('interestType', e.target.value)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                    <option value="">Not specified</option>
                    {Object.entries(INTEREST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min Tenor (months)</Label>
                  <Input type="number" value={editForm.tenorMinMonths as string} onChange={e => set('tenorMinMonths', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Tenor (months)</Label>
                  <Input type="number" value={editForm.tenorMaxMonths as string} onChange={e => set('tenorMaxMonths', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Processing Fee (%)</Label>
                  <Input type="number" step="0.1" value={editForm.processingFee as string} onChange={e => set('processingFee', e.target.value)} />
                </div>
                <div className="space-y-1 flex items-end">
                  <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
                    <input type="checkbox" checked={editForm.collateralRequired as boolean} onChange={e => set('collateralRequired', e.target.checked)} className="rounded" />
                    Collateral Required
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6">
                {(product.minAmount || product.maxAmount) && (
                  <InfoRow
                    icon={DollarSign}
                    label="Amount Range"
                    value={`${product.minAmount ? formatCurrency(product.minAmount, product.currency, true) : '—'} – ${product.maxAmount ? formatCurrency(product.maxAmount, product.currency, true) : '—'}`}
                  />
                )}
                {product.interestRate !== undefined && (
                  <InfoRow
                    icon={Percent}
                    label="Interest Rate"
                    value={
                      <>
                        {product.interestRate}% p.a.
                        {product.interestType && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({INTEREST_TYPE_LABELS[product.interestType]})
                          </span>
                        )}
                      </>
                    }
                  />
                )}
                {(product.tenorMinMonths || product.tenorMaxMonths) && (
                  <InfoRow
                    icon={Clock}
                    label="Tenor"
                    value={`${product.tenorMinMonths ?? '—'} – ${product.tenorMaxMonths ?? '—'} months`}
                  />
                )}
                {product.processingFee !== undefined && (
                  <InfoRow icon={Percent} label="Processing Fee" value={`${product.processingFee}%`} />
                )}
                <InfoRow
                  icon={Shield}
                  label="Collateral"
                  value={product.collateralRequired ? 'Required' : 'Not required'}
                />
                {product.collateralTypes && product.collateralTypes.length > 0 && (
                  <div className="col-span-2 py-2">
                    <span className="text-xs text-muted-foreground block mb-1">Accepted Collateral</span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.collateralTypes.map((t, i) => (
                        <span key={i} className="text-xs bg-muted rounded-full px-2.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Eligibility */}
          {(product.minRevenue || product.minYearsInBusiness) && !isEditing && (
            <Section title="Eligibility">
              <div className="grid grid-cols-2 gap-x-6">
                {product.minRevenue && (
                  <InfoRow
                    icon={DollarSign}
                    label="Minimum Revenue"
                    value={formatCurrency(product.minRevenue, product.currency, true)}
                  />
                )}
                {product.minYearsInBusiness && (
                  <InfoRow icon={Clock} label="Min Years in Business" value={`${product.minYearsInBusiness} years`} />
                )}
              </div>
            </Section>
          )}

          {/* Requirements */}
          {product.requirements.length > 0 && !isEditing && (
            <Section title={`Requirements (${product.requirements.filter(r => r.mandatory).length} mandatory)`}>
              <div className="space-y-2">
                {product.requirements.map((req, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2
                      className={`h-4 w-4 mt-0.5 shrink-0 ${req.mandatory ? 'text-amber-600' : 'text-muted-foreground'}`}
                    />
                    <div>
                      <span className="font-medium">{req.document}</span>
                      {req.mandatory && <span className="text-xs text-amber-600 ml-1.5">(mandatory)</span>}
                      {req.description && (
                        <span className="text-xs text-muted-foreground block">{req.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Contact Information */}
          {(product.contactPerson || product.contactEmail || product.contactPhone) && (
            <Section title="Contact Information">
              {isEditing ? (
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Contact Person</Label>
                    <Input value={editForm.contactPerson as string} onChange={e => set('contactPerson', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input value={editForm.contactEmail as string} onChange={e => set('contactEmail', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input value={editForm.contactPhone as string} onChange={e => set('contactPhone', e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {product.contactPerson && <InfoRow icon={User} label="Contact Person" value={product.contactPerson} />}
                  {product.contactEmail && <InfoRow icon={Mail} label="Email" value={product.contactEmail} />}
                  {product.contactPhone && <InfoRow icon={Phone} label="Phone" value={product.contactPhone} />}
                </div>
              )}
            </Section>
          )}

          {/* Notes */}
          {(product.notes || isEditing) && (
            <Section title="Notes">
              {isEditing ? (
                <textarea
                  value={editForm.notes as string}
                  onChange={e => set('notes', e.target.value)}
                  className="w-full text-sm border rounded-md px-3 py-2 bg-background min-h-[80px] resize-y"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{product.notes}</p>
              )}
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
