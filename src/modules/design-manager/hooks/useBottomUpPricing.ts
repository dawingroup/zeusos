/**
 * useBottomUpPricing Hook
 * Manages state for the bottom-up pricing calculator and
 * provides CRUD operations for disciplines, deliverables, and pass-through costs.
 */

import { useState, useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import type {
  BottomUpPricingProposal,
  BottomUpPricingResult,
  BottomUpPricingConfig,
  PricingDiscipline,
  PricingDeliverable,
  PricingDisciplineEntry,
  LogisticsCostItem,
  ExternalStudyItem,
  StaffRole,
} from '../types/bottomUpPricing';
import { DEFAULT_BOTTOM_UP_PRICING_CONFIG } from '../types/bottomUpPricing';
import { calculateBottomUpPricing, prepopulateFromStrategy } from '../services/bottomUpPricingService';
import type { ScopedDeliverable, BudgetTier } from '../types/strategy';

function createEmptyProposal(): BottomUpPricingProposal {
  return {
    id: nanoid(10),
    projectName: '',
    disciplines: [],
    logistics: [],
    externalStudies: [],
    adminFeePercent: DEFAULT_BOTTOM_UP_PRICING_CONFIG.adminFeePercent,
    currency: DEFAULT_BOTTOM_UP_PRICING_CONFIG.currency,
  };
}

export interface UseBottomUpPricingReturn {
  // State
  proposal: BottomUpPricingProposal;
  config: BottomUpPricingConfig;
  result: BottomUpPricingResult;

  // Project
  setProjectName: (name: string) => void;

  // Config
  updateRoleRate: (role: StaffRole, rate: number) => void;
  setAdminFeePercent: (pct: number) => void;

  // Disciplines
  addDiscipline: (discipline: PricingDiscipline) => void;
  removeDiscipline: (disciplineId: string) => void;

  // Deliverables
  addDeliverable: (disciplineId: string, name: string) => void;
  updateDeliverable: (disciplineId: string, deliverableId: string, updates: Partial<PricingDeliverable>) => void;
  removeDeliverable: (disciplineId: string, deliverableId: string) => void;

  // Logistics
  addLogisticsItem: (description: string, amount: number) => void;
  updateLogisticsItem: (id: string, updates: Partial<LogisticsCostItem>) => void;
  removeLogisticsItem: (id: string) => void;

  // External Studies
  addExternalStudy: (description: string, amount: number) => void;
  updateExternalStudy: (id: string, updates: Partial<ExternalStudyItem>) => void;
  removeExternalStudy: (id: string) => void;

  // Strategy Integration
  prepopulateFromStrategyDeliverables: (
    scopedDeliverables: ScopedDeliverable[],
    budgetTier?: BudgetTier
  ) => void;

  // Reset
  resetProposal: () => void;
}

export function useBottomUpPricing(): UseBottomUpPricingReturn {
  const [proposal, setProposal] = useState<BottomUpPricingProposal>(createEmptyProposal);
  const [config, setConfig] = useState<BottomUpPricingConfig>(DEFAULT_BOTTOM_UP_PRICING_CONFIG);

  // Recalculate whenever proposal or config changes
  const result = useMemo(() => calculateBottomUpPricing(proposal, config), [proposal, config]);

  // ---- Project ----
  const setProjectName = useCallback((name: string) => {
    setProposal((prev) => ({ ...prev, projectName: name }));
  }, []);

  // ---- Config ----
  const updateRoleRate = useCallback((role: StaffRole, rate: number) => {
    setConfig((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.id === role ? { ...r, hourlyRate: rate } : r)),
    }));
  }, []);

  const setAdminFeePercent = useCallback((pct: number) => {
    setProposal((prev) => ({ ...prev, adminFeePercent: pct }));
  }, []);

  // ---- Disciplines ----
  const addDiscipline = useCallback((discipline: PricingDiscipline) => {
    setProposal((prev) => {
      if (prev.disciplines.some((d) => d.discipline === discipline)) return prev;
      const entry: PricingDisciplineEntry = {
        id: nanoid(8),
        discipline,
        deliverables: [],
      };
      return { ...prev, disciplines: [...prev.disciplines, entry] };
    });
  }, []);

  const removeDiscipline = useCallback((disciplineId: string) => {
    setProposal((prev) => ({
      ...prev,
      disciplines: prev.disciplines.filter((d) => d.id !== disciplineId),
    }));
  }, []);

  // ---- Deliverables ----
  const addDeliverable = useCallback((disciplineId: string, name: string) => {
    setProposal((prev) => ({
      ...prev,
      disciplines: prev.disciplines.map((disc) => {
        if (disc.id !== disciplineId) return disc;
        const newDel: PricingDeliverable = {
          id: nanoid(8),
          name,
          estimatedHours: 0,
          role: 'mid-level-architect',
          designStage: 'schematic',
        };
        return { ...disc, deliverables: [...disc.deliverables, newDel] };
      }),
    }));
  }, []);

  const updateDeliverable = useCallback(
    (disciplineId: string, deliverableId: string, updates: Partial<PricingDeliverable>) => {
      setProposal((prev) => ({
        ...prev,
        disciplines: prev.disciplines.map((disc) => {
          if (disc.id !== disciplineId) return disc;
          return {
            ...disc,
            deliverables: disc.deliverables.map((del) =>
              del.id === deliverableId ? { ...del, ...updates } : del
            ),
          };
        }),
      }));
    },
    []
  );

  const removeDeliverable = useCallback((disciplineId: string, deliverableId: string) => {
    setProposal((prev) => ({
      ...prev,
      disciplines: prev.disciplines.map((disc) => {
        if (disc.id !== disciplineId) return disc;
        return { ...disc, deliverables: disc.deliverables.filter((d) => d.id !== deliverableId) };
      }),
    }));
  }, []);

  // ---- Logistics ----
  const addLogisticsItem = useCallback((description: string, amount: number) => {
    setProposal((prev) => ({
      ...prev,
      logistics: [...prev.logistics, { id: nanoid(8), description, amount }],
    }));
  }, []);

  const updateLogisticsItem = useCallback((id: string, updates: Partial<LogisticsCostItem>) => {
    setProposal((prev) => ({
      ...prev,
      logistics: prev.logistics.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  }, []);

  const removeLogisticsItem = useCallback((id: string) => {
    setProposal((prev) => ({
      ...prev,
      logistics: prev.logistics.filter((l) => l.id !== id),
    }));
  }, []);

  // ---- External Studies ----
  const addExternalStudy = useCallback((description: string, amount: number) => {
    setProposal((prev) => ({
      ...prev,
      externalStudies: [...prev.externalStudies, { id: nanoid(8), description, amount }],
    }));
  }, []);

  const updateExternalStudy = useCallback((id: string, updates: Partial<ExternalStudyItem>) => {
    setProposal((prev) => ({
      ...prev,
      externalStudies: prev.externalStudies.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  }, []);

  const removeExternalStudy = useCallback((id: string) => {
    setProposal((prev) => ({
      ...prev,
      externalStudies: prev.externalStudies.filter((s) => s.id !== id),
    }));
  }, []);

  // ---- Strategy Integration ----
  const prepopulateFromStrategyDeliverables = useCallback(
    (scopedDeliverables: ScopedDeliverable[], budgetTier?: BudgetTier) => {
      const prepopulated = prepopulateFromStrategy(scopedDeliverables, budgetTier);

      setProposal((prev) => {
        // Create discipline entries with generated IDs
        const newDisciplines: PricingDisciplineEntry[] = prepopulated.disciplines.map((disc) => ({
          id: nanoid(8),
          discipline: disc.discipline,
          deliverables: disc.deliverables,
        }));

        // Merge with existing disciplines (avoid duplicates)
        const existingDisciplineTypes = new Set(prev.disciplines.map((d) => d.discipline));
        const filteredNewDisciplines = newDisciplines.filter(
          (d) => !existingDisciplineTypes.has(d.discipline)
        );

        return {
          ...prev,
          disciplines: [...prev.disciplines, ...filteredNewDisciplines],
        };
      });
    },
    []
  );

  // ---- Reset ----
  const resetProposal = useCallback(() => {
    setProposal(createEmptyProposal());
    setConfig(DEFAULT_BOTTOM_UP_PRICING_CONFIG);
  }, []);

  return {
    proposal,
    config,
    result,
    setProjectName,
    updateRoleRate,
    setAdminFeePercent,
    addDiscipline,
    removeDiscipline,
    addDeliverable,
    updateDeliverable,
    removeDeliverable,
    addLogisticsItem,
    updateLogisticsItem,
    removeLogisticsItem,
    addExternalStudy,
    updateExternalStudy,
    removeExternalStudy,
    prepopulateFromStrategyDeliverables,
    resetProposal,
  };
}
