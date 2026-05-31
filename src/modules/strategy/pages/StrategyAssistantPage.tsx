// ============================================================================
// StrategyAssistantPage
// DawinOS v2.0 - CEO Strategy Command Module
// Full-page Strategy Assistant — chat on the left, live Strategy Agent
// findings (recent audit entries + open tasks) on the right. Designed for
// longer planning sessions where the floating panel is too cramped.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Banner } from '@/shared/components/data-display';
import { db } from '@/shared/services/firebase/firestore';
import { StrategyAssistantPanel } from '../components/assistant/StrategyAssistantPanel';

interface AuditEntry {
  id: string;
  trigger: string;
  outputSummary: string;
  outcome: string;
  createdAtMs: number;
}

interface OpenTask {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  deepLink?: string;
  assignedToName?: string;
  entityType?: string;
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  low: 'bg-gray-50 text-gray-600 border-gray-200',
};

const TRIGGER_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  'okr.check_in_stale': Clock,
  'okr.kr_off_track': AlertTriangle,
  'kpi.measurement_stale': Clock,
  'kpi.critical_alert_unresolved': AlertCircle,
  'strategy_agent.run.summary': CheckCircle2,
};

export const StrategyAssistantPage: React.FC = () => {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSidebar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [auditSnap, taskSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'agentAuditEntries'),
            where('agentId', '==', 'AG-007'),
            orderBy('createdAt', 'desc'),
            limit(15)
          )
        ),
        getDocs(
          query(
            collection(db, 'generatedTasks'),
            where('sourceAgentId', '==', 'AG-007'),
            where('status', '==', 'pending'),
            limit(20)
          )
        ),
      ]);

      setAudit(
        auditSnap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const createdAt = data.createdAt as { toMillis?: () => number } | undefined;
          return {
            id: d.id,
            trigger: String(data.trigger || ''),
            outputSummary: String(data.outputSummary || ''),
            outcome: String(data.outcome || ''),
            createdAtMs: typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : 0,
          };
        })
      );

      setTasks(
        taskSnap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            title: String(data.title || ''),
            description: data.description as string | undefined,
            priority: data.priority as string | undefined,
            deepLink: data.deepLink as string | undefined,
            assignedToName: data.assignedToName as string | undefined,
            entityType: data.entityType as string | undefined,
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Strategy Agent activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSidebar();
  }, []);

  const auditByDate = useMemo(() => {
    return [...audit].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [audit]);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-[1640px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Strategy Assistant
          </h1>
          <p className="mt-1 text-[12.5px] text-gray-500">
            Chat with the Strategy Agent (AG-007). It has live access to your OKRs, KPIs,
            scorecards, and the open task queue.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSidebar} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh activity
        </Button>
      </div>

      {error && (
        <Banner
          tone="danger"
          title="Couldn't load Strategy Agent activity"
          message={error}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chat column — the panel renders itself as a floating layer, so
            we slot in a placeholder block on this page that explains how
            to open it. This keeps the panel as the single source of truth
            for chat UI rather than maintaining two implementations. */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl p-3 flex-shrink-0">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">
                  Talk to the Strategy Assistant
                </h2>
                <p className="text-[13px] text-gray-600 mb-3">
                  Open the floating chat panel in the bottom-right of this page to start a
                  session. The assistant remembers context across pages — start a thread here,
                  then keep asking as you navigate OKRs, KPIs, and scorecards.
                </p>
                <p className="text-[12px] text-gray-500">
                  Quick prompts to try:
                </p>
                <ul className="mt-2 space-y-1.5 text-[12.5px] text-gray-700">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    “Summarize the active OKR cycle”
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    “Which KPIs are stale and who owns them?”
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    “Suggest one new KR for each company-level objective”
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    “Draft a check-in update for KR X based on the linked KPI's latest reading”
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Open tasks the agent has surfaced */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 inline-flex items-center gap-2">
                <Inbox className="h-4 w-4 text-blue-600" />
                Open tasks from the Strategy Agent
                <span className="text-[12px] text-gray-500 font-normal">
                  {tasks.length}
                </span>
              </h2>
            </div>
            {loading && tasks.length === 0 ? (
              <div className="flex items-center text-gray-400 text-[12px]">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-gray-500">
                No open tasks. Either the agent hasn't run yet, or your OKRs and KPIs are all
                healthy — use the chat to run a fresh sweep on demand.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={t.deepLink || '#'}
                      className="flex items-center gap-3 p-2.5 rounded border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 group transition-colors"
                    >
                      <span
                        className={`inline-flex items-center justify-center min-w-[60px] text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                          PRIORITY_BADGE[t.priority || 'medium']
                        }`}
                      >
                        {t.priority || 'medium'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-gray-900 truncate">
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-[11px] text-gray-500 truncate">{t.description}</p>
                        )}
                      </div>
                      {t.assignedToName && (
                        <span className="text-[11px] text-gray-400 hidden md:inline">
                          {t.assignedToName}
                        </span>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Agent activity log */}
        <aside className="space-y-3">
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900 inline-flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-purple-600" />
              Agent activity
            </h2>
            {loading && auditByDate.length === 0 ? (
              <div className="flex items-center text-gray-400 text-[12px]">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : auditByDate.length === 0 ? (
              <p className="text-sm text-gray-500">
                The Strategy Agent hasn't run yet. Use the sweep button in the chat panel to
                trigger a manual run.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {auditByDate.map((a) => {
                  const Icon = TRIGGER_ICON[a.trigger] || Activity;
                  const isSummary = a.trigger === 'strategy_agent.run.summary';
                  return (
                    <li key={a.id} className="flex items-start gap-2.5 text-[12px]">
                      <Icon
                        className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                          isSummary
                            ? 'text-green-600'
                            : a.trigger.includes('critical')
                            ? 'text-red-500'
                            : a.trigger.includes('off_track')
                            ? 'text-amber-500'
                            : 'text-gray-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`${
                            isSummary ? 'font-medium text-gray-900' : 'text-gray-700'
                          }`}
                        >
                          {a.outputSummary}
                        </p>
                        <p className="text-[10.5px] text-gray-400 mt-0.5">
                          {a.trigger}
                          {a.createdAtMs > 0 && (
                            <span className="ml-1.5">
                              · {new Date(a.createdAtMs).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* The floating panel is allowed on this page so users can keep
          chatting without scrolling away from the activity log. */}
      <StrategyAssistantPanel />
    </div>
  );
};

export default StrategyAssistantPage;
