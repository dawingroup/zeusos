/**
 * PostProductionPanel — post-production phases tab on ProductionJobDetailPage.
 */

import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { PostPhase, PostPhaseKind, PostPhaseStatus } from '../types/post-phase.types';

const JOBS_COLL    = 'production_jobs';
const PHASES_SUBCOLL = 'post_phases';

const PHASE_KINDS: PostPhaseKind[] = [
  'EDIT', 'COLOUR_GRADE', 'SOUND_MIX', 'CLIENT_PREVIEW', 'FINAL_MASTER',
];

const STATUS_OPTIONS: PostPhaseStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE'];

const STATUS_STYLES: Record<PostPhaseStatus, string> = {
  PENDING:     'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  DONE:        'bg-green-100 text-green-700',
};

interface Props {
  jobId: string;
}

export function PostProductionPanel({ jobId }: Props) {
  const [phases, setPhases] = useState<PostPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newPhase, setNewPhase] = useState<PostPhaseKind>('EDIT');
  const [newDue, setNewDue] = useState('');

  async function reload() {
    const snap = await getDocs(
      query(collection(db, JOBS_COLL, jobId, PHASES_SUBCOLL), orderBy('createdAt')),
    );
    setPhases(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostPhase, 'id'>) })));
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, [jobId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await addDoc(collection(db, JOBS_COLL, jobId, PHASES_SUBCOLL), {
      jobId,
      phase: newPhase,
      status: 'PENDING',
      dueDate: newDue || undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setAdding(false);
    await reload();
  }

  async function handleStatusChange(phase: PostPhase, status: PostPhaseStatus) {
    await updateDoc(doc(db, JOBS_COLL, jobId, PHASES_SUBCOLL, phase.id), {
      status,
      updatedAt: serverTimestamp(),
    });
    await reload();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading post-production phases…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          Add Phase
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex gap-2 items-end rounded border p-3">
          <div>
            <label className="block text-xs font-medium mb-1">Phase</label>
            <select value={newPhase} onChange={(e) => setNewPhase(e.target.value as PostPhaseKind)}
              className="rounded border px-2 py-1.5 text-sm">
              {PHASE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Due Date</label>
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)}
              className="rounded border px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
        </form>
      )}

      {phases.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No post-production phases yet.</p>
      )}

      <ul className="divide-y rounded border">
        {phases.map((phase) => (
          <li key={phase.id} className="flex items-center justify-between p-3">
            <div>
              <span className="font-medium text-sm">{phase.phase}</span>
              {phase.dueDate && (
                <span className="ml-2 text-xs text-muted-foreground">Due: {phase.dueDate}</span>
              )}
            </div>
            <select
              value={phase.status}
              onChange={(e) => handleStatusChange(phase, e.target.value as PostPhaseStatus)}
              className={`rounded px-2 py-0.5 text-xs font-medium border-0 ${STATUS_STYLES[phase.status]}`}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
