// src/subsidiaries/advisory/ai/components/AIChat.tsx

import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2, History, Settings, MessageSquare } from 'lucide-react';
import { useAIConversation, useAISuggestions } from '../hooks/useAIAgent';
import { AgentDomain, AgentAction, AgentMessage as AgentMessageType } from '../types/agent';
import { AIChatInput } from './AIChatInput';
import { AIChatMessage } from './AIChatMessage';
import { AIDomainIndicator } from './AIDomainIndicator';
import { cn } from '@/lib/utils';

interface AIChatProps {
  userId: string;
  organizationId: string;
  conversationId?: string;
  initialModule?: string;
  initialEntityId?: string;
  initialEntityType?: string;
  position?: 'fixed' | 'inline';
  defaultExpanded?: boolean;
  onClose?: () => void;
  onNavigate?: (path: string) => void;
}

export const AIChat: React.FC<AIChatProps> = ({
  userId,
  organizationId,
  conversationId,
  initialModule,
  initialEntityId,
  initialEntityType,
  position = 'fixed',
  defaultExpanded = false,
  onClose,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    isSending,
    error,
    currentDomain,
    sendMessage,
    clearConversation,
    executeAction,
  } = useAIConversation({
    userId,
    organizationId,
    conversationId,
    sessionContext: {
      currentModule: initialModule,
      currentEntityId: initialEntityId,
      currentEntityType: initialEntityType,
    },
    onDomainChange: (domain) => {
      console.log('Domain changed to:', domain);
    },
    onAction: (action) => {
      handleAction(action);
    },
  });

  const { suggestions, refreshSuggestions } = useAISuggestions(currentDomain);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Refresh suggestions on domain change
  useEffect(() => {
    refreshSuggestions();
  }, [currentDomain, refreshSuggestions]);

  const handleAction = (action: AgentAction) => {
    if (action.type === 'navigate' && action.result) {
      const result = action.result as { path?: string };
      if (result.path) {
        onNavigate?.(result.path);
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Fixed position chat widget
  if (position === 'fixed') {
    return (
      <>
        {/* Floating Action Button */}
        {!isOpen && (
          <button
            onClick={handleToggle}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <MessageSquare className="w-6 h-6" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>
        )}

        {/* Chat Panel */}
        {isOpen && (
          <div
            className={cn(
              'fixed z-50 bg-white shadow-2xl flex flex-col',
              isFullscreen
                ? 'inset-0'
                : 'bottom-0 right-0 w-full sm:w-[420px] h-[85vh] sm:h-[600px] sm:bottom-6 sm:right-6 rounded-t-2xl sm:rounded-2xl'
            )}
          >
            <ChatContainer
              messages={messages}
              isLoading={isLoading}
              isSending={isSending}
              error={error}
              currentDomain={currentDomain}
              suggestions={suggestions}
              isFullscreen={isFullscreen}
              onSendMessage={handleSendMessage}
              onSuggestionClick={handleSuggestionClick}
              onClear={clearConversation}
              onClose={handleClose}
              onToggleFullscreen={toggleFullscreen}
              onExecuteAction={executeAction}
              messagesEndRef={messagesEndRef}
            />
          </div>
        )}
      </>
    );
  }

  // Inline chat component
  return (
    <div className="h-full flex flex-col overflow-hidden bg-white rounded-lg shadow">
      <ChatContainer
        messages={messages}
        isLoading={isLoading}
        isSending={isSending}
        error={error}
        currentDomain={currentDomain}
        suggestions={suggestions}
        isFullscreen={false}
        onSendMessage={handleSendMessage}
        onSuggestionClick={handleSuggestionClick}
        onClear={clearConversation}
        onExecuteAction={executeAction}
        messagesEndRef={messagesEndRef}
        showHeader={false}
      />
    </div>
  );
};

// Internal chat container component
interface ChatContainerProps {
  messages: AgentMessageType[];
  isLoading: boolean;
  isSending: boolean;
  error: Error | null;
  currentDomain: AgentDomain;
  suggestions: string[];
  isFullscreen: boolean;
  onSendMessage: (content: string) => void;
  onSuggestionClick: (suggestion: string) => void;
  onClear: () => void;
  onClose?: () => void;
  onToggleFullscreen?: () => void;
  onExecuteAction: (action: AgentAction) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  showHeader?: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isLoading,
  isSending,
  error,
  currentDomain,
  suggestions,
  isFullscreen,
  onSendMessage,
  onSuggestionClick,
  onClear: _onClear,
  onClose,
  onToggleFullscreen,
  onExecuteAction,
  messagesEndRef,
  showHeader = true,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-2xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <span className="font-semibold">Dawin AI</span>
            <AIDomainIndicator domain={currentDomain} size="small" />
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-blue-500 rounded-lg transition-colors">
              <History className="w-4 h-4" />
            </button>
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            )}
            <button className="p-2 hover:bg-blue-500 rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Welcome to Dawin AI
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              I can help you manage projects, investments, advisory services, and procurement.
              Try one of the suggestions below to get started.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <AIChatMessage
              key={message.id}
              message={message}
              onActionClick={onExecuteAction}
            />
          ))
        )}

        {isSending && (
          <div className="flex items-center gap-2 pl-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-500">Dawin AI is thinking...</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Error: {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <AIChatInput
        onSend={onSendMessage}
        suggestions={messages.length === 0 ? suggestions : []}
        onSuggestionClick={onSuggestionClick}
        disabled={isSending}
        currentDomain={currentDomain}
      />
    </div>
  );
};

export default AIChat;
