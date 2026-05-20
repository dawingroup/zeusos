# Purchase Order Enhancement - UI Components

This document describes the UI components built for the Purchase Order Enhancement & Integration.

---

## Components Overview

### 1. **DeliveryRecordingForm**
**Path**: `src/subsidiaries/advisory/matflow/components/procurement/DeliveryRecordingForm.tsx`

**Purpose**: Allow users to record material deliveries and link them to purchase orders.

**Features**:
- Select purchase order from dropdown
- Choose PO item to link delivery to
- View current PO quantities and fulfillment progress
- Record delivery details:
  - Quantity received
  - Quantity rejected (auto-calculates accepted)
  - Delivery date
  - Delivery condition (good, partial, damaged, rejected)
  - External reference (delivery note number)
  - Delivery location
  - Notes
- Real-time validation warnings (e.g., over-delivery alerts)
- Auto-updates PO status after delivery linkage

**Props**:
```typescript
interface DeliveryRecordingFormProps {
  projectId: string;
  userId: string;
  onSuccess?: (deliveryId: string) => void;
  onCancel?: () => void;
  preselectedPOId?: string;
}
```

**Usage Example**:
```tsx
import { DeliveryRecordingForm } from '@matflow/components/procurement';

<DeliveryRecordingForm
  projectId="proj-123"
  userId="user-456"
  onSuccess={(deliveryId) => {
    console.log('Delivery recorded:', deliveryId);
    // Refresh PO list, show success message, etc.
  }}
  onCancel={() => {
    // Close modal/form
  }}
  preselectedPOId="po-789" // Optional: pre-select a PO
/>
```

**UI Layout**:
1. **PO Selection Section**:
   - Dropdown to select PO
   - Display PO details (supplier, status, total amount, items)
   - Dropdown to select PO item
   - Show item details with fulfillment progress bar

2. **Delivery Quantities Section**:
   - Quantity received input
   - Quantity rejected input (defaults to 0)
   - Quantity accepted (auto-calculated, read-only)
   - Warning if over-delivery detected

3. **Delivery Details Section**:
   - Delivery date picker
   - Delivery condition dropdown
   - External reference input
   - Delivery location input
   - Notes textarea

4. **Form Actions**:
   - Cancel button
   - Submit button (disabled until PO item selected)

---

### 2. **POPickerForAccountability**
**Path**: `src/subsidiaries/advisory/matflow/components/procurement/POPickerForAccountability.tsx`

**Purpose**: Component to select and link purchase orders to accountability expenses.

**Features**:
- Search/filter POs by number, supplier, or material
- Display PO list with status indicators
- Show PO items with details
- **Real-time variance calculation**:
  - Compare expense amount vs PO item amount
  - Show variance percentage
  - Color-coded warnings:
    - Green: <2% variance (match)
    - Yellow: 2-5% variance (minor)
    - Red: ≥5% variance (investigation required)
- Display delivery progress for each item
- Highlight investigation-triggering variances

**Props**:
```typescript
interface POPickerProps {
  projectId: string;
  materialId?: string;
  materialName?: string;
  expenseAmount: number;
  expenseQuantity?: number;
  onSelect: (selection: POSelectionResult) => void;
  onCancel: () => void;
  value?: POSelectionResult;
}

interface POSelectionResult {
  purchaseOrderId: string;
  poItemId: string;
  poItemLineNumber: number;
  expectedAmount: number;
  expectedQuantity: number;
  unitPrice: number;
}
```

**Usage Example**:
```tsx
import { POPickerForAccountability } from '@matflow/components/procurement';

<POPickerForAccountability
  projectId="proj-123"
  expenseAmount={3500000}
  expenseQuantity={100}
  materialName="Cement - 50kg bags"
  onSelect={(selection) => {
    // Update accountability expense with PO reference
    setExpense({
      ...expense,
      purchaseOrderId: selection.purchaseOrderId,
      poItemId: selection.poItemId,
      poItemLineNumber: selection.poItemLineNumber
    });
  }}
  onCancel={() => {
    // Close modal
  }}
/>
```

**UI Layout**:
1. **Header**:
   - Title: "Link to Purchase Order"
   - Expense summary (amount, quantity, material)

2. **Search Bar**:
   - Full-text search across PO numbers, suppliers, materials

3. **Split View**:
   - **Left Panel**: PO List
     - PO number
     - Supplier name
     - Status badge
     - Item count
     - Total amount

   - **Right Panel**: PO Items (when PO selected)
     - Material name
     - Quantity and unit price
     - Total amount
     - Delivery progress bar
     - **Variance indicator badge**
     - Variance details (amount, percentage)
     - Investigation warning for ≥5%

4. **Footer**:
   - Selected item indicator
   - Cancel button
   - "Link to PO" button (enabled when item selected)

---

### 3. **AutoPOGenerationDialog**
**Path**: `src/subsidiaries/advisory/matflow/components/requisitions/AutoPOGenerationDialog.tsx`

**Purpose**: Display summary of automatically generated purchase orders after requisition approval.

**Features**:
- Show generation status (success/warnings/errors)
- Display statistics:
  - Total POs generated
  - Total items
  - Total amount
- Supplier breakdown with:
  - Supplier name
  - PO number (clickable to view)
  - Item count
  - Total amount
- Highlight unassigned items requiring action
- List errors and warnings
- Provide next steps guidance

**Props**:
```typescript
interface AutoPOGenerationDialogProps {
  result: POGenerationResult;
  requisitionNumber: string;
  onViewPO?: (poId: string) => void;
  onAssignSuppliers?: () => void;
  onClose: () => void;
}
```

**Usage Example**:
```tsx
import { AutoPOGenerationDialog } from '@matflow/components/requisitions';

// After approving requisition and generating POs
const result = await autoPOGenerationService.generatePOsFromRequisition(reqId, userId);

<AutoPOGenerationDialog
  result={result}
  requisitionNumber="REQ-2026-001"
  onViewPO={(poId) => {
    // Navigate to PO details page
    navigate(`/procurement/pos/${poId}`);
  }}
  onAssignSuppliers={() => {
    // Open supplier assignment dialog
  }}
  onClose={() => {
    // Close dialog, refresh requisition list
  }}
/>
```

**UI Layout**:
1. **Header** (color-coded by status):
   - Status icon (✅ success, ⚠️ warnings, ❌ errors)
   - Title: "Purchase Orders Generated"
   - Requisition number

2. **Statistics Cards**:
   - Total POs
   - Total Items
   - Total Amount

3. **Errors Section** (if any):
   - Red background
   - List of errors

4. **Warnings Section** (if any):
   - Yellow background
   - List of warnings

5. **Supplier Breakdown**:
   - Card for each supplier/PO
   - Supplier name
   - PO number (link to view)
   - Item count
   - Total amount
   - **Special treatment for "unassigned"**:
     - Yellow background
     - "Action Required" badge
     - Warning message

6. **Next Steps**:
   - Blue info box
   - Numbered list of actions to take

7. **Footer**:
   - "Assign Suppliers Now" link (if unassigned items)
   - "View First PO" button
   - "Done" button

---

### 4. **POFulfillmentDashboard**
**Path**: `src/subsidiaries/advisory/matflow/components/procurement/POFulfillmentDashboard.tsx`

**Purpose**: Dashboard to monitor purchase order fulfillment status across projects.

**Features**:
- Statistics overview:
  - Total POs
  - Approved POs
  - In-progress POs
  - Fulfilled POs
  - Fulfillment rate
  - Total value
- Filter by:
  - Status (all, approved, partially_fulfilled, fulfilled, cancelled)
  - Search query (PO number, supplier, material)
- PO list with:
  - Overall fulfillment progress bar
  - Status badges
  - Expandable item details
- Item-level tracking:
  - Ordered vs delivered quantities
  - Individual progress bars
  - "Record Delivery" button for unfulfilled items

**Props**:
```typescript
interface POFulfillmentDashboardProps {
  projectId?: string;
  onRecordDelivery?: (poId: string, itemId: string) => void;
  onViewPODetails?: (poId: string) => void;
}
```

**Usage Example**:
```tsx
import { POFulfillmentDashboard } from '@matflow/components/procurement';

<POFulfillmentDashboard
  projectId="proj-123" // Optional: filter to specific project
  onRecordDelivery={(poId, itemId) => {
    // Open DeliveryRecordingForm with preselected PO and item
    setShowDeliveryForm(true);
    setSelectedPOId(poId);
    setSelectedItemId(itemId);
  }}
  onViewPODetails={(poId) => {
    // Navigate to PO details page
    navigate(`/procurement/pos/${poId}`);
  }}
/>
```

**UI Layout**:
1. **Header**:
   - Title: "PO Fulfillment Dashboard"
   - Subtitle

2. **Statistics Cards** (4 cards):
   - Total POs (with total value)
   - Approved (awaiting delivery)
   - In Progress (partially fulfilled)
   - Fulfilled (with fulfillment rate %)

3. **Filters**:
   - Search input (full-width)
   - Status dropdown
   - Refresh button

4. **PO List**:
   - **Collapsed View**:
     - PO number + status badge
     - Supplier, item count, total amount
     - Overall fulfillment progress bar
     - "View Details" button
     - Expand/collapse arrow

   - **Expanded View**:
     - "Items (N)" heading
     - List of items with:
       - Material name
       - Ordered/delivered/remaining quantities
       - Value
       - Item-level progress bar
       - "Record Delivery" button (if not fully delivered)

5. **Empty State** (if no POs):
   - Icon
   - "No purchase orders found"
   - "Try adjusting your filters"

---

## Integration Guide

### Step 1: Import Components

```typescript
// In your page/container component
import {
  DeliveryRecordingForm,
  POPickerForAccountability,
  POFulfillmentDashboard
} from '@subsidiaries/advisory/matflow/components/procurement';

import { AutoPOGenerationDialog } from '@subsidiaries/advisory/matflow/components/requisitions';
```

### Step 2: Add to Routes

```typescript
// In your routing configuration
<Route path="/procurement/deliveries/new" element={<DeliveryRecordingFormPage />} />
<Route path="/procurement/fulfillment" element={<POFulfillmentDashboard />} />
```

### Step 3: Wire Up Accountability Form

```typescript
// In accountability expense form
const [showPOPicker, setShowPOPicker] = useState(false);
const [selectedPO, setSelectedPO] = useState<POSelectionResult | null>(null);

<button onClick={() => setShowPOPicker(true)}>
  Link to Purchase Order
</button>

{showPOPicker && (
  <POPickerForAccountability
    projectId={projectId}
    expenseAmount={expense.amount}
    expenseQuantity={expense.quantityExecuted}
    onSelect={(selection) => {
      setSelectedPO(selection);
      setExpense({
        ...expense,
        purchaseOrderId: selection.purchaseOrderId,
        poItemId: selection.poItemId
      });
      setShowPOPicker(false);
    }}
    onCancel={() => setShowPOPicker(false)}
  />
)}
```

### Step 4: Integrate Auto-Generation

```typescript
// In requisition approval flow
const handleApprove = async () => {
  // Approve requisition
  await requisitionService.approveRequisition(reqId, notes, userId);

  // Trigger auto-PO generation
  const result = await autoPOGenerationService.generatePOsFromRequisition(reqId, userId);

  // Show result dialog
  setGenerationResult(result);
  setShowAutoGenDialog(true);
};

{showAutoGenDialog && generationResult && (
  <AutoPOGenerationDialog
    result={generationResult}
    requisitionNumber={requisition.requisitionNumber}
    onViewPO={(poId) => navigate(`/procurement/pos/${poId}`)}
    onClose={() => setShowAutoGenDialog(false)}
  />
)}
```

---

## Styling Requirements

### Tailwind CSS Classes

All components use Tailwind CSS for styling. Ensure your project has:

```bash
npm install tailwindcss @tailwindcss/forms
```

### Color Palette Used

- **Primary**: Blue (bg-blue-600, text-blue-600, etc.)
- **Success**: Green (bg-green-600, text-green-600, etc.)
- **Warning**: Yellow (bg-yellow-600, text-yellow-600, etc.)
- **Error**: Red (bg-red-600, text-red-600, etc.)
- **Neutral**: Gray (bg-gray-50, bg-gray-100, etc.)

### Progress Bar Colors

- **Blue**: Not started (0% delivery)
- **Yellow**: In progress (1-99% delivery)
- **Green**: Complete (100% delivery)

### Variance Colors

- **Green** (<2%): Good match
- **Yellow** (2-5%): Minor variance
- **Red** (≥5%): Investigation required

---

## Accessibility

All components follow accessibility best practices:

- ✅ Semantic HTML elements
- ✅ ARIA labels where needed
- ✅ Keyboard navigation support
- ✅ Focus management
- ✅ Screen reader friendly
- ✅ Color contrast compliance

---

## Responsive Design

All components are responsive:

- **Desktop** (≥1024px): Full feature set
- **Tablet** (768-1023px): Adjusted layouts
- **Mobile** (≤767px): Simplified views

**Note**: POPickerForAccountability uses a modal overlay, so it's optimized for larger screens. Consider a simplified mobile flow.

---

## Dependencies

Required dependencies:
- `react` (^18.2.0)
- `react-hook-form` (^7.69.0) - for forms
- `firebase/firestore` (^10.14.1) - for data
- `tailwindcss` (^3.x) - for styling

---

## Testing

### Unit Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { DeliveryRecordingForm } from './DeliveryRecordingForm';

describe('DeliveryRecordingForm', () => {
  it('should render PO selection', () => {
    render(<DeliveryRecordingForm projectId="proj-123" userId="user-456" />);
    expect(screen.getByText('Purchase Order *')).toBeInTheDocument();
  });

  it('should auto-calculate accepted quantity', () => {
    // Test auto-calculation logic
  });
});
```

### Integration Tests

```typescript
// Test full workflow
it('should complete delivery recording flow', async () => {
  // 1. Select PO
  // 2. Select item
  // 3. Enter quantities
  // 4. Submit
  // 5. Verify delivery created
  // 6. Verify PO updated
});
```

---

## Troubleshooting

### Issue: Components not rendering

**Solution**: Check imports and ensure paths are correct:
```typescript
import { DeliveryRecordingForm } from '@subsidiaries/advisory/matflow/components/procurement';
```

### Issue: Styling not applied

**Solution**: Ensure Tailwind CSS is configured in `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  // ...
};
```

### Issue: TypeScript errors

**Solution**: Ensure types are imported:
```typescript
import type { POSelectionResult } from '@matflow/components/procurement';
```

### Issue: Firestore permission errors

**Solution**: Ensure user has read access to purchase orders collection:
```javascript
// Firestore rules
match /advisoryPlatform/matflow/purchaseOrders/{poId} {
  allow read: if request.auth != null;
}
```

---

## Future Enhancements

Planned improvements:
1. **Bulk delivery recording** - Record multiple deliveries at once
2. **QR code scanning** - Scan delivery notes to auto-populate
3. **Photo attachments** - Upload delivery photos inline
4. **Mobile optimization** - Dedicated mobile layouts
5. **Offline support** - Record deliveries offline with sync
6. **Export functionality** - Export fulfillment reports

---

## Support

For questions or issues:
- Check implementation plan: `/Users/ofd/.claude/plans/validated-hatching-conway.md`
- Review test files for usage examples
- Contact development team
