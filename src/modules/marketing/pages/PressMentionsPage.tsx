/**
 * PressMentionsPage
 *
 * Authoring surface for external press / publications covering Dawin
 * Finishes. Feeds the dawinfinishes.com home Press section via Shopify
 * `press_mention` metaobjects.
 */

import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Pencil, Trash2, Search, ExternalLink } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToPressMentions,
  createPressMention,
  updatePressMention,
  deletePressMention,
  uploadPublicationLogo,
} from '../services/pressMentionService';
import type { PressMention, PressMentionFormData } from '../types/press-mention.types';

const DEFAULT_SUBSIDIARY = 'finishes';

const SYNC_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  unpublished: 'bg-gray-100 text-gray-600',
};

function emptyForm(): PressMentionFormData {
  return {
    subsidiaryId: DEFAULT_SUBSIDIARY,
    publication: '',
    publicationLogoUrl: '',
    title: '',
    url: '',
    datePublished: Timestamp.now(),
    pullQuote: '',
    featured: false,
    shouldPublishToShopify: false,
  };
}

export default function PressMentionsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PressMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PressMention | null>(null);
  const [form, setForm] = useState<PressMentionFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToPressMentions(DEFAULT_SUBSIDIARY, (data) => {
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
        r.publication.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.pullQuote || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setLogoFile(null);
    setShowForm(true);
  }

  function openEdit(p: PressMention) {
    setEditing(p);
    setForm({
      subsidiaryId: p.subsidiaryId,
      publication: p.publication,
      publicationLogoUrl: p.publicationLogoUrl,
      title: p.title,
      url: p.url || '',
      datePublished: p.datePublished,
      pullQuote: p.pullQuote || '',
      featured: p.featured,
      shouldPublishToShopify: p.shouldPublishToShopify,
    });
    setLogoFile(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid) return;
    setSubmitting(true);
    try {
      let logoUrl = form.publicationLogoUrl;
      if (logoFile) {
        const id = editing?.id || 'pending';
        logoUrl = await uploadPublicationLogo(logoFile, id);
      }
      if (!logoUrl) throw new Error('Publication logo is required');
      const payload = { ...form, publicationLogoUrl: logoUrl };
      if (editing) {
        await updatePressMention(editing.id, payload, user.uid);
      } else {
        await createPressMention(payload, user.uid);
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error('Failed to save press mention', err);
      alert((err as Error).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(p: PressMention) {
    if (!confirm(`Delete press mention "${p.title}" from ${p.publication}?`)) return;
    try {
      await deletePressMention(p.id);
    } catch (err) {
      alert((err as Error).message || 'Delete failed');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Helmet>
        <title>Press · Marketing · DawinOS</title>
      </Helmet>

      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Press mentions</h1>
          <p className="text-sm text-gray-500">
            External publications covering Dawin. Published to the dawinfinishes.com Press section.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> New press mention
        </button>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search publication, title, quote…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black"
        />
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Publication</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Flags</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sync</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No press mentions yet.</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {p.publicationLogoUrl && (
                      <img src={p.publicationLogoUrl} alt="" className="h-6 w-6 object-contain" />
                    )}
                    <span className="font-medium text-gray-900">{p.publication}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-sm">
                  <span className="line-clamp-2">{p.title}</span>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-gray-400 hover:text-gray-700 mt-1">
                      open <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {p.datePublished.toDate().toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {p.featured && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Featured</span>}
                    {!p.shouldPublishToShopify && <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">Draft</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {p.shopifySyncStatus ? (
                    <span className={`rounded px-2 py-0.5 ${SYNC_BADGES[p.shopifySyncStatus] || 'bg-gray-100'}`}>
                      {p.shopifySyncStatus}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  <button onClick={() => openEdit(p)} className="text-gray-500 hover:text-gray-900 mr-3" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(p)} className="text-gray-400 hover:text-rose-600" aria-label="Delete">
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
            <h2 className="text-lg font-semibold">{editing ? 'Edit press mention' : 'New press mention'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-700">Publication *</span>
                <input required type="text" value={form.publication}
                  onChange={(e) => setForm({ ...form, publication: e.target.value })}
                  placeholder="e.g. Daily Monitor"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Date published *</span>
                <input required type="date"
                  value={form.datePublished.toDate().toISOString().slice(0, 10)}
                  onChange={(e) => setForm({ ...form, datePublished: Timestamp.fromDate(new Date(e.target.value)) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-gray-700">Article title *</span>
              <input required type="text" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
            </label>

            <label className="block text-sm">
              <span className="text-gray-700">Article URL</span>
              <input type="url" value={form.url || ''}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://…"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
            </label>

            <label className="block text-sm">
              <span className="text-gray-700">Pull quote</span>
              <textarea rows={2} value={form.pullQuote || ''}
                onChange={(e) => setForm({ ...form, pullQuote: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm" />
            </label>

            <label className="block text-sm">
              <span className="text-gray-700">Publication logo *</span>
              <input type="file" accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm" />
              {form.publicationLogoUrl && !logoFile && (
                <img src={form.publicationLogoUrl} alt="current logo" className="mt-2 h-12 w-auto object-contain" />
              )}
            </label>

            <div className="flex flex-wrap gap-4 pt-2 border-t">
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black" />
                <span className="ml-2">Featured</span>
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
                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create press mention'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
