// src/subsidiaries/advisory/ai/components/AIChatMessage.tsx

import React from 'react';
import { Bot, User } from 'lucide-react';
import { AgentMessage, AgentAction } from '../types/agent';
import { AIActionCard } from './AIActionCard';
import { AIEntityChip } from './AIEntityChip';
import { cn } from '@/lib/utils';

interface AIChatMessageProps {
  message: AgentMessage;
  onActionClick?: (action: AgentAction) => void;
}

export const AIChatMessage: React.FC<AIChatMessageProps> = ({
  message,
  onActionClick,
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-UG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'flex gap-3 max-w-[85%]',
        isUser ? 'flex-row-reverse self-end' : 'flex-row self-start'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Message Content */}
      <div className="flex-1">
        <div
          className={cn(
            'px-4 py-3 rounded-2xl',
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          )}
        >
          {/* Message Text */}
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* Detected Entities */}
          {isAssistant && message.entities && message.entities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {message.entities.map((entity, index) => (
                <AIEntityChip key={index} entity={entity} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {isAssistant && message.actions && message.actions.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.actions.map((action) => (
              <AIActionCard
                key={action.id}
                action={action}
                onClick={() => onActionClick?.(action)}
              />
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-xs text-gray-400">
            {formatTimestamp(message.createdAt)}
          </span>

          {isAssistant && message.domainContext && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              {message.domainContext.domain}
            </span>
          )}

          {isAssistant && message.processingTimeMs && (
            <span className="text-xs text-gray-400">
              {message.processingTimeMs}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChatMessage;
