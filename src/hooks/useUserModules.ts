/**
 * useUserModules Hook
 * Derives the list of accessible modules for the current user
 * based on DawinUser.subsidiaryAccess + currentSubsidiary
 */

import { useMemo } from 'react';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import type { SubsidiaryModule } from '@/types/subsidiary';

const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group'];

export interface ModuleInfo {
  moduleId: SubsidiaryModule;
  hasAccess: boolean;
  label: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  hasRealData: boolean;
}

// Module metadata — single source of truth for dashboard rendering. After
// Phase 1.C this only lists the modules that currently have UI + routes.
// Phase 3 will flip `hasRealData` to true on campaigns/media/production/talent/
// asset-library once those modules land.
const MODULE_REGISTRY: Record<SubsidiaryModule, Omit<ModuleInfo, 'moduleId' | 'hasAccess'>> = {
  // ─── Sub-brand-scoped modules (Phase 3+ build) ─────────────────────────
  'campaigns': {
    label: 'Campaigns',
    description: 'Client→Brand→Campaign→Job hierarchy with the 14-stage Zeus workflow',
    icon: 'Megaphone',
    href: '/campaigns',
    color: 'bg-[#E63946]',
    hasRealData: false,
  },
  'media': {
    label: 'Media Plan & Buying',
    description: 'Channel mix, vehicle × date × spend grid, post-campaign reporting',
    icon: 'Tv',
    href: '/media',
    color: 'bg-[#7E22CE]',
    hasRealData: false,
  },
  'production': {
    label: 'Production',
    description: 'Film/photo/audio shoots — pre-prod, schedule, post, delivery',
    icon: 'Video',
    href: '/production',
    color: 'bg-[#F59E0B]',
    hasRealData: false,
  },
  'talent': {
    label: 'Talent Roster',
    description: 'Freelancer + influencer database, rate cards, NDAs, payments',
    icon: 'Users',
    href: '/talent',
    color: 'bg-[#10B981]',
    hasRealData: false,
  },
  'asset-library': {
    label: 'Asset Library',
    description: 'Approved campaign assets + client brand kits (DAM-lite)',
    icon: 'Image',
    href: '/asset-library',
    color: 'bg-[#0EA5E9]',
    hasRealData: false,
  },

  // ─── Cross-subsidiary corporate modules (kept from DawinOS) ────────────
  'asset-registry': {
    label: 'Asset Registry',
    description: 'Cameras, lighting, edit stations, vehicles — corporate fixed assets',
    icon: 'Wrench',
    href: '/assets',
    color: 'bg-amber-500',
    hasRealData: true,
  },
  'market_intelligence': {
    label: 'Market Intelligence',
    description: 'Competitor + market analysis for client briefs',
    icon: 'Globe',
    href: '/market-intel/competitors',
    color: 'bg-cyan-700',
    hasRealData: false,
  },
  'strategy': {
    label: 'Strategy',
    description: 'Group OKRs, KPIs, Executive Dashboard',
    icon: 'Target',
    href: '/strategy',
    color: 'bg-violet-600',
    hasRealData: true,
  },
  'hr': {
    label: 'HR Central',
    description: 'Staff, leave, payroll, performance, org structure',
    icon: 'Users',
    href: '/hr/employees',
    color: 'bg-teal-600',
    hasRealData: true,
  },
  'finance': {
    label: 'Finance',
    description: 'CFO briefing, spend plan, cash forecast, expenditures',
    icon: 'DollarSign',
    href: '/finance',
    color: 'bg-emerald-600',
    hasRealData: false,
  },
  'capital': {
    label: 'Capital Hub',
    description: 'Capital seeking, readiness & application tracking',
    icon: 'Building2',
    href: '/capital',
    color: 'bg-emerald-700',
    hasRealData: true,
  },
  'compliance': {
    label: 'Compliance',
    description: 'Document register, obligations, UAA membership renewal',
    icon: 'Shield',
    href: '/compliance',
    color: 'bg-emerald-600',
    hasRealData: true,
  },
  'intelligence-layer': {
    label: 'AI Intelligence',
    description: 'Cross-module insights, Smart Tasks, manager dashboards',
    icon: 'Brain',
    href: '/intelligence',
    color: 'bg-purple-700',
    hasRealData: true,
  },
};

// Corporate modules available across all subsidiaries — shown in the "Group"
// section of the sidebar rather than under any one sub-brand.
const CORPORATE_MODULE_IDS: SubsidiaryModule[] = [
  'strategy',
  'hr',
  'finance',
  'market_intelligence',
  'capital',
  'compliance',
  'intelligence-layer',
  'asset-registry',
];

export function useUserModules() {
  const { user } = useAuth();
  const { dawinUser, isLoading: userLoading } = useCurrentDawinUser();
  const { currentSubsidiary, isLoading: subLoading } = useSubsidiary();

  const isSuperUser = !!(user?.email && SUPER_USER_EMAILS.includes(user.email));
  const isAdmin = isSuperUser || (dawinUser ? ['admin', 'owner'].includes(dawinUser.globalRole) : false);

  // Derive accessible subsidiary modules
  const subsidiaryModules = useMemo((): ModuleInfo[] => {
    if (!currentSubsidiary) return [];

    const subModuleIds = currentSubsidiary.modules.filter(
      (m) => !CORPORATE_MODULE_IDS.includes(m)
    );

    return subModuleIds
      .map((moduleId) => {
        const meta = MODULE_REGISTRY[moduleId];
        if (!meta) return null;

        // Determine access — check ANY subsidiaryAccess entry (matches ModuleGuard behavior)
        let hasAccess = false;
        if (isSuperUser || isAdmin) {
          hasAccess = true;
        } else if (dawinUser?.subsidiaryAccess) {
          hasAccess = dawinUser.subsidiaryAccess.some(
            (sa) =>
              sa.hasAccess &&
              sa.modules?.some((m) => m.moduleId === moduleId && m.hasAccess)
          );
        }

        return { moduleId, hasAccess, ...meta };
      })
      .filter(Boolean) as ModuleInfo[];
  }, [currentSubsidiary, dawinUser, isSuperUser, isAdmin]);

  // Derive accessible corporate modules
  const corporateModules = useMemo((): ModuleInfo[] => {
    return CORPORATE_MODULE_IDS
      .map((moduleId) => {
        const meta = MODULE_REGISTRY[moduleId];
        if (!meta) return null;

        // Corporate modules: admins/owners always have access
        // Members need explicit module access in any subsidiary
        let hasAccess = false;
        if (isSuperUser || isAdmin) {
          hasAccess = true;
        } else if (dawinUser?.subsidiaryAccess) {
          hasAccess = dawinUser.subsidiaryAccess.some(
            (sa) =>
              sa.hasAccess &&
              sa.modules?.some((m) => m.moduleId === moduleId && m.hasAccess)
          );
        }

        return { moduleId, hasAccess, ...meta };
      })
      .filter(Boolean) as ModuleInfo[];
  }, [dawinUser, isSuperUser, isAdmin]);

  // All accessible modules (for stats)
  const allAccessibleModuleIds = useMemo(() => {
    const all = [...subsidiaryModules, ...corporateModules];
    return all.filter((m) => m.hasAccess).map((m) => m.moduleId);
  }, [subsidiaryModules, corporateModules]);

  return {
    subsidiaryModules,
    corporateModules,
    allAccessibleModuleIds,
    isAdmin,
    isSuperUser,
    isLoading: userLoading || subLoading,
  };
}
