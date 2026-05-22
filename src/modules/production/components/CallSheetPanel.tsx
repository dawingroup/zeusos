/**
 * CallSheetPanel — shoot days tab on ProductionJobDetailPage.
 */

import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ShootDay } from '../types/shoot-day.types';

const JOBS_COLL = 'production_jobs';
const DAYS_SUBCOLL = 'shoot_days';

interface Props {
  jobId: string;
}

export function CallSheetPanel({ jobId }: Props) {
  const [days, setDays] = useState<ShootDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    date: '',
    callTime: '',
    wrapTime: '',
    location: '',
    crewIds: '',
    talentIds: '',
    equipmentList: '',
  });

  async function reload() {
    const snap = await getDocs(
      query(collection(db, JOBS_COLL, jobId, DAYS_SUBCOLL), orderBy('date')),
    );
    setDays(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShootDay, 'id'>) })));
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, [jobId]);

  function splitToArray(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await addDoc(collection(db, JOBS_COLL, jobId, DAYS_SUBCOLL), {
      jobId,
      date: form.date,
      callTime: form.callTime,
      wrapTime: form.wrapTime || undefined,
      location: form.location,
      crewIds: splitToArray(form.crewIds),
      talentIds: splitToArray(form.talentIds),
      equipmentList: splitToArray(form.equipmentList),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setAdding(false);
    setForm({ date: '', callTime: '', wrapTime: '', location: '', crewIds: '', talentIds: '', equipmentList: '' });
    await reload();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading call sheets…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          Add Shoot Day
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-3 rounded border p-4">
          <h3 className="font-medium text-sm">New Shoot Day</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Date</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded border px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Call Time</label>
              <input required type="time" value={form.callTime} onChange={(e) => setForm({ ...form, callTime: e.target.value })}
                className="w-full rounded border px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Wrap Time</label>
              <input type="time" value={form.wrapTime} onChange={(e) => setForm({ ...form, wrapTime: e.target.value })}
                className="w-full rounded border px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Location</label>
            <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded border px-2 py-1.5 text-sm" placeholder="e.g. Kololo Studio" />
          </div>
          {[
            { field: 'crewIds',       label: 'Crew IDs (comma-separated)' },
            { field: 'talentIds',     label: 'Talent IDs (comma-separated)' },
            { field: 'equipmentList', label: 'Equipment (comma-separated)' },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-xs font-medium mb-1">{label}</label>
              <input
                value={form[field as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded border px-2 py-1.5 text-sm"
                placeholder="optional"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
            <button type="submit" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">Save</button>
          </div>
        </form>
      )}

      {days.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No shoot days scheduled.</p>
      )}

      <div className="space-y-3">
        {days.map((day) => (
          <div key={day.id} className="rounded border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{day.date}</span>
              <span className="text-xs text-muted-foreground">
                Call: {day.callTime}{day.wrapTime ? ` · Wrap: ${day.wrapTime}` : ''}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{day.location}</p>
            {day.crewIds.length > 0 && (
              <p className="text-xs">Crew: {day.crewIds.join(', ')}</p>
            )}
            {day.talentIds.length > 0 && (
              <p className="text-xs">Talent: {day.talentIds.join(', ')}</p>
            )}
            {day.equipmentList.length > 0 && (
              <p className="text-xs">Equipment: {day.equipmentList.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
