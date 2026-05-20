/**
 * Gemini AI Client Utilities
 * 
 * IMPORTANT: This module enhances the existing @google/generative-ai setup.
 * We intentionally keep using this package instead of switching to @google-cloud/vertexai
 * to maintain compatibility with existing working functions.
 * 
 * Previous challenges:
 * - Vertex AI requires different authentication (service account vs API key)
 * - Switching packages broke streaming functionality
 * - API key approach is simpler and already working
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Singleton instance
let genAIInstance = null;

/**
 * Get or create GoogleGenerativeAI instance
 * @param {string} apiKey - Gemini API key from Firebase secrets
 * @returns {GoogleGenerativeAI}
 */
function getGenAI(apiKey) {
  if (!genAIInstance && apiKey) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

/**
 * Model configuration presets
 */
const MODEL_CONFIGS = {
  // Fast responses, lower cost - for chat and simple tasks
  flash: {
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  },
  // Balanced for most tasks
  standard: {
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.5,
    },
  },
  // Complex reasoning, strategy research
  pro: {
    model: 'gemini-2.0-flash', // Note: Using flash as pro may not be available
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.4,
    },
  },
  // JSON extraction, structured output
  structured: {
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
    },
  },
  // Image analysis
  vision: {
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.4,
    },
  },
};

/**
 * Get a Gemini model with preset configuration
 * @param {string} apiKey - Gemini API key
 * @param {'flash' | 'standard' | 'pro' | 'structured' | 'vision'} preset - Model preset
 * @param {object} overrides - Optional config overrides
 * @returns {GenerativeModel}
 */
function getModel(apiKey, preset = 'flash', overrides = {}) {
  const genAI = getGenAI(apiKey);
  if (!genAI) {
    throw new Error('Gemini API key not provided');
  }

  const config = MODEL_CONFIGS[preset] || MODEL_CONFIGS.flash;
  
  return genAI.getGenerativeModel({
    model: overrides.model || config.model,
    generationConfig: {
      ...config.generationConfig,
      ...overrides.generationConfig,
    },
  });
}

/**
 * Select model complexity based on task
 * @param {'simple' | 'moderate' | 'complex'} complexity
 * @returns {'flash' | 'standard' | 'pro'}
 */
function selectModelByComplexity(complexity) {
  switch (complexity) {
    case 'simple':
      return 'flash';
    case 'moderate':
      return 'standard';
    case 'complex':
      return 'pro';
    default:
      return 'flash';
  }
}

/**
 * Parse JSON from Gemini response (handles markdown code blocks)
 * @param {string} text - Raw response text
 * @returns {object|array} Parsed JSON
 * @throws {Error} If parsing fails
 */
function parseJsonResponse(text) {
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
        // Fall through to error
      }
    }
    
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (e) {
        // Fall through to error
      }
    }
    
    throw new Error(`Failed to parse JSON from response: ${error.message}`);
  }
}

/**
 * Generate content with automatic retry on transient failures
 * @param {GenerativeModel} model - Gemini model instance
 * @param {string|array} prompt - Prompt text or parts array
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<string>} Response text
 */
async function generateWithRetry(model, prompt, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      lastError = error;
      
      // Don't retry on auth errors or invalid requests
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

/**
 * Stream content with error handling
 * @param {GenerativeModel} model - Gemini model instance
 * @param {string|array} prompt - Prompt text or parts array
 * @returns {AsyncGenerator<string>} Stream of text chunks
 */
async function* streamContent(model, prompt) {
  const result = await model.generateContentStream(prompt);
  
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

module.exports = {
  getGenAI,
  getModel,
  selectModelByComplexity,
  parseJsonResponse,
  generateWithRetry,
  streamContent,
  MODEL_CONFIGS,
};
