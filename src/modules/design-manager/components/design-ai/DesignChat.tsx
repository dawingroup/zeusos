/**
 * Design Chat Component
 * Inline chat interface for AI design assistant
 *
 * Features:
 * - Conversational AI for design assistance
 * - Clip library browser for attaching reference clips
 * - Persistent chat history per design item
 * - Parameter write-back to design item indexes
 */

import { useRef, useEffect, useState } from 'react';
import { MessageSquare, X, Sparkles, Library } from 'lucide-react';
import { ChatThread } from './ChatThread';
import { ChatInput } from './ChatInput';
import { ClipBrowser } from './ClipBrowser';
import { useDesignChat } from './useDesignChat';

interface DesignChatProps {
  designItemId: string;
  projectId: string;
  designItemName?: string;
  userId?: string;
}

export function DesignChat({
  designItemId,
  projectId,
  designItemName,
  userId
}: DesignChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [clipBrowserOpen, setClipBrowserOpen] = useState(false);

  const {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    attachClip,
    applyParameters,
    isApplyingParams,
    clearError,
    usageStats,
  } = useDesignChat(designItemId, projectId, userId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-white" />
          <div>
            <h3 className="font-semibold text-white text-sm">Design AI Chat</h3>
            {designItemName && (
              <p className="text-xs text-white/80 truncate max-w-[300px]">{designItemName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-xs text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
              {messages.length} messages
            </span>
          )}
          <button
            onClick={() => setClipBrowserOpen(!clipBrowserOpen)}
            className={`p-1.5 rounded-lg transition-colors ${
              clipBrowserOpen
                ? 'bg-white/30 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/20'
            }`}
            title="Browse clip library"
          >
            <Library className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={clearError} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-purple-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Design AI Assistant</h4>
            <p className="text-sm text-gray-500 mb-4">
              Ask about materials, design decisions, upload reference images, or browse clips from your library for AI assessment.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Suggest materials', 'Analyze style', 'Manufacturing tips', 'Browse clips'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    if (prompt === 'Browse clips') {
                      setClipBrowserOpen(true);
                    } else {
                      sendMessage(prompt);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    prompt === 'Browse clips'
                      ? 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ChatThread
            messages={messages}
            onApplyParameters={applyParameters}
            isApplyingParams={isApplyingParams}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Clip Browser Panel */}
      {clipBrowserOpen && userId && (
        <ClipBrowser
          userId={userId}
          projectId={projectId}
          onAttachClip={attachClip}
          onClose={() => setClipBrowserOpen(false)}
          isSending={isSending}
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onToggleClipBrowser={userId ? () => setClipBrowserOpen(!clipBrowserOpen) : undefined}
        clipBrowserOpen={clipBrowserOpen}
        isSending={isSending}
        disabled={isLoading}
      />

      {/* Usage Stats */}
      {usageStats && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Tokens: {usageStats.inputTokens} in / {usageStats.outputTokens} out
          </p>
        </div>
      )}
    </div>
  );
}
