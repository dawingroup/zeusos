/**
 * SubsidiaryAccessEditor
 * Comprehensive matrix of subsidiary, module, and feature-level access for a user.
 * Supports:
 * - Per-subsidiary toggle with module grid
 * - Corporate modules (cross-subsidiary) section
 * - Feature-level permissions within modules (expandable)
 * - Sensitivity tier indicators
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Label } from '@/core/components/ui/label';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { DEFAULT_SUBSIDIARIES } from '@/types/subsidiary';
import type { SubsidiaryModule } from '@/types/subsidiary';
import type { SubsidiaryAccess, ModuleAccess, GlobalRole } from '@/core/settings/types';
import { getModuleFeatures } from '@/core/settings/types';

interface SubsidiaryAccessEditorProps {
  access: SubsidiaryAccess[];
  onChange: (access: SubsidiaryAccess[]) => void;
  disabled?: boolean;
  userRole?: GlobalRole;
}

const MODULE_LABELS: Record<string, string> = {
  'design-manager': 'Design Manager',
  'clipper': 'Clip Library',
  'asset-registry': 'Asset Registry',
  'feature-library': 'Feature Library',
  'launch-pipeline': 'Launch Pipeline',
  'procurement': 'Procurement',
  'production': 'Manufacturing',
  'marketing': 'Marketing Hub',
  'inventory': 'Inventory',
  'crm': 'CRM',
  'customer-hub': 'Customer Hub',
  'whatsapp': 'WhatsApp',
  'matflow': 'MatFlow',
  'infrastructure_delivery': 'Infrastructure Delivery',
  'market_intelligence': 'Market Intelligence',
  'strategy': 'CEO Strategy',
  'hr': 'HR Central',
  'finance': 'Finance',
  'capital': 'Capital Hub',
  'intelligence-layer': 'AI Intelligence',
  'sales-orders': 'Sales Orders',
  'workshop-viewer': 'Workshop Viewer',
  'design-studio': 'Design Studio',
  'suppliers': 'Suppliers',
};

/** Sensitivity tiers — modules requiring elevated roles */
const MODULE_SENSITIVITY: Partial<Record<string, { minRole: GlobalRole; label: string }>> = {
  strategy: { minRole: 'manager', label: 'Manager+' },
  finance: { minRole: 'manager', label: 'Manager+' },
};

/** Corporate modules shown in their own section */
const CORPORATE_MODULE_IDS: SubsidiaryModule[] = [
  'strategy', 'hr', 'finance', 'market_intelligence', 'intelligence-layer', 'compliance', 'asset-registry',
];

export function SubsidiaryAccessEditor({ access, onChange, disabled }: SubsidiaryAccessEditorProps) {
  const activeSubsidiaries = DEFAULT_SUBSIDIARIES.filter(s => s.status === 'active');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // ── Helpers ──

  function getSubAccess(subsidiaryId: string): SubsidiaryAccess | undefined {
    return access.find(a => a.subsidiaryId === subsidiaryId);
  }

  function toggleSubsidiary(subsidiaryId: string) {
    const existing = getSubAccess(subsidiaryId);
    if (existing) {
      onChange(
        access.map(a =>
          a.subsidiaryId === subsidiaryId ? { ...a, hasAccess: !a.hasAccess } : a
        )
      );
    } else {
      const sub = DEFAULT_SUBSIDIARIES.find(s => s.id === subsidiaryId);
      onChange([
        ...access,
        {
          subsidiaryId,
          hasAccess: true,
          modules: (sub?.modules || [])
            .filter(m => !CORPORATE_MODULE_IDS.includes(m))
            .map(m => ({
              moduleId: m,
              hasAccess: false,
            })),
        },
      ]);
    }
  }

  function toggleModule(subsidiaryId: string, moduleId: SubsidiaryModule) {
    onChange(
      access.map(a => {
        if (a.subsidiaryId !== subsidiaryId) return a;
        const moduleExists = a.modules.some(m => m.moduleId === moduleId);
        const updatedModules = moduleExists
          ? a.modules.map(m =>
              m.moduleId === moduleId ? { ...m, hasAccess: !m.hasAccess } : m
            )
          : [...a.modules, { moduleId, hasAccess: true }];
        return { ...a, modules: updatedModules };
      })
    );
  }

  function toggleAllModules(subsidiaryId: string, modules: SubsidiaryModule[], enable: boolean) {
    onChange(
      access.map(a => {
        if (a.subsidiaryId !== subsidiaryId) return a;
        const updatedModules = modules.map(moduleId => {
          const existing = a.modules.find(m => m.moduleId === moduleId);
          return existing
            ? { ...existing, hasAccess: enable }
            : { moduleId, hasAccess: enable };
        });
        // Preserve modules not in this set
        const otherModules = a.modules.filter(
          m => !modules.includes(m.moduleId)
        );
        return { ...a, modules: [...otherModules, ...updatedModules] };
      })
    );
  }

  function toggleFeature(subsidiaryId: string, moduleId: SubsidiaryModule, featureId: string) {
    onChange(
      access.map(a => {
        if (a.subsidiaryId !== subsidiaryId) return a;
        return {
          ...a,
          modules: a.modules.map(m => {
            if (m.moduleId !== moduleId) return m;
            const perms = m.customPermissions ?? [];
            const has = perms.includes(featureId);
            return {
              ...m,
              customPermissions: has
                ? perms.filter(p => p !== featureId)
                : [...perms, featureId],
            };
          }),
        };
      })
    );
  }

  function toggleExpandModule(key: string) {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Corporate modules access (stored under a virtual 'corporate' subsidiary entry) ──

  function getCorporateAccess(): SubsidiaryAccess {
    const existing = access.find(a => a.subsidiaryId === 'corporate');
    return existing ?? { subsidiaryId: 'corporate', hasAccess: true, modules: [] };
  }

  function toggleCorporateModule(moduleId: SubsidiaryModule) {
    const corporate = getCorporateAccess();
    const moduleExists = corporate.modules.some(m => m.moduleId === moduleId);
    const updatedModules = moduleExists
      ? corporate.modules.map(m =>
          m.moduleId === moduleId ? { ...m, hasAccess: !m.hasAccess } : m
        )
      : [...corporate.modules, { moduleId, hasAccess: true }];

    const updated: SubsidiaryAccess = { ...corporate, hasAccess: true, modules: updatedModules };

    const existsInAccess = access.some(a => a.subsidiaryId === 'corporate');
    if (existsInAccess) {
      onChange(access.map(a => (a.subsidiaryId === 'corporate' ? updated : a)));
    } else {
      onChange([...access, updated]);
    }
  }

  function toggleCorporateFeature(moduleId: SubsidiaryModule, featureId: string) {
    const corporate = getCorporateAccess();
    const updated: SubsidiaryAccess = {
      ...corporate,
      modules: corporate.modules.map(m => {
        if (m.moduleId !== moduleId) return m;
        const perms = m.customPermissions ?? [];
        const has = perms.includes(featureId);
        return {
          ...m,
          customPermissions: has
            ? perms.filter(p => p !== featureId)
            : [...perms, featureId],
        };
      }),
    };

    const existsInAccess = access.some(a => a.subsidiaryId === 'corporate');
    if (existsInAccess) {
      onChange(access.map(a => (a.subsidiaryId === 'corporate' ? updated : a)));
    } else {
      onChange([...access, updated]);
    }
  }

  // ── Render helpers ──

  function renderModuleRow(
    moduleId: SubsidiaryModule,
    moduleAccess: ModuleAccess | undefined,
    onToggle: () => void,
    featureToggle: (featureId: string) => void,
    expandKey: string,
  ) {
    const features = getModuleFeatures(moduleId);
    const hasFeatures = features.length > 0;
    const isExpanded = expandedModules.has(expandKey);
    const sensitivity = MODULE_SENSITIVITY[moduleId];
    const isChecked = moduleAccess?.hasAccess ?? false;

    return (
      <div key={moduleId}>
        <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
          {hasFeatures ? (
            <button
              type="button"
              onClick={() => toggleExpandModule(expandKey)}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-4.5" />
          )}
          <label className="flex items-center gap-2 flex-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={onToggle}
              disabled={disabled}
              className="h-4 w-4 rounded border-[var(--border-default)]"
            />
            <Label className="cursor-pointer font-normal text-sm">
              {MODULE_LABELS[moduleId] || moduleId}
            </Label>
          </label>
          {sensitivity && (
            <Badge variant="outline" className="text-[10px] gap-1 py-0">
              <Shield className="h-2.5 w-2.5" />
              {sensitivity.label}
            </Badge>
          )}
          {hasFeatures && (
            <span className="text-[10px] text-muted-foreground">
              {features.length} features
            </span>
          )}
        </div>

        {/* Feature-level permissions */}
        {hasFeatures && isExpanded && isChecked && (
          <div className="ml-9 pl-3 border-l border-muted space-y-1 pb-2">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
              Feature Access
            </p>
            {features.map(feature => {
              const perms = moduleAccess?.customPermissions ?? [];
              // If no custom permissions set, all features are granted (backward compat)
              const isGranted = perms.length === 0 || perms.includes(feature.id);
              const isSensitive = !!feature.minimumRole;

              return (
                <label
                  key={feature.id}
                  className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isGranted}
                    onChange={() => featureToggle(feature.id)}
                    disabled={disabled}
                    className="h-3.5 w-3.5 rounded border-[var(--border-default)]"
                  />
                  <span className="text-xs">{feature.label}</span>
                  <span className="text-[10px] text-muted-foreground flex-1">
                    {feature.description}
                  </span>
                  {isSensitive && (
                    <Badge variant="outline" className="text-[9px] gap-0.5 py-0">
                      <AlertTriangle className="h-2 w-2" />
                      {feature.minimumRole}+
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Subsidiary Modules ── */}
      {activeSubsidiaries.map(sub => {
        const subAccess = getSubAccess(sub.id);
        const hasAccess = subAccess?.hasAccess ?? false;
        const subModules = sub.modules.filter(m => !CORPORATE_MODULE_IDS.includes(m));

        return (
          <Card key={sub.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: sub.color }}
                  />
                  <CardTitle className="text-base">{sub.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    {subModules.length} modules
                  </Badge>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-muted-foreground">
                    {hasAccess ? 'Enabled' : 'Disabled'}
                  </span>
                  <input
                    type="checkbox"
                    checked={hasAccess}
                    onChange={() => toggleSubsidiary(sub.id)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-[var(--border-default)]"
                  />
                </label>
              </div>
            </CardHeader>
            {hasAccess && (
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">
                    Select which modules this user can access
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => toggleAllModules(sub.id, subModules, true)}
                      disabled={disabled}
                    >
                      Enable All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => toggleAllModules(sub.id, subModules, false)}
                      disabled={disabled}
                    >
                      Disable All
                    </Button>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {subModules.map(moduleId => {
                    const moduleAccess = subAccess?.modules.find(
                      m => m.moduleId === moduleId
                    );
                    return renderModuleRow(
                      moduleId,
                      moduleAccess,
                      () => toggleModule(sub.id, moduleId),
                      (featureId) => toggleFeature(sub.id, moduleId, featureId),
                      `${sub.id}:${moduleId}`,
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* ── Corporate Modules (Cross-Subsidiary) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 $1-[var(--rag-blue)]" />
            <CardTitle className="text-base">Corporate Modules</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              Cross-Subsidiary
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            These modules are available across all subsidiaries
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-0.5">
            {CORPORATE_MODULE_IDS.map(moduleId => {
              const corporate = getCorporateAccess();
              const moduleAccess = corporate.modules.find(m => m.moduleId === moduleId);
              return renderModuleRow(
                moduleId,
                moduleAccess,
                () => toggleCorporateModule(moduleId),
                (featureId) => toggleCorporateFeature(moduleId, featureId),
                `corporate:${moduleId}`,
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
