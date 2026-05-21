// ============================================================================
// AI STRATEGY ASSISTANT COMPONENT
// ZeusOS v2.0 - CEO Strategy Command
// Claude-powered chat panel for strategy analysis and recommendations
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  Lightbulb,
  X,
} from 'lucide-react';
import type { AIMessage, AISuggestion } from '../../types/strategy.types';
import { sendStrategyChatMessage } from '../../services/strategyAI.service';
import type { StrategyReviewData } from '../../types/strategy.types';
import {
  REVIEW_SECTION_LABELS,
  type ReviewSectionKey,
} from '../../constants/strategyReview.constants';

export interface AIStrategyAssistantProps {
  reviewData: Partial<StrategyReviewData>;
  companyId: string;
  activeSection: ReviewSectionKey;
  conversationHistory: AIMessage[];
  onConversationUpdate: (messages: AIMessage[]) => void;
  onApplySuggestion?: (suggestion: AISuggestion) => void;
  isOpen: boolean;
  onToggle: () => void;
  selectedDocumentSectionId?: string;
  onAssessDocumentSection?: (sectionId: string) => void;
  onRewriteDocumentSection?: (sectionId: string) => void;
  isAssessingSection?: boolean;
}

export const AIStrategyAssistant: React.FC<AIStrategyAssistantProps> = ({
  reviewData,
  companyId,
  activeSection,
  conversationHistory,
  onConversationUpdate,
  onApplySuggestion,
  isOpen,
  onToggle,
  selectedDocumentSectionId,
  onAssessDocumentSection,
  onRewriteDocumentSection,
  isAssessingSection,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      section: activeSection,
    };

    const updatedHistory = [...conversationHistory, userMessage];
    onConversationUpdate(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendStrategyChatMessage(
        text,
        activeSection,
        reviewData,
        companyId,
        updatedHistory
      );

      if (response.conversationMessage) {
        onConversationUpdate([...updatedHistory, response.conversationMessage]);
      }
    } catch (error) {
      const errorMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I encountered an error. ${error instanceof Error ? error.message : 'Please try again.'}`,
        timestamp: new Date().toISOString(),
        section: activeSection,
      };
      onConversationUpdate([...updatedHistory, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeSection, conversationHistory, reviewData, companyId, onConversationUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleSuggestion = (id: string) => {
    setExpandedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const quickPrompts = [
    { label: 'Analyze this section', prompt: `Analyze the ${REVIEW_SECTION_LABELS[activeSection]} section and provide detailed recommendations.` },
    { label: 'Identify gaps', prompt: `What are the key gaps or missing elements in the ${REVIEW_SECTION_LABELS[activeSection]} section?` },
    { label: 'Suggest improvements', prompt: `Suggest specific improvements for ${REVIEW_SECTION_LABELS[activeSection]} with actionable steps.` },
    { label: 'Generate OKRs', prompt: 'Generate strategic OKRs based on the current review data across all sections.' },
  ];

  // Collapsed state - just show toggle button
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all z-50"
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-medium text-sm">AI Strategy Assistant</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-full md:w-[420px] h-[600px] bg-white border-l border-t border-gray-200 shadow-2xl rounded-tl-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-tl-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <div>
            <h3 className="font-semibold text-sm">AI Strategy Assistant</h3>
            <p className="text-xs text-purple-200">Powered by Claude</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {REVIEW_SECTION_LABELS[activeSection]}
          </span>
          <button onClick={onToggle} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {conversationHistory.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 mx-auto text-purple-300 mb-3" />
            <p className="text-sm text-gray-600 mb-1">
              I'm your AI Strategy Consultant
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Ask me to analyze sections, suggest improvements, or generate OKRs & KPIs.
            </p>
            {/* Quick Prompts */}
            <div className="space-y-2">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(qp.prompt);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-2 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                >
                  <Lightbulb className="w-3 h-3 inline mr-1.5" />
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {conversationHistory.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-purple-600" />
              </div>
            )}
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div
                className={`px-3 py-2 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
              </div>

              {/* Suggestions */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {msg.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="border border-purple-200 rounded-lg bg-purple-50 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSuggestion(suggestion.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-purple-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-3.5 h-3.5 text-purple-600" />
                          <span className="text-xs font-medium text-purple-900">{suggestion.title}</span>
                          <span className="text-xs text-purple-500 bg-purple-200 px-1.5 py-0.5 rounded">
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                        {expandedSuggestions.has(suggestion.id) ? (
                          <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                        )}
                      </button>

                      {expandedSuggestions.has(suggestion.id) && (
                        <div className="px-3 pb-2 border-t border-purple-200">
                          <p className="text-xs text-purple-800 mt-2 whitespace-pre-wrap">{suggestion.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {onApplySuggestion && !suggestion.applied && (
                              <button
                                onClick={() => onApplySuggestion(suggestion)}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Apply
                              </button>
                            )}
                            {suggestion.applied && (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="w-3 h-3" />
                                Applied
                              </span>
                            )}
                            <button
                              onClick={() => copyToClipboard(suggestion.content)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-gray-400 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Analyzing...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Document Section Actions */}
      {selectedDocumentSectionId && (onAssessDocumentSection || onRewriteDocumentSection) && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-200 bg-purple-50">
          <span className="text-xs text-purple-700 font-medium">Section Actions:</span>
          {onAssessDocumentSection && (
            <button
              onClick={() => onAssessDocumentSection(selectedDocumentSectionId)}
              disabled={isAssessingSection}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
            >
              {isAssessingSection ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
              Assess
            </button>
          )}
          {onRewriteDocumentSection && (
            <button
              onClick={() => onRewriteDocumentSection(selectedDocumentSectionId)}
              disabled={isAssessingSection}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" /> Rewrite
            </button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your strategy..."
            rows={1}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 max-h-24"
            style={{ minHeight: '38px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-center">
          Powered by Claude — AI suggestions should be reviewed by leadership
        </p>
      </div>
    </div>
  );
};

export default AIStrategyAssistant;
