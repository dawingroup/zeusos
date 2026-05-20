/**
 * Mobile Layout Wrapper
 * Responsive layout that adapts between mobile and desktop
 */

import { Outlet } from 'react-router-dom';
import { MobileNav } from './MobileNav';
import { MobileQuickActions } from './MobileQuickActions';
import { OfflineIndicator } from '../offline/OfflineIndicator';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { cn } from '@/shared/lib/utils';

interface MobileLayoutProps {
  children?: React.ReactNode;
  projectId?: string;
  projectName?: string;
  showQuickActions?: boolean;
  className?: string;
}

export function MobileLayout({
  children,
  projectId,
  projectName,
  showQuickActions = true,
  className,
}: MobileLayoutProps) {
  const isMobile = useIsMobile();

  // Render regular layout for desktop
  if (!isMobile) {
    return <>{children || <Outlet />}</>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Mobile Navigation */}
      <MobileNav projectId={projectId} projectName={projectName} />

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          // Account for header (56px) and bottom nav (64px)
          'pt-14 pb-16',
          className
        )}
      >
        {children || <Outlet />}
      </main>

      {/* Quick Actions FAB */}
      {showQuickActions && projectId && (
        <MobileQuickActions projectId={projectId} />
      )}

      {/* Offline indicator (positioned at bottom) */}
      <div className="fixed bottom-20 left-4 z-50">
        <OfflineIndicator variant="badge" showDetails={false} />
      </div>
    </div>
  );
}

export default MobileLayout;
