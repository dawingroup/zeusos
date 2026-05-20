// =============================================================================
// GLOBAL CONTEXT - Cross-Module Integration
// =============================================================================

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase/functions';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/shared/services/firebase';
import { createUser as createDawinUser, getUserByUid } from '@/core/settings/settingsService';
import type {
  GlobalState,
  GlobalAction,
  UserState,
  UserPreferences,
  GlobalNotification,
  SearchResult,
  RecentItem,
} from '../types/integration.types';
import type { ModuleId } from '../constants/modules.constants';

// ----------------------------------------------------------------------------
// INITIAL STATE
// ----------------------------------------------------------------------------
const initialPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  timezone: 'Africa/Kampala',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'en-UG',
  currency: 'UGX',
  sidebarCollapsed: false,
  notificationSettings: {
    email: true,
    push: true,
    inApp: true,
    digest: 'daily',
    mutedModules: [],
  },
  dashboardLayout: {},
  favoriteModules: [],
  recentItems: [],
};

const initialState: GlobalState = {
  auth: {
    isAuthenticated: false,
    isLoading: true,
    userId: null,
    email: null,
    displayName: null,
    photoURL: null,
    roles: [],
    permissions: [],
    user: null,
  },
  currentModule: null,
  currentOrganizationId: null,
  currentSubsidiaryId: null,
  user: null,
  preferences: initialPreferences,
  sidebar: {
    isOpen: true,
    isPinned: true,
    expandedItems: [],
    width: 280,
  },
  search: {
    isOpen: false,
    query: '',
    results: [],
    isLoading: false,
    recentSearches: [],
    filters: { modules: [], types: [] },
  },
  notifications: {
    items: [],
    unreadCount: 0,
    isLoading: false,
    hasMore: false,
  },
  moduleData: {},
  isOnline: navigator.onLine,
  lastSync: null,
};

// ----------------------------------------------------------------------------
// REDUCER
// ----------------------------------------------------------------------------
function globalReducer(state: GlobalState, action: GlobalAction): GlobalState {
  switch (action.type) {
    case 'SET_AUTH':
      return { ...state, auth: action.payload };

    case 'SET_USER':
      return { ...state, user: action.payload };

    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
      };

    case 'SET_CURRENT_MODULE':
      return { ...state, currentModule: action.payload };

    case 'SET_ORGANIZATION':
      return {
        ...state,
        currentOrganizationId: action.payload.organizationId,
        currentSubsidiaryId: action.payload.subsidiaryId || null,
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebar: { ...state.sidebar, isOpen: !state.sidebar.isOpen },
      };

    case 'SET_SIDEBAR_STATE':
      return {
        ...state,
        sidebar: { ...state.sidebar, ...action.payload },
      };

    case 'OPEN_SEARCH':
      return {
        ...state,
        search: { ...state.search, isOpen: true },
      };

    case 'CLOSE_SEARCH':
      return {
        ...state,
        search: { ...state.search, isOpen: false, query: '', results: [] },
      };

    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        search: { ...state.search, query: action.payload },
      };

    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        search: { ...state.search, results: action.payload, isLoading: false },
      };

    case 'SET_SEARCH_LOADING':
      return {
        ...state,
        search: { ...state.search, isLoading: action.payload },
      };

    case 'SET_SEARCH_FILTERS':
      return {
        ...state,
        search: { ...state.search, filters: action.payload },
      };

    case 'ADD_RECENT_SEARCH': {
      const recentSearches = [
        action.payload,
        ...state.search.recentSearches.filter((s) => s !== action.payload),
      ].slice(0, 10);
      return {
        ...state,
        search: { ...state.search, recentSearches },
      };
    }

    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: {
          ...state.notifications,
          items: action.payload,
          unreadCount: action.payload.filter((n) => !n.isRead).length,
        },
      };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: {
          ...state.notifications,
          items: [action.payload, ...state.notifications.items],
          unreadCount:
            state.notifications.unreadCount + (action.payload.isRead ? 0 : 1),
        },
      };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: {
          ...state.notifications,
          items: state.notifications.items.map((n) =>
            n.id === action.payload ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, state.notifications.unreadCount - 1),
        },
      };

    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: {
          ...state.notifications,
          items: state.notifications.items.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        },
      };

    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload };

    case 'SET_LAST_SYNC':
      return { ...state, lastSync: action.payload };

    case 'ADD_RECENT_ITEM': {
      const recentItems = [
        action.payload,
        ...state.preferences.recentItems.filter(
          (item) => !(item.type === action.payload.type && item.id === action.payload.id)
        ),
      ].slice(0, 20);

      return {
        ...state,
        preferences: { ...state.preferences, recentItems },
      };
    }

    case 'CLEAR_MODULE_CACHE': {
      const nextModuleData = { ...state.moduleData };
      delete nextModuleData[action.payload];
      return { ...state, moduleData: nextModuleData };
    }

    case 'SET_MODULE_DATA':
      return {
        ...state,
        moduleData: {
          ...state.moduleData,
          [action.payload.module]: {
            data: action.payload.data,
            lastFetch: new Date(),
            isStale: false,
          },
        },
      };

    default:
      return state;
  }
}

// ----------------------------------------------------------------------------
// CONTEXT
// ----------------------------------------------------------------------------
interface GlobalContextValue {
  state: GlobalState;
  dispatch: React.Dispatch<GlobalAction>;

  // Auth helpers
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;

  // Navigation helpers
  setCurrentModule: (module: ModuleId | null) => void;
  addRecentItem: (item: Omit<RecentItem, 'timestamp'>) => void;

  // Search helpers
  openSearch: () => void;
  closeSearch: () => void;

  // Notification helpers
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Sidebar helpers
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;

  // Preferences helpers
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

const GlobalContext = createContext<GlobalContextValue | null>(null);

// ----------------------------------------------------------------------------
// PROVIDER
// ----------------------------------------------------------------------------
interface GlobalProviderProps {
  children: ReactNode;
}

/**
 * Persistence for state.preferences.recentItems — used by the Global Search
 * palette to surface recently-opened records and to boost their ranking.
 * Lives outside the reducer because the reducer must remain pure.
 *
 * Bound to ~50 entries to keep localStorage writes cheap.
 */
const RECENT_ITEMS_STORAGE_KEY = 'dawinos-recent-records';
const RECENT_ITEMS_MAX = 50;

function loadRecentItemsFromStorage(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<RecentItem & { timestamp: string | number | Date }>;
    return parsed
      .map((item) => ({
        ...item,
        timestamp: item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp),
      }))
      .filter((item) => item.id && item.type && item.title)
      .slice(0, RECENT_ITEMS_MAX);
  } catch {
    return [];
  }
}

function saveRecentItemsToStorage(items: RecentItem[]): void {
  try {
    const trimmed = items.slice(0, RECENT_ITEMS_MAX);
    localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage may be unavailable (private mode, quota); ignore. */
  }
}

export const GlobalProvider: React.FC<GlobalProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(globalReducer, initialState, (init) => ({
    ...init,
    preferences: {
      ...init.preferences,
      recentItems: loadRecentItemsFromStorage(),
    },
  }));

  // Persist recentItems whenever they change. Cheap (small JSON blob) and
  // makes the search palette useful immediately after a page reload.
  useEffect(() => {
    saveRecentItemsToStorage(state.preferences.recentItems);
  }, [state.preferences.recentItems]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let userDoc = await fetchUserProfile(firebaseUser.uid, firebaseUser.email);

        // If no user profile exists, check for a pending invite
        if (!userDoc) {
          try {
            const processInvite = httpsCallable<unknown, { hasInvite: boolean; globalRole?: string }>(
              functions,
              'processNewUserInvite'
            );
            const result = await processInvite({});
            if (result.data.hasInvite) {
              userDoc = await fetchUserProfile(firebaseUser.uid, firebaseUser.email);
            }
          } catch (err) {
            console.error('Error checking invite:', err);
          }
        }

        // Auto-provision DawinUser for super users who don't have one yet
        const SUPER_USER_EMAILS = ['onzimai@dawin.group'];
        if (!userDoc && firebaseUser.email && SUPER_USER_EMAILS.includes(firebaseUser.email)) {
          try {
            // Check if DawinUser doc exists in organizations/default/users
            const existingDawinUser = await getUserByUid('default', firebaseUser.uid);
            if (!existingDawinUser) {
              const superUserData: Record<string, any> = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || firebaseUser.email,
                globalRole: 'owner',
                isActive: true,
                subsidiaryAccess: [],
              };
              if (firebaseUser.photoURL) superUserData.photoUrl = firebaseUser.photoURL;
              await createDawinUser('default', superUserData as any);
              console.log('[GlobalContext] Auto-provisioned DawinUser for super user');
            }
            userDoc = await fetchUserProfile(firebaseUser.uid, firebaseUser.email);
          } catch (err) {
            console.error('[GlobalContext] Error auto-provisioning super user:', err);
          }
        }

        dispatch({
          type: 'SET_AUTH',
          payload: {
            isAuthenticated: true,
            isLoading: false,
            userId: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            roles: userDoc?.roles || [],
            permissions: userDoc?.permissions || [],
            user: userDoc || null,
          },
        });

        if (userDoc) {
          dispatch({ type: 'SET_USER', payload: userDoc });
          dispatch({
            type: 'SET_ORGANIZATION',
            payload: {
              organizationId: userDoc.organizationId,
              subsidiaryId: userDoc.subsidiaryIds?.[0],
            },
          });
        }
      } else {
        dispatch({
          type: 'SET_AUTH',
          payload: {
            isAuthenticated: false,
            isLoading: false,
            userId: null,
            email: null,
            displayName: null,
            photoURL: null,
            roles: [],
            permissions: [],
            user: null,
          },
        });
        dispatch({ type: 'SET_USER', payload: null });
      }
    });

    return () => unsubscribe();
  }, []);

  // Notifications listener
  useEffect(() => {
    if (!state.auth.userId || !state.currentOrganizationId) return;

    let unsubscribe: (() => void) | undefined;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', state.auth.userId),
        where('organizationId', '==', state.currentOrganizationId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      unsubscribe = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          const notifications = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Record<string, unknown>),
          })) as GlobalNotification[];

          dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
        },
        (error) => {
          // Handle errors gracefully (e.g., index still building)
          console.warn('[GlobalContext] Notifications listener error:', error.message);
          // Don't crash the app - just log the error and continue
          if (error.code === 'failed-precondition') {
            console.info('[GlobalContext] Firestore index is building. Notifications will load once index is ready.');
          }
        }
      );
    } catch (error) {
      // Catch any synchronous errors during query setup
      console.warn('[GlobalContext] Error setting up notifications listener:', error);
      // Initialize with empty array to prevent undefined state
      dispatch({ type: 'SET_NOTIFICATIONS', payload: [] });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [state.auth.userId, state.currentOrganizationId]);

  // Online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Permission helpers
  const hasPermission = useCallback(
    (permission: string) => state.auth.permissions.includes(permission),
    [state.auth.permissions]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]) => permissions.some((p) => state.auth.permissions.includes(p)),
    [state.auth.permissions]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]) => permissions.every((p) => state.auth.permissions.includes(p)),
    [state.auth.permissions]
  );

  const hasRole = useCallback(
    (role: string) => state.auth.roles.includes(role),
    [state.auth.roles]
  );

  // Action helpers
  const setCurrentModule = useCallback((module: ModuleId | null) => {
    dispatch({ type: 'SET_CURRENT_MODULE', payload: module });
  }, []);

  const addRecentItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    dispatch({
      type: 'ADD_RECENT_ITEM',
      payload: { ...item, timestamp: new Date() },
    });
  }, []);

  const openSearch = useCallback(() => {
    dispatch({ type: 'OPEN_SEARCH' });
  }, []);

  const closeSearch = useCallback(() => {
    dispatch({ type: 'CLOSE_SEARCH' });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
    updateNotificationInFirestore(id, { isRead: true });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
    batchMarkNotificationsRead(state.notifications.items.map((n) => n.id));
  }, [state.notifications.items]);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const setSidebarOpen = useCallback((isOpen: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_STATE', payload: { isOpen } });
  }, []);

  const updatePreferences = useCallback(
    (prefs: Partial<UserPreferences>) => {
      dispatch({ type: 'SET_PREFERENCES', payload: prefs });
      if (state.auth.userId) {
        saveUserPreferences(state.auth.userId, prefs);
      }
    },
    [state.auth.userId]
  );

  const contextValue = useMemo<GlobalContextValue>(() => ({
    state,
    dispatch,
    isAuthenticated: state.auth.isAuthenticated,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    setCurrentModule,
    addRecentItem,
    openSearch,
    closeSearch,
    markNotificationRead,
    markAllNotificationsRead,
    toggleSidebar,
    setSidebarOpen,
    updatePreferences,
  }), [
    state,
    dispatch,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    setCurrentModule,
    addRecentItem,
    openSearch,
    closeSearch,
    markNotificationRead,
    markAllNotificationsRead,
    toggleSidebar,
    setSidebarOpen,
    updatePreferences,
  ]);

  return <GlobalContext.Provider value={contextValue}>{children}</GlobalContext.Provider>;
};

// ----------------------------------------------------------------------------
// HOOKS
// ----------------------------------------------------------------------------
export function useGlobalState() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalState must be used within a GlobalProvider');
  }
  return context;
}

export function useAuth() {
  const { state, hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = useGlobalState();
  return useMemo(() => ({
    ...state.auth,
    user: state.user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  }), [state.auth, state.user, hasPermission, hasAnyPermission, hasAllPermissions, hasRole]);
}

export function useCurrentModule() {
  const { state, setCurrentModule } = useGlobalState();
  return useMemo(() => ({
    currentModule: state.currentModule,
    setCurrentModule,
  }), [state.currentModule, setCurrentModule]);
}

export function useSidebar() {
  const { state, dispatch, toggleSidebar, setSidebarOpen } = useGlobalState();
  
  const togglePin = useCallback(() => {
    dispatch({ type: 'SET_SIDEBAR_STATE', payload: { isPinned: !state.sidebar.isPinned } });
  }, [dispatch, state.sidebar.isPinned]);

  return useMemo(() => ({
    ...state.sidebar,
    toggleSidebar,
    setSidebarOpen,
    togglePin,
  }), [state.sidebar, toggleSidebar, setSidebarOpen, togglePin]);
}

export function useSearch() {
  const { state, dispatch, openSearch, closeSearch } = useGlobalState();

  const setQuery = useCallback(
    (queryValue: string) => {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: queryValue });
    },
    [dispatch]
  );

  const setResults = useCallback(
    (results: SearchResult[]) => {
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
    },
    [dispatch]
  );

  const setLoading = useCallback(
    (loading: boolean) => {
      dispatch({ type: 'SET_SEARCH_LOADING', payload: loading });
    },
    [dispatch]
  );

  const addRecentSearch = useCallback(
    (search: string) => {
      dispatch({ type: 'ADD_RECENT_SEARCH', payload: search });
    },
    [dispatch]
  );

  return useMemo(() => ({
    ...state.search,
    openSearch,
    closeSearch,
    setQuery,
    setResults,
    setLoading,
    addRecentSearch,
  }), [state.search, openSearch, closeSearch, setQuery, setResults, setLoading, addRecentSearch]);
}

export function useNotifications() {
  const { state, markNotificationRead, markAllNotificationsRead } = useGlobalState();
  return useMemo(() => ({
    ...state.notifications,
    markNotificationRead,
    markAllNotificationsRead,
  }), [state.notifications, markNotificationRead, markAllNotificationsRead]);
}

export function usePreferences() {
  const { state, updatePreferences } = useGlobalState();
  return useMemo(() => ({
    preferences: state.preferences,
    updatePreferences,
  }), [state.preferences, updatePreferences]);
}

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------
async function fetchUserProfile(userId: string, email?: string | null): Promise<UserState | null> {
  // 1. Try legacy root-level users collection
  const directRef = doc(db, 'users', userId);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) {
    return { id: directSnap.id, ...(directSnap.data() as Record<string, unknown>) } as UserState;
  }

  const orgId = 'default';
  const orgUsersRef = collection(db, 'organizations', orgId, 'users');

  // 2. Try direct doc by UID in org users
  const orgDirectRef = doc(db, 'organizations', orgId, 'users', userId);
  const orgDirectSnap = await getDoc(orgDirectRef);
  if (orgDirectSnap.exists()) {
    const data = orgDirectSnap.data() as Record<string, unknown>;
    return buildUserState(orgDirectSnap.id, data, orgId);
  }

  // 3. Query by uid field
  const uidQuery = query(orgUsersRef, where('uid', '==', userId), limit(1));
  const uidSnap = await getDocs(uidQuery);
  if (!uidSnap.empty) {
    const userDoc = uidSnap.docs[0];
    return buildUserState(userDoc.id, userDoc.data() as Record<string, unknown>, orgId);
  }

  // 4. Query by email (final fallback for legacy users)
  if (email) {
    const emailQuery = query(orgUsersRef, where('email', '==', email), limit(1));
    const emailSnap = await getDocs(emailQuery);
    if (!emailSnap.empty) {
      const userDoc = emailSnap.docs[0];
      console.info('[GlobalContext] Found user by email fallback:', email, 'docId:', userDoc.id);
      // Auto-heal: update uid field so future lookups work
      try {
        await updateDoc(userDoc.ref, { uid: userId });
        console.info('[GlobalContext] Auto-healed uid field for', email);
      } catch (err) {
        console.warn('[GlobalContext] Failed to auto-heal uid:', err);
      }
      return buildUserState(userDoc.id, userDoc.data() as Record<string, unknown>, orgId);
    }
  }

  return null;
}

function buildUserState(docId: string, data: Record<string, unknown>, orgId: string): UserState {
  const inferred: UserState = {
    id: docId,
    email: String(data.email || ''),
    displayName: String(data.displayName || ''),
    photoURL: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
    organizationId: orgId,
    subsidiaryIds: [],
    roles: [],
    permissions: [],
    lastLogin: Timestamp.now(),
  };
  return { ...inferred, ...(data as unknown as UserState) };
}

async function updateNotificationInFirestore(
  notificationId: string,
  updates: Partial<GlobalNotification>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), updates as Record<string, unknown>);
  } catch (error) {
    console.error('[GlobalContext] Failed to update notification:', error);
  }
}

async function batchMarkNotificationsRead(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;

  try {
    const batch = writeBatch(db);
    for (const id of notificationIds) {
      batch.update(doc(db, 'notifications', id), { isRead: true });
    }
    await batch.commit();
  } catch (error) {
    console.error('[GlobalContext] Failed to batch update notifications:', error);
  }
}

async function saveUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', userId, 'settings', 'preferences'),
      {
        ...preferences,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('[GlobalContext] Failed to save preferences:', error);
  }
}
