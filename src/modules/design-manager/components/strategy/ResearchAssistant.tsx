/**
 * Research Assistant Component
 * AI chat interface for strategy research
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Globe, Loader2, Bookmark, ExternalLink, User, Sparkles } from 'lucide-react';
import type { ResearchMessage, ResearchFinding } from './useStrategyResearch';

interface ResearchAssistantProps {
  messages: ResearchMessage[];
  isSending: boolean;
  onSendQuery: (query: string, enableWebSearch?: boolean) => Promise<void>;
  onSaveFinding: (finding: Omit<ResearchFinding, 'id' | 'createdAt'>) => Promise<void>;
}

export function ResearchAssistant({ messages, isSending, onSendQuery, onSaveFinding }: ResearchAssistantProps) {
  // Safety check: provide default empty array if undefined
  const safeMessages = messages || [];

  const [query, setQuery] = useState('');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeMessages]);

  const handleSend = async () => {
    if (!query.trim() || isSending) return;
    const currentQuery = query;
    setQuery('');
    await onSendQuery(currentQuery, enableWebSearch);
  };

  const handleSaveFinding = (message: ResearchMessage) => {
    onSaveFinding({
      title: message.content.substring(0, 50) + '...',
      content: message.content,
      sources: message.sources?.map(s => s.url) || [],
      category: 'insight',
    });
  };

  const suggestedQueries = [
    'Current restaurant design trends',
    'Space planning best practices',
    'Material recommendations for high-traffic areas',
    'Sustainable furniture options',
  ];

  return (
    <div className="flex flex-col">
      {/* Messages - constrained scroll area */}
      <div className="min-h-[250px] max-h-[500px] overflow-y-auto p-4 space-y-4">
        {safeMessages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Ask about design trends, benchmarks, or best practices
            </p>
            <div className="space-y-2">
              {suggestedQueries.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(suggestion)}
                  className="block w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          safeMessages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                message.role === 'user' ? 'bg-blue-100' : 'bg-indigo-100'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                )}
              </div>
              <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block px-3 py-2 rounded-xl text-sm max-w-full ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.sources.map((source, i) => (
                      <a
                        key={i}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {source.title || source.domain}
                      </a>
                    ))}
                  </div>
                )}

                {/* Save Finding Button */}
                {message.role === 'assistant' && (
                  <button
                    onClick={() => handleSaveFinding(message)}
                    className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600"
                  >
                    <Bookmark className="w-3 h-3" />
                    Save finding
                  </button>
                )}

                <p className="text-xs text-gray-400 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 space-y-2">
        {/* Web Search Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEnableWebSearch(!enableWebSearch)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
              enableWebSearch
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Web Search {enableWebSearch ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about trends, benchmarks..."
            disabled={isSending}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!query.trim() || isSending}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
