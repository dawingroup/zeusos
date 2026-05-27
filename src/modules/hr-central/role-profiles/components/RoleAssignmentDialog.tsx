/**
 * RoleAssignmentDialog — Phase 6.UI.A (PR 6).
 *
 * Modal for assigning an employee to a role profile. Calls
 * `assignEmployeeToRoleFn`. The dialog scopes the employee picker
 * by the role's brand for clarity (free-text fallback when the
 * employee list isn't reachable).
 */

import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { X } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { useEmployeeList } from '@/modules/hr-central/hooks/useEmployee';
import type { RoleProfile } from '@/modules/hr-central/role-profiles/types';
import { assignEmployeeToRoleFn } from '../services/role-profile.service';

interface Props {
  open: boolean;
  roleProfile: RoleProfile;
  onClose: () => void;
  onAssigned?: (assignmentId: string) => void;
}

function todayIso(): string {
  return new Date().toISOString();
}

export function RoleAssignmentDialog({ open, roleProfile, onClose, onAssigned }: Props) {
  const { employees } = useEmployeeList();
  const [employeeId, setEmployeeId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso().slice(0, 10));
  const [isPrimary, setIsPrimary] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await assignEmployeeToRoleFn({
        employeeId: employeeId.trim(),
        roleProfileId: roleProfile.id,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        isPrimary,
      });
      onAssigned?.(res.data.id);
      onClose();
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="role-assignment-dialog"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 p-3 border-b border-[var(--border-default)]">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--fg-primary)]">Assign employee</h2>
            <p className="text-[11.5px] text-[var(--fg-tertiary)]">
              {roleProfile.title} · {roleProfile.brandId}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)]">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-4 space-y-3">
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Employee</span>
            {employees && employees.length > 0 ? (
              <select
                data-testid="ra-employee-input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
              >
                <option value="">— Pick employee —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} · {emp.title}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                data-testid="ra-employee-input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="employee id"
              />
            )}
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Effective from</span>
            <Input
              type="date"
              data-testid="ra-effective-from-input"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="ra-is-primary-input"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            <span className="text-[12.5px] text-[var(--fg-secondary)]">
              Primary assignment (biases the role's ranking)
            </span>
          </label>
          {err && (
            <p role="alert" data-testid="ra-error" className="text-[12px] text-[var(--rag-red)]">
              {err}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 p-3 border-t border-[var(--border-default)]">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            data-testid="ra-submit-btn"
            disabled={busy || !employeeId || !effectiveFrom}
            onClick={submit}
          >
            {busy ? 'Assigning…' : 'Assign'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
