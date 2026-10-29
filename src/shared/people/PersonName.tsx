import type { ReactNode } from 'react';
import { Skeleton } from '@/core/components/ui/skeleton';
import { usePeopleDirectory } from './usePeopleDirectory';

export interface PersonNameProps {
  /** Employee doc id, Firebase Auth uid, or email — whichever the writer stamped. */
  id: string | null | undefined;
  /** Shown when the directory has loaded and the id matches nobody. */
  fallback?: ReactNode;
  /** Shown while the directory is still loading. */
  loadingFallback?: ReactNode;
  /** Shown when there is no id at all. */
  empty?: ReactNode;
  withAvatar?: boolean;
  className?: string;
}

/**
 * Render a person reference by NAME.
 *
 * Rules, in order:
 *   - no id                → `empty` (default "—")
 *   - directory loading    → `loadingFallback` (default a short skeleton, never
 *                            "Unknown user": that flashes wrong text on every mount)
 *   - unresolved           → `fallback` (default "Unknown user") with the id in
 *                            the tooltip so support can still trace it
 *   - resolved             → the name, email in the tooltip
 *
 * It never renders the id or a slice of it as text.
 */
export function PersonName({
  id,
  fallback = 'Unknown user',
  loadingFallback,
  empty = '—',
  withAvatar = false,
  className,
}: PersonNameProps) {
  const { lookup, loading } = usePeopleDirectory();
  if (!id) return <span className={className}>{empty}</span>;

  const entry = lookup(id);
  if (!entry) {
    if (loading) {
      return (
        <span className={className} data-person-loading="">
          {loadingFallback ?? <Skeleton className="inline-block h-3 w-20 align-middle" />}
        </span>
      );
    }
    return (
      <span className={className} title={id} data-person-unresolved="">
        {fallback}
      </span>
    );
  }

  return (
    <span className={className} title={entry.email ?? id}>
      {withAvatar && (
        <span
          aria-hidden
          className="inline-flex items-center justify-center rounded-full bg-[var(--bg-sunken)] text-[10px] font-medium align-middle mr-1.5"
          style={{ width: 18, height: 18, overflow: 'hidden' }}
        >
          {entry.photoUrl ? (
            <img src={entry.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials(entry.name)
          )}
        </span>
      )}
      {entry.name}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export default PersonName;
