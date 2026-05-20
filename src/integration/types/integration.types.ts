// =============================================================================
// INTEGRATION TYPES - Cross-Module Integration
// =============================================================================

import type { Timestamp } from 'firebase/firestore';
import type { ModuleId } from '../constants/modules.constants';

// ----------------------------------------------------------------------------
// GLOBAL STATE
// ----------------------------------------------------------------------------
export interface GlobalState {
  // Auth
  auth: AuthState;

  // Context
  currentModule: ModuleId | null;
  currentOrganizationId: string | null;
  currentSubsidiaryId: string | null;

  // User
  user: UserState | null;
  preferences: UserPreferences;

  // UI State
  sidebar: SidebarState;
  search: SearchState;
  notifications: NotificationState;

  // Data
  moduleData: ModuleDataState;

  // System
  isOnline: boolean;
  lastSync: Date | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  roles: string[];
  permissions: string[];
  user: UserState | null;
}

export interface UserState {
  id: string;
  /** Alias for id — used by HR performance pages */
  userId?: string;
  email: string;
  displayName: string;
  photoURL?: string;
  organizationId: string;
  subsidiaryIds: string[];
  department?: string;
  jobTitle?: string;
  roles: string[];
  permissions: string[];
  lastLogin: Timestamp;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  currency: string;
  sidebarCollapsed: boolean;
  notificationSettings: NotificationPreferences;
  dashboardLayout: Record<string, unknown>;
  favoriteModules: ModuleId[];
  recentItems: RecentItem[];
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  digest: 'none' | 'daily' | 'weekly';
  mutedModules: ModuleId[];
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface RecentItem {
  type: string;
  id: string;
  title: string;
  module: ModuleId;
  path: string;
  timestamp: Date;
}

// ----------------------------------------------------------------------------
// UI STATE
// ----------------------------------------------------------------------------
export interface SidebarState {
  isOpen: boolean;
  isPinned: boolean;
  expandedItems: string[];
  width: number;
}

export interface SearchState {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  recentSearches: string[];
  filters: SearchFilters;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  module: ModuleId | string;
  path: string;
  icon: string;
  score: number;
  highlights?: string[];
}

export interface SearchFilters {
  modules: ModuleId[];
  types: string[];
  dateRange?: { start: Date; end: Date };
}

export interface NotificationState {
  items: GlobalNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
}

export interface GlobalNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  module: ModuleId;
  severity: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

// ----------------------------------------------------------------------------
// MODULE DATA STATE
// ----------------------------------------------------------------------------
export interface ModuleDataState {
  [key: string]: ModuleCache;
}

export interface ModuleCache {
  data: Record<string, unknown>;
  lastFetch: Date;
  isStale: boolean;
}

// ----------------------------------------------------------------------------
// CROSS-MODULE DATA
// ----------------------------------------------------------------------------
export interface CrossModuleReference {
  sourceModule: ModuleId;
  sourceEntityType: string;
  sourceEntityId: string;
  targetModule: ModuleId;
  targetEntityType: string;
  targetEntityId: string;
  relationshipType: 'parent' | 'child' | 'related' | 'reference';
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface CrossModuleMetric {
  id: string;
  module: ModuleId;
  metricType: string;
  value: number;
  previousValue?: number;
  unit?: string;
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  breakdown?: Record<string, number>;
  calculatedAt: Timestamp;
}

export interface CrossModuleSummary {
  module: ModuleId;
  metrics: CrossModuleMetric[];
  alerts: GlobalNotification[];
  pendingItems: number;
  lastActivity: Timestamp;
}

// ----------------------------------------------------------------------------
// NAVIGATION TYPES
// ----------------------------------------------------------------------------
export interface NavigationContext {
  currentPath: string;
  currentModule: ModuleId | null;
  breadcrumbs: BreadcrumbItem[];
  previousPath?: string;
  params: Record<string, string>;
}

export interface BreadcrumbItem {
  label: string;
  path: string;
  isActive: boolean;
}

// ----------------------------------------------------------------------------
// ACTIONS
// ----------------------------------------------------------------------------
export type GlobalAction =
  | { type: 'SET_AUTH'; payload: AuthState }
  | { type: 'SET_USER'; payload: UserState | null }
  | { type: 'SET_PREFERENCES'; payload: Partial<UserPreferences> }
  | { type: 'SET_CURRENT_MODULE'; payload: ModuleId | null }
  | { type: 'SET_ORGANIZATION'; payload: { organizationId: string; subsidiaryId?: string } }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_STATE'; payload: Partial<SidebarState> }
  | { type: 'OPEN_SEARCH' }
  | { type: 'CLOSE_SEARCH' }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: SearchResult[] }
  | { type: 'SET_SEARCH_LOADING'; payload: boolean }
  | { type: 'SET_SEARCH_FILTERS'; payload: SearchFilters }
  | { type: 'ADD_RECENT_SEARCH'; payload: string }
  | { type: 'SET_NOTIFICATIONS'; payload: GlobalNotification[] }
  | { type: 'ADD_NOTIFICATION'; payload: GlobalNotification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'SET_LAST_SYNC'; payload: Date }
  | { type: 'ADD_RECENT_ITEM'; payload: RecentItem }
  | { type: 'CLEAR_MODULE_CACHE'; payload: ModuleId }
  | { type: 'SET_MODULE_DATA'; payload: { module: ModuleId; data: Record<string, unknown> } };
