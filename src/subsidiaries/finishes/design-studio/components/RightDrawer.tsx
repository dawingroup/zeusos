/**
 * RightDrawer — Sliding panel from the right edge
 *
 * Overlays the viewport. Positioned absolutely within the
 * main content area, left of the trigger bar.
 */

import { X } from 'lucide-react';
import { DRAWER_PANELS, type DrawerPanel } from './DrawerTriggerBar';

interface RightDrawerProps {
  activePanel: DrawerPanel;
  onClose: () => void;
  children: React.ReactNode;
}

export default function RightDrawer({
  activePanel,
  onClose,
  children,
}: RightDrawerProps) {
  const panelDef = DRAWER_PANELS.find(p => p.key === activePanel);
  const isOpen = activePanel !== null;

  return (
    <>
      {/* Backdrop — click to close */}
      {isOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/20 sm:bg-black/5"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`
          absolute top-0 right-0 z-30 h-full
          w-full max-w-full sm:w-[340px] sm:max-w-[85vw]
          bg-background border-l border-border
          shadow-[-4px_0_16px_rgba(0,0,0,0.08)]
          flex flex-col
          transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}
        `}
      >
        {/* Header */}
        {panelDef && (
          <div className="flex items-center justify-between px-2.5 sm:px-3 py-2.5 border-b border-border bg-muted/40 shrink-0">
            <div className="flex items-center gap-2">
              <panelDef.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{panelDef.label}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isOpen && children}
        </div>
      </div>
    </>
  );
}
