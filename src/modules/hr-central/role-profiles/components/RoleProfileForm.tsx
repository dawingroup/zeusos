/**
 * RoleProfileForm — Phase 6.UI.A (PR 6).
 *
 * Edit a role profile's identifying fields (brand, department, title,
 * jobLevel) plus the v1.2 verb matrix (`taskCapabilities[]`) and
 * approval authorities. The verb matrix is rendered as a per-event
 * row with 4 boolean flags + amount-ceiling field on the matching
 * ApprovalAuthority entry.
 *
 * Save calls `createRoleProfileFn` (upsert semantics — same callable
 * handles create + update via the deterministic id).
 */

import { useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import type {
  RoleProfile,
  JobLevel,
  TaskCapability,
  ApprovalAuthority,
} from '@/modules/hr-central/role-profiles/types';
import { createRoleProfileFn } from '../services/role-profile.service';

// Local brand list — `brandId` is structurally a string, the type
// imports drift between the legacy v1.0 set and the canonical Zeus
// brands. The form uses the canonical 5 + 'all'.
const BRAND_OPTIONS: { value: string; label: string }[] = [
  { value: 'zeus-the-agency', label: 'Zeus The Agency' },
  { value: 'zeus-digital',    label: 'Zeus Digital' },
  { value: 'labyrinth',       label: 'Labyrinth' },
  { value: 'odd-gorilla',     label: 'Odd Gorilla' },
  { value: 'house-of-zeus',   label: 'House of Zeus' },
  { value: 'all',             label: 'All brands (cross-brand)' },
];

const DEPARTMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'creative',           label: 'Creative' },
  { value: 'design',             label: 'Design' },
  { value: 'production',         label: 'Production' },
  { value: 'media',              label: 'Media' },
  { value: 'strategy',           label: 'Strategy' },
  { value: 'marketing',          label: 'Marketing' },
  { value: 'finance',            label: 'Finance' },
  { value: 'hr',                 label: 'HR' },
  { value: 'operations',         label: 'Operations' },
  { value: 'business-development', label: 'Business Development' },
  { value: 'client-services',    label: 'Client Services' },
];

const JOB_LEVELS: JobLevel[] = ['intern', 'associate', 'mid', 'senior', 'manager', 'director', 'executive'];

const COMMON_EVENT_TYPES = [
  'creative.internal_approval_requested',
  'creative.client_approval_received',
  'iwo.issued',
  'iwo.accepted',
  'iwo.delivered',
  'campaign.brief_signed_off',
  'media.plan_approved',
  'financial.invoice_approved',
];

interface Props {
  /** Existing profile to seed the form. When undefined, render a blank
   *  create form. */
  profile?: RoleProfile;
  onSaved?: (id: string) => void;
}

interface TaskCapabilityDraft extends TaskCapability {
  draftKey: string;
}

interface ApprovalAuthorityDraft extends ApprovalAuthority {
  draftKey: string;
}

function rid(): string { return `c_${Math.random().toString(36).slice(2, 10)}`; }

export function RoleProfileForm({ profile, onSaved }: Props) {
  const isEdit = !!profile;

  const [brandId, setBrandId] = useState<string>(profile?.brandId ?? 'zeus-the-agency');
  const [departmentId, setDepartmentId] = useState<string>(profile?.departmentId ?? 'creative');
  const [jobLevel, setJobLevel] = useState<JobLevel>(profile?.jobLevel ?? 'mid');
  const [title, setTitle] = useState<string>(profile?.title ?? '');
  const [description, setDescription] = useState<string>(profile?.description ?? '');
  const [taskCapabilities, setTaskCapabilities] = useState<TaskCapabilityDraft[]>(
    (profile?.taskCapabilities ?? []).map((c) => ({ ...c, draftKey: rid() })),
  );
  const [approvalAuthorities, setApprovalAuthorities] = useState<ApprovalAuthorityDraft[]>(
    (profile?.approvalAuthorities ?? []).map((a) => ({ ...a, draftKey: rid() })),
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ────────── Task capability matrix
  const addCapability = (eventType: string) => {
    setTaskCapabilities((prev) => [
      ...prev,
      {
        draftKey: rid(),
        eventType,
        taskTypes: [],
        canInitiate: false,
        canExecute: false,
        canApprove: false,
        canDelegate: false,
      },
    ]);
  };
  const patchCapability = (key: string, patch: Partial<TaskCapabilityDraft>) => {
    setTaskCapabilities((prev) => prev.map((c) => (c.draftKey === key ? { ...c, ...patch } : c)));
  };
  const removeCapability = (key: string) => {
    setTaskCapabilities((prev) => prev.filter((c) => c.draftKey !== key));
  };

  // ────────── Approval authority list
  const addAuthority = () => {
    setApprovalAuthorities((prev) => [
      ...prev,
      { draftKey: rid(), eventType: COMMON_EVENT_TYPES[0], maxAmountMinor: undefined, currencyCode: 'UGX' },
    ]);
  };
  const patchAuthority = (key: string, patch: Partial<ApprovalAuthorityDraft>) => {
    setApprovalAuthorities((prev) => prev.map((a) => (a.draftKey === key ? { ...a, ...patch } : a)));
  };
  const removeAuthority = (key: string) => {
    setApprovalAuthorities((prev) => prev.filter((a) => a.draftKey !== key));
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    setSavedId(null);
    try {
      const stripKey = <T extends { draftKey?: string }>(arr: T[]): Omit<T, 'draftKey'>[] =>
        arr.map(({ draftKey: _drop, ...rest }) => rest);
      const res = await createRoleProfileFn({
        id: profile?.id,
        brandId: brandId as never,
        departmentId: departmentId as never,
        jobLevel,
        employmentTypes: profile?.employmentTypes ?? (['full_time'] as never),
        title: title.trim(),
        description: description.trim() || undefined,
        taskCapabilities: stripKey(taskCapabilities) as TaskCapability[],
        approvalAuthorities: stripKey(approvalAuthorities) as ApprovalAuthority[],
        typicalTaskLoad: profile?.typicalTaskLoad ?? { daily: 4, weekly: 20, maxConcurrent: 6 },
      });
      setSavedId(res.data.id);
      onSaved?.(res.data.id);
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSave = useMemo(
    () => title.trim().length > 0 && brandId && departmentId,
    [title, brandId, departmentId],
  );

  return (
    <section data-testid="role-profile-form" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Brand</span>
          <select
            data-testid="rp-brand-input"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={isEdit}
            className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px] disabled:opacity-60"
          >
            {BRAND_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Department</span>
          <select
            data-testid="rp-department-input"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          >
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Job level</span>
          <select
            data-testid="rp-job-level-input"
            value={jobLevel}
            onChange={(e) => setJobLevel(e.target.value as JobLevel)}
            className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          >
            {JOB_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Title</span>
        <Input
          data-testid="rp-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Senior Designer"
        />
      </label>

      <label className="block">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Description</span>
        <Input
          data-testid="rp-description-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this role owns day-to-day"
        />
      </label>

      {/* Task capability matrix */}
      <fieldset className="space-y-2 border border-[var(--border-default)] rounded-md p-3">
        <legend className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] px-1">
          Task capabilities (verb matrix)
        </legend>
        {taskCapabilities.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-tertiary)] italic">
            No capabilities declared. Use the buttons below to add common event-type rows.
          </p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-[var(--fg-tertiary)] border-b border-[var(--border-default)]">
                <th className="py-1 pr-2 font-medium">Event type</th>
                <th className="py-1 pr-2 font-medium text-center">Initiate</th>
                <th className="py-1 pr-2 font-medium text-center">Execute</th>
                <th className="py-1 pr-2 font-medium text-center">Approve</th>
                <th className="py-1 pr-2 font-medium text-center">Delegate</th>
                <th className="py-1 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {taskCapabilities.map((c) => (
                <tr
                  key={c.draftKey}
                  data-testid={`rp-cap-${c.draftKey}`}
                  className="border-b border-[var(--border-default)]"
                >
                  <td className="py-1 pr-2 font-mono text-[11px]">{c.eventType}</td>
                  {(['canInitiate', 'canExecute', 'canApprove', 'canDelegate'] as const).map((flag) => (
                    <td key={flag} className="py-1 pr-2 text-center">
                      <input
                        type="checkbox"
                        data-testid={`rp-cap-${c.draftKey}-${flag}`}
                        checked={c[flag]}
                        onChange={(e) => patchCapability(c.draftKey, { [flag]: e.target.checked } as never)}
                      />
                    </td>
                  ))}
                  <td className="py-1 pr-2 text-right">
                    <button
                      type="button"
                      data-testid={`rp-cap-${c.draftKey}-remove`}
                      onClick={() => removeCapability(c.draftKey)}
                      className="text-[var(--fg-tertiary)] hover:text-[var(--rag-red)]"
                      aria-label="Remove capability"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {COMMON_EVENT_TYPES.filter((et) => !taskCapabilities.some((c) => c.eventType === et)).map((et) => (
            <Button
              key={et}
              size="sm"
              variant="outline"
              data-testid={`rp-add-cap-${et}`}
              onClick={() => addCapability(et)}
            >
              <Plus className="h-3 w-3 mr-1" aria-hidden="true" />
              {et}
            </Button>
          ))}
        </div>
      </fieldset>

      {/* Approval authority */}
      <fieldset className="space-y-2 border border-[var(--border-default)] rounded-md p-3">
        <legend className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] px-1">
          Approval authorities (money + scope)
        </legend>
        {approvalAuthorities.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-tertiary)] italic">
            No approval authorities declared.
          </p>
        ) : (
          <ul className="space-y-2">
            {approvalAuthorities.map((a) => (
              <li
                key={a.draftKey}
                data-testid={`rp-auth-${a.draftKey}`}
                className="grid grid-cols-12 gap-2 items-center"
              >
                <select
                  data-testid={`rp-auth-${a.draftKey}-event`}
                  value={a.eventType}
                  onChange={(e) => patchAuthority(a.draftKey, { eventType: e.target.value })}
                  className="col-span-6 h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[12px]"
                >
                  {COMMON_EVENT_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
                </select>
                <Input
                  data-testid={`rp-auth-${a.draftKey}-amount`}
                  className="col-span-3 h-8"
                  placeholder="max amount (minor)"
                  value={a.maxAmountMinor ?? ''}
                  onChange={(e) =>
                    patchAuthority(a.draftKey, {
                      maxAmountMinor: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  inputMode="numeric"
                />
                <Input
                  data-testid={`rp-auth-${a.draftKey}-currency`}
                  className="col-span-2 h-8"
                  placeholder="UGX"
                  value={a.currencyCode ?? ''}
                  onChange={(e) => patchAuthority(a.draftKey, { currencyCode: e.target.value })}
                />
                <button
                  type="button"
                  data-testid={`rp-auth-${a.draftKey}-remove`}
                  onClick={() => removeAuthority(a.draftKey)}
                  className="col-span-1 justify-self-end text-[var(--fg-tertiary)] hover:text-[var(--rag-red)]"
                  aria-label="Remove authority"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" variant="outline" data-testid="rp-add-authority" onClick={addAuthority}>
          <Plus className="h-3 w-3 mr-1" aria-hidden="true" /> Add authority
        </Button>
      </fieldset>

      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          data-testid="rp-save-btn"
          disabled={busy || !canSave}
          onClick={submit}
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create role profile'}
        </Button>
        {savedId && (
          <span data-testid="rp-saved-banner" className="text-[12px] text-[var(--rag-green-deep)]">
            Saved · <code className="font-mono">{savedId}</code>
          </span>
        )}
        {err && (
          <span role="alert" data-testid="rp-save-error" className="text-[12px] text-[var(--rag-red)]">
            {err}
          </span>
        )}
      </div>
    </section>
  );
}
