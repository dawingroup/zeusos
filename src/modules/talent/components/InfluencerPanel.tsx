/**
 * InfluencerPanel — read-only display of influencer-specific profile data
 * (social handles, niches, audience demographics, rate card).
 *
 * Rendered on TalentProfilePage when `profile.type === 'INFLUENCER'`. Empty
 * sub-sections are hidden so a thin profile (e.g. just two handles) doesn't
 * render six empty panels.
 */

import type { TalentProfile, SocialHandle } from '../types/talent-profile.types';

function formatMoney(minor: number | undefined, currency = 'UGX'): string {
  if (typeof minor !== 'number') return '—';
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatPct(value: number | undefined): string {
  if (typeof value !== 'number') return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatCount(n: number | undefined): string {
  if (typeof n !== 'number') return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const PLATFORM_LABEL: Record<SocialHandle['platform'], string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK:    'TikTok',
  YOUTUBE:   'YouTube',
  TWITTER_X: 'X',
  FACEBOOK:  'Facebook',
  LINKEDIN:  'LinkedIn',
  TWITCH:    'Twitch',
  SNAPCHAT:  'Snapchat',
};

interface Props {
  profile: TalentProfile;
}

export function InfluencerPanel({ profile }: Props) {
  const inf = profile.influencerProfile;
  const handles = profile.socialHandles ?? [];
  const currency = profile.currency ?? 'UGX';

  return (
    <div className="space-y-4" data-testid="influencer-panel">
      {/* Headline metrics */}
      <section className="rounded border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Reach</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Total followers</dt>
            <dd className="font-medium" data-testid="influencer-total-followers">
              {formatCount(inf?.totalFollowerCount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Platforms</dt>
            <dd>{handles.length}</dd>
          </div>
          {inf?.niches && inf.niches.length > 0 && (
            <div className="col-span-2 md:col-span-3">
              <dt className="text-xs text-muted-foreground">Niches</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {inf.niches.map((n) => (
                  <span key={n} className="rounded bg-pink-100 px-2 py-0.5 text-xs text-pink-800">
                    {n}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Social handles */}
      {handles.length > 0 && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Social handles</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-1 font-medium">Platform</th>
                  <th className="py-1 font-medium">Handle</th>
                  <th className="py-1 text-right font-medium">Followers</th>
                  <th className="py-1 text-right font-medium">Monthly reach</th>
                  <th className="py-1 text-right font-medium">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {handles.map((h, i) => (
                  <tr key={`${h.platform}-${i}`} className="border-t">
                    <td className="py-1">{PLATFORM_LABEL[h.platform]}</td>
                    <td className="py-1">
                      {h.url ? (
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-700 hover:underline"
                        >
                          {h.handle}
                        </a>
                      ) : (
                        <span>{h.handle}</span>
                      )}
                    </td>
                    <td className="py-1 text-right">{formatCount(h.followerCount)}</td>
                    <td className="py-1 text-right text-muted-foreground">
                      {formatCount(h.monthlyReach)}
                    </td>
                    <td className="py-1 text-right text-muted-foreground">
                      {formatPct(h.engagementRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Audience demographics */}
      {inf?.audienceDemographics && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Audience</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            {inf.audienceDemographics.primaryCountry && (
              <div>
                <dt className="text-xs text-muted-foreground">Primary country</dt>
                <dd>{inf.audienceDemographics.primaryCountry}</dd>
              </div>
            )}
            {inf.audienceDemographics.primaryAgeBracket && (
              <div>
                <dt className="text-xs text-muted-foreground">Primary age</dt>
                <dd>{inf.audienceDemographics.primaryAgeBracket}</dd>
              </div>
            )}
            {inf.audienceDemographics.topCities && inf.audienceDemographics.topCities.length > 0 && (
              <div className="col-span-2 md:col-span-3">
                <dt className="text-xs text-muted-foreground">Top cities</dt>
                <dd>{inf.audienceDemographics.topCities.join(', ')}</dd>
              </div>
            )}
            {inf.audienceDemographics.languages && inf.audienceDemographics.languages.length > 0 && (
              <div className="col-span-2 md:col-span-3">
                <dt className="text-xs text-muted-foreground">Languages</dt>
                <dd>{inf.audienceDemographics.languages.join(', ')}</dd>
              </div>
            )}
            {inf.audienceDemographics.audienceSplit && (
              <div className="col-span-2 md:col-span-3">
                <dt className="text-xs text-muted-foreground">Audience split</dt>
                <dd className="text-xs">
                  Female {formatPct(inf.audienceDemographics.audienceSplit.female)} ·{' '}
                  Male {formatPct(inf.audienceDemographics.audienceSplit.male)}
                  {typeof inf.audienceDemographics.audienceSplit.nonBinary === 'number' && (
                    <> · Non-binary {formatPct(inf.audienceDemographics.audienceSplit.nonBinary)}</>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Rate card */}
      {inf?.rateCard && Object.keys(inf.rateCard).length > 0 && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Rate card</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            {typeof inf.rateCard.postRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">In-feed post</dt>
                <dd className="font-medium">{formatMoney(inf.rateCard.postRateMinor, currency)}</dd>
              </div>
            )}
            {typeof inf.rateCard.storyRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Story</dt>
                <dd className="font-medium">{formatMoney(inf.rateCard.storyRateMinor, currency)}</dd>
              </div>
            )}
            {typeof inf.rateCard.reelRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Reel / Short</dt>
                <dd className="font-medium">{formatMoney(inf.rateCard.reelRateMinor, currency)}</dd>
              </div>
            )}
            {typeof inf.rateCard.longFormVideoRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Long-form video</dt>
                <dd className="font-medium">{formatMoney(inf.rateCard.longFormVideoRateMinor, currency)}</dd>
              </div>
            )}
            {typeof inf.rateCard.appearanceRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Appearance</dt>
                <dd className="font-medium">{formatMoney(inf.rateCard.appearanceRateMinor, currency)}</dd>
              </div>
            )}
            {typeof inf.rateCard.bundleRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Bundle</dt>
                <dd className="font-medium">{formatMoney(inf.rateCard.bundleRateMinor, currency)}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Manager / exclusivity */}
      {(inf?.managerContact || inf?.exclusivityNotes) && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Management</h2>
          {inf?.managerContact && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
              {inf.managerContact.name && (
                <div>
                  <dt className="text-xs text-muted-foreground">Manager</dt>
                  <dd>{inf.managerContact.name}</dd>
                </div>
              )}
              {inf.managerContact.agency && (
                <div>
                  <dt className="text-xs text-muted-foreground">Agency</dt>
                  <dd>{inf.managerContact.agency}</dd>
                </div>
              )}
              {inf.managerContact.email && (
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd>
                    <a href={`mailto:${inf.managerContact.email}`} className="hover:underline">
                      {inf.managerContact.email}
                    </a>
                  </dd>
                </div>
              )}
              {inf.managerContact.phone && (
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd>{inf.managerContact.phone}</dd>
                </div>
              )}
            </dl>
          )}
          {inf?.exclusivityNotes && (
            <div className="mt-3 rounded bg-muted/50 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Exclusivity / brand conflicts</p>
              <p className="mt-1 whitespace-pre-line">{inf.exclusivityNotes}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
