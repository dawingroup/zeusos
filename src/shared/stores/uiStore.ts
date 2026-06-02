/**
 * UI Store
 * Global UI state management with Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Density = 'dense' | 'balanced' | 'airy';
/** Sidebar roadmap scope — 'roadmap' shows the full ideal IA (incl. planned
 *  items, dimmed); 'deployed' hides planned items. UI Refresh v3. */
export type NavScope = 'roadmap' | 'deployed';
/**
 * Accent options. Canonical Zeus accents (navy/red + the five sub-brand
 * keys) map 1:1 to the `[data-accent]` CSS blocks in `src/index.css`.
 * Legacy DawinOS values (boysenberry/goldenbell/seafoam/pesto) are
 * retained so previously-persisted preferences keep resolving (the CSS
 * remaps them onto the Zeus palette).
 */
export type Accent =
  | 'zeus-navy'
  | 'zeus-red'
  | 'zeus-the-agency'
  | 'zeus-digital'
  | 'labyrinth'
  | 'odd-gorilla'
  | 'house-of-zeus'
  | 'boysenberry'
  | 'goldenbell'
  | 'seafoam'
  | 'pesto';
/** UI-refresh editorial axis. `ambitious` is the production default. */
export type Direction = 'conservative' | 'ambitious';
/** Sidebar chrome treatment. */
export type SidebarStyle = 'dark' | 'light';

interface UIState {
  sidebarOpen: boolean; // Mobile drawer open/close
  sidebarCollapsed: boolean; // Desktop: collapsed to icon rail
  sidebarHovered: boolean; // Desktop: temporarily expanded via hover
  sidebarAutoClose: boolean; // Auto-close sidebar on mobile after navigation
  theme: 'light' | 'dark' | 'system';
  density: Density;
  accent: Accent;
  direction: Direction;
  sidebarStyle: SidebarStyle;
  navScope: NavScope;
  sparklinesEnabled: boolean;
  aiPanelEnabled: boolean;
  /** True once we've applied org-level platform defaults at least once. */
  appliedPlatformDefaults: boolean;
  /** Per-key flags: whether the user has explicitly chosen this value. */
  overrides: { theme: boolean; density: boolean; accent: boolean };
  activeModal: string | null;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarHovered: (hovered: boolean) => void;
  setSidebarAutoClose: (autoClose: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setDensity: (density: Density) => void;
  setAccent: (accent: Accent) => void;
  setDirection: (direction: Direction) => void;
  setSidebarStyle: (style: SidebarStyle) => void;
  setNavScope: (scope: NavScope) => void;
  setSparklinesEnabled: (enabled: boolean) => void;
  setAiPanelEnabled: (enabled: boolean) => void;
  /** Apply platform defaults without marking as overrides. No-op for keys
   *  the user has already explicitly set. */
  applyPlatformDefaults: (defaults: {
    theme?: 'light' | 'dark' | 'system';
    density?: Density;
    accent?: Accent;
  }) => void;
  /** Clear override flags and re-apply platform defaults for all three. */
  resetToPlatformDefaults: (defaults: {
    theme?: 'light' | 'dark' | 'system';
    density?: Density;
    accent?: Accent;
  }) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: false, // Start closed on mobile
      sidebarCollapsed: true, // Desktop: start as icon rail
      sidebarHovered: false, // Desktop: not hovered initially
      sidebarAutoClose: true, // Auto-close by default on mobile
      theme: 'light',
      density: 'balanced',
      accent: 'zeus-navy',
      direction: 'ambitious',
      sidebarStyle: 'dark',
      navScope: 'roadmap',
      sparklinesEnabled: true,
      aiPanelEnabled: true,
      appliedPlatformDefaults: false,
      overrides: { theme: false, density: false, accent: false },
      activeModal: null,
      toasts: [],

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarHovered: (hovered) => set({ sidebarHovered: hovered }),

      setSidebarAutoClose: (autoClose) =>
        set({ sidebarAutoClose: autoClose }),

      setTheme: (theme) =>
        set((state) => ({ theme, overrides: { ...state.overrides, theme: true } })),

      setDensity: (density) =>
        set((state) => ({ density, overrides: { ...state.overrides, density: true } })),

      setAccent: (accent) =>
        set((state) => ({ accent, overrides: { ...state.overrides, accent: true } })),

      setDirection: (direction) => set({ direction }),

      setSidebarStyle: (sidebarStyle) => set({ sidebarStyle }),

      setNavScope: (navScope) => set({ navScope }),

      setSparklinesEnabled: (sparklinesEnabled) => set({ sparklinesEnabled }),

      setAiPanelEnabled: (aiPanelEnabled) => set({ aiPanelEnabled }),

      applyPlatformDefaults: (defaults) =>
        set((state) => {
          if (state.appliedPlatformDefaults) return {};
          const next: Partial<UIState> = { appliedPlatformDefaults: true };
          if (defaults.theme && !state.overrides.theme) next.theme = defaults.theme;
          if (defaults.density && !state.overrides.density) next.density = defaults.density;
          if (defaults.accent && !state.overrides.accent) next.accent = defaults.accent;
          return next;
        }),

      resetToPlatformDefaults: (defaults) =>
        set(() => ({
          theme: defaults.theme ?? 'system',
          density: defaults.density ?? 'balanced',
          accent: defaults.accent ?? 'zeus-navy',
          overrides: { theme: false, density: false, accent: false },
          appliedPlatformDefaults: true,
        })),

      openModal: (modalId) => set({ activeModal: modalId }),

      closeModal: () => set({ activeModal: null }),

      addToast: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { ...toast, id: `toast-${Date.now()}` },
          ],
        })),

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarAutoClose: state.sidebarAutoClose,
        theme: state.theme,
        density: state.density,
        accent: state.accent,
        direction: state.direction,
        sidebarStyle: state.sidebarStyle,
        navScope: state.navScope,
        sparklinesEnabled: state.sparklinesEnabled,
        aiPanelEnabled: state.aiPanelEnabled,
        appliedPlatformDefaults: state.appliedPlatformDefaults,
        overrides: state.overrides,
      }),
    }
  )
);
