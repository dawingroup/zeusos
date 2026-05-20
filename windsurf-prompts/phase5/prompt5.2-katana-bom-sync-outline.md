# Prompt 5.2: Katana BOM Sync Outline

## Objective
Outline synchronization of project Bill of Materials (BOM) with Katana MRP for production planning.

## Status: OUTLINE ONLY
This prompt provides an outline for future implementation. Not ready for development.

---

## Overview

Katana MRP needs BOM data to plan material purchases and production scheduling.

## Data Mapping

### Project → Katana Sales Order
```
DesignProject → Sales Order
  - Customer (linked via katanaId)
  - Line items from design items
  - Due date
  - Status mapping
```

### Cutlist → Katana BOM
```
ConsolidatedCutlist → Bill of Materials
  - Material groups → BOM lines
  - Quantities aggregated
  - Links to Katana inventory items
```

## Sync Triggers

1. **On Project Confirmation** - Create Sales Order
2. **On Cutlist Regeneration** - Update BOM
3. **On Status Change** - Update order status
4. **Manual Sync** - User-triggered full sync

## API Endpoints Used

```
POST /sales_orders - Create order
PATCH /sales_orders/{id} - Update order
GET /products - Get materials/inventory
POST /manufacturing_orders - Create MO
```

## Material Mapping

Materials in our system need to map to Katana inventory items:
- Store `katanaProductId` in Material entity
- Match by code/SKU during import
- Manual linking UI for unmapped items

## Implementation Steps (Future)

1. Material → Katana Product mapping
2. Sales Order creation on confirmation
3. BOM sync with material quantities
4. Status webhook handling
5. Manufacturing Order creation

---

*This is an outline for future development.*
