/**
 * ChecklistPanel — pre-production checklist tab content.
 */

import { useEffect, useState } from 'react';
import {
  listChecklistItems,
  addChecklistItem,
  completeChecklistItem,
  uncompleteChecklistItem,
  deleteChecklistItem,
} from '../services/checklist.service';
import type { ChecklistItem } from '../types/production-checklist.types';

interface Props {
  jobId: string;
  currentUserId: string;
}

export function ChecklistPanel({ jobId, currentUserId }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newDue, setNewDue] = useState('');
  const [loading, setLoading] = useState(true);

  async function reload() {
    const rows = await listChecklistItems(jobId);
    setItems(rows);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [jobId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    await addChecklistItem(jobId, { label: newLabel.trim(), dueDate: newDue || undefined });
    setNewLabel('');
    setNewDue('');
    await reload();
  }

  async function handleToggle(item: ChecklistItem) {
    if (item.completedAt) {
      await uncompleteChecklistItem(jobId, item.id);
    } else {
      await completeChecklistItem(jobId, item.id, currentUserId);
    }
    await reload();
  }

  async function handleDelete(itemId: string) {
    await deleteChecklistItem(jobId, itemId);
    await reload();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading checklist…</p>;

  const done  = items.filter((i) => i.completedAt);
  const todo  = items.filter((i) => !i.completedAt);

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add checklist item…"
          className="flex-1 rounded border px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
          className="rounded border px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Add
        </button>
      </form>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No checklist items yet.</p>
      )}

      {todo.length > 0 && (
        <ul className="divide-y rounded border">
          {todo.map((item) => (
            <li key={item.id} className="flex items-center gap-2 p-2">
              <input
                type="checkbox"
                checked={false}
                onChange={() => handleToggle(item)}
                className="rounded"
              />
              <span className="flex-1 text-sm">{item.label}</span>
              {item.dueDate && (
                <span className="text-xs text-muted-foreground">{item.dueDate}</span>
              )}
              <button
                onClick={() => handleDelete(item.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Completed ({done.length})
          </summary>
          <ul className="mt-2 divide-y rounded border opacity-60">
            {done.map((item) => (
              <li key={item.id} className="flex items-center gap-2 p-2">
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => handleToggle(item)}
                  className="rounded"
                />
                <span className="flex-1 text-sm line-through">{item.label}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
