/**
 * PostScheduler Component
 * Quick schedule / reschedule panel for social media posts.
 * Optional per-platform target-account picker — surfaced when accounts are passed.
 */

import { useEffect, useState } from 'react';
import { Clock, Calendar, Loader2, CheckCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import type { SocialMediaPost, SocialPlatform, SocialMediaAccount } from '../../types';
import { SOCIAL_PLATFORMS } from '../../constants';

interface PostSchedulerProps {
  postId: string;
  currentDate?: Date;
  /** When provided, scheduler renders a per-platform account picker. */
  post?: Pick<SocialMediaPost, 'platforms' | 'socialAccountIds'>;
  accounts?: SocialMediaAccount[];
  onSchedule: (
    postId: string,
    date: Date,
    socialAccountIds?: Partial<Record<SocialPlatform, string>>
  ) => Promise<void>;
  onClose: () => void;
}

const QUICK_SLOTS = [
  { label: 'Tomorrow 9 AM', getDate: () => getNextDate(9) },
  { label: 'Tomorrow 12 PM', getDate: () => getNextDate(12) },
  { label: 'Tomorrow 6 PM', getDate: () => getNextDate(18) },
  { label: 'Next Monday 9 AM', getDate: () => getNextMonday(9) },
];

function getNextDate(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function getNextMonday(hour: number): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export function PostScheduler({
  postId,
  currentDate,
  post,
  accounts,
  onSchedule,
  onClose,
}: PostSchedulerProps) {
  const [customDate, setCustomDate] = useState(
    currentDate
      ? new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : ''
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountSelections, setAccountSelections] = useState<
    Partial<Record<SocialPlatform, string>>
  >(post?.socialAccountIds || {});

  // Default-select the first connected account per platform on mount.
  useEffect(() => {
    if (!post?.platforms || !accounts) return;
    setAccountSelections((prev) => {
      const next = { ...prev };
      for (const platform of post.platforms) {
        if (!next[platform]) {
          const candidate = accounts.find(
            (a) => a.platform === platform && a.status === 'oauth_connected'
          );
          if (candidate) next[platform] = candidate.id;
        }
      }
      return next;
    });
  }, [post?.platforms, accounts]);

  const handleSchedule = async (date: Date) => {
    if (date <= new Date()) return;
    setError(null);

    if (post?.platforms?.length) {
      const missing = post.platforms.filter(
        (p) => !accountSelections[p]
      );
      // Allow Meta-only enforcement for now; soft-warn for other platforms.
      const metaMissing = missing.filter(
        (p) => p === 'facebook' || p === 'instagram'
      );
      if (metaMissing.length > 0) {
        setError(
          `Pick a connected account for: ${metaMissing.join(', ')}. Publishing will fail without it.`
        );
        return;
      }
    }

    setLoading(true);
    try {
      await onSchedule(postId, date, accountSelections);
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 text-center">
        <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-900">Post scheduled!</p>
      </div>
    );
  }

  const showPicker = Boolean(post?.platforms?.length && accounts);

  return (
    <div className="p-4 space-y-4 min-w-[320px]">
      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Clock className="h-4 w-4" /> Schedule Post
      </h4>

      {showPicker && (
        <div className="space-y-2 border-b border-gray-200 pb-3">
          <p className="text-xs font-medium text-gray-700">Publish to:</p>
          {post!.platforms.map((platform) => {
            const platformMeta = SOCIAL_PLATFORMS[platform];
            const candidates =
              accounts?.filter((a) => a.platform === platform) || [];
            const connectedCandidates = candidates.filter(
              (a) => a.status === 'oauth_connected'
            );
            return (
              <div key={platform} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: platformMeta?.color }}
                />
                <span className="text-xs text-gray-600 w-20 shrink-0">
                  {platformMeta?.label || platform}
                </span>
                {connectedCandidates.length > 0 ? (
                  <select
                    value={accountSelections[platform] || ''}
                    onChange={(e) =>
                      setAccountSelections((prev) => ({
                        ...prev,
                        [platform]: e.target.value || undefined,
                      }))
                    }
                    className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                  >
                    <option value="">— pick account —</option>
                    {connectedCandidates.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <RouterLink
                    to="/marketing/accounts"
                    className="flex-1 inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Not connected — set up <LinkIcon className="h-3 w-3" />
                  </RouterLink>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick slots */}
      <div className="space-y-1">
        {QUICK_SLOTS.map((slot) => {
          const date = slot.getDate();
          return (
            <button
              key={slot.label}
              onClick={() => handleSchedule(date)}
              disabled={loading}
              className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <span className="text-gray-700">{slot.label}</span>
              <span className="text-xs text-gray-400">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-200 pt-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">Custom date & time</label>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            onClick={() => customDate && handleSchedule(new Date(customDate))}
            disabled={!customDate || loading}
            className="flex items-center gap-1 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
        </div>
      )}
    </div>
  );
}

export default PostScheduler;
