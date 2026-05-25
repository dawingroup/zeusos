/**
 * Placeholder page for navigation manifest entries whose backing
 * module ships in a later Phase 6.UI PR. Picks up its label + PR
 * number from props and renders a card with the brief link in
 * `docs/PHASE_6_INTELLIGENCE_LAYER.md` for context.
 *
 * Routes that mount this page get replaced as each follow-up PR
 * lands — Traffic (PR 2), Conflict Firewall (PR 3), ECD Review +
 * Active Work (PR 4), Role Profiles + Role Assignments (PR 6). Burn
 * & SLA and Reports stay placeholders for now.
 */

import { Sparkles } from 'lucide-react';

interface ComingSoonPageProps {
  /** Display title — e.g. "Traffic", "Conflict Firewall". */
  title: string;
  /** Which Phase 6.UI PR replaces this placeholder. */
  shipsIn: string;
  /** One-line description of what this surface will do. */
  description?: string;
}

export function ComingSoonPage({ title, shipsIn, description }: ComingSoonPageProps) {
  return (
    <div className="p-6" data-testid="coming-soon-page">
      <div className="max-w-2xl mx-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] mb-4">
          <Sparkles className="h-6 w-6 text-[var(--accent)]" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--fg-primary)] mb-2">{title}</h1>
        <p className="text-sm text-[var(--fg-secondary)] mb-4">
          Coming in <strong>{shipsIn}</strong>.
        </p>
        {description && (
          <p className="text-sm text-[var(--fg-tertiary)] mb-4 max-w-md mx-auto">
            {description}
          </p>
        )}
        <p className="text-xs text-[var(--fg-tertiary)]">
          See <code className="font-mono">docs/PHASE_6_INTELLIGENCE_LAYER.md</code> for the full design.
        </p>
      </div>
    </div>
  );
}

export default ComingSoonPage;
