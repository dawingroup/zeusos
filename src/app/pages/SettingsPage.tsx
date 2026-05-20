/**
 * DawinOS Global Settings Page
 * Tab-based settings for organization, users, and access control
 */

import { useState, useRef, useMemo } from 'react';

// Adobe DC View SDK type declaration
declare global {
  interface Window {
    AdobeDC?: {
      View: new (config: { clientId: string; divId: string }) => {
        previewFile: (
          content: { content: { location: { url: string } }; metaData: { fileName: string } },
          config: Record<string, unknown>
        ) => Promise<void>;
      };
    };
  }
}
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  Shield,
  FileText,
  Palette,
  Globe,
  Clock,
  Mail,
  UserPlus,
  Check,
  X,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Plug,
  Box,
  DollarSign,
  MessagesSquare,
  HardHat,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/core/hooks/useAuth';
import {
  useOrganizationSettings,
  useUsers,
  useCurrentDawinUser,
  useUserMutations,
  createUser,
  GLOBAL_ROLE_DEFINITIONS,
  type DawinUser,
  type GlobalRole,
  type SubsidiaryAccess,
} from '@/core/settings';
import { PlatformBrandingSettings } from '@/shared/components/branding/PlatformBrandingSettings';
import { WorkshopProcessingRatesSection } from '@/shared/components/settings/WorkshopProcessingRatesSection';
import SubsidiaryBranding from '@/shared/components/admin/SubsidiaryBranding';
import { SubsidiaryAccessEditor } from '@/pages/admin/components/SubsidiaryAccessEditor';
import { useEmployeeList } from '@/modules/hr-central/hooks/useEmployee';

type Tab = 'general' | 'branding' | 'subsidiaries' | 'users' | 'access' | 'integrations' | 'modules' | 'templates';

const tabs = [
  { id: 'general' as Tab, label: 'General', icon: Building2 },
  { id: 'branding' as Tab, label: 'Branding', icon: Palette },
  { id: 'subsidiaries' as Tab, label: 'Subsidiaries', icon: Building2 },
  { id: 'users' as Tab, label: 'Users', icon: Users },
  { id: 'access' as Tab, label: 'Access Control', icon: Shield },
  { id: 'integrations' as Tab, label: 'Integrations', icon: Plug },
  { id: 'modules' as Tab, label: 'Modules', icon: Box },
  { id: 'templates' as Tab, label: 'Templates', icon: FileText, disabled: true },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const { user } = useAuth();
  const { hasPermission } = useCurrentDawinUser();
  
  const canEditSettings = hasPermission('settings:edit');
  const canManageUsers = hasPermission('users:edit');

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Manage organization settings, users, and access control</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-[#872E5C] text-[#872E5C]'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                  tab.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.disabled && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {activeTab === 'general' && <GeneralTab canEdit={canEditSettings} />}
        {activeTab === 'branding' && <BrandingTab canEdit={canEditSettings} />}
        {activeTab === 'subsidiaries' && <SubsidiariesTab />}
        {activeTab === 'users' && <UsersTab canManage={canManageUsers} />}
        {activeTab === 'access' && <AccessControlTab canManage={canManageUsers} />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'modules' && <ModulesTab />}
        {activeTab === 'templates' && <TemplatesTab />}
      </div>
    </div>
  );
}

// ============================================================================
// GENERAL TAB
// ============================================================================

function GeneralTab({ canEdit }: { canEdit: boolean }) {
  const { settings, isLoading, updateSettings } = useOrganizationSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    email: '',
    phone: '',
    website: '',
    defaultCurrency: 'UGX',
    timezone: 'Africa/Kampala',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await updateSettings({
        info: {
          name: formData.name,
          shortName: formData.shortName,
          email: formData.email,
          phone: formData.phone,
          website: formData.website,
        },
        defaultCurrency: formData.defaultCurrency,
        timezone: formData.timezone,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Organization Information</h3>
        {canEdit && !isEditing && (
          <button
            onClick={() => {
              setFormData({
                name: settings?.info?.name || '',
                shortName: settings?.info?.shortName || '',
                email: settings?.info?.email || '',
                phone: settings?.info?.phone || '',
                website: settings?.info?.website || '',
                defaultCurrency: settings?.defaultCurrency || 'UGX',
                timezone: settings?.timezone || 'Africa/Kampala',
              });
              setIsEditing(true);
            }}
            className="text-sm text-[#872E5C] hover:text-[#6a2449]"
          >
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organization Name
          </label>
          {isEditing ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          ) : (
            <p className="text-gray-900">{settings?.info?.name || 'Not set'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Short Name
          </label>
          {isEditing ? (
            <input
              type="text"
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          ) : (
            <p className="text-gray-900">{settings?.info?.shortName || 'Not set'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Mail className="w-4 h-4 inline mr-1" />
            Email
          </label>
          {isEditing ? (
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          ) : (
            <p className="text-gray-900">{settings?.info?.email || 'Not set'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          {isEditing ? (
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          ) : (
            <p className="text-gray-900">{settings?.info?.phone || 'Not set'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Globe className="w-4 h-4 inline mr-1" />
            Website
          </label>
          {isEditing ? (
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          ) : (
            <p className="text-gray-900">{settings?.info?.website || 'Not set'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Currency
          </label>
          {isEditing ? (
            <select
              value={formData.defaultCurrency}
              onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            >
              <option value="UGX">UGX - Ugandan Shilling</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="KES">KES - Kenyan Shilling</option>
            </select>
          ) : (
            <p className="text-gray-900">{settings?.defaultCurrency || 'UGX'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Clock className="w-4 h-4 inline mr-1" />
            Timezone
          </label>
          {isEditing ? (
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            >
              <option value="Africa/Kampala">Africa/Kampala (EAT)</option>
              <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
              <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="America/New_York">America/New_York (EST)</option>
            </select>
          ) : (
            <p className="text-gray-900">{settings?.timezone || 'Africa/Kampala'}</p>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6a2449]"
          >
            Save Changes
          </button>
        </div>
      )}

      {/* Workshop Processing Rates */}
      <WorkshopProcessingRatesSection
        canEdit={canEdit}
        settings={settings}
        updateSettings={updateSettings}
      />

    </div>
  );
}

// ============================================================================
// BRANDING TAB
// ============================================================================

function BrandingTab({ canEdit: _canEdit }: { canEdit: boolean }) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Platform Branding</h3>
        <p className="text-sm text-gray-500 mt-1">
          Group-wide logos, colors, and UI defaults applied to new users. Per-subsidiary
          branding lives in the Subsidiaries tab.
        </p>
      </div>
      <PlatformBrandingSettings />
    </div>
  );
}

// ============================================================================
// USERS TAB
// ============================================================================

function UsersTab({ canManage }: { canManage: boolean }) {
  const { users, isLoading } = useUsers();
  const { updateUserRole, deactivateUser, reactivateUser, isSubmitting } = useUserMutations();

  const FIREBASE_PROJECT_ID = 'dawinos';
  const firebaseAuthUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/users`;

  const getRoleBadgeColor = (role: GlobalRole) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'manager': return 'bg-green-100 text-green-800';
      case 'member': return 'bg-gray-100 text-gray-800';
      case 'viewer': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Firebase Auth Integration Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-amber-900">User Access Control</h4>
            <p className="text-sm text-amber-700 mt-1">
              New users must be pre-approved in Firebase Authentication before they can sign in to DawinOS.
              Once approved, they will appear here after their first sign-in.
            </p>
            <a
              href={firebaseAuthUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Manage Users in Firebase
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Team Members Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-500">Users who have signed in to DawinOS</p>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No users yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                {u.photoUrl ? (
                  <img src={u.photoUrl} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <span className="text-gray-600 font-medium">
                    {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{u.displayName}</p>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', getRoleBadgeColor(u.globalRole))}>
                    {u.globalRole}
                  </span>
                  {!u.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{u.email}</p>
              </div>

              {canManage && u.globalRole !== 'owner' && (
                <div className="flex items-center gap-2">
                  <select
                    value={u.globalRole}
                    onChange={(e) => updateUserRole(u.id, e.target.value as GlobalRole)}
                    disabled={isSubmitting}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                  >
                    {GLOBAL_ROLE_DEFINITIONS.filter(r => r.role !== 'owner').map((role) => (
                      <option key={role.role} value={role.role}>
                        {role.name}
                      </option>
                    ))}
                  </select>

                  {u.isActive ? (
                    <button
                      onClick={() => deactivateUser(u.id)}
                      disabled={isSubmitting}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Deactivate"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivateUser(u.id)}
                      disabled={isSubmitting}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Reactivate"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ACCESS CONTROL TAB
// ============================================================================

function AccessControlTab({ canManage }: { canManage: boolean }) {
  const { users, isLoading } = useUsers();
  const { updateUserAccess, isSubmitting } = useUserMutations();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [draftAccess, setDraftAccess] = useState<SubsidiaryAccess[] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [migrateStatus, setMigrateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [migrateMessage, setMigrateMessage] = useState('');
  const [search, setSearch] = useState('');

  const selectedUser = users.find((u) => u.id === selectedUserId) || null;

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [users, search]);

  const runMigrateUserDocs = async () => {
    setMigrateStatus('loading');
    setMigrateMessage('Migrating user documents to correct Firebase Auth UIDs...');
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('@/shared/services/firebase');
      const migrate = httpsCallable(functions, 'migrateUserDocs');
      const result = await migrate({});
      const data = result.data as { total?: number; migrated?: number; skipped?: number; errors?: number };
      setMigrateStatus('success');
      setMigrateMessage(
        `Migration complete: ${data.total} users processed, ${data.migrated} migrated, ${data.skipped} skipped, ${data.errors} errors`
      );
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMigrateStatus('error');
      setMigrateMessage(`Migration failed: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSelectUser = (u: DawinUser) => {
    if (selectedUserId === u.id) {
      setSelectedUserId(null);
      setDraftAccess(null);
      setSaveError(null);
      setSaveSuccess(null);
      return;
    }
    setSelectedUserId(u.id);
    setDraftAccess(u.subsidiaryAccess ?? []);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSaveAccess = async () => {
    if (!selectedUser || !draftAccess) return;
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const cleaned: SubsidiaryAccess[] = draftAccess.map((a) => ({
        subsidiaryId: a.subsidiaryId,
        hasAccess: a.hasAccess,
        modules: a.modules.map((m) => {
          const out: Record<string, unknown> = {
            moduleId: m.moduleId,
            hasAccess: m.hasAccess,
          };
          if (m.role) out.role = m.role;
          if (m.customPermissions && m.customPermissions.length > 0) {
            out.customPermissions = m.customPermissions;
          }
          return out;
        }),
      })) as unknown as SubsidiaryAccess[];
      await updateUserAccess(selectedUser.id, cleaned);
      setSaveSuccess('Access updated');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update access');
    }
  };

  const draftDirty =
    draftAccess !== null &&
    JSON.stringify(draftAccess) !== JSON.stringify(selectedUser?.subsidiaryAccess ?? []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Module Access Control</h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure subsidiary, module, and feature-level access per user. Provision platform
          accounts for HR employees that don't have one yet.
        </p>
      </div>

      {/* Admin Migration Tool */}
      {canManage && (
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">User Document Migration</h4>
              <p className="text-sm text-gray-500 mt-0.5">
                Fix legacy user documents by syncing Firebase Auth UIDs. Run this if users can&apos;t access modules.
              </p>
            </div>
            <button
              onClick={runMigrateUserDocs}
              disabled={migrateStatus === 'loading'}
              className="px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6a2449] text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {migrateStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              Migrate User Docs
            </button>
          </div>
          {migrateMessage && (
            <div className={cn(
              'mt-3 p-3 rounded-lg text-sm',
              migrateStatus === 'loading' && 'bg-blue-50 text-blue-700',
              migrateStatus === 'success' && 'bg-green-50 text-green-700',
              migrateStatus === 'error' && 'bg-red-50 text-red-700',
            )}>
              {migrateMessage}
            </div>
          )}
        </div>
      )}

      {/* Unprovisioned employees */}
      <UnprovisionedEmployeesSection canManage={canManage} />

      {/* Users list + access editor */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Platform users ({filteredUsers.length})</h4>
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-3 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
            />
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No users match your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const isSelected = selectedUserId === u.id;
              const subsCount = u.subsidiaryAccess?.filter((s) => s.hasAccess).length || 0;
              return (
                <div key={u.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    className={cn(
                      'flex items-center gap-4 p-4 cursor-pointer transition-colors',
                      isSelected ? 'bg-purple-50' : 'bg-gray-50 hover:bg-gray-100',
                    )}
                    onClick={() => handleSelectUser(u)}
                  >
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-sm">
                        {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{u.displayName}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                      {u.globalRole}
                    </span>
                    <div className="text-xs text-gray-500">
                      {subsCount} {subsCount === 1 ? 'subsidiary' : 'subsidiaries'}
                    </div>
                  </div>

                  {isSelected && draftAccess && (
                    <div className="p-4 border-t border-gray-200 space-y-4">
                      {saveError && (
                        <div className="px-3 py-2 rounded bg-red-50 text-red-700 text-sm flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{saveError}</span>
                        </div>
                      )}
                      {saveSuccess && (
                        <div className="px-3 py-2 rounded bg-emerald-50 text-emerald-700 text-sm flex items-start gap-2">
                          <Check className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{saveSuccess}</span>
                        </div>
                      )}

                      <SubsidiaryAccessEditor
                        access={draftAccess}
                        onChange={(next) => setDraftAccess(next)}
                        disabled={!canManage || isSubmitting}
                        userRole={u.globalRole as GlobalRole}
                      />

                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="text-sm text-[#872E5C] hover:text-[#6a2449]"
                        >
                          Open full profile →
                        </Link>
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDraftAccess(u.subsidiaryAccess ?? []);
                                setSaveError(null);
                                setSaveSuccess(null);
                              }}
                              disabled={!draftDirty || isSubmitting}
                              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveAccess}
                              disabled={!draftDirty || isSubmitting}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#872E5C] text-white rounded-md hover:bg-[#6a2449] disabled:opacity-50"
                            >
                              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              Save access
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Unprovisioned Employees (HR ↔ Access Control bridge)
// ----------------------------------------------------------------------------

function UnprovisionedEmployeesSection({ canManage }: { canManage: boolean }) {
  const { employees, loading } = useEmployeeList({}, { field: 'fullName', direction: 'asc' }, 50);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const unprovisioned = useMemo(
    () => (employees ?? []).filter((e) => !e.hasSystemAccess && e.employmentStatus === 'active'),
    [employees],
  );

  if (loading || unprovisioned.length === 0) return null;

  const handleProvision = async (emp: typeof unprovisioned[number]) => {
    setCreatingId(emp.id as unknown as string);
    setError(null);
    setSuccess(null);
    try {
      const userData: Record<string, unknown> = {
        uid: '',
        email: emp.email,
        displayName: emp.fullName,
        jobTitle: emp.title,
        department: emp.departmentId,
        globalRole: 'member',
        isActive: true,
        subsidiaryAccess: [],
      };
      if (emp.photoUrl) userData.photoUrl = emp.photoUrl;
      if (emp.phone) userData.phone = emp.phone;
      await createUser('default', userData as never);
      setSuccess(
        `Created account for ${emp.fullName}. Find them in the list below to configure module access.`,
      );
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="border border-amber-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-amber-700" />
          <h4 className="font-medium text-amber-900">
            Employees without platform accounts ({unprovisioned.length})
          </h4>
        </div>
        <p className="text-xs text-amber-800 mt-1">
          These active HR employees don&apos;t have a DawinOS login yet. Click to provision an
          account — you can configure module access for them right below once created.
        </p>
      </div>
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-sm border-b border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm border-b border-emerald-200">
          {success}
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {unprovisioned.slice(0, 10).map((emp) => (
          <div key={emp.id as unknown as string} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
              {emp.fullName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{emp.fullName}</p>
              <p className="text-xs text-gray-500 truncate">
                {emp.email} {emp.title ? `· ${emp.title}` : ''}
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => handleProvision(emp)}
                disabled={creatingId !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-[#872E5C] text-white rounded hover:bg-[#6a2449] disabled:opacity-50"
              >
                {creatingId === (emp.id as unknown as string) ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <UserPlus className="w-3 h-3" />
                )}
                Create account
              </button>
            )}
          </div>
        ))}
        {unprovisioned.length > 10 && (
          <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
            …and {unprovisioned.length - 10} more. Use the HR module&apos;s employee directory to
            provision the rest.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INTEGRATIONS TAB
// ============================================================================

function IntegrationsTab() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">External Integrations</h3>
        <p className="text-sm text-gray-500 mt-1">
          Test and manage connections to external services
        </p>
      </div>

      {/* Google Drive — folder mapping */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GD</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">Google Drive — Folder Mapping</h4>
              <p className="text-sm text-gray-500">
                Bind each Unified File Manager slot to its Shared-Drive folder.
              </p>
            </div>
            <Link
              to="/admin/drive-folders"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Configure →
            </Link>
          </div>
        </div>
      </div>

      {/* Shopify Sync */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Sh</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">Shopify Sync</h4>
              <p className="text-sm text-gray-500">
                Monitor and manage product sync to dawinfinishes.com.
              </p>
            </div>
            <Link
              to="/admin/shopify-sync"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Configure →
            </Link>
          </div>
        </div>
      </div>

      {/* Service Credentials / API Keys */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">🔑</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">Service Credentials &amp; API Keys</h4>
              <p className="text-sm text-gray-500">
                Manage AI / integration service keys (Gemini, Adobe, Shopify, WhatsApp, QBO, …) stored in Firebase Secret Manager.
              </p>
            </div>
            <Link
              to="/admin/api-keys"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Configure →
            </Link>
          </div>
        </div>
      </div>

      {/* Adobe PDF Services */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Ai</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Adobe PDF Services</h4>
              <p className="text-sm text-gray-500">PDF creation, extraction, compression & more</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <AdobePdfTestPanel />
        </div>
      </div>

      {/* Adobe PDF Embed API */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PDF</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Adobe PDF Embed API</h4>
              <p className="text-sm text-gray-500">In-browser PDF viewing with annotations</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <AdobePdfEmbedTestPanel />
        </div>
      </div>

      {/* Placeholder for other integrations */}
      <div className="border border-gray-200 rounded-lg p-4 opacity-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
            <Plug className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h4 className="font-medium text-gray-500">More Integrations Coming Soon</h4>
            <p className="text-sm text-gray-400">Adobe Sign, Photoshop, Firefly & more</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUBSIDIARIES TAB
// ============================================================================

function SubsidiariesTab() {
  return (
    <div className="p-6">
      <SubsidiaryBranding />
    </div>
  );
}

// ============================================================================
// MODULES TAB
// ============================================================================

function ModulesTab() {
  const modules: Array<{
    label: string;
    description: string;
    href: string;
    badgeText: string;
    badgeBg: string;
    icon: typeof Box;
  }> = [
    {
      label: 'Finance Settings',
      description: 'Chart of accounts, QBO integration, sync, account mappings, pricing assumptions.',
      href: '/finance/settings',
      badgeText: 'Fi',
      badgeBg: 'bg-green-700',
      icon: DollarSign,
    },
    {
      label: 'WhatsApp Settings',
      description: 'Provider status, allowed roles, template images, message defaults.',
      href: '/whatsapp/settings',
      badgeText: 'Wa',
      badgeBg: 'bg-emerald-500',
      icon: MessagesSquare,
    },
    {
      label: 'MatFlow Settings',
      description: 'Advisory MatFlow general settings and database admin shortcuts.',
      href: '/advisory/matflow/settings',
      badgeText: 'Mf',
      badgeBg: 'bg-amber-600',
      icon: HardHat,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Module Settings</h3>
        <p className="text-sm text-gray-500 mt-1">
          Settings owned by individual modules — open each module's settings page to configure.
        </p>
      </div>

      <div className="space-y-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.href}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      m.badgeBg
                    )}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{m.label}</h4>
                    <p className="text-sm text-gray-500">{m.description}</p>
                  </div>
                  <Link
                    to={m.href}
                    className="text-sm font-medium text-[#872E5C] hover:text-[#6a2449]"
                  >
                    Open →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Adobe PDF Test Panel (inline for settings page)
// Uses Firebase callable functions (httpsCallable) which handle auth automatically
function AdobePdfTestPanel() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('Click a button to test Adobe PDF Services');
  const [resultData, setResultData] = useState<unknown>(null);

  // Helper to call Firebase callable functions
  const callAdobeFunction = async (functionName: string, data: object) => {
    if (!user) {
      throw new Error('You must be logged in to test Adobe services.');
    }

    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('@/shared/services/firebase');

    const callable = httpsCallable(functions, functionName);
    const result = await callable(data);
    return result.data;
  };

  const testConnectivity = async () => {
    setStatus('loading');
    setMessage('Testing Adobe API connectivity...');
    setResultData(null);

    try {
      // Call with empty data - should get "Input file reference required" error
      // which proves the function is working
      await callAdobeFunction('adobeCreatePdf', {});
      setStatus('success');
      setMessage('Adobe API connectivity verified! Functions are working.');
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      const errorMessage = err.message || '';

      if (errorMessage.includes('Input file reference required') || errorMessage.includes('input')) {
        setStatus('success');
        setMessage('Adobe API connectivity verified! Functions are working.');
        return;
      }
      if (errorMessage.includes('Adobe OAuth token request failed') || errorMessage.includes('OAuth')) {
        setStatus('error');
        setMessage('Adobe authentication failed. Check your credentials in Firebase secrets.');
        return;
      }
      if (errorMessage.includes('not configured')) {
        setStatus('error');
        setMessage('Adobe PDF Services not configured. Check Firebase secrets.');
        return;
      }
      if (err.code === 'unauthenticated' || errorMessage.includes('unauthenticated')) {
        setStatus('error');
        setMessage('You must be logged in to test Adobe services.');
        return;
      }
      setStatus('error');
      setMessage(`Unexpected error: ${errorMessage}`);
    }
  };

  const testExtractPdf = async () => {
    setStatus('loading');
    setMessage('Extracting text from sample PDF...');
    setResultData(null);

    try {
      const response = await callAdobeFunction('adobeExtractPdf', {
        input: {
          type: 'url',
          value: 'https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf',
        },
        elementsToExtract: ['text'],
      });

      setStatus('success');
      setMessage('PDF extraction successful!');
      setResultData(response);
    } catch (error: unknown) {
      const err = error as { message?: string };
      setStatus('error');
      setMessage(`Extraction failed: ${err.message}`);
    }
  };

  const testCompressPdf = async () => {
    setStatus('loading');
    setMessage('Compressing sample PDF...');
    setResultData(null);

    try {
      const response = await callAdobeFunction('adobeCompressPdf', {
        input: {
          type: 'url',
          value: 'https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf',
        },
        compressionLevel: 'MEDIUM',
      });

      const data = response as {
        originalSize?: number;
        compressedSize?: number;
        compressionRatio?: number;
      };

      setStatus('success');
      setMessage(`Compression successful! ${data.originalSize?.toLocaleString()} → ${data.compressedSize?.toLocaleString()} bytes (${Math.round((data.compressionRatio || 0) * 100)}% reduction)`);
      setResultData(response);
    } catch (error: unknown) {
      const err = error as { message?: string };
      setStatus('error');
      setMessage(`Compression failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={testConnectivity}
          disabled={status === 'loading'}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Test Connectivity
        </button>
        <button
          onClick={testExtractPdf}
          disabled={status === 'loading'}
          className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Test Extract PDF
        </button>
        <button
          onClick={testCompressPdf}
          disabled={status === 'loading'}
          className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Test Compress PDF
        </button>
      </div>

      <div className={cn(
        'p-4 rounded-lg',
        status === 'loading' && 'bg-blue-50',
        status === 'success' && 'bg-green-50',
        status === 'error' && 'bg-red-50',
        status === 'idle' && 'bg-gray-50'
      )}>
        <p className={cn(
          'font-medium text-sm',
          status === 'loading' && 'text-blue-600',
          status === 'success' && 'text-green-600',
          status === 'error' && 'text-red-600',
          status === 'idle' && 'text-gray-600'
        )}>
          {status === 'loading' && <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />}
          {status === 'success' && <Check className="w-4 h-4 inline mr-2" />}
          {status === 'error' && <X className="w-4 h-4 inline mr-2" />}
          {message}
        </p>

        {resultData as React.ReactNode && (
          <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-32 border">
            {JSON.stringify(resultData, null, 2).slice(0, 500)}
            {JSON.stringify(resultData, null, 2).length > 500 && '...'}
          </pre>
        )}
      </div>
    </div>
  );
}

// Adobe PDF Embed Test Panel - uses a portal-like pattern to avoid React DOM conflicts
function AdobePdfEmbedTestPanel() {
  const [viewerState, setViewerState] = useState<'hidden' | 'loading' | 'ready'>('hidden');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const testPdfUrl = 'https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf';
  const clientId = import.meta.env.VITE_ADOBE_CLIENT_ID;
  const viewDivId = 'adobe-pdf-embed-viewer';

  // Cleanup function to safely remove Adobe SDK content
  const cleanupViewer = () => {
    const viewerDiv = document.getElementById(viewDivId);
    if (viewerDiv) {
      // Remove all children added by Adobe SDK
      while (viewerDiv.firstChild) {
        viewerDiv.removeChild(viewerDiv.firstChild);
      }
    }
  };

  const hideViewer = () => {
    cleanupViewer();
    setViewerState('hidden');
  };

  const loadPdfViewer = async () => {
    if (!clientId) {
      setError('VITE_ADOBE_CLIENT_ID not configured. Add it to your .env file.');
      return;
    }

    // Clean up any existing viewer content first
    cleanupViewer();

    setViewerState('loading');
    setError(null);

    try {
      // Dynamically load the Adobe DC View SDK
      if (!window.AdobeDC) {
        await new Promise<void>((resolve, reject) => {
          // Check if script is already loading
          const existingScript = document.querySelector('script[src*="acrobatservices.adobe.com/view-sdk"]');
          if (existingScript) {
            const checkReady = () => {
              if (window.AdobeDC) resolve();
              else setTimeout(checkReady, 100);
            };
            checkReady();
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
          script.async = true;
          script.onload = () => {
            const checkReady = () => {
              if (window.AdobeDC) resolve();
              else setTimeout(checkReady, 100);
            };
            checkReady();
          };
          script.onerror = () => reject(new Error('Failed to load Adobe PDF Embed SDK'));
          document.head.appendChild(script);
        });
      }

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 50));

      const adobeDCView = new window.AdobeDC!.View({
        clientId: clientId,
        divId: viewDivId,
      });

      await adobeDCView.previewFile(
        {
          content: { location: { url: testPdfUrl } },
          metaData: { fileName: 'Bodea Brochure.pdf' },
        },
        {
          embedMode: 'SIZED_CONTAINER',
          defaultViewMode: 'FIT_WIDTH',
          showDownloadPDF: true,
          showPrintPDF: true,
          showFullScreen: true,
          showAnnotationTools: false,
        }
      );

      setViewerState('ready');
    } catch (err) {
      setViewerState('hidden');
      setError(err instanceof Error ? err.message : 'Failed to load PDF viewer');
    }
  };

  return (
    <div className="space-y-4" ref={containerRef}>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={loadPdfViewer}
          disabled={viewerState === 'loading'}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {viewerState === 'loading' ? 'Loading...' : viewerState === 'ready' ? 'Reload PDF Viewer' : 'Test PDF Embed'}
        </button>
        {viewerState !== 'hidden' && (
          <button
            onClick={hideViewer}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
          >
            Hide Viewer
          </button>
        )}
      </div>

      {!clientId && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          VITE_ADOBE_CLIENT_ID not configured. Add your Adobe Client ID to the .env file.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <X className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {/* Loading indicator - shown separately from the viewer div */}
      {viewerState === 'loading' && (
        <div className="flex items-center justify-center h-[500px] bg-gray-50 border border-gray-200 rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {/*
        Adobe PDF Viewer container - ALWAYS rendered but hidden when not in use.
        This div must NOT have any React children as Adobe SDK manages it directly.
        We hide/show with CSS to avoid React DOM reconciliation issues.
      */}
      <div
        id={viewDivId}
        className="border border-gray-200 rounded-lg overflow-hidden"
        style={{
          height: viewerState === 'ready' ? '500px' : '0px',
          display: viewerState === 'ready' ? 'block' : 'none'
        }}
      />

      {viewerState === 'hidden' && !error && clientId && (
        <p className="text-sm text-gray-500">
          Click &quot;Test PDF Embed&quot; to load the Adobe PDF viewer with a sample document.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// TEMPLATES TAB (Future)
// ============================================================================

function TemplatesTab() {
  return (
    <div className="p-6">
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Document Templates</h3>
        <p className="text-gray-500 mb-4">
          Configure document templates for invoices, reports, and exports across modules.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          Coming Soon
        </div>
      </div>
    </div>
  );
}
