// src/subsidiaries/advisory/ai/index.ts

// Types
export * from './types/agent';

// Services
export { DomainDetector, createDomainDetector } from './services/domain-detector';
export { GeminiAgent, createGeminiAgent } from './services/gemini-agent';
export { getDomainHandler, getDomainTools, getAllTools } from './services/domain-handlers';
export { executeToolCall, registerToolHandler, getAvailableTools } from './services/tool-executor';

// Hooks
export { useAIConversation, useAIStreaming, useAISuggestions } from './hooks/useAIAgent';

// Components
export * from './components';
