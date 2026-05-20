/**
 * Subsidiary Context
 * Manages the currently selected subsidiary across the application
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Subsidiary, SubsidiaryStats } from '@/types/subsidiary';
import { DEFAULT_SUBSIDIARIES } from '@/types/subsidiary';

interface SubsidiaryContextType {
  subsidiaries: Subsidiary[];
  currentSubsidiary: Subsidiary | null;
  setCurrentSubsidiary: (subsidiary: Subsidiary) => void;
  stats: SubsidiaryStats | null;
  isLoading: boolean;
}

const SubsidiaryContext = createContext<SubsidiaryContextType | undefined>(undefined);

const STORAGE_KEY = 'dawin-current-subsidiary';

export function SubsidiaryProvider({ children }: { children: ReactNode }) {
  const [subsidiaries] = useState<Subsidiary[]>(DEFAULT_SUBSIDIARIES);
  const [currentSubsidiary, setCurrentSubsidiaryState] = useState<Subsidiary | null>(null);
  const [stats, setStats] = useState<SubsidiaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved subsidiary on mount
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    const activeSubsidiaries = subsidiaries.filter(s => s.status === 'active');
    
    if (savedId) {
      const saved = activeSubsidiaries.find(s => s.id === savedId);
      if (saved) {
        setCurrentSubsidiaryState(saved);
      } else if (activeSubsidiaries.length > 0) {
        setCurrentSubsidiaryState(activeSubsidiaries[0]);
      }
    } else if (activeSubsidiaries.length > 0) {
      setCurrentSubsidiaryState(activeSubsidiaries[0]);
    }
    
    setIsLoading(false);
  }, [subsidiaries]);

  // Load stats when subsidiary changes
  useEffect(() => {
    if (!currentSubsidiary) {
      setStats(null);
      return;
    }

    // Stats are now provided by useDashboardStats hook in UnifiedDashboard
    setStats(null);
  }, [currentSubsidiary]);

  const setCurrentSubsidiary = (subsidiary: Subsidiary) => {
    setCurrentSubsidiaryState(subsidiary);
    localStorage.setItem(STORAGE_KEY, subsidiary.id);
  };

  return (
    <SubsidiaryContext.Provider
      value={{
        subsidiaries,
        currentSubsidiary,
        setCurrentSubsidiary,
        stats,
        isLoading,
      }}
    >
      {children}
    </SubsidiaryContext.Provider>
  );
}

export function useSubsidiary() {
  const context = useContext(SubsidiaryContext);
  if (context === undefined) {
    throw new Error('useSubsidiary must be used within a SubsidiaryProvider');
  }
  return context;
}
