/**
 * Enhanced Design Chat Cloud Function
 *
 * Provides conversational AI assistance for furniture/millwork design.
 * Features:
 * - Structured request/response interfaces
 * - Enhanced image analysis
 * - Feature Library integration
 * - Clip library context (assess items from clipper)
 * - Structured parameter extraction for write-back
 * - Conversation persistence to designItemConversations collection
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

// Initialize if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Import utilities
const { getCacheManager } = require('../utils/cacheManager');
const { checkRateLimit } = require('../utils/rateLimiter');

// ============================================
// Type Definitions (for documentation)
// ============================================

/**
 * @typedef {Object} DesignChatRequest
 * @property {string} deliverableId - ID of the deliverable/design item
 * @property {string} [projectId] - Optional project ID for context
 * @property {string} message - User's message
 * @property {string} [imageBase64] - Base64 encoded image (without data URI prefix)
 * @property {'image/jpeg'|'image/png'|'image/webp'} [imageMimeType] - Image MIME type
 * @property {Array<{role: string, content: string}>} [conversationHistory] - Previous messages
 * @property {Object} [clipContext] - Attached clip context from clipper library
 */

/**
 * @typedef {Object} DesignChatResponse
 * @property {string} message - AI response text
 * @property {Array<FeatureSuggestion>} [suggestedFeatures] - Matched features from library
 * @property {ImageAnalysisResult} [imageAnalysis] - Structured image analysis
 * @property {Object} [suggestedParameters] - Structured parameters for write-back
 * @property {number} confidence - Response confidence (0-1)
 * @property {Object} usageMetadata - Token usage info
 */

/**
 * @typedef {Object} FeatureSuggestion
 * @property {string} featureId - ID from Feature Library
 * @property {string} featureName - Feature name
 * @property {'high'|'medium'|'low'} relevance - Relevance to query
 * @property {string} reason - Why this feature is suggested
 */

/**
 * @typedef {Object} ImageAnalysisResult
 * @property {string} style - Style classification
 * @property {Array<string>} materials - Detected materials
 * @property {Array<string>} features - Manufacturing features required
 * @property {number} complexity - Complexity score (1-10)
 * @property {Array<string>} colorPalette - Detected colors
 */

// ============================================
// Prompts
// ============================================

const DESIGN_CHAT_SYSTEM_PROMPT = `You are an expert furniture and millwork design consultant for Dawin Group, a custom manufacturing company in Uganda specializing in luxury hospitality, residential, and commercial projects.

CONTEXT:
- You assist designers in developing detailed specifications for custom furniture and millwork
- You have access to the Feature Library documenting all manufacturing capabilities
- Your recommendations should be practical given the shop's equipment and skills

RESPONSE FORMAT:
Always structure your responses to be helpful and actionable. When recommending features:
- Reference specific feature IDs and names from the Feature Library
- Explain why each feature is relevant
- Note any material or equipment constraints

When the user provides an image or clip from the library, analyze it thoroughly for style, materials, and manufacturing requirements.

When you have enough context to suggest design parameters, include a SUGGESTED PARAMETERS section at the end of your response using this exact format:

**SUGGESTED PARAMETERS:**
- Description: [brief description of the item]
- Dimensions: W:[width]mm H:[height]mm D:[depth]mm
- Primary Material: [name] | [type: sheet/solid/veneer/laminate/other] | [thickness]mm
- Finish: [type: paint/stain/lacquer/oil/veneer/laminate/none] | [color] | [sheen: flat/matte/satin/semi-gloss/gloss]
- Hardware: [quantity]x [name] ([category])
- Construction: [frameless/face-frame/post-and-rail/solid-wood/mixed]
- Joinery: [dowel/biscuit/pocket-screw/mortise-tenon/dovetail/rabbet-dado/cam-lock/confirmat/glue-only]
- AWI Grade: [economy/custom/premium]
- Special Requirements: [requirement 1]; [requirement 2]
- Confidence: [0.0-1.0]
- Reasoning: [brief explanation]

Only include parameters you are confident about. Omit any you are uncertain about.`;

const IMAGE_ANALYSIS_PROMPT = `Analyze this furniture/millwork image and extract the following in a structured format:

**STYLE CLASSIFICATION:**
Identify the primary style (modern, traditional, transitional, industrial, contemporary, rustic, etc.)

**MATERIALS DETECTED:**
List visible materials with specificity:
- Wood species (oak, walnut, maple, etc.) or type (plywood, MDF, solid wood)
- Finish type (lacquer, oil, stain, paint, natural)
- Hardware materials (brass, steel, bronze, etc.)
- Other materials (glass, stone, fabric, leather)

**MANUFACTURING FEATURES REQUIRED:**
List the manufacturing operations needed:
- Joinery types (mortise & tenon, dovetail, pocket holes, etc.)
- Edge treatments (banding, profiling, waterfall edges)
- Assembly methods (face frame, frameless, modular)
- Special techniques (veneering, inlay, carving)

**COMPLEXITY SCORE:** (1-10)
Rate the manufacturing complexity considering:
- Number of operations required
- Skill level needed
- Equipment requirements
- Tolerance requirements

**COLOR PALETTE:**
Extract dominant colors as hex codes if possible.

Match all findings to our Feature Library capabilities and suggest the most relevant features.

Also include a SUGGESTED PARAMETERS section with your best estimates for dimensions, materials, finish, construction method, joinery, and AWI grade.`;

const CLIP_CONTEXT_PROMPT = `The user has attached a clip from their design library. Here is the clip's metadata:

**CLIP CONTEXT:**
Title: {title}
Type: {clipType}
{aiAnalysis}
{materials}
{dimensions}
{price}
{brand}

Please assess this clip in the context of the current design item. Analyze:
1. How the style, materials, and construction of this clip relate to the design
2. What manufacturing parameters can be derived from it
3. Whether the clip's specifications are achievable given our capabilities
4. Specific recommendations for adapting this design to our manufacturing process

Include a SUGGESTED PARAMETERS section if you have enough information.`;

// ============================================
// Helper Functions
// ============================================

/**
 * Get Gemini model instance
 */
function getGeminiModel(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  });
}

/**
 * Build clip context string from clip data
 */
function buildClipContextPrompt(clipContext) {
  if (!clipContext) return null;

  let prompt = CLIP_CONTEXT_PROMPT
    .replace('{title}', clipContext.title || 'Untitled')
    .replace('{clipType}', clipContext.clipType || 'reference');

  // AI analysis
  let aiAnalysisStr = '';
  if (clipContext.aiAnalysis) {
    const a = clipContext.aiAnalysis;
    if (a.productType) aiAnalysisStr += `Product Type: ${a.productType}\n`;
    if (a.style) aiAnalysisStr += `Style: ${a.style}\n`;
    if (a.primaryMaterials?.length) aiAnalysisStr += `AI-Detected Materials: ${a.primaryMaterials.join(', ')}\n`;
    if (a.millworkAssessment) {
      aiAnalysisStr += `Millwork Assessment: ${a.millworkAssessment.complexity} complexity`;
      if (a.millworkAssessment.isCustomCandidate) aiAnalysisStr += ' (custom candidate)';
      aiAnalysisStr += '\n';
      if (a.millworkAssessment.keyFeatures?.length) {
        aiAnalysisStr += `Key Features: ${a.millworkAssessment.keyFeatures.join(', ')}\n`;
      }
      if (a.millworkAssessment.estimatedHours) {
        aiAnalysisStr += `Estimated Hours: ${a.millworkAssessment.estimatedHours}\n`;
      }
    }
  }
  prompt = prompt.replace('{aiAnalysis}', aiAnalysisStr || 'No AI analysis available');

  // Materials
  const materialsStr = clipContext.materials?.length
    ? `Detected Materials: ${clipContext.materials.join(', ')}`
    : '';
  prompt = prompt.replace('{materials}', materialsStr);

  // Dimensions
  let dimensionsStr = '';
  if (clipContext.dimensions) {
    const d = clipContext.dimensions;
    const parts = [];
    if (d.width) parts.push(`W:${d.width}`);
    if (d.height) parts.push(`H:${d.height}`);
    if (d.depth) parts.push(`D:${d.depth}`);
    if (parts.length) dimensionsStr = `Dimensions: ${parts.join(' x ')} ${d.unit || 'mm'}`;
  }
  prompt = prompt.replace('{dimensions}', dimensionsStr);

  // Price
  const priceStr = clipContext.price
    ? `Price: ${clipContext.price.formatted || `${clipContext.price.amount} ${clipContext.price.currency}`}`
    : '';
  prompt = prompt.replace('{price}', priceStr);

  // Brand
  prompt = prompt.replace('{brand}', clipContext.brand ? `Brand: ${clipContext.brand}` : '');

  return prompt;
}

/**
 * Parse image analysis from AI response
 */
function parseImageAnalysis(text) {
  const analysis = {
    style: 'unknown',
    materials: [],
    features: [],
    complexity: 5,
    colorPalette: [],
  };

  const styleMatch = text.match(/STYLE\s*(?:CLASSIFICATION)?[:\s]+([^\n]+)/i);
  if (styleMatch) {
    analysis.style = styleMatch[1].trim().toLowerCase();
  }

  const materialsSection = text.match(/MATERIALS?\s*(?:DETECTED)?[:\s]+([^]*?)(?=MANUFACTURING|COMPLEXITY|COLOR|SUGGESTED|$)/i);
  if (materialsSection) {
    const materials = materialsSection[1].match(/[-•]\s*([^\n]+)/g);
    if (materials) {
      analysis.materials = materials.map(m => m.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
    }
  }

  const featuresSection = text.match(/MANUFACTURING\s*(?:FEATURES)?[:\s]+([^]*?)(?=COMPLEXITY|COLOR|STYLE|SUGGESTED|$)/i);
  if (featuresSection) {
    const features = featuresSection[1].match(/[-•]\s*([^\n]+)/g);
    if (features) {
      analysis.features = features.map(f => f.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
    }
  }

  const complexityMatch = text.match(/COMPLEXITY\s*(?:SCORE)?[:\s]+(\d+)/i);
  if (complexityMatch) {
    analysis.complexity = Math.min(10, Math.max(1, parseInt(complexityMatch[1], 10)));
  }

  const colors = text.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g);
  if (colors) {
    analysis.colorPalette = [...new Set(colors)];
  }

  return analysis;
}

/**
 * Parse suggested parameters from AI response
 * Extracts structured parameters from the SUGGESTED PARAMETERS section
 */
function parseSuggestedParameters(text) {
  const paramsSection = text.match(/SUGGESTED PARAMETERS[:\s]*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i);
  if (!paramsSection) return null;

  const section = paramsSection[1];
  const params = {};

  // Description
  const descMatch = section.match(/Description[:\s]+([^\n]+)/i);
  if (descMatch) params.description = descMatch[1].trim();

  // Dimensions
  const dimMatch = section.match(/Dimensions[:\s]+.*?W[:\s]*(\d+(?:\.\d+)?)(?:mm)?\s*H[:\s]*(\d+(?:\.\d+)?)(?:mm)?\s*D[:\s]*(\d+(?:\.\d+)?)(?:mm)?/i);
  if (dimMatch) {
    params.dimensions = {
      width: parseFloat(dimMatch[1]),
      height: parseFloat(dimMatch[2]),
      depth: parseFloat(dimMatch[3]),
      unit: 'mm',
    };
  }

  // Primary Material
  const matMatch = section.match(/Primary Material[:\s]+([^|\n]+?)(?:\|\s*([^|\n]+?))?(?:\|\s*(\d+(?:\.\d+)?)\s*mm)?$/im);
  if (matMatch) {
    params.primaryMaterial = {
      name: matMatch[1].trim(),
      type: matMatch[2]?.trim() || 'other',
      thickness: matMatch[3] ? parseFloat(matMatch[3]) : undefined,
    };
  }

  // Finish
  const finishMatch = section.match(/Finish[:\s]+([^|\n]+?)(?:\|\s*([^|\n]+?))?(?:\|\s*([^|\n]+?))?$/im);
  if (finishMatch) {
    params.finish = {
      type: finishMatch[1].trim(),
      color: finishMatch[2]?.trim() || undefined,
      sheen: finishMatch[3]?.trim() || undefined,
    };
  }

  // Hardware (can have multiple)
  const hwMatches = section.matchAll(/Hardware[:\s]+(\d+)x\s+([^(]+?)(?:\(([^)]+)\))?$/gim);
  const hardware = [];
  for (const hw of hwMatches) {
    hardware.push({
      quantity: parseInt(hw[1], 10),
      name: hw[2].trim(),
      category: hw[3]?.trim() || 'other',
    });
  }
  if (hardware.length > 0) params.hardware = hardware;

  // Also check for multi-line hardware entries
  if (!params.hardware) {
    const singleHwMatch = section.match(/Hardware[:\s]+(\d+)x\s+([^(\n]+?)(?:\(([^)]+)\))?/i);
    if (singleHwMatch) {
      params.hardware = [{
        quantity: parseInt(singleHwMatch[1], 10),
        name: singleHwMatch[2].trim(),
        category: singleHwMatch[3]?.trim() || 'other',
      }];
    }
  }

  // Construction
  const constMatch = section.match(/Construction[:\s]+([^\n]+)/i);
  if (constMatch) {
    const method = constMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
    const validMethods = ['frameless', 'face-frame', 'post-and-rail', 'solid-wood', 'mixed'];
    if (validMethods.includes(method)) {
      params.constructionMethod = method;
    }
  }

  // Joinery
  const joinMatch = section.match(/Joinery[:\s]+([^\n]+)/i);
  if (joinMatch) {
    const validJoinery = ['dowel', 'biscuit', 'pocket-screw', 'mortise-tenon', 'dovetail', 'rabbet-dado', 'cam-lock', 'confirmat', 'glue-only'];
    const joineryTypes = joinMatch[1].split(/[,;]+/).map(j => j.trim().toLowerCase().replace(/\s+/g, '-')).filter(j => validJoinery.includes(j));
    if (joineryTypes.length > 0) params.joineryTypes = joineryTypes;
  }

  // AWI Grade
  const awiMatch = section.match(/AWI\s*Grade[:\s]+(\w+)/i);
  if (awiMatch) {
    const grade = awiMatch[1].trim().toLowerCase();
    if (['economy', 'custom', 'premium'].includes(grade)) {
      params.awiGrade = grade;
    }
  }

  // Special Requirements
  const specMatch = section.match(/Special\s*Requirements[:\s]+([^\n]+)/i);
  if (specMatch) {
    params.specialRequirements = specMatch[1].split(/[;]+/).map(s => s.trim()).filter(Boolean);
  }

  // Confidence
  const confMatch = section.match(/Confidence[:\s]+([\d.]+)/i);
  if (confMatch) {
    params.confidence = Math.min(1, Math.max(0, parseFloat(confMatch[1])));
  }

  // Reasoning
  const reasonMatch = section.match(/Reasoning[:\s]+([^\n]+)/i);
  if (reasonMatch) params.reasoning = reasonMatch[1].trim();

  // Only return if we have meaningful content
  const hasContent = params.description || params.dimensions || params.primaryMaterial ||
    params.finish || params.hardware || params.constructionMethod || params.joineryTypes ||
    params.awiGrade || params.specialRequirements;

  return hasContent ? params : null;
}

/**
 * Extract feature suggestions from AI response
 */
function extractFeatureSuggestions(text, featureLibrary = null) {
  const suggestions = [];

  const featureIdPattern = /(?:feature|capability)[:\s]*([A-Z0-9-]+)[:\s]*([^.]+)/gi;
  let match;

  while ((match = featureIdPattern.exec(text)) !== null) {
    const featureId = match[1];
    const context = match[2].trim();

    suggestions.push({
      featureId,
      featureName: context.split(/[,\-]/)[0].trim(),
      relevance: 'high',
      reason: context,
    });
  }

  const recommendPatterns = [
    /recommend(?:ed|s)?[:\s]+["']?([^"'\n.]+)["']?\s*(?:for|because|to)?([^.]*)/gi,
    /suggest(?:ed|s)?[:\s]+["']?([^"'\n.]+)["']?\s*(?:for|because|to)?([^.]*)/gi,
  ];

  for (const pattern of recommendPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      const reason = match[2]?.trim() || '';

      if (name.length > 3 && name.length < 100) {
        if (!suggestions.find(s => s.featureName.toLowerCase() === name.toLowerCase())) {
          suggestions.push({
            featureId: '',
            featureName: name,
            relevance: 'medium',
            reason: reason || 'AI recommended',
          });
        }
      }
    }
  }

  return suggestions.slice(0, 8);
}

/**
 * Calculate response confidence
 */
function calculateConfidence(responseText, hasFeatureContext, hasImageAnalysis, hasClipContext) {
  let confidence = 0.5;

  if (responseText.length > 200) confidence += 0.1;
  if (responseText.includes('Feature Library') || responseText.includes('feature')) confidence += 0.1;
  if (hasFeatureContext) confidence += 0.15;
  if (hasImageAnalysis) confidence += 0.1;
  if (hasClipContext) confidence += 0.1;

  if (responseText.includes('might') || responseText.includes('could be')) confidence -= 0.05;
  if (responseText.includes("I'm not sure") || responseText.includes('uncertain')) confidence -= 0.1;

  return Math.min(1, Math.max(0, confidence));
}

/**
 * Save conversation to the unified designItemConversations collection
 * This matches the frontend's collection for real-time sync.
 */
async function saveConversation(designItemId, userId, userMessage, aiResponse) {
  if (!designItemId) return;

  try {
    const conversationRef = db.collection('designItemConversations').doc(designItemId);

    // Also save to the legacy subcollection for backward compatibility
    const legacyRef = db.collection('deliverables').doc(designItemId)
      .collection('aiConversation');

    await legacyRef.add({
      userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userMessage,
      aiResponse: {
        message: aiResponse.message,
        suggestedFeatures: aiResponse.suggestedFeatures || [],
        suggestedParameters: aiResponse.suggestedParameters || null,
        imageAnalysis: aiResponse.imageAnalysis || null,
        confidence: aiResponse.confidence,
      },
    }).catch(() => {
      // Legacy save is best-effort
    });

    // Update the deliverable's last AI interaction
    await db.collection('deliverables').doc(designItemId).update({
      lastAIInteraction: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {
      // Ignore if deliverable doesn't exist
    });
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

// ============================================
// Main Cloud Function
// ============================================

const designChat = onCall({
  memory: '2GiB',
  timeoutSeconds: 120,
  secrets: [GEMINI_API_KEY],
}, async (request) => {
  // 1. Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const userId = request.auth.uid;
  const {
    deliverableId,
    designItemId,
    projectId,
    message,
    imageBase64,
    imageData,
    imageMimeType = 'image/jpeg',
    conversationHistory = [],
    clipContext,
  } = request.data;

  // Support both naming conventions
  const itemId = deliverableId || designItemId;
  const imageSource = imageBase64 || imageData;

  // 2. Validate input
  if (!message && !imageSource && !clipContext) {
    throw new HttpsError('invalid-argument', 'Message, image, or clip context is required');
  }

  if (!itemId) {
    throw new HttpsError('invalid-argument', 'Design item ID is required');
  }

  // 3. Rate limiting
  try {
    const rateResult = await checkRateLimit(userId, 'ai', db);
    if (!rateResult.allowed) {
      throw new HttpsError('resource-exhausted',
        `Rate limit exceeded. Resets at ${rateResult.resetAt.toISOString()}`);
    }
  } catch (error) {
    if (error.code === 'resource-exhausted') throw error;
    console.warn('Rate limit check failed, proceeding:', error.message);
  }

  console.log('Design Chat request:', {
    itemId,
    projectId,
    hasImage: !!imageSource,
    hasClip: !!clipContext,
    messageLength: message?.length || 0,
  });

  try {
    // 4. Get Gemini model
    const model = getGeminiModel(GEMINI_API_KEY.value());

    // 5. Get cached Feature Library context
    const cacheManager = getCacheManager(db);
    const featureContext = await cacheManager.getOrCreateCache();

    // 6. Build prompt parts
    const parts = [];

    // System instruction
    parts.push({ text: DESIGN_CHAT_SYSTEM_PROMPT });

    // Feature Library context
    if (featureContext) {
      parts.push({ text: `\n\nDAWIN FEATURE LIBRARY:\n${featureContext}` });
    }

    // Clip context (from clipper library)
    let hasClipContext = false;
    if (clipContext) {
      const clipPrompt = buildClipContextPrompt(clipContext);
      if (clipPrompt) {
        parts.push({ text: `\n\n${clipPrompt}` });
        hasClipContext = true;
      }
    }

    // Conversation history (last 10 messages)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      parts.push({
        text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      });
    }

    // Image if provided (either direct upload or clip image URL)
    let hasImageAnalysis = false;
    if (imageSource) {
      // Check if it's a data URL or base64
      let base64Data = imageSource;
      let mimeType = imageMimeType;

      if (imageSource.startsWith('data:')) {
        const match = imageSource.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      // Only add inline image if it's a proper base64 string (not a URL)
      if (!base64Data.startsWith('http')) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        });
        parts.push({ text: IMAGE_ANALYSIS_PROMPT });
        hasImageAnalysis = true;
      }
    }

    // User message
    if (message) {
      parts.push({ text: `User: ${message}` });
    } else if (hasImageAnalysis) {
      parts.push({ text: 'User: Please analyze this image for furniture/millwork design.' });
    } else if (hasClipContext) {
      parts.push({ text: 'User: Please assess this clip from my library for the current design item.' });
    }

    // 7. Generate response
    const startTime = Date.now();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const responseTime = Date.now() - startTime;
    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = result.response.usageMetadata || {};

    console.log(`Design Chat response in ${responseTime}ms, tokens: ${usageMetadata.totalTokenCount || 'unknown'}`);

    // 8. Parse structured data from response
    const imageAnalysis = hasImageAnalysis ? parseImageAnalysis(responseText) : null;
    const suggestedFeatures = extractFeatureSuggestions(responseText);
    const suggestedParameters = parseSuggestedParameters(responseText);
    const confidence = calculateConfidence(responseText, !!featureContext, hasImageAnalysis, hasClipContext);

    // 9. Build response
    const response = {
      text: responseText,
      message: responseText,
      suggestedFeatures,
      suggestedParameters,
      imageAnalysis,
      confidence,
      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
        responseTimeMs: responseTime,
        modelUsed: 'gemini-2.0-flash',
      },
    };

    // 10. Save conversation (legacy subcollection)
    await saveConversation(itemId, userId, message || '[Clip/Image attached]', response);

    return response;

  } catch (error) {
    console.error('Design Chat error:', error);
    throw new HttpsError('internal', `AI processing failed: ${error.message}`);
  }
});

// ============================================
// Exports
// ============================================

module.exports = {
  designChat,
  // Export helpers for use in existing handlers
  parseImageAnalysis,
  parseSuggestedParameters,
  extractFeatureSuggestions,
  calculateConfidence,
  saveConversation,
  buildClipContextPrompt,
  DESIGN_CHAT_SYSTEM_PROMPT,
  IMAGE_ANALYSIS_PROMPT,
  CLIP_CONTEXT_PROMPT,
};
