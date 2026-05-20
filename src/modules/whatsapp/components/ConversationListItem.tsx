/**
 * ConversationListItem - Single conversation row in the sidebar
 * Shows message type indicators (template, image, doc, location) and delivery status
 */

import {
  MessageSquare,
  Image,
  FileText,
  MapPin,
  LayoutTemplate,
} from 'lucide-react';
import type { WhatsAppConversation } from '../types';

interface Props {
  conversation: WhatsAppConversation;
  isSelected: boolean;
  onClick: () => void;
}

function formatRelativeTime(timestamp: { toDate?: () => Date } | null | undefined): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp as unknown as string);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Parse the last message text to detect message type and return
 * a cleaner preview with an appropriate icon.
 */
function getMessagePreview(text: string): { icon: React.ElementType | null; preview: string } {
  if (!text) return { icon: null, preview: 'No messages' };

  // Template messages: "[Template: quote_submission]"
  if (text.startsWith('[Template:')) {
    const name = text.replace(/^\[Template:\s*/, '').replace(/\]$/, '');
    return { icon: LayoutTemplate, preview: name.replace(/_/g, ' ') };
  }

  // Document messages: "[Document: filename.pdf]"
  if (text.startsWith('[Document:')) {
    const name = text.replace(/^\[Document:\s*/, '').replace(/\]$/, '');
    return { icon: FileText, preview: name };
  }

  // Image messages: "[Image]" or has caption
  if (text === '[Image]' || text.startsWith('[Image:')) {
    return { icon: Image, preview: 'Photo' };
  }

  // Location messages: "[Location]"
  if (text === '[Location]' || text.startsWith('[Location:')) {
    return { icon: MapPin, preview: 'Location' };
  }

  // Interactive messages: "[Interactive: ...]"
  if (text.startsWith('[Interactive:')) {
    return { icon: MessageSquare, preview: 'Interactive message' };
  }

  return { icon: null, preview: text };
}

export function ConversationListItem({ conversation, isSelected, onClick }: Props) {
  const hasUnread = conversation.unreadCount > 0;
  const isOutbound = conversation.lastMessageDirection === 'outbound';
  const { icon: TypeIcon, preview } = getMessagePreview(conversation.lastMessageText);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-gray-50 ${
        isSelected ? 'bg-green-50 border-l-2 border-l-green-600' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-green-600" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name and time */}
          <div className="flex items-center justify-between">
            <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
              {conversation.customerName}
            </p>
            <span className={`text-xs flex-shrink-0 ml-2 ${hasUnread ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
              {formatRelativeTime(conversation.lastMessageAt)}
            </span>
          </div>

          {/* Last message preview and unread badge */}
          <div className="flex items-center justify-between mt-0.5">
            <p className={`text-xs truncate flex items-center gap-1 ${hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              {isOutbound && (
                <span className="text-gray-400 flex-shrink-0">You: </span>
              )}
              {TypeIcon && (
                <TypeIcon className="w-3 h-3 flex-shrink-0 text-gray-400" />
              )}
              <span className="truncate">{preview}</span>
            </p>
            {hasUnread && (
              <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center">
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
