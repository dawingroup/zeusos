import { Sliders, Sun, Moon, Monitor, Palette, Sparkles, Bot, Star, RotateCcw } from 'lucide-react';
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/core/components/ui/dropdown-menu';
import { useUIStore, type Density, type Accent } from '@/shared/stores/uiStore';
import { useOrganizationSettings } from '@/core/settings';

const ACCENT_OPTIONS: { value: Accent; label: string; color: string }[] = [
  { value: 'boysenberry', label: 'Boysenberry', color: '#872e5c' },
  { value: 'goldenbell', label: 'Golden Bell', color: '#e18425' },
  { value: 'seafoam', label: 'Seafoam', color: '#2f7b8c' },
  { value: 'pesto', label: 'Pesto', color: '#6a6037' },
];

/**
 * Preferences submenu — mounted inside the user-avatar DropdownMenu.
 * Exposes theme / density / accent / sparklines / AI panel toggles
 * persisted via uiStore.
 */
export function PreferencesMenu() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);
  const accent = useUIStore((s) => s.accent);
  const setAccent = useUIStore((s) => s.setAccent);
  const sparklines = useUIStore((s) => s.sparklinesEnabled);
  const setSparklines = useUIStore((s) => s.setSparklinesEnabled);
  const aiPanel = useUIStore((s) => s.aiPanelEnabled);
  const setAiPanel = useUIStore((s) => s.setAiPanelEnabled);
  const resetToPlatformDefaults = useUIStore((s) => s.resetToPlatformDefaults);

  const { settings } = useOrganizationSettings();
  const platformDefaults = settings?.branding?.platformDefaults;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Sliders className="mr-2 h-3.5 w-3.5" />
        Preferences
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-64">
          <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider text-[var(--fg-tertiary)] font-medium">
            Theme
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
          >
            <DropdownMenuRadioItem value="light">
              <Sun className="mr-2 h-3.5 w-3.5" /> Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon className="mr-2 h-3.5 w-3.5" /> Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor className="mr-2 h-3.5 w-3.5" /> System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider text-[var(--fg-tertiary)] font-medium">
            Density
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={density}
            onValueChange={(v) => setDensity(v as Density)}
          >
            <DropdownMenuRadioItem value="dense">Dense</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="balanced">Balanced</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="airy">Airy</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider text-[var(--fg-tertiary)] font-medium">
            Accent
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={accent}
            onValueChange={(v) => setAccent(v as Accent)}
          >
            {ACCENT_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
                {platformDefaults?.accent === opt.value && (
                  <Star className="ml-auto h-3 w-3 text-[var(--accent)]" fill="currentColor" />
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={sparklines}
            onCheckedChange={(v) => setSparklines(Boolean(v))}
          >
            <Sparkles className="mr-2 h-3.5 w-3.5" /> KPI sparklines
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={aiPanel}
            onCheckedChange={(v) => setAiPanel(Boolean(v))}
          >
            <Bot className="mr-2 h-3.5 w-3.5" /> AI tasks panel
          </DropdownMenuCheckboxItem>
          {platformDefaults && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => resetToPlatformDefaults(platformDefaults)}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset to platform default
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10.5px] text-[var(--fg-tertiary)] flex items-center gap-1.5">
            <Palette className="h-3 w-3" /> Preferences saved per device
          </DropdownMenuLabel>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
