/**
 * Portal Messaging Component
 * Enables communication between team and clients within the portal
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Users, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import {
  sendPortalMessage,
  getPortalMessages,
  markMessagesAsRead,
} from '../../services/clientPortalExtendedService';
import type { ClientPortalMessage, MessageSenderType } from '../../types/clientPortal';

interface PortalMessagingProps {
  projectId: string;
  quoteId?: string;
  currentUserType: MessageSenderType;
  currentUserName: string;
  currentUserId?: string;
  currentUserEmail?: string;
}

export default function PortalMessaging({
  projectId,
  quoteId,
  currentUserType,
  currentUserName,
  currentUserId,
  currentUserEmail,
}: PortalMessagingProps) {
  const [messages, setMessages] = useState<ClientPortalMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [projectId, quoteId]);

  useEffect(() => {
    // Mark unread messages as read
    const unreadIds = messages
      .filter(m => !m.isRead && m.senderType !== currentUserType)
      .map(m => m.id);
    
    if (unreadIds.length > 0) {
      markMessagesAsRead(unreadIds);
    }
  }, [messages, currentUserType]);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const data = await getPortalMessages(projectId, quoteId);
      setMessages(data.reverse()); // Oldest first for chat view
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const message = await sendPortalMessage(
        projectId,
        quoteId,
        currentUserType,
        currentUserName,
        newMessage.trim(),
        'general',
        {
          senderId: currentUserId,
          senderEmail: currentUserEmail,
        }
      );
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: ClientPortalMessage[] }[] = [];
  let currentDate = '';
  
  messages.forEach(message => {
    const messageDate = formatDate(message.createdAt);
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groupedMessages.push({ date: messageDate, messages: [] });
    }
    groupedMessages[groupedMessages.length - 1].messages.push(message);
  });

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Messages
          {messages.filter(m => !m.isRead && m.senderType !== currentUserType).length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {messages.filter(m => !m.isRead && m.senderType !== currentUserType).length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMessages.map((group, groupIdx) => (
                <div key={groupIdx}>
                  {/* Date Separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                      {group.date}
                    </div>
                  </div>

                  {/* Messages for this date */}
                  <div className="space-y-3">
                    {group.messages.map((message) => {
                      const isOwn = message.senderType === currentUserType;
                      
                      return (
                        <div
                          key={message.id}
                          className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                        >
                          <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-medium ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {message.senderType === 'team' ? (
                              <Users className="h-4 w-4" />
                            ) : (
                              getInitials(message.senderName)
                            )}
                          </div>
                          
                          <div className={`max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${isOwn ? 'order-2' : ''}`}>
                                {message.senderName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(message.createdAt)}
                              </span>
                            </div>
                            
                            <div
                              className={`rounded-lg px-3 py-2 text-sm ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{message.content}</p>
                              
                              {/* Attachments */}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {message.attachments.map((att) => (
                                    <a
                                      key={att.id}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs underline"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                      {att.name}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
