/**
 * Migration Utility: Auto-grant all modules to existing users
 *
 * When ModuleGuard was added to previously unguarded routes, existing users
 * whose subsidiaryAccess didn't include the newly guarded modules lost access.
 * This utility adds missing modules with hasAccess: true to each user's
 * subsidiaryAccess entries.
 */

import { DEFAULT_SUBSIDIARIES } from '@/types/subsidiary';
import type { SubsidiaryModule } from '@/types/subsidiary';
import type { DawinUser, SubsidiaryAccess, ModuleAccess } from './types';
import * as settingsService from './settingsService';

/** Corporate modules stored under the virtual 'corporate' subsidiary */
const CORPORATE_MODULE_IDS: SubsidiaryModule[] = [
  'strategy', 'hr', 'finance', 'capital', 'market_intelligence', 'intelligence-layer', 'compliance',
];

/**
 * Build a full-access SubsidiaryAccess array that grants access to
 * all modules for all active subsidiaries + corporate modules.
 */
export function buildFullAccess(): SubsidiaryAccess[] {
  const entries: SubsidiaryAccess[] = [];

  // Active subsidiaries
  for (const sub of DEFAULT_SUBSIDIARIES.filter(s => s.status === 'active')) {
    const subModules = sub.modules.filter(m => !CORPORATE_MODULE_IDS.includes(m));
    entries.push({
      subsidiaryId: sub.id,
      hasAccess: true,
      modules: subModules.map(moduleId => ({
        moduleId,
        hasAccess: true,
      })) as ModuleAccess[],
    });
  }

  // Corporate modules
  entries.push({
    subsidiaryId: 'corporate',
    hasAccess: true,
    modules: CORPORATE_MODULE_IDS.map(moduleId => ({
      moduleId,
      hasAccess: true,
    })) as ModuleAccess[],
  });

  return entries;
}

/**
 * Merge full access into an existing access array, preserving existing
 * entries but adding any missing subsidiaries/modules as hasAccess: true.
 */
export function mergeFullAccess(existing: SubsidiaryAccess[]): SubsidiaryAccess[] {
  const full = buildFullAccess();
  const result: SubsidiaryAccess[] = [];

  for (const fullEntry of full) {
    const existingEntry = existing.find(e => e.subsidiaryId === fullEntry.subsidiaryId);

    if (!existingEntry) {
      // Subsidiary not present at all — add it with all modules
      result.push(fullEntry);
    } else {
      // Subsidiary exists — merge in any missing modules
      const mergedModules = [...existingEntry.modules];
      for (const fullMod of fullEntry.modules) {
        if (!mergedModules.some(m => m.moduleId === fullMod.moduleId)) {
          mergedModules.push(fullMod);
        }
      }
      result.push({
        ...existingEntry,
        hasAccess: true,
        modules: mergedModules,
      });
    }
  }

  // Keep any extra subsidiary entries that aren't in the full set
  for (const existingEntry of existing) {
    if (!result.some(r => r.subsidiaryId === existingEntry.subsidiaryId)) {
      result.push(existingEntry);
    }
  }

  return result;
}

/**
 * Migrate a single user to have full module access.
 * Returns the merged access array.
 */
export function grantAllModulesToUser(user: DawinUser): SubsidiaryAccess[] {
  return mergeFullAccess(user.subsidiaryAccess ?? []);
}

/**
 * Bulk migration: grant all modules to all non-admin users in an organization.
 * Admin/owner users are skipped since they already bypass all guards.
 * Returns the number of users updated.
 */
export async function migrateGrantAllModules(orgId: string): Promise<number> {
  const users = await settingsService.getUsers(orgId);
  let updated = 0;

  for (const user of users) {
    // Skip admin/owner — they already bypass all checks
    if (['admin', 'owner'].includes(user.globalRole)) continue;
    // Skip inactive users
    if (!user.isActive) continue;

    const merged = mergeFullAccess(user.subsidiaryAccess ?? []);

    // Clean data for Firestore
    const cleanAccess = merged.map(a => ({
      subsidiaryId: a.subsidiaryId,
      hasAccess: a.hasAccess,
      modules: a.modules.map(m => {
        const clean: Record<string, unknown> = {
          moduleId: m.moduleId,
          hasAccess: m.hasAccess,
        };
        if (m.role) clean.role = m.role;
        if (m.customPermissions && m.customPermissions.length > 0) {
          clean.customPermissions = m.customPermissions;
        }
        return clean;
      }),
    }));

    await settingsService.updateUserAccess(orgId, user.id, cleanAccess as unknown as SubsidiaryAccess[]);
    updated++;
  }

  return updated;
}
