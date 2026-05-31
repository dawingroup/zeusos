/**
 * ClientStrategyAssistantPanel — Phase 3.5.
 *
 * Mounts on ClientDetailPage. Generates + displays an AI strategy brief for the
 * client: stakeholder map, regulatory exposure, competitive positioning, and
 * recommended plays — synthesised from the client's contacts, the conflict-
 * firewall competitor list, the regulatory-change feed, and business memory.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Loader2, Sparkles, Users, Scale, Target, ListChecks } from 'lucide-react';
import { RagBadge, Banner } from '@/shared/components/data-display';
import {
  generateClientStrategyBrief,
  subscribeStrategyBriefs,
  type ClientStrategyBrief,
} from '../services/client-strategy.service';

const IMPACT_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  low: 'na', medium: 'blue', high: 'amber', critical: 'red',
};
const INFLUENCE_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  low: 'na', medium: 'blue', high: 'amber',
};

function fmtDate(v: ClientStrategyBrief['generatedAt']): string {
  if (!v) return '';
  try {
    const d = typeof v === 'string' ? new Date(v) : v.toDate();
    return d.toLocaleString();
  } catch {
    return '';
  }
}

export function ClientStrategyAssistantPanel({ clientId }: { clientId: string; clientName?: string }) {
  const [briefs, setBriefs] = useState<ClientStrategyBrief[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeStrategyBriefs(
      clientId,
      setBriefs,
      (e) => setError(e.message),
    );
    return () => unsub();
  }, [clientId]);

  const latest = briefs[0];

  const onGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateClientStrategyBrief(clientId);
      // The subscription will pick up the new brief.
    } catch (e: any) {
      setError(e?.message || 'Failed to generate brief');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-[14.5px]">
          <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          Strategy Assistant
        </CardTitle>
        <Button size="sm" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {latest ? 'Regenerate brief' : 'Generate brief'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Banner tone="danger" title="Couldn't generate brief" message={error} />}

        {!latest && !error && (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--fg-tertiary)' }}>
            Generate an AI strategy brief from this client's stakeholders, competitors,
            regulatory exposure, and business memory.
          </p>
        )}

        {latest && (
          <>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-primary)' }}>
              {latest.executiveSummary}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Stakeholders */}
              <div>
                <h4 className="flex items-center gap-1.5 text-[12.5px] font-medium mb-2" style={{ color: 'var(--fg-secondary)' }}>
                  <Users className="h-3.5 w-3.5" /> Stakeholders
                </h4>
                <div className="flex flex-col gap-2">
                  {latest.stakeholderMap.length === 0 && <p className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>None mapped.</p>}
                  {latest.stakeholderMap.map((s, i) => (
                    <div key={i} className="rounded-[8px] border px-2.5 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium" style={{ color: 'var(--fg-primary)' }}>{s.name}</span>
                        {s.influence && <RagBadge tone={INFLUENCE_TONE[String(s.influence)] ?? 'na'}>{s.influence}</RagBadge>}
                      </div>
                      {s.role && <p className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>{s.role}</p>}
                      {s.approach && <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--fg-secondary)' }}>{s.approach}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Regulatory exposure */}
              <div>
                <h4 className="flex items-center gap-1.5 text-[12.5px] font-medium mb-2" style={{ color: 'var(--fg-secondary)' }}>
                  <Scale className="h-3.5 w-3.5" /> Regulatory exposure
                </h4>
                <div className="flex flex-col gap-2">
                  {latest.regulatoryExposure.length === 0 && <p className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>No matching regulatory changes.</p>}
                  {latest.regulatoryExposure.map((r, i) => (
                    <div key={i} className="rounded-[8px] border px-2.5 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium" style={{ color: 'var(--fg-primary)' }}>{r.title}</span>
                        {r.impact && <RagBadge tone={IMPACT_TONE[String(r.impact)] ?? 'na'}>{r.impact}</RagBadge>}
                      </div>
                      {r.implication && <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--fg-secondary)' }}>{r.implication}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended plays */}
              <div>
                <h4 className="flex items-center gap-1.5 text-[12.5px] font-medium mb-2" style={{ color: 'var(--fg-secondary)' }}>
                  <ListChecks className="h-3.5 w-3.5" /> Recommended plays
                </h4>
                <div className="flex flex-col gap-2">
                  {latest.recommendedPlays.length === 0 && <p className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>None.</p>}
                  {[...latest.recommendedPlays].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).map((p, i) => (
                    <div key={i} className="rounded-[8px] border px-2.5 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span className="text-[12.5px] font-medium" style={{ color: 'var(--fg-primary)' }}>{p.play}</span>
                      {p.rationale && <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--fg-secondary)' }}>{p.rationale}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Competitive positioning */}
            <div className="rounded-[10px] border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <h4 className="flex items-center gap-1.5 text-[12.5px] font-medium mb-1.5" style={{ color: 'var(--fg-secondary)' }}>
                <Target className="h-3.5 w-3.5" /> Competitive positioning
              </h4>
              <p className="text-[12.5px]" style={{ color: 'var(--fg-primary)' }}>{latest.competitivePositioning?.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {(latest.competitivePositioning?.threats?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--rag-red)' }}>Threats</p>
                    <ul className="list-disc pl-4 text-[11.5px]" style={{ color: 'var(--fg-secondary)' }}>
                      {latest.competitivePositioning.threats.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}
                {(latest.competitivePositioning?.opportunities?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--rag-green)' }}>Opportunities</p>
                    <ul className="list-disc pl-4 text-[11.5px]" style={{ color: 'var(--fg-secondary)' }}>
                      {latest.competitivePositioning.opportunities.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px]" style={{ color: 'var(--fg-tertiary)' }}>
              Generated {fmtDate(latest.generatedAt)}
              {latest.sourceCounts && (
                <> · {latest.sourceCounts.stakeholders} stakeholders · {latest.sourceCounts.competitors} competitors · {latest.sourceCounts.regulatory} regulatory · {latest.sourceCounts.memories} memories</>
              )}
              {briefs.length > 1 && <> · {briefs.length} briefs in history</>}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ClientStrategyAssistantPanel;
