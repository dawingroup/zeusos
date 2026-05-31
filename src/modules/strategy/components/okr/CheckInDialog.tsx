import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
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
import type { CheckInInput, KeyResult } from '../../types/okr.types';
import {
  CONFIDENCE_LEVEL,
  CONFIDENCE_LEVEL_LABELS,
  KEY_RESULT_TYPE,
  type ConfidenceLevel,
} from '../../constants/okr.constants';

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: KeyResult;
  onSubmit: (input: CheckInInput) => Promise<void>;
}

export const CheckInDialog: React.FC<CheckInDialogProps> = ({
  open,
  onOpenChange,
  keyResult,
  onSubmit,
}) => {
  const [newValue, setNewValue] = useState<string>('');
  const [confidence, setConfidence] = useState<ConfidenceLevel>(CONFIDENCE_LEVEL.ON_TRACK);
  const [note, setNote] = useState('');
  const [blockers, setBlockers] = useState<string[]>([]);
  const [blockerDraft, setBlockerDraft] = useState('');
  const [wins, setWins] = useState<string[]>([]);
  const [winDraft, setWinDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewValue(String(keyResult.currentValue ?? 0));
      setConfidence(keyResult.confidence || CONFIDENCE_LEVEL.ON_TRACK);
      setNote('');
      setBlockers([]);
      setBlockerDraft('');
      setWins([]);
      setWinDraft('');
      setError(null);
    }
  }, [open, keyResult]);

  const isBinary = keyResult.type === KEY_RESULT_TYPE.BINARY;
  const isMilestone = keyResult.type === KEY_RESULT_TYPE.MILESTONE;

  const handleAddBlocker = () => {
    const v = blockerDraft.trim();
    if (!v || blockers.includes(v)) return;
    setBlockers([...blockers, v]);
    setBlockerDraft('');
  };
  const handleAddWin = () => {
    const v = winDraft.trim();
    if (!v || wins.includes(v)) return;
    setWins([...wins, v]);
    setWinDraft('');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const parsed = isBinary ? (newValue === '1' || newValue === 'true' ? 1 : 0) : parseFloat(newValue);
      if (!isBinary && Number.isNaN(parsed)) {
        setError('Enter a valid number');
        setSubmitting(false);
        return;
      }
      await onSubmit({
        keyResultId: keyResult.id,
        newValue: parsed,
        confidence,
        note: note.trim() || undefined,
        blockers,
        wins,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log check-in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Check in on key result</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-[12px] text-gray-500">Key result</p>
            <p className="text-[13px] font-medium text-gray-900">{keyResult.title}</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Current: <span className="font-medium">{keyResult.currentValue}</span>
              {keyResult.unit && ` ${keyResult.unit}`} · Target:{' '}
              <span className="font-medium">{keyResult.targetValue}</span>
              {keyResult.unit && ` ${keyResult.unit}`}
            </p>
          </div>

          {isMilestone ? (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
              Milestone-type KRs are updated by completing milestones. Use the milestone list on the
              objective page.
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="checkin-value">
                  {isBinary ? 'Achieved?' : 'New value'}
                </Label>
                {isBinary ? (
                  <Select value={newValue || '0'} onValueChange={setNewValue}>
                    <SelectTrigger id="checkin-value">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Not yet</SelectItem>
                      <SelectItem value="1">Yes — achieved</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="checkin-value"
                    type="number"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                )}
              </div>

              <div>
                <Label htmlFor="checkin-confidence">Confidence</Label>
                <Select
                  value={confidence}
                  onValueChange={(v) => setConfidence(v as ConfidenceLevel)}
                >
                  <SelectTrigger id="checkin-confidence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONFIDENCE_LEVEL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="checkin-note">Update note</Label>
            <Textarea
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened this period? What's next?"
              rows={3}
            />
          </div>

          <ChipList
            label="Wins"
            chips={wins}
            draft={winDraft}
            onDraftChange={setWinDraft}
            onAdd={handleAddWin}
            onRemove={(idx) => setWins(wins.filter((_, i) => i !== idx))}
            chipClass="bg-green-50 text-green-700 border-green-200"
            placeholder="Add a win"
          />

          <ChipList
            label="Blockers"
            chips={blockers}
            draft={blockerDraft}
            onDraftChange={setBlockerDraft}
            onAdd={handleAddBlocker}
            onRemove={(idx) => setBlockers(blockers.filter((_, i) => i !== idx))}
            chipClass="bg-red-50 text-red-700 border-red-200"
            placeholder="Add a blocker"
          />

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
            disabled={submitting || isMilestone}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface ChipListProps {
  label: string;
  chips: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  chipClass: string;
  placeholder: string;
}

const ChipList: React.FC<ChipListProps> = ({
  label,
  chips,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  chipClass,
  placeholder,
}) => (
  <div>
    <Label>{label}</Label>
    <div className="flex items-center gap-2">
      <Input
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button variant="outline" size="sm" type="button" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" />
        Add
      </Button>
    </div>
    {chips.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((chip, idx) => (
          <span
            key={`${chip}-${idx}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${chipClass}`}
          >
            {chip}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="hover:opacity-70"
              aria-label={`Remove ${chip}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    )}
  </div>
);
