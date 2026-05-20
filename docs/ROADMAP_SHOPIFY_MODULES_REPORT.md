# Roadmap & Shopify Modules - Detailed Technical Report

**Generated:** December 28, 2025  
**Location:** `@/src/modules/design-manager/`

---

## Executive Summary

The Roadmap and Shopify modules are part of the Design Manager system, providing:
- **Roadmap Module**: A Kanban-style product pipeline management system for tracking products from idea to launch
- **Shopify Module**: Integration with Shopify e-commerce platform for syncing products to an online store

Both modules follow a consistent architectural pattern with types, services, hooks, and UI components.

---

## 1. Roadmap Module

### 1.1 Module Structure

```
src/modules/design-manager/
├── types/
│   └── roadmap.ts                    # Type definitions & constants
├── services/
│   └── roadmapService.ts             # Firebase CRUD operations
└── components/roadmap/
    ├── index.ts                      # Module exports
    ├── RoadmapPage.tsx               # Main page component
    ├── PipelineBoard.tsx             # Kanban board view
    ├── ProductCard.tsx               # Individual product card
    ├── ProductForm.tsx               # Create/Edit modal form
    ├── ProductListView.tsx           # Table/list view
    └── useRoadmap.ts                 # React hook for state management
```

### 1.2 Data Model

#### Core Types (`types/roadmap.ts`)

| Type | Values | Purpose |
|------|--------|---------|
| `PipelineStage` | `idea`, `research`, `design`, `prototype`, `production`, `launched` | Product development stages |
| `ProductPriority` | `low`, `medium`, `high`, `critical` | Priority classification |
| `ProductStatus` | `active`, `on-hold`, `cancelled`, `completed` | Product lifecycle status |

#### RoadmapProduct Interface

```typescript
interface RoadmapProduct {
  id: string;
  name: string;
  description: string;
  stage: PipelineStage;
  priority: ProductPriority;
  status: ProductStatus;
  
  // Relationships
  projectId?: string;
  designItemIds?: string[];
  featureIds?: string[];
  
  // Timeline
  targetLaunchDate?: Timestamp;
  estimatedHours?: number;
  
  // Metrics
  progressPercent: number;      // 0-100
  blockers?: string[];
  
  // Media
  thumbnailUrl?: string;
  
  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  order: number;                // Position in stage column
}
```

#### Stage Configuration

Each pipeline stage has visual configuration:

| Stage | Label | Color | Background |
|-------|-------|-------|------------|
| `idea` | Idea | Purple | `bg-purple-100` |
| `research` | Research | Blue | `bg-blue-100` |
| `design` | Design | Cyan | `bg-cyan-100` |
| `prototype` | Prototype | Amber | `bg-amber-100` |
| `production` | Production | Orange | `bg-orange-100` |
| `launched` | Launched | Green | `bg-green-100` |

### 1.3 Service Layer (`roadmapService.ts`)

**Firestore Collection:** `roadmapProducts`

| Function | Description |
|----------|-------------|
| `getProducts()` | Fetch all products ordered by `order` field |
| `getProductsByStage()` | Group products into pipeline columns by stage |
| `getProductById(id)` | Get single product by ID |
| `createProduct(data)` | Create new product with auto-ordering |
| `updateProduct(id, data)` | Update product properties |
| `deleteProduct(id)` | Delete product |
| `moveProductToStage(productId, newStage, newOrder)` | Drag-drop between stages |
| `reorderProducts(stage, productIds)` | Batch reorder within stage |
| `updateProductProgress(id, progressPercent)` | Update progress (0-100) |
| `getProductsByProject(projectId)` | Filter products by project |

### 1.4 React Hook (`useRoadmap.ts`)

Provides state management for the Roadmap page:

```typescript
interface UseRoadmapReturn {
  columns: PipelineColumn[];           // Kanban columns with products
  products: RoadmapProduct[];          // Flat list of all products
  isLoading: boolean;
  error: string | null;
  createProduct: (data: ProductFormData) => Promise<RoadmapProduct>;
  updateProduct: (id: string, data: Partial<ProductFormData>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  moveProduct: (productId: string, newStage: PipelineStage, newOrder: number) => Promise<void>;
  updateProgress: (id: string, progress: number) => Promise<void>;
  refreshProducts: () => Promise<void>;
}
```

### 1.5 UI Components

#### RoadmapPage (`RoadmapPage.tsx`)
- **Main container** for the roadmap feature
- **Header** with stats (total products, launched count, avg progress)
- **View toggle** between Board and List views
- **Add Product** button → opens modal form
- **Refresh** functionality

#### PipelineBoard (`PipelineBoard.tsx`)
- **Kanban board** with 6 columns (one per stage)
- **Drag & drop** support via HTML5 DnD API
- Renders `ProductCard` for each product
- Drop zones with visual feedback

#### ProductCard (`ProductCard.tsx`)
- **Draggable card** displaying product info
- **Progress slider** (range input 0-100)
- **Context menu** (Edit/Delete actions)
- Displays: name, description, priority, estimated hours, target date

#### ProductForm (`ProductForm.tsx`)
- **Modal form** for create/edit operations
- Fields: name, description, stage, priority, estimated hours, target launch date
- Validation: name is required
- Cancel/Submit actions

#### ProductListView (`ProductListView.tsx`)
- **Table view** alternative to Kanban
- Columns: Product, Stage, Priority, Progress, Timeline, Actions
- Filters to only show active products

---

## 2. Shopify Module

### 2.1 Module Structure

```
src/modules/design-manager/
├── types/
│   └── shopify.ts                    # Type definitions
├── services/
│   └── shopifyService.ts             # API & Firebase operations
├── pages/
│   └── ShopifyPage.tsx               # Main page
└── components/shopify/
    ├── index.ts                      # Module exports
    ├── ShopifySettings.tsx           # Connection settings UI
    ├── ShopifyProductList.tsx        # Product listing
    ├── SyncToShopifyButton.tsx       # Product sync button
    └── useShopify.ts                 # React hook
```

### 2.2 Data Model

#### Core Types (`types/shopify.ts`)

| Type | Values | Purpose |
|------|--------|---------|
| `ShopifyConnectionStatus` | `disconnected`, `connecting`, `connected`, `error` | Store connection state |
| `ShopifySyncStatus` | `not_synced`, `syncing`, `synced`, `error` | Product sync state |

#### ShopifyConfig Interface

```typescript
interface ShopifyConfig {
  id: string;
  shopDomain: string;          // e.g., "your-store.myshopify.com"
  accessToken?: string;        // Admin API access token
  status: ShopifyConnectionStatus;
  lastSync?: Timestamp;
  productCount?: number;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### ShopifyProduct Interface

```typescript
interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;              // URL-friendly slug
  description: string;
  vendor: string;
  productType: string;
  status: 'active' | 'draft' | 'archived';
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  sku: string;
  inventoryQuantity: number;
  weight?: number;
  weightUnit?: string;
}

interface ShopifyImage {
  id: string;
  src: string;
  alt?: string;
  position: number;
}
```

#### Product Sync Mapping

Links roadmap products to Shopify products:

```typescript
interface ProductSyncMapping {
  id: string;
  roadmapProductId: string;
  shopifyProductId?: string;
  syncStatus: ShopifySyncStatus;
  lastSynced?: Timestamp;
  error?: string;
}
```

### 2.3 Service Layer (`shopifyService.ts`)

**API Base URL:** `https://api-okekivpl2a-uc.a.run.app`  
**Firestore Collection:** `systemConfig` (for config), `productSyncMappings` (for sync data)

| Function | Type | Description |
|----------|------|-------------|
| `getShopifyConfig()` | Firestore | Get stored Shopify configuration |
| `connectShopify(shopDomain, accessToken)` | API POST | Connect to Shopify store |
| `disconnectShopify()` | Firestore | Clear connection and set disconnected |
| `getShopifyProducts()` | API GET | Fetch products from connected store |
| `syncProductToShopify(roadmapProductId, productData)` | API POST | Create/update product in Shopify |
| `getProductSyncMappings()` | Firestore | Get all sync mappings |
| `getSyncMappingForProduct(roadmapProductId)` | Firestore | Get sync status for specific product |

### 2.4 React Hook (`useShopify.ts`)

```typescript
interface UseShopifyReturn {
  status: ShopifyStatus | null;       // Connection status with shop info
  products: ShopifyProduct[];         // Products from Shopify
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: (shopDomain: string, accessToken: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  syncProduct: (roadmapProductId: string, productData: any) => Promise<{ success: boolean; shopifyProductId?: string }>;
}
```

### 2.5 UI Components

#### ShopifyPage (`pages/ShopifyPage.tsx`)
- **Simple page layout** combining settings and product list
- Max-width container with header

#### ShopifySettings (`ShopifySettings.tsx`)
- **Connection management** UI
- States:
  - **Disconnected**: Shows "Connect Shopify" button
  - **Form**: Shop domain + access token inputs
  - **Connected**: Shows shop name, domain, disconnect option
- Error display for connection failures
- External link to Shopify admin

#### ShopifyProductList (`ShopifyProductList.tsx`)
- **Product listing** from connected Shopify store
- Shows product image, title, status, price
- Refresh button
- Links to Shopify admin for each product
- Empty state when no products

#### SyncToShopifyButton (`SyncToShopifyButton.tsx`)
- **Action button** to sync roadmap product to Shopify
- Converts `RoadmapProduct` to `ShopifyProductInput`:
  - Title ← product name
  - Body HTML ← description
  - Vendor ← "Dawin Group" (hardcoded)
  - Product type ← "Custom Furniture" (hardcoded)
  - Status ← `active` if launched, otherwise `draft`
  - Tags ← stage + priority
  - SKU ← product ID
- Visual feedback: loading spinner, success checkmark, error icon
- Auto-resets after 3 seconds

---

## 3. Integration Points

### 3.1 Roadmap ↔ Shopify Integration

The `SyncToShopifyButton` component bridges the two modules:

```
RoadmapProduct → ShopifyProductInput → Shopify API → ShopifyProduct
                                                    ↓
                                    ProductSyncMapping (Firestore)
```

**Sync Logic:**
1. Product in roadmap reaches a stage where sync is desired
2. User clicks "Sync to Shopify" button on the product card
3. System maps roadmap data to Shopify product format
4. API call creates/updates product in Shopify
5. Mapping record stores relationship for future syncs

### 3.2 Backend API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/shopify/status` | GET | Check connection status |
| `/shopify/connect` | POST | Initialize store connection |
| `/shopify/products` | GET | Fetch all Shopify products |
| `/shopify/sync-product` | POST | Create/update Shopify product |

---

## 4. Database Schema

### Firestore Collections

#### `roadmapProducts`
```javascript
{
  name: "Restaurant Booth V2",
  description: "Modern booth design...",
  stage: "design",
  priority: "high",
  status: "active",
  progressPercent: 45,
  order: 2,
  estimatedHours: 120,
  targetLaunchDate: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `systemConfig/shopifyConfig`
```javascript
{
  shopDomain: "dawin-furniture.myshopify.com",
  accessToken: "shpat_xxx...",
  status: "connected",
  lastSync: Timestamp,
  productCount: 24,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `productSyncMappings`
```javascript
{
  roadmapProductId: "abc123",
  shopifyProductId: "gid://shopify/Product/456",
  syncStatus: "synced",
  lastSynced: Timestamp
}
```

---

## 5. UI/UX Features

### Roadmap Module
- **Kanban Board**: Visual pipeline with drag-and-drop
- **List View**: Tabular alternative for data-dense view
- **Progress Tracking**: Interactive slider on each product
- **Color-coded Stages**: Visual differentiation by stage
- **Priority Indicators**: Color-coded priority levels
- **Timeline Display**: Estimated hours and target dates

### Shopify Module
- **Connection Wizard**: Step-by-step store connection
- **Status Indicators**: Green/red connection status
- **Product Preview**: Images, prices, status badges
- **Sync Feedback**: Loading, success, error states
- **External Links**: Direct access to Shopify admin

---

## 6. Technical Considerations

### Dependencies
- **Firebase/Firestore**: Data persistence
- **Lucide React**: Icon components
- **TailwindCSS**: Styling
- **Cloud Functions API**: Backend operations

### State Management
- Local React state via custom hooks
- No global state store (Redux/Zustand)
- Optimistic updates with refresh after operations

### Error Handling
- Service-level try/catch with error returns
- Hook-level error state propagation
- UI-level error display components

---

## 7. File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `types/roadmap.ts` | 119 | Roadmap type definitions |
| `types/shopify.ts` | 105 | Shopify type definitions |
| `services/roadmapService.ts` | 200 | Roadmap CRUD operations |
| `services/shopifyService.ts` | 157 | Shopify API/Firestore operations |
| `components/roadmap/RoadmapPage.tsx` | 165 | Main roadmap page |
| `components/roadmap/PipelineBoard.tsx` | 90 | Kanban board |
| `components/roadmap/ProductCard.tsx` | 114 | Product card |
| `components/roadmap/ProductForm.tsx` | 155 | Create/edit form |
| `components/roadmap/ProductListView.tsx` | 116 | Table view |
| `components/roadmap/useRoadmap.ts` | 96 | Roadmap hook |
| `components/shopify/ShopifySettings.tsx` | 163 | Settings UI |
| `components/shopify/ShopifyProductList.tsx` | 89 | Product list |
| `components/shopify/SyncToShopifyButton.tsx` | 74 | Sync button |
| `components/shopify/useShopify.ts` | 124 | Shopify hook |
| `pages/ShopifyPage.tsx` | 25 | Shopify page |

**Total Lines:** ~1,592 lines across both modules
