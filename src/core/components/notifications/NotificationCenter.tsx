import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Inbox } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';
import { Button } from '@/core/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/components/ui/tabs';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { Badge } from '@/core/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { useNotifications } from '@/integration/store';

export interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const { items, unreadCount, markNotificationRead, markAllNotificationsRead } = useNotifications();

  const unread = useMemo(() => items.filter((n) => !n.isRead), [items]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0" aria-describedby={undefined}>
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <SheetTitle className="text-base">Notifications</SheetTitle>
              {unreadCount > 0 && <Badge variant="secondary">{unreadCount}</Badge>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllNotificationsRead()}
              disabled={unreadCount === 0}
            >
              Mark all read
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="all" className="w-full">
          <div className="px-4 py-2 border-b">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">
                Unread
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="m-0">
            <NotificationList
              items={items}
              onMarkRead={(id) => markNotificationRead(id)}
            />
          </TabsContent>

          <TabsContent value="unread" className="m-0">
            <NotificationList
              items={unread}
              onMarkRead={(id) => markNotificationRead(id)}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function NotificationList({
  items,
  onMarkRead,
}: {
  items: Array<{
    id: string;
    title: string;
    message: string;
    module: string;
    isRead: boolean;
    createdAt: any;
  }>;
  onMarkRead: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <div className="text-sm">No notifications</div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="p-2">
        {items.map((n) => {
          const date = n.createdAt?.toDate?.() ? n.createdAt.toDate() : new Date(n.createdAt);
          const time = isNaN(date.getTime()) ? '' : formatDistanceToNow(date, { addSuffix: true });

          return (
            <button
              key={n.id}
              className={cn(
                'w-full text-left rounded-lg p-3 hover:bg-muted transition-colors',
                !n.isRead && 'bg-muted/50'
              )}
              onClick={() => {
                if (!n.isRead) onMarkRead(n.id);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={cn('font-medium truncate', !n.isRead && 'text-foreground')}>
                      {n.title}
                    </div>
                    {!n.isRead && (
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {n.message}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {n.module}
                    </Badge>
                    {time && <span className="text-[10px] text-muted-foreground">{time}</span>}
                  </div>
                </div>
                {!n.isRead && (
                  <div className="shrink-0">
                    <Check className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
