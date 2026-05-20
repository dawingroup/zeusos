/**
 * Google Chat Inbox Page
 * Two-panel layout: space list (left) + message thread (right)
 * Mirrors the WhatsAppInboxPage pattern
 */

import { useState, useRef, useEffect } from 'react';
import { useSpaces, useSpace, useGChatMessages, useGChatSend } from '../hooks';
import type { GChatSpace, SpaceFilter } from '../types';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import {
  Search,
  Send,
  Users,
  Hash,
  AlertTriangle,
  FolderOpen,
  Loader2,
} from 'lucide-react';

export default function GChatInboxPage() {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [composeText, setComposeText] = useState('');

  const filter: SpaceFilter = {
    status: 'active',
    ...(searchTerm ? { search: searchTerm } : {}),
  };

  const { spaces, loading: spacesLoading } = useSpaces(filter);
  const { space: selectedSpace } = useSpace(selectedSpaceId);
  const { messages, loading: messagesLoading } = useGChatMessages(selectedSpaceId);
  const { send, sending } = useGChatSend();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!selectedSpaceId || !composeText.trim()) return;
    await send(selectedSpaceId, composeText.trim());
    setComposeText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSpaceIcon = (space: GChatSpace) => {
    switch (space.type) {
      case 'incident':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'project':
        return <FolderOpen className="h-4 w-4 text-blue-500" />;
      default:
        return <Hash className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] border rounded-lg overflow-hidden bg-background">
      {/* Left Panel - Space List */}
      <div className="w-80 border-r flex flex-col">
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search spaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Space List */}
        <ScrollArea className="flex-1">
          {spacesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : spaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No active spaces</p>
            </div>
          ) : (
            <div className="divide-y">
              {spaces.map((space) => (
                <button
                  key={space.id}
                  onClick={() => setSelectedSpaceId(space.id)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                    selectedSpaceId === space.id ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {getSpaceIcon(space)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {space.displayName}
                        </span>
                        {space.unreadCount > 0 && (
                          <Badge
                            variant="default"
                            className="ml-1 h-5 min-w-[20px] bg-blue-600 hover:bg-blue-600"
                          >
                            {space.unreadCount > 9 ? '9+' : space.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {space.lastMessageText || 'No messages yet'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {space.memberCount} member{space.memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Messages */}
      <div className="flex-1 flex flex-col">
        {!selectedSpaceId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Select a space to view messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Space Header */}
            {selectedSpace && (
              <div className="p-3 border-b flex items-center gap-2">
                {getSpaceIcon(selectedSpace)}
                <div>
                  <h3 className="font-medium text-sm">{selectedSpace.displayName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedSpace.memberCount} member{selectedSpace.memberCount !== 1 ? 's' : ''}
                    {selectedSpace.type === 'incident' && selectedSpace.severity && (
                      <span className="ml-2 text-red-500">
                        Severity: {selectedSpace.severity}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.direction as string === 'outbound' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 ${
                          msg.direction as string === 'outbound'
                            ? 'bg-blue-600 text-white'
                            : 'bg-muted'
                        }`}
                      >
                        {msg.direction === 'inbound' && (
                          <p
                            className={`text-[10px] font-medium mb-0.5 ${
                              msg.direction as string === 'outbound'
                                ? 'text-blue-100'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {msg.senderName}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.textContent}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            msg.direction as string === 'outbound'
                              ? 'text-blue-200'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {msg.createdAt?.toDate?.()
                            ? msg.createdAt.toDate().toLocaleTimeString('en-UG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Compose Bar */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!composeText.trim() || sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
