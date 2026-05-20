/**
 * DesignItemIssuesPanel — lists + threads internal issues for one DesignItem.
 *
 * Designed to drop into:
 *   - Design Studio's `DesignItemMetadataPanel` (bottom section).
 *   - Design Manager's DesignItem detail page (as a tab / accordion).
 *
 * Live-subscribes to `designItemIssues` filtered by designItemId and
 * renders:
 *   - Summary bar (open · acknowledged · resolved).
 *   - Grouped list, newest first, collapsible.
 *   - Inline comment box on each issue with status toggle buttons.
 *   - "Raise new" composer for manual issue creation.
 *
 * Kept standalone (no shared chrome) so it sits cleanly under either
 * host. Authors use `useAuth` — unauthenticated views hide the write
 * affordances.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare, Loader2, AlertCircle, Check, XCircle,
  ChevronDown, ChevronRight, Send, Plus,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  subscribeToIssues, subscribeToComments,
  createDesignItemIssue, addComment, setIssueStatus,
} from '../services/designItemIssueService';
import type {
  DesignItemIssue, IssueComment, IssueStatus, IssueKind, IssueSeverity,
} from '../types/designItemIssue';

interface Props {
  projectId: string;
  designItemId: string;
  /** Optional — labels the host so raised issues carry the right `source`. */
  source?: string;
}

const KIND_LABEL: Record<IssueKind, string> = {
  cutlist: 'Cutting list',
  material: 'Material',
  revision: 'Revision',
  geometry: 'Geometry',
  general: 'General',
};

const SEVERITY_TINT: Record<IssueSeverity, string> = {
  blocker: 'bg-red-100 text-red-800 border-red-200',
  major:   'bg-amber-100 text-amber-800 border-amber-200',
  minor:   'bg-blue-100 text-blue-800 border-blue-200',
  info:    'bg-muted text-muted-foreground border-border',
};

const STATUS_TINT: Record<IssueStatus, string> = {
  open:          'bg-red-50 text-red-700 border-red-200',
  acknowledged:  'bg-amber-50 text-amber-700 border-amber-200',
  resolved:      'bg-green-50 text-green-700 border-green-200',
  wont_fix:      'bg-muted text-muted-foreground border-border',
};

export function DesignItemIssuesPanel({ projectId, designItemId, source = 'manual' }: Props) {
  const { user } = useAuth();
  const [issues, setIssues] = useState<DesignItemIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToIssues(
      { designItemId },
      list => { setIssues(list); setLoading(false); },
      err => { setError(err.message); setLoading(false); },
    );
    return () => unsub();
  }, [designItemId]);

  const counts = useMemo(() => {
    const c = { open: 0, acknowledged: 0, resolved: 0, wont_fix: 0 };
    for (const i of issues) c[i.status]++;
    return c;
  }, [issues]);

  return (
    <section className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-foreground/70" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">Design Issues</h3>
          {counts.open > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium">
              {counts.open} open
            </span>
          )}
        </div>
        {user && (
          <button
            type="button"
            onClick={() => setComposerOpen(v => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-accent hover:bg-accent/80 rounded"
          >
            <Plus className="h-3 w-3" /> Raise
          </button>
        )}
      </div>

      {/* Composer */}
      {composerOpen && user && (
        <NewIssueComposer
          projectId={projectId}
          designItemId={designItemId}
          source={source}
          onDone={() => setComposerOpen(false)}
          user={user}
        />
      )}

      {/* Summary chips */}
      {issues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="px-1.5 py-0.5 rounded border border-border">{counts.open} open</span>
          <span className="px-1.5 py-0.5 rounded border border-border">{counts.acknowledged} acknowledged</span>
          <span className="px-1.5 py-0.5 rounded border border-border">{counts.resolved} resolved</span>
          {counts.wont_fix > 0 && (
            <span className="px-1.5 py-0.5 rounded border border-border">{counts.wont_fix} won't fix</span>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading issues…
        </p>
      ) : error ? (
        <p className="text-[11px] text-red-600">{error}</p>
      ) : issues.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No issues raised yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {issues.map(iss => (
            <IssueRow key={iss.id} issue={iss} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// New-issue composer
// ---------------------------------------------------------------------------

function NewIssueComposer({
  projectId, designItemId, source, onDone, user,
}: {
  projectId: string;
  designItemId: string;
  source: string;
  onDone: () => void;
  user: { uid: string; displayName?: string | null; email?: string | null };
}) {
  const [kind, setKind] = useState<IssueKind>('general');
  const [severity, setSeverity] = useState<IssueSeverity>('minor');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      setErr('Title and body are required.');
      return;
    }
    setSaving(true); setErr(null);
    try {
      await createDesignItemIssue(
        { projectId, designItemId, kind, severity, title, body, source },
        user,
      );
      setTitle(''); setBody('');
      onDone();
    } catch (e) {
      setErr((e as Error).message || 'Failed to raise issue');
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-md border border-border bg-muted/40 p-2 space-y-1.5">
      <div className="flex gap-1.5">
        <select
          value={kind}
          onChange={e => setKind(e.target.value as IssueKind)}
          className="text-[11px] px-1.5 py-1 rounded border border-border bg-background"
        >
          {(Object.keys(KIND_LABEL) as IssueKind[]).map(k => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value as IssueSeverity)}
          className="text-[11px] px-1.5 py-1 rounded border border-border bg-background"
        >
          {(['blocker','major','minor','info'] as IssueSeverity[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Short title (e.g. 'Side panel 720mm doesn\\'t match model')"
        className="w-full text-[11px] px-2 py-1 rounded border border-border bg-background"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Describe what's wrong and what needs to happen."
        rows={3}
        className="w-full text-[11px] px-2 py-1 rounded border border-border bg-background resize-y"
      />
      {err && <p className="text-[10px] text-red-600">{err}</p>}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onDone}
          className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded disabled:opacity-50 inline-flex items-center gap-1"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Raise
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-issue row with collapsible comment thread
// ---------------------------------------------------------------------------

function IssueRow({ issue }: { issue: DesignItemIssue }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const unsub = subscribeToComments(
      issue.id,
      list => setComments(list),
      e => setErr(e.message),
    );
    return () => unsub();
  }, [expanded, issue.id]);

  const handleComment = async () => {
    if (!user || !newComment.trim()) return;
    setSaving(true); setErr(null);
    try {
      await addComment(issue.id, { body: newComment }, user);
      setNewComment('');
    } catch (e) {
      setErr((e as Error).message || 'Failed to send');
    } finally { setSaving(false); }
  };

  const handleStatus = async (next: IssueStatus) => {
    if (!user || next === issue.status) return;
    setSaving(true); setErr(null);
    try {
      await setIssueStatus(
        issue.id,
        next,
        newComment.trim() || `Status changed to ${next}.`,
        user,
      );
      setNewComment('');
    } catch (e) {
      setErr((e as Error).message || 'Failed to change status');
    } finally { setSaving(false); }
  };

  return (
    <li className="rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full p-2 flex items-start gap-2 text-left hover:bg-accent/30 rounded-md"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase ${STATUS_TINT[issue.status]}`}>
              {issue.status.replace('_', ' ')}
            </span>
            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase ${SEVERITY_TINT[issue.severity]}`}>
              {issue.severity}
            </span>
            <span className="text-[10px] text-muted-foreground">{KIND_LABEL[issue.kind]}</span>
          </div>
          <p className="text-[11px] font-medium truncate mt-0.5" title={issue.title}>{issue.title}</p>
          <p className="text-[10px] text-muted-foreground">
            Raised by {issue.createdByName}
            {issue.recentCommentCount > 0 && ` · ${issue.recentCommentCount} comment${issue.recentCommentCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-2 space-y-2">
          <p className="text-[11px] whitespace-pre-wrap leading-snug">{issue.body}</p>

          {issue.scope && (issue.scope.cabinetId || issue.scope.partId) && (
            <p className="text-[10px] text-muted-foreground">
              Scope: {issue.scope.cabinetId ? `cabinet ${issue.scope.cabinetId}` : ''}
              {issue.scope.partId ? ` · part ${issue.scope.partId}` : ''}
              {issue.scope.meshNodeId ? ` · mesh ${issue.scope.meshNodeId}` : ''}
            </p>
          )}

          {/* Comment thread */}
          {comments.length > 0 && (
            <ul className="space-y-1 border-l-2 border-border pl-2">
              {comments.map(c => (
                <li key={c.id} className="text-[11px]">
                  <p className="font-medium text-foreground/80">{c.authorName}</p>
                  <p className="whitespace-pre-wrap leading-snug">{c.body}</p>
                  {c.statusChangeTo && (
                    <p className="text-[9px] text-muted-foreground italic">
                      (changed status to {c.statusChangeTo.replace('_', ' ')})
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Compose area */}
          {user && issue.status !== 'resolved' && issue.status !== 'wont_fix' && (
            <>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                className="w-full text-[11px] px-2 py-1 rounded border border-border bg-background resize-y"
              />
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleComment}
                  disabled={saving || !newComment.trim()}
                  className="text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded disabled:opacity-40 inline-flex items-center gap-1"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Comment
                </button>
                {issue.status === 'open' && (
                  <button
                    type="button"
                    onClick={() => handleStatus('acknowledged')}
                    disabled={saving}
                    className="text-[11px] px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 inline-flex items-center gap-1"
                  >
                    <AlertCircle className="h-3 w-3" /> Acknowledge
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleStatus('resolved')}
                  disabled={saving}
                  className="text-[11px] px-2 py-1 rounded border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 inline-flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Resolve
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus('wont_fix')}
                  disabled={saving}
                  className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
                >
                  <XCircle className="h-3 w-3" /> Won't fix
                </button>
              </div>
            </>
          )}

          {/* Re-open from a resolved/wont_fix state */}
          {user && (issue.status === 'resolved' || issue.status === 'wont_fix') && (
            <button
              type="button"
              onClick={() => handleStatus('open')}
              disabled={saving}
              className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent"
            >
              Re-open
            </button>
          )}

          {err && <p className="text-[10px] text-red-600">{err}</p>}
        </div>
      )}
    </li>
  );
}
