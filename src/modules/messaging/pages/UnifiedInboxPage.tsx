/**
 * Unified Messaging Inbox Page
 * Tab-based view combining WhatsApp (external) and Google Chat (internal) channels
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/core/components/ui/tabs';
import { Badge } from '@/core/components/ui/badge';
import { MessageSquare, Hash } from 'lucide-react';
import { subscribeToUnreadCount } from '@/modules/whatsapp/services/whatsappService';
import { subscribeToGChatUnreadCount } from '@/modules/gchat/services/gchatService';
import { Suspense } from 'react';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

const WhatsAppInboxPage = lazyWithRetry(() => import('@/modules/whatsapp/pages/WhatsAppInboxPage'));
const GChatInboxPage = lazyWithRetry(() => import('@/modules/gchat/pages/GChatInboxPage'));

export default function UnifiedInboxPage() {
  const [activeTab, setActiveTab] = useState<string>('whatsapp');
  const [waUnread, setWaUnread] = useState(0);
  const [gchatUnread, setGchatUnread] = useState(0);

  useEffect(() => {
    const unsubs = [
      subscribeToUnreadCount(setWaUnread),
      subscribeToGChatUnreadCount(setGchatUnread),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="border-b px-4 shrink-0">
          <TabsList className="h-10">
            <TabsTrigger value="whatsapp" className="gap-2 data-[state=active]:bg-green-50 dark:data-[state=active]:bg-green-950/20">
              <MessageSquare className="h-4 w-4" />
              <span>WhatsApp</span>
              {waUnread > 0 && (
                <Badge
                  variant="default"
                  className="h-5 min-w-[20px] bg-green-600 hover:bg-green-600 text-[10px]"
                >
                  {waUnread > 9 ? '9+' : waUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="gchat" className="gap-2 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/20">
              <Hash className="h-4 w-4" />
              <span>Team Chat</span>
              {gchatUnread > 0 && (
                <Badge
                  variant="default"
                  className="h-5 min-w-[20px] bg-blue-600 hover:bg-blue-600 text-[10px]"
                >
                  {gchatUnread > 9 ? '9+' : gchatUnread}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="whatsapp" className="flex-1 mt-0 data-[state=inactive]:hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
            <WhatsAppInboxPage />
          </Suspense>
        </TabsContent>
        <TabsContent value="gchat" className="flex-1 mt-0 data-[state=inactive]:hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
            <GChatInboxPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
