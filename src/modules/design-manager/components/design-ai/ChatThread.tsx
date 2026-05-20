/**
 * Chat Thread Component
 * Displays list of chat messages with parameter write-back support
 */

import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import type { ChatMessage, SuggestedParameters } from './useDesignChat';

interface ChatThreadProps {
  messages: ChatMessage[];
  onApplyParameters?: (messageId: string, params: SuggestedParameters) => Promise<void>;
  isApplyingParams?: boolean;
}

export function ChatThread({ messages, onApplyParameters, isApplyingParams }: ChatThreadProps) {
  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => (
        <ChatMessageComponent
          key={message.id}
          message={message}
          onApplyParameters={onApplyParameters}
          isApplyingParams={isApplyingParams}
        />
      ))}
    </div>
  );
}
