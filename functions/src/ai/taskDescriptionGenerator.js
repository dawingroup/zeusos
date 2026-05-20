/**
 * Task Enrichment Generator - DawinOS v2.0
 * Generates AI-powered contextual descriptions, checklists, and relevant document
 * references for tasks using Gemini 1.5 Flash.
 */

const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// ============================================
// Entity Context Fetcher
// ============================================

/**
 * Fetch additional context from related entities in Firestore.
 * Pulls project details, design item specs, deliverables, etc.
 */
async function fetchEntityContext(eventData) {
  const context = {};
  const entityType = eventData.entityType || eventData.context?.entityType;
  const entityId = eventData.entityId || eventData.context?.entityId;
  const projectId = eventData.projectId || eventData.context?.projectId;

  try {
    // Fetch project details
    if (projectId) {
      const projectSnap = await db.collection('designProjects').doc(projectId).get();
      if (projectSnap.exists) {
        const project = projectSnap.data();
        context.project = {
          name: project.name,
          status: project.status,
          currentStage: project.currentStage,
          scope: project.scope,
          budget: project.budget,
          customerName: project.customerName,
          dueDate: project.dueDate,
          deliverables: project.deliverables,
          designBrief: project.designBrief || project.brief,
        };
      }

      // Fetch project deliverables (documents)
      const deliverablesSnap = await db
        .collection('designProjects').doc(projectId)
        .collection('designItems')
        .limit(20)
        .get();

      if (!deliverablesSnap.empty) {
        context.designItems = deliverablesSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name,
            category: data.category,
            currentStage: data.currentStage,
            status: data.status,
            ragStatus: data.ragStatus,
          };
        });
      }
    }

    // Fetch specific entity details (design item)
    if (entityType === 'design_item' && entityId && projectId) {
      const itemSnap = await db
        .collection('designProjects').doc(projectId)
        .collection('designItems').doc(entityId)
        .get();

      if (itemSnap.exists) {
        const item = itemSnap.data();
        context.entity = {
          name: item.name,
          description: item.description,
          category: item.category,
          currentStage: item.currentStage,
          status: item.status,
          ragStatus: item.ragStatus,
          dimensions: item.dimensions,
          materials: item.materials,
          sourcingType: item.sourcingType,
          specifications: item.specifications,
          notes: item.notes,
        };

        // Fetch item deliverables (attached files/documents)
        const itemDeliverables = await db
          .collection('designProjects').doc(projectId)
          .collection('designItems').doc(entityId)
          .collection('deliverables')
          .limit(10)
          .get();

        if (!itemDeliverables.empty) {
          context.entityDeliverables = itemDeliverables.docs.map((d) => {
            const data = d.data();
            return {
              name: data.name,
              type: data.type,
              status: data.status,
              fileName: data.fileName,
            };
          });
        }
      }
    }

    // Fetch client documents for the project
    if (projectId) {
      const clientDocsSnap = await db
        .collection('designProjects').doc(projectId)
        .collection('clientDocuments')
        .limit(10)
        .get();

      if (!clientDocsSnap.empty) {
        context.clientDocuments = clientDocsSnap.docs.map((d) => {
          const data = d.data();
          return {
            name: data.name,
            category: data.category,
            description: data.description,
            hasAiAnalysis: data.aiAnalysisStatus === 'completed',
          };
        });
      }
    }

    // Fetch relevant feature library entries if entity has materials/features
    if (context.entity?.materials || context.entity?.category) {
      const category = context.entity.category;
      if (category) {
        const featuresSnap = await db
          .collection('featureLibrary')
          .where('status', '==', 'active')
          .limit(5)
          .get();

        if (!featuresSnap.empty) {
          context.availableFeatures = featuresSnap.docs.map((d) => ({
            name: d.data().name,
            category: d.data().category,
            qualityGrade: d.data().qualityGrade,
          }));
        }
      }
    }
  } catch (err) {
    logger.warn('Failed to fetch entity context (non-blocking)', { error: err.message });
  }

  return context;
}

// ============================================
// Context Builder
// ============================================

/**
 * Build a context block from business event data and fetched entity context.
 */
function buildContextBlock(eventData, entityContext) {
  const parts = [];
  const ctx = eventData.context || {};
  const current = eventData.currentState || {};
  const previous = eventData.previousState || {};
  const meta = eventData.metadata || {};

  // Basic event context
  if (ctx.customerName) parts.push(`Customer: ${ctx.customerName}`);
  if (ctx.subsidiary || eventData.subsidiary) parts.push(`Subsidiary: ${ctx.subsidiary || eventData.subsidiary}`);
  if (current.currentStage || ctx.currentStage) parts.push(`Current Stage: ${current.currentStage || ctx.currentStage}`);
  if (previous.currentStage) parts.push(`Previous Stage: ${previous.currentStage}`);
  if (current.status || ctx.status) parts.push(`Status: ${current.status || ctx.status}`);
  if (ctx.budget || current.budget) parts.push(`Budget: ${ctx.budget || current.budget}`);
  if (ctx.scope || current.scope) parts.push(`Scope: ${ctx.scope || current.scope}`);
  if (ctx.dueDate || current.dueDate) parts.push(`Due Date: ${ctx.dueDate || current.dueDate}`);
  if (ctx.assignedDesigner) parts.push(`Assigned Designer: ${ctx.assignedDesigner}`);
  if (ctx.projectManager) parts.push(`Project Manager: ${ctx.projectManager}`);
  if (ctx.priority || meta.priority) parts.push(`Priority: ${ctx.priority || meta.priority}`);
  if (current.ragStatus) parts.push(`RAG Status: ${current.ragStatus}`);

  const deliverables = ctx.deliverables || current.deliverables;
  if (Array.isArray(deliverables) && deliverables.length > 0) {
    parts.push(`Deliverables: ${deliverables.join(', ')}`);
  }

  if (Array.isArray(eventData.changedFields) && eventData.changedFields.length > 0) {
    parts.push(`Changed Fields: ${eventData.changedFields.join(', ')}`);
  }

  // Enriched entity context
  if (entityContext.project) {
    const p = entityContext.project;
    if (p.scope) parts.push(`Project Scope: ${p.scope}`);
    if (p.designBrief) parts.push(`Design Brief: ${typeof p.designBrief === 'string' ? p.designBrief.slice(0, 500) : JSON.stringify(p.designBrief).slice(0, 500)}`);
  }

  if (entityContext.entity) {
    const e = entityContext.entity;
    if (e.description) parts.push(`Item Description: ${e.description}`);
    if (e.dimensions) parts.push(`Dimensions: ${JSON.stringify(e.dimensions)}`);
    if (e.materials) parts.push(`Materials: ${Array.isArray(e.materials) ? e.materials.join(', ') : e.materials}`);
    if (e.sourcingType) parts.push(`Sourcing Type: ${e.sourcingType}`);
    if (e.specifications) parts.push(`Specifications: ${typeof e.specifications === 'string' ? e.specifications : JSON.stringify(e.specifications).slice(0, 300)}`);
    if (e.notes) parts.push(`Notes: ${e.notes}`);
  }

  // Related design items in project
  if (entityContext.designItems && entityContext.designItems.length > 0) {
    const itemSummary = entityContext.designItems
      .map((i) => `${i.name} (${i.currentStage || 'unknown'}, RAG: ${i.ragStatus || 'N/A'})`)
      .join('; ');
    parts.push(`Other Design Items in Project: ${itemSummary}`);
  }

  // Existing documents
  if (entityContext.clientDocuments && entityContext.clientDocuments.length > 0) {
    const docList = entityContext.clientDocuments
      .map((d) => `${d.name} [${d.category}]${d.hasAiAnalysis ? ' (AI-analyzed)' : ''}`)
      .join('; ');
    parts.push(`Available Client Documents: ${docList}`);
  }

  if (entityContext.entityDeliverables && entityContext.entityDeliverables.length > 0) {
    const delList = entityContext.entityDeliverables
      .map((d) => `${d.name} (${d.type}, ${d.status})`)
      .join('; ');
    parts.push(`Item Deliverables: ${delList}`);
  }

  if (entityContext.availableFeatures && entityContext.availableFeatures.length > 0) {
    const featList = entityContext.availableFeatures
      .map((f) => `${f.name} [${f.category}]`)
      .join('; ');
    parts.push(`Available Manufacturing Features: ${featList}`);
  }

  return parts.join('\n') || 'No additional context available.';
}

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `You are an intelligent task enrichment engine for DawinOS, the business management platform for Dawin Group — a custom millwork and furniture manufacturing company in East Africa.

When given a task and its business context, you produce a JSON response with four sections:

1. "description" — A contextual task description (3-5 sentences) that helps an employee understand:
   - What this task is specifically about, using real names, values, and dates from the context
   - What they should check or reference in the system (related projects, entities, documents)
   - Brief guidance on how to approach the task or what to prioritise

2. "checklist" — An array of actionable checklist items tailored to this specific task. Each item has:
   - "title": A concise action item (imperative form, e.g. "Review the design brief")
   - "description": A 1-sentence explanation of what to do or verify
   - "isRequired": true for critical steps, false for nice-to-have
   Generate 4-8 checklist items. Make them specific to the actual entity, project, and context — not generic.
   Order them in the logical sequence the employee should follow.

3. "relevantDocuments" — An array of documents, resources, or system references the employee should consult. Each item has:
   - "name": The document or resource name
   - "type": One of "client_document", "deliverable", "design_brief", "feature_library", "design_item", "project", "moodboard", "material_spec", "external_reference"
   - "reason": A 1-sentence explanation of why this is relevant to the task
   Only include documents that are actually mentioned in the context. Do not invent documents.

4. "urgencyScore" — A number from 0 to 100 indicating how urgently this task should be prioritised. Consider:
   - Revenue potential: Client-facing tasks and projects with large budgets score higher
   - Customer satisfaction: Tasks involving client feedback, consultations, or deliverable reviews score higher
   - Delay propagation: Tasks that block other work (stage-gate approvals, procurement, production prep) score higher
   - Entity criticality: Red RAG status, approaching deadlines, or escalated items score higher
   - Routine/low-impact: Internal admin tasks, low-priority reviews score lower
   Also include "urgencyReason" — a 1-sentence explanation of why you assigned this score.

Rules:
- Be specific: use actual project names, customer names, stages, and values from the context
- Be actionable: tell the employee what to do, not just what happened
- Do not invent information not present in the context
- Write in a professional but approachable tone
- If no documents are available in the context, return an empty relevantDocuments array
- If the existing checklist items are already good, you may keep them but still adapt to context

Respond with ONLY valid JSON, no markdown formatting or code fences.`;

// ============================================
// Generator
// ============================================

/**
 * Generate a full AI enrichment for a task: description, checklist, and relevant documents.
 *
 * @param {Object} taskData - The task being enriched
 * @param {Object} eventData - The source business event
 * @param {Object} entityContext - Fetched entity context from Firestore
 * @returns {Promise<Object|null>} { description, checklist, relevantDocuments } or null on failure
 */
async function generateTaskEnrichment(taskData, eventData, entityContext) {
  try {
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY not available, skipping AI enrichment');
      return null;
    }

    const contextBlock = buildContextBlock(eventData, entityContext);

    const existingChecklist = Array.isArray(taskData.checklist) && taskData.checklist.length > 0
      ? taskData.checklist.join(', ')
      : 'None specified';

    const userPrompt = [
      `TASK TITLE: ${taskData.title}`,
      `STATIC DESCRIPTION: ${taskData.description}`,
      `EVENT TYPE: ${eventData.eventType || 'unknown'}`,
      `ENTITY: ${eventData.entityName || 'Unknown'} (${eventData.entityType || 'unknown'})`,
      `PROJECT: ${eventData.projectName || eventData.context?.projectName || 'Not specified'}`,
      `PRIORITY: ${taskData.priority || 'medium'}`,
      '',
      'BUSINESS CONTEXT:',
      contextBlock,
      '',
      `EXISTING CHECKLIST ITEMS: ${existingChecklist}`,
    ].join('\n');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const chat = model.startChat({
      history: [],
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await chat.sendMessage(userPrompt);
    const text = result.response.text()?.trim();

    if (!text) {
      logger.warn('AI returned empty response');
      return null;
    }

    const parsed = JSON.parse(text);

    // Validate structure
    if (!parsed.description || typeof parsed.description !== 'string') {
      logger.warn('AI response missing valid description');
      return null;
    }

    // Normalize checklist items
    const checklist = Array.isArray(parsed.checklist)
      ? parsed.checklist.map((item, index) => ({
          id: String(index + 1),
          title: item.title || item.text || '',
          description: item.description || '',
          isRequired: item.isRequired !== false,
          order: index + 1,
          completed: false,
        })).filter((item) => item.title.length > 0)
      : [];

    // Normalize relevant documents
    const relevantDocuments = Array.isArray(parsed.relevantDocuments)
      ? parsed.relevantDocuments
          .filter((doc) => doc.name && doc.type && doc.reason)
          .map((doc) => ({
            name: doc.name,
            type: doc.type,
            reason: doc.reason,
          }))
      : [];

    // Normalize urgency score
    const urgencyScore =
      typeof parsed.urgencyScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.urgencyScore)))
        : null;
    const urgencyReason =
      typeof parsed.urgencyReason === 'string' && parsed.urgencyReason.length > 0
        ? parsed.urgencyReason
        : null;

    return {
      description: parsed.description,
      checklist: checklist.length > 0 ? checklist : null,
      relevantDocuments: relevantDocuments.length > 0 ? relevantDocuments : null,
      urgencyScore,
      urgencyReason,
    };
  } catch (error) {
    logger.warn('Failed to generate AI task enrichment', {
      error: error.message,
      taskTitle: taskData.title,
    });
    return null;
  }
}

// Keep backward-compatible export
async function generateTaskDescription(taskData, eventData) {
  const entityContext = await fetchEntityContext(eventData);
  const enrichment = await generateTaskEnrichment(taskData, eventData, entityContext);
  return enrichment?.description || null;
}

module.exports = {
  generateTaskEnrichment,
  generateTaskDescription,
  fetchEntityContext,
  buildContextBlock,
  GEMINI_API_KEY,
};
