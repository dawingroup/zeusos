/**
 * ZeusOS Settings Hooks
 * React hooks for settings and user management
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import * as settingsService from './settingsService';
import type {
  OrganizationSettings,
  DawinUser,
  UserInvite,
  GlobalRole,
  SubsidiaryAccess,
  GlobalPermission,
  AuditLogEntry,
} from './types';
import { hasGlobalPermission } from './types';

const DEFAULT_ORG_ID = 'default';

// Phase 6.UI.0 — dev-only DawinUser bypass. Mirrors the synthetic
// Firebase user in `AuthContext.jsx`. When the env toggle is set the
// hook returns a synthetic admin DawinUser with parent-org access,
// so the AppShell renders the PARENT manifest without a Firestore
// round-trip. Tree-shaken from prod builds via `import.meta.env.DEV`.
const DEV_BYPASS_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

const DEV_BYPASS_DAWIN_USER: DawinUser | null = DEV_BYPASS_AUTH
  ? {
      id: 'dev-bypass-user',
      uid: 'dev-bypass-user',
      email: 'onzimai@zeusgroup.co.ug',
      displayName: 'Dev Bypass User',
      globalRole: 'admin' as GlobalRole,
      isActive: true,
      subsidiaryAccess: [
        { subsidiaryId: 'zeus-group',       hasAccess: true, modules: [] },
        { subsidiaryId: 'zeus-the-agency',  hasAccess: true, modules: [] },
        { subsidiaryId: 'zeus-digital',     hasAccess: true, modules: [] },
        { subsidiaryId: 'labyrinth',        hasAccess: true, modules: [] },
        { subsidiaryId: 'odd-gorilla',      hasAccess: true, modules: [] },
        { subsidiaryId: 'house-of-zeus',    hasAccess: true, modules: [] },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  : null;

// ============================================================================
// ORGANIZATION SETTINGS
// ============================================================================

export function useOrganizationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = settingsService.subscribeToOrganizationSettings(
      orgId,
      (data) => {
        setSettings(data);
        setIsLoading(false);
        setError(null);
      }
    );

    return () => unsubscribe();
  }, [orgId, user]);

  const updateSettings = useCallback(
    async (updates: Partial<OrganizationSettings>) => {
      try {
        await settingsService.updateOrganizationSettings(orgId, updates);
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [orgId]
  );

  return { settings, isLoading, error, updateSettings };
}

// ============================================================================
// USERS
// ============================================================================

export function useUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<DawinUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  useEffect(() => {
    if (!user) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = settingsService.subscribeToUsers(orgId, (data) => {
      setUsers(data);
      setIsLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [orgId, user]);

  return { users, isLoading, error };
}

export function useCurrentDawinUser() {
  const { user } = useAuth();
  const [dawinUser, setDawinUser] = useState<DawinUser | null>(DEV_BYPASS_DAWIN_USER);
  const [isLoading, setIsLoading] = useState(!DEV_BYPASS_AUTH);
  const [error, setError] = useState<Error | null>(null);

  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      // Synthetic user is the source of truth in dev-bypass mode —
      // skip Firestore subscription entirely.
      return;
    }
    if (!user) {
      setDawinUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Real-time subscription: tries direct doc → uid query → email query
    const unsubscribe = settingsService.subscribeToCurrentUser(
      orgId,
      user.uid,
      (data) => {
        if (!data) {
          console.warn('[useCurrentDawinUser] No DawinUser profile found for', user.uid, user.email);
        }
        setDawinUser(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useCurrentDawinUser] Subscription error:', err);
        setError(err);
        setIsLoading(false);
      },
      user.email // email fallback for legacy users
    );

    return () => unsubscribe();
  }, [orgId, user]);

  const hasPermission = useCallback(
    (permission: GlobalPermission): boolean => {
      if (!dawinUser) return false;
      return hasGlobalPermission(dawinUser.globalRole, permission);
    },
    [dawinUser]
  );

  return { dawinUser, isLoading, error, hasPermission };
}

export function useUser(userId: string | undefined) {
  const { user } = useAuth();
  const [dawinUser, setDawinUser] = useState<DawinUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  useEffect(() => {
    if (!user || !userId) {
      setDawinUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Use real-time subscription so UI reflects saves immediately
    const unsubscribe = settingsService.subscribeToUser(
      orgId,
      userId,
      (data) => {
        setDawinUser(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId, user, userId]);

  return { dawinUser, isLoading, error };
}

// ============================================================================
// USER MUTATIONS
// ============================================================================

export function useUserMutations() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const updateUser = useCallback(
    async (userId: string, updates: Partial<DawinUser>) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await settingsService.updateUser(orgId, userId, updates);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [orgId]
  );

  const updateUserAccess = useCallback(
    async (userId: string, subsidiaryAccess: SubsidiaryAccess[]) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await settingsService.updateUserAccess(orgId, userId, subsidiaryAccess);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [orgId]
  );

  const updateUserRole = useCallback(
    async (userId: string, globalRole: GlobalRole) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await settingsService.updateUserRole(orgId, userId, globalRole);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [orgId]
  );

  const deactivateUser = useCallback(
    async (userId: string) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await settingsService.deactivateUser(orgId, userId);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [orgId]
  );

  const reactivateUser = useCallback(
    async (userId: string) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await settingsService.reactivateUser(orgId, userId);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [orgId]
  );

  return {
    updateUser,
    updateUserAccess,
    updateUserRole,
    deactivateUser,
    reactivateUser,
    isSubmitting,
    error,
  };
}

// ============================================================================
// INVITES
// ============================================================================

export function useInvites() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const loadInvites = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const data = await settingsService.getPendingInvites(orgId);
      setInvites(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, user]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const createInvite = useCallback(
    async (invite: Omit<UserInvite, 'id' | 'createdAt' | 'status'>) => {
      try {
        const id = await settingsService.createInvite(orgId, invite);
        await loadInvites();
        return id;
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [orgId, loadInvites]
  );

  const revokeInvite = useCallback(
    async (inviteId: string) => {
      try {
        await settingsService.revokeInvite(orgId, inviteId);
        await loadInvites();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [orgId, loadInvites]
  );

  return { invites, isLoading, error, createInvite, revokeInvite, reload: loadInvites };
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export function useAuditLog(limit: number = 50) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const loadLog = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const data = await settingsService.getAuditLog(orgId, limit);
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, limit, user]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  return { entries, isLoading, error, reload: loadLog };
}
