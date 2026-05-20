import { Settings, LogOut, ExternalLink } from 'lucide-react';

interface User {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

interface HeaderProps {
  user: User;
  pendingCount: number;
  onSettingsClick: () => void;
  onSignOut: () => void;
}

export default function Header({ user, onSettingsClick, onSignOut }: HeaderProps) {
  const openDawinOS = () => {
    chrome.tabs.create({ url: 'https://dawinos.web.app/clipper' });
  };

  return (
    <header className="bg-gradient-to-r from-[#872E5C] to-[#6B2549] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center ring-2 ring-white/30">
          <span className="text-white font-bold text-base">D</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white flex items-center gap-1.5">
            Dawin Clipper
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-normal">v1.0</span>
          </h1>
          <p className="text-xs text-white/70 truncate max-w-[140px]">{user.displayName || user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={openDawinOS}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Open in DawinOS"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
        
        <button
          onClick={onSettingsClick}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        
        <button
          onClick={onSignOut}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
