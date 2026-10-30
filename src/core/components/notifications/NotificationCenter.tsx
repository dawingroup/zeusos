/**
 * NotificationCenter — the bell's list: the signed-in person's in-app notices
 * (`notifications` where userId == them), read through GlobalContext's one
 * listener and normalised by core/services/inAppNotice.
 *
 * Opening a notice marks it read and goes where its `actionUrl` says. The
 * list leaves out what another surface owns (messages), what is archived,
 * what has expired (yesterday's "Your focus today") and the modules the
 * person muted in their notification settings.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Inbox, Settings } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/components/ui/sheet';
import { Button } from '@/core/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/components/ui/tabs';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { Badge } from '@/core/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { useNotifications, usePreferences } from '@/integration/store';
import { bellNotices, noticeCreatedMs, NOTICE_MODULE_CATALOG } from '@/core/services/inAppNotice';
import type { GlobalNotification } from '@/integration/types';

const EXPIRY_TICK_MS = 60_000;

const PRIORITY_DOT: Record<GlobalNotification['priority'], string> = {
  critical: 'var(--rag-red)',
  high: 'var(--rag-amber)',
  medium: 'var(--rag-blue)',
  low: 'var(--fg-tertiary)',
};

function moduleLabel(module: string): string {
  return NOTICE_MODULE_CATALOG.find((m) => m.module === module)?.label ?? module;
}

export interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const { items, markNotificationRead, markAllNotificationsRead } = useNotifications();
  const { preferences } = usePreferences();
  const navigate = useNavigate();

  // Notices with an expiry drop out on their own, without waiting for the next snapshot.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), EXPIRY_TICK_MS);
    return () => window.clearInterval(id);
  }, [open]);

  const muted = preferences?.notificationSettings?.mutedModules ?? [];
  const notices = useMemo(() => bellNotices(items, now, muted), [items, now, muted]);
  const unread = useMemo(() => notices.filter((n) => !n.isRead), [notices]);

  const openNotice = (n: GlobalNotification) => {
    if (!n.isRead) markNotificationRead(n.id);
    if (n.actionUrl) {
      onOpenChange(false);
      navigate(n.actionUrl);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0" aria-describedby={undefined} data-testid="notification-center">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <SheetTitle className="text-base">Notifications</SheetTitle>
              {unread.length > 0 && <Badge variant="secondary" data-testid="notification-center-unread">{unread.length}</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => markAllNotificationsRead()} disabled={unread.length === 0}>
                Mark all read
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Notification settings" onClick={() => { onOpenChange(false); navigate('/notification-settings'); }}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="all" className="w-full">
          <div className="px-4 py-2 border-b">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">Unread</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="all" className="m-0">
            <NotificationList items={notices} onOpen={openNotice} />
          </TabsContent>
          <TabsContent value="unread" className="m-0">
            <NotificationList items={unread} onOpen={openNotice} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function NotificationList({ items, onOpen }: { items: GlobalNotification[]; onOpen: (n: GlobalNotification) => void }) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <div className="text-sm">You&apos;re all caught up</div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <ul className="p-2">
        {items.map((n) => {
          const created = noticeCreatedMs(n);
          return (
            <li key={n.id}>
              <button
                type="button"
                className={cn('w-full text-left rounded-lg p-3 hover:bg-muted transition-colors flex items-start gap-2', !n.isRead && 'bg-muted/50')}
                onClick={() => onOpen(n)}
                data-testid="notice-row"
                data-read={n.isRead ? 'true' : 'false'}
              >
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.isRead ? 'transparent' : PRIORITY_DOT[n.priority] }} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm truncate', !n.isRead && 'font-medium')}>{n.title}</span>
                  {n.message && <span className="block text-xs text-muted-foreground line-clamp-2 whitespace-pre-line mt-0.5">{n.message}</span>}
                  <span className="mt-1.5 flex items-center gap-2">
                    {n.module && <Badge variant="outline" className="text-[10px]">{moduleLabel(n.module)}</Badge>}
                    {created != null && <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(created, { addSuffix: true })}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
