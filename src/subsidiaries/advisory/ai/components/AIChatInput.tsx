// src/subsidiaries/advisory/ai/components/AIChatInput.tsx

import React, { useState, useRef } from 'react';
import { Send, Paperclip, Mic, MicOff } from 'lucide-react';
import { AgentDomain } from '../types/agent';
import { cn } from '@/lib/utils';

interface AIChatInputProps {
  onSend: (content: string) => void;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  disabled?: boolean;
  currentDomain: AgentDomain;
  placeholder?: string;
}

export const AIChatInput: React.FC<AIChatInputProps> = ({
  onSend,
  suggestions = [],
  onSuggestionClick,
  disabled = false,
  currentDomain,
  placeholder,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Domain-specific placeholders
  const domainPlaceholders: Record<AgentDomain, string> = {
    general: 'Ask me anything...',
    infrastructure: 'Ask about projects, milestones, payments...',
    investment: 'Ask about portfolios, returns, performance...',
    advisory: 'Ask about deals, clients, proposals...',
    matflow: 'Ask about materials, requisitions, suppliers...',
    analytics: 'Request reports, comparisons, analyses...',
    settings: 'Configure preferences, notifications...',
  };

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    } else {
      setInput(suggestion);
      inputRef.current?.focus();
    }
  };

  const toggleVoiceInput = () => {
    setIsListening(!isListening);
    // Voice input implementation would go here
  };

  return (
    <div className="border-t bg-white">
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border-b">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="p-3 flex items-end gap-2">
        <button
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          disabled={disabled}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || domainPlaceholders[currentDomain]}
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-2xl resize-none',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'max-h-32'
            )}
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={toggleVoiceInput}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors',
              isListening ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className={cn(
            'p-2.5 rounded-xl transition-colors',
            disabled || !input.trim()
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default AIChatInput;
