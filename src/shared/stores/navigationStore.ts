/**
 * Navigation Store
 * Manages navigation state: favorites, recent items, sidebar preferences
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavigationState {
  // Favorites
  favoriteItems: string[];
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  
  // Recent items
  recentItems: string[];
  addRecentItem: (id: string) => void;
  clearRecentItems: () => void;
  
  // Sidebar state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  
  // Expanded sections in sidebar
  expandedSections: string[];
  toggleSection: (sectionId: string) => void;
  setExpandedSections: (sections: string[]) => void;
  
  // Active subsidiary
  activeSubsidiary: string;
  setActiveSubsidiary: (subsidiaryId: string) => void;
}

const MAX_RECENT_ITEMS = 10;

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      // Favorites
      favoriteItems: [],
      addFavorite: (id) => {
        set((state) => ({
          favoriteItems: state.favoriteItems.includes(id)
            ? state.favoriteItems
            : [...state.favoriteItems, id],
        }));
      },
      removeFavorite: (id) => {
        set((state) => ({
          favoriteItems: state.favoriteItems.filter((item) => item !== id),
        }));
      },

      // Recent items
      recentItems: [],
      addRecentItem: (id) => {
        set((state) => {
          const filtered = state.recentItems.filter((item) => item !== id);
          return {
            recentItems: [id, ...filtered].slice(0, MAX_RECENT_ITEMS),
          };
        });
      },
      clearRecentItems: () => {
        set({ recentItems: [] });
      },

      // Sidebar state
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      // Expanded sections
      expandedSections: [],
      toggleSection: (sectionId) => {
        set((state) => ({
          expandedSections: state.expandedSections.includes(sectionId)
            ? state.expandedSections.filter((id) => id !== sectionId)
            : [...state.expandedSections, sectionId],
        }));
      },
      setExpandedSections: (sections) => {
        set({ expandedSections: sections });
      },

      // Active subsidiary
      activeSubsidiary: 'dawin-finishes',
      setActiveSubsidiary: (subsidiaryId) => {
        set({ activeSubsidiary: subsidiaryId });
      },
    }),
    {
      name: 'dawinos-navigation',
      partialize: (state) => ({
        favoriteItems: state.favoriteItems,
        recentItems: state.recentItems,
        sidebarCollapsed: state.sidebarCollapsed,
        expandedSections: state.expandedSections,
        activeSubsidiary: state.activeSubsidiary,
      }),
    }
  )
);
