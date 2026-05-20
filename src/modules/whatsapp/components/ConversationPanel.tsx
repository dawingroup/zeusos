/**
 * ConversationPanel - Main conversation view with message thread and compose bar
 * Includes enriched header with customer info lookup and quick actions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Phone,
  User,
  ExternalLink,
  FileText,
  UserCheck,
  Building2,
  Loader2,
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useMessages, useConversationWindow, useWhatsAppSend } from '../hooks';
import { markConversationRead } from '../services/whatsappService';
import { MessageThread } from './MessageThread';
import { ComposeBar } from './ComposeBar';
import { WhatsAppWindowBanner } from './WhatsAppWindowBanner';
import { formatPhoneForDisplay } from '../utils/phoneUtils';
import type { WhatsAppConversation, TemplateFormData } from '../types';

interface Props {
  conversation: WhatsAppConversation | null;
}

interface CustomerInfo {
  id: string;
  name: string;
  email?: string;
  company?: string;
  code?: string;
}

interface LinkedDeal {
  id: string;
  title: string;
  stage?: string;
}

export function ConversationPanel({ conversation }: Props) {
  const { messages, loading: messagesLoading } = useMessages(conversation?.id);
  const windowState = useConversationWindow(conversation);
  const { sendText, sendTemplate, sending, error } = useWhatsAppSend();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [linkedDeal, setLinkedDeal] = useState<LinkedDeal | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Mark conversation as read when selected
  useEffect(() => {
    if (conversation?.id && conversation.unreadCount > 0) {
      markConversationRead(conversation.id);
    }
  }, [conversation?.id, conversation?.unreadCount]);

  // Fetch customer info when conversation changes
  useEffect(() => {
    if (!conversation) {
      setCustomerInfo(null);
      setLinkedDeal(null);
      return;
    }

    setLoadingCustomer(true);
    setCustomerInfo(null);
    setLinkedDeal(null);

    (async () => {
      try {
        // 1. Try by customerId first
        if (conversation.customerId) {
          const custSnap = await getDoc(doc(db, 'customers', conversation.customerId));
          if (custSnap.exists()) {
            const d = custSnap.data();
            setCustomerInfo({
              id: custSnap.id,
              name: d.name,
              email: d.email,
              company: d.company,
              code: d.code,
            });
          }
        }

        // 2. If no customerId, search by phone number
        if (!conversation.customerId && conversation.phoneNumber) {
          const phone = conversation.phoneNumber;
          const formats = [phone, `+${phone}`, phone.startsWith('256') ? `0${phone.substring(3)}` : null].filter(Boolean);

          for (const fmt of formats) {
            const q = query(collection(db, 'customers'), where('phone', '==', fmt), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const d = snap.docs[0].data();
              setCustomerInfo({
                id: snap.docs[0].id,
                name: d.name,
                email: d.email,
                company: d.company,
                code: d.code,
              });
              break;
            }
          }
        }

        // 3. Look for linked CRM deal
        if (conversation.customerId) {
          const dealsQuery = query(
            collection(db, 'deals'),
            where('customerId', '==', conversation.customerId),
            where('stage', '!=', 'closed_lost'),
            limit(1)
          );
          const dealsSnap = await getDocs(dealsQuery);
          if (!dealsSnap.empty) {
            const d = dealsSnap.docs[0].data();
            setLinkedDeal({
              id: dealsSnap.docs[0].id,
              title: d.title || d.name,
              stage: d.stage,
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch customer info:', err);
      } finally {
        setLoadingCustomer(false);
      }
    })();
  }, [conversation?.id, conversation?.customerId, conversation?.phoneNumber]);

  const handleSendText = useCallback(
    (text: string) => {
      if (!conversation) return;
      sendText(conversation.id, conversation.phoneNumber, text);
    },
    [conversation, sendText]
  );

  const handleSendTemplate = useCallback(
    (data: TemplateFormData) => {
      if (!conversation) return;
      sendTemplate(
        conversation.id,
        conversation.phoneNumber,
        data.templateId,
        data.templateName,
        data.params
      );
    },
    [conversation, sendTemplate]
  );

  // Empty state
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <MessageSquare className="w-16 h-16 mb-4" />
        <p className="text-lg font-medium">Select a conversation</p>
        <p className="text-sm">Choose a conversation from the list to start messaging</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Conversation header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            customerInfo ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {customerInfo ? (
              <UserCheck className="w-5 h-5 text-green-600" />
            ) : (
              <User className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {/* Name + phone + customer badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 truncate">{conversation.customerName}</p>
              {loadingCustomer && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
              {customerInfo && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-green-100 text-green-700 rounded px-1.5 py-0.5 flex-shrink-0">
                  <UserCheck className="w-2.5 h-2.5" />
                  {customerInfo.code || 'Client'}
                </span>
              )}
              {!customerInfo && !loadingCustomer && (
                <span className="text-[10px] text-gray-400 flex-shrink-0">Not in system</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {formatPhoneForDisplay(conversation.phoneNumber)}
              </p>
              {customerInfo?.email && (
                <p className="text-xs text-gray-400 truncate">{customerInfo.email}</p>
              )}
              {customerInfo?.company && (
                <p className="text-xs text-gray-400 flex items-center gap-0.5 truncate">
                  <Building2 className="w-3 h-3" />
                  {customerInfo.company}
                </p>
              )}
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {customerInfo && (
              <a
                href={`/customers/${customerInfo.id}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                title="View customer profile"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {linkedDeal && (
              <a
                href={`/crm/deals/${linkedDeal.id}`}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                title={`Deal: ${linkedDeal.title}`}
              >
                <FileText className="w-3 h-3" />
                {linkedDeal.title.length > 20 ? linkedDeal.title.substring(0, 20) + '...' : linkedDeal.title}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Window status banner */}
      <WhatsAppWindowBanner windowState={windowState} />

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-sm border-b">
          {error}
        </div>
      )}

      {/* Message thread */}
      <MessageThread messages={messages} loading={messagesLoading} />

      {/* Compose bar */}
      <ComposeBar
        windowState={windowState}
        onSendText={handleSendText}
        onSendTemplate={handleSendTemplate}
        sending={sending}
      />
    </div>
  );
}
