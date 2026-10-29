/**
 * AddOwnTaskDialog — "Add my own task".
 *
 * A person's own to-do lands in `generated_tasks` through `createTask`
 * (`source: personal`), so it shows in their inbox at once, is a candidate
 * for tomorrow's draft plan, and is visible to the manager reviewing their
 * day. Deliberately short: `enrichTaskOnCreate` fills in the brief when an
 * Anthropic key is configured.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Info, Plus } from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { describeCallableError } from '@/shared/utils/callableError';
import { nairobiDateKey } from '../format';
import { createTaskFn } from '../services/taskEngineFunctions';
import type { TaskPriority } from '../types';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'P0', label: 'Critical' },
  { value: 'P1', label: 'High' },
  { value: 'P2', label: 'Medium' },
  { value: 'P3', label: 'Low' },
];

export function AddOwnTaskDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (taskId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => nairobiDateKey());
  const [priority, setPriority] = useState<TaskPriority>('P2');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setDueDate(nairobiDateKey());
    setPriority('P2');
    setError(null);
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await createTaskFn({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(dueDate ? { dueDate } : {}),
        priority,
      });
      onCreated?.(res.data.id);
      onOpenChange(false);
    } catch (err) {
      console.error('[AddOwnTaskDialog] save failed:', err);
      setError(describeCallableError(err, 'add the task'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add my own task</DialogTitle>
          <DialogDescription>
            It goes straight into your inbox, and your manager sees it when planning your day.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="What needs to happen">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call the client about the revised brief"
              className="h-8 text-[12.5px]"
              data-testid="own-task-title"
            />
          </Field>
          <Field label="Details (optional)">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-[12.5px]"
              placeholder="Anything you will need to remember when you pick it up."
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Due">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-[12.5px]" />
            </Field>
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="h-8 w-full rounded-md border px-2 text-[12.5px]"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)', color: 'var(--fg-primary)' }}
                aria-label="Priority"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-[12.5px] flex items-start gap-1.5" style={{ color: 'var(--rag-red)' }}>
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="sm" className="gap-1.5" onClick={() => void handleSave()} disabled={saving || !title.trim()} data-testid="own-task-submit">
            <Plus className="h-3.5 w-3.5" />
            {saving ? 'Adding…' : 'Add to my tasks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default AddOwnTaskDialog;
