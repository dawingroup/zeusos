/**
 * StockAdjustmentForm
 * Create/edit form for stock adjustments with Zod validation.
 * Uses shadcn/ui + Tailwind to match the rest of the system.
 */

import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Send, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/core/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/core/components/ui/select';
import { stockAdjustmentSchema, type StockAdjustmentFormData } from '../../schemas/stockAdjustment.schema';
import {
  ADJUSTMENT_TYPE_GROUPS,
  ADJUSTMENT_TYPE_LABELS,
  type AdjustmentReferenceType,
  type StockAdjustmentLineItem,
} from '../../types/stockAdjustment';
import { StockAdjustmentLineItems } from './StockAdjustmentLineItems';
import {
  useCreateStockAdjustment,
  useUpdateStockAdjustment,
  useSubmitStockAdjustment,
} from '../../hooks/useStockAdjustments';

interface StockAdjustmentFormProps {
  userId: string;
  organizationId: string;
  subsidiaryId?: string;
  defaultValues?: Partial<StockAdjustmentFormData>;
  /** When editing an existing draft, pass its Firestore document ID */
  existingId?: string;
}

const REFERENCE_TYPE_OPTIONS: { value: AdjustmentReferenceType; label: string }[] = [
  { value: 'cycle_count', label: 'Cycle Count' },
  { value: 'manufacturing_order', label: 'Manufacturing Order' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'sales_order', label: 'Sales Order' },
  { value: 'damage_report', label: 'Damage Report' },
  { value: 'other', label: 'Other' },
];

export function StockAdjustmentForm({
  userId,
  organizationId,
  subsidiaryId,
  defaultValues,
  existingId,
}: StockAdjustmentFormProps) {
  const navigate = useNavigate();
  const createMutation = useCreateStockAdjustment();
  const updateMutation = useUpdateStockAdjustment();
  const submitMutation = useSubmitStockAdjustment();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustmentFormData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      adjustmentType: 'physical_count_variance',
      lineItems: [],
      reason: '',
      attachments: [],
      ...defaultValues,
    },
  });

  const adjustmentType = watch('adjustmentType');
  const lineItems = watch('lineItems') as StockAdjustmentLineItem[];

  const totals = useMemo(() => {
    const items = lineItems || [];
    const totalIncrease = items
      .filter(l => l.direction === 'increase')
      .reduce((sum, l) => sum + (l.totalValue || 0), 0);
    const totalDecrease = items
      .filter(l => l.direction === 'decrease')
      .reduce((sum, l) => sum + (l.totalValue || 0), 0);
    return { totalIncrease, totalDecrease, netImpact: totalIncrease - totalDecrease };
  }, [lineItems]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })
      .format(amount);

  /** Filter out zero-variance lines (counted qty = system qty) */
  const prepareData = (data: StockAdjustmentFormData): StockAdjustmentFormData => {
    const filteredLines = data.lineItems.filter(l => l.quantity > 0);
    return { ...data, lineItems: filteredLines.length > 0 ? filteredLines : data.lineItems };
  };

  /** Create or update depending on whether we're editing an existing draft */
  const saveOrCreate = async (data: StockAdjustmentFormData): Promise<string> => {
    const prepared = prepareData(data);
    if (existingId) {
      await updateMutation.mutateAsync({ id: existingId, data: prepared, userId });
      return existingId;
    }
    return createMutation.mutateAsync({
      data: prepared,
      userId,
      orgId: organizationId,
      subsidiaryId,
    });
  };

  const onSaveDraft = async (data: StockAdjustmentFormData) => {
    try {
      const id = await saveOrCreate(data);
      navigate(`/inventory/adjustments/${id}`);
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  };

  const onSubmitForApproval = async (data: StockAdjustmentFormData) => {
    try {
      const prepared = prepareData(data);
      if (prepared.lineItems.every(l => l.quantity === 0)) {
        return; // Nothing to adjust
      }
      const id = await saveOrCreate(prepared);
      await submitMutation.mutateAsync({ id, userId });
      navigate(`/inventory/adjustments/${id}`);
    } catch (err) {
      console.error('Failed to submit:', err);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('en-UG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/inventory/adjustments')}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {existingId ? 'Edit Stock Adjustment' : 'New Stock Adjustment'}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>{todayFormatted}</span>
        </div>
      </div>

      {/* Section 1: Adjustment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adjustment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Adjustment Type</Label>
            <Controller
              name="adjustmentType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ADJUSTMENT_TYPE_GROUPS).map(([group, types]) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {types.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ADJUSTMENT_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.adjustmentType && (
              <p className="text-xs text-destructive">{errors.adjustmentType.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Reason / Explanation <span className="text-destructive">*</span></Label>
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="Explain why this adjustment is needed (min. 10 characters)..."
                />
              )}
            />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reference Type</Label>
              <Controller
                name="referenceType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? undefined : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {REFERENCE_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Controller
                name="referenceNumber"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    placeholder="e.g. MO-2025-0042"
                  />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.lineItems && typeof errors.lineItems.message === 'string' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">
              {errors.lineItems.message}
            </div>
          )}
          <Controller
            name="lineItems"
            control={control}
            render={({ field }) => (
              <StockAdjustmentLineItems
                lineItems={(field.value || []) as StockAdjustmentLineItem[]}
                onChange={field.onChange}
                adjustmentType={adjustmentType}
              />
            )}
          />
        </CardContent>
      </Card>

      {/* Section 3: Summary */}
      {lineItems && lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Total Increase</p>
                <p className="text-lg font-semibold text-green-600">+{formatCurrency(totals.totalIncrease)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Decrease</p>
                <p className="text-lg font-semibold text-red-600">-{formatCurrency(totals.totalDecrease)}</p>
              </div>
              <div className="border-l pl-8">
                <p className="text-xs text-muted-foreground">Net Impact</p>
                <p className={`text-lg font-bold ${totals.netImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totals.netImpact >= 0 ? '+' : ''}{formatCurrency(totals.netImpact)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pb-8">
        <Button variant="ghost" onClick={() => navigate('/inventory/adjustments')}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={handleSubmit(onSaveDraft)}
          disabled={isSubmitting || createMutation.isPending}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          Save Draft
        </Button>
        <Button
          onClick={handleSubmit(onSubmitForApproval)}
          disabled={isSubmitting || createMutation.isPending || submitMutation.isPending}
          className="gap-1.5"
        >
          <Send className="h-4 w-4" />
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}
