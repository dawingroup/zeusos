/**
 * SocialAccountsPage
 * Registry of subsidiary-owned social media pages used for tracking and (in Phase 2) publishing.
 */

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useSocialAccounts } from '../hooks/useSocialAccounts';
import { useSocialAccountInsights } from '../hooks/useSocialAccountInsights';
import {
  startMetaOAuth,
  disconnectMetaAccount,
} from '../services/socialAccountService';
import type {
  SocialMediaAccount,
  SocialAccountPlatform,
  SocialAccountFormData,
} from '../types';
import {
  SOCIAL_ACCOUNT_PLATFORMS,
  SOCIAL_ACCOUNT_STATUSES,
} from '../types/social-account.types';
import {
  Plus,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  RefreshCw,
  Users,
  TrendingUp,
  X,
  Plug,
  PlugZap,
} from 'lucide-react';

type DraftAccount = Omit<SocialAccountFormData, 'subsidiaryId'>;

const EMPTY_DRAFT: DraftAccount = {
  platform: 'instagram',
  displayName: '',
  handle: '',
  profileUrl: '',
  trackingEnabled: true,
};

export default function SocialAccountsPage() {
  const { user } = useAuth();
  const { currentSubsidiary } = useSubsidiary();
  const { accounts, loading, error, create, toggleTracking, remove } = useSocialAccounts(
    currentSubsidiary?.id,
    user?.email || undefined
  );
  const { snapshots } = useSocialAccountInsights(currentSubsidiary?.id);

  const [showAddModal, setShowAddModal] = useState(false);
  const [draft, setDraft] = useState<DraftAccount>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const snapshotsByAccount = useMemo(() => {
    const map = new Map<string, (typeof snapshots)[number]>();
    snapshots.forEach((s) => map.set(s.accountId, s));
    return map;
  }, [snapshots]);

  const accountsByPlatform = useMemo(() => {
    const grouped: Partial<Record<SocialAccountPlatform, SocialMediaAccount[]>> = {};
    accounts.forEach((a) => {
      const list = grouped[a.platform] || [];
      list.push(a);
      grouped[a.platform] = list;
    });
    return grouped;
  }, [accounts]);

  if (!currentSubsidiary) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
        Select a subsidiary to manage its social media accounts.
      </div>
    );
  }

  const totalFollowers = snapshots.reduce((sum, s) => sum + (s.followers || 0), 0);
  const avgEngagementRate =
    snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / snapshots.length
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.displayName || !draft.handle || !draft.profileUrl) {
      setSubmitError('Display name, handle, and profile URL are required.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await create(draft);
      setShowAddModal(false);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Accounts</h1>
          <p className="text-muted-foreground">
            Track and publish to{' '}
            <span style={{ color: currentSubsidiary.color }} className="font-medium">
              {currentSubsidiary.name}
            </span>{' '}
            social media pages
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add account
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI
          label="Accounts tracked"
          value={accounts.filter((a) => a.trackingEnabled).length}
          icon={RefreshCw}
        />
        <KPI label="Total accounts" value={accounts.length} icon={ExternalLink} />
        <KPI
          label="Total followers"
          value={totalFollowers.toLocaleString()}
          icon={Users}
        />
        <KPI
          label="Avg engagement"
          value={`${(avgEngagementRate * 100).toFixed(1)}%`}
          icon={TrendingUp}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ExternalLink className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No social accounts yet</h3>
          <p className="text-gray-500 mt-1 mb-4">
            Add your subsidiary's social media pages to start tracking performance and posting.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Add your first account
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {(Object.entries(SOCIAL_ACCOUNT_PLATFORMS) as [
            SocialAccountPlatform,
            { label: string; color: string }
          ][]).map(([platform, meta]) => {
            const list = accountsByPlatform[platform] || [];
            if (list.length === 0) return null;
            return (
              <div
                key={platform}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <div
                  className="px-4 py-2 border-b border-gray-200 flex items-center gap-2"
                  style={{ backgroundColor: `${meta.color}10` }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <h3 className="font-medium text-gray-900">{meta.label}</h3>
                  <span className="text-xs text-gray-500">({list.length})</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {list.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      snapshot={snapshotsByAccount.get(account.id)}
                      onToggleTracking={() =>
                        toggleTracking(account.id, !account.trackingEnabled)
                      }
                      onRemove={() => {
                        if (
                          window.confirm(
                            `Remove ${account.displayName}? Historical analytics remain in BigQuery.`
                          )
                        ) {
                          void remove(account.id);
                        }
                      }}
                      onConnectOAuth={async () => {
                        const result = await startMetaOAuth(account.id);
                        if (result.status === 'error') {
                          window.alert(`Connection failed: ${result.message}`);
                        }
                      }}
                      onDisconnectOAuth={async () => {
                        if (
                          window.confirm(
                            `Disconnect publishing for ${account.displayName}? Tracked metrics keep working.`
                          )
                        ) {
                          await disconnectMetaAccount(account.id);
                        }
                      }}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add social account</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <Field label="Platform">
                <select
                  value={draft.platform}
                  onChange={(e) =>
                    setDraft({ ...draft, platform: e.target.value as SocialAccountPlatform })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  {(Object.entries(SOCIAL_ACCOUNT_PLATFORMS) as [
                    SocialAccountPlatform,
                    { label: string }
                  ][]).map(([p, meta]) => (
                    <option key={p} value={p}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Display name">
                <input
                  type="text"
                  required
                  value={draft.displayName}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  placeholder="e.g. Zeus Group Instagram"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Handle">
                <input
                  type="text"
                  required
                  value={draft.handle}
                  onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                  placeholder="@dawinfinishes"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Profile URL">
                <input
                  type="url"
                  required
                  value={draft.profileUrl}
                  onChange={(e) => setDraft({ ...draft, profileUrl: e.target.value })}
                  placeholder="https://instagram.com/dawinfinishes"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.trackingEnabled !== false}
                  onChange={(e) =>
                    setDraft({ ...draft, trackingEnabled: e.target.checked })
                  }
                />
                Enable tracking (scrapes public metrics every 6h)
              </label>
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-red-800 text-xs">
                  {submitError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Adding…' : 'Add account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountRow({
  account,
  snapshot,
  onToggleTracking,
  onRemove,
  onConnectOAuth,
  onDisconnectOAuth,
}: {
  account: SocialMediaAccount;
  snapshot: ReturnType<typeof useSocialAccountInsights>['snapshots'][number] | undefined;
  onToggleTracking: () => void;
  onRemove: () => void;
  onConnectOAuth: () => void | Promise<void>;
  onDisconnectOAuth: () => void | Promise<void>;
}) {
  const statusMeta = SOCIAL_ACCOUNT_STATUSES[account.status];
  const followers = snapshot?.followers ?? 0;
  const followersDelta = snapshot?.followersDelta ?? 0;
  const engagementRate = snapshot?.engagementRate ?? 0;
  const lastSyncedAt = account.lastSyncedAt?.toDate();
  const isMetaPlatform = account.platform === 'facebook' || account.platform === 'instagram';
  const isConnected = account.status === 'oauth_connected';
  const isExpired = account.status === 'oauth_expired';

  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 truncate">{account.displayName}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusMeta.badgeClass}`}>
            {statusMeta.label}
          </span>
        </div>
        <a
          href={account.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-primary inline-flex items-center gap-1"
        >
          @{account.handle}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="hidden sm:flex flex-col items-end text-xs text-gray-500 min-w-[100px]">
        <span className="font-semibold text-gray-900 text-sm">
          {followers.toLocaleString()}
        </span>
        <span>
          followers
          {followersDelta !== 0 && (
            <span className={followersDelta > 0 ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
              {followersDelta > 0 ? '+' : ''}
              {followersDelta}
            </span>
          )}
        </span>
      </div>
      <div className="hidden md:flex flex-col items-end text-xs text-gray-500 min-w-[90px]">
        <span className="font-semibold text-gray-900 text-sm">
          {(engagementRate * 100).toFixed(1)}%
        </span>
        <span>engagement</span>
      </div>
      <div className="hidden lg:block text-xs text-gray-400 min-w-[110px] text-right">
        {lastSyncedAt
          ? `synced ${lastSyncedAt.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}`
          : 'never synced'}
      </div>
      {isMetaPlatform && !isConnected && (
        <button
          onClick={() => void onConnectOAuth()}
          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5"
          title="Connect to publish"
        >
          <Plug className="h-3.5 w-3.5" />
          {isExpired ? 'Reconnect' : 'Connect'}
        </button>
      )}
      {isMetaPlatform && isConnected && (
        <button
          onClick={() => void onDisconnectOAuth()}
          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100"
          title="Disconnect publishing"
        >
          <PlugZap className="h-3.5 w-3.5" />
          Connected
        </button>
      )}
      <button
        onClick={onToggleTracking}
        className="p-1.5 hover:bg-gray-100 rounded-lg"
        title={account.trackingEnabled ? 'Pause tracking' : 'Resume tracking'}
      >
        {account.trackingEnabled ? (
          <Pause className="h-4 w-4 text-gray-500" />
        ) : (
          <Play className="h-4 w-4 text-gray-500" />
        )}
      </button>
      <button
        onClick={onRemove}
        className="p-1.5 hover:bg-red-50 rounded-lg"
        title="Remove"
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </button>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
