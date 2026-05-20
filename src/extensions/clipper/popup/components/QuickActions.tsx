import { Scissors, RefreshCw, Keyboard } from 'lucide-react';

interface QuickActionsProps {
  onStartClipping: () => void;
  onSyncNow: () => void;
}

export default function QuickActions({ onStartClipping, onSyncNow }: QuickActionsProps) {
  return (
    <div className="bg-white border-b px-4 py-3 space-y-2">
      <div className="flex gap-2">
        <button
          onClick={onStartClipping}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#872E5C] to-[#9B3A6D] text-white py-2.5 px-4 rounded-xl font-medium text-sm hover:from-[#7A2852] hover:to-[#8C3461] transition-all shadow-sm hover:shadow"
        >
          <Scissors className="w-4 h-4" />
          Start Clipping
        </button>
        
        <button
          onClick={onSyncNow}
          className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2.5 px-4 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
          title="Sync now"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      {/* Keyboard shortcut hint */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
        <Keyboard className="w-3 h-3" />
        <span>Quick clip: <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">Alt+C</kbd></span>
      </div>
    </div>
  );
}
