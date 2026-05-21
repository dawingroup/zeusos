/**
 * VoicesPage
 *
 * Authoring surface for client testimonials (voices). Records here feed the
 * dawinfinishes.com home Voices section + project pages via the Shopify
 * `voice` metaobject. Publish is automatic on save when
 * `shouldPublishToShopify=true` + `consentGiven=true` (Firestore trigger).
 */

import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Pencil, Trash2, Search, ExternalLink } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToVoices,
  createVoice,
  updateVoice,
  deleteVoice,
  uploadVoiceLogo,
} from '../services/voiceService';
import type { Voice, VoiceFormData, VoiceTone } from '../types/voice.types';

const DEFAULT_SUBSIDIARY = 'finishes';
const TONE_OPTIONS: VoiceTone[] = ['warm', 'trade', 'press'];

const SYNC_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  unpublished: 'bg-gray-100 text-gray-600',
};

function emptyForm(): VoiceFormData {
  return {
    subsidiaryId: DEFAULT_SUBSIDIARY,
    quote: '',
    attribution: '',
    role: '',
    company: '',
    companyLogoUrl: '',
    projectCaseStudyId: '',
    quoteDate: Timestamp.now(),
    tone: 'warm',
    lead: false,
    featured: true,
    consentGiven: false,
    shouldPublishToShopify: false,
  };
}

export default function VoicesPage() {
  const { user } = useAuth();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Voice | null>(null);
  const [form, setForm] = useState<VoiceFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToVoices(DEFAULT_SUBSIDIARY, (rows) => {
      setVoices(rows);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return voices;
    return voices.filter(
      (v) =>
        v.attribution.toLowerCase().includes(q) ||
        (v.company || '').toLowerCase().includes(q) ||
        v.quote.toLowerCase().includes(q)
    );
  }, [voices, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setLogoFile(null);
    setShowForm(true);
  }

  function openEdit(v: Voice) {
    setEditing(v);
    setForm({
      subsidiaryId: v.subsidiaryId,
      quote: v.quote,
      attribution: v.attribution,
      role: v.role || '',
      company: v.company || '',
      companyLogoUrl: v.companyLogoUrl || '',
      projectCaseStudyId: v.projectCaseStudyId || '',
      quoteDate: v.quoteDate,
      tone: v.tone || 'warm',
      lead: v.lead,
      featured: v.featured,
      consentGiven: v.consentGiven,
      shouldPublishToShopify: v.shouldPublishToShopify,
    });
    setLogoFile(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid) return;
    setSubmitting(true);
    try {
      let logoUrl = form.companyLogoUrl;
      if (logoFile) {
        const id = editing?.id || 'pending';
        logoUrl = await uploadVoiceLogo(logoFile, id);
      }
      const payload: VoiceFormData = { ...form, companyLogoUrl: logoUrl };
      if (editing) {
        await updateVoice(editing.id, payload, user.uid);
      } else {
        await createVoice(payload, user.uid);
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error('Failed to save voice', err);
      alert((err as Error).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(v: Voice) {
    if (!confirm(`Delete voice from "${v.attribution}"? This removes it from dawinfinishes.com on next sync.`)) return;
    try {
      await deleteVoice(v.id);
    } catch (err) {
      alert((err as Error).message || 'Delete failed');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Helmet>
        <title>Voices · Marketing · ZeusOS</title>
      </Helmet>

      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Voices</h1>
          <p className="text-sm text-gray-500">
            Client testimonials. Publish to the dawinfinishes.com Voices section. Consent is required.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> New voice
        </button>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search attribution, company, quote…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black"
        />
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Attribution</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Quote</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Flags</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sync</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No voices yet.</td></tr>
            )}
            {filtered.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-900">{v.attribution}</div>
                  <div className="text-gray-500 text-xs">{[v.role, v.company].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                  <span className="line-clamp-2">{v.quote}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {v.lead && <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-800">Lead</span>}
                    {v.featured && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Featured</span>}
                    {!v.consentGiven && <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800">No consent</span>}
                    {!v.shouldPublishToShopify && <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">Draft</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {v.shopifySyncStatus ? (
                    <span className={`rounded px-2 py-0.5 ${SYNC_BADGES[v.shopifySyncStatus] || 'bg-gray-100'}`}>
                      {v.shopifySyncStatus}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                  {v.shopifyMetaobjectGid && (
                    <a
                      className="ml-2 inline-flex items-center text-gray-400 hover:text-gray-700"
                      href={`https://admin.shopify.com/store/zeus-the-agency/content/entries/voice/${encodeURIComponent(v.shopifyMetaobjectGid.split('/').pop() || '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  <button onClick={() => openEdit(v)} className="text-gray-500 hover:text-gray-900 mr-3" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(v)} className="text-gray-400 hover:text-rose-600" aria-label="Delete">
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
            <h2 className="text-lg font-semibold">{editing ? 'Edit voice' : 'New voice'}</h2>

            <label className="block text-sm">
              <span className="text-gray-700">Quote *</span>
              <textarea
                required
                rows={3}
                value={form.quote}
                onChange={(e) => setForm({ ...form, quote: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-700">Attribution *</span>
                <input
                  required type="text" value={form.attribution}
                  onChange={(e) => setForm({ ...form, attribution: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Role / title</span>
                <input
                  type="text" value={form.role || ''}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Company</span>
                <input
                  type="text" value={form.company || ''}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Quote date *</span>
                <input
                  required type="date"
                  value={form.quoteDate.toDate().toISOString().slice(0, 10)}
                  onChange={(e) => setForm({ ...form, quoteDate: Timestamp.fromDate(new Date(e.target.value)) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Tone</span>
                <select
                  value={form.tone || 'warm'}
                  onChange={(e) => setForm({ ...form, tone: e.target.value as VoiceTone })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm"
                >
                  {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Linked project case study id</span>
                <input
                  type="text" value={form.projectCaseStudyId || ''}
                  onChange={(e) => setForm({ ...form, projectCaseStudyId: e.target.value })}
                  placeholder="optional"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-1 focus:ring-black text-sm"
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-gray-700">Company logo</span>
              <input
                type="file" accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm"
              />
              {form.companyLogoUrl && !logoFile && (
                <img src={form.companyLogoUrl} alt="current logo" className="mt-2 h-12 w-auto object-contain" />
              )}
            </label>

            <div className="flex flex-wrap gap-4 pt-2 border-t">
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={form.lead}
                  onChange={(e) => setForm({ ...form, lead: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black" />
                <span className="ml-2">Lead voice (one at a time)</span>
              </label>
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black" />
                <span className="ml-2">Featured</span>
              </label>
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={form.consentGiven}
                  onChange={(e) => setForm({ ...form, consentGiven: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black" />
                <span className="ml-2 font-medium">Consent given *</span>
              </label>
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={form.shouldPublishToShopify}
                  onChange={(e) => setForm({ ...form, shouldPublishToShopify: e.target.checked })}
                  disabled={!form.consentGiven}
                  className="rounded border-gray-300 text-black focus:ring-black disabled:opacity-40" />
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
                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create voice'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
