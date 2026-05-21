/**
 * FeaturedUpdatesPage
 *
 * Authoring surface for the "Today in the studio" rotating section on
 * dawinfinishes.com home. Records publish to Shopify `featured_update`
 * metaobjects on save when `shouldPublishToShopify=true`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToFeaturedUpdates,
  createFeaturedUpdate,
  updateFeaturedUpdate,
  deleteFeaturedUpdate,
  uploadFeaturedImage,
} from '../services/featuredUpdateService';
import type {
  FeaturedUpdate,
  FeaturedUpdateFormData,
  FeaturedUpdateCategory,
  FeaturedUpdateTone,
} from '../types/featured-update.types';

const DEFAULT_SUBSIDIARY = 'finishes';
const CATEGORIES: FeaturedUpdateCategory[] = ['bench', 'shipment', 'delivery', 'press', 'launch'];
const TONES: FeaturedUpdateTone[] = ['warm', 'cool', 'bold', 'raw'];

const SYNC_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  unpublished: 'bg-gray-100 text-gray-600',
};

function toLocalDT(ts: Timestamp): string {
  const d = ts.toDate();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function emptyForm(): FeaturedUpdateFormData {
  return {
    subsidiaryId: DEFAULT_SUBSIDIARY,
    handle: '',
    headline: '',
    subhead: '',
    eyebrow: '',
    imageUrl: '',
    linkUrl: '',
    linkLabel: '',
    benchId: '',
    projectCaseStudyId: '',
    liveFrom: Timestamp.now(),
    liveUntil: undefined,
    priority: 5,
    category: 'bench',
    tone: 'warm',
    published: true,
    shouldPublishToShopify: false,
  };
}

export default function FeaturedUpdatesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FeaturedUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeaturedUpdate | null>(null);
  const [form, setForm] = useState<FeaturedUpdateFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToFeaturedUpdates(DEFAULT_SUBSIDIARY, (data) => {
      setRows(data);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.headline.toLowerCase().includes(q) ||
        r.handle.toLowerCase().includes(q) ||
        (r.eyebrow || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setImageFile(null);
    setShowForm(true);
  }

  function openEdit(u: FeaturedUpdate) {
    setEditing(u);
    setForm({
      subsidiaryId: u.subsidiaryId,
      handle: u.handle,
      headline: u.headline,
      subhead: u.subhead,
      eyebrow: u.eyebrow || '',
      imageUrl: u.imageUrl,
      linkUrl: u.linkUrl || '',
      linkLabel: u.linkLabel || '',
      benchId: u.benchId || '',
      projectCaseStudyId: u.projectCaseStudyId || '',
      liveFrom: u.liveFrom,
      liveUntil: u.liveUntil,
      priority: u.priority,
      category: u.category,
      tone: u.tone || 'warm',
      published: u.published,
      shouldPublishToShopify: u.shouldPublishToShopify,
    });
    setImageFile(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid) return;
    setSubmitting(true);
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        const id = editing?.id || 'pending';
        imageUrl = await uploadFeaturedImage(imageFile, id);
      }
      if (!imageUrl) throw new Error('Image is required');
      const payload = { ...form, imageUrl };
      if (editing) {
        await updateFeaturedUpdate(editing.id, payload, user.uid);
      } else {
        await createFeaturedUpdate(payload, user.uid);
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error('Failed to save featured update', err);
      alert((err as Error).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(u: FeaturedUpdate) {
    if (!confirm(`Delete featured update "${u.headline}"?`)) return;
    try {
      await deleteFeaturedUpdate(u.id);
    } catch (err) {
      alert((err as Error).message || 'Delete failed');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Helmet>
        <title>Today · Marketing · ZeusOS</title>
      </Helmet>

      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Today in the studio</h1>
          <p className="text-sm text-gray-500">
            Weekly rotating workshop snippets. The 3 most recent live items appear on dawinfinishes.com home.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> New update
        </button>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search headline, handle, eyebrow…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black"
        />
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Headline</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Live window</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cat / Tone</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Pri</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sync</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No featured updates yet.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    {u.imageUrl && <img src={u.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />}
                    <div>
                      <div className="font-medium text-gray-900">{u.headline}</div>
                      <div className="text-xs text-gray-500">{u.eyebrow} · {u.subhead}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  <div>From: {u.liveFrom.toDate().toISOString().slice(0, 16).replace('T', ' ')}</div>
                  {u.liveUntil && <div>Until: {u.liveUntil.toDate().toISOString().slice(0, 16).replace('T', ' ')}</div>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <div>{u.category}</div>
                  {u.tone && <div className="text-gray-500">{u.tone}</div>}
                </td>
                <td className="px-4 py-3 text-sm">{u.priority}</td>
                <td className="px-4 py-3 text-xs">
                  {u.shopifySyncStatus ? (
                    <span className={`rounded px-2 py-0.5 ${SYNC_BADGES[u.shopifySyncStatus] || 'bg-gray-100'}`}>
                      {u.shopifySyncStatus}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  <button onClick={() => openEdit(u)} className="text-gray-500 hover:text-gray-900 mr-3" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(u)} className="text-gray-400 hover:text-rose-600" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-semibold">{editing ? 'Edit featured update' : 'New featured update'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-700">Handle *</span>
                <input required type="text" value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  placeholder="wk-19-walnut-credenza"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Eyebrow</span>
                <input type="text" value={form.eyebrow || ''}
                  onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
                  placeholder="Bench 03"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-gray-700">Headline *</span>
              <input required type="text" value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder="Walnut credenza."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
            </label>

            <label className="block text-sm">
              <span className="text-gray-700">Subhead *</span>
              <input required type="text" value={form.subhead}
                onChange={(e) => setForm({ ...form, subhead: e.target.value })}
                placeholder="Hand-rubbed oil · day 4 of 7"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-700">Link URL</span>
                <input type="url" value={form.linkUrl || ''}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="/products/walnut-credenza"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Link label</span>
                <input type="text" value={form.linkLabel || ''}
                  onChange={(e) => setForm({ ...form, linkLabel: e.target.value })}
                  placeholder="See on the bench ↗"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Live from *</span>
                <input required type="datetime-local"
                  value={toLocalDT(form.liveFrom)}
                  onChange={(e) => setForm({ ...form, liveFrom: Timestamp.fromDate(new Date(e.target.value)) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Live until</span>
                <input type="datetime-local"
                  value={form.liveUntil ? toLocalDT(form.liveUntil) : ''}
                  onChange={(e) => setForm({
                    ...form,
                    liveUntil: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : undefined,
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Category *</span>
                <select required value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as FeaturedUpdateCategory })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Tone</span>
                <select value={form.tone || 'warm'}
                  onChange={(e) => setForm({ ...form, tone: e.target.value as FeaturedUpdateTone })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm">
                  {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Priority (1–10) *</span>
                <input required type="number" min={1} max={10} value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 5 })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Bench id</span>
                <input type="text" value={form.benchId || ''}
                  onChange={(e) => setForm({ ...form, benchId: e.target.value })}
                  placeholder="B-26-19-003"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-gray-700">Image (1:1) *</span>
              <input type="file" accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm" />
              {form.imageUrl && !imageFile && (
                <img src={form.imageUrl} alt="current" className="mt-2 h-24 w-24 rounded object-cover" />
              )}
            </label>

            <div className="flex flex-wrap gap-4 pt-2 border-t">
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black" />
                <span className="ml-2">Published</span>
              </label>
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={form.shouldPublishToShopify}
                  onChange={(e) => setForm({ ...form, shouldPublishToShopify: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black" />
                <span className="ml-2">Publish to dawinfinishes.com</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create update'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
