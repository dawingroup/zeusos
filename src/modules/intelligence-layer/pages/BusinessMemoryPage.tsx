/**
 * BusinessMemoryPage — Phase 3.2.
 *
 * The group-brain surface: search the business-memory store (semantic),
 * browse recent memories, and manually save a fact/decision/insight. The
 * assistant + CFO/strategy briefs read and write the same store.
 */

import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Brain, Loader2, Plus, Search } from 'lucide-react';
import { RagBadge, Banner, EmptyStateV2 } from '@/shared/components/data-display';
import {
  searchMemories,
  saveMemory,
  subscribeRecentMemories,
  MEMORY_CATEGORY_LABELS,
  type BusinessMemory,
  type MemoryCategory,
  type MemoryImportance,
} from '../services/business-memory.service';

const IMPORTANCE_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  low: 'na', medium: 'blue', high: 'amber', critical: 'red',
};

const CATEGORIES = Object.keys(MEMORY_CATEGORY_LABELS) as MemoryCategory[];

const EMPTY_FORM = { category: 'business_fact' as MemoryCategory, content: '', summary: '', tags: '', importance: 'medium' as MemoryImportance };

export function BusinessMemoryPage() {
  const [recent, setRecent] = useState<BusinessMemory[]>([]);
  const [results, setResults] = useState<BusinessMemory[] | null>(null);
  const [queryText, setQueryText] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeRecentMemories(setRecent, (e) => setError(e.message));
    return () => unsub();
  }, []);

  const list = results ?? recent;
  const canSave = useMemo(() => form.content.trim().length > 0, [form]);

  const onSearch = async () => {
    if (!queryText.trim()) { setResults(null); return; }
    setSearching(true);
    setError(null);
    try {
      setResults(await searchMemories(queryText.trim()));
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await saveMemory({
        category: form.category,
        content: form.content.trim(),
        summary: form.summary.trim() || undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        importance: form.importance,
      });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save memory');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet><title>Business Memory | ZeusOS</title></Helmet>
      <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1200px] mx-auto">
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Intelligence · Group brain</div>
            <h1 className="display flex items-center gap-2"><Brain className="h-5 w-5" style={{ color: 'var(--accent)' }} /> Business memory</h1>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
              The consortium-wide knowledge the AI assistant and briefings draw on
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-3.5 w-3.5" /> Save memory
          </Button>
        </div>

        {error && <Banner tone="danger" title="Error" message={error} />}

        {/* Search */}
        <div className="flex gap-2">
          <Input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
            placeholder="Search the group brain (semantic)…"
          />
          <Button variant="outline" size="sm" onClick={onSearch} disabled={searching}>
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
          {results && (
            <Button variant="ghost" size="sm" onClick={() => { setResults(null); setQueryText(''); }}>Clear</Button>
          )}
        </div>

        {/* Manual save form */}
        {showForm && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-[14.5px]">New memory</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <select
                  className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
                  style={{ borderColor: 'var(--border-default)' }}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as MemoryCategory })}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{MEMORY_CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <Label>Importance</Label>
                <select
                  className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
                  style={{ borderColor: 'var(--border-default)' }}
                  value={form.importance}
                  onChange={(e) => setForm({ ...form, importance: e.target.value as MemoryImportance })}
                >
                  {(['critical', 'high', 'medium', 'low'] as MemoryImportance[]).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label>Content</Label>
                <textarea
                  className="w-full min-h-[64px] rounded-md border bg-transparent px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border-default)' }}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="The fact, decision, or insight to remember."
                />
              </div>
              <div className="md:col-span-2">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="client, pricing, q3" />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button size="sm" onClick={onSave} disabled={!canSave || saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {results && <p className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>{results.length} result{results.length === 1 ? '' : 's'}</p>}
        {list.length === 0 ? (
          <div className="rounded-[10px] border bg-[var(--bg-surface)]" style={{ borderColor: 'var(--border-subtle)' }}>
            <EmptyStateV2
              title={results ? 'No matching memories' : 'No memories yet'}
              message={results ? 'Try a different search.' : 'The assistant will populate this as it learns — or save one manually.'}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((m) => (
              <Card key={m.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px]" style={{ color: 'var(--fg-primary)' }}>{m.content}</p>
                    {m.importance && <RagBadge tone={IMPORTANCE_TONE[String(m.importance)] ?? 'na'}>{m.importance}</RagBadge>}
                  </div>
                  <p className="mt-1 text-[11.5px] flex flex-wrap items-center gap-x-2" style={{ color: 'var(--fg-tertiary)' }}>
                    <span>{MEMORY_CATEGORY_LABELS[m.category as MemoryCategory] ?? m.category}</span>
                    {m.tags && m.tags.length > 0 && <span>· {m.tags.join(', ')}</span>}
                    {typeof m.similarity === 'number' && <span>· {(m.similarity * 100).toFixed(0)}% match</span>}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default BusinessMemoryPage;
