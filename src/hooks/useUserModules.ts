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

const SUPER_USER_EMAILS = ['onzimai@dawin.group'];

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

// Module metadata — single source of truth for dashboard rendering
const MODULE_REGISTRY: Record<SubsidiaryModule, Omit<ModuleInfo, 'moduleId' | 'hasAccess'>> = {
  'design-manager': {
    label: 'Design Manager',
    description: 'Manage projects, design items, and production optimization',
    icon: 'Palette',
    href: '/design',
    color: 'bg-[#872E5C]',
    hasRealData: true,
  },
  'clipper': {
    label: 'Clip Library',
    description: 'Design inspiration clips from the web',
    icon: 'Sparkles',
    href: '/clipper',
    color: 'bg-indigo-600',
    hasRealData: true,
  },
  'asset-registry': {
    label: 'Asset Registry',
    description: 'Manage workshop machines and tools',
    icon: 'Wrench',
    href: '/assets',
    color: 'bg-amber-500',
    hasRealData: true,
  },
  'feature-library': {
    label: 'Feature Library',
    description: 'Manufacturing capabilities linked to assets',
    icon: 'Layers',
    href: '/design/features',
    color: 'bg-purple-600',
    hasRealData: true,
  },
  'launch-pipeline': {
    label: 'Launch Pipeline',
    description: 'Manage product launches and roadmap',
    icon: 'Rocket',
    href: '/launch-pipeline',
    color: 'bg-rose-600',
    hasRealData: true,
  },
  'procurement': {
    label: 'Procurement',
    description: 'Material procurement and supplier orders',
    icon: 'ShoppingCart',
    href: '/manufacturing/purchase-orders',
    color: 'bg-cyan-600',
    hasRealData: true,
  },
  'production': {
    label: 'Production',
    description: 'Track production progress and scheduling',
    icon: 'Factory',
    href: '/manufacturing',
    color: 'bg-slate-600',
    hasRealData: true,
  },
  'construction': {
    label: 'Construction',
    description: 'On-site execution & contractor work orders',
    icon: 'HardHat',
    href: '/construction',
    color: 'bg-amber-700',
    hasRealData: true,
  },
  'matflow': {
    label: 'MatFlow',
    description: 'Material flow tracking and project management',
    icon: 'HardHat',
    href: '/advisory/matflow',
    color: 'bg-amber-600',
    hasRealData: true,
  },
  'investment_advisory': {
    label: 'Investment Advisory',
    description: 'Deal pipeline & portfolio management',
    icon: 'Briefcase',
    href: '/advisory/investment',
    color: 'bg-green-600',
    hasRealData: true,
  },
  'infrastructure_delivery': {
    label: 'Infrastructure Delivery',
    description: 'Construction project delivery',
    icon: 'Building2',
    href: '/advisory/delivery',
    color: 'bg-blue-600',
    hasRealData: true,
  },
  'marketing': {
    label: 'Marketing Hub',
    description: 'Campaigns, social media & analytics',
    icon: 'Megaphone',
    href: '/marketing',
    color: 'bg-pink-600',
    hasRealData: true,
  },
  'inventory': {
    label: 'Inventory',
    description: 'Stock management & material tracking',
    icon: 'Package',
    href: '/inventory',
    color: 'bg-orange-600',
    hasRealData: true,
  },
  'market_intelligence': {
    label: 'Market Intelligence',
    description: 'Competitive analysis & market research',
    icon: 'Globe',
    href: '/market-intel/competitors',
    color: 'bg-cyan-700',
    hasRealData: false,
  },
  'strategy': {
    label: 'CEO Strategy',
    description: 'Strategic planning, OKRs & KPIs',
    icon: 'Target',
    href: '/strategy',
    color: 'bg-violet-600',
    hasRealData: true,
  },
  'hr': {
    label: 'HR Central',
    description: 'Human resources & performance management',
    icon: 'Users',
    href: '/hr/employees',
    color: 'bg-teal-600',
    hasRealData: true,
  },
  'finance': {
    label: 'Finance',
    description: 'Financial management & reporting',
    icon: 'DollarSign',
    href: '/finance/budgets',
    color: 'bg-emerald-600',
    hasRealData: false,
  },
  'crm': {
    label: 'CRM',
    description: 'Sales pipeline & deal tracking',
    icon: 'Users',
    href: '/crm',
    color: 'bg-blue-500',
    hasRealData: true,
  },
  'customer-hub': {
    label: 'Customer Hub',
    description: 'Customer management & lifecycle tracking',
    icon: 'UserCircle',
    href: '/customers',
    color: 'bg-sky-600',
    hasRealData: true,
  },
  'whatsapp': {
    label: 'WhatsApp',
    description: 'WhatsApp communication inbox',
    icon: 'MessageCircle',
    href: '/whatsapp',
    color: 'bg-green-500',
    hasRealData: true,
  },
  'capital': {
    label: 'Capital Hub',
    description: 'Capital planning, readiness & application tracking',
    icon: 'Building2',
    href: '/capital/dashboard',
    color: 'bg-emerald-700',
    hasRealData: true,
  },
  'design-studio': {
    label: 'Design Studio',
    description: '3D model viewer, configurator & print package generator',
    icon: 'Box',
    href: '/workshop',
    color: 'bg-[#1B2A4A]',
    hasRealData: true,
  },
  'sales-orders': {
    label: 'Sales Orders',
    description: 'Commercial protection & approval gate tracking',
    icon: 'FileCheck',
    href: '/sales-orders',
    color: 'bg-orange-500',
    hasRealData: true,
  },
  'intelligence-layer': {
    label: 'AI Intelligence',
    description: 'Smart guidance for daily tasks & workflows',
    icon: 'Brain',
    href: '/ai',
    color: 'bg-purple-700',
    hasRealData: true,
  },
  'compliance': {
    label: 'Compliance',
    description: 'Document management & regulatory compliance',
    icon: 'Shield',
    href: '/compliance',
    color: 'bg-emerald-600',
    hasRealData: true,
  },
  'suppliers': {
    label: 'Suppliers',
    description: 'Vendor & supplier management',
    icon: 'Building2',
    href: '/suppliers',
    color: 'bg-stone-600',
    hasRealData: true,
  },
  'workshop-viewer': {
    label: 'Workshop Viewer',
    description: '3D model viewer with cut lists and print packages',
    icon: 'Box',
    href: '/workshop-viewer',
    color: 'bg-slate-700',
    hasRealData: true,
  },
};

// Corporate modules available across subsidiaries (shown separately)
const CORPORATE_MODULE_IDS: SubsidiaryModule[] = [
  'strategy',
  'hr',
  'finance',
  'market_intelligence',
  'capital',
  'compliance',
  'intelligence-layer',
  'suppliers',
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
