/**
 * Enhance BOQ Items Cloud Function
 *
 * Uses Claude AI to classify and enrich parsed BOQ items with construction
 * domain intelligence. Groups items by their hierarchy (Bill > Element > Section)
 * and processes each section group with Claude for category, stage, material
 * type, and spec extraction.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Valid categories and stages for classification
const VALID_CATEGORIES = [
  'concrete', 'masonry', 'steel', 'timber', 'roofing', 'finishes',
  'plumbing', 'electrical', 'doors_windows', 'earthworks', 'provisional', 'other',
];

const VALID_STAGES = [
  'preliminaries', 'substructure', 'superstructure', 'roofing',
  'finishes', 'services', 'external_works',
];

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `You are a construction quantity surveyor analyzing a Bill of Quantities (BOQ) from East Africa (Uganda). Your task is to classify and enrich BOQ work items using their hierarchical context.

BOQ HIERARCHY:
- Level 1: BILL (e.g., "BILL NO. 1 - PRELIMINARIES")
- Level 2: ELEMENT (e.g., "ELEMENT NO. 1")
- Level 3: SECTION — governing specification (e.g., "SUBSTRUCTURES: SOLID CONCRETE BLOCKWORK")
- Level 4: WORK ITEM — the actual measured item with quantity/unit/rate

You will receive a section group containing:
1. The Bill name and Element name (context)
2. The Level 3 section header (governing specification)
3. All Level 4 work items under that section

For each Level 4 work item, return:
- category: EXACTLY one of [${VALID_CATEGORIES.join(', ')}]
- stage: EXACTLY one of [${VALID_STAGES.join(', ')}]
- materialType: primary material (e.g., "concrete", "cement blocks", "steel reinforcement", "timber", "PVC pipe")
- materialGrade: grade/specification if detectable (e.g., "C25/30", "Grade 460B", "3.5N/mm2")
- standardizedDescription: concise, clean version of the description (max 100 chars)
- enhancedSpecs: extracted specifications (dimensions, mix ratios, brand references, standards)

RULES:
1. Use the Level 3 section header to infer context for all work items in the section
2. "Ditto" or "as above" should inherit specs from the preceding item
3. For preliminary items (insurances, site setup, etc.), use category="other", stage="preliminaries"
4. Be specific with materialType — "200mm concrete blocks" not just "masonry"
5. If uncertain about a field, use null rather than guessing

Return ONLY valid JSON array — no markdown, no explanation.`;

// ============================================
// Group Items by Section
// ============================================

function groupItemsBySection(items) {
  const groups = new Map();

  // Track current hierarchy context
  let currentBill = '';
  let currentElement = '';
  let currentSection = '';
  let currentSectionDesc = '';

  for (const item of items) {
    const codeParts = (item.itemCode || '').split('.').filter(Boolean);
    const level = item.hierarchyLevel || codeParts.length;

    if (level === 1) {
      currentBill = item.description;
      currentElement = '';
      currentSection = '';
      currentSectionDesc = '';
    } else if (level === 2) {
      currentElement = item.description;
      currentSection = '';
      currentSectionDesc = '';
    } else if (level === 3) {
      currentSection = item.itemCode;
      currentSectionDesc = item.description;
    } else if (level === 4) {
      const sectionKey = currentSection || 'unknown';
      if (!groups.has(sectionKey)) {
        groups.set(sectionKey, {
          billName: currentBill,
          elementName: currentElement,
          sectionCode: currentSection,
          sectionDescription: currentSectionDesc,
          workItems: [],
        });
      }
      groups.get(sectionKey).workItems.push(item);
    }
  }

  return groups;
}

// ============================================
// Build Claude Message for a Section Group
// ============================================

function buildUserMessage(group) {
  let msg = `## Context\n`;
  msg += `- **Bill:** ${group.billName || 'Unknown'}\n`;
  msg += `- **Element:** ${group.elementName || 'Unknown'}\n`;
  msg += `- **Section (Level 3 Governing Spec):** ${group.sectionDescription || 'Unknown'}\n\n`;

  msg += `## Work Items to Classify\n\n`;
  msg += `| # | Item Code | Description | Unit | Qty | Rate | Amount |\n`;
  msg += `|---|-----------|-------------|------|-----|------|--------|\n`;

  for (let i = 0; i < group.workItems.length; i++) {
    const item = group.workItems[i];
    const desc = (item.description || '').substring(0, 120);
    msg += `| ${i + 1} | ${item.itemCode} | ${desc} | ${item.unit || ''} | ${item.quantity || 0} | ${item.rate || 0} | ${item.amount || 0} |\n`;
  }

  msg += `\nReturn a JSON array with ${group.workItems.length} objects, one per work item, in the same order. Each object must have: { "itemCode": "...", "category": "...", "stage": "...", "materialType": "...", "materialGrade": "..." or null, "standardizedDescription": "...", "enhancedSpecs": "..." or null }`;

  return msg;
}

// ============================================
// Process a Single Section Group
// ============================================

async function processSectionGroup(apiKey, group) {
  if (group.workItems.length === 0) return [];

  const userMessage = buildUserMessage(group);
  const preset = group.workItems.length > 20 ? 'detailed' : 'standard';

  try {
    const responseText = await createMessageWithRetry(apiKey, preset, SYSTEM_PROMPT, userMessage);
    const parsed = parseJsonFromResponse(responseText);

    if (!Array.isArray(parsed)) {
      logger.warn('Claude returned non-array response for section', group.sectionCode);
      return [];
    }

    // Map results back to work items
    const enhanced = [];
    for (let i = 0; i < group.workItems.length; i++) {
      const item = group.workItems[i];
      const aiResult = parsed[i] || {};

      enhanced.push({
        ...item,
        category: VALID_CATEGORIES.includes(aiResult.category) ? aiResult.category : item.category,
        stage: VALID_STAGES.includes(aiResult.stage) ? aiResult.stage : item.stage,
        aiDescription: aiResult.standardizedDescription || null,
        aiMaterialType: aiResult.materialType || null,
        aiMaterialGrade: aiResult.materialGrade || null,
        aiSpecs: aiResult.enhancedSpecs || null,
        aiEnhanced: true,
      });
    }

    return enhanced;
  } catch (error) {
    logger.error(`Failed to process section ${group.sectionCode}:`, error);
    // Return items unchanged on error
    return group.workItems;
  }
}

// ============================================
// Main Cloud Function
// ============================================

const enhanceBOQItems = onCall(
  {
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { orgId, projectId, jobId } = request.data;

    if (!orgId || !projectId || !jobId) {
      throw new HttpsError('invalid-argument', 'orgId, projectId, and jobId are required');
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('internal', 'Anthropic API key not configured');
    }

    // Read the parsing job from Firestore
    const jobPath = `organizations/${orgId}/projects/${projectId}/parsingJobs/${jobId}`;
    const jobRef = db.doc(jobPath);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError('not-found', `Parsing job ${jobId} not found`);
    }

    const job = jobSnap.data();
    const items = job.parsedItems;

    if (!items || items.length === 0) {
      throw new HttpsError('failed-precondition', 'No parsed items found in job');
    }

    logger.info(`Enhancing ${items.length} BOQ items for job ${jobId}`);

    // Update job status
    await jobRef.update({
      aiEnhancementStatus: 'processing',
      aiEnhancementStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      // Group items by section
      const groups = groupItemsBySection(items);
      logger.info(`Found ${groups.size} section groups to process`);

      // Process each section group with Claude
      const enhancedItems = [];
      const headerItems = []; // Level 1-3 items pass through unchanged
      let sectionsProcessed = 0;

      // Separate header items from work items
      for (const item of items) {
        const level = item.hierarchyLevel || (item.itemCode || '').split('.').filter(Boolean).length;
        if (level <= 3) {
          headerItems.push(item);
        }
      }

      for (const [sectionCode, group] of groups) {
        const enhanced = await processSectionGroup(apiKey, group);
        enhancedItems.push(...enhanced);
        sectionsProcessed++;

        // Update progress periodically
        if (sectionsProcessed % 5 === 0 || sectionsProcessed === groups.size) {
          await jobRef.update({
            aiEnhancementProgress: Math.round((sectionsProcessed / groups.size) * 100),
          });
        }
      }

      // Rebuild full items list preserving order
      const itemMap = new Map();
      for (const item of enhancedItems) {
        itemMap.set(item.itemCode, item);
      }

      const finalItems = items.map((item) => {
        return itemMap.get(item.itemCode) || item;
      });

      // Write enhanced items back to Firestore
      await jobRef.update({
        parsedItems: finalItems,
        aiEnhancementStatus: 'completed',
        aiEnhancementCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        aiEnhancementProgress: 100,
        aiEnhancementStats: {
          totalItems: items.length,
          enhancedItems: enhancedItems.length,
          sectionsProcessed,
          headerItems: headerItems.length,
        },
      });

      logger.info(`Successfully enhanced ${enhancedItems.length} items across ${sectionsProcessed} sections`);

      return {
        success: true,
        enhancedCount: enhancedItems.length,
        sectionsProcessed,
        totalItems: items.length,
      };
    } catch (error) {
      logger.error('BOQ enhancement failed:', error);

      await jobRef.update({
        aiEnhancementStatus: 'failed',
        aiEnhancementError: error.message || 'Unknown error',
      });

      throw new HttpsError('internal', `Enhancement failed: ${error.message}`);
    }
  }
);

module.exports = { enhanceBOQItems };
