/**
 * Admin Bottom Navigation State Management
 * Zustand store for managing admin bottom navbar state with persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AdminBottomNavState, ActivePageInfo } from '@/components/AdminBottomNav/types';

// Extended state type to include hydration tracking
interface AdminBottomNavStateExtended extends AdminBottomNavState {
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useAdminBottomNav = create<AdminBottomNavStateExtended>()(
  persist(
    (set) => ({
      activeNavId: null,
      isExpanded: false,
      isMoreMenuOpen: false,
      activePage: null,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setActiveNav: (id) =>
        set({
          activeNavId: id
        }),

      // Switch to a specific nav group and expand submenu
      switchToNav: (id) =>
        set({
          activeNavId: id,
          isExpanded: true,
          isMoreMenuOpen: false
        }),

      setExpanded: (expanded) =>
        set({
          isExpanded: expanded
        }),

      setMoreMenuOpen: (open) =>
        set({
          isMoreMenuOpen: open,
          isExpanded: false
        }),

      setActivePage: (page) =>
        set({
          activePage: page
        }),

      resetState: () =>
        set({
          activeNavId: null,
          isExpanded: false,
          isMoreMenuOpen: false,
          activePage: null
        })
    }),
    {
      name: 'admin-bottom-nav-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist serializable parts of activePage (icon is a component, not serializable)
        activePage: state.activePage ? {
          href: state.activePage.href,
          label: state.activePage.label,
          groupLabel: state.activePage.groupLabel
        } : null
      }),
      // Track when hydration completes
      onRehydrateStorage: () => (state) => {
        // Set hydration complete flag
        state?.setHasHydrated(true);
      }
    }
  )
);

// Helper hook to wait for hydration
export const useAdminBottomNavHydration = () => {
  return useAdminBottomNav((state) => state._hasHydrated);
};
