/**
 * Mobile Navigation Component
 * Touch-friendly navigation for mobile devices
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger } from '@/core/components/ui/sheet';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  Menu,
  Home,
  FileSpreadsheet,
  Package,
  BarChart3,
  Settings,
  ChevronRight,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useSyncStatus } from '../../hooks/useSyncStatus';

interface MobileNavProps {
  projectId?: string;
  projectName?: string;
}

export function MobileNav({ projectId, projectName }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isOnline } = useNetworkStatus();
  const { pendingWrites } = useSyncStatus();

  const baseUrl = projectId
    ? `/advisory/matflow/projects/${projectId}`
    : '/advisory/matflow';

  const navItems = [
    { label: 'Dashboard', icon: Home, path: baseUrl },
    { label: 'BOQ Items', icon: FileSpreadsheet, path: `${baseUrl}/boq` },
    {
      label: 'Procurement',
      icon: Package,
      path: `${baseUrl}/procurement`,
      badge: pendingWrites > 0 ? pendingWrites : undefined,
    },
    { label: 'Progress', icon: BarChart3, path: `${baseUrl}/progress` },
    { label: 'Settings', icon: Settings, path: `${baseUrl}/settings` },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex flex-col h-full">
                {/* Sheet Header */}
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-lg">MatFlow</h2>
                  {projectName && (
                    <p className="text-sm text-muted-foreground truncate">
                      {projectName}
                    </p>
                  )}
                </div>

                {/* Nav Items */}
                <nav className="flex-1 p-2 space-y-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center justify-between px-3 py-3 rounded-lg transition-colors',
                        isActive(item.path)
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <Badge variant="secondary" className="h-5 min-w-[20px]">
                            {item.badge}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </div>
                    </Link>
                  ))}
                </nav>

                {/* Status Footer */}
                <div className="p-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    {isOnline ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-500" />
                        <span className="text-green-600">Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">Offline Mode</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Title */}
          <div className="flex-1 text-center">
            <h1 className="font-semibold truncate">
              {projectName || 'MatFlow'}
            </h1>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            {!isOnline && <WifiOff className="h-4 w-4 text-gray-500" />}
            {pendingWrites > 0 && (
              <Badge variant="secondary" className="h-6">
                {pendingWrites}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full relative',
                isActive(item.path) ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
              {item.badge && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 right-1/4 h-4 min-w-[16px] text-[10px] p-0 flex items-center justify-center"
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

export default MobileNav;
