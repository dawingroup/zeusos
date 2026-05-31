import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import type {
  CreateKPIInput,
  KPIDefinition,
  UpdateKPIInput,
} from '../../types/kpi.types';
import {
  BSC_PERSPECTIVE_LABELS,
  KPI_CATEGORY,
  KPI_CATEGORY_LABELS,
  KPI_DATA_SOURCE,
  KPI_DIRECTION,
  KPI_DIRECTION_LABELS,
  KPI_FREQUENCY,
  KPI_FREQUENCY_LABELS,
  KPI_SCOPE,
  KPI_SCOPE_LABELS,
  KPI_TYPE,
  KPI_TYPE_LABELS,
  type BSCPerspective,
  type KPICategory,
  type KPIDirection,
  type KPIFrequency,
  type KPIScope,
  type KPIType,
} from '../../constants/kpi.constants';

interface KpiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  defaultOwner: { id: string; name: string };
  kpi?: KPIDefinition | null;
  onCreate?: (input: CreateKPIInput) => Promise<KPIDefinition>;
  onUpdate?: (id: string, input: UpdateKPIInput) => Promise<KPIDefinition>;
}

export const KpiDialog: React.FC<KpiDialogProps> = ({
  open,
  onOpenChange,
  mode,
  defaultOwner,
  kpi,
  onCreate,
  onUpdate,
}) => {
  const isEdit = mode === 'edit' && !!kpi;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<KPICategory>(KPI_CATEGORY.FINANCIAL);
  const [type, setType] = useState<KPIType>(KPI_TYPE.NUMERIC);
  const [scope, setScope] = useState<KPIScope>(KPI_SCOPE.GROUP);
  const [ownerId, setOwnerId] = useState(defaultOwner.id);
  const [ownerName, setOwnerName] = useState(defaultOwner.name);
  const [unit, setUnit] = useState('');
  const [direction, setDirection] = useState<KPIDirection>(KPI_DIRECTION.HIGHER_IS_BETTER);
  const [frequency, setFrequency] = useState<KPIFrequency>(KPI_FREQUENCY.MONTHLY);
  const [decimalPlaces, setDecimalPlaces] = useState('1');
  const [targetValue, setTargetValue] = useState('0');
  const [stretchValue, setStretchValue] = useState('');
  const [minimumValue, setMinimumValue] = useState('');
  const [bscPerspective, setBscPerspective] = useState<BSCPerspective | ''>('');
  const [tagsInput, setTagsInput] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit && kpi) {
      setCode(kpi.code);
      setName(kpi.name);
      setDescription(kpi.description || '');
      setCategory(kpi.category);
      setType(kpi.type);
      setScope(kpi.scope);
      setOwnerId(kpi.ownerId);
      setOwnerName(kpi.ownerName || '');
      setUnit(kpi.unit || '');
      setDirection(kpi.direction);
      setFrequency(kpi.frequency);
      setDecimalPlaces(String(kpi.decimalPlaces ?? 1));
      setTargetValue(String(kpi.target?.value ?? 0));
      setStretchValue(kpi.target?.stretchValue !== undefined ? String(kpi.target.stretchValue) : '');
      setMinimumValue(kpi.target?.minimumValue !== undefined ? String(kpi.target.minimumValue) : '');
      setBscPerspective(kpi.bscPerspective || '');
      setTagsInput((kpi.tags || []).join(', '));
    } else {
      setCode('');
      setName('');
      setDescription('');
      setCategory(KPI_CATEGORY.FINANCIAL);
      setType(KPI_TYPE.NUMERIC);
      setScope(KPI_SCOPE.GROUP);
      setOwnerId(defaultOwner.id);
      setOwnerName(defaultOwner.name);
      setUnit('');
      setDirection(KPI_DIRECTION.HIGHER_IS_BETTER);
      setFrequency(KPI_FREQUENCY.MONTHLY);
      setDecimalPlaces('1');
      setTargetValue('0');
      setStretchValue('');
      setMinimumValue('');
      setBscPerspective('');
      setTagsInput('');
    }
    setError(null);
  }, [open, isEdit, kpi, defaultOwner.id, defaultOwner.name]);

  const tagsArray = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const canSubmit =
    code.trim().length > 0 &&
    name.trim().length > 0 &&
    unit.trim().length > 0 &&
    !Number.isNaN(parseFloat(targetValue));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const parsedTarget = parseFloat(targetValue) || 0;
      const parsedStretch = stretchValue.trim() ? parseFloat(stretchValue) : undefined;
      const parsedMinimum = minimumValue.trim() ? parseFloat(minimumValue) : undefined;

      if (isEdit && kpi && onUpdate) {
        await onUpdate(kpi.id, {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          type,
          ownerId,
          ownerName: ownerName.trim() || undefined,
          unit: unit.trim(),
          direction,
          frequency,
          decimalPlaces: parseInt(decimalPlaces, 10) || 0,
          bscPerspective: bscPerspective || null,
          tags: tagsArray,
        });
      } else if (onCreate) {
        await onCreate({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          type,
          scope,
          ownerId,
          ownerName: ownerName.trim() || undefined,
          unit: unit.trim(),
          direction,
          frequency,
          decimalPlaces: parseInt(decimalPlaces, 10) || 0,
          target: {
            value: parsedTarget,
            stretchValue: parsedStretch,
            minimumValue: parsedMinimum,
          },
          dataSourceType: KPI_DATA_SOURCE.MANUAL,
          bscPerspective: bscPerspective || undefined,
          tags: tagsArray,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save KPI');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit KPI' : 'New KPI'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label htmlFor="kpi-code">Code *</Label>
              <Input
                id="kpi-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. REV-MRR"
                className="font-mono text-[12px]"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="kpi-name">Name *</Label>
              <Input
                id="kpi-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly Recurring Revenue"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="kpi-desc">Description</Label>
            <Textarea
              id="kpi-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this measure? How is it computed?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="kpi-category">Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as KPICategory)}>
                <SelectTrigger id="kpi-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KPI_CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kpi-type">Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as KPIType)}>
                <SelectTrigger id="kpi-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KPI_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kpi-scope">Scope *</Label>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as KPIScope)}
                disabled={isEdit}
              >
                <SelectTrigger id="kpi-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KPI_SCOPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label htmlFor="kpi-unit">Unit *</Label>
              <Input
                id="kpi-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%, UGX, count"
              />
            </div>
            <div>
              <Label htmlFor="kpi-direction">Direction *</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as KPIDirection)}>
                <SelectTrigger id="kpi-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KPI_DIRECTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kpi-freq">Frequency *</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as KPIFrequency)}>
                <SelectTrigger id="kpi-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KPI_FREQUENCY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kpi-decimals">Decimals</Label>
              <Input
                id="kpi-decimals"
                type="number"
                min={0}
                max={4}
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200">
            <div>
              <Label htmlFor="kpi-target">Target *</Label>
              <Input
                id="kpi-target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="kpi-stretch">Stretch (optional)</Label>
              <Input
                id="kpi-stretch"
                type="number"
                value={stretchValue}
                onChange={(e) => setStretchValue(e.target.value)}
                placeholder="Above-target ambition"
              />
            </div>
            <div>
              <Label htmlFor="kpi-min">Minimum (optional)</Label>
              <Input
                id="kpi-min"
                type="number"
                value={minimumValue}
                onChange={(e) => setMinimumValue(e.target.value)}
                placeholder="Floor below = critical"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="kpi-owner">Owner *</Label>
              <Input
                id="kpi-owner"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Who is accountable?"
              />
            </div>
            <div>
              <Label htmlFor="kpi-bsc">BSC Perspective (optional)</Label>
              <Select
                value={bscPerspective || '__none'}
                onValueChange={(v) => setBscPerspective(v === '__none' ? '' : (v as BSCPerspective))}
              >
                <SelectTrigger id="kpi-bsc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {Object.entries(BSC_PERSPECTIVE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="kpi-tags">Tags (comma-separated)</Label>
            <Input
              id="kpi-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="north-star, board-reported"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create KPI'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
