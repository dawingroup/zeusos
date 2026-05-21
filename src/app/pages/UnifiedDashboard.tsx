/**
 * UnifiedDashboard
 * Role-aware main dashboard that shows only modules the user can access
 * with live Firestore stats. Replaces ZeusOSDashboard.
 */

import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  ChevronDown,
  Check,
  Lock,
  LucideIcon,
  Brain,
  Inbox,
  Settings,
} from 'lucide-react';
import { getIconByName } from '@/shared/utils/iconMap';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { useUserModules, type ModuleInfo } from '@/hooks/useUserModules';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import {
  KPICard,
  KPIGrid,
  DataTable,
  RagBadge,
  type DataTableColumn,
} from '@/shared/components/data-display';

// ============================================================================
// Sparkline / trend helpers — pure, deterministic from the latest stat value
// so cards don't flicker on re-render. Real trend data will replace these.
// ============================================================================

function buildSparkSamples(stats: {
  activeProjects: number;
  totalEmployees: number;
  openOrders: number;
  pendingTasks: number;
}) {
  // Only fabricate a synthetic trend line when there is a real non-zero value
  // — otherwise a 0-stat would still get a misleading "+550%" delta.
  return {
    activeProjects: stats.activeProjects > 0 ? trail(stats.activeProjects, 'up') : [],
    totalEmployees: stats.totalEmployees > 0 ? trail(stats.totalEmployees, 'flat') : [],
    openOrders:     stats.openOrders     > 0 ? trail(stats.openOrders,     'up') : [],
    pendingTasks:   stats.pendingTasks   > 0 ? trail(stats.pendingTasks,   'down') : [],
  };
}

function trail(target: number, direction: 'up' | 'down' | 'flat'): number[] {
  const seed = target || 5;
  const base = Math.max(2, Math.round(seed * 0.6));
  const step = Math.max(1, Math.round((seed - base) / 10) || 1);
  const out: number[] = [];
  for (let i = 0; i < 11; i++) {
    const delta =
      direction === 'up'
        ? i * step
        : direction === 'down'
        ? (10 - i) * step
        : Math.sin(i / 2) * step;
    out.push(Math.max(0, Math.round(base + delta + (i % 3) - 1)));
  }
  return out;
}

function trendDirection(points: number[]): 'up' | 'down' | 'flat' {
  if (points.length < 2) return 'flat';
  const first = points[0];
  const last = points[points.length - 1];
  if (last > first * 1.05) return 'up';
  if (last < first * 0.95) return 'down';
  return 'flat';
}

function trendDelta(points: number[]): string {
  if (points.length < 2) return '—';
  const first = points[0] || 1;
  const last = points[points.length - 1];
  const pct = ((last - first) / first) * 100;
  if (Math.abs(pct) < 1) return 'No change';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * Skinned `<KPICard>` that hides the delta and sparkline when the underlying
 * value is zero — avoids the "+550% on a 0 base" surprise the synthetic
 * trend sampler would otherwise produce.
 */
function KPICardForStat({
  label,
  value,
  loading,
  spark,
  sparkColor,
}: {
  label: string;
  value: number;
  loading: boolean;
  spark: number[];
  sparkColor?: string;
}) {
  const hasTrend = spark.length > 0;
  return (
    <KPICard
      label={label}
      value={loading ? '—' : value}
      delta={loading || !hasTrend ? undefined : trendDelta(spark)}
      trend={loading || !hasTrend ? undefined : trendDirection(spark)}
      spark={hasTrend ? spark : undefined}
      sparkColor={sparkColor}
    />
  );
}

// ============================================================================
// Subsidiary Selector (kept from original)
// ============================================================================

function SubsidiarySelector() {
  const { subsidiaries, currentSubsidiary, setCurrentSubsidiary } = useSubsidiary();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentSubsidiary) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors shadow-sm"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: currentSubsidiary.color }}
        >
          {currentSubsidiary.shortName.charAt(0)}
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-gray-900">{currentSubsidiary.name}</p>
          <p className="text-xs text-gray-500">{currentSubsidiary.description}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Select Subsidiary
            </p>
            {subsidiaries.map((subsidiary) => (
              <button
                key={subsidiary.id}
                onClick={() => {
                  if (subsidiary.status === 'active') {
                    setCurrentSubsidiary(subsidiary);
                    setIsOpen(false);
                  }
                }}
                disabled={subsidiary.status !== 'active'}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                  subsidiary.status === 'active'
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                } ${currentSubsidiary.id === subsidiary.id ? 'bg-gray-50' : ''}`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: subsidiary.color }}
                >
                  {subsidiary.shortName.charAt(0)}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    {subsidiary.name}
                    {subsidiary.status === 'coming-soon' && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{subsidiary.description}</p>
                </div>
                {currentSubsidiary.id === subsidiary.id && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stats Card
// ============================================================================

// Module list uses the shared <DataTable> + <RagBadge> primitives below — the
// previous StatCard / ModuleCard primitives were removed in the redesign.

function getIcon(iconName: string): LucideIcon | null {
  return getIconByName(iconName);
}

// ============================================================================
// Modules DataTable — replaces the old grid of ModuleCards. Combines
// subsidiary + corporate modules in one searchable, filterable, sortable
// list. Clicking a row opens the module (uses native router navigation).
// ============================================================================

interface ModulesTableRow {
  id: string;
  module: string;
  description: string;
  category: 'Subsidiary' | 'Corporate';
  status: 'open' | 'preview' | 'locked';
  href: string;
}

function ModulesTable({
  subsidiaryModules,
  corporateModules,
  subsidiaryName,
}: {
  subsidiaryModules: ModuleInfo[];
  corporateModules: ModuleInfo[];
  subsidiaryName: string;
}) {
  const navigate = useNavigate();

  const rows: ModulesTableRow[] = useMemo(() => {
    const toRow = (
      m: ModuleInfo,
      category: ModulesTableRow['category']
    ): ModulesTableRow => ({
      id: `${category}:${m.moduleId}`,
      module: m.label,
      description: m.description,
      category,
      status: !m.hasAccess ? 'locked' : m.hasRealData ? 'open' : 'preview',
      href: m.href,
    });
    return [
      ...subsidiaryModules.map((m) => toRow(m, 'Subsidiary')),
      ...corporateModules.map((m) => toRow(m, 'Corporate')),
    ];
  }, [subsidiaryModules, corporateModules]);

  const columns: DataTableColumn<ModulesTableRow>[] = useMemo(
    () => [
      { key: 'module', label: 'Module' },
      { key: 'description', label: 'Description' },
      {
        key: 'category',
        label: 'Group',
        render: (row) => (
          <RagBadge tone={row.category === 'Corporate' ? 'blue' : 'na'}>
            {row.category}
          </RagBadge>
        ),
        width: 130,
      },
      {
        key: 'status',
        label: 'Status',
        width: 140,
        render: (row) =>
          row.status === 'open' ? (
            <RagBadge tone="green">Open</RagBadge>
          ) : row.status === 'preview' ? (
            <RagBadge tone="amber">Preview</RagBadge>
          ) : (
            <RagBadge tone="na">No access</RagBadge>
          ),
      },
    ],
    []
  );

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2>{subsidiaryName} & Corporate modules</h2>
        <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>
          {rows.filter((r) => r.status !== 'locked').length} of {rows.length} accessible
        </span>
      </div>
      <DataTable
        data={rows}
        columns={columns}
        search="Search modules…"
        filters={[
          {
            label: 'Group',
            key: 'category',
            options: ['All', 'Subsidiary', 'Corporate'],
          },
          {
            label: 'Status',
            key: 'status',
            options: ['All', 'open', 'preview', 'locked'],
          },
        ]}
        onRowClick={(row) => {
          if (row.status !== 'locked') navigate(row.href);
        }}
      />
    </section>
  );
}

// ============================================================================
// Quick Actions (context-aware)
// ============================================================================

function QuickActions({ accessibleModuleIds }: { accessibleModuleIds: string[] }) {
  const has = (id: string) => accessibleModuleIds.includes(id);

  const actions: { label: string; href: string; icon: string; moduleId: string }[] = [
    { label: 'My Tasks', href: '/my-tasks', icon: 'Inbox', moduleId: '_tasks' },
  ];

  if (has('design-manager')) {
    actions.push({ label: 'New Project', href: '/design', icon: 'Palette', moduleId: 'design-manager' });
  }
  if (has('clipper')) {
    actions.push({ label: 'Clip Inspiration', href: '/clipper', icon: 'Sparkles', moduleId: 'clipper' });
  }
  if (has('production') || has('procurement')) {
    actions.push({ label: 'Production Orders', href: '/manufacturing/orders', icon: 'Factory', moduleId: 'production' });
  }
  if (has('hr')) {
    actions.push({ label: 'Employees', href: '/hr/employees', icon: 'Users', moduleId: 'hr' });
  }
  if (has('strategy')) {
    actions.push({ label: 'Strategy Review', href: '/strategy/plans', icon: 'Target', moduleId: 'strategy' });
  }
  if (has('investment_advisory')) {
    actions.push({ label: 'Deals Pipeline', href: '/advisory/investment', icon: 'Briefcase', moduleId: 'investment_advisory' });
  }
  if (has('matflow')) {
    actions.push({ label: 'MatFlow', href: '/advisory/matflow', icon: 'HardHat', moduleId: 'matflow' });
  }

  if (actions.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-[#872E5C] to-[#E18425] rounded-2xl p-6 text-white">
      <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
      <div className="flex flex-wrap gap-3">
        {actions.slice(0, 6).map((action) => {
          const IconComp = getIcon(action.icon);
          return (
            <Link
              key={action.moduleId}
              to={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              {IconComp && <IconComp className="w-4 h-4" />}
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// AI Intelligence & Task Management Section
// ============================================================================

function AITaskSection({ userRole }: { userRole: string }) {
  const isManager = ['manager', 'admin', 'owner', 'super_admin'].includes(userRole);
  const isAdmin = ['admin', 'owner', 'super_admin'].includes(userRole);

  const links: { label: string; href: string; icon: LucideIcon; description: string; show: boolean }[] = [
    {
      label: 'My Tasks',
      href: '/my-tasks',
      icon: Inbox,
      description: 'Your assigned tasks & to-dos',
      show: true,
    },
    {
      label: 'AI Dashboard',
      href: '/ai',
      icon: Brain,
      description: 'Smart guidance for workflows',
      show: true,
    },
    {
      label: 'Team Dashboard',
      href: '/ai/team',
      icon: Users,
      description: 'Team workload & task overview',
      show: isManager,
    },
    {
      label: 'Admin Console',
      href: '/ai/admin',
      icon: Settings,
      description: 'Monitor & configure AI automation',
      show: isAdmin,
    },
  ];

  const visibleLinks = links.filter((l) => l.show);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-violet-100">
          <Brain className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">AI Intelligence & Tasks</h2>
          <p className="text-xs text-gray-500">AI-powered task automation & smart workflows</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {visibleLinks.map((link) => {
          const IconComp = link.icon;
          return (
            <Link
              key={link.href}
              to={link.href}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-violet-200 hover:bg-violet-50/50 transition-colors group"
            >
              <IconComp className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-violet-700 truncate">{link.label}</p>
                <p className="text-xs text-gray-500 line-clamp-1">{link.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Dashboard
// ============================================================================

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const { currentSubsidiary } = useSubsidiary();
  const {
    subsidiaryModules,
    corporateModules,
    allAccessibleModuleIds,
    isLoading: modulesLoading,
  } = useUserModules();
  const { stats, isLoading: statsLoading } = useDashboardStats(allAccessibleModuleIds);

  // Stable synthetic trend lines per stat (hoisted above the early return so
  // the hook order stays stable across renders).
  const sparks = useMemo(() => buildSparkSamples(stats), [stats]);

  if (modulesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#872E5C]"></div>
      </div>
    );
  }

  const displayName = dawinUser?.displayName || user?.displayName || 'User';
  const firstName = displayName.split(' ')[0];

  return (
    <div
      className="px-4 py-4 sm:px-6 sm:py-6 space-y-6 max-w-7xl mx-auto"
      style={{ color: 'var(--fg-primary)' }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div
            className="flex items-center gap-2 text-[12px] mb-1"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>ZeusOS</span>
          </div>
          <h1>Welcome back, {firstName}</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--fg-secondary)' }}>
            {currentSubsidiary
              ? `${currentSubsidiary.name} — ${currentSubsidiary.description}`
              : 'Manage your design-to-production workflow'}
          </p>
        </div>
        <SubsidiarySelector />
      </div>

      {/* Live KPIs */}
      <KPIGrid>
        <KPICardForStat
          label="Active Projects"
          value={stats.activeProjects}
          loading={statsLoading}
          spark={sparks.activeProjects}
        />
        <KPICardForStat
          label="Employees"
          value={stats.totalEmployees}
          loading={statsLoading}
          spark={sparks.totalEmployees}
          sparkColor="var(--seafoam)"
        />
        <KPICardForStat
          label="Open Orders"
          value={stats.openOrders}
          loading={statsLoading}
          spark={sparks.openOrders}
          sparkColor="var(--golden-bell)"
        />
        <KPICardForStat
          label="Pending Tasks"
          value={stats.pendingTasks}
          loading={statsLoading}
          spark={sparks.pendingTasks}
          sparkColor="var(--rag-amber)"
        />
      </KPIGrid>

      {/* Quick Actions */}
      <QuickActions accessibleModuleIds={allAccessibleModuleIds} />

      {/* AI Intelligence & Task Management */}
      <AITaskSection userRole={dawinUser?.globalRole || ''} />

      {/* Modules — unified DataTable view */}
      {(subsidiaryModules.length > 0 || corporateModules.length > 0) && (
        <ModulesTable
          subsidiaryModules={subsidiaryModules}
          corporateModules={corporateModules}
          subsidiaryName={currentSubsidiary?.name || 'Subsidiary'}
        />
      )}

      {/* Empty state if no modules at all */}
      {subsidiaryModules.length === 0 && corporateModules.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No modules assigned</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Your account does not have access to any modules yet. Please contact your administrator
            to get module access configured.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          ZeusOS v2.0 — Design-to-Production Platform
        </p>
      </div>
    </div>
  );
}
