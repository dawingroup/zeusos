/**
 * Agent Management Panel — the "Agents" tab of the Intelligence Admin console.
 *
 * Lists the ZeusOS agent registry, shows each agent's status / auto-act mode /
 * model / enabled tools, and (for admins) lets you pause/activate, change the
 * auto-act mode + model, edit the system prompt, and toggle the tools the
 * agent may call. Writes go through `agentService` (admin-gated by rules); the
 * dispatcher (Cloud Function) is the runtime that actually enforces the gates.
 */
import { useMemo, useState } from 'react';
import { Bot, ShieldCheck, ShieldAlert, Sparkles, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { getIconByName } from '@/shared/utils/iconMap';
import { cn } from '@/shared/lib/utils';
import { useCurrentDawinUser } from '@/core/settings';
import { useAgents } from '../../agents/hooks/useAgents';
import { updateAgentSettings } from '../../agents/services/agentService';
import {
  AGENT_TOOLS,
  AGENT_MODELS,
  AGENT_MODEL_LABELS,
  type Agent,
  type AutoActMode,
  type AgentModel,
} from '../../agents/types/agent';

const MODE_LABEL: Record<AutoActMode, string> = {
  draft_only: 'Draft only',
  gated: 'Gated',
  autonomous: 'Autonomous',
};
const MODE_TONE: Record<AutoActMode, string> = {
  draft_only: 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
  gated: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  autonomous: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
};

function statusTone(status: Agent['status']): string {
  if (status === 'active') return 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]';
  if (status === 'paused') return 'bg-[var(--bg-sunken)] text-[var(--fg-tertiary)]';
  return 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]';
}

export function AgentManagementPanel() {
  const { agents, loading, isSeedFallback } = useAgents();
  const { dawinUser } = useCurrentDawinUser();
  const isAdmin = ['admin', 'owner', 'super_admin'].includes(dawinUser?.globalRole ?? '');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? agents[0] ?? null,
    [agents, selectedId],
  );

  if (loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--fg-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4" /> Agents
          </h3>
          <p className="text-sm text-muted-foreground">
            AI agents that watch the business, raise findings, and draft work. Every
            action passes the dispatcher's gates and is audited.
          </p>
        </div>
        {isSeedFallback && (
          <Badge variant="secondary" className="text-[11px]">Showing seed agents · not yet saved</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* List */}
        <div className="space-y-2">
          {agents.map((a) => {
            const Icon = getIconByName(a.icon) ?? Bot;
            const active = selected?.id === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-colors',
                  active
                    ? 'border-[var(--accent)] bg-[var(--bg-sunken)]'
                    : 'border-[var(--border-subtle)] hover:bg-[var(--bg-sunken)]',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[var(--fg-secondary)] shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{a.name}</span>
                  <span className="font-mono text-[10px] text-[var(--fg-tertiary)]">{a.id}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', statusTone(a.status))}>{a.status}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', MODE_TONE[a.autoActMode])}>{MODE_LABEL[a.autoActMode]}</span>
                  <span className="text-[10px] text-[var(--fg-tertiary)] ml-auto">{a.enabledTools.length} tools</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        {selected && (
          <AgentDetail key={selected.id} agent={selected} canEdit={isAdmin && !isSeedFallback} uid={dawinUser?.uid} />
        )}
      </div>
    </div>
  );
}

function AgentDetail({ agent, canEdit, uid }: { agent: Agent; canEdit: boolean; uid?: string }) {
  const [status, setStatus] = useState<Agent['status']>(agent.status);
  const [mode, setMode] = useState<AutoActMode>(agent.autoActMode);
  const [model, setModel] = useState<AgentModel>(agent.model);
  const [prompt, setPrompt] = useState(agent.systemPrompt);
  const [tools, setTools] = useState<string[]>(agent.enabledTools);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    status !== agent.status ||
    mode !== agent.autoActMode ||
    model !== agent.model ||
    prompt !== agent.systemPrompt ||
    tools.length !== agent.enabledTools.length ||
    tools.some((t) => !agent.enabledTools.includes(t));

  const toggleTool = (id: string) =>
    setTools((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updateAgentSettings(
        agent.id,
        {
          status,
          autoActMode: mode,
          model,
          systemPrompt: prompt,
          enabledTools: tools,
          ...(prompt !== agent.systemPrompt
            ? { promptVersion: (agent.promptVersion ?? 1) + 1 }
            : {}),
        },
        uid,
      );
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const byScope = useMemo(() => {
    const groups: Record<string, typeof AGENT_TOOLS> = { read: [], search: [], write: [], notify: [] };
    AGENT_TOOLS.forEach((t) => groups[t.scope].push(t));
    return groups;
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">{agent.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">{agent.description}</p>
          </div>
          <Button size="sm" onClick={save} disabled={!canEdit || !dirty || saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Save</span>
          </Button>
        </div>
        {!canEdit && (
          <p className="text-[11px] text-[var(--fg-tertiary)] flex items-center gap-1 mt-1">
            <ShieldAlert className="h-3 w-3" /> Read-only — admin role required to edit agents.
          </p>
        )}
        {savedAt && !dirty && (
          <p className="text-[11px] text-[var(--rag-green)] flex items-center gap-1 mt-1">
            <ShieldCheck className="h-3 w-3" /> Saved.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Settings row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as Agent['status'])} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="beta">Beta</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Auto-act mode">
            <Select value={mode} onValueChange={(v) => setMode(v as AutoActMode)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft_only">Draft only</SelectItem>
                <SelectItem value="gated">Gated</SelectItem>
                <SelectItem value="autonomous">Autonomous</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Model">
            <Select value={model} onValueChange={(v) => setModel(v as AgentModel)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AGENT_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>{AGENT_MODEL_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* System prompt */}
        <Field label={`System prompt · v${agent.promptVersion ?? 1}`}>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={!canEdit}
            rows={4}
            className="text-xs font-mono"
          />
        </Field>

        {/* Tools */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--fg-tertiary)]" />
            <span className="text-xs font-medium">Enabled tools ({tools.length})</span>
          </div>
          <div className="space-y-3">
            {(['read', 'search', 'write', 'notify'] as const).map((scope) => (
              <div key={scope}>
                <div className="text-[10px] uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">{scope}</div>
                <div className="flex flex-wrap gap-1.5">
                  {byScope[scope].map((t) => {
                    const on = tools.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        title={t.description}
                        disabled={!canEdit}
                        onClick={() => toggleTool(t.id)}
                        className={cn(
                          'text-[11px] px-2 py-1 rounded-md border transition-colors',
                          on
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                            : 'border-[var(--border-subtle)] text-[var(--fg-tertiary)] hover:bg-[var(--bg-sunken)]',
                          !canEdit && 'cursor-default opacity-80',
                        )}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-[var(--fg-secondary)] mb-1">{label}</span>
      {children}
    </label>
  );
}

export default AgentManagementPanel;
