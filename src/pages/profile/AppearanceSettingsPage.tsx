/**
 * /settings/appearance — Phase 5 (UI refresh).
 *
 * The canonical Settings surface for per-user display preferences. Exposes
 * exactly three controls, all persisted via `uiStore` + applied to
 * <html data-*> by `useThemeSync`:
 *   • Theme   — light / dark / system
 *   • Density — dense / balanced / airy
 *   • Accent  — Zeus navy / red + the five sub-brand colours
 *
 * Per product decision, the design **direction** (ambitious) and **sidebar
 * style** are NOT user-exposed — they stay locked at their document
 * defaults. This page intentionally has no control for either.
 *
 * Mirrors (and is the page-level counterpart to) the `PreferencesMenu`
 * dropdown in the sidebar user-footer; both read/write the same store.
 */

import { Sun, Moon, Monitor, RotateCcw } from 'lucide-react';
import { useUIStore, type Density, type Accent } from '@/shared/stores/uiStore';
import { useOrganizationSettings } from '@/core/settings';
import { PageHero } from '@/shared/components/refresh';

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const DENSITY_OPTIONS: { value: Density; label: string; hint: string }[] = [
  { value: 'dense', label: 'Dense', hint: 'Compact rows' },
  { value: 'balanced', label: 'Balanced', hint: 'Default spacing' },
  { value: 'airy', label: 'Airy', hint: 'Roomy rows' },
];

// Canonical Zeus accents — values map 1:1 to the `[data-accent]` CSS blocks.
const ACCENT_OPTIONS: { value: Accent; label: string; color: string }[] = [
  { value: 'zeus-navy', label: 'Zeus Navy', color: '#0a1f4a' },
  { value: 'zeus-red', label: 'Zeus Red', color: '#e63946' },
  { value: 'zeus-the-agency', label: 'Zeus The Agency', color: '#f5d900' },
  { value: 'zeus-digital', label: 'Zeus Digital', color: '#00c5e5' },
  { value: 'labyrinth', label: 'Labyrinth', color: '#2f9d5c' },
  { value: 'odd-gorilla', label: 'Odd Gorilla', color: '#e65b66' },
  { value: 'house-of-zeus', label: 'House of Zeus', color: '#6fa823' },
];

function SettingsCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h3>
        {body && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--fg-tertiary)' }}>{body}</p>}
      </div>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: 14,
        alignItems: 'flex-start',
        padding: '14px 0',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 4 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function AppearanceSettingsPage() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);
  const accent = useUIStore((s) => s.accent);
  const setAccent = useUIStore((s) => s.setAccent);
  const resetToPlatformDefaults = useUIStore((s) => s.resetToPlatformDefaults);

  const { settings } = useOrganizationSettings();
  const platformDefaults = settings?.branding?.platformDefaults;

  return (
    <div style={{ padding: 'var(--pad-page)', maxWidth: 760, margin: '0 auto' }} data-testid="appearance-settings-page">
      <PageHero
        eyebrow="Settings"
        title="Appearance"
        body="How ZeusOS looks for you. Saved per device and applied instantly across every surface."
      />

      <SettingsCard title="Display" body="Theme, density, and accent colour. These mirror the Preferences menu in the sidebar.">
        <FieldRow label="Theme" hint="System follows your OS light/dark setting.">
          <div style={{ display: 'flex', gap: 6 }}>
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`theme-${opt.value}`}
                  aria-pressed={active}
                  onClick={() => setTheme(opt.value)}
                  className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                >
                  <Icon size={13} /> {opt.label}
                </button>
              );
            })}
          </div>
        </FieldRow>

        <FieldRow label="Density" hint="Compact rows for power users; airy for occasional logins.">
          <div style={{ display: 'flex', gap: 6 }}>
            {DENSITY_OPTIONS.map((opt) => {
              const active = density === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`density-${opt.value}`}
                  aria-pressed={active}
                  title={opt.hint}
                  onClick={() => setDensity(opt.value)}
                  className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </FieldRow>

        <FieldRow label="Accent colour" hint="Defaults to Zeus navy. Colours your active nav highlight, focus rings, and primary actions.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACCENT_OPTIONS.map((opt) => {
              const active = accent === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`accent-${opt.value}`}
                  aria-pressed={active}
                  title={opt.label}
                  onClick={() => setAccent(opt.value)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: opt.color,
                    cursor: 'pointer',
                    border: active ? '2px solid var(--fg-primary)' : '1px solid var(--border-default)',
                    outline: active ? '2px solid var(--bg-surface)' : 'none',
                    outlineOffset: -4,
                  }}
                />
              );
            })}
          </div>
        </FieldRow>
      </SettingsCard>

      {platformDefaults && (
        <button
          type="button"
          data-testid="reset-platform-defaults"
          onClick={() => resetToPlatformDefaults(platformDefaults)}
          className="btn btn-secondary"
        >
          <RotateCcw size={13} /> Reset to platform default
        </button>
      )}

      <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--fg-tertiary)' }}>
        Preferences are saved per device.
      </p>
    </div>
  );
}
