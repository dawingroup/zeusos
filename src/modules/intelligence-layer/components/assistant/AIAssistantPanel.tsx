// ============================================================================
// AI ASSISTANT PANEL
// ZeusOS v2.0 - Intelligence Layer
// Floating AI assistant chat panel with persistent memory
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  X,
  Minimize2,
  Copy,
  BarChart3,
  Briefcase,
  FileText,
  MessageCircle,
  Bot,
  User,
  Loader2,
  Brain,
  Plus,
  Zap,
} from 'lucide-react';

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';
import { useAuth } from '@/shared/hooks';
import { useAIConversation } from '@/shared/hooks/useAIMemory';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';

import { MODULE_COLOR, ASSISTANT_MODES, AssistantModeId } from '../../constants';
import type { AssistantMessage } from '../../types';

interface AIAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  initialMode?: AssistantModeId;
  context?: Record<string, any>;
  companyId?: string;
  /** 'floating' = the bottom-right FAB drawer (default); 'full' = embedded
   *  full-height page surface (AIAssistantPage). (Phase 3.1) */
  variant?: 'floating' | 'full';
}

const modeIcons: Record<AssistantModeId, React.ReactNode> = {
  cross_module: <Zap className="h-4 w-4" />,
  general: <MessageCircle className="h-4 w-4" />,
  data_analyst: <BarChart3 className="h-4 w-4" />,
  strategic_advisor: <Briefcase className="h-4 w-4" />,
  document_expert: <FileText className="h-4 w-4" />,
};

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  open,
  onClose,
  onMinimize,
  initialMode = 'general',
  context,
  companyId: propCompanyId,
  variant = 'floating',
}) => {
  const { user } = useAuth();
  // Default scope is the group brain (zeus-group) — the assistant spans all
  // brands. Callers pass a brand orgId to scope memory/queries to one brand.
  const companyId = propCompanyId || 'zeus-group';
  const userId = user?.uid || '';

  const [mode, setMode] = useState<AssistantModeId>(initialMode);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Firestore conversation persistence
  const {
    conversation: _conversation,
    messages: persistedMessages,
    isLoading: isLoadingConversation,
    addMessage: persistMessage,
    startNew: startNewConversation,
    conversationId: firestoreConvId,
  } = useAIConversation({
    module: 'assistant',
    companyId,
    userId,
    mode,
    title: `AI Assistant - ${mode}`,
    autoLoad: !!userId && open,
  });

  // Sync Firestore conversation ID
  useEffect(() => {
    if (firestoreConvId) {
      setConversationId(firestoreConvId);
    }
  }, [firestoreConvId]);

  // Load persisted messages when conversation loads
  useEffect(() => {
    if (persistedMessages.length > 0 && !isLoadingConversation) {
      setMessages(persistedMessages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      })));
    }
  }, [persistedMessages, isLoadingConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message on first open when no persisted messages
  useEffect(() => {
    if (open && messages.length === 0 && !isLoadingConversation) {
      const modeConfig = ASSISTANT_MODES.find(m => m.id === mode);
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hello! I'm your ${modeConfig?.label}. ${modeConfig?.description}. How can I help you today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, mode, messages.length, isLoadingConversation]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const messageText = input.trim();
    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Persist user message to Firestore (non-blocking)
    persistMessage({ role: 'user', content: messageText }).catch(() => {});

    try {
      const conversationHistory = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let responseText = '';
      let newConversationId: string | undefined;
      let newMemoryCount: number | undefined;

      if (mode === 'cross_module') {
        // Route to Claude-powered cross-module intelligence
        const crossModuleFn = httpsCallable<
          {
            message: string;
            companyId: string;
            conversationId?: string;
            currentModule?: string;
            conversationHistory: Array<{ role: string; content: string }>;
          },
          {
            response: string;
            conversationId?: string;
            memoryCount?: number;
            toolsUsed?: string[];
            toolCallCount?: number;
          }
        >(functions, 'crossModuleIntelligence');

        const result = await crossModuleFn({
          message: messageText,
          companyId,
          conversationId: conversationId || undefined,
          currentModule: context?.currentModule,
          conversationHistory,
        });

        responseText = result.data.response;
        newConversationId = result.data.conversationId;
        newMemoryCount = result.data.memoryCount;
      } else {
        // Route to Gemini-powered assistant chat
        const chatFn = httpsCallable<
          {
            message: string;
            mode: string;
            companyId: string;
            conversationId?: string;
            context?: Record<string, any>;
            conversationHistory: Array<{ role: string; content: string }>;
          },
          { response: string; conversationId?: string; memoryCount?: number }
        >(functions, 'assistantChat');

        const result = await chatFn({
          message: messageText,
          mode,
          companyId,
          conversationId: conversationId || undefined,
          context: context || undefined,
          conversationHistory,
        });

        responseText = result.data.response;
        newConversationId = result.data.conversationId;
        newMemoryCount = result.data.memoryCount;
      }

      // Track server-side conversation ID
      if (newConversationId) {
        setConversationId(newConversationId);
      }
      if (newMemoryCount !== undefined) {
        setMemoryCount(newMemoryCount);
      }

      const aiMessage: AssistantMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Persist AI response to Firestore (non-blocking)
      persistMessage({ role: 'assistant', content: responseText }).catch(() => {});
    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorMessage: AssistantMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }, [input, mode, companyId, conversationId, context, messages, persistMessage]);

  const handleModeChange = (newMode: AssistantModeId) => {
    setMode(newMode);
    const modeConfig = ASSISTANT_MODES.find(m => m.id === newMode);
    // Append a divider message instead of clearing conversation history
    setMessages((prev) => [
      ...prev,
      {
        id: `mode-change-${Date.now()}`,
        role: 'assistant',
        content: `--- Switched to ${modeConfig?.label} mode. ${modeConfig?.description}. ---`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleNewConversation = useCallback(async () => {
    await startNewConversation();
    setMessages([]);
    setConversationId(null);
    setMemoryCount(0);
    const modeConfig = ASSISTANT_MODES.find(m => m.id === mode);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Starting a new conversation. Hello! I'm your ${modeConfig?.label}. How can I help you today?`,
        timestamp: new Date(),
      },
    ]);
  }, [startNewConversation, mode]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  if (!open) return null;

  const currentModeConfig = ASSISTANT_MODES.find(m => m.id === mode);

  return (
    <div
      className={
        variant === 'full'
          ? 'flex flex-col w-full h-[calc(100vh-8rem)] rounded-xl overflow-hidden bg-background border'
          : 'fixed bottom-6 right-6 w-96 max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-100px)] flex flex-col rounded-xl shadow-2xl overflow-hidden z-50 bg-background border'
      }
    >
      {/* Header */}
      <div
        className="p-4 flex items-center gap-3 text-white"
        style={{ backgroundColor: MODULE_COLOR }}
      >
        <div className="h-10 w-10 rounded-full bg-card/20 flex items-center justify-center">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">AI Assistant</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Badge
                variant="secondary"
                className="cursor-pointer bg-card/20 hover:bg-card/30 text-white border-0"
              >
                {currentModeConfig?.label}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ASSISTANT_MODES.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className={mode === m.id ? 'bg-muted' : ''}
                >
                  <span className="mr-2">{modeIcons[m.id]}</span>
                  <div>
                    <p className="font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {memoryCount > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="bg-card/20 text-white border-0 gap-1 cursor-default">
                  <Brain className="h-3 w-3" />
                  {memoryCount}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{memoryCount} business memories active</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-card/20" onClick={handleNewConversation}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Conversation</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {onMinimize && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-card/20" onClick={onMinimize}>
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Minimize</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {variant !== 'full' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-card/20" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-muted/30">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  message.role === 'user' ? 'bg-muted' : ''
                }`}
                style={message.role === 'assistant' ? { backgroundColor: MODULE_COLOR } : {}}
              >
                {message.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </div>

              <div
                className={`max-w-[80%] p-3 rounded-xl shadow-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {message.actions && message.actions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {message.actions.map((action, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        style={{ borderColor: MODULE_COLOR, color: MODULE_COLOR }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {message.role === 'assistant' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-50 hover:opacity-100"
                            onClick={() => copyMessage(message.content)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: MODULE_COLOR }}
              >
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-background p-3 rounded-xl shadow-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: MODULE_COLOR }} />
                <span className="text-sm text-muted-foreground">
                  {mode === 'cross_module' ? 'Querying across modules...' : 'Thinking...'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            style={{ backgroundColor: MODULE_COLOR }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPanel;
