import React, { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import type { OKRCyclePeriod, CreateCycleInput } from '../../types/okr.types';
import {
  OKR_CYCLE,
  OKR_CYCLE_LABELS,
  OKR_CYCLE_STATUS_LABELS,
  getCurrentQuarter,
  getQuarterDates,
  type OKRCycle,
} from '../../constants/okr.constants';

interface CycleSelectorProps {
  cycles: OKRCyclePeriod[];
  selectedCycleId: string | null;
  onSelect: (cycleId: string) => void;
  onCreate: (input: CreateCycleInput) => Promise<OKRCyclePeriod>;
  loading?: boolean;
}

export const CycleSelector: React.FC<CycleSelectorProps> = ({
  cycles,
  selectedCycleId,
  onSelect,
  onCreate,
  loading,
}) => {
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreated = (cycle: OKRCyclePeriod) => {
    setCreateOpen(false);
    onSelect(cycle.id);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedCycleId ?? undefined} onValueChange={onSelect} disabled={loading}>
        <SelectTrigger className="h-8 min-w-[220px] text-[13px]">
          <SelectValue placeholder={cycles.length === 0 ? 'No cycles yet' : 'Select cycle'} />
        </SelectTrigger>
        <SelectContent>
          {cycles.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="truncate">
                {c.name}{' '}
                <span className="text-[var(--fg-tertiary)] text-[11px]">
                  · {OKR_CYCLE_STATUS_LABELS[c.status]}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        New cycle
      </Button>
      {createOpen && (
        <CreateCycleDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={onCreate}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

interface CreateCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateCycleInput) => Promise<OKRCyclePeriod>;
  onCreated: (cycle: OKRCyclePeriod) => void;
}

const CreateCycleDialog: React.FC<CreateCycleDialogProps> = ({
  open,
  onOpenChange,
  onCreate,
  onCreated,
}) => {
  const currentYear = new Date().getFullYear();
  const currentQuarter = getCurrentQuarter();
  const [year, setYear] = useState(currentYear);
  const [cycle, setCycle] = useState<OKRCycle>(currentQuarter);
  const [name, setName] = useState(`${currentQuarter} ${currentYear}`);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { start, end } = getQuarterDates(year, cycle);
      const created = await onCreate({
        cycle,
        year,
        quarter: cycle === OKR_CYCLE.ANNUAL || cycle === OKR_CYCLE.CUSTOM
          ? undefined
          : parseInt(cycle.replace('Q', ''), 10),
        name: name.trim() || `${cycle} ${year}`,
        startDate: start,
        endDate: end,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cycle');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New OKR cycle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cycle-name">Name</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cycle-period">Period</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as OKRCycle)}>
                <SelectTrigger id="cycle-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OKR_CYCLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cycle-year">Year</Label>
              <Input
                id="cycle-year"
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
              />
            </div>
          </div>
          {error && (
            <p className="text-[12px] text-[var(--rag-red)]">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create cycle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
