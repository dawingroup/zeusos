# Prompt 4.4: Consolidated Estimate

## Objective
Calculate project estimates from cutlist data and material pricing, with QuickBooks invoice sync.

## Prerequisites
- Completed Prompts 4.1-4.3
- Material library with pricing (Phase 3)
- QuickBooks integration (Phase 1)

## Requirements

### 1. Estimate Calculation Service

Create `src/modules/design-manager/services/estimateService.ts`:

```typescript
export async function calculateEstimate(
  customerId: string,
  projectId: string,
  cutlist: ConsolidatedCutlist,
  userId: string
): Promise<ConsolidatedEstimate> {
  const lineItems: EstimateLineItem[] = [];

  // Material costs from cutlist
  for (const group of cutlist.materialGroups) {
    const material = await getMaterial(group.materialId);
    const unitCost = material?.pricing?.unitCost || 0;
    
    lineItems.push({
      id: nanoid(),
      description: `${group.materialName} (${group.thickness}mm)`,
      category: 'material',
      quantity: group.estimatedSheets,
      unit: 'sheet',
      unitPrice: unitCost,
      totalPrice: group.estimatedSheets * unitCost,
      linkedMaterialId: group.materialId,
    });
  }

  // Add labor (configurable rate)
  const laborHours = cutlist.totalParts * 0.25; // 15 min per part avg
  lineItems.push({
    id: nanoid(),
    description: 'Shop Labor',
    category: 'labor',
    quantity: laborHours,
    unit: 'hours',
    unitPrice: 75,
    totalPrice: laborHours * 75,
  });

  const subtotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);
  const taxRate = 0.16; // 16% VAT
  const taxAmount = subtotal * taxRate;

  const estimate: ConsolidatedEstimate = {
    generatedAt: serverTimestamp() as any,
    generatedBy: userId,
    isStale: false,
    lineItems,
    subtotal,
    taxRate,
    taxAmount,
    total: subtotal + taxAmount,
    currency: 'KES',
  };

  // Save to project
  await updateDoc(doc(db, 'customers', customerId, 'projects', projectId), {
    consolidatedEstimate: estimate,
  });

  return estimate;
}
```

### 2. QuickBooks Invoice Sync

```typescript
export async function createQuickBooksInvoice(
  customerId: string,
  projectId: string,
  estimate: ConsolidatedEstimate
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const functions = getFunctions();
  const createInvoice = httpsCallable(functions, 'createQBInvoice');
  
  const result = await createInvoice({
    customerId,
    projectId,
    lineItems: estimate.lineItems,
    total: estimate.total,
  });

  return result.data as { invoiceId: string; invoiceNumber: string };
}
```

### 3. EstimateTab Component

Add to ProjectView showing:
- Line items table (editable)
- Subtotal, tax, total
- Create Invoice button (QuickBooks)
- Export to PDF

## Validation Checklist

- [ ] Estimate calculates from cutlist data
- [ ] Material pricing pulled from library
- [ ] Line items editable
- [ ] QuickBooks invoice creation works

## Phase 4 Complete!

Proceed to **Phase 5: Production Optimization** outlines.
