/**
 * Header Component
 * Top header with module switcher, branding, and user menu
 * Updated with Apple-inspired black theme (#1d1d1f)
 */

import { useAuth } from '@/shared/hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User, FolderOpen, Wrench, Layers, Rocket, Image, Package, Settings, DollarSign, Users } from 'lucide-react';
import { DawinGroupLogo } from '@/shared/components/branding/DawinGroupLogo';

export interface HeaderProps {
  title?: string;
}

export function Header({ title = 'Zeus Group' }: HeaderProps) {
  const { user, isAuthenticated, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getCurrentModule = () => {
    if (location.pathname.startsWith('/clipper')) return 'clipper';
    if (location.pathname.startsWith('/launch-pipeline')) return 'launch';
    if (location.pathname.startsWith('/design')) return 'design';
    if (location.pathname.startsWith('/assets')) return 'assets';
    if (location.pathname.startsWith('/design/features')) return 'features';
    if (location.pathname.startsWith('/inventory')) return 'inventory';
    if (location.pathname.startsWith('/crm')) return 'crm';
    if (location.pathname.startsWith('/finance')) return 'finance';
    return 'design';
  };
  const currentModule = getCurrentModule();

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[var(--border-subtle)] bg-card/95 backdrop-blur px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Left: Logo and Brand */}
      <div className="flex items-center gap-3">
        <DawinGroupLogo size={36} />
        <div className="hidden sm:block border-l pl-3 border-[var(--border-subtle)]">
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          <p className="text-[10px] text-muted-foreground">Manufacturing Tools</p>
        </div>
      </div>

      {/* Center: Module Switcher */}
      <div className="flex items-center gap-1 border rounded-lg p-1 bg-[var(--bg-sunken)]">
        <button
          onClick={() => navigate('/clipper')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'clipper'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <Image className="h-4 w-4" />
          <span className="hidden sm:inline">Clipper</span>
        </button>
        <button
          onClick={() => navigate('/design')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'design'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Design Manager</span>
          <span className="sm:hidden">Designs</span>
        </button>
        <button
          onClick={() => navigate('/assets')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'assets'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <Wrench className="h-4 w-4" />
          <span className="hidden sm:inline">Assets</span>
        </button>
        <button
          onClick={() => navigate('/design/features')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'features'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Features</span>
        </button>
        <button
          onClick={() => navigate('/inventory')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'inventory'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <Package className="h-4 w-4" />
          <span className="hidden sm:inline">Inventory</span>
        </button>
        <button
          onClick={() => navigate('/launch-pipeline')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'launch'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <Rocket className="h-4 w-4" />
          <span className="hidden sm:inline">Launch</span>
        </button>
        <button
          onClick={() => navigate('/crm')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'crm'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">CRM</span>
        </button>
        <button
          onClick={() => navigate('/finance')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] sm:min-h-auto ${
            currentModule === 'finance'
              ? 'bg-[#1d1d1f] text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span className="hidden sm:inline">Finance</span>
        </button>
      </div>

      {/* Right: User Menu */}
      <div className="flex items-center gap-3">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-[var(--bg-sunken)] rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm text-muted-foreground hidden md:block">
                {user.displayName || user.email}
              </span>
            </div>
            <button
              onClick={() => navigate('/admin/settings')}
              className="p-2 text-muted-foreground hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-md transition-colors min-h-[44px] min-w-[44px] sm:min-h-auto sm:min-w-auto flex items-center justify-center"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 text-muted-foreground hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-md transition-colors min-h-[44px] min-w-[44px] sm:min-h-auto sm:min-w-auto flex items-center justify-center"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="flex items-center gap-2 px-4 py-2 bg-[#1d1d1f] text-white rounded-md text-sm font-medium hover:bg-[#424245] transition-colors min-h-[44px] sm:min-h-auto"
          >
            <User className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
