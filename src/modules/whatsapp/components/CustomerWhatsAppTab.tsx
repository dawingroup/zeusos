/**
 * CustomerWhatsAppTab - Embedded WhatsApp conversation view for CustomerDetail
 * Shows conversation history for a specific customer
 */

import { useMemo } from 'react';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useConversations, useConversation } from '../hooks';
import { ConversationPanel } from './ConversationPanel';
import type { ConversationFilter } from '../types';

interface Props {
  customerId: string;
  phone: string;
  customerName: string;
}

export function CustomerWhatsAppTab({ customerId, phone: _phone, customerName: _customerName }: Props) {
  const filter = useMemo<ConversationFilter>(() => ({ customerId }), [customerId]);
  const { conversations, loading } = useConversations(filter);

  // Use the most recent conversation for this customer
  const latestConversation = conversations[0] || null;
  const { conversation } = useConversation(latestConversation?.id);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!latestConversation) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">WhatsApp</h3>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          No WhatsApp conversations with this customer yet.
        </p>
        <p className="text-xs text-gray-400">
          Start a conversation from the{' '}
          <Link to="/whatsapp" className="text-green-600 hover:underline">
            WhatsApp Inbox
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-green-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">WhatsApp Conversation</h3>
          {conversations.length > 1 && (
            <span className="text-xs text-gray-500">({conversations.length} conversations)</span>
          )}
        </div>
        <Link
          to="/whatsapp"
          className="flex items-center gap-1 text-xs text-green-600 hover:underline"
        >
          Open Inbox <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Conversation panel (constrained height for inline view) */}
      <div className="h-96">
        <ConversationPanel conversation={conversation} />
      </div>
    </div>
  );
}
