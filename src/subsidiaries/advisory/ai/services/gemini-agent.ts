// src/subsidiaries/advisory/ai/services/gemini-agent.ts

import type {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
  Part,
  FunctionCall,
  FunctionDeclarationsTool,
} from '@google/generative-ai';
import {
  AgentDomain,
  AgentAction,
  DomainContext,
  GeminiModel,
  AgentConfig,
  TokenUsage,
} from '../types/agent';
import { DomainDetector } from './domain-detector';
import { getDomainHandler, getDomainTools } from './domain-handlers';
import { executeToolCall } from './tool-executor';

const BASE_SYSTEM_PROMPT = `You are Dawin AI, an intelligent assistant for the Dawin Advisory Platform.
You help users manage infrastructure projects, investments, advisory services, and material procurement.

Your capabilities include:
1. **Infrastructure Projects**: Track construction projects, manage milestones, process payment certificates, and generate reports for Uganda healthcare facilities.
2. **Investment Management**: Monitor portfolio performance, analyze returns, track holdings, and provide investment insights.
3. **Advisory Services**: Manage deals, client relationships, proposals, and transaction support for M&A and capital raising.
4. **Material Flow (MatFlow)**: Handle procurement, requisitions, purchase orders, supplier management, and budget tracking for construction materials.

Response Guidelines:
- Be concise but comprehensive
- Use specific numbers, dates, and entity references when available
- Suggest relevant actions the user can take
- Ask clarifying questions if the request is ambiguous
- Reference entities by their name or ID when discussing them
- Format currency amounts in UGX by default unless specified
- Use tables for comparing multiple items
- Provide actionable insights, not just data

Current Context:
- Domain: {{domain}}
- Entities in context: {{entities}}
- Current module: {{module}}
- User timezone: {{timezone}}
`;

export class GeminiAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string;
  private config: AgentConfig;
  private domainDetector: DomainDetector;
  private conversationHistory: Map<string, Content[]>;

  constructor(
    apiKey: string,
    config: AgentConfig,
    domainDetector: DomainDetector
  ) {
    this.apiKey = apiKey;
    this.config = config;
    this.domainDetector = domainDetector;
    this.conversationHistory = new Map();
  }

  private async getGenAI(): Promise<GoogleGenerativeAI> {
    if (!this.genAI) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    return this.genAI;
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(
    conversationId: string,
    userMessage: string,
    _previousDomain?: AgentDomain
  ): Promise<{
    response: string;
    domain: DomainContext;
    actions: AgentAction[];
    tokenUsage: TokenUsage;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();

    // Detect domain and extract entities
    const domainContext = this.domainDetector.detectDomain(userMessage);

    // Get domain-specific configuration
    const domainHandler = getDomainHandler(domainContext.domain);
    const tools = getDomainTools(domainContext.domain);

    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(domainContext, domainHandler);

    // Get or create conversation history
    let history = this.conversationHistory.get(conversationId) || [];
    
    // Initialize with system prompt if new conversation
    if (history.length === 0) {
      history = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I\'m ready to help with the Dawin Advisory Platform.' }] },
      ];
    }

    // Select model based on domain complexity
    const model = await this.getModel(domainContext.domain);

    // Generate response with function calling
    const { response, functionCalls, tokenUsage } = await this.generateResponse(
      model,
      history,
      userMessage,
      tools
    );

    // Process function calls into actions
    const actions = this.processFunctionCalls(functionCalls);

    // Update conversation history
    this.updateHistory(conversationId, history, userMessage, response, functionCalls);

    const processingTimeMs = Date.now() - startTime;

    return {
      response,
      domain: domainContext,
      actions,
      tokenUsage,
      processingTimeMs,
    };
  }

  /**
   * Build system prompt with domain context
   */
  private buildSystemPrompt(
    domainContext: DomainContext,
    domainHandler: ReturnType<typeof getDomainHandler>
  ): string {
    const entityNames = domainContext.detectedEntities
      .map((e) => `${e.type}: ${e.value}`)
      .join(', ') || 'None detected';

    let prompt = BASE_SYSTEM_PROMPT
      .replace('{{domain}}', domainContext.domain)
      .replace('{{entities}}', entityNames)
      .replace('{{module}}', domainContext.sessionContext.currentModule || 'Not specified')
      .replace('{{timezone}}', domainContext.sessionContext.preferences?.timezone || 'Africa/Kampala');

    // Add domain-specific prompt
    if (domainHandler) {
      prompt += `\n\n**Domain-Specific Instructions (${domainHandler.name}):**\n${domainHandler.systemPrompt}`;
    }

    return prompt;
  }

  /**
   * Get appropriate model based on domain
   */
  private async getModel(domain: AgentDomain): Promise<GenerativeModel> {
    // Use Pro for complex domains, Flash for simple queries
    const modelName: GeminiModel =
      domain === 'analytics' || domain === 'advisory' || domain === 'investment'
        ? 'gemini-2.5-pro'
        : 'gemini-2.5-flash';

    const genAI = await this.getGenAI();
    return genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      },
    });
  }

  /**
   * Generate response with function calling
   */
  private async generateResponse(
    model: GenerativeModel,
    history: Content[],
    userMessage: string,
    tools: FunctionDeclarationsTool[]
  ): Promise<{
    response: string;
    functionCalls: FunctionCall[];
    tokenUsage: TokenUsage;
  }> {
    const chat = model.startChat({
      history,
      tools: tools.length > 0 ? tools : undefined,
    });

    // Send user message
    const result = await chat.sendMessage(userMessage);
    const response = result.response;

    // Extract function calls
    const functionCalls: FunctionCall[] = [];
    let textResponse = '';

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if ('functionCall' in part && part.functionCall) {
          functionCalls.push(part.functionCall);
        }
        if ('text' in part && part.text) {
          textResponse += part.text;
        }
      }
    }

    // If there were function calls, execute them and get final response
    if (functionCalls.length > 0) {
      const functionResults = await this.executeFunctionCalls(functionCalls);
      
      // Send function results back to model
      const functionResponseParts: any = functionResults.map((result, index) => ({
        functionResponse: {
          name: functionCalls[index].name,
          response: result,
        },
      }));

      const finalResult = await chat.sendMessage(functionResponseParts);
      textResponse = finalResult.response.text();
    }

    // Get token usage
    const usageMetadata = response.usageMetadata;
    const tokenUsage: TokenUsage = {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      completionTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0,
    };

    return {
      response: textResponse,
      functionCalls,
      tokenUsage,
    };
  }

  /**
   * Execute function calls
   */
  private async executeFunctionCalls(
    functionCalls: FunctionCall[]
  ): Promise<unknown[]> {
    const results: unknown[] = [];

    for (const call of functionCalls) {
      try {
        const result = await executeToolCall(call.name, call.args as Record<string, unknown>);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return results;
  }

  /**
   * Process function calls into AgentActions
   */
  private processFunctionCalls(functionCalls: FunctionCall[]): AgentAction[] {
    return functionCalls.map((call, index) => ({
      id: `action-${Date.now()}-${index}`,
      type: this.mapFunctionToActionType(call.name),
      label: this.humanizeActionName(call.name),
      params: call.args as Record<string, unknown>,
      status: 'executed' as const,
    }));
  }

  /**
   * Map function name to action type
   */
  private mapFunctionToActionType(functionName: string): AgentAction['type'] {
    const mapping: Record<string, AgentAction['type']> = {
      navigateToModule: 'navigate',
      searchPlatform: 'search',
      getProjectStatus: 'open_entity',
      createRequisition: 'create_requisition',
      generateIPC: 'generate_report',
      generateReport: 'generate_report',
      analyzeReturns: 'analyze_data',
      compareEntities: 'compare_entities',
    };
    return mapping[functionName] || 'custom';
  }

  /**
   * Humanize function name for display
   */
  private humanizeActionName(functionName: string): string {
    return functionName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Update conversation history
   */
  private updateHistory(
    conversationId: string,
    history: Content[],
    userMessage: string,
    assistantResponse: string,
    functionCalls: FunctionCall[]
  ): void {
    // Add user message
    history.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Add assistant response with any function calls
    const assistantParts: Part[] = [];
    
    if (functionCalls.length > 0) {
      for (const call of functionCalls) {
        assistantParts.push({ functionCall: call });
      }
    }
    
    assistantParts.push({ text: assistantResponse });

    history.push({
      role: 'model',
      parts: assistantParts,
    });

    // Keep only last 20 exchanges (40 messages)
    if (history.length > 42) {
      history.splice(2, history.length - 42);
    }

    this.conversationHistory.set(conversationId, history);
  }

  /**
   * Stream response for real-time display
   */
  async *streamMessage(
    conversationId: string,
    userMessage: string
  ): AsyncGenerator<string, void, unknown> {
    const domainContext = this.domainDetector.detectDomain(userMessage);
    const domainHandler = getDomainHandler(domainContext.domain);
    const tools = getDomainTools(domainContext.domain);
    const systemPrompt = this.buildSystemPrompt(domainContext, domainHandler);
    
    let history = this.conversationHistory.get(conversationId) || [];
    
    if (history.length === 0) {
      history = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I\'m ready to help.' }] },
      ];
    }

    const model = await this.getModel(domainContext.domain);
    const chat = model.startChat({
      history,
      tools: tools.length > 0 ? tools : undefined,
    });

    const result = await chat.sendMessageStream(userMessage);

    let fullResponse = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullResponse += text;
      yield text;
    }

    // Update history after streaming completes
    this.updateHistory(conversationId, history, userMessage, fullResponse, []);
  }

  /**
   * Clear conversation history
   */
  clearHistory(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
  }
}

export function createGeminiAgent(
  apiKey: string,
  config: AgentConfig,
  domainDetector: DomainDetector
): GeminiAgent {
  return new GeminiAgent(apiKey, config, domainDetector);
}
