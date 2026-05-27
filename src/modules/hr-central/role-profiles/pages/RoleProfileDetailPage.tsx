/**
 * RoleProfileDetailPage — Phase 6.UI.A (PR 6).
 *
 * Per-profile detail surface. Top: edit form (RoleProfileForm).
 * Below: list of current role assignments + "Assign employee"
 * button that opens RoleAssignmentDialog. Archive button on header.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { ArrowLeft, Archive, Plus } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { RoleAssignment, RoleProfile } from '@/modules/hr-central/role-profiles/types';
import {
  archiveRoleProfileFn,
  endRoleAssignmentFn,
  subscribeRoleAssignments,
  subscribeRoleProfile,
} from '../services/role-profile.service';
import { RoleProfileForm } from '../components/RoleProfileForm';
import { RoleAssignmentDialog } from '../components/RoleAssignmentDialog';

export default function RoleProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<RoleProfile | null>(null);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const decoded = decodeURIComponent(id);
    const u1 = subscribeRoleProfile(decoded, setProfile, (e) =>
      setErr(`Role profile load failed: ${e.message}`),
    );
    const u2 = subscribeRoleAssignments(setAssignments, undefined, { roleProfileId: decoded });
    return () => { u1(); u2(); };
  }, [id]);

  const archive = async () => {
    if (!profile) return;
    setBusy('archive');
    setErr(null);
    try {
      await archiveRoleProfileFn({ id: profile.id });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const endAssignment = async (assignmentId: string) => {
    setBusy(assignmentId);
    setErr(null);
    try {
      await endRoleAssignmentFn({ id: assignmentId });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!profile) {
    return (
      <div className="p-6">
        <Link to="/hr/role-profiles" className="text-[12px] text-[var(--fg-tertiary)]">← Role profiles</Link>
        <p className="mt-2 text-[13px] text-[var(--fg-secondary)]">
          {err ?? 'Loading role profile…'}
        </p>
      </div>
    );
  }

  const activeAssignments = assignments.filter((a) => a.status === 'active');

  return (
    <div className="p-6 space-y-5" data-testid="role-profile-detail-page">
      <header className="space-y-1">
        <Link to="/hr/role-profiles" className="inline-flex items-center gap-1 text-[12px] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)]">
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Role profiles
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold text-[var(--fg-primary)]">{profile.title}</h1>
            <p className="text-[12.5px] text-[var(--fg-tertiary)]">
              <code className="font-mono">{profile.id}</code>
            </p>
          </div>
          {profile.status !== 'archived' && (
            <Button
              size="sm"
              variant="outline"
              data-testid="rp-archive-btn"
              disabled={busy === 'archive'}
              onClick={archive}
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              {busy === 'archive' ? 'Archiving…' : 'Archive'}
            </Button>
          )}
        </div>
      </header>

      {err && (
        <div role="alert" data-testid="rp-detail-error" className="p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]">
          {err}
        </div>
      )}

      {/* Edit form */}
      <section data-testid="rp-edit-section">
        <RoleProfileForm profile={profile} />
      </section>

      {/* Assignments */}
      <section data-testid="rp-assignments-section" className="space-y-3">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-[var(--fg-primary)]">
            Assignments
            <span className="ml-2 text-[12px] font-normal text-[var(--fg-tertiary)]">
              ({activeAssignments.length} active{assignments.length > activeAssignments.length ? `, ${assignments.length - activeAssignments.length} ended` : ''})
            </span>
          </h2>
          <Button
            size="sm"
            data-testid="open-assign-dialog"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Assign employee
          </Button>
        </header>

        {assignments.length === 0 ? (
          <p
            data-testid="rp-assignments-empty"
            className="text-[12.5px] text-[var(--fg-tertiary)] italic p-3 rounded-md border border-dashed border-[var(--border-default)] text-center"
          >
            No one's been assigned to this role yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {assignments.map((a) => (
              <li
                key={a.id}
                data-testid={`rp-assignment-${a.id}`}
                className="flex items-center gap-3 p-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-[var(--fg-primary)]">
                    <code className="font-mono">{a.employeeId}</code>
                    {a.isPrimary && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded">
                        primary
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-[var(--fg-tertiary)]">
                    {a.status} · effective {typeof a.effectiveFrom === 'string' ? (a.effectiveFrom as string).slice(0, 10) : '—'}
                  </p>
                </div>
                {a.status === 'active' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`rp-end-assignment-${a.id}`}
                    disabled={busy === a.id}
                    onClick={() => endAssignment(a.id)}
                  >
                    {busy === a.id ? 'Ending…' : 'End'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <RoleAssignmentDialog
        open={dialogOpen}
        roleProfile={profile}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
