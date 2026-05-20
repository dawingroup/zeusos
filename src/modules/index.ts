/**
 * DawinOS v2.0 Module Registry
 * Central registration point for all platform modules
 */

// Existing Modules (legacy)
export * as CutlistProcessor from './cutlist-processor';
export * as DesignManager from './design-manager';

// Core Modules (v2.0)
export * from './intelligence';
export * from './shared-ops';

// Executive Modules
export * as Executive from '../executive';

// Module Configuration
export interface ModuleConfig {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  dependencies: string[];
}

export const MODULE_REGISTRY: ModuleConfig[] = [
  {
    id: 'intelligence',
    name: 'Intelligence Layer',
    version: '2.0.0',
    enabled: true,
    dependencies: [],
  },
  {
    id: 'smart-tasks',
    name: 'Smart Tasks',
    version: '2.0.0',
    enabled: true,
    dependencies: ['intelligence'],
  },
  {
    id: 'hr-central',
    name: 'HR Central',
    version: '2.0.0',
    enabled: true,
    dependencies: ['intelligence'],
  },
  {
    id: 'finance-wrapper',
    name: 'Finance Wrapper',
    version: '2.0.0',
    enabled: true,
    dependencies: ['intelligence'],
  },
  {
    id: 'knowledge-base',
    name: 'Knowledge Base',
    version: '2.0.0',
    enabled: true,
    dependencies: [],
  },
  {
    id: 'strategy-command',
    name: 'CEO Strategy Command',
    version: '2.0.0',
    enabled: true,
    dependencies: ['intelligence'],
  },
  {
    id: 'market-intelligence',
    name: 'Market Intelligence',
    version: '2.0.0',
    enabled: true,
    dependencies: ['intelligence'],
  },
  {
    id: 'capital-hub',
    name: 'Capital Hub',
    version: '2.0.0',
    enabled: true,
    dependencies: ['intelligence'],
  },
  {
    id: 'opportunities',
    name: 'Strategic Opportunities',
    version: '2.0.0',
    enabled: true,
    dependencies: ['intelligence'],
  },
];

/**
 * Check if a module is enabled
 */
export function isModuleEnabled(moduleId: string): boolean {
  const module = MODULE_REGISTRY.find(m => m.id === moduleId);
  return module?.enabled ?? false;
}

/**
 * Get module dependencies
 */
export function getModuleDependencies(moduleId: string): string[] {
  const module = MODULE_REGISTRY.find(m => m.id === moduleId);
  return module?.dependencies ?? [];
}
