/**
 * Platform Branding Settings
 * Group-level branding (logos, favicon, colors) + platform defaults
 * (theme/accent/density) that seed new users' PreferencesMenu.
 */

import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { useOrganizationSettings } from '@/core/settings';
import type { Accent, Density } from '@/shared/stores/uiStore';
import { cn } from '@/shared/lib/utils';

type Theme = 'light' | 'dark' | 'system';

const ACCENT_SWATCHES: { value: Accent; label: string; color: string }[] = [
  { value: 'zeus-navy', label: 'Zeus Navy', color: '#0a1f4a' },
  { value: 'zeus-red', label: 'Zeus Red', color: '#e63946' },
  { value: 'zeus-the-agency', label: 'Zeus The Agency', color: '#f5d900' },
  { value: 'zeus-digital', label: 'Zeus Digital', color: '#00c5e5' },
  { value: 'labyrinth', label: 'Labyrinth', color: '#2f9d5c' },
  { value: 'odd-gorilla', label: 'Odd Gorilla', color: '#e65b66' },
  { value: 'house-of-zeus', label: 'House of Zeus', color: '#6fa823' },
];

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'dense', label: 'Dense' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'airy', label: 'Airy' },
];

export function PlatformBrandingSettings() {
  const { settings, isLoading, updateSettings } = useOrganizationSettings();
  const [savingField, setSavingField] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--fg-tertiary)]" />
      </div>
    );
  }

  const branding = settings?.branding;
  const platformDefaults = branding?.platformDefaults ?? {};

  const updateBranding = async (
    patch: Partial<NonNullable<typeof branding>>,
    fieldKey: string,
  ) => {
    if (!branding) return;
    setSavingField(fieldKey);
    try {
      await updateSettings({
        branding: { ...branding, ...patch },
      });
    } finally {
      setSavingField(null);
    }
  };

  const updateDefaults = async (
    patch: Partial<NonNullable<typeof branding>['platformDefaults']>,
    fieldKey: string,
  ) => {
    if (!branding) return;
    setSavingField(fieldKey);
    try {
      await updateSettings({
        branding: {
          ...branding,
          platformDefaults: { ...platformDefaults, ...patch },
        },
      });
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Group Logos & Favicon */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Platform Identity</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Group-level logos, favicon, and primary brand colors. These apply across the whole
            platform; per-subsidiary branding is managed under the Subsidiaries tab.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="group-logo">Group Logo URL</Label>
            <Input
              id="group-logo"
              value={branding?.groupLogo ?? ''}
              onChange={(e) => updateBranding({ groupLogo: e.target.value }, 'groupLogo')}
              placeholder="https://…/zeus-group-logo.svg"
            />
            <p className="text-xs text-muted-foreground mt-1">Used on light backgrounds (default theme).</p>
          </div>
          <div>
            <Label htmlFor="group-logo-light">Group Logo URL (light variant)</Label>
            <Input
              id="group-logo-light"
              value={branding?.groupLogoLightUrl ?? ''}
              onChange={(e) =>
                updateBranding({ groupLogoLightUrl: e.target.value }, 'groupLogoLightUrl')
              }
              placeholder="https://…/zeus-group-logo-light.svg"
            />
            <p className="text-xs text-muted-foreground mt-1">Used on dark backgrounds.</p>
          </div>
          <div>
            <Label htmlFor="group-favicon">Favicon URL</Label>
            <Input
              id="group-favicon"
              value={branding?.groupFaviconUrl ?? ''}
              onChange={(e) =>
                updateBranding({ groupFaviconUrl: e.target.value }, 'groupFaviconUrl')
              }
              placeholder="https://…/favicon.ico"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="group-primary">Primary Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="color"
                value={branding?.groupPrimaryColor || '#872E5C'}
                onChange={(e) =>
                  updateBranding({ groupPrimaryColor: e.target.value }, 'groupPrimaryColor')
                }
                className="w-12 h-9 p-0 border-0"
              />
              <Input
                id="group-primary"
                value={branding?.groupPrimaryColor ?? ''}
                onChange={(e) =>
                  updateBranding({ groupPrimaryColor: e.target.value }, 'groupPrimaryColor')
                }
                placeholder="#872E5C"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="group-secondary">Secondary Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="color"
                value={branding?.groupSecondaryColor || '#E18425'}
                onChange={(e) =>
                  updateBranding({ groupSecondaryColor: e.target.value }, 'groupSecondaryColor')
                }
                className="w-12 h-9 p-0 border-0"
              />
              <Input
                id="group-secondary"
                value={branding?.groupSecondaryColor ?? ''}
                onChange={(e) =>
                  updateBranding({ groupSecondaryColor: e.target.value }, 'groupSecondaryColor')
                }
                placeholder="#E18425"
              />
            </div>
          </div>
        </div>

        {savingField && (
          <p className="text-xs text-[var(--fg-tertiary)] inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving {savingField}…
          </p>
        )}
      </section>

      {/* Platform UI Defaults */}
      <section className="space-y-4 border-t border-[var(--border-subtle)] pt-8">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Platform UI Defaults</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Seed values applied to a user's Preferences (avatar menu) on first login. Existing
            users keep their own choices unless they hit "Reset to platform default".
          </p>
        </div>

        {/* Theme */}
        <div>
          <Label className="text-sm">Default theme</Label>
          <div className="flex gap-2 mt-2">
            {THEMES.map((t) => {
              const active = (platformDefaults.theme ?? 'system') === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => updateDefaults({ theme: t.value }, 'theme')}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md border transition-colors',
                    active
                      ? 'bg-[#872E5C] text-white border-[#872E5C]'
                      : 'bg-card text-muted-foreground border-[var(--border-default)] hover:border-[var(--border-strong)]',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent */}
        <div>
          <Label className="text-sm">Default accent</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {ACCENT_SWATCHES.map((a) => {
              const active = (platformDefaults.accent ?? 'zeus-navy') === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => updateDefaults({ accent: a.value }, 'accent')}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors',
                    active
                      ? 'bg-gray-900 text-white border-[var(--border-strong)]'
                      : 'bg-card text-muted-foreground border-[var(--border-default)] hover:border-[var(--border-strong)]',
                  )}
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  {a.label}
                  {active && <Star className="w-3 h-3 ml-1" fill="currentColor" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Density */}
        <div>
          <Label className="text-sm">Default density</Label>
          <div className="flex gap-2 mt-2">
            {DENSITIES.map((d) => {
              const active = (platformDefaults.density ?? 'balanced') === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => updateDefaults({ density: d.value }, 'density')}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md border transition-colors',
                    active
                      ? 'bg-[#872E5C] text-white border-[#872E5C]'
                      : 'bg-card text-muted-foreground border-[var(--border-default)] hover:border-[var(--border-strong)]',
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default PlatformBrandingSettings;
