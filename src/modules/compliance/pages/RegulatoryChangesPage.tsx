/**
 * RegulatoryChangesPage — Phase 2.4.
 *
 * Compliance officers track regulatory/legal changes relevant to Zeus's
 * clients + brands. The same `regulatory_changes` register feeds the client
 * Strategy Assistant (Phase 3), which matches a change's `sector` tags
 * against a client's industry.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Loader2, Plus, ExternalLink, Scale } from 'lucide-react';
import { RagBadge, Banner, EmptyStateV2 } from '@/shared/components/data-display';
import { useAuth } from '@/core/hooks/useAuth';
import { REGULATORY_BODY_LABELS } from '../types/constants';
import {
  IMPACT_LEVEL_LABELS,
  REGULATORY_STATUS_LABELS,
  type RegulatoryChange,
  type RegulatoryImpactLevel,
  type RegulatoryChangeStatus,
} from '../types/regulatory.types';
import type { RegulatoryBody } from '../types';
import {
  getRegulatoryChanges,
  createRegulatoryChange,
} from '../services/regulatoryChangeService';

const IMPACT_TONE: Record<RegulatoryImpactLevel, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  low: 'na',
  medium: 'blue',
  high: 'amber',
  critical: 'red',
};

const REG_BODIES = Object.keys(REGULATORY_BODY_LABELS) as RegulatoryBody[];

const EMPTY_FORM = {
  title: '',
  regulatoryBody: 'URA' as RegulatoryBody,
  sector: '',
  effectiveDate: '',
  impactLevel: 'medium' as RegulatoryImpactLevel,
  status: 'proposed' as RegulatoryChangeStatus,
  summary: '',
  sourceUrl: '',
};

export function RegulatoryChangesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<RegulatoryChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getRegulatoryChanges());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load regulatory changes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canSave = useMemo(
    () => form.title.trim() && form.effectiveDate && form.summary.trim(),
    [form],
  );

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createRegulatoryChange(
        {
          title: form.title.trim(),
          regulatoryBody: form.regulatoryBody,
          sector: form.sector.split(',').map((s) => s.trim()).filter(Boolean),
          effectiveDate: form.effectiveDate,
          impactLevel: form.impactLevel,
          status: form.status,
          summary: form.summary.trim(),
          sourceUrl: form.sourceUrl.trim() || undefined,
          subsidiaryOrgIds: [],
          source: 'manual',
        },
        user?.uid,
      );
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>System · Compliance</div>
          <h1 className="display">Regulatory feed</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Regulatory &amp; legal changes affecting Zeus brands and client sectors
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-3.5 w-3.5" /> Add change
        </Button>
      </div>

      {error && <Banner tone="danger" title="Error" message={error} />}

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[14.5px]">New regulatory change</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Data Protection & Privacy (Amendment) Regulations" />
            </div>
            <div>
              <Label>Regulatory body</Label>
              <select
                className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
                style={{ borderColor: 'var(--border-default)' }}
                value={form.regulatoryBody}
                onChange={(e) => setForm({ ...form, regulatoryBody: e.target.value as RegulatoryBody })}
              >
                {REG_BODIES.map((b) => (
                  <option key={b} value={b}>{REGULATORY_BODY_LABELS[b]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Effective date</Label>
              <Input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
            </div>
            <div>
              <Label>Impact</Label>
              <select
                className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
                style={{ borderColor: 'var(--border-default)' }}
                value={form.impactLevel}
                onChange={(e) => setForm({ ...form, impactLevel: e.target.value as RegulatoryImpactLevel })}
              >
                {(Object.keys(IMPACT_LEVEL_LABELS) as RegulatoryImpactLevel[]).map((k) => (
                  <option key={k} value={k}>{IMPACT_LEVEL_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
                style={{ borderColor: 'var(--border-default)' }}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as RegulatoryChangeStatus })}
              >
                {(Object.keys(REGULATORY_STATUS_LABELS) as RegulatoryChangeStatus[]).map((k) => (
                  <option key={k} value={k}>{REGULATORY_STATUS_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Sectors (comma-separated — matched to client industries)</Label>
              <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="fintech, telecom, fmcg" />
            </div>
            <div className="md:col-span-2">
              <Label>Summary</Label>
              <textarea
                className="w-full min-h-[72px] rounded-md border bg-transparent px-2 py-1.5 text-sm"
                style={{ borderColor: 'var(--border-default)' }}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="What changed and who it affects."
              />
            </div>
            <div className="md:col-span-2">
              <Label>Source URL (optional)</Label>
              <Input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://…" />
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[10px] border bg-[var(--bg-surface)]" style={{ borderColor: 'var(--border-subtle)' }}>
          <EmptyStateV2
            title="No regulatory changes tracked yet"
            message="Add the first change, or let the Phase 3 market-intel scan populate candidates."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <Card key={it.id}>
              <CardContent className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--fg-tertiary)' }} />
                    <p className="text-[13.5px] font-medium truncate" style={{ color: 'var(--fg-primary)' }}>{it.title}</p>
                  </div>
                  <p className="mt-1 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>{it.summary}</p>
                  <p className="mt-1 text-[11.5px] flex flex-wrap items-center gap-x-2" style={{ color: 'var(--fg-tertiary)' }}>
                    <span>{REGULATORY_BODY_LABELS[it.regulatoryBody]}</span>
                    <span>· {REGULATORY_STATUS_LABELS[it.status]}</span>
                    <span>· Effective {it.effectiveDate}</span>
                    {it.sector.length > 0 && <span>· {it.sector.join(', ')}</span>}
                    {it.sourceUrl && (
                      <a href={it.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                        source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </p>
                </div>
                <RagBadge tone={IMPACT_TONE[it.impactLevel]}>{IMPACT_LEVEL_LABELS[it.impactLevel]}</RagBadge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default RegulatoryChangesPage;
