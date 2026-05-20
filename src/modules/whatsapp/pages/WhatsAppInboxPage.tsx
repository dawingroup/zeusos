/**
 * WhatsAppInboxPage - Standalone two-panel WhatsApp messaging inbox
 */

import { useState, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { ConversationList } from '../components/ConversationList';
import { ConversationPanel } from '../components/ConversationPanel';
import { NewConversationDialog } from '../components/NewConversationDialog';
import { useConversation } from '../hooks';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import type { WhatsAppConversation } from '../types';

export default function WhatsAppInboxPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [showNewDialog, setShowNewDialog] = useState(false);

  const { conversation } = useConversation(selectedConversationId);

  const handleSelectConversation = useCallback((conv: WhatsAppConversation) => {
    setSelectedConversationId(conv.id);
  }, []);

  const handleNewConversation = useCallback(() => {
    setShowNewDialog(true);
  }, []);

  const handleStartConversation = useCallback(async (phoneNumber: string, customerName: string) => {
    setShowNewDialog(false);
    const normalized = normalizePhoneNumber(phoneNumber);
    const conversationsRef = collection(db, 'whatsappConversations');

    // Check if a conversation already exists for this phone number
    const existing = await getDocs(
      query(conversationsRef, where('phoneNumber', '==', normalized))
    );
    if (!existing.empty) {
      setSelectedConversationId(existing.docs[0].id);
      return;
    }

    // Create a new conversation document
    const docRef = await addDoc(conversationsRef, {
      customerId: null,
      customerName,
      phoneNumber: normalized,
      lastInboundAt: null,
      windowExpiresAt: null,
      isWindowOpen: false,
      status: 'active',
      unreadCount: 0,
      lastMessageText: '',
      lastMessageAt: serverTimestamp(),
      lastMessageDirection: 'outbound',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSelectedConversationId(docRef.id);
  }, []);

  return (
    <div className="h-[calc(100vh-8.5rem)] flex">
      {/* Left sidebar - conversation list */}
      <div className="w-80 flex-shrink-0">
        <ConversationList
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />
      </div>

      {/* Right panel - conversation */}
      <ConversationPanel conversation={conversation} />

      {/* New conversation dialog */}
      <NewConversationDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onStart={handleStartConversation}
      />
    </div>
  );
}
