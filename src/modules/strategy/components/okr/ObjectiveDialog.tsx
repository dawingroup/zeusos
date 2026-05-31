import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
  CreateKeyResultInput,
  CreateObjectiveInput,
  OKRCyclePeriod,
  OKRObjective,
  UpdateObjectiveInput,
} from '../../types/okr.types';
import { KpiPicker } from './KpiPicker';
import {
  KEY_RESULT_TYPE,
  KEY_RESULT_TYPE_LABELS,
  OKR_LEVEL,
  OKR_LEVEL_LABELS,
  OKR_OWNER_TYPE,
  OKR_VISIBILITY,
  OKR_VISIBILITY_LABELS,
  type KeyResultType,
  type OKRLevel,
  type OKROwnerType,
  type OKRVisibility,
} from '../../constants/okr.constants';

interface ObjectiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  companyId: string;
  cycles: OKRCyclePeriod[];
  defaultCycleId: string | null;
  defaultOwner: { id: string; name: string };
  objective?: OKRObjective | null;
  onCreate?: (input: CreateObjectiveInput) => Promise<OKRObjective>;
  onUpdate?: (id: string, input: UpdateObjectiveInput) => Promise<OKRObjective>;
}

interface KRDraft {
  tempId: string;
  title: string;
  type: KeyResultType;
  unit: string;
  startValue: string;
  targetValue: string;
  linkedKpiId: string | null;
  linkedKpiName: string | null;
  linkedKpiUnit: string | null;
}

function newKRDraft(): KRDraft {
  return {
    tempId: Math.random().toString(36).slice(2),
    title: '',
    type: KEY_RESULT_TYPE.NUMERIC,
    unit: '',
    startValue: '0',
    targetValue: '100',
    linkedKpiId: null,
    linkedKpiName: null,
    linkedKpiUnit: null,
  };
}

export const ObjectiveDialog: React.FC<ObjectiveDialogProps> = ({
  open,
  onOpenChange,
  mode,
  companyId,
  cycles,
  defaultCycleId,
  defaultOwner,
  objective,
  onCreate,
  onUpdate,
}) => {
  const isEdit = mode === 'edit' && !!objective;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState<OKRLevel>(OKR_LEVEL.COMPANY);
  const [ownerType, setOwnerType] = useState<OKROwnerType>(OKR_OWNER_TYPE.USER);
  const [ownerId, setOwnerId] = useState(defaultOwner.id);
  const [ownerName, setOwnerName] = useState(defaultOwner.name);
  const [cycleId, setCycleId] = useState<string | null>(defaultCycleId);
  const [visibility, setVisibility] = useState<OKRVisibility>(OKR_VISIBILITY.PUBLIC);
  const [tagsInput, setTagsInput] = useState('');
  const [isStretch, setIsStretch] = useState(false);
  const [krs, setKrs] = useState<KRDraft[]>([newKRDraft()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from objective on edit / reset on open
  useEffect(() => {
    if (!open) return;
    if (isEdit && objective) {
      setTitle(objective.title);
      setDescription(objective.description || '');
      setCategory(objective.category || '');
      setLevel(objective.level);
      setOwnerType(objective.ownerType);
      setOwnerId(objective.ownerId);
      setOwnerName(objective.ownerName);
      setCycleId(objective.cycleId);
      setVisibility(objective.visibility);
      setTagsInput((objective.tags || []).join(', '));
      setIsStretch(objective.isStretch || false);
      setKrs([]); // KRs are managed on detail page in edit mode
    } else {
      setTitle('');
      setDescription('');
      setCategory('');
      setLevel(OKR_LEVEL.COMPANY);
      setOwnerType(OKR_OWNER_TYPE.USER);
      setOwnerId(defaultOwner.id);
      setOwnerName(defaultOwner.name);
      setCycleId(defaultCycleId);
      setVisibility(OKR_VISIBILITY.PUBLIC);
      setTagsInput('');
      setIsStretch(false);
      setKrs([newKRDraft()]);
    }
    setError(null);
  }, [open, isEdit, objective, defaultCycleId, defaultOwner.id, defaultOwner.name]);

  const tagsArray = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const canSubmit = title.trim().length > 0 && !!cycleId && ownerName.trim().length > 0;

  const handleAddKR = () => {
    if (krs.length >= 5) return;
    setKrs((prev) => [...prev, newKRDraft()]);
  };

  const handleRemoveKR = (tempId: string) => {
    setKrs((prev) => prev.filter((kr) => kr.tempId !== tempId));
  };

  const handleKRChange = <K extends keyof KRDraft>(tempId: string, key: K, value: KRDraft[K]) => {
    setKrs((prev) => prev.map((kr) => (kr.tempId === tempId ? { ...kr, [key]: value } : kr)));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && objective && onUpdate) {
        await onUpdate(objective.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          tags: tagsArray,
          visibility,
        });
      } else if (onCreate) {
        const krInputs: CreateKeyResultInput[] = krs
          .filter((kr) => kr.title.trim().length > 0)
          .map((kr) => ({
            title: kr.title.trim(),
            type: kr.type,
            unit: kr.unit.trim() || undefined,
            startValue: parseFloat(kr.startValue) || 0,
            targetValue: parseFloat(kr.targetValue) || 0,
            linkedKpiId: kr.linkedKpiId || undefined,
            linkedKpiName: kr.linkedKpiName || undefined,
            linkedKpiUnit: kr.linkedKpiUnit || undefined,
          }));

        await onCreate({
          level,
          ownerId,
          ownerType,
          ownerName: ownerName.trim(),
          cycleId: cycleId!,
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          tags: tagsArray,
          visibility,
          isStretch,
          keyResults: krInputs,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save objective');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit objective' : 'New objective'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="obj-title">Objective *</Label>
            <Input
              id="obj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Become the trusted furniture brand in East Africa"
            />
          </div>

          <div>
            <Label htmlFor="obj-desc">Description</Label>
            <Textarea
              id="obj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why does this objective matter? What does success look like?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="obj-level">Level *</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as OKRLevel)} disabled={isEdit}>
                <SelectTrigger id="obj-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OKR_LEVEL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="obj-cycle">Cycle *</Label>
              <Select
                value={cycleId ?? undefined}
                onValueChange={(v) => setCycleId(v)}
                disabled={isEdit}
              >
                <SelectTrigger id="obj-cycle">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="obj-owner">Owner *</Label>
              <Input
                id="obj-owner"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner name"
              />
            </div>
            <div>
              <Label htmlFor="obj-category">Category</Label>
              <Input
                id="obj-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Growth, Quality, Talent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="obj-visibility">Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as OKRVisibility)}>
                <SelectTrigger id="obj-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OKR_VISIBILITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="obj-tags">Tags (comma-separated)</Label>
              <Input
                id="obj-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="growth, h2-priority"
              />
            </div>
          </div>

          {!isEdit && (
            <div className="flex items-center gap-2 pt-1">
              <input
                id="obj-stretch"
                type="checkbox"
                checked={isStretch}
                onChange={(e) => setIsStretch(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <Label htmlFor="obj-stretch" className="text-[12px] cursor-pointer">
                Mark as stretch objective
              </Label>
            </div>
          )}

          {!isEdit && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <Label>Key results</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddKR}
                  disabled={krs.length >= 5}
                  type="button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add KR
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 mb-3">
                Start with 2–5 measurable key results. You can add more later from the objective
                page.
              </p>
              <div className="space-y-3">
                {krs.map((kr, idx) => (
                  <div
                    key={kr.tempId}
                    className="border border-gray-200 rounded-md p-3 bg-gray-50/50"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-[11px] font-medium text-gray-500 mt-1.5 w-8 flex-shrink-0">
                        KR {idx + 1}
                      </span>
                      <Input
                        value={kr.title}
                        onChange={(e) => handleKRChange(kr.tempId, 'title', e.target.value)}
                        placeholder="e.g. Increase customer NPS from 32 to 50"
                        className="flex-1"
                      />
                      {krs.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveKR(kr.tempId)}
                          type="button"
                          aria-label="Remove KR"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 pl-10">
                      <div>
                        <Label className="text-[10px] text-gray-500">Type</Label>
                        <Select
                          value={kr.type}
                          onValueChange={(v) =>
                            handleKRChange(kr.tempId, 'type', v as KeyResultType)
                          }
                        >
                          <SelectTrigger className="h-7 text-[12px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(KEY_RESULT_TYPE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Start</Label>
                        <Input
                          type="number"
                          value={kr.startValue}
                          onChange={(e) => handleKRChange(kr.tempId, 'startValue', e.target.value)}
                          className="h-7 text-[12px]"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Target</Label>
                        <Input
                          type="number"
                          value={kr.targetValue}
                          onChange={(e) => handleKRChange(kr.tempId, 'targetValue', e.target.value)}
                          className="h-7 text-[12px]"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Unit</Label>
                        <Input
                          value={kr.unit}
                          onChange={(e) => handleKRChange(kr.tempId, 'unit', e.target.value)}
                          placeholder="%, $, count"
                          className="h-7 text-[12px]"
                        />
                      </div>
                    </div>
                    <div className="pl-10 mt-2">
                      <Label className="text-[10px] text-gray-500">Tracked by KPI (optional)</Label>
                      <KpiPicker
                        companyId={companyId}
                        selectedKpiId={kr.linkedKpiId}
                        selectedKpiName={kr.linkedKpiName}
                        onChange={(picked) => {
                          handleKRChange(kr.tempId, 'linkedKpiId', picked?.id || null);
                          handleKRChange(kr.tempId, 'linkedKpiName', picked?.name || null);
                          handleKRChange(kr.tempId, 'linkedKpiUnit', picked?.unit || null);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            {isEdit ? 'Save changes' : 'Create objective'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
