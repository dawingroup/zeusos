/**
 * Memory Loader Utility
 * Shared utility for loading business memory context across all AI cloud functions.
 * Loads relevant memories from the ai_memory Firestore collection and formats
 * them for injection into AI system prompts.
 */

const admin = require('firebase-admin');

// Ensure admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Category mapping: which memory categories are relevant to which AI module
const MODULE_MEMORY_CATEGORIES = {
  assistant: ['business_fact', 'user_preference', 'project_insight', 'customer_intel', 'process_knowledge', 'decision_record', 'financial_insight'],
  strategy_research: ['business_fact', 'market_intel', 'financial_insight', 'decision_record', 'process_knowledge'],
  strategy_review: ['business_fact', 'market_intel', 'financial_insight', 'decision_record', 'process_knowledge'],
  design_enhancement: ['business_fact', 'project_insight', 'process_knowledge', 'customer_intel', 'decision_record'],
  project_scoping: ['business_fact', 'project_insight', 'customer_intel', 'process_knowledge', 'decision_record'],
  market_intelligence: ['business_fact', 'market_intel', 'financial_insight'],
  general: ['business_fact', 'process_knowledge', 'decision_record'],
};

/**
 * Load business memories from Firestore for a given company and module.
 * @param {string} companyId - Company identifier
 * @param {string} module - AI module name (e.g., 'strategy_research', 'design_enhancement')
 * @param {number} maxMemories - Maximum number of memories to load
 * @returns {Promise<Array<{category: string, content: string, summary: string}>>}
 */
async function loadBusinessMemory(companyId, module = 'general', maxMemories = 12) {
  if (!companyId) return [];

  try {
    const categories = MODULE_MEMORY_CATEGORIES[module] || MODULE_MEMORY_CATEGORIES.general;

    const snapshot = await db.collection('ai_memory')
      .where('companyId', '==', companyId)
      .where('isArchived', '==', false)
      .orderBy('lastAccessedAt', 'desc')
      .limit(maxMemories * 2) // Over-fetch to filter by category
      .get();

    if (snapshot.empty) return [];

    const memories = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(m => categories.includes(m.category))
      .slice(0, maxMemories);

    // Update access counts in background (non-blocking)
    if (memories.length > 0) {
      const batch = db.batch();
      for (const mem of memories) {
        batch.update(db.collection('ai_memory').doc(mem.id), {
          accessCount: admin.firestore.FieldValue.increment(1),
          lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      batch.commit().catch(err => console.warn('Memory access update failed:', err.message));
    }

    return memories.map(m => ({
      category: m.category,
      content: m.content,
      summary: m.summary || '',
    }));
  } catch (error) {
    console.warn('Failed to load business memory:', error.message);
    return [];
  }
}

/**
 * Format loaded memories into a prompt string for injection into AI system prompts.
 * @param {Array<{category: string, content: string, summary: string}>} memories
 * @returns {string}
 */
function formatMemoryPrompt(memories) {
  if (!memories || memories.length === 0) return '';

  const grouped = {};
  for (const mem of memories) {
    const label = categoryLabel(mem.category);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(mem.summary || mem.content);
  }

  let prompt = '\n\n--- BUSINESS CONTEXT (from memory) ---\n';
  prompt += 'The following is knowledge accumulated from previous interactions. Use it to provide more contextual and relevant responses:\n\n';

  for (const [label, items] of Object.entries(grouped)) {
    prompt += `### ${label}\n`;
    for (const item of items) {
      prompt += `- ${item}\n`;
    }
    prompt += '\n';
  }

  prompt += '--- END BUSINESS CONTEXT ---\n';
  return prompt;
}

/**
 * Convert category key to display label
 * @param {string} category
 * @returns {string}
 */
function categoryLabel(category) {
  const labels = {
    business_fact: 'Business Facts',
    user_preference: 'User Preferences',
    project_insight: 'Project Insights',
    customer_intel: 'Customer Intelligence',
    process_knowledge: 'Process Knowledge',
    decision_record: 'Decision Records',
    market_intel: 'Market Intelligence',
    financial_insight: 'Financial Insights',
  };
  return labels[category] || 'General';
}

/**
 * Convenience function: load and format memories in one call.
 * Returns both the formatted prompt and the memory count.
 * @param {string} companyId
 * @param {string} module
 * @param {number} maxMemories
 * @returns {Promise<{prompt: string, count: number}>}
 */
async function getMemoryContext(companyId, module = 'general', maxMemories = 12) {
  const memories = await loadBusinessMemory(companyId, module, maxMemories);
  const prompt = formatMemoryPrompt(memories);
  return { prompt, count: memories.length };
}

module.exports = {
  loadBusinessMemory,
  formatMemoryPrompt,
  getMemoryContext,
  MODULE_MEMORY_CATEGORIES,
};
