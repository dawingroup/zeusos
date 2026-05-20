# AI Architecture Report
## Dawin Cutlist Processor - Comprehensive AI Analysis

**Generated:** December 28, 2025  
**Version:** 1.0  
**Scope:** Full AI functionality audit with gap analysis and improvement recommendations

---

## Executive Summary

The Dawin Cutlist Processor implements a comprehensive AI layer powered primarily by **Google Gemini 2.0** with supplementary use of **Anthropic Claude** for specific tasks. The AI functionality spans across **asset management**, **design consultation**, **strategy research**, and **manufacturing feasibility analysis**.

### Key Findings
- **11 distinct AI endpoints** across the application
- **2 AI providers**: Gemini (primary), Claude (brief analysis)
- **Strong foundation** in asset and design AI, but several integration gaps exist
- **High-value improvement opportunities** identified that could significantly enhance workflow automation

---

## 1. Current AI Architecture

### 1.1 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Primary AI** | Google Gemini 2.0 Flash | Fast inference, multimodal |
| **Secondary AI** | Anthropic Claude Sonnet 4 | Complex brief parsing |
| **Deployment** | Firebase Cloud Functions (Gen 2) | Serverless execution |
| **Secrets Management** | Firebase Secrets | API key security |
| **Rate Limiting** | Firestore-based | Per-user throttling |
| **Caching** | Feature Library Cache (8hr TTL) | Context optimization |

### 1.2 AI Endpoints Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI ENDPOINT ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ASSET REGISTRY MODULE                                          │
│  ├── /ai/enrich-asset-data         [Gemini + Google Search]    │
│  ├── /ai/analyze-asset-capabilities [Gemini Flash]              │
│  └── analyzeFeatureFromAsset        [Gemini Vision - Callable]  │
│                                                                  │
│  DESIGN MANAGER MODULE                                          │
│  ├── /ai/design-chat               [Gemini Flash + Context]     │
│  ├── /ai/strategy-research         [Gemini Pro]                 │
│  ├── /ai/analyze-image             [Gemini Flash Vision]        │
│  ├── /ai/analyze-brief             [Claude Sonnet 4]            │
│  └── /ai/dfm-check                 [Rules Engine]               │
│                                                                  │
│  FEATURE LIBRARY MODULE                                         │
│  ├── /ai/feature-cache             [Cache Management]           │
│  ├── /ai/feature-context           [Context Provider]           │
│  └── generateStrategyReport        [Gemini + Search Grounding]  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed AI Function Analysis

### 2.1 Asset Registry AI

#### 2.1.1 Asset Data Enrichment (`enrichAssetData`)
**File:** `functions/src/ai/enrichAssetData.js`  
**Model:** Gemini 2.0 Flash with Google Search Grounding

**Purpose:** Auto-fills asset specifications by searching for technical data online.

**Input:**
```typescript
{ brand: string, model: string }
```

**Output:**
```typescript
{
  specs: Record<string, string>,      // Technical specifications
  manualUrl: string | null,           // Official manual link
  productPageUrl: string | null,      // Manufacturer page
  maintenanceTasks: string[],         // 5 recommended tasks
  maintenanceIntervalHours: number    // Service interval
}
```

**Strengths:**
- Google Search grounding provides real-world data
- Automatic fallback for unknown products
- Structured output normalization

**Gaps:**
- No caching of enriched data (repeated calls for same brand/model)
- No confidence scoring
- Limited to English sources

---

#### 2.1.2 Asset Capabilities Analysis (`analyzeAssetCapabilities`)
**File:** `functions/src/ai/analyzeAssetCapabilities.js`  
**Model:** Gemini 2.0 Flash

**Purpose:** Analyzes workshop assets to suggest manufacturing features they enable.

**Output Features Include:**
- Feature name, description, category
- Tags for searchability
- Time estimates and complexity ratings
- Direct link to source asset

**Strengths:**
- Comprehensive feature categorization (8 categories)
- Ties features back to assets for traceability
- Good prompt engineering for manufacturing context

**Gaps:**
- Features are suggested but not auto-added to Feature Library
- No validation against existing features (duplicates possible)
- Single-asset analysis (no multi-asset capability matching)

---

#### 2.1.3 Feature Vision Analysis (`analyzeFeatureFromAsset`)
**File:** `functions/src/ai/analyzeFeatureFromAsset.js`  
**Model:** Gemini 2.0 Flash Vision

**Purpose:** Analyzes photos of jigs/setups to identify design features.

**Strengths:**
- Multimodal capability (image understanding)
- Structured output with confidence estimation
- Suggests required assets for the feature

**Gaps:**
- Not integrated with the main UI (no upload button visible)
- No batch processing for multiple images
- Results not persisted automatically

---

### 2.2 Design Manager AI

#### 2.2.1 Design Chat (`handleDesignChat`)
**File:** `functions/index.js` (lines 2020-2159)  
**Model:** Gemini Flash

**Purpose:** Conversational AI assistant for design consultation with multimodal support.

**Key Features:**
- Conversation history management (last 10 messages)
- Image analysis integration
- Feature Library context injection
- Automatic conversation persistence to Firestore
- Rate limiting (20 requests per user window)

**System Prompt Context:**
- Dawin Group context (Uganda, luxury hospitality)
- AWI quality standards reference
- East African wood species knowledge
- Feature Library recommendations

**Strengths:**
- Rich context awareness
- Multimodal (text + images)
- Persistent conversation history
- Feature extraction from responses

**Gaps:**
- No streaming responses (user waits for full generation)
- Conversation context limited to 10 messages
- No tool use for Feature Library queries
- No RAG (Retrieval Augmented Generation) for project documents

---

#### 2.2.2 Strategy Research (`handleStrategyResearch`)
**File:** `functions/index.js` (lines 2165-2257)  
**Model:** Gemini Pro (configured as Flash)

**Purpose:** Strategic research for project planning with optional web search.

**Strengths:**
- Project context integration
- Feature Library awareness
- Research persistence to Firestore

**Gaps:**
- `enableWebSearch` flag exists but not actually implemented
- No citation tracking for sources
- Stricter rate limiting (10 vs 20) but same model

---

#### 2.2.3 Brief Analysis (`analyzeBrief`)
**File:** `functions/index.js` (lines 665-746)  
**Model:** Claude Sonnet 4

**Purpose:** Parses design briefs to extract structured requirements.

**Output Structure:**
```typescript
{
  extractedItems: DesignItem[],
  projectNotes: string,
  ambiguities: string[],
  clientPreferences: string[]
}
```

**Strengths:**
- Uses Claude for complex document understanding
- Structured item extraction
- Identifies ambiguities for clarification

**Gaps:**
- Only stores first 1000 chars of input
- No follow-up question generation
- Single-pass analysis (no iterative refinement)

---

#### 2.2.4 DfM (Design for Manufacturing) Check (`runDfMCheck`)
**File:** `functions/index.js` (lines 748-943)  
**Model:** Rules-based engine (no AI)

**Purpose:** Validates design parameters against manufacturing constraints.

**Current Rules (7 total):**
1. Minimum panel thickness vs width
2. Inside corner radius limits
3. Grain direction for solid wood
4. Drawer slide clearance
5. CNC nested optimization
6. Material waste threshold
7. Hardware compatibility

**Strengths:**
- Fast, deterministic checks
- Categorized severity (error/warning/info)
- Persists results to Firestore

**Gaps:**
- Static rule set (not AI-enhanced)
- Limited to 7 rules
- No learning from past issues
- No automatic rule generation from past projects

---

### 2.3 Feature Library & Strategy

#### 2.3.1 Feature Library Cache
**File:** `functions/index.js` (lines 2412-2620)

**Purpose:** Caches active features for AI context injection.

**Cache Strategy:**
- 8-hour TTL
- Stores in `systemConfig/featureLibraryCache`
- Auto-refreshes on expiration
- Provides optimized context string for prompts

**Strengths:**
- Reduces Firestore reads
- Optimized context format
- Category-based organization

**Gaps:**
- No incremental updates (full refresh only)
- No cache invalidation on feature changes
- 8-hour staleness possible

---

#### 2.3.2 Strategy Report Generator
**File:** `functions/src/ai/generateStrategyReport.js`  
**Model:** Gemini 2.0 Flash with Google Search

**Purpose:** Generates comprehensive design strategy reports with trend research.

**Workflow:**
1. Fetch available features from Firestore
2. Search current design trends via Google Search grounding
3. Match trends to manufacturing capabilities
4. Generate structured strategy JSON

**Output Sections:**
- Executive summary
- Trend analysis with relevance scores
- Recommendations mapped to features
- Material palette suggestions
- Color scheme with hex codes
- Production feasibility assessment
- Next steps

**Strengths:**
- End-to-end strategy generation
- Real-time trend research
- Feature-to-capability mapping
- Asset detail enrichment

**Gaps:**
- Long execution time (multiple Firestore reads)
- No PDF generation (just JSON)
- No iterative refinement
- Limited to `features` collection (not `featureLibrary`)

---

## 3. Integration Architecture

### 3.1 Data Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Cloud Func  │────▶│   Gemini/    │
│   (React)    │◀────│  (Firebase)  │◀────│   Claude     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │             ┌──────────────┐
       │             │  Firestore   │
       │             │  (Storage)   │
       │             └──────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│   Feature    │◀───▶│   Asset      │
│   Library    │     │   Registry   │
└──────────────┘     └──────────────┘
```

### 3.2 Cross-Module Dependencies

| Module | Depends On | AI Features Used |
|--------|------------|------------------|
| Asset Registry | Feature Library | Enrichment, Capabilities |
| Design Manager | Asset Registry, Feature Library | Chat, Brief, Image |
| Strategy Canvas | Feature Library, Assets | Research, Reports |
| Customer Hub | - | None (gap) |
| Cutlist Processor | - | None (gap) |

---

## 4. Gap Analysis

### 4.1 Critical Gaps (High Priority)

#### GAP-1: No Cutlist AI Integration
**Impact:** HIGH  
**Module:** Cutlist Processor

The core cutlist processing module has **no AI integration**. This is a significant gap given the complexity of material optimization.

**Missing Capabilities:**
- AI-suggested nesting optimization
- Material substitution recommendations
- Waste prediction and reduction suggestions
- Automatic edge banding inference
- Cut sequence optimization

**Recommendation:** Implement `optimizeCutlist` AI function that:
- Analyzes cut patterns for optimization
- Suggests material alternatives
- Predicts waste percentage
- Recommends cut sequences

---

#### GAP-2: No Customer Intelligence
**Impact:** HIGH  
**Module:** Customer Hub

Customer Hub has no AI features despite holding valuable project history data.

**Missing Capabilities:**
- Customer preference learning
- Project recommendation engine
- Communication summarization
- Budget prediction based on history
- Churn risk assessment

**Recommendation:** Implement `analyzeCustomerHistory` to provide:
- Preference profiles
- Budget tier predictions
- Communication insights

---

#### GAP-3: Disconnected AI Contexts
**Impact:** MEDIUM  
**Architecture**

AI functions operate in silos without shared context:
- Design Chat doesn't know about ongoing cutlists
- Strategy doesn't reference customer history
- Asset capabilities don't inform design recommendations

**Recommendation:** Create unified AI context service that aggregates:
- Active project data
- Customer preferences
- Asset availability
- Recent AI interactions

---

### 4.2 Functional Gaps (Medium Priority)

#### GAP-4: No Streaming Responses
**Impact:** MEDIUM  
**All AI endpoints**

Users wait for complete AI responses, creating poor UX for longer generations.

**Recommendation:** Implement Server-Sent Events (SSE) for:
- Design Chat
- Strategy Research
- Brief Analysis

---

#### GAP-5: Feature Library Inconsistency
**Impact:** MEDIUM  
**Feature Library**

Two collections exist: `features` and `featureLibrary`, causing confusion:
- Strategy Report uses `features`
- Design Chat uses `featureLibrary`
- Cache uses `featureLibrary`

**Recommendation:** Consolidate to single `featureLibrary` collection.

---

#### GAP-6: No AI-Assisted Estimation
**Impact:** MEDIUM  
**Design Manager**

No AI support for project estimation despite having:
- Feature time estimates
- Asset capability data
- Historical project data

**Recommendation:** Implement `generateProjectEstimate` that:
- Analyzes design items
- Calculates feature-based time estimates
- Applies complexity multipliers
- Provides confidence ranges

---

#### GAP-7: Missing RAG Implementation
**Impact:** MEDIUM  
**Design Chat**

Design Chat has no document retrieval capability despite projects having:
- Reference images
- Client briefs
- Previous AI analyses

**Recommendation:** Implement vector embeddings for:
- Project documents
- Past conversations
- Design specifications

---

### 4.3 Enhancement Gaps (Lower Priority)

#### GAP-8: No Proactive AI Suggestions
**Impact:** LOW  
**All modules**

AI is purely reactive (user must ask). No proactive insights.

**Recommendation:** Implement background AI workers for:
- Maintenance predictions
- Design trend alerts
- Material restocking suggestions

---

#### GAP-9: Limited Error Learning
**Impact:** LOW  
**DfM Check**

DfM rules are static and don't learn from actual manufacturing issues.

**Recommendation:** Implement feedback loop:
- Track DfM predictions vs actual outcomes
- Auto-generate new rules from patterns
- Adjust severity based on real impact

---

#### GAP-10: No Multi-Language Support
**Impact:** LOW  
**All AI endpoints**

All prompts and responses are English-only despite East African market.

**Recommendation:** Add language parameter for:
- Swahili support
- French support (DRC, Rwanda)
- Local terminology handling

---

## 5. Improvement Roadmap

### Phase 1: Quick Wins (1-2 weeks)

| Item | Effort | Impact | Description |
|------|--------|--------|-------------|
| Fix Feature Library inconsistency | Low | Medium | Consolidate collections |
| Add asset enrichment caching | Low | Medium | Cache brand+model lookups |
| Enable streaming for Design Chat | Medium | High | Better UX |
| Add confidence scores to all AI | Low | Medium | Better trust signals |

### Phase 2: High-Value Features (3-4 weeks)

| Item | Effort | Impact | Description |
|------|--------|--------|-------------|
| **Cutlist AI Integration** | High | Critical | Optimization, substitution |
| **Project Estimation AI** | Medium | High | Time/cost predictions |
| Unified AI Context | Medium | High | Cross-module awareness |
| Customer Intelligence | Medium | High | Preference learning |

### Phase 3: Advanced Capabilities (6-8 weeks)

| Item | Effort | Impact | Description |
|------|--------|--------|-------------|
| RAG Implementation | High | Medium | Document retrieval |
| Proactive AI Workers | High | Medium | Background insights |
| DfM Learning Loop | Medium | Medium | Rule evolution |
| Multi-language Support | Medium | Low | Swahili/French |

---

## 6. Technical Recommendations

### 6.1 Architecture Improvements

1. **Implement AI Gateway Pattern**
   ```
   Frontend → AI Gateway → [Gemini/Claude/Custom]
   ```
   Benefits: Unified rate limiting, logging, fallbacks

2. **Add AI Observability**
   - Token usage tracking per user/project
   - Response quality metrics
   - Latency monitoring
   - Cost attribution

3. **Implement Prompt Management**
   - Version-controlled prompts
   - A/B testing capability
   - Performance benchmarking

### 6.2 Cost Optimization

Current estimated costs (based on typical usage):
- Gemini Flash: ~$0.075 per 1M input tokens
- Gemini Pro: ~$3.50 per 1M input tokens
- Claude Sonnet: ~$3.00 per 1M input tokens

**Recommendations:**
1. Use Flash for all interactive features
2. Reserve Pro/Claude for complex reasoning only
3. Implement request batching for bulk operations
4. Cache common queries (asset specs, feature lists)

### 6.3 Security Enhancements

1. **Input Validation**
   - Add prompt injection detection
   - Sanitize user inputs before AI calls
   - Implement output filtering

2. **Access Control**
   - Project-scoped AI access
   - Customer data isolation
   - Audit logging for AI operations

---

## 7. Metrics & KPIs

### Recommended AI Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Design Chat Response Time | < 3s | ~5-8s |
| Brief Analysis Accuracy | > 85% | Unknown |
| Feature Recommendation Relevance | > 80% | Unknown |
| DfM Check Coverage | > 90% | ~60% |
| User AI Feature Adoption | > 70% | Unknown |

### Success Indicators for Improvements

1. **Cutlist AI:** 15% reduction in material waste
2. **Estimation AI:** 80% estimate accuracy within 20%
3. **Customer Intelligence:** 25% faster project scoping
4. **Streaming:** 50% improvement in perceived performance

---

## 8. Conclusion

The Dawin Cutlist Processor has a **solid AI foundation** with well-implemented features in asset enrichment and design consultation. However, significant value remains untapped in:

1. **Core cutlist processing** - The namesake feature lacks AI enhancement
2. **Customer intelligence** - Rich data exists but isn't leveraged
3. **Cross-module integration** - AI operates in silos

**Immediate Priority:** Implement Cutlist AI integration to deliver direct manufacturing value.

**Strategic Priority:** Build unified AI context to enable intelligent cross-module recommendations.

The recommended roadmap prioritizes high-impact, achievable improvements while building toward a more sophisticated AI-powered manufacturing platform.

---

## Appendix A: AI Endpoint Reference

| Endpoint | Method | Model | Rate Limit |
|----------|--------|-------|------------|
| `/ai/enrich-asset-data` | POST | Gemini Flash + Search | None |
| `/ai/analyze-asset-capabilities` | POST | Gemini Flash | None |
| `/ai/design-chat` | POST | Gemini Flash | 20/window |
| `/ai/strategy-research` | POST | Gemini Flash | 10/window |
| `/ai/analyze-image` | POST | Gemini Flash | 15/window |
| `/ai/analyze-brief` | POST | Claude Sonnet 4 | None |
| `/ai/dfm-check` | POST | Rules Engine | None |
| `/ai/feature-cache` | GET/POST | N/A | None |
| `/ai/feature-context` | GET | N/A | None |
| `analyzeFeatureFromAsset` | Callable | Gemini Vision | None |
| `generateStrategyReport` | Callable | Gemini + Search | None |

## Appendix B: Firestore Collections for AI

| Collection | Purpose |
|------------|---------|
| `featureLibrary` | Manufacturing features with AI metadata |
| `features` | Legacy features (should consolidate) |
| `designItemConversations` | Chat history per design item |
| `projectStrategy/{id}/research` | Strategy research logs |
| `designProjects/{id}/aiAnalyses` | Brief and DfM analyses |
| `systemConfig/featureLibraryCache` | Feature context cache |
| `rateLimits/{userId}` | Per-user rate limiting |

---

*Report generated by Cascade AI Architecture Analysis*
