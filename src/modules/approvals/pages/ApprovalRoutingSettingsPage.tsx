/**
 * Settings → Approval routing (port stream F / routing v2).
 *
 * Edits `systemSettings/approvalRouting` — the KES signature ladder for
 * supplier spend: value bands with their signatures, which lead signs per
 * purpose, how far a Tier-1 engagement climbs, and aggregate oversight.
 * Validates with the same engine the Cloud Function uses, previews the
 * decision for an amount / purpose / tier before saving, and cannot save a
 * ladder the server would refuse.
 */

import { useEffect, useMemo, useState } from 'react';

import { useCurrentDawinUser } from '@/core/settings';
import type { GlobalRole } from '@/core/settings/types';
import { PageHero } from '@/shared/components/refresh';
import { pushToast } from '@/shared/components/feedback/toastBus';
import { describeCallableError } from '@/shared/utils/callableError';

import { describeRange, routingDecisionFor, validateModule } from '../routing/engine';
import { saveApprovalRouting } from '../routing/service';
import {
  AGGREGATE_KINDS,
  AGGREGATE_LABELS,
  DEFAULT_APPROVAL_ROUTING,
  PURPOSES,
  PURPOSE_LABELS,
  ROLE_LABELS,
  ROLE_SENIORITY,
  SUPPLIER_SPEND,
  type AggregateRule,
  type ApprovalBandV2,
  type ApprovalModuleRoutingV2,
  type ApprovalPurpose,
  type ApprovalRoutingConfig,
  type ApprovalSigner,
  type PurposeRule,
} from '../routing/types';
import { useApprovalRouting } from '../routing/useApprovalRouting';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const TIERS = ['TIER_1', 'TIER_2', 'TIER_3'];

const field: React.CSSProperties = { fontSize: 12, padding: '5px 7px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', minWidth: 0 };
const small: React.CSSProperties = { fontSize: 11, color: '#64748b' };
const card: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff', display: 'grid', gap: 10 };
const btn = (variant: 'primary' | 'ghost' | 'danger', disabled?: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  border: variant === 'ghost' ? '1px solid #e2e8f0' : '1px solid transparent',
  background: variant === 'primary' ? '#0f172a' : variant === 'danger' ? '#fff1f2' : '#fff',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#9f1239' : '#0f172a',
});

/** Whole currency units ↔ minor units for the inputs. */
const toWhole = (minor: number | null | undefined) => (minor == null ? '' : String(Math.round(minor / 100)));
const toMinor = (whole: string): number | null => {
  if (whole.trim() === '') return null;
  const n = Number(whole.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

function RoleSelect({ value, onChange, ariaLabel }: { value: GlobalRole; onChange: (r: GlobalRole) => void; ariaLabel: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as GlobalRole)} style={field} aria-label={ariaLabel}>
      {ROLE_SENIORITY.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

function SignerFields({ signer, onChange, prefix }: { signer: ApprovalSigner; onChange: (s: ApprovalSigner) => void; prefix: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.2fr) minmax(150px, 1.4fr) minmax(140px, 1.4fr) minmax(140px, 1.2fr)', gap: 6, alignItems: 'center' }}>
      <input style={field} value={signer.label} onChange={(e) => onChange({ ...signer, label: e.target.value })} placeholder="Label" aria-label={`${prefix} label`} />
      <RoleSelect value={signer.approverRole} onChange={(approverRole) => onChange({ ...signer, approverRole })} ariaLabel={`${prefix} minimum role`} />
      <input style={field} value={signer.approverEmail ?? ''} onChange={(e) => onChange({ ...signer, approverEmail: e.target.value.trim() || null })} placeholder="Pin to email (optional)" aria-label={`${prefix} pinned email`} />
      <input style={field} value={signer.roleProfileId ?? ''} onChange={(e) => onChange({ ...signer, roleProfileId: e.target.value.trim() || null })} placeholder="Pin to role profile id (optional)" aria-label={`${prefix} pinned role profile`} />
    </div>
  );
}

export default function ApprovalRoutingSettingsPage() {
  const { dawinUser } = useCurrentDawinUser();
  const { config, exists, loading, error } = useApprovalRouting();
  const [draft, setDraft] = useState<ApprovalRoutingConfig>(() => clone(DEFAULT_APPROVAL_ROUTING));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ amount: string; purpose: ApprovalPurpose; tier: string }>({ amount: '250000', purpose: 'media', tier: '' });

  // Follow the live doc until the admin starts editing.
  useEffect(() => {
    if (!dirty) setDraft(clone(config));
  }, [config, dirty]);

  const module = draft.modules[SUPPLIER_SPEND] ?? clone(DEFAULT_APPROVAL_ROUTING.modules[SUPPLIER_SPEND]);
  const problems = useMemo(() => validateModule(module), [module]);

  const update = (patch: Partial<ApprovalModuleRoutingV2>) => {
    setDirty(true);
    setDraft((d) => ({ ...d, modules: { ...d.modules, [SUPPLIER_SPEND]: { ...(d.modules[SUPPLIER_SPEND] ?? module), ...patch } } }));
  };
  const updateBand = (i: number, patch: Partial<ApprovalBandV2>) => update({ bands: module.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const updatePurposeRule = (purpose: ApprovalPurpose, patch: Partial<PurposeRule>) => {
    const existing = module.purposeRules.find((r) => r.purpose === purpose);
    const next = existing
      ? module.purposeRules.map((r) => (r.purpose === purpose ? { ...r, ...patch } : r))
      : [...module.purposeRules, { id: purpose, purpose, label: PURPOSE_LABELS[purpose], primary: { label: 'Lead', approverRole: 'manager' as GlobalRole }, ...patch }];
    update({ purposeRules: next });
  };
  const updateAggregate = (i: number, patch: Partial<AggregateRule>) => update({ aggregateRules: module.aggregateRules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const previewDecision = useMemo(
    () => routingDecisionFor({ purpose: preview.purpose, amountMinor: toMinor(preview.amount) ?? 0, currency: module.currency, tier: preview.tier || undefined }, draft),
    [preview, draft, module.currency],
  );

  async function save() {
    if (!dawinUser?.uid) {
      pushToast('Sign in to save routing rules.', { tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await saveApprovalRouting(draft, dawinUser.uid);
      setDirty(false);
      pushToast('Approval routing saved. Cloud Functions pick it up within a minute.', { tone: 'success' });
    } catch (err) {
      pushToast(describeCallableError(err, 'save the routing rules'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '0 0 32px', display: 'grid', gap: 16 }} data-testid="approval-routing-settings">
      <PageHero
        eyebrow="Settings · Approvals"
        title="Approval routing"
        body={
          <span data-testid="approval-routing-source">
            {loading
              ? 'Loading…'
              : exists
                ? 'Who signs supplier spend, by purpose and value. These rules are live; the Cloud Functions re-read them within a minute of a save.'
                : 'No routing document has been saved yet — the built-in Zeus ladder below is what the Cloud Functions are using. Save to make it explicit or change it.'}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={btn('ghost')}
              onClick={() => {
                setDraft(clone(DEFAULT_APPROVAL_ROUTING));
                setDirty(true);
              }}
              data-testid="approval-routing-reset"
            >
              Reset to defaults
            </button>
            <button type="button" style={btn('primary', saving || problems.length > 0 || !dirty)} disabled={saving || problems.length > 0 || !dirty} onClick={() => void save()} data-testid="approval-routing-save">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      />

      {error && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>Couldn’t load the routing rules: {error.message}</p>
      )}
      {problems.length > 0 && (
        <div data-testid="approval-routing-problems" style={{ color: '#991b1b', background: '#fee2e2', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
          <strong>Not saveable yet:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Module switches */}
      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={module.enabled} onChange={(e) => update({ enabled: e.target.checked })} /> Routing enabled
          </label>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={module.requirePurpose} onChange={(e) => update({ requirePurpose: e.target.checked })} /> A record must say what it is for
          </label>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={module.forbidSelfApproval} onChange={(e) => update({ forbidSelfApproval: e.target.checked })} /> The raiser never signs
          </label>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            Currency
            <input style={{ ...field, width: 60 }} value={module.currency} onChange={(e) => update({ currency: e.target.value.toUpperCase() })} aria-label="Threshold currency" />
          </label>
        </div>
        <p style={small}>
          Thresholds are compared against each record’s own amount with no FX conversion — the currency is a label for what you authored. A record in another currency routes as-is and is flagged.
        </p>
      </section>

      {/* Bands */}
      <section style={card}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Value bands &amp; signatures</h2>
          <button
            type="button"
            style={btn('ghost')}
            onClick={() => {
              const last = module.bands[module.bands.length - 1];
              const prevMax = module.bands.length > 1 ? module.bands[module.bands.length - 2].maxAmountMinor ?? 0 : 0;
              const inserted: ApprovalBandV2 = { id: `band_${Date.now()}`, label: 'New band', maxAmountMinor: prevMax * 2 || 100_00, signatures: clone(last.signatures) };
              update({ bands: [...module.bands.slice(0, -1), inserted, last] });
            }}
          >
            + Band below the top
          </button>
        </header>
        <p style={small}>Each band is an inclusive upper limit; the top band is unbounded. Authority may not fall as value rises, and a higher band never needs fewer signatures.</p>
        {module.bands.map((band, i) => {
          const isLast = i === module.bands.length - 1;
          return (
            <div key={band.id} style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }} data-testid={`band-${band.id}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(140px, 0.8fr) auto', gap: 8, alignItems: 'center' }}>
                <input style={field} value={band.label} onChange={(e) => updateBand(i, { label: e.target.value })} aria-label={`Band ${i + 1} label`} />
                {isLast ? (
                  <span style={small}>{describeRange(module.bands, i, module.currency)}</span>
                ) : (
                  <label style={{ ...small, display: 'flex', gap: 6, alignItems: 'center' }}>
                    up to
                    <input style={{ ...field, width: 120 }} value={toWhole(band.maxAmountMinor)} onChange={(e) => updateBand(i, { maxAmountMinor: toMinor(e.target.value) })} aria-label={`Band ${i + 1} upper limit`} inputMode="numeric" />
                    {module.currency}
                  </label>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    style={btn('ghost')}
                    onClick={() => updateBand(i, { signatures: [...band.signatures, { level: band.signatures.length + 1, label: 'Additional signer', approverRole: band.signatures[band.signatures.length - 1]?.approverRole ?? 'admin' }] })}
                  >
                    + Signature
                  </button>
                  {!isLast && module.bands.length > 1 && (
                    <button type="button" style={btn('danger')} onClick={() => update({ bands: module.bands.filter((_, j) => j !== i) })}>
                      Remove band
                    </button>
                  )}
                </div>
              </div>
              {band.signatures
                .slice()
                .sort((a, b) => a.level - b.level)
                .map((sig, j) => (
                  <div key={sig.level} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 8, alignItems: 'center' }}>
                    <span style={{ ...small, fontWeight: 600 }}>L{sig.level}</span>
                    <SignerFields signer={sig} prefix={`Band ${i + 1} level ${sig.level}`} onChange={(s) => updateBand(i, { signatures: band.signatures.map((x) => (x.level === sig.level ? { ...x, ...s } : x)) })} />
                    <button
                      type="button"
                      style={btn('ghost', band.signatures.length === 1)}
                      disabled={band.signatures.length === 1}
                      onClick={() =>
                        updateBand(i, {
                          signatures: band.signatures
                            .filter((_, k) => k !== j)
                            .sort((a, b) => a.level - b.level)
                            .map((x, k) => ({ ...x, level: k + 1 })),
                        })
                      }
                      aria-label={`Remove band ${i + 1} level ${sig.level}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
      </section>

      {/* Purpose rules */}
      <section style={card}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Who signs first, by purpose</h2>
        <p style={small}>The purpose names the level-1 signer in the lead band. It can only make level 1 more senior than the band asks, never less. Escalate to a more senior signer above an amount, or when the record is not linked to an engagement.</p>
        {PURPOSES.map((purpose) => {
          const rule = module.purposeRules.find((r) => r.purpose === purpose);
          return (
            <div key={purpose} style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }} data-testid={`purpose-${purpose}`}>
              <strong style={{ fontSize: 13 }}>{PURPOSE_LABELS[purpose]}</strong>
              {rule ? (
                <>
                  <SignerFields signer={rule.primary} prefix={`${PURPOSE_LABELS[purpose]} primary`} onChange={(primary) => updatePurposeRule(purpose, { primary })} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <label style={{ ...small, display: 'flex', gap: 6, alignItems: 'center' }}>
                      Escalate above
                      <input style={{ ...field, width: 120 }} value={toWhole(rule.escalateAboveMinor)} onChange={(e) => updatePurposeRule(purpose, { escalateAboveMinor: toMinor(e.target.value) })} inputMode="numeric" aria-label={`${PURPOSE_LABELS[purpose]} escalate above`} />
                      {module.currency}
                    </label>
                    <label style={{ ...small, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!rule.requireAnyLink} onChange={(e) => updatePurposeRule(purpose, { requireAnyLink: e.target.checked })} /> Escalate when not linked to an engagement
                    </label>
                    <button type="button" style={btn('ghost')} onClick={() => update({ purposeRules: module.purposeRules.filter((r) => r.purpose !== purpose) })}>
                      Remove rule
                    </button>
                  </div>
                  {(rule.escalateAboveMinor != null || rule.requireAnyLink) && (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span style={small}>Escalate to</span>
                      <SignerFields
                        signer={rule.escalateTo ?? { label: 'Brand MD', approverRole: 'admin' }}
                        prefix={`${PURPOSE_LABELS[purpose]} escalate-to`}
                        onChange={(escalateTo) => updatePurposeRule(purpose, { escalateTo })}
                      />
                    </div>
                  )}
                </>
              ) : (
                <button type="button" style={btn('ghost')} onClick={() => updatePurposeRule(purpose, {})}>
                  + Add a rule for {PURPOSE_LABELS[purpose].toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* Tier raise */}
      <section style={card}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Tier</h2>
        <p style={small}>How many bands a record climbs at the same amount, by the engagement’s brief tier. Tier-1 clients get one more pair of eyes by default.</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {TIERS.map((tier) => (
            <label key={tier} style={{ ...small, display: 'flex', gap: 6, alignItems: 'center' }}>
              {tier.replace('_', ' ')}
              <input
                type="number"
                min={0}
                step={1}
                style={{ ...field, width: 64 }}
                value={module.tierBandRaise?.[tier] ?? 0}
                onChange={(e) => update({ tierBandRaise: { ...module.tierBandRaise, [tier]: Number(e.target.value) } })}
                aria-label={`${tier} band raise`}
              />
              band(s)
            </label>
          ))}
        </div>
      </section>

      {/* Aggregate oversight */}
      <section style={card}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Aggregate oversight</h2>
          <button
            type="button"
            style={btn('ghost')}
            onClick={() =>
              update({
                aggregateRules: [
                  ...module.aggregateRules,
                  { id: `agg_${Date.now()}`, kind: 'supplier_rolling', label: 'Rolling supplier spend', thresholdMinor: 100_000_000, windowDays: 30, adds: { level: 2, label: 'Group Finance', approverRole: 'admin' } },
                ],
              })
            }
          >
            + Rule
          </button>
        </header>
        <p style={small}>Adds a signer when a running total trips — many small invoices to one supplier, an engagement nearing its ceiling. Off by default.</p>
        {module.aggregateRules.length === 0 && <span style={small}>No aggregate rules.</span>}
        {module.aggregateRules.map((rule, i) => (
          <div key={rule.id} style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(200px, 1fr) minmax(120px, 0.6fr) auto auto', gap: 8, alignItems: 'center' }}>
              <input style={field} value={rule.label} onChange={(e) => updateAggregate(i, { label: e.target.value })} aria-label={`Aggregate ${i + 1} label`} />
              <select style={field} value={rule.kind} onChange={(e) => updateAggregate(i, { kind: e.target.value as AggregateRule['kind'] })} aria-label={`Aggregate ${i + 1} kind`}>
                {AGGREGATE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {AGGREGATE_LABELS[k]}
                  </option>
                ))}
              </select>
              {rule.kind === 'master_job_budget_pct' ? (
                <label style={{ ...small, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="number" min={1} max={100} style={{ ...field, width: 70 }} value={rule.thresholdPct ?? ''} onChange={(e) => updateAggregate(i, { thresholdPct: Number(e.target.value) })} aria-label={`Aggregate ${i + 1} threshold percent`} /> %
                </label>
              ) : (
                <label style={{ ...small, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input style={{ ...field, width: 120 }} value={toWhole(rule.thresholdMinor)} onChange={(e) => updateAggregate(i, { thresholdMinor: toMinor(e.target.value) ?? 0 })} inputMode="numeric" aria-label={`Aggregate ${i + 1} threshold`} /> {module.currency}
                </label>
              )}
              {rule.kind === 'supplier_rolling' ? (
                <label style={{ ...small, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="number" min={1} style={{ ...field, width: 64 }} value={rule.windowDays ?? 30} onChange={(e) => updateAggregate(i, { windowDays: Number(e.target.value) })} aria-label={`Aggregate ${i + 1} window days`} /> days
                </label>
              ) : (
                <span />
              )}
              <button type="button" style={btn('danger')} onClick={() => update({ aggregateRules: module.aggregateRules.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 8, alignItems: 'center' }}>
              <label style={{ ...small, display: 'flex', gap: 4, alignItems: 'center' }}>
                adds L<input type="number" min={1} style={{ ...field, width: 44 }} value={rule.adds.level ?? 2} onChange={(e) => updateAggregate(i, { adds: { ...rule.adds, level: Number(e.target.value) } })} aria-label={`Aggregate ${i + 1} adds level`} />
              </label>
              <SignerFields signer={rule.adds} prefix={`Aggregate ${i + 1} signer`} onChange={(adds) => updateAggregate(i, { adds: { ...rule.adds, ...adds } })} />
            </div>
          </div>
        ))}
      </section>

      {/* Preview */}
      <section style={card} data-testid="approval-routing-preview">
        <h2 style={{ margin: 0, fontSize: 15 }}>Try it</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ ...small, display: 'flex', gap: 6, alignItems: 'center' }}>
            Amount
            <input style={{ ...field, width: 130 }} value={preview.amount} onChange={(e) => setPreview({ ...preview, amount: e.target.value })} inputMode="numeric" aria-label="Preview amount" /> {module.currency}
          </label>
          <label style={{ ...small, display: 'flex', gap: 6, alignItems: 'center' }}>
            Purpose
            <select style={field} value={preview.purpose} onChange={(e) => setPreview({ ...preview, purpose: e.target.value as ApprovalPurpose })} aria-label="Preview purpose">
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {PURPOSE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...small, display: 'flex', gap: 6, alignItems: 'center' }}>
            Tier
            <select style={field} value={preview.tier} onChange={(e) => setPreview({ ...preview, tier: e.target.value })} aria-label="Preview tier">
              <option value="">—</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
        {previewDecision.refusal ? (
          <p style={{ fontSize: 13, color: '#991b1b' }}>Refused: {previewDecision.refusal}</p>
        ) : previewDecision.enabled && previewDecision.signatures ? (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} data-testid="approval-routing-preview-signatures">
            {previewDecision.signatures.map((s) => (
              <li key={s.level}>
                <strong>{s.label}</strong> — at least {ROLE_LABELS[s.approverRole]}
                {s.approverEmail ? ` · pinned to ${s.approverEmail}` : ''}
                {s.roleProfileId ? ` · holders of ${s.roleProfileId}` : ''}
              </li>
            ))}
            <li style={{ listStyle: 'none', marginTop: 6, ...small }}>
              Band: {previewDecision.band?.label}
              {previewDecision.raisedByTier ? ` (raised ${previewDecision.raisedByTier} by tier)` : ''}
            </li>
          </ol>
        ) : (
          <p style={small}>Routing is disabled — the Cloud Functions fall back to the built-in ladder.</p>
        )}
      </section>
    </div>
  );
}
