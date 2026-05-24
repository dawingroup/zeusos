/**
 * ModelPanel — read-only display of model-specific profile data
 * (agency, physical attributes, portfolio, specialties, rate card).
 *
 * Rendered on TalentProfilePage when `profile.type === 'MODEL'`. Empty
 * sub-sections are hidden.
 */

import type { TalentProfile } from '../types/talent-profile.types';

function formatMoney(minor: number | undefined, currency = 'UGX'): string {
  if (typeof minor !== 'number') return '—';
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

interface Props {
  profile: TalentProfile;
}

export function ModelPanel({ profile }: Props) {
  const m = profile.modelProfile;
  const currency = profile.currency ?? 'UGX';

  return (
    <div className="space-y-4" data-testid="model-panel">
      {/* Agency representation */}
      {m?.agency && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Agency</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Agency</dt>
              <dd>{m.agency.name}</dd>
            </div>
            {m.agency.contactName && (
              <div>
                <dt className="text-xs text-muted-foreground">Contact</dt>
                <dd>{m.agency.contactName}</dd>
              </div>
            )}
            {m.agency.contactEmail && (
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd>
                  <a href={`mailto:${m.agency.contactEmail}`} className="hover:underline">
                    {m.agency.contactEmail}
                  </a>
                </dd>
              </div>
            )}
            {m.agency.contactPhone && (
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd>{m.agency.contactPhone}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Physical attributes */}
      {m?.attributes && Object.keys(m.attributes).length > 0 && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Attributes</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            {typeof m.attributes.heightCm === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Height</dt>
                <dd>{m.attributes.heightCm} cm</dd>
              </div>
            )}
            {typeof m.attributes.bustCm === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Bust / Chest</dt>
                <dd>{m.attributes.bustCm} cm</dd>
              </div>
            )}
            {typeof m.attributes.waistCm === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Waist</dt>
                <dd>{m.attributes.waistCm} cm</dd>
              </div>
            )}
            {typeof m.attributes.hipsCm === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Hips</dt>
                <dd>{m.attributes.hipsCm} cm</dd>
              </div>
            )}
            {m.attributes.shoeSize && (
              <div>
                <dt className="text-xs text-muted-foreground">Shoe size</dt>
                <dd>{m.attributes.shoeSize}</dd>
              </div>
            )}
            {m.attributes.hairColor && (
              <div>
                <dt className="text-xs text-muted-foreground">Hair</dt>
                <dd>{m.attributes.hairColor}</dd>
              </div>
            )}
            {m.attributes.eyeColor && (
              <div>
                <dt className="text-xs text-muted-foreground">Eyes</dt>
                <dd>{m.attributes.eyeColor}</dd>
              </div>
            )}
            {m.attributes.skinTone && (
              <div>
                <dt className="text-xs text-muted-foreground">Skin tone</dt>
                <dd>{m.attributes.skinTone}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Specialties + languages */}
      {(m?.specialties?.length || m?.languages?.length) && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Specialty</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {m.specialties && m.specialties.length > 0 && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Specialties</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {m.specialties.map((s) => (
                    <span key={s} className="rounded bg-[var(--rag-blue-soft)] px-2 py-0.5 text-xs text-[var(--rag-blue)]">
                      {s}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {m.languages && m.languages.length > 0 && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Languages</dt>
                <dd>{m.languages.join(', ')}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Portfolio link */}
      {m?.portfolioStorageRef && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Portfolio</h2>
          <p className="font-mono text-xs text-muted-foreground" data-testid="model-portfolio-ref">
            {m.portfolioStorageRef}
          </p>
        </section>
      )}

      {/* Rate card */}
      {m?.rateCard && Object.keys(m.rateCard).length > 0 && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Rate card</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            {typeof m.rateCard.halfDayRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Half-day (≤4h)</dt>
                <dd className="font-medium">{formatMoney(m.rateCard.halfDayRateMinor, currency)}</dd>
              </div>
            )}
            {typeof m.rateCard.fullDayRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">Full-day (4–10h)</dt>
                <dd className="font-medium">{formatMoney(m.rateCard.fullDayRateMinor, currency)}</dd>
              </div>
            )}
            {typeof m.rateCard.usage12mRateMinor === 'number' && (
              <div>
                <dt className="text-xs text-muted-foreground">12-month buy-out</dt>
                <dd className="font-medium">{formatMoney(m.rateCard.usage12mRateMinor, currency)}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
