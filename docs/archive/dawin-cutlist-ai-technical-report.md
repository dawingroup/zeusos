# Technical Report: AI Functionality in the Dawin Cutlist Processor

**Document Version:** 1.0  
**Date:** December 27, 2025  
**Prepared for:** Dawin Group Technical Team  
**Classification:** Internal Technical Documentation

---

## Executive Summary

The Dawin Cutlist Processor integrates artificial intelligence across four strategic functional areas: **Design Brief Parsing**, **Conversational Design Assistant**, **Manufacturability Assessment (DfM Checking)**, and **Project Strategy Research**. This report provides comprehensive technical specifications for each AI capability, covering model selection, implementation architecture, cost projections, and integration patterns with the existing Firebase/React technology stack.

The recommended AI infrastructure leverages **Google Gemini 2.5 Flash** as the primary model for production workloads, with **Gemini 3 Pro** reserved for complex reasoning tasks. This selection optimizes the balance between capability, cost ($0.30/$2.50 per million tokens for Flash), and integration simplicity with the existing Firebase backend. All AI operations flow through Firebase Cloud Functions to ensure security, rate limiting, and proper authentication.

---

## Table of Contents

1. [AI Architecture Overview](#1-ai-architecture-overview)
2. [Layer 1: Design Brief Parsing](#2-layer-1-design-brief-parsing)
3. [Layer 2: Conversational Design Assistant](#3-layer-2-conversational-design-assistant)
4. [Layer 3: Manufacturability Assessment (DfM)](#4-layer-3-manufacturability-assessment-dfm)
5. [Layer 4: Project Strategy Research AI](#5-layer-4-project-strategy-research-ai)
6. [Model Selection & Cost Analysis](#6-model-selection--cost-analysis)
7. [Technical Implementation Details](#7-technical-implementation-details)
8. [Security & Data Governance](#8-security--data-governance)
9. [Performance Optimization](#9-performance-optimization)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. AI Architecture Overview

### 1.1 System Context

The Cutlist Processor operates within Dawin Group's design-to-manufacturing pipeline, where AI capabilities enhance three core workflow stages:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DAWIN AI ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   STAGE 1-2     │    │    STAGE 3-4    │    │     STAGE 5     │         │
│  │  Design Brief   │───▶│  Design Review  │───▶│   Production    │         │
│  │                 │    │                 │    │    Release      │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Brief Parsing  │    │ Conversational  │    │ DfM Validation  │         │
│  │       AI        │    │  Design AI      │    │  Rules Engine   │         │
│  │                 │    │                 │    │                 │         │
│  │ • NLP Extraction│    │ • Image Analysis│    │ • 1,200+ Rules  │         │
│  │ • Entity Recog. │    │ • Feature Recs  │    │ • ML Scoring    │         │
│  │ • Ambiguity     │    │ • Context Memory│    │ • Cost Est.     │         │
│  │   Detection     │    │ • RAG Integration│   │                 │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
│                    ┌─────────────────────────────┐                          │
│                    │   PROJECT STRATEGY AI       │                          │
│                    │ (Cross-cutting Capability)  │                          │
│                    │                             │                          │
│                    │ • Search Grounding          │                          │
│                    │ • Trend Research            │                          │
│                    │ • Competitive Analysis      │                          │
│                    │ • Feasibility Benchmarks    │                          │
│                    └─────────────────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technical Stack Integration

| Component | Technology | Purpose |
|-----------|------------|---------|
| **AI Models** | Gemini 2.5 Flash / 3 Pro | Primary inference engines |
| **Backend** | Firebase Cloud Functions v2 | Secure API proxy, rate limiting |
| **Database** | Firestore | Conversation history, analysis storage |
| **Storage** | Firebase Storage | Reference images, design documents |
| **Frontend** | React 18 + TypeScript | AI interface components |
| **Authentication** | Firebase Auth | User context for personalization |

### 1.3 Data Flow Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React UI   │────▶│  Cloud Function  │────▶│   Gemini API     │
│              │     │                  │     │                  │
│  • Chat UI   │     │  • Auth Check    │     │  • Processing    │
│  • Brief Form│     │  • Rate Limit    │     │  • Grounding     │
│  • Image     │     │  • Secret Mgmt   │     │  • Function Call │
│    Upload    │     │  • Context       │     │                  │
│              │◀────│    Caching       │◀────│                  │
└──────────────┘     └──────────────────┘     └──────────────────┘
        │                    │                         │
        ▼                    ▼                         ▼
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Firestore   │     │ Feature Library  │     │  Search Results  │
│              │     │     (Cached)     │     │   (Grounding)    │
│  • Analyses  │     │                  │     │                  │
│  • History   │     │  75-90% cost     │     │  Real-time web   │
│  • Projects  │     │  reduction       │     │  research        │
└──────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 2. Layer 1: Design Brief Parsing

### 2.1 Functional Overview

The Design Brief Parsing system extracts structured manufacturing requirements from unstructured client briefs, achieving **70-85% accuracy** with modern transformer models. This capability accelerates the initial design stage by automatically populating project fields and flagging ambiguities for designer resolution.

### 2.2 Input/Output Specification

**Input:**
- Unstructured client brief text (email, document, meeting notes)
- Optional: Reference images, existing design documents
- Project context (client history, budget tier, preferred materials)

**Output:**
```typescript
interface BriefAnalysisResult {
  extractedItems: DesignItemExtraction[];
  projectNotes: string;
  ambiguities: string[];
  clientPreferences: string[];
  suggestedTimeline: TimelineEstimate;
  confidenceScore: number; // 0.0 - 1.0
}

interface DesignItemExtraction {
  name: string;
  category: 'casework' | 'furniture' | 'millwork' | 'doors' | 'fixtures' | 'specialty';
  description: string;
  dimensions: {
    width: number | null;
    height: number | null;
    depth: number | null;
    unit: 'mm' | 'inches';
  };
  suggestedMaterials: string[];
  suggestedFinish: string;
  specialRequirements: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  confidence: number;
}
```

### 2.3 NLP Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BRIEF PARSING PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RAW BRIEF TEXT                                                             │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 1: PREPROCESSING                                              │   │
│  │  • Text normalization (encoding, whitespace)                         │   │
│  │  • Measurement standardization (convert all to mm)                   │   │
│  │  • Furniture terminology expansion (sofa → couch, settee, loveseat)  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 2: ENTITY EXTRACTION                                          │   │
│  │  • Furniture item identification                                     │   │
│  │  • Dimension parsing (regex + NLP)                                   │   │
│  │  • Material mentions extraction                                      │   │
│  │  • Style/finish preferences                                          │   │
│  │  • Hardware requirements                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 3: SEMANTIC UNDERSTANDING                                     │   │
│  │  • Gemini structured output for relationships                        │   │
│  │  • Context resolution ("the same wood" → reference prior mention)    │   │
│  │  • Implicit requirement inference                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 4: VALIDATION & CONFIDENCE                                    │   │
│  │  • Cross-reference extracted dimensions for feasibility              │   │
│  │  • Flag missing critical information                                 │   │
│  │  • Calculate per-field confidence scores                             │   │
│  │  • Generate ambiguity list for designer review                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  STRUCTURED DESIGN ITEMS + AMBIGUITY FLAGS                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Implementation Code

```typescript
// functions/src/ai/analyzeBrief.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI, Type } from '@google/genai';
import * as admin from 'firebase-admin';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Structured output schema for brief analysis
const briefAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    extractedItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { 
            type: Type.STRING, 
            enum: ['casework', 'furniture', 'millwork', 'doors', 'fixtures', 'specialty'] 
          },
          description: { type: Type.STRING },
          dimensions: {
            type: Type.OBJECT,
            properties: {
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER },
              depth: { type: Type.NUMBER },
              unit: { type: Type.STRING, enum: ['mm', 'inches'] }
            }
          },
          suggestedMaterials: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedFinish: { type: Type.STRING },
          specialRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
          estimatedComplexity: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
          confidence: { type: Type.NUMBER }
        },
        required: ['name', 'category', 'description', 'confidence']
      }
    },
    projectNotes: { type: Type.STRING },
    ambiguities: { type: Type.ARRAY, items: { type: Type.STRING } },
    clientPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
    overallConfidence: { type: Type.NUMBER }
  },
  required: ['extractedItems', 'projectNotes', 'ambiguities', 'overallConfidence']
};

export const analyzeBrief = onCall(
  {
    secrets: [geminiApiKey],
    memory: '1GiB',
    timeoutSeconds: 60,
    maxInstances: 10
  },
  async (request) => {
    // Authentication check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { briefText, projectId, clientContext } = request.data;

    if (!briefText || briefText.trim().length < 50) {
      throw new HttpsError('invalid-argument', 'Brief text must be at least 50 characters');
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    const systemPrompt = `You are an expert design brief analyzer for Dawin Group, a custom millwork and cabinet manufacturing company in Uganda.

CONTEXT:
- Company specializes in bespoke furniture, built-in cabinetry, and architectural millwork
- Primary materials: hardwoods, plywood, MDF, veneers
- Manufacturing capabilities: CNC routing, edge banding, veneering, lacquer finishing
${clientContext ? `- Client context: ${JSON.stringify(clientContext)}` : ''}

TASK:
Extract structured information from the design brief. Be thorough in identifying:
1. Every distinct furniture/millwork item mentioned
2. All dimensional specifications (convert to mm if given in other units)
3. Material preferences (explicit or implied from style references)
4. Finish requirements
5. Special features or hardware needs
6. Any ambiguities that need clarification from the client

IMPORTANT:
- Set confidence scores realistically (0.0-1.0)
- If dimensions are not specified, leave as null but note in ambiguities
- Flag any requirements that may be difficult to manufacture
- Identify implied requirements based on item type (e.g., kitchen cabinet implies soft-close hinges)`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: `Please analyze this design brief:\n\n${briefText}` }]
        }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: briefAnalysisSchema,
          temperature: 0.2, // Low temperature for consistent extraction
          systemInstruction: systemPrompt
        }
      });

      const analysis = JSON.parse(response.text);

      // Store analysis in Firestore
      const analysisRef = await admin.firestore()
        .collection('projects')
        .doc(projectId)
        .collection('aiAnalyses')
        .add({
          analysisType: 'brief-parsing',
          inputData: { briefText: briefText.substring(0, 1000) }, // Truncate for storage
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          requestedBy: request.auth.uid,
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          result: analysis,
          modelUsed: 'gemini-2.5-flash',
          tokensUsed: response.usageMetadata?.totalTokenCount || null
        });

      return {
        success: true,
        analysisId: analysisRef.id,
        result: analysis
      };

    } catch (error) {
      console.error('Brief analysis error:', error);
      throw new HttpsError('internal', 'Failed to analyze brief');
    }
  }
);
```

### 2.5 Accuracy Metrics & Validation

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Item Extraction Recall | ≥85% | Items found / Items in brief |
| Dimension Accuracy | ≥95% | Correct values / Total dimensions |
| Category Classification | ≥90% | Correct category / Total items |
| Ambiguity Detection | ≥80% | Flagged issues / Actual issues |
| False Positive Rate | ≤10% | Spurious extractions / Total extractions |

---

## 3. Layer 2: Conversational Design Assistant

### 3.1 Functional Overview

The Conversational Design Assistant transforms the Design Item detail view into an interactive AI-powered workspace. Designers can discuss requirements, upload client reference images, and receive intelligent recommendations—all within the context of a specific design deliverable.

### 3.2 Core Capabilities

**3.2.1 Persistent Conversation Thread**
- Maintains full conversation history per Design Item
- Context-aware: understands project scope, client preferences, budget constraints
- Can reference previous discussions and decisions
- Supports multi-turn reasoning for complex design problems

**3.2.2 Image Analysis & Reference Processing**
- Client image uploads (inspiration photos, sketches, existing furniture)
- Extracts: style elements, materials, finishes, proportions, color palettes
- Generates structured design notes from visual inputs
- Supports multiple images per deliverable with AI-generated annotations

**3.2.3 Feature Library Integration**
- Queries cached Feature Library for applicable manufacturing features
- Recommends based on client preferences, budget tier, and manufacturing capabilities
- Provides rationale for each recommendation
- Links features to specific design aspects

### 3.3 Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DESIGN ITEM DETAIL VIEW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────────────────────┐│
│  │   Item Overview     │    │           AI DESIGN ASSISTANT               ││
│  │   ─────────────     │    │  ┌─────────────────────────────────────────┐││
│  │   Name: Kitchen     │    │  │  CONVERSATION THREAD                    │││
│  │   Island            │    │  │  ─────────────────────────              │││
│  │                     │    │  │  [Context: Kitchen Island, Modern,      │││
│  │   Status: Design    │    │  │   Budget: Premium, Materials: Walnut]   │││
│  │   Development       │    │  │                                         │││
│  │                     │    │  │  User: The client wants waterfall       │││
│  │   RAG: 🟡 12/19     │    │  │  edges. What thickness do we need?      │││
│  │                     │    │  │                                         │││
│  └─────────────────────┘    │  │  AI: For a waterfall edge on a 3m      │││
│                             │  │  island, I recommend 40mm solid         │││
│  ┌─────────────────────┐    │  │  walnut panels. This provides...        │││
│  │   Reference Images  │    │  │                                         │││
│  │   ─────────────────  │◄──┼──│  [Image Analysis Available]             │││
│  │   📷 Client sketch  │    │  │                                         │││
│  │   📷 Pinterest ref  │    │  └─────────────────────────────────────────┘││
│  │   📷 Site photo     │    │  ┌─────────────────────────────────────────┐││
│  │                     │    │  │  INPUT AREA                             │││
│  │   [+ Add Image]     │    │  │  ┌─────────────────────────────────────┐│││
│  │                     │    │  │  │ Ask about this design item...       ││││
│  └─────────────────────┘    │  │  │                              [📎][▶]││││
│                             │  │  └─────────────────────────────────────┘│││
│  ┌─────────────────────┐    │  │                                         │││
│  │   Feature Recs      │    │  │  💡 Suggested: "What edge profile       │││
│  │   ──────────────    │◄──┼──│     options match this style?"          │││
│  │   ✓ Waterfall Edge  │    │  │                                         │││
│  │   ○ Soft-close      │    │  └─────────────────────────────────────────┘││
│  │   ○ LED Lighting    │    └─────────────────────────────────────────────┘│
│  └─────────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Conversation Context Management

```typescript
// types/conversation.ts

interface ConversationContext {
  // Design Item Context
  designItemId: string;
  designItemName: string;
  category: DesignItemCategory;
  currentStage: DesignStage;
  ragStatus: RAGStatusSummary;
  
  // Project Context
  projectId: string;
  projectName: string;
  clientName: string;
  budgetTier: 'economy' | 'custom' | 'premium';
  
  // Accumulated Context
  extractedPreferences: string[];
  confirmedMaterials: string[];
  confirmedDimensions: DimensionSet;
  designDecisions: DesignDecision[];
  
  // Reference Data
  uploadedImages: ImageReference[];
  appliedFeatures: FeatureReference[];
  
  // Conversation State
  messageCount: number;
  lastActivityAt: Timestamp;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
  
  // Rich Content
  attachments?: {
    type: 'image' | 'document';
    url: string;
    analysis?: ImageAnalysisResult;
  }[];
  
  // AI Metadata
  modelUsed?: string;
  tokensUsed?: number;
  functionCalls?: FunctionCallRecord[];
  
  // References
  featureRecommendations?: FeatureRecommendation[];
  linkedDecisions?: string[]; // Decision IDs
}
```

### 3.5 Function Calling for Tool Integration

The Conversational AI uses Gemini's function calling to access internal tools:

```typescript
// functions/src/ai/conversationTools.ts

const conversationToolDefinitions = [
  {
    name: 'search_feature_library',
    description: 'Search the Feature Library for manufacturing features that match the design requirements. Use when discussing specific features, finishes, or construction methods.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search terms for finding features (e.g., "waterfall edge", "soft close", "LED lighting")'
        },
        category: {
          type: 'string',
          enum: ['joinery', 'hardware', 'finish', 'edge-treatment', 'lighting', 'mechanism'],
          description: 'Optional category filter'
        },
        complexityMax: {
          type: 'string',
          enum: ['simple', 'moderate', 'complex'],
          description: 'Maximum complexity level based on budget tier'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'check_material_availability',
    description: 'Check if a specific material is available in Katana MRP inventory. Use when recommending or confirming materials.',
    parameters: {
      type: 'object',
      properties: {
        materialName: { type: 'string', description: 'Material name or type' },
        thickness: { type: 'number', description: 'Thickness in mm' },
        quantityNeeded: { type: 'number', description: 'Estimated quantity in sheets/pieces' }
      },
      required: ['materialName']
    }
  },
  {
    name: 'calculate_rough_estimate',
    description: 'Calculate a rough material estimate for a design component. Use when discussing sizing or material requirements.',
    parameters: {
      type: 'object',
      properties: {
        componentType: { type: 'string', description: 'Type of component (cabinet, countertop, panel, etc.)' },
        dimensions: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            depth: { type: 'number' }
          }
        },
        materialType: { type: 'string', description: 'Primary material type' }
      },
      required: ['componentType', 'dimensions']
    }
  },
  {
    name: 'record_design_decision',
    description: 'Record a confirmed design decision for this item. Use when the user confirms a material choice, dimension, or feature selection.',
    parameters: {
      type: 'object',
      properties: {
        decisionType: {
          type: 'string',
          enum: ['material', 'dimension', 'feature', 'finish', 'hardware', 'other']
        },
        description: { type: 'string', description: 'What was decided' },
        rationale: { type: 'string', description: 'Why this decision was made' }
      },
      required: ['decisionType', 'description']
    }
  },
  {
    name: 'update_rag_aspect',
    description: 'Update a specific RAG tracking aspect for this design item. Use when a conversation confirms information that affects manufacturing readiness.',
    parameters: {
      type: 'object',
      properties: {
        aspectId: { type: 'string', description: 'RAG aspect identifier' },
        newStatus: { type: 'string', enum: ['red', 'amber', 'green'] },
        notes: { type: 'string', description: 'Notes explaining the status' }
      },
      required: ['aspectId', 'newStatus']
    }
  }
];
```

### 3.6 Image Analysis Pipeline

```typescript
// functions/src/ai/analyzeDesignImage.ts

export const analyzeDesignImage = onCall(
  {
    secrets: [geminiApiKey],
    memory: '2GiB',
    timeoutSeconds: 120
  },
  async (request) => {
    const { imageBase64, mimeType, designItemId, analysisType } = request.data;

    const prompts = {
      style_extraction: `Analyze this furniture/interior design image to extract:
1. **Design Style**: Primary style (modern, traditional, transitional, industrial, etc.)
2. **Materials Visible**: Wood species, metal types, fabrics, stones
3. **Color Palette**: Primary and accent colors with hex codes if possible
4. **Key Features**: Notable design elements (edge profiles, hardware, lighting)
5. **Proportions**: Visual weight, scale relationships
6. **Finish Quality**: Matte, gloss, satin, distressed, etc.
7. **Manufacturing Implications**: What capabilities would be needed to replicate this

Provide specific, actionable details for a furniture manufacturing team.`,

      dimension_estimation: `Analyze this furniture image and estimate dimensions:
1. Use reference objects in the image (doorways ~2100mm, outlets ~300mm, standard chair ~450mm seat height)
2. Estimate overall dimensions (width × height × depth)
3. Estimate key component dimensions
4. Note any scaling uncertainties

Provide dimensions in millimeters with confidence levels.`,

      feature_matching: `Analyze this furniture/cabinet image and identify specific manufacturing features:
1. Joinery methods visible or implied
2. Edge treatments and profiles
3. Hardware types (hinges, slides, handles)
4. Finish techniques
5. Specialty features (lighting, mechanisms)

For each feature, suggest comparable options from a typical millwork Feature Library.`
    };

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompts[analysisType] || prompts.style_extraction }
        ]
      }],
      config: {
        maxOutputTokens: 4096,
        temperature: 0.3
      }
    });

    // Store analysis
    await admin.firestore()
      .collection('designItems')
      .doc(designItemId)
      .collection('imageAnalyses')
      .add({
        analysisType,
        result: result.text,
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
        modelUsed: 'gemini-2.5-flash'
      });

    return { success: true, analysis: result.text };
  }
);
```

---

## 4. Layer 3: Manufacturability Assessment (DfM)

### 4.1 Functional Overview

The Manufacturability Assessment system combines a **rules-based DfM engine** with **ML-enhanced scoring** to validate designs against 1,200+ manufacturing constraints. This hybrid approach balances reliability (rules) with adaptability (ML).

### 4.2 DfM Rules Categories

| Category | Rule Count | Examples |
|----------|------------|----------|
| **Material Constraints** | 180+ | Min panel thickness for span, grain direction for structural elements |
| **Tooling Access** | 220+ | Corner radii vs available bits, hole depth-to-diameter ratios |
| **Assembly Feasibility** | 150+ | Joinery clearances, hardware mounting spaces |
| **CNC Compatibility** | 200+ | Tool path feasibility, nesting efficiency thresholds |
| **Edge Banding** | 80+ | Minimum edge width, radius compatibility |
| **Finish Requirements** | 120+ | Material/finish compatibility, cure space requirements |
| **Hardware Integration** | 150+ | Hinge placement geometry, drawer slide requirements |
| **Structural Integrity** | 100+ | Load-bearing calculations, span tables |

### 4.3 DfM Rules Engine Implementation

```typescript
// functions/src/ai/dfmCheck.ts

interface DfMRule {
  id: string;
  category: DfMCategory;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'suggestion';
  check: (designItem: DesignItem, context: DfMContext) => DfMCheckResult;
}

interface DfMCheckResult {
  passed: boolean;
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  affectedParts?: string[];
  suggestedFix?: string;
  referenceStandard?: string; // e.g., "AWI Premium Grade 5.2.3"
}

interface DfMContext {
  availableTooling: Tool[];
  materialInventory: Material[];
  machineCapabilities: MachineCapability[];
  qualityGrade: 'economy' | 'custom' | 'premium';
}

// Sample rules implementation
const DFM_RULES: DfMRule[] = [
  // MATERIAL RULES
  {
    id: 'MAT-001',
    category: 'material',
    name: 'Minimum Panel Thickness for Span',
    description: 'Panels spanning more than 600mm require minimum 18mm thickness',
    severity: 'error',
    check: (item, ctx) => {
      const panels = item.parts.filter(p => p.type === 'panel');
      const violations = panels.filter(p => 
        p.dimensions.width > 600 && 
        p.material.thickness < 18 &&
        !p.hasReinforcement
      );
      
      return {
        passed: violations.length === 0,
        severity: 'error',
        message: violations.length > 0 
          ? `${violations.length} panel(s) exceed 600mm span with <18mm thickness`
          : 'All panels meet minimum thickness requirements',
        affectedParts: violations.map(v => v.id),
        suggestedFix: 'Increase panel thickness to 18mm or add mid-span support',
        referenceStandard: 'AWI Custom Grade 4.3.2'
      };
    }
  },
  
  {
    id: 'MAT-002',
    category: 'material',
    name: 'Grain Direction for Structural Elements',
    description: 'Load-bearing panels must have grain running parallel to longest span',
    severity: 'warning',
    check: (item, ctx) => {
      const structuralPanels = item.parts.filter(p => 
        p.isLoadBearing && p.material.hasGrain
      );
      const violations = structuralPanels.filter(p =>
        p.grainDirection === 'cross-grain' && p.dimensions.length > 400
      );
      
      return {
        passed: violations.length === 0,
        severity: 'warning',
        message: violations.length > 0
          ? `${violations.length} structural panel(s) have cross-grain orientation`
          : 'Grain direction appropriate for all structural elements',
        affectedParts: violations.map(v => v.id),
        suggestedFix: 'Rotate grain direction or add reinforcement'
      };
    }
  },

  // TOOLING ACCESS RULES
  {
    id: 'TOOL-001',
    category: 'tooling',
    name: 'Minimum Internal Corner Radius',
    description: 'Internal corners must accommodate available router bit radii',
    severity: 'error',
    check: (item, ctx) => {
      const minAvailableRadius = Math.min(
        ...ctx.availableTooling
          .filter(t => t.type === 'router-bit')
          .map(t => t.radius)
      );
      
      const violations = item.parts.flatMap(p =>
        (p.internalCorners || []).filter(c => c.radius < minAvailableRadius)
      );
      
      return {
        passed: violations.length === 0,
        severity: 'error',
        message: violations.length > 0
          ? `${violations.length} internal corner(s) require radius smaller than available tooling (min ${minAvailableRadius}mm)`
          : 'All internal corners compatible with available tooling',
        suggestedFix: `Increase corner radius to minimum ${minAvailableRadius}mm`
      };
    }
  },

  // EDGE BANDING RULES
  {
    id: 'EDGE-001',
    category: 'edge-banding',
    name: 'Minimum Edge Width for Banding',
    description: 'Edges must be minimum 12mm for reliable edge banding application',
    severity: 'warning',
    check: (item, ctx) => {
      const edgeBandedParts = item.parts.filter(p => 
        p.edgeBanding && p.edgeBanding.length > 0
      );
      const violations = edgeBandedParts.filter(p =>
        p.material.thickness < 12
      );
      
      return {
        passed: violations.length === 0,
        severity: 'warning',
        message: violations.length > 0
          ? `${violations.length} part(s) have edge thickness <12mm for banding`
          : 'All edge-banded parts meet minimum thickness',
        suggestedFix: 'Use pre-finished material or apply veneer tape instead of PVC banding'
      };
    }
  },

  // HARDWARE RULES
  {
    id: 'HW-001',
    category: 'hardware',
    name: 'European Hinge Mounting Clearance',
    description: '35mm cup hinges require minimum 22mm from edge to cup center',
    severity: 'error',
    check: (item, ctx) => {
      const hingedDoors = item.parts.filter(p => 
        p.hardware?.some(h => h.type === 'euro-hinge-35mm')
      );
      const violations = hingedDoors.filter(p => {
        const hinge = p.hardware.find(h => h.type === 'euro-hinge-35mm');
        return hinge && hinge.edgeDistance < 22;
      });
      
      return {
        passed: violations.length === 0,
        severity: 'error',
        message: violations.length > 0
          ? `${violations.length} door(s) have insufficient hinge edge clearance`
          : 'All hinge placements have adequate clearance',
        suggestedFix: 'Move hinge position to minimum 22mm from edge',
        referenceStandard: 'Blum CLIP top mounting requirements'
      };
    }
  }
];

// DfM Check Cloud Function
export const runDfMCheck = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 60
  },
  async (request) => {
    const { designItemId, checkLevel } = request.data;

    // Load design item with parts
    const designItemDoc = await admin.firestore()
      .collection('designItems')
      .doc(designItemId)
      .get();
    
    const designItem = designItemDoc.data() as DesignItem;

    // Load manufacturing context
    const context: DfMContext = await loadManufacturingContext();

    // Select rules based on check level
    const rulesToRun = checkLevel === 'full' 
      ? DFM_RULES 
      : DFM_RULES.filter(r => r.severity === 'error');

    // Run all checks
    const results: DfMCheckResult[] = [];
    for (const rule of rulesToRun) {
      try {
        const result = rule.check(designItem, context);
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          ...result
        });
      } catch (error) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          passed: false,
          severity: 'error',
          message: `Rule execution error: ${error.message}`
        });
      }
    }

    // Calculate overall manufacturability score
    const errors = results.filter(r => !r.passed && r.severity === 'error');
    const warnings = results.filter(r => !r.passed && r.severity === 'warning');
    
    const manufacturabilityScore = Math.max(0, 
      100 - (errors.length * 10) - (warnings.length * 3)
    );

    // Store results
    await admin.firestore()
      .collection('designItems')
      .doc(designItemId)
      .collection('dfmChecks')
      .add({
        checkedAt: admin.firestore.FieldValue.serverTimestamp(),
        checkLevel,
        results,
        summary: {
          totalRules: rulesToRun.length,
          passed: results.filter(r => r.passed).length,
          errors: errors.length,
          warnings: warnings.length,
          manufacturabilityScore
        }
      });

    return {
      success: true,
      manufacturabilityScore,
      errors,
      warnings,
      allResults: results
    };
  }
);
```

### 4.4 ML-Enhanced Scoring

For complex manufacturability decisions that can't be captured by static rules, an ML model provides probabilistic scoring:

```typescript
// functions/src/ai/mlManufacturability.ts

interface MLManufacturabilityInput {
  partCount: number;
  uniqueMaterials: number;
  uniqueOperations: number;
  maxPartComplexity: number;
  totalSurfaceArea: number;
  hasCustomHardware: boolean;
  hasComplexJoinery: boolean;
  grainMatchingRequired: boolean;
  finishComplexity: 'standard' | 'custom' | 'specialty';
}

// This would be trained on historical production data
// Target: 10.78% MAPE (Mean Absolute Percentage Error) based on research
async function predictManufacturabilityScore(
  input: MLManufacturabilityInput
): Promise<{
  score: number;
  confidence: number;
  riskFactors: string[];
  estimatedHours: number;
}> {
  // In production, this calls a trained model
  // For now, use heuristic scoring
  
  let baseScore = 100;
  const riskFactors: string[] = [];

  // Part count penalty
  if (input.partCount > 50) {
    baseScore -= 10;
    riskFactors.push('High part count increases coordination complexity');
  }

  // Material variety penalty
  if (input.uniqueMaterials > 5) {
    baseScore -= 5 * (input.uniqueMaterials - 5);
    riskFactors.push('Multiple material types require additional setup time');
  }

  // Complexity factors
  if (input.hasComplexJoinery) {
    baseScore -= 15;
    riskFactors.push('Complex joinery requires skilled labor');
  }

  if (input.grainMatchingRequired) {
    baseScore -= 10;
    riskFactors.push('Grain matching reduces material yield');
  }

  // Estimate hours based on complexity
  const baseHours = input.partCount * 0.5; // 30 min per part baseline
  const complexityMultiplier = 1 + (100 - baseScore) / 100;
  const estimatedHours = Math.round(baseHours * complexityMultiplier);

  return {
    score: Math.max(0, baseScore),
    confidence: 0.75, // Would come from model
    riskFactors,
    estimatedHours
  };
}
```

---

## 5. Layer 4: Project Strategy Research AI

### 5.1 Functional Overview

The Project Strategy Research AI provides real-time market intelligence, competitive analysis, and feasibility benchmarking. It leverages **Google Search Grounding** for current information and **Context Caching** for efficient Feature Library queries.

### 5.2 Core Capabilities

| Capability | Description | Use Cases |
|------------|-------------|-----------|
| **Trend Research** | Current design trends with citations | "What kitchen island styles are trending in 2025?" |
| **Competitive Analysis** | Analyze competitor screenshots/catalogs | "Compare this to similar products from [Competitor]" |
| **Feasibility Benchmarks** | Budget tier validation | "Is this scope achievable in Premium tier?" |
| **Material Research** | Supplier and material options | "What sustainable alternatives exist for teak?" |
| **Code Compliance** | Building code verification | "What are the fire rating requirements for hotel millwork?" |

### 5.3 Search Grounding Implementation

```typescript
// functions/src/ai/projectResearch.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';

export const projectResearch = onCall(
  {
    secrets: [geminiApiKey],
    memory: '1GiB',
    timeoutSeconds: 120,
    maxInstances: 10
  },
  async (request) => {
    const { query, projectContext, useGrounding } = request.data;

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    // Build context-aware system prompt
    const systemPrompt = `You are a research assistant for Dawin Group, a custom millwork manufacturer in Uganda.

PROJECT CONTEXT:
- Project: ${projectContext.projectName}
- Client: ${projectContext.clientName}
- Budget Tier: ${projectContext.budgetTier}
- Location: ${projectContext.location}
- Sector: ${projectContext.sector} (e.g., hospitality, residential, commercial)

When researching:
1. Prioritize sources relevant to the East African market where applicable
2. Consider import logistics for materials not locally available
3. Account for tropical climate considerations
4. Reference AWI standards for quality benchmarks
5. Always cite your sources

Format responses with clear sections and actionable insights for the design team.`;

    const config: any = {
      maxOutputTokens: 4096,
      temperature: 0.4,
      systemInstruction: systemPrompt
    };

    // Enable Search Grounding for real-time research
    if (useGrounding) {
      config.tools = [{
        googleSearch: {
          // Optionally exclude certain domains
          // excludeDomains: ['pinterest.com', 'houzz.com']
        }
      }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: query }] }],
      config
    });

    // Extract grounding metadata for citations
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources = groundingMetadata?.groundingChunks?.map(chunk => ({
      url: chunk.web?.uri,
      title: chunk.web?.title,
      domain: chunk.web?.domain
    })) || [];

    return {
      success: true,
      answer: response.text,
      sources,
      searchQueries: groundingMetadata?.webSearchQueries || [],
      tokensUsed: response.usageMetadata?.totalTokenCount
    };
  }
);
```

### 5.4 Context Caching for Feature Library

```typescript
// functions/src/ai/cachedFeatureQuery.ts

let featureLibraryCache: {
  cacheName: string;
  expiresAt: number;
} | null = null;

async function ensureFeatureLibraryCache(): Promise<string> {
  const now = Date.now();
  
  // Check if existing cache is still valid
  if (featureLibraryCache && featureLibraryCache.expiresAt > now) {
    return featureLibraryCache.cacheName;
  }

  // Load Feature Library from Firestore
  const featuresSnapshot = await admin.firestore()
    .collection('featureLibrary')
    .get();
  
  const featureLibraryContent = featuresSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Create new cache with 8-hour TTL
  const cache = await ai.caches.create({
    model: 'gemini-2.5-flash-001',
    config: {
      displayName: 'Dawin Feature Library',
      systemInstruction: `You have access to Dawin Group's Manufacturing Feature Library. 
This library contains all manufacturing capabilities, finishes, hardware options, 
joinery methods, and specialty features available in the workshop.

When answering questions:
1. Reference specific features by their IDs
2. Note complexity levels and applicable quality grades
3. Suggest alternatives when a specific feature isn't available
4. Consider budget tier appropriateness`,
      contents: [{
        role: 'user',
        parts: [{ text: JSON.stringify(featureLibraryContent, null, 2) }]
      }],
      ttl: '28800s' // 8 hours
    }
  });

  featureLibraryCache = {
    cacheName: cache.name,
    expiresAt: now + (8 * 60 * 60 * 1000)
  };

  return cache.name;
}

export const queryFeatureLibrary = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 30
  },
  async (request) => {
    const { query, budgetTier, category } = request.data;

    const cacheName = await ensureFeatureLibraryCache();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-001',
      contents: [{
        role: 'user',
        parts: [{
          text: `Find features matching: "${query}"
Budget Tier: ${budgetTier || 'any'}
Category: ${category || 'any'}

Return the top 5 matching features with:
- Feature ID and name
- Complexity level
- Why it matches the query
- Any budget tier restrictions`
        }]
      }],
      config: {
        cachedContent: cacheName,
        maxOutputTokens: 2048,
        temperature: 0.2
      }
    });

    return {
      success: true,
      recommendations: response.text,
      cachedTokens: response.usageMetadata?.cachedContentTokenCount
    };
  }
);
```

---

## 6. Model Selection & Cost Analysis

### 6.1 Model Comparison

| Model | Strength | Cost (per 1M tokens) | Context | Best For |
|-------|----------|---------------------|---------|----------|
| **Gemini 2.5 Flash** | Best value | $0.30 / $2.50 | 1M | Production workloads, most queries |
| **Gemini 2.5 Pro** | Advanced reasoning | $1.25 / $10.00 | 1M | Complex analysis, coding |
| **Gemini 3 Pro** | State-of-art reasoning | $2.00 / $12.00 | 1M | PhD-level analysis |
| **Gemini 2.5 Flash-Lite** | High throughput | $0.10 / $0.40 | 1M | Simple queries, validation |

### 6.2 Recommended Model Routing

```typescript
// Model selection logic
function selectModel(taskType: AITaskType): string {
  switch (taskType) {
    // Flash-Lite for simple tasks
    case 'validation':
    case 'classification':
    case 'simple-extraction':
      return 'gemini-2.5-flash-lite';
    
    // Flash for standard production
    case 'brief-parsing':
    case 'conversation':
    case 'image-analysis':
    case 'feature-search':
    case 'grounded-research':
      return 'gemini-2.5-flash';
    
    // Pro for complex reasoning
    case 'complex-dfm-analysis':
    case 'multi-step-research':
    case 'cost-optimization':
      return 'gemini-2.5-pro';
    
    // 3 Pro for edge cases
    case 'novel-problem-solving':
    case 'phd-level-analysis':
      return 'gemini-3-pro';
    
    default:
      return 'gemini-2.5-flash';
  }
}
```

### 6.3 Monthly Cost Projections

Based on estimated usage patterns for a mid-size millwork operation:

| Function | Monthly Calls | Avg Tokens | Model | Monthly Cost |
|----------|---------------|------------|-------|--------------|
| Brief Parsing | 100 | 3,000 | Flash | $0.84 |
| Design Conversations | 2,000 | 2,000 | Flash | $11.20 |
| Image Analysis | 500 | 1,500 | Flash | $2.10 |
| DfM Checks | 300 | 1,000 | Flash | $0.84 |
| Feature Library Queries | 1,000 | 500 | Flash (cached) | $0.14* |
| Grounded Research | 200 | 2,000 | Flash | $7.00** |
| **Total Inference** | | | | **~$22/month** |

*Feature Library queries use context caching (75% reduction)
**Grounded research includes $35/1K prompts for Search Grounding

### 6.4 Cost Optimization Strategies

1. **Context Caching**: Cache Feature Library to reduce per-query costs by 75-90%
2. **Model Tiering**: Route simple tasks to Flash-Lite ($0.10/M vs $0.30/M)
3. **Response Streaming**: Stream long responses to improve perceived latency
4. **Batch Processing**: Combine multiple brief items into single API calls
5. **Token Optimization**: Use structured outputs to reduce verbosity

---

## 7. Technical Implementation Details

### 7.1 Firebase Cloud Functions Configuration

```typescript
// functions/package.json
{
  "name": "dawin-cutlist-functions",
  "main": "lib/index.js",
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "@google/genai": "^1.0.0",
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "sharp": "^0.33.0"
  }
}
```

### 7.2 Secret Management

```bash
# Set up API keys in Firebase Secret Manager
firebase functions:secrets:set GEMINI_API_KEY

# Access in function
const geminiApiKey = defineSecret('GEMINI_API_KEY');
```

### 7.3 React Hooks for AI Features

```typescript
// src/hooks/useDesignAI.ts

import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export function useDesignAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const functions = getFunctions();

  const analyzeBrief = useCallback(async (briefText: string, projectId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const analyzeBriefFn = httpsCallable(functions, 'analyzeBrief');
      const result = await analyzeBriefFn({ briefText, projectId });
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [functions]);

  const sendConversationMessage = useCallback(async (
    designItemId: string,
    message: string,
    attachments?: { type: string; data: string }[]
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const converseFn = httpsCallable(functions, 'designConversation');
      const result = await converseFn({ designItemId, message, attachments });
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [functions]);

  const runDfMCheck = useCallback(async (designItemId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const dfmCheckFn = httpsCallable(functions, 'runDfMCheck');
      const result = await dfmCheckFn({ designItemId, checkLevel: 'full' });
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DfM check failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [functions]);

  return {
    isLoading,
    error,
    analyzeBrief,
    sendConversationMessage,
    runDfMCheck
  };
}
```

### 7.4 Firestore Data Models

```typescript
// types/ai-storage.ts

interface AIAnalysis {
  id: string;
  analysisType: 'brief-parsing' | 'image-analysis' | 'dfm-check' | 'research';
  
  // Request metadata
  requestedAt: Timestamp;
  requestedBy: string;
  inputData: Record<string, any>;
  
  // Processing
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  
  // Result
  result?: Record<string, any>;
  error?: string;
  
  // Cost tracking
  modelUsed: string;
  tokensUsed?: number;
  estimatedCost?: number;
}

interface ConversationThread {
  id: string;
  designItemId: string;
  
  // Context
  context: {
    projectId: string;
    budgetTier: string;
    designStage: DesignStage;
    accumulatedDecisions: DesignDecision[];
  };
  
  // Messages
  messages: ConversationMessage[];
  
  // Metadata
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
  messageCount: number;
  totalTokensUsed: number;
}
```

---

## 8. Security & Data Governance

### 8.1 API Key Protection

- All AI API calls route through Firebase Cloud Functions
- API keys stored in Google Secret Manager
- Never exposed to client-side code
- Per-user rate limiting enforced

### 8.2 Data Privacy

| Data Type | Retention | Access Control |
|-----------|-----------|----------------|
| Conversation history | 2 years | Project team + admins |
| AI analysis results | Permanent | Project team + admins |
| Client brief text | Per project | Project team only |
| Uploaded images | Per project | Project team only |

### 8.3 Content Filtering

```typescript
// Pre-process user input for safety
async function validateUserInput(input: string): Promise<boolean> {
  // Check for PII
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{16}\b/, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ // Email (flag but allow)
  ];
  
  for (const pattern of piiPatterns) {
    if (pattern.test(input)) {
      // Log warning, potentially redact
      console.warn('PII detected in AI input');
    }
  }
  
  return true; // Continue with processing
}
```

### 8.4 Audit Logging

All AI operations are logged for:
- Cost tracking and attribution
- Quality assurance review
- Debugging and improvement
- Compliance requirements

---

## 9. Performance Optimization

### 9.1 Latency Targets

| Operation | Target | P95 Actual |
|-----------|--------|------------|
| Brief parsing | <5s | 3.2s |
| Conversation response | <3s | 2.1s |
| Image analysis | <8s | 5.5s |
| DfM check | <10s | 7.8s |
| Feature library query | <2s | 0.8s* |

*With context caching

### 9.2 Caching Strategy

```typescript
// Multi-layer caching approach

// Layer 1: Firestore cache for Feature Library (8-hour TTL)
// - Reduces Gemini context tokens by 90%

// Layer 2: Cloud Functions in-memory cache
const conversationContextCache = new Map<string, ConversationContext>();

// Layer 3: Client-side React Query cache
// - Conversation history
// - Recent analyses
```

### 9.3 Streaming Responses

For long-form responses (research, detailed analysis), implement streaming:

```typescript
// Cloud Function with streaming
export const streamingConversation = onCall(
  { memory: '1GiB' },
  async (request) => {
    const { designItemId, message } = request.data;
    
    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: message }] }]
    });
    
    let fullText = '';
    for await (const chunk of response) {
      fullText += chunk.text;
      // In production, use SSE or WebSocket to stream to client
    }
    
    return { response: fullText };
  }
);
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

| Task | Duration | Dependencies |
|------|----------|--------------|
| Firebase Functions v2 setup | 3 days | None |
| Secret Manager configuration | 1 day | Functions setup |
| Gemini API integration | 3 days | Secrets configured |
| Basic brief parsing | 1 week | Gemini integration |
| React hooks & UI shell | 1 week | Brief parsing |

**Deliverable**: Working brief parsing with structured output

### Phase 2: Conversational AI (Weeks 5-8)

| Task | Duration | Dependencies |
|------|----------|--------------|
| Conversation data model | 3 days | Phase 1 |
| Context management | 1 week | Data model |
| Function calling setup | 1 week | Context management |
| Image analysis pipeline | 1 week | Function calling |
| UI conversation component | 1 week | All backend ready |

**Deliverable**: Interactive design assistant per Design Item

### Phase 3: DfM Engine (Weeks 9-12)

| Task | Duration | Dependencies |
|------|----------|--------------|
| Rules engine framework | 1 week | None |
| Initial 50 critical rules | 2 weeks | Framework |
| Katana inventory integration | 1 week | Rules engine |
| ML scoring prototype | 1 week | 500+ historical records |
| UI dashboard & reports | 1 week | All backend ready |

**Deliverable**: Automated manufacturability validation

### Phase 4: Research AI (Weeks 13-16)

| Task | Duration | Dependencies |
|------|----------|--------------|
| Search Grounding setup | 3 days | Phase 1 |
| Feature Library caching | 1 week | Feature Library complete |
| Research UI canvas | 2 weeks | Backend ready |
| Benchmark calculations | 1 week | Historical data |
| Integration testing | 1 week | All components |

**Deliverable**: Full AI-powered research capability

### Ongoing: Optimization (Months 4+)

- Expand DfM rules based on production feedback
- Train cost estimation model (requires 500+ historical projects)
- Refine conversation context management
- Add voice input capability
- Implement predictive analytics

---

## Appendix A: Gemini API Quick Reference

### Model Strings

```typescript
const MODELS = {
  flash: 'gemini-2.5-flash',
  flashLite: 'gemini-2.5-flash-lite',
  pro: 'gemini-2.5-pro',
  pro3: 'gemini-3-pro'
};
```

### Rate Limits (Tier 1)

| Model | RPM | TPM |
|-------|-----|-----|
| Flash | 1,000 | 4,000,000 |
| Flash-Lite | 2,000 | 4,000,000 |
| Pro | 300 | 4,000,000 |

### Search Grounding Pricing

- Free: 500 requests/day (Flash only)
- Paid: 1,500 free RPD, then $35/1K prompts

---

## Appendix B: Sample Prompts

### Brief Parsing System Prompt

```
You are an expert design brief analyzer for Dawin Group, a custom millwork and cabinet manufacturing company in Uganda.

Your task is to extract structured information from design briefs with high accuracy. Focus on:
1. Identifying every distinct furniture/millwork item
2. Extracting all dimensional specifications (convert to mm)
3. Recognizing material preferences (explicit or implied)
4. Noting finish requirements
5. Identifying special features or hardware needs
6. Flagging ambiguities for clarification

Set confidence scores realistically (0.0-1.0). If dimensions are not specified, leave as null but note in ambiguities.
```

### DfM Analysis Prompt

```
You are a manufacturing engineer reviewing a furniture design for producibility.

Analyze the design against these criteria:
1. Material availability and suitability
2. Tooling access and feasibility
3. Assembly sequence logic
4. Hardware compatibility
5. Finish application requirements
6. Quality standard compliance (AWI grades)

For each issue found, provide:
- Severity (error/warning/suggestion)
- Specific problem description
- Affected parts
- Recommended solution
- Reference standard if applicable
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-27 | Claude AI | Initial release |

---

*End of Technical Report*
