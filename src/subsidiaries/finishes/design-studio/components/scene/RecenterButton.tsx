/**
 * RecenterButton — Floating viewport button + F-hotkey handler
 *
 * Greys out when auto-framing is already engaged (isUserControlled === false).
 */
import { useEffect } from 'react';
import { Crosshair } from 'lucide-react';
import { RECENTER_HOTKEY } from '../../constants/framing.constants';

interface RecenterButtonProps {
  onClick: () => void;
  isUserControlled: boolean;
  enableHotkey?: boolean;
}

export function RecenterButton({ onClick, isUserControlled, enableHotkey = true }: RecenterButtonProps) {
  useEffect(() => {
    if (!enableHotkey) return;
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key.toLowerCase() === RECENTER_HOTKEY.toLowerCase() && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onClick();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClick, enableHotkey]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isUserControlled}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
        isUserControlled
          ? 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50'
          : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
      }`}
      title={isUserControlled ? 'Recenter on current subject (F)' : 'Auto-framing engaged'}
    >
      <Crosshair className="w-3.5 h-3.5" />
      Recenter
      <kbd className={`ml-1 px-1 py-0 rounded text-[9px] font-mono ${
        isUserControlled ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
      }`}>F</kbd>
    </button>
  );
}
