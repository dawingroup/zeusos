/**
 * SocialPerformanceChart
 * Per-account followers + engagement bars for the active subsidiary.
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import type { SocialAccountSnapshot, SocialMediaAccount } from '../../../types';
import { SOCIAL_ACCOUNT_PLATFORMS } from '../../../types/social-account.types';

interface Props {
  snapshots: SocialAccountSnapshot[];
  accounts: SocialMediaAccount[];
  height?: number;
}

export function SocialPerformanceChart({ snapshots, accounts, height = 300 }: Props) {
  const data = useMemo(() => {
    const byAccount = new Map<string, SocialMediaAccount>();
    accounts.forEach((a) => byAccount.set(a.id, a));
    return snapshots
      .map((s) => {
        const account = byAccount.get(s.accountId);
        return {
          label:
            account?.displayName ||
            `${SOCIAL_ACCOUNT_PLATFORMS[s.platform]?.label || s.platform} (${s.accountId.slice(0, 6)})`,
          platform: s.platform,
          Followers: s.followers,
          'Engagement %': Number(((s.engagementRate || 0) * 100).toFixed(1)),
          color: SOCIAL_ACCOUNT_PLATFORMS[s.platform]?.color || '#888',
        };
      })
      .sort((a, b) => b.Followers - a.Followers);
  }, [snapshots, accounts]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
        No metrics yet. Add a tracked account and wait for the next 6h sync.
      </div>
    );
  }

  return (
    <SafeResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={-15} height={50} textAnchor="end" />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#888' }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="Followers" fill="#872E5C" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="right" dataKey="Engagement %" fill="#D97706" radius={[3, 3, 0, 0]} />
      </BarChart>
    </SafeResponsiveContainer>
  );
}
