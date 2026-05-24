/**
 * TalentCard — compact card for a talent profile in a list or grid.
 */

import { Link } from 'react-router-dom';
import type { TalentProfile } from '../types/talent-profile.types';
import { TalentTypeBadge } from './TalentTypeBadge';

interface Props {
  profile: TalentProfile;
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE:      'bg-green-500',
  INACTIVE:    'bg-[var(--bg-sunken)]',
  BLACKLISTED: 'bg-red-500',
};

export function TalentCard({ profile }: Props) {
  return (
    <Link
      to={`/talent/${profile.id}`}
      className="flex items-center gap-3 rounded border bg-background p-3 hover:bg-muted/20 transition-colors"
    >
      <div
        className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[profile.status] ?? 'bg-[var(--bg-sunken)]'}`}
        title={profile.status}
      />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-sm">{profile.name}</p>
        <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
        {profile.roles.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {profile.roles.slice(0, 3).join(', ')}
            {profile.roles.length > 3 ? ` +${profile.roles.length - 3}` : ''}
          </p>
        )}
      </div>
      <TalentTypeBadge type={profile.type} />
    </Link>
  );
}
