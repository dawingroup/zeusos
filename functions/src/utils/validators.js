/**
 * Input Validators for AI Functions
 * 
 * Validates and sanitizes input data before processing.
 * Returns clean data or throws descriptive errors.
 */

/**
 * Validate chat message input
 * @param {object} data - Request data
 * @returns {{message: string, conversationHistory: array, projectId: string|null}}
 * @throws {Error} If validation fails
 */
function validateChatInput(data) {
  if (!data) {
    throw createValidationError('Request data is required');
  }

  const { message, conversationHistory, projectId } = data;

  if (!message || typeof message !== 'string') {
    throw createValidationError('Message is required and must be a string');
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    throw createValidationError('Message cannot be empty');
  }

  if (trimmedMessage.length > 10000) {
    throw createValidationError('Message exceeds maximum length of 10000 characters');
  }

  // Validate conversation history if provided
  let validHistory = [];
  if (conversationHistory) {
    if (!Array.isArray(conversationHistory)) {
      throw createValidationError('Conversation history must be an array');
    }

    validHistory = conversationHistory
      .filter(msg => msg && typeof msg === 'object')
      .map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: Array.isArray(msg.parts) 
          ? msg.parts.filter(p => p && typeof p.text === 'string')
          : [{ text: String(msg.content || msg.text || '') }],
      }))
      .slice(-20); // Keep only last 20 messages for context
  }

  return {
    message: trimmedMessage,
    conversationHistory: validHistory,
    projectId: projectId && typeof projectId === 'string' ? projectId : null,
  };
}

/**
 * Validate image analysis input
 * @param {object} data - Request data
 * @returns {{imageData: string, mimeType: string, prompt: string|null}}
 * @throws {Error} If validation fails
 */
function validateImageInput(data) {
  if (!data) {
    throw createValidationError('Request data is required');
  }

  const { imageData, mimeType, prompt } = data;

  if (!imageData || typeof imageData !== 'string') {
    throw createValidationError('Image data is required');
  }

  // Check if it's a valid base64 string (basic check)
  if (imageData.length < 100) {
    throw createValidationError('Image data appears to be too short');
  }

  // Validate mime type
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const normalizedMimeType = mimeType && validMimeTypes.includes(mimeType) 
    ? mimeType 
    : 'image/jpeg';

  return {
    imageData,
    mimeType: normalizedMimeType,
    prompt: prompt && typeof prompt === 'string' ? prompt.trim().slice(0, 2000) : null,
  };
}

/**
 * Validate asset data input
 * @param {object} data - Request data
 * @returns {{asset: object}}
 * @throws {Error} If validation fails
 */
function validateAssetInput(data) {
  if (!data) {
    throw createValidationError('Request data is required');
  }

  const { asset } = data;

  if (!asset || typeof asset !== 'object') {
    throw createValidationError('Asset object is required');
  }

  if (!asset.brand || typeof asset.brand !== 'string') {
    throw createValidationError('Asset brand is required');
  }

  if (!asset.model || typeof asset.model !== 'string') {
    throw createValidationError('Asset model is required');
  }

  return {
    asset: {
      id: asset.id || null,
      brand: asset.brand.trim(),
      model: asset.model.trim(),
      category: asset.category || 'Unknown',
      nickname: asset.nickname || null,
      specs: asset.specs && typeof asset.specs === 'object' ? asset.specs : {},
      location: asset.location && typeof asset.location === 'object' ? asset.location : {},
    },
  };
}

/**
 * Validate strategy research input
 * @param {object} data - Request data
 * @returns {{query: string, context: object}}
 * @throws {Error} If validation fails
 */
function validateStrategyInput(data) {
  if (!data) {
    throw createValidationError('Request data is required');
  }

  const { query, context } = data;

  if (!query || typeof query !== 'string') {
    throw createValidationError('Query is required');
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 10) {
    throw createValidationError('Query must be at least 10 characters');
  }

  if (trimmedQuery.length > 5000) {
    throw createValidationError('Query exceeds maximum length of 5000 characters');
  }

  return {
    query: trimmedQuery,
    context: context && typeof context === 'object' ? context : {},
  };
}

/**
 * Validate cutlist analysis input
 * @param {object} data - Request data
 * @returns {{projectId: string, parts: array, options: object}}
 * @throws {Error} If validation fails
 */
function validateCutlistInput(data) {
  if (!data) {
    throw createValidationError('Request data is required');
  }

  const { projectId, parts, options } = data;

  if (!projectId || typeof projectId !== 'string') {
    throw createValidationError('Project ID is required');
  }

  if (!parts || !Array.isArray(parts)) {
    throw createValidationError('Parts array is required');
  }

  if (parts.length === 0) {
    throw createValidationError('Parts array cannot be empty');
  }

  // Validate each part has required fields
  const validParts = parts.map((part, index) => {
    if (!part.length || !part.width) {
      throw createValidationError(`Part at index ${index} must have length and width`);
    }
    return {
      id: part.id || `part-${index}`,
      name: part.name || `Part ${index + 1}`,
      length: Number(part.length),
      width: Number(part.width),
      thickness: Number(part.thickness) || 18,
      quantity: Number(part.quantity) || 1,
      material: part.material || 'default',
      grainDirection: part.grainDirection || 'none',
    };
  });

  return {
    projectId,
    parts: validParts,
    options: options && typeof options === 'object' ? options : {},
  };
}

/**
 * Create a validation error with proper code
 * @param {string} message - Error message
 * @returns {Error}
 */
function createValidationError(message) {
  const error = new Error(message);
  error.code = 'invalid-argument';
  return error;
}

/**
 * Sanitize string for safe inclusion in prompts
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
function sanitizePromptText(text, maxLength = 5000) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
}

module.exports = {
  validateChatInput,
  validateImageInput,
  validateAssetInput,
  validateStrategyInput,
  validateCutlistInput,
  createValidationError,
  sanitizePromptText,
};
