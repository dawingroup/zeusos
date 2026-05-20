import { cn } from '@/shared/lib/utils';

export interface AvatarPerson {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface AvatarGroupProps {
  people: AvatarPerson[];
  /** Maximum avatars to show before collapsing into `+N`. */
  max?: number;
  /** Avatar size — px. */
  size?: number;
  className?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Overlapping circular avatars with `+N` overflow chip.
 * Falls back to initials when no `avatarUrl` is provided.
 */
export function AvatarGroup({ people, max = 4, size = 28, className }: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((person, i) => (
        <div
          key={person.id}
          title={person.name}
          className="rounded-full overflow-hidden grid place-items-center text-[10.5px] font-semibold"
          style={{
            height: size,
            width: size,
            marginLeft: i === 0 ? 0 : -8,
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '2px solid var(--bg-surface)',
            zIndex: visible.length - i,
          }}
        >
          {person.avatarUrl ? (
            <img
              src={person.avatarUrl}
              alt={person.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initials(person.name)}</span>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="rounded-full grid place-items-center text-[10.5px] font-semibold"
          style={{
            height: size,
            width: size,
            marginLeft: -8,
            backgroundColor: 'var(--bg-sunken)',
            color: 'var(--fg-secondary)',
            border: '2px solid var(--bg-surface)',
          }}
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
