/**
 * MessageThread - Scrollable list of message bubbles grouped by date
 */

import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { MessageBubble, formatDate } from './MessageBubble';
import type { WhatsAppMessage } from '../types';

interface Props {
  messages: WhatsAppMessage[];
  loading: boolean;
}

export function MessageThread({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        No messages yet. Send a template message to start the conversation.
      </div>
    );
  }

  // Group messages by date
  let lastDate = '';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {messages.map((message) => {
        const messageDate = formatDate(message.sentAt);
        const showDateSeparator = messageDate !== lastDate;
        lastDate = messageDate;

        return (
          <div key={message.id}>
            {showDateSeparator && (
              <div className="flex items-center justify-center my-3">
                <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                  {messageDate}
                </span>
              </div>
            )}
            <MessageBubble message={message} />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
