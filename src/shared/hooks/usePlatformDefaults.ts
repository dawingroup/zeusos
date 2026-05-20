/**
 * usePlatformDefaults
 *
 * On first load after org settings resolve, seeds the user's UI store
 * (theme / density / accent) with `branding.platformDefaults` if the user
 * has never explicitly chosen those values. Subsequent loads are no-ops
 * because the store remembers `appliedPlatformDefaults: true`.
 *
 * Call once near app boot (alongside useThemeSync).
 */

import { useEffect } from 'react';
import { useOrganizationSettings } from '@/core/settings';
import { useUIStore } from '@/shared/stores/uiStore';

export function usePlatformDefaults() {
  const { settings, isLoading } = useOrganizationSettings();
  const applyPlatformDefaults = useUIStore((s) => s.applyPlatformDefaults);

  useEffect(() => {
    if (isLoading) return;
    const defaults = settings?.branding?.platformDefaults;
    if (!defaults) return;
    applyPlatformDefaults(defaults);
  }, [isLoading, settings?.branding?.platformDefaults, applyPlatformDefaults]);
}
