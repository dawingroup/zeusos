/**
 * /talent/new — add a new talent profile to the roster.
 *
 * Single form, kind-aware. Common fields (name, email, type, status,
 * subsidiary, daily rate) are always visible. When `type` flips to
 * INFLUENCER or MODEL the kind-specific fieldset becomes available
 * (rate cards, social handles, agency, attributes). FREELANCER/STAFF
 * use only the common fields plus a free-form roles list.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { SUBSIDIARY_IDS } from '@/core/settings/types';
import { createTalentProfile } from '../services/talent-profile.service';
import type {
  TalentType,
  TalentStatus,
  SocialHandle,
  SocialPlatform,
  InfluencerProfile,
  ModelProfile,
} from '../types/talent-profile.types';

const TYPE_OPTIONS: TalentType[] = ['STAFF', 'FREELANCER', 'INFLUENCER', 'MODEL'];
const STATUS_OPTIONS: TalentStatus[] = ['ACTIVE', 'INACTIVE', 'BLACKLISTED'];
const CURRENCIES = ['UGX', 'USD', 'KES', 'EUR', 'GBP'] as const;
const PLATFORMS: SocialPlatform[] = [
  'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITTER_X', 'FACEBOOK', 'LINKEDIN', 'TWITCH', 'SNAPCHAT',
];

function toMinor(major: string): number | undefined {
  if (!major.trim()) return undefined;
  const n = Number(major);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

export default function TalentCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid ?? 'unknown-user';

  // ── Common fields ─────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<TalentType>('FREELANCER');
  const [status, setStatus] = useState<TalentStatus>('ACTIVE');
  const [subsidiaryOrgId, setSubsidiaryOrgId] = useState<string>('');
  const [rolesCsv, setRolesCsv] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>('UGX');
  const [ndaStorageRef, setNdaStorageRef] = useState('');
  const [notes, setNotes] = useState('');

  // ── Influencer-specific ────────────────────────────────────────────
  const [niches, setNiches] = useState('');
  const [postRate, setPostRate] = useState('');
  const [storyRate, setStoryRate] = useState('');
  const [reelRate, setReelRate] = useState('');
  const [exclusivityNotes, setExclusivityNotes] = useState('');
  const [socials, setSocials] = useState<SocialHandle[]>([]);

  // ── Model-specific ─────────────────────────────────────────────────
  const [agencyName, setAgencyName] = useState('');
  const [agencyContactEmail, setAgencyContactEmail] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [halfDayRate, setHalfDayRate] = useState('');
  const [fullDayRate, setFullDayRate] = useState('');
  const [usage12mRate, setUsage12mRate] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showInfluencer = type === 'INFLUENCER';
  const showModel = type === 'MODEL';

  // SUBSIDIARY_IDS includes `zeus-group` (parent) — strip it for the
  // affiliation picker; talent belongs to a sub-brand, never the parent.
  const subsidiaryOptions = useMemo(
    () => SUBSIDIARY_IDS.filter((s) => s !== 'zeus-group'),
    [],
  );

  function addSocial() {
    setSocials((prev) => [
      ...prev,
      { platform: 'INSTAGRAM', handle: '', url: '' },
    ]);
  }
  function updateSocial(idx: number, patch: Partial<SocialHandle>) {
    setSocials((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeSocial(idx: number) {
    setSocials((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }

    setSaving(true);
    try {
      const roles = rolesCsv
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      const influencerProfile: InfluencerProfile | undefined = showInfluencer
        ? {
            niches: niches
              .split(',')
              .map((n) => n.trim())
              .filter(Boolean),
            rateCard: {
              postRateMinor:  toMinor(postRate),
              storyRateMinor: toMinor(storyRate),
              reelRateMinor:  toMinor(reelRate),
            },
            exclusivityNotes: exclusivityNotes.trim() || undefined,
          }
        : undefined;

      const modelProfile: ModelProfile | undefined = showModel
        ? {
            agency: agencyName.trim()
              ? {
                  name: agencyName.trim(),
                  contactEmail: agencyContactEmail.trim() || undefined,
                }
              : undefined,
            attributes: heightCm
              ? { heightCm: Number(heightCm) }
              : undefined,
            specialties: specialties
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            rateCard: {
              halfDayRateMinor: toMinor(halfDayRate),
              fullDayRateMinor: toMinor(fullDayRate),
              usage12mRateMinor: toMinor(usage12mRate),
            },
          }
        : undefined;

      // Social handles useful for INFLUENCER primarily but accept on any type
      // that filled them in. Drop blank-handle rows so we don't persist noise.
      const socialHandles = socials.filter((s) => s.handle.trim());

      const created = await createTalentProfile({
        name: name.trim(),
        email: email.trim(),
        type,
        status,
        roles,
        subsidiaryOrgId: subsidiaryOrgId || undefined,
        dailyRateMinor: toMinor(dailyRate),
        currency: dailyRate ? currency : undefined,
        ndaStorageRef: ndaStorageRef.trim() || undefined,
        notes: notes.trim() || undefined,
        influencerProfile,
        modelProfile,
        socialHandles: socialHandles.length ? socialHandles : undefined,
        createdBy: userId,
      });

      navigate(`/talent/${created.id}`);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Add Talent</h1>
        <p className="text-sm text-muted-foreground">
          New profile for the roster. Pick a type — extra fields appear for influencers and models.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 rounded border bg-card p-5" data-testid="talent-form">
        {/* ── Identity ────────────────────────────────────────────── */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Identity</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
                data-testid="talent-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Email *</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
                data-testid="talent-email"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TalentType)}
                className="w-full rounded border px-2 py-1.5 text-sm"
                data-testid="talent-type"
              >
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TalentStatus)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Subsidiary affiliation</label>
              <select
                value={subsidiaryOrgId}
                onChange={(e) => setSubsidiaryOrgId(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                <option value="">— Unassigned —</option>
                {subsidiaryOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Roles</label>
              <input
                value={rolesCsv}
                onChange={(e) => setRolesCsv(e.target.value)}
                placeholder="copywriter, photographer (comma-separated)"
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </fieldset>

        {/* ── Rate ─────────────────────────────────────────────────── */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Generic day rate (fallback)</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Daily rate</label>
              <input
                type="number"
                min={0}
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder="e.g. 250000"
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Major units ({currency}). Optional — influencers/models usually rely on the rate card below.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as typeof CURRENCIES[number])}
                className="w-full rounded border px-2 py-1.5 text-sm"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        {/* ── Documents & notes ───────────────────────────────────── */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Documents</legend>
          <div>
            <label className="mb-1 block text-xs font-medium">NDA storage reference</label>
            <input
              value={ndaStorageRef}
              onChange={(e) => setNdaStorageRef(e.target.value)}
              placeholder="ndas/2026/jane-smith.pdf"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
        </fieldset>

        {/* ── Influencer-specific ─────────────────────────────────── */}
        {showInfluencer && (
          <fieldset className="space-y-3 rounded border border-violet-300 bg-violet-50/40 p-3">
            <legend className="px-1 text-sm font-medium text-violet-900">Influencer details</legend>

            <div>
              <label className="mb-1 block text-xs font-medium">Niches</label>
              <input
                value={niches}
                onChange={(e) => setNiches(e.target.value)}
                placeholder="fashion, beauty, lifestyle (comma-separated)"
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Post rate</label>
                <input
                  type="number" min={0}
                  value={postRate}
                  onChange={(e) => setPostRate(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Story rate</label>
                <input
                  type="number" min={0}
                  value={storyRate}
                  onChange={(e) => setStoryRate(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Reel rate</label>
                <input
                  type="number" min={0}
                  value={reelRate}
                  onChange={(e) => setReelRate(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Exclusivity / brand-conflict notes</label>
              <input
                value={exclusivityNotes}
                onChange={(e) => setExclusivityNotes(e.target.value)}
                placeholder="No FMCG competitor within 90 days of post."
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium">Social handles</label>
                <button
                  type="button"
                  onClick={addSocial}
                  className="rounded border px-2 py-0.5 text-xs"
                  data-testid="talent-add-social"
                >
                  + Add handle
                </button>
              </div>
              {socials.length === 0 && (
                <p className="text-xs text-muted-foreground">No handles yet.</p>
              )}
              <div className="space-y-2">
                {socials.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      value={s.platform}
                      onChange={(e) => updateSocial(idx, { platform: e.target.value as SocialPlatform })}
                      className="col-span-3 rounded border px-2 py-1 text-xs"
                    >
                      {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input
                      value={s.handle}
                      onChange={(e) => updateSocial(idx, { handle: e.target.value })}
                      placeholder="@handle"
                      className="col-span-3 rounded border px-2 py-1 text-xs"
                    />
                    <input
                      value={s.url ?? ''}
                      onChange={(e) => updateSocial(idx, { url: e.target.value })}
                      placeholder="https://…"
                      className="col-span-5 rounded border px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeSocial(idx)}
                      className="col-span-1 text-xs text-[var(--rag-red)] hover:underline"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </fieldset>
        )}

        {/* ── Model-specific ──────────────────────────────────────── */}
        {showModel && (
          <fieldset className="space-y-3 rounded border border-pink-300 bg-pink-50/40 p-3">
            <legend className="px-1 text-sm font-medium text-pink-900">Model details</legend>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Agency name</label>
                <input
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Leave blank if freelance"
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Agency contact email</label>
                <input
                  type="email"
                  value={agencyContactEmail}
                  onChange={(e) => setAgencyContactEmail(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Height (cm)</label>
                <input
                  type="number" min={0}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Specialties</label>
                <input
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                  placeholder="runway, editorial, commercial"
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Half-day rate</label>
                <input
                  type="number" min={0}
                  value={halfDayRate}
                  onChange={(e) => setHalfDayRate(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Full-day rate</label>
                <input
                  type="number" min={0}
                  value={fullDayRate}
                  onChange={(e) => setFullDayRate(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">12m usage buy-out</label>
                <input
                  type="number" min={0}
                  value={usage12mRate}
                  onChange={(e) => setUsage12mRate(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </fieldset>
        )}

        {error && <p className="text-sm text-destructive" data-testid="talent-form-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/talent')}
            className="rounded border px-4 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
            data-testid="talent-submit"
          >
            {saving ? 'Saving…' : 'Create profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
