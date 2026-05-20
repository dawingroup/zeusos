/**
 * ClientPortalAccessPanel — staff-facing widget on the customer
 * detail page. Lists the client-portal users currently granted access
 * to each of the customer's design projects, and provides a small
 * "grant access by UID" form.
 *
 * Why UID-paste, not email-resolve?
 *   Email → Firebase Auth UID resolution requires the Admin SDK, which
 *   only runs in a Cloud Function. Until we ship that function this
 *   panel accepts a UID directly — staff get the UID from the dev
 *   console (Firebase Auth tab) or from the client's first sign-in
 *   confirmation. The data path is otherwise the same as the
 *   `scripts/seed-vela-boutique-portal.cjs --client-uid <uid>` flow.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, doc, getDocs, query, where,
  arrayRemove, updateDoc, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/firebase/config';
import { functions } from '@/shared/services/firebase';
import { Users, UserPlus, Copy, AlertCircle, Check, Loader2, Trash2, Mail, ExternalLink } from 'lucide-react';
import type { DesignProject } from '@/modules/design-manager/types';

interface ProjectAccessRow {
  project: DesignProject;
  /** UIDs currently granted access to this project. */
  userIds: string[];
}

interface Props {
  /** Reserved for the future email-invite flow that creates a pendingInvite under the customer. */
  customerId: string;
  customerName: string;
  /** Projects loaded by the parent (re-uses useProjectsByCustomer). */
  projects: DesignProject[];
  projectsLoading: boolean;
}

export function ClientPortalAccessPanel({ customerId, customerName, projects, projectsLoading }: Props) {
  // Local mirror of clientPortalUserIds per project — kept in sync via writes
  // (we don't subscribe; this panel is admin-side and writes are infrequent).
  const [rows, setRows] = useState<ProjectAccessRow[]>([]);
  const [mode, setMode] = useState<'email' | 'uid'>('email');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Hydrate rows from the loaded projects.
  useEffect(() => {
    setRows(projects.map((p) => ({
      project: p,
      userIds: Array.isArray(p.clientPortalUserIds) ? p.clientPortalUserIds : [],
    })));
  }, [projects]);

  const totalGranted = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.userIds))).length,
    [rows],
  );

  async function grantByEmail(email: string) {
    setSubmitting(true);
    setError(null);
    try {
      const call = httpsCallable<
        { customerId: string; email: string },
        { uid: string | null; status: string; projectsTouched: number; salesOrdersTouched: number; email?: string; displayName?: string | null }
      >(functions, 'inviteClientPortalUser');
      const result = await call({ customerId, email });
      const r = result.data;

      if (r.status === 'user_not_found') {
        setError(`No Firebase Auth account exists for ${email} yet. Ask the client to sign in once via the portal to create the account, then re-invite.`);
        return;
      }

      if (r.uid) {
        // Optimistically update local state on every project.
        setRows((prev) => prev.map((row) => ({
          ...row,
          userIds: row.userIds.includes(r.uid!) ? row.userIds : [...row.userIds, r.uid!],
        })));
      }

      setInput('');
      const who = r.displayName ? `${r.displayName} (${r.email})` : (r.email || email);
      if (r.status === 'already_granted') {
        setToast(`${who} already had access. No changes made.`);
      } else {
        setToast(`Granted ${who} access to ${r.projectsTouched} project${r.projectsTouched === 1 ? '' : 's'}.`);
      }
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const msg = e.code === 'permission-denied'
        ? 'You need to be signed in as Dawin staff to invite clients.'
        : (e.message || 'Failed to invite — please try again.');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function grantByUid(uid: string) {
    setSubmitting(true);
    setError(null);
    try {
      // Direct Firestore writes — same shape as before. Kept as a fallback
      // for when staff already have the UID and don't want the round-trip.
      const writes = projects.map(async (p) => {
        const projectRef = doc(db, 'designProjects', p.id);
        await updateDoc(projectRef, {
          clientPortalUserIds: ((p.clientPortalUserIds ?? []).includes(uid)
            ? p.clientPortalUserIds
            : [...(p.clientPortalUserIds ?? []), uid]),
          updatedAt: Timestamp.now(),
          updatedBy: 'customer-hub:grant-uid',
        });

        try {
          const soSnap = await getDocs(query(
            collection(db, 'salesOrders'),
            where('designProjectId', '==', p.id),
          ));
          await Promise.all(soSnap.docs.map(async (d) => {
            const so = d.data();
            const existing = Array.isArray(so.clientPortalUserIds) ? so.clientPortalUserIds : [];
            if (!existing.includes(uid)) {
              await updateDoc(doc(db, 'salesOrders', d.id), {
                clientPortalUserIds: [...existing, uid],
                updatedAt: Timestamp.now(),
              });
            }
          }));
        } catch (_) { /* non-critical */ }
      });
      await Promise.all(writes);
      setRows((prev) => prev.map((r) => ({
        ...r,
        userIds: r.userIds.includes(uid) ? r.userIds : [...r.userIds, uid],
      })));
      setInput('');
      setToast(`Granted portal access to ${uid.slice(0, 8)}… on ${projects.length} project${projects.length === 1 ? '' : 's'}.`);
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeUid(projectId: string, uid: string) {
    setError(null);
    try {
      const projectRef = doc(db, 'designProjects', projectId);
      await updateDoc(projectRef, {
        clientPortalUserIds: arrayRemove(uid),
        updatedAt: Timestamp.now(),
        updatedBy: 'customer-hub:revoke',
      });
      // Mirror revoke on the linked SO too.
      try {
        const soSnap = await getDocs(query(
          collection(db, 'salesOrders'),
          where('designProjectId', '==', projectId),
        ));
        await Promise.all(soSnap.docs.map((d) =>
          updateDoc(doc(db, 'salesOrders', d.id), {
            clientPortalUserIds: arrayRemove(uid),
            updatedAt: Timestamp.now(),
          }),
        ));
      } catch (_) { /* non-critical */ }

      setRows((prev) => prev.map((r) =>
        r.project.id === projectId
          ? { ...r, userIds: r.userIds.filter((u) => u !== uid) }
          : r,
      ));
      setToast(`Revoked ${uid.slice(0, 8)}… from this project.`);
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    if (mode === 'email') {
      if (!isPlausibleEmail(trimmed)) {
        setError('Please enter a valid email address.');
        return;
      }
      grantByEmail(trimmed);
    } else {
      if (!isPlausibleUid(trimmed)) {
        setError('That doesn\'t look like a Firebase Auth UID. UIDs are 20–40 char alphanumeric strings.');
        return;
      }
      grantByUid(trimmed);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Client portal access</h2>
          {totalGranted > 0 ? (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {totalGranted} {totalGranted === 1 ? 'person' : 'people'}
            </span>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Grant {customerName} contacts access to the client portal. Inviting by email looks up the
        client's Firebase Auth account; if no account exists, ask them to sign in once via the
        portal first, then re-invite. The UID mode is a fallback if you already have the UID.
      </p>

      <div className="flex gap-1 mb-3 text-xs">
        <button
          type="button"
          onClick={() => { setMode('email'); setInput(''); setError(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            mode === 'email'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Mail className="h-3.5 w-3.5" /> Invite by email
        </button>
        <button
          type="button"
          onClick={() => { setMode('uid'); setInput(''); setError(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            mode === 'uid'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <code className="font-mono">UID</code> · paste
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type={mode === 'email' ? 'email' : 'text'}
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          placeholder={mode === 'email'
            ? 'client@company.com'
            : 'Firebase Auth UID (e.g. IM7gS8yB5yNeQdX1ekhjiS3I0Es2)'}
          disabled={submitting}
          className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${
            mode === 'uid' ? 'font-mono' : ''
          }`}
        />
        <button
          type="submit"
          disabled={submitting || !input.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Grant access
        </button>
      </form>

      {error ? (
        <div className="flex items-start gap-2 px-3 py-2 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {toast ? (
        <div className="flex items-start gap-2 px-3 py-2 mb-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      ) : null}

      {projectsLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">No projects to grant access to yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.project.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <Link
                  to={`/design/project/${r.project.id}`}
                  className="font-medium text-gray-900 text-sm hover:text-primary truncate"
                >
                  {r.project.name}
                  <span className="ml-2 text-xs text-gray-500 font-mono">{r.project.code}</span>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.project.code ? (
                    // Staff "view as client" — opens the portal for this
                    // project in a new tab. The portal recognises Dawin
                    // staff (`@dawin.group`) and lets them in without
                    // needing to be in `clientPortalUserIds`. Useful for
                    // previewing what the client sees before invite.
                    <a
                      href={`/portal/p/${r.project.code}/dashboard`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View this project as the client (opens portal in a new tab)"
                      className="flex items-center gap-1 px-2 py-1 text-xs text-primary border border-primary/30 rounded-md hover:bg-primary/5 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View as client
                    </a>
                  ) : null}
                  <span className="text-xs text-gray-500">
                    {r.userIds.length} {r.userIds.length === 1 ? 'user' : 'users'}
                  </span>
                </div>
              </div>

              {r.userIds.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No portal users granted yet.</p>
              ) : (
                <div className="space-y-1">
                  {r.userIds.map((uid) => (
                    <UidRow
                      key={uid}
                      uid={uid}
                      onRevoke={() => revokeUid(r.project.id, uid)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Portal URL — <code className="font-mono">/portal/p/&lt;project-code&gt;/dashboard</code>.
        For the deployed preview, the user opens <code>https://dawinos--portal-test-…web.app/portal/sign-in</code>.
      </p>
    </div>
  );
}

function UidRow({ uid, onRevoke }: { uid: string; onRevoke: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) { /* ignore */ }
  };
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50 rounded text-sm">
      <code className="font-mono text-xs text-gray-700 truncate flex-1">{uid}</code>
      <button
        onClick={handleCopy}
        title="Copy UID"
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={onRevoke}
        title="Revoke access"
        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Heuristic Firebase Auth UID check. Real UIDs are 28 chars but
 * provider-linked ones can be longer (Apple link UIDs, anonymous, etc.)
 * — accept 20–40 alphanumeric to be forgiving.
 */
function isPlausibleUid(s: string): boolean {
  return /^[A-Za-z0-9_-]{20,40}$/.test(s);
}

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

