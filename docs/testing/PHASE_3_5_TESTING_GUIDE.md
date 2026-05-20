# DawinOS Phase 3-5 Testing Guide

**Version**: 1.0  
**Date**: January 10, 2026  
**Author**: Cascade AI

This document provides comprehensive testing procedures for the features implemented in Phases 3, 4, and 5 of the DawinOS Implementation Roadmap.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 3: RAG Framework & AI Enhancements](#phase-3-rag-framework--ai-enhancements)
3. [Phase 4: Production Workflow](#phase-4-production-workflow)
4. [Phase 5: Parts Catalog](#phase-5-parts-catalog)
5. [Integration Tests](#integration-tests)
6. [Known Limitations](#known-limitations)

---

## Prerequisites

### Environment Setup

```bash
# Start the development server
npm run dev

# In a separate terminal, start Firebase emulators (optional but recommended)
firebase emulators:start

# Deploy functions if testing against production
firebase deploy --only functions
```

### Required Data

Ensure the following Firestore collections have sample data:

| Collection | Minimum Records | Purpose |
|------------|-----------------|---------|
| `launchProducts` | 5-10 products | Product recommendations |
| `designClips` | 3-5 clips | Inspiration gallery |
| `features` or `featureLibrary` | 5-10 features | Feature matching |
| `designProjects` | 1 project | Testing context |
| `designItems` | 3-5 items | Design item testing |

---

## Phase 3: RAG Framework & AI Enhancements

### 3.1 Semantic Search Service

**Location**: `src/shared/services/ai/semanticSearchService.ts`

#### Test 1: Embedding Generation

```typescript
// Browser console test
import { generateEmbedding } from '@/shared/services/ai';

// Test single embedding
const embedding = await generateEmbedding('modern wooden dining table');
console.log('Embedding length:', embedding.length); // Should be 768
console.log('First 5 values:', embedding.slice(0, 5));
```

**Expected Result**:
- Returns array of 768 floating-point numbers
- Values between -1 and 1

#### Test 2: Batch Embeddings

```typescript
import { generateEmbeddings } from '@/shared/services/ai';

const texts = [
  'oak cabinet with brass handles',
  'minimalist desk with drawers',
  'custom wardrobe sliding doors'
];

const embeddings = await generateEmbeddings(texts);
console.log('Count:', embeddings.length); // Should be 3
```

**Expected Result**:
- Returns 3 embedding arrays
- Each array has 768 dimensions

#### Test 3: Collection Indexing

```typescript
import { indexProducts, indexClips } from '@/shared/services/ai';

// Index products (may take a few minutes)
const productResult = await indexProducts();
console.log('Products indexed:', productResult);

// Index clips
const clipResult = await indexClips();
console.log('Clips indexed:', clipResult);
```

**Expected Result**:
- `embeddings` collection populated in Firestore
- Documents have `embedding`, `content`, `metadata` fields

#### Test 4: Semantic Search

```typescript
import { semanticSearch } from '@/shared/services/ai';

const results = await semanticSearch(
  'contemporary office furniture',
  ['launchProducts', 'designClips'],
  5,
  0.5
);

console.log('Results:', results.length);
results.forEach(r => {
  console.log(`- ${r.metadata.name}: ${(r.similarity * 100).toFixed(1)}%`);
});
```

**Expected Result**:
- Returns up to 5 results
- Each result has `similarity` score > 0.5
- Results sorted by relevance

---

### 3.2 Knowledge Base Service

**Location**: `src/shared/services/ai/knowledgeBaseService.ts`

#### Test 5: Context Retrieval

```typescript
import { retrieveContext } from '@/shared/services/ai';

const context = await retrieveContext('hotel lobby reception desk', {
  maxProducts: 3,
  maxInspirations: 2,
  minRelevance: 0.4
});

console.log('Products:', context.products.length);
console.log('Inspirations:', context.inspirations.length);
console.log('Features:', context.features.length);
```

**Expected Result**:
- `products` array with max 3 items
- `inspirations` array with max 2 items
- Each item has `relevance` score

#### Test 6: Context Formatting

```typescript
import { retrieveContext, formatContextForPrompt } from '@/shared/services/ai';

const context = await retrieveContext('kitchen cabinets modern');
const formatted = formatContextForPrompt(context);

console.log('Formatted context:\n', formatted);
```

**Expected Result**:
- Markdown-formatted string
- Sections for Products, Inspirations, Features
- Relevance percentages shown

---

### 3.3 Strategy Research with RAG

**Location**: `functions/src/ai/strategyResearch.js`

#### Test 7: Strategy Research API

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';

const strategyResearch = httpsCallable(functions, 'strategyResearch');

const result = await strategyResearch({
  projectId: 'test-project-123',
  researchType: 'trends',
  context: {
    projectType: 'restaurant',
    location: 'Kampala, Uganda',
  },
  query: 'What are the latest interior design trends for upscale restaurants?'
});

console.log('Findings:', result.data.findings.substring(0, 500));
console.log('Sources:', result.data.sources.length);
console.log('Insights:', result.data.insights.length);
```

**Expected Result**:
- `findings`: AI-generated research text with RAG context
- `sources`: Array of cited web sources
- `insights`: Structured insights extracted

---

### 3.4 Strategy Report with Recommendations

**Location**: `functions/src/ai/generateStrategyReport.js`

#### Test 8: Full Strategy Report

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';

const generateStrategyReport = httpsCallable(functions, 'generateStrategyReport');

const report = await generateStrategyReport({
  projectName: 'Serena Hotel Lobby Renovation',
  projectType: 'hotel',
  clientBrief: 'Modern African luxury aesthetic with sustainable materials',
  location: 'Kampala, Uganda',
  constraints: ['Budget: $50,000', 'Timeline: 3 months'],
  painPoints: ['Existing furniture outdated', 'Poor traffic flow'],
  goals: ['Create welcoming atmosphere', 'Showcase local craftsmanship'],
  budgetTier: 'premium',
  recommendedProducts: [
    { productId: 'prod-1', productName: 'Kampala Lounge Chair', category: 'Seating' }
  ]
});

console.log('Report Title:', report.data.reportTitle);
console.log('Trends:', report.data.trends.length);
console.log('Recommendations:', report.data.recommendations.length);
console.log('Product Recommendations:', report.data.productRecommendations?.length);
console.log('Inspiration Gallery:', report.data.inspirationGallery?.length);
```

**Expected Result**:
- `reportTitle`: Generated title
- `trends`: 3-5 identified trends
- `recommendations`: Actionable recommendations with matched features
- `productRecommendations`: Products from catalog
- `inspirationGallery`: Relevant inspirations
- `materialPalette`: Suggested materials
- `colorScheme`: Color recommendations

---

## Phase 4: Production Workflow

### 4.1 Shop Traveler PDF Service

**Location**: `src/shared/services/pdf/shopTravelerService.ts`

#### Test 9: Build Traveler Data

```typescript
import { buildShopTravelerData } from '@/shared/services/pdf/shopTravelerService';

const project = {
  id: 'proj-123',
  name: 'Kitchen Renovation',
  code: 'KR-2026-001',
  customerName: 'John Doe',
  dueDate: '2026-02-15',
  priority: 'high'
};

const designItems = [
  {
    id: 'item-1',
    name: 'Base Cabinet',
    category: 'Cabinetry',
    quantity: 4,
    dimensions: { width: 600, height: 720, depth: 560, unit: 'mm' },
    materials: [{ name: 'Marine Plywood', specification: '18mm' }],
    parts: [
      { name: 'Side Panel', sku: 'PLY-18-SIDE', quantity: 8, dimensions: '720x560x18' },
      { name: 'Bottom Panel', sku: 'PLY-18-BOT', quantity: 4, dimensions: '564x560x18' }
    ],
    features: [{ name: 'Soft-close hinges', category: 'Hardware', estimatedMinutes: 15 }]
  }
];

const optimizationState = {
  production: {
    nestingSheets: [
      { material: 'Marine Plywood', thickness: '18mm' },
      { material: 'Marine Plywood', thickness: '18mm' },
      { material: 'MDF', thickness: '16mm' }
    ]
  }
};

const travelerData = buildShopTravelerData(project, designItems, optimizationState);

console.log('Project:', travelerData.projectName);
console.log('Priority:', travelerData.priority);
console.log('Design Items:', travelerData.designItems.length);
console.log('Material Summary:', travelerData.materialSummary);
console.log('QC Checkpoints:', travelerData.qualityCheckpoints?.length);
```

**Expected Result**:
- `projectName`: 'Kitchen Renovation'
- `priority`: 'high'
- `designItems`: 1 item with parts
- `materialSummary`: 2 entries (Plywood: 2, MDF: 1)
- `qualityCheckpoints`: 4 stages

### 4.2 Shop Traveler UI Component

**Location**: `src/modules/design-manager/components/production/ShopTraveler.tsx`

#### Test 10: UI Component Rendering

1. Navigate to a project's Production tab
2. Look for "Shop Traveler" card
3. Verify:
   - [ ] Readiness checks display (green/red indicators)
   - [ ] Summary shows: Design Items count, Total Sheets, QC Checkpoints
   - [ ] Preview button opens dialog
   - [ ] Download PDF button works
   - [ ] Print button available

**Manual Test Checklist**:

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open project without optimization | "No Production Data" warning shown |
| 2 | Run production optimization | Readiness checks turn green |
| 3 | Click "Preview" | Dialog opens with traveler preview |
| 4 | Click "Download PDF" | PDF file downloads |
| 5 | Verify PDF content | Contains all design items, parts, QC checkpoints |

---

## Phase 5: Parts Catalog

### 5.1 Katana Parts Sync Service

**Location**: `src/shared/services/katana/katanaPartsSync.ts`

#### Test 11: Sync from Katana

```typescript
import { syncFromKatana } from '@/shared/services/katana';

// Sample Katana items (simulate API response)
const katanaItems = [
  {
    id: 'kat-1',
    name: 'Blum Soft-Close Hinge',
    sku: 'HW-BLUM-SC-110',
    category_name: 'Hardware',
    unit_price: 15000,
    currency: 'UGX',
    stock_on_hand: 150,
    supplier_name: 'Blum Uganda'
  },
  {
    id: 'kat-2',
    name: 'Domino 8x50mm (100pcs)',
    sku: 'FT-DOM-8x50-100',
    category_name: 'Fasteners',
    unit_price: 85000,
    currency: 'UGX',
    stock_on_hand: 25,
    supplier_name: 'Festool EA'
  },
  {
    id: 'kat-3',
    name: 'PVA Wood Glue 5L',
    sku: 'ADH-PVA-5L',
    category_name: 'Adhesives',
    unit_price: 45000,
    currency: 'UGX',
    stock_on_hand: 12,
    supplier_name: 'Titebond'
  }
];

const result = await syncFromKatana(katanaItems);

console.log('Sync Result:', result);
// { synced: 3, created: 3, updated: 0, errors: 0, timestamp: ... }
```

**Expected Result**:
- `synced`: Total items processed
- `created`: New items added
- `updated`: Existing items updated
- `standardParts` collection populated in Firestore

#### Test 12: Parts Search

```typescript
import { searchParts, getPartsByCategory } from '@/shared/services/katana';

// Search by category
const hardware = await getPartsByCategory('hardware');
console.log('Hardware parts:', hardware.length);

// Search with filters
const results = await searchParts({
  category: 'fasteners',
  inStockOnly: true,
  searchText: 'domino'
});

console.log('Search results:', results.length);
results.forEach(part => {
  console.log(`- ${part.name} (${part.sku}): ${part.stockLevel} in stock`);
});
```

**Expected Result**:
- Returns parts matching filters
- `inStock` filter works correctly
- Text search matches name/SKU/description

#### Test 13: Part Recommendations

```typescript
import { getRecommendedParts, getSuggestedConsumables } from '@/shared/services/katana';

// Get recommended parts for a cabinet
const recommended = await getRecommendedParts('cabinet', []);
console.log('Recommended for cabinet:', recommended.length);
recommended.forEach(p => console.log(`- ${p.name} (${p.category})`));

// Get suggested consumables
const consumables = await getSuggestedConsumables(['Base Cabinet', 'Wall Unit']);
console.log('Suggested consumables:', consumables.length);
```

**Expected Result**:
- `recommended`: Hardware and fasteners for cabinets
- `consumables`: Fasteners, adhesives, consumables

#### Test 14: Parts Statistics

```typescript
import { getPartsStats } from '@/shared/services/katana';

const stats = await getPartsStats();

console.log('Total Parts:', stats.totalParts);
console.log('By Category:', stats.byCategory);
console.log('In Stock:', stats.inStock);
console.log('Out of Stock:', stats.outOfStock);
console.log('Last Synced:', stats.lastSyncedAt);
```

**Expected Result**:
- Category breakdown showing counts
- Stock status summary
- Last sync timestamp

---

## Integration Tests

### Test 15: End-to-End Strategy Workflow

1. **Setup**: Create a new design project
2. **Strategy Canvas**: Navigate to Strategy AI
3. **Project Scoping**: Run scoping with design brief
4. **Research Assistant**: Ask research questions
5. **Generate Report**: Click "Generate Strategy Report"

**Verify**:
- [ ] Report includes catalog products in recommendations
- [ ] Inspiration gallery shows relevant clips
- [ ] Material palette matches project type
- [ ] Features matched from feature library

### Test 16: End-to-End Production Workflow

1. **Setup**: Create project with 3+ design items
2. **Add Parts**: Add parts to each design item
3. **Run Optimization**: Execute production optimization
4. **Generate Traveler**: Open Shop Traveler section
5. **Download PDF**: Generate and download

**Verify**:
- [ ] PDF contains all design items
- [ ] Parts lists complete for each item
- [ ] Material summary accurate
- [ ] QC checkpoints present
- [ ] Sign-off sections printable

---

## Known Limitations

| Feature | Limitation | Workaround |
|---------|------------|------------|
| Embedding Generation | Requires deployed Cloud Functions | Use Firebase emulators locally |
| Semantic Search | First search may be slow (cold start) | Pre-index collections |
| PDF Generation | Large PDFs may timeout | Limit design items per traveler |
| Katana Sync | Manual trigger only | Schedule via Firebase scheduled functions |
| RAG Context | Limited to 20 context items | Adjust `topK` parameter |

---

## Troubleshooting

### "Failed to generate embedding"
- Check GEMINI_API_KEY is set in Firebase secrets
- Verify Cloud Functions deployed
- Check Firebase console for function logs

### "No products found in recommendations"
- Ensure `launchProducts` collection has data
- Run `indexProducts()` to create embeddings
- Check `currentStage` field includes 'launched', 'ready', etc.

### "Shop traveler PDF blank"
- Verify production optimization was run
- Check `optimizationState.production.nestingSheets` exists
- Ensure design items have parts defined

### "Parts sync failed"
- Verify Firestore rules allow writes to `standardParts`
- Check for duplicate SKUs
- Review console for specific error messages

---

## Test Data Scripts

### Create Sample Products

```typescript
// Run in browser console or node script
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

const sampleProducts = [
  {
    name: 'Kampala Executive Desk',
    category: 'Desks',
    description: 'Modern executive desk with cable management',
    currentStage: 'launched',
    specifications: {
      materials: ['African Mahogany', 'Brass'],
      finishes: ['Natural Oil', 'Matte Lacquer']
    },
    tags: ['modern', 'executive', 'office']
  },
  // Add more...
];

for (const product of sampleProducts) {
  await addDoc(collection(db, 'launchProducts'), {
    ...product,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}
```

### Create Sample Parts

```typescript
import { addCustomPart } from '@/shared/services/katana';

const sampleParts = [
  {
    sku: 'HW-HINGE-SC-110',
    name: 'Soft-Close Hinge 110°',
    category: 'hardware',
    unitPrice: 12000,
    currency: 'UGX',
    inStock: true,
    stockLevel: 200
  },
  // Add more...
];

for (const part of sampleParts) {
  await addCustomPart(part);
}
```

---

**End of Testing Guide**
