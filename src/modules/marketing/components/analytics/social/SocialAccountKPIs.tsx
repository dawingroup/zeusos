/**
 * SocialAccountKPIs
 * Headline KPI cards for the active subsidiary's social presence.
 */

import { Users, TrendingUp, Heart, MessageCircle } from 'lucide-react';
import type { SocialAccountSnapshot } from '../../../types';

interface Props {
  snapshots: SocialAccountSnapshot[];
}

export function SocialAccountKPIs({ snapshots }: Props) {
  const followers = snapshots.reduce((sum, s) => sum + (s.followers || 0), 0);
  const followersDelta = snapshots.reduce((sum, s) => sum + (s.followersDelta || 0), 0);
  const avgEngagement =
    snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / snapshots.length
      : 0;
  const avgLikes =
    snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + (s.avgLikesPerPost || 0), 0) / snapshots.length
      : 0;
  const avgComments =
    snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + (s.avgCommentsPerPost || 0), 0) / snapshots.length
      : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card
        icon={Users}
        label="Total followers"
        value={followers.toLocaleString()}
        delta={
          followersDelta !== 0
            ? `${followersDelta > 0 ? '+' : ''}${followersDelta.toLocaleString()}`
            : undefined
        }
        deltaPositive={followersDelta > 0}
      />
      <Card
        icon={TrendingUp}
        label="Avg engagement"
        value={`${(avgEngagement * 100).toFixed(1)}%`}
      />
      <Card icon={Heart} label="Avg likes / post" value={Math.round(avgLikes).toLocaleString()} />
      <Card
        icon={MessageCircle}
        label="Avg comments / post"
        value={Math.round(avgComments).toLocaleString()}
      />
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  delta,
  deltaPositive,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {delta && (
          <span
            className={`text-xs font-medium ${
              deltaPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
