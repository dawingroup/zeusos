/**
 * Claude AI Client Utilities
 *
 * Reusable wrapper for @anthropic-ai/sdk, matching the existing getAnthropicClient()
 * pattern in index.js. Creates fresh clients per call to ensure Firebase secrets
 * are loaded correctly across function instances.
 */

const AnthropicModule = require('@anthropic-ai/sdk');

/**
 * Create a fresh Anthropic client (matches index.js getAnthropicClient pattern)
 * @param {string} apiKey - Anthropic API key from Firebase secrets
 * @returns {Anthropic}
 */
function getClient(apiKey) {
  if (!apiKey) {
    throw new Error('Anthropic API key not provided');
  }
  const Anthropic = AnthropicModule.default || AnthropicModule;
  return new Anthropic({ apiKey });
}

/**
 * Model configuration presets
 */
const MODEL_CONFIGS = {
  // Fast responses, lower cost
  fast: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.3,
  },
  // Balanced for most tasks
  standard: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    temperature: 0.4,
  },
  // Complex analysis, longer output
  detailed: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    temperature: 0.3,
  },
};

/**
 * Create a Claude message with a preset configuration
 * @param {string} apiKey - Anthropic API key
 * @param {'fast' | 'standard' | 'detailed'} preset - Model preset
 * @param {string} systemPrompt - System prompt
 * @param {string} userMessage - User message content
 * @param {object} overrides - Optional config overrides
 * @returns {Promise<string>} Response text
 */
async function createMessage(apiKey, preset, systemPrompt, userMessage, overrides = {}) {
  const client = getClient(apiKey);
  const config = MODEL_CONFIGS[preset] || MODEL_CONFIGS.fast;

  const message = await client.messages.create({
    model: overrides.model || config.model,
    max_tokens: overrides.max_tokens || config.max_tokens,
    temperature: overrides.temperature ?? config.temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  }, { timeout: 120000 });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  return responseText;
}

/**
 * Parse JSON from Claude response (handles markdown code blocks)
 * @param {string} text - Raw response text
 * @returns {object|array} Parsed JSON
 * @throws {Error} If parsing fails
 */
function parseJsonFromResponse(text) {
  let jsonStr = text.trim();

  // Try to extract from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    // Try to find JSON object or array in the text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    const arrayMatch = text.match(/\[[\s\S]*\]/);

    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e) {
        // Fall through
      }
    }

    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (e) {
        // Fall through
      }
    }

    throw new Error(`Failed to parse JSON from Claude response: ${error.message}`);
  }
}

/**
 * Create message with automatic retry on transient failures
 * @param {string} apiKey - Anthropic API key
 * @param {'fast' | 'standard' | 'detailed'} preset - Model preset
 * @param {string} systemPrompt - System prompt
 * @param {string} userMessage - User message content
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<string>} Response text
 */
async function createMessageWithRetry(apiKey, preset, systemPrompt, userMessage, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await createMessage(apiKey, preset, systemPrompt, userMessage);
    } catch (error) {
      lastError = error;

      // Don't retry on auth or bad request errors
      if (error.status === 401 || error.status === 400) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// TOOL USE SUPPORT
// ============================================================================

const MAX_TOOL_ROUNDS = 5;

/**
 * Run a multi-turn Claude conversation with tool use.
 * Orchestrates the loop: send message → handle tool_use blocks → feed results → repeat.
 *
 * @param {string} apiKey - Anthropic API key
 * @param {object} options
 * @param {string} options.systemPrompt - System prompt
 * @param {Array} options.tools - Tool definitions for Claude
 * @param {Array} options.messages - Conversation messages
 * @param {Function} options.executeToolCalls - (toolUseBlocks) => Promise<toolResults>
 * @param {string} options.preset - Model preset (default: 'standard')
 * @param {Function} options.onToolUse - Optional callback for each tool round: (round, toolNames) => void
 * @returns {Promise<{text: string, usage: {inputTokens: number, outputTokens: number}, toolCallCount: number}>}
 */
async function createMessageWithTools(apiKey, options) {
  const {
    systemPrompt,
    tools,
    messages,
    executeToolCalls,
    preset = 'standard',
    onToolUse,
  } = options;

  const client = getClient(apiKey);
  const config = MODEL_CONFIGS[preset] || MODEL_CONFIGS.standard;

  let currentMessages = [...messages];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let toolCallCount = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools,
      messages: currentMessages,
    });

    // Track token usage
    if (response.usage) {
      totalInputTokens += response.usage.input_tokens || 0;
      totalOutputTokens += response.usage.output_tokens || 0;
    }

    // Check if we're done (no more tool calls)
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      return {
        text: textBlock ? textBlock.text : '',
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        toolCallCount,
      };
    }

    // Extract tool_use blocks
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      // No tool calls and not end_turn — extract any text and return
      const textBlock = response.content.find(b => b.type === 'text');
      return {
        text: textBlock ? textBlock.text : '',
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        toolCallCount,
      };
    }

    // Notify about tool use
    if (onToolUse) {
      onToolUse(round, toolUseBlocks.map(b => b.name));
    }

    toolCallCount += toolUseBlocks.length;

    // Execute tool calls
    const toolResults = await executeToolCalls(toolUseBlocks);

    // Append assistant response and tool results to conversation
    currentMessages.push({ role: 'assistant', content: response.content });
    currentMessages.push({ role: 'user', content: toolResults });
  }

  // Max rounds reached — return whatever we have
  return {
    text: 'I was unable to complete the analysis within the allowed number of tool calls. Please try a more specific question.',
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    toolCallCount,
  };
}

module.exports = {
  getClient,
  createMessage,
  createMessageWithRetry,
  createMessageWithTools,
  parseJsonFromResponse,
  MODEL_CONFIGS,
  MAX_TOOL_ROUNDS,
};
