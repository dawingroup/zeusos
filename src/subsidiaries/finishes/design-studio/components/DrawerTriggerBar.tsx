/**
 * DrawerTriggerBar — Vertical icon strip on the right edge
 *
 * Panels are organized into 5 logical sections with subtle dividers.
 * Each icon opens the RightDrawer to a specific panel.
 */

import {
  List, Table2, Ruler, Layers, Brain, FolderOpen, Printer, Factory, Palette, Camera,
  Wand2, GitBranch, Box, SlidersHorizontal, BookOpen, Package, Boxes, Link2, Info, Move3d,
  Crosshair,
} from 'lucide-react';

export type DrawerPanel = 'context' | 'itemMeta' | 'parts' | 'part' | 'cutlist' | 'dims' | 'assemblies' | 'ai' | 'cabinets' | 'production' | 'materials' | 'render' | 'generate' | 'revisions' | 'handoff' | 'files' | 'export' | 'configurator' | 'kb' | 'mdp' | 'positioning' | null;

export type ViewerType = 'scene' | 'workshop';

interface PanelDef {
  key: DrawerPanel;
  label: string;
  shortLabel: string;
  icon: typeof List;
  /** Panels that work without a loaded model (entry points, browsers, KB) */
  alwaysAvailable?: boolean;
  /**
   * Contexts this panel applies to. Omitted = `'both'`. Scene workspace
   * hides workshop-only panels (Generate, Configurator, Revisions,
   * Handoff, MDP) because they're per-cabinet / per-model flows that
   * don't translate to a multi-cabinet scene.
   */
  viewerType?: ViewerType | 'both';
}

interface SectionDef {
  label: string;
  panels: PanelDef[];
}

const DRAWER_SECTIONS: SectionDef[] = [
  {
    label: 'Session',
    panels: [
      // P21.2 — bind/rebind the session to a DesignProject + DesignItem.
      // `alwaysAvailable` so users can bind a session before loading a model.
      { key: 'context', label: 'Context', shortLabel: 'Ctx', icon: Link2, alwaysAvailable: true },
      // P21.6 — "what Design Manager already knows" read-only snapshot:
      // existing parts + project material palette for the bound DesignItem.
      { key: 'itemMeta', label: 'Item Metadata', shortLabel: 'Meta', icon: Info, alwaysAvailable: true },
    ],
  },
  {
    label: 'Model',
    panels: [
      { key: 'parts', label: 'Parts', shortLabel: 'Parts', icon: List },
      // Per-part detail panel — shows size, material, edge banding,
      // and connections (same-assembly, joined, name-adjacent) for
      // whichever part the user has selected. Only meaningful in
      // 'part' selection mode.
      { key: 'part', label: 'Part Detail', shortLabel: 'Part', icon: Crosshair },
      { key: 'cutlist', label: 'Cut List', shortLabel: 'Cut', icon: Table2 },
      { key: 'assemblies', label: 'Assemblies', shortLabel: 'Asm', icon: Layers },
    ],
  },
  {
    label: 'Analysis',
    panels: [
      { key: 'dims', label: 'Dimensions', shortLabel: 'Dims', icon: Ruler },
      { key: 'positioning', label: 'Positioning', shortLabel: 'Pos', icon: Move3d },
      { key: 'ai', label: 'AI Recognition', shortLabel: 'AI', icon: Brain },
      { key: 'cabinets', label: 'Detect Cabinets', shortLabel: 'Cab', icon: Boxes },
    ],
  },
  {
    label: 'Design',
    panels: [
      { key: 'materials', label: 'Materials', shortLabel: 'Mat', icon: Palette },
      { key: 'render', label: 'Render', shortLabel: 'Rend', icon: Camera },
      // Per-cabinet / single-model flows — only relevant in Workshop Viewer.
      { key: 'generate', label: 'Generate', shortLabel: 'Gen', icon: Wand2, alwaysAvailable: true, viewerType: 'workshop' },
      { key: 'configurator', label: 'Configurator', shortLabel: 'Conf', icon: SlidersHorizontal, alwaysAvailable: true, viewerType: 'workshop' },
      { key: 'kb', label: 'Knowledge Base', shortLabel: 'KB', icon: BookOpen, alwaysAvailable: true },
    ],
  },
  {
    label: 'Production',
    panels: [
      { key: 'production', label: 'Production', shortLabel: 'Prod', icon: Factory },
      // Single-cabinet output bundle + per-model timeline / handoff — keep in Workshop Viewer.
      { key: 'mdp', label: 'MDP Output', shortLabel: 'MDP', icon: Package, viewerType: 'workshop' },
      { key: 'revisions', label: 'Revisions', shortLabel: 'Rev', icon: GitBranch, viewerType: 'workshop' },
      { key: 'handoff', label: 'Handoff', shortLabel: 'Hand', icon: Box, alwaysAvailable: true, viewerType: 'workshop' },
    ],
  },
  {
    label: 'Output',
    panels: [
      { key: 'files', label: 'Files', shortLabel: 'Files', icon: FolderOpen, alwaysAvailable: true },
      { key: 'export', label: 'Export PDF', shortLabel: 'PDF', icon: Printer },
    ],
  },
];

// Flat list for backward compatibility
export const DRAWER_PANELS: PanelDef[] = DRAWER_SECTIONS.flatMap(s => s.panels);

interface DrawerTriggerBarProps {
  activePanel: DrawerPanel;
  onSelectPanel: (panel: DrawerPanel) => void;
  hasModel: boolean;
  hasMoContext?: boolean;
  /**
   * Which viewer is rendering this bar. Panels tagged with a
   * `viewerType` other than this one are hidden. Defaults to
   * `'workshop'` so existing callers keep seeing every panel.
   */
  viewerType?: ViewerType;
}

/** True when this panel should render in the given viewer type. */
function panelMatchesViewer(def: PanelDef, viewerType: ViewerType): boolean {
  const panelViewer = def.viewerType ?? 'both';
  return panelViewer === 'both' || panelViewer === viewerType;
}

export default function DrawerTriggerBar({
  activePanel,
  onSelectPanel,
  hasModel,
  viewerType = 'workshop',
}: DrawerTriggerBarProps) {
  // Filter each section's panels to the current viewer's whitelist, then
  // drop sections that have no panels left. Saves us an empty "Session"
  // header-with-no-buttons in contexts where every member is gated out.
  const visibleSections = DRAWER_SECTIONS
    .map(section => ({
      ...section,
      panels: section.panels.filter(p => panelMatchesViewer(p, viewerType)),
    }))
    .filter(section => section.panels.length > 0);

  return (
    <div className="w-12 sm:w-14 flex flex-col items-center py-2 bg-card border-l border-border shrink-0 overflow-y-auto shadow-sm">
      {visibleSections.map((section, sIdx) => (
        <div key={section.label} className="w-full flex flex-col items-center">
          {/* Section divider (skip first) */}
          {sIdx > 0 && (
            <div className="w-9 border-t border-border/60 my-1.5" />
          )}
          {/* Section label */}
          <span className="hidden sm:block text-[8px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-1">
            {section.label}
          </span>
          {/* Panel buttons */}
          {section.panels.map(({ key, label, shortLabel, icon: Icon, alwaysAvailable }) => {
            const isActive = activePanel === key;
            const isDisabled = !hasModel && !alwaysAvailable;
            return (
              <button
                key={key}
                onClick={() => !isDisabled && onSelectPanel(isActive ? null : key)}
                title={isDisabled ? `${label} (load a model first)` : label}
                disabled={isDisabled}
                className={`
                  w-10 sm:w-12 py-1.5 mb-0.5 flex flex-col items-center gap-0.5 rounded-md
                  transition-all duration-100
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : isDisabled
                      ? 'text-muted-foreground/40 cursor-not-allowed'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:block text-[8px] font-medium leading-none">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
