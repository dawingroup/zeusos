/**
 * ConversationList - Sidebar with search, filter, and conversation previews
 */

import { useState } from 'react';
import { Search, Loader2, MessageSquarePlus } from 'lucide-react';
import { useConversations } from '../hooks';
import { ConversationListItem } from './ConversationListItem';
import type { ConversationFilter, WhatsAppConversation } from '../types';

interface Props {
  selectedId?: string;
  onSelect: (conversation: WhatsAppConversation) => void;
  onNewConversation?: () => void;
  filter?: ConversationFilter;
}

export function ConversationList({ selectedId, onSelect, onNewConversation, filter: externalFilter }: Props) {
  const [search, setSearch] = useState('');

  const combinedFilter: ConversationFilter = {
    ...externalFilter,
    search: search || undefined,
  };

  const { conversations, loading } = useConversations(combinedFilter);

  return (
    <div className="flex flex-col h-full border-r bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">WhatsApp</h2>
          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="New conversation"
            >
              <MessageSquarePlus className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquarePlus className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {search ? 'No conversations match your search' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isSelected={conversation.id === selectedId}
              onClick={() => onSelect(conversation)}
            />
          ))
        )}
      </div>
    </div>
  );
}
