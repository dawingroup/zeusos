/**
 * Admin → Drive Folder Settings
 *
 * Binds every Unified File Manager + ZeusOS-module slot to a Google
 * Drive folder. Changes take effect within 60 s (CF cache TTL) on the
 * next trigger fire — no redeploy needed. Env-var values remain
 * fallbacks for backwards compat.
 *
 * Grouping (see `SLOT_GROUP_META`):
 *   - **Projects & Archive**       — consumed by the Drive bridge today
 *   - **Templates-Resources**      — Phase 5 prep (v3.1 §3)
 *   - **Subsidiary operations**    — per-subsidiary ops roots
 *   - **Group HQ departments**     — Finance / HR / Legal / IT / Strategy / Compliance / Market Intel
 *   - **Client Hub**               — customer-facing folders
 *   - **Programs & partnerships**  — AMH-Uganda and future programs
 *
 * Each group renders as a collapsible section with a "N/M mapped"
 * progress pill so operators can see at a glance which areas need
 * attention.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  FolderTree,
  Info,
  Mail,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDriveFolderSettings } from '../hooks/useDriveFolderSettings';
import { DriveFolderSlotCard } from '../components/DriveFolderSlotCard';
import {
  DRIVE_FOLDER_SLOT_CATALOG,
  SLOT_GROUP_META,
  type DriveFolderSettings,
  type SlotDescriptor,
  type SlotGroup,
} from '../types/driveFolderSettings';

const GROUP_ORDER: SlotGroup[] = [
  'projects',
  'templates',
  'subsidiaries',
  'hq',
  'clients',
  'programs',
];

function slotsForGroup(group: SlotGroup): readonly SlotDescriptor[] {
  return DRIVE_FOLDER_SLOT_CATALOG.filter((d) => d.group === group);
}

function mappedCount(
  descriptors: readonly SlotDescriptor[],
  settings: DriveFolderSettings | null,
): number {
  if (!settings) return 0;
  return descriptors.filter(
    (d) => Boolean(settings.bindings?.[d.slot]?.folderId?.trim()),
  ).length;
}

export default function DriveFolderSettingsPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const { settings, loading } = useDriveFolderSettings();

  // One open/closed toggle per group — initial state respects each
  // group's `defaultOpen` hint. Users can override any time.
  const [openGroups, setOpenGroups] = useState<Record<SlotGroup, boolean>>(() => {
    const initial: Record<SlotGroup, boolean> = {} as Record<SlotGroup, boolean>;
    for (const g of GROUP_ORDER) initial[g] = SLOT_GROUP_META[g].defaultOpen;
    return initial;
  });

  const [filter, setFilter] = useState('');

  // Search across label + hint + policyPath so operators can jump to
  // a specific slot without scrolling through collapsed sections.
  const filteredCatalog = useMemo(() => {
    if (!filter.trim()) return DRIVE_FOLDER_SLOT_CATALOG;
    const q = filter.toLowerCase();
    return DRIVE_FOLDER_SLOT_CATALOG.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.hint.toLowerCase().includes(q) ||
        d.policyPath.toLowerCase().includes(q) ||
        d.slot.toLowerCase().includes(q),
    );
  }, [filter]);

  const totalMapped = mappedCount(DRIVE_FOLDER_SLOT_CATALOG, settings);

  // When a filter is active, auto-expand all groups that have at least
  // one matching slot so the admin sees results without clicking.
  const expandedByFilter = useMemo(() => {
    if (!filter.trim()) return null;
    const expanded: Record<SlotGroup, boolean> = {} as Record<SlotGroup, boolean>;
    for (const g of GROUP_ORDER) {
      expanded[g] = filteredCatalog.some((d) => d.group === g);
    }
    return expanded;
  }, [filter, filteredCatalog]);

  const toggleGroup = (group: SlotGroup) =>
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <Link
          to="/admin/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground flex items-center gap-2">
          <FolderTree className="h-6 w-6 text-muted-foreground" />
          Drive Folder Mapping
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bind every ZeusOS module slot to a Google Drive folder. Changes take
          effect within 60 seconds on the next trigger fire — no redeploy
          needed.
        </p>
        <p className="text-xs text-[var(--fg-tertiary)] mt-1">
          {totalMapped} of {DRIVE_FOLDER_SLOT_CATALOG.length} slots mapped
        </p>
      </div>

      {/* Service-account hint */}
      <div className="flex items-start gap-2 border border-blue-200 bg-blue-50 rounded-lg p-3">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <p className="font-medium">Before pasting an ID</p>
          <p className="mt-1">
            Share the Drive folder with the Drive service account as{' '}
            <span className="font-semibold">Content Manager</span>.
          </p>
          {settings?.serviceAccountEmail ? (
            <p className="mt-1 flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <code className="font-mono text-[11px] bg-card/60 px-1 py-0.5 rounded">
                {settings.serviceAccountEmail}
              </code>
            </p>
          ) : (
            <p className="mt-1 italic text-blue-700">
              (Service account email not yet synced — click Verify on any slot
              to confirm it&apos;s reachable; the callable will surface the
              account email in its error message if sharing is the issue.)
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-tertiary)]" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search slots by name, description, or path..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--fg-tertiary)]">Loading…</div>
      ) : (
        <div className="space-y-3">
          {GROUP_ORDER.map((group) => {
            const descriptors = slotsForGroup(group);
            const filtered = descriptors.filter((d) =>
              filteredCatalog.includes(d),
            );
            // Hide empty groups entirely when filtering.
            if (filter.trim() && filtered.length === 0) return null;

            const meta = SLOT_GROUP_META[group];
            const mapped = mappedCount(descriptors, settings);
            const isOpen = expandedByFilter
              ? expandedByFilter[group]
              : openGroups[group];

            return (
              <section
                key={group}
                className="border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[var(--bg-sunken)]"
              >
                <button
                  onClick={() => !expandedByFilter && toggleGroup(group)}
                  className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-[var(--bg-sunken)] transition-colors"
                  disabled={!!expandedByFilter}
                >
                  <span className="shrink-0 mt-0.5">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        {meta.label}
                      </h2>
                      <span
                        className={
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full ' +
                          (mapped === descriptors.length
                            ? 'bg-emerald-100 text-emerald-700'
                            : mapped > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-[var(--bg-sunken)] text-muted-foreground')
                        }
                      >
                        {mapped} / {descriptors.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {meta.description}
                    </p>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 py-3 space-y-3 bg-card border-t border-[var(--border-subtle)]">
                    {filtered.map((descriptor) => (
                      <DriveFolderSlotCard
                        key={descriptor.slot}
                        descriptor={descriptor}
                        binding={settings?.bindings?.[descriptor.slot]}
                        userId={userId}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
