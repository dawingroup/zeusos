# DawinOS Implementation Roadmap 2026

> **Last Updated**: January 10, 2026  
> **Status**: Planning Phase  
> **Platform**: DawinOS v2.0 (dawinos.web.app)

---

## Executive Summary

This roadmap consolidates all planned improvements across DawinOS modules, organized into implementation phases. The focus areas are:

1. **AI Intelligence Enhancements** - Contextual recommendations and RAG framework
2. **HR Central Improvements** - Payroll, salary management, tax calculations
3. **Design Manager Optimizations** - Production workflow, material management
4. **Cross-Platform Features** - Unified experience across modules

---

## Phase 1: AI Contextual Recommendations ✅ COMPLETED

**Timeline**: Week 1 (Jan 6-10, 2026)  
**Status**: Implemented  
**Priority**: High

### 1.1 Universal Recommendation Service

| Component | Status | Description |
|-----------|--------|-------------|
| `recommendationService.ts` | ✅ Done | Search products, parts, inspirations, features |
| `useRecommendations.ts` | ✅ Done | Context-aware React hooks |
| `InlineRecommendations.tsx` | ✅ Done | Compact inline display component |

### 1.2 Context-Specific Hooks

| Hook | Context | Purpose |
|------|---------|---------|
| `useDesignItemRecommendations` | Design items | Suggest related products/features |
| `useStrategyRecommendations` | Strategy canvas | Project-based suggestions |
| `usePartsRecommendations` | Parts lists | Standard parts suggestions |

### 1.3 Strategy Canvas Integration

- ✅ Removed dedicated "Product Recommendations" tab
- ✅ Added contextual recommendations in right sidebar
- ✅ Recommendations auto-update based on project context
- ✅ Selected items included in AI report generation

---

## Phase 2: HR Central - Payroll & Compensation 🔄 IN PROGRESS

**Timeline**: Week 2 (Jan 13-17, 2026)  
**Status**: Partially Implemented  
**Priority**: High

### 2.1 Employee Salary Management

| Feature | Status | Description |
|---------|--------|-------------|
| Salary data model | ✅ Done | Basic, housing, transport, lunch, other allowances |
| Net-to-Gross calculator | ✅ Done | Reverse tax calculation for salary negotiations |
| Salary mode toggle | ✅ Done | Switch between net-first and gross-first entry |
| Deduction breakdown | ✅ Done | PAYE, NSSF (5%), LST display |

### 2.2 Payroll Processing (TODO)

| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Payroll run workflow | ⏳ Pending | High | 3 days |
| Batch salary processing | ⏳ Pending | High | 2 days |
| Payslip generation | ⏳ Pending | High | 2 days |
| Bank file export (EFT) | ⏳ Pending | Medium | 1 day |
| URA tax remittance export | ⏳ Pending | Medium | 1 day |
| NSSF contribution export | ⏳ Pending | Medium | 1 day |

### 2.3 Tax Compliance (Uganda)

| Tax Type | Calculation | Status |
|----------|-------------|--------|
| PAYE | Progressive rates (10%, 20%, 30%, 40%) | ✅ Implemented |
| NSSF | 5% employee + 10% employer | ✅ Implemented |
| LST | Annual brackets (5K - 100K) | ✅ Implemented |

### 2.4 Employee Types Support (TODO)

| Type | Tax Treatment | Status |
|------|---------------|--------|
| Full-time salaried | Full PAYE/NSSF | ✅ Supported |
| Part-time | Pro-rated | ⏳ Pending |
| Contract/Consultant | Withholding tax (6%) | ⏳ Pending |
| Casual labor | Threshold-based | ⏳ Pending |

---

## Phase 3: Strategy AI Enhancements

**Timeline**: Week 2 (Jan 10, 2026)  
**Status**: ✅ COMPLETED  
**Priority**: High

### 3.1 Enhanced Project Context Capture

| Section | Data Points | Status |
|---------|-------------|--------|
| Customer Information | Name, company, industry, history | ✅ Implemented |
| Project Details | Type, sub-type, location | ✅ Implemented |
| Timeline | Start, completion, urgency | ✅ Implemented |
| Style Preferences | Primary/secondary, colors, materials | ✅ Implemented |
| Target Users | Demographics, usage, capacity | ✅ Implemented |
| Special Requirements | Sustainability, accessibility, brand | ✅ Implemented |

### 3.2 RAG Framework Integration (TODO)

| Component | Purpose | Status | Effort |
|-----------|---------|--------|--------|
| Vector embeddings | Semantic search for products | ⏳ Pending | 3 days |
| Knowledge base indexing | Index product catalog | ⏳ Pending | 2 days |
| Context injection | Inject relevant docs into prompts | ⏳ Pending | 2 days |
| Feedback loop | Learn from selections | ⏳ Pending | 3 days |

### 3.3 AI Report Improvements (TODO)

| Enhancement | Description | Status | Effort |
|-------------|-------------|--------|--------|
| Product recommendations section | Include catalog products in report | ⏳ Pending | 1 day |
| Inspiration gallery | Visual mood board in report | ⏳ Pending | 2 days |
| Cost estimation integration | Link to estimation module | ⏳ Pending | 2 days |
| Interactive report | Clickable elements to add items | ⏳ Pending | 3 days |

---

## Phase 4: Design Manager Production Workflow

**Timeline**: Week 2 (Jan 10, 2026)  
**Status**: ✅ COMPLETED  
**Priority**: Medium

### 4.1 Optimization System (Completed Dec 2025)

| Component | Status |
|-----------|--------|
| Estimation mode (Stage 3) | ✅ Done |
| Production mode (Stage 4) | ✅ Done |
| Invalidation detection | ✅ Done |
| RAG status indicators | ✅ Done |
| Nesting Studio widget | ✅ Done |

### 4.2 Material Palette (Completed Dec 2025)

| Component | Status |
|-----------|--------|
| Material harvester | ✅ Done |
| Inventory mapping | ✅ Done |
| Katana readiness check | ✅ Done |

### 4.3 Production Tab Enhancements (TODO)

| Feature | Description | Status | Effort |
|---------|-------------|--------|--------|
| Shop traveler PDF | Printable work instructions | ⏳ Pending | 3 days |
| Katana BOM export | Full bill of materials | ⏳ Pending | 2 days |
| QC checklist generation | Quality control points | ⏳ Pending | 2 days |
| Production scheduling | Timeline with dependencies | ⏳ Pending | 5 days |

---

## Phase 5: Parts & Procurement Integration

**Timeline**: Week 2 (Jan 10, 2026)  
**Status**: ✅ COMPLETED  
**Priority**: Medium

### 5.1 Standard Parts Catalog

| Feature | Description | Status | Effort |
|---------|-------------|--------|--------|
| Katana SKU sync | Import SKUs from Katana | ⏳ Pending | 2 days |
| Standard consumables | Screws, hinges, dominos, etc. | ⏳ Pending | 1 day |
| Parts search | Quick search in recommendations | ✅ Integrated |
| Auto-suggest parts | Based on design item type | ⏳ Pending | 2 days |

### 5.2 Procurement Workflow

| Feature | Description | Status | Effort |
|---------|-------------|--------|--------|
| Special items identification | Flag non-standard items | ⏳ Pending | 1 day |
| Approval workflow | Manager approval for special items | ⏳ Pending | 2 days |
| Supplier integration | Quote requests | ⏳ Pending | 3 days |
| PO generation | Create purchase orders | ⏳ Pending | 2 days |

---

## Phase 6: Clipper & Inspiration Integration

**Timeline**: Week 7 (Feb 17-21, 2026)  
**Status**: Planned  
**Priority**: Medium

### 6.1 Design Item Inspiration Tab

| Feature | Description | Status | Effort |
|---------|-------------|--------|--------|
| Linked clips display | Show related design clips | ⏳ Pending | 2 days |
| Quick clip attachment | Add clips to design items | ⏳ Pending | 1 day |
| AI similarity search | Find similar clips | ⏳ Pending | 3 days |
| Mood board view | Visual grid of inspirations | ⏳ Pending | 2 days |

### 6.2 Chrome Extension Enhancements

| Feature | Description | Status | Effort |
|---------|-------------|--------|--------|
| Quick save to project | Direct project association | ⏳ Pending | 2 days |
| Tag suggestions | AI-generated tags | ⏳ Pending | 2 days |
| Batch import | Multiple images at once | ⏳ Pending | 1 day |

---

## Phase 7: Cross-Module AI Features

**Timeline**: Week 8-9 (Feb 24 - Mar 7, 2026)  
**Status**: Planned  
**Priority**: Low

### 7.1 Unified AI Assistant

| Feature | Description | Status | Effort |
|---------|-------------|--------|--------|
| Global command palette AI | Natural language commands | ⏳ Pending | 5 days |
| Cross-module context | AI aware of all project data | ⏳ Pending | 3 days |
| Action suggestions | Proactive workflow hints | ⏳ Pending | 3 days |

### 7.2 Analytics & Insights

| Feature | Description | Status | Effort |
|---------|-------------|--------|--------|
| Project health dashboard | RAG status overview | ⏳ Pending | 3 days |
| Cost trend analysis | Historical comparisons | ⏳ Pending | 2 days |
| Material waste tracking | Optimization improvements | ⏳ Pending | 2 days |

---

## Technical Dependencies

### Infrastructure Requirements

| Requirement | Purpose | Status |
|-------------|---------|--------|
| Firebase Functions | AI endpoints, report generation | ✅ Active |
| Firestore indexes | Query performance | ✅ Configured |
| Cloud Storage | Document/image storage | ✅ Active |
| Gemini API | AI capabilities | ✅ Integrated |

### Collection Structure

| Collection | Purpose | Index Status |
|------------|---------|--------------|
| `launchProducts` | Product catalog | ✅ Indexed |
| `designClips` | Inspirations | ✅ Indexed |
| `features` | Feature library | ✅ Indexed |
| `standardParts` | Parts catalog | ⏳ Needs creation |
| `employees` | HR data | ✅ Indexed |
| `payrollRuns` | Payroll history | ⏳ Needs creation |

---

## Effort Summary

| Phase | Estimated Effort | Priority | Dependencies |
|-------|------------------|----------|--------------|
| Phase 1: AI Recommendations | 5 days | High | ✅ Complete |
| Phase 2: HR Payroll | 12 days | High | Phase 1 |
| Phase 3: Strategy AI | 13 days | High | Phase 1 |
| Phase 4: Production Workflow | 12 days | Medium | Existing optimization |
| Phase 5: Parts & Procurement | 13 days | Medium | Katana integration |
| Phase 6: Clipper Integration | 13 days | Medium | Clipper module |
| Phase 7: Cross-Module AI | 18 days | Low | All phases |

**Total Estimated Effort**: ~86 days (17-18 weeks)

---

## Implementation Priorities

### Immediate (Week 2-3)
1. Complete HR Payroll processing workflow
2. Integrate payroll with employee salary data
3. Generate payslips and tax reports

### Short-term (Week 4-6)
1. RAG framework for product recommendations
2. Production tab shop traveler
3. Standard parts catalog from Katana

### Medium-term (Week 7-9)
1. Clipper integration with design items
2. Cross-module AI assistant
3. Analytics dashboard

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recommendation relevance | >70% acceptance rate | Track selections |
| Payroll processing time | <5 min per run | Measure workflow |
| Error reduction | 50% fewer omissions | Track revisions |
| User adoption | 80% feature usage | Analytics |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Katana API changes | Abstract integration layer |
| AI response quality | Fallback to rule-based suggestions |
| Performance with large catalogs | Implement pagination, caching |
| Tax regulation changes | Configurable tax tables |

---

## Notes

- All timelines assume single developer focus
- Parallel work possible on independent modules
- User testing should occur at each phase completion
- Documentation updates required per phase

---

*Document maintained by: DawinOS Development Team*
