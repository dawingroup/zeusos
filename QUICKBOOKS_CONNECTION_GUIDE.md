# QuickBooks Connection & Configuration Guide

## 🚀 Quick Start

### 1. Connect to QuickBooks

**Navigate to:** Finance → Integrations → QuickBooks Connection Card

**Click:** "Connect QuickBooks" button

**OAuth Flow:**
- Sign in to QuickBooks Online
- Select your company
- Authorize DawinOS access
- Return to DawinOS with confirmation

---

## ⚙️ Configuration Requirements

### Required Account Mappings

Before syncing can begin, you must map your QuickBooks Chart of Accounts:

#### **Navigation:** Finance → Settings → QuickBooks Account Mapping

#### **Required Mappings:**

1. **Accounts Payable** (Type: Liability)
   - Used for: Purchase Order → Bill creation
   - Example: "Accounts Payable (A/P)"

2. **Accounts Receivable** (Type: Asset)
   - Used for: Sales Order → Invoice creation
   - Example: "Accounts Receivable (A/R)"

3. **Inventory Asset** (Type: Asset)
   - Used for: Material consumptions and COGS journal entries
   - Example: "Inventory Asset"

4. **Cost of Goods Sold** (Type: Expense)
   - Used for: Recording manufacturing costs
   - Example: "Cost of Goods Sold"

5. **Sales Revenue** (Type: Income)
   - Used for: Invoice revenue recognition
   - Example: "Sales - Product Income"

#### **Optional Mappings (for Landed Costs):**

- **Shipping Expense** - For freight costs on POs
- **Customs Expense** - For customs duties
- **Duties Expense** - For import duties
- **Insurance Expense** - For shipping insurance
- **Handling Expense** - For handling fees

---

### Service Item Mappings

For Sales Orders and Invoices, you need to create **Service Items** in QuickBooks:

#### **In QuickBooks Online:**

1. Go to **Sales** → **Products and Services**
2. Click **New** → **Service**
3. Create these service items:

| Service Item Name | Category | Income Account |
|-------------------|----------|----------------|
| Custom Furniture - Material | Material | Sales Revenue |
| Custom Furniture - Labor | Labor | Sales Revenue |
| Custom Furniture - Hardware | Hardware | Sales Revenue |
| Custom Furniture - Finishing | Finishing | Sales Revenue |
| Custom Furniture - Other | Other | Sales Revenue |

#### **In DawinOS:**

Navigate to: **Finance → Settings → QuickBooks Configuration**

Map each DawinOS line item category to the corresponding QBO Service Item ID.

---

## 🔄 Testing Your Integration

### Test Environment Recommendation

**⚠️ IMPORTANT:** Test in QuickBooks **Sandbox** environment first!

**Create a Sandbox:**
1. Go to [developer.intuit.com](https://developer.intuit.com/)
2. Sign in and create a Sandbox company
3. Connect DawinOS to the Sandbox
4. Run all test workflows below

### Test Workflows

#### **1. Vendor Sync Test**
```
✅ Create a new supplier in DawinOS
✅ Verify vendor appears in QuickBooks
✅ Update supplier contact info
✅ Verify update syncs to QuickBooks
```

#### **2. Purchase Order → Bill Test**
```
✅ Create a PO with line items and landed costs
✅ Approve the PO
✅ Verify Bill created in QuickBooks with:
   - Correct vendor
   - All line items
   - Landed costs as separate lines
   - Correct total amount
✅ Check PO detail page shows sync status
```

#### **3. Quote → Sales Order Test**
```
✅ Create a client quote with multiple line items
✅ Approve the quote
✅ Verify Sales Order created in QuickBooks with:
   - Correct customer
   - All line items mapped to service items
   - Correct pricing and quantities
✅ Check quote detail page shows sync status
```

#### **4. Manufacturing → Invoice Test**
```
✅ Complete a manufacturing order linked to a project
✅ Verify Invoice created in QuickBooks from Sales Order
✅ Check invoice includes all line items
✅ Verify project consolidatedEstimate updated with invoice ID
```

#### **5. Manufacturing → COGS Test**
```
✅ Complete a manufacturing order with material consumptions
✅ Verify COGS journal entry created in QuickBooks with:
   - Debit to COGS account
   - Credit to Inventory account
   - Correct total amount (materials + labor)
✅ Check MO detail page shows COGS sync status
```

---

## 📊 Monitoring & Troubleshooting

### Sync Dashboard

**Navigate to:** Finance → QuickBooks Sync Dashboard

**Features:**
- Connection status
- Pending syncs count
- Failed sync errors
- Manual retry buttons
- Active workflow display

### Sync Status Badges

Every synced entity (PO, Quote, MO) shows a status badge:
- 🟡 **Pending** - Sync queued or in progress
- 🟢 **Synced** - Successfully synced to QuickBooks
- 🔴 **Error** - Sync failed (click for details and retry)

### Common Issues

#### **"Vendor not found in QuickBooks"**
**Solution:** Ensure supplier has been synced to QuickBooks first. Go to Suppliers → Select supplier → Sync to QuickBooks.

#### **"Account mapping not configured"**
**Solution:** Complete account mapping configuration in Settings → QuickBooks Account Mapping.

#### **"Service item not found"**
**Solution:**
1. Create service items in QuickBooks (see Service Item Mappings above)
2. Configure service item IDs in DawinOS settings

#### **"Material consumption missing cost data"**
**Solution:** Ensure inventory items have cost data recorded. Material consumptions must include `unitCost` when recorded.

#### **"QuickBooks API rate limit exceeded"**
**Solution:** Wait 5 minutes and retry. Consider spacing out bulk sync operations.

---

## 🔐 Security & Access

### Required QuickBooks Permissions

The OAuth connection grants DawinOS:
- Read access to Chart of Accounts, Customers, Vendors
- Write access to create Bills, Sales Orders, Invoices, Journal Entries
- No access to bank accounts, payroll, or tax returns

### Token Security

- Access tokens are **encrypted** using AES-256-GCM before storage
- Tokens auto-refresh when expired
- Refresh tokens valid for 100 days
- Reconnection required after 100 days of inactivity

---

## 🚦 Feature Flags

Control which workflows are active:

**Navigate to:** Finance → Settings → QuickBooks Configuration → Features

### Available Toggles:

- ✅ **Auto-sync Vendors** - Create QB vendors when suppliers are created
- ✅ **Auto-create Bills** - Create Bills when POs are approved
- ✅ **Auto-create Sales Orders** - Create SOs when quotes are approved
- ✅ **Auto-create Invoices** - Create Invoices when MOs complete
- ✅ **Auto-record COGS** - Create COGS journal entries when MOs complete

**Tip:** Disable auto-sync during testing to have manual control over sync operations.

---

## 📋 Production Deployment Checklist

Before going live:

### Pre-Deployment
- [ ] All tests passed in Sandbox environment
- [ ] Account mappings configured and validated
- [ ] Service items created in QuickBooks
- [ ] Finance team trained on sync workflows
- [ ] Error handling and retry procedures documented

### Initial Production Connection
- [ ] Connect to **Production** QuickBooks account
- [ ] Verify connection status in dashboard
- [ ] Re-configure account mappings (production may have different account IDs)
- [ ] Re-configure service item mappings

### Initial Data Sync
- [ ] Sync all existing suppliers to QuickBooks vendors
- [ ] Review any supplier sync errors
- [ ] Backfill any pending POs that need bills created
- [ ] Test one complete workflow end-to-end

### Ongoing Monitoring
- [ ] Check sync dashboard daily for errors
- [ ] Set up alerts for sync failures (future enhancement)
- [ ] Monitor QuickBooks API usage (stays within limits)
- [ ] Review business events for sync audit trail

---

## 🆘 Support & Resources

### Documentation
- **QuickBooks API Docs:** [developer.intuit.com/app/developer/qbo/docs](https://developer.intuit.com/app/developer/qbo/docs)
- **DawinOS Finance Module:** [internal docs link]

### Getting Help
- **Sync Errors:** Check business_events collection in Firestore for detailed logs
- **Configuration Issues:** Review QUICKBOOKS_CONNECTION_GUIDE.md
- **Technical Support:** Contact development team

### Useful Queries

**View sync errors in Firestore:**
```
business_events collection
→ Filter by type = 'bill_sync_error' | 'sales_order_sync_error' | 'cogs_sync_error'
→ Order by timestamp desc
```

**Check connection status:**
```
integrations/quickbooks document
→ Fields: connected_at, realm_id, expires_in
```

---

## 🎯 Next Steps: Strategic Features (Phases 7-11)

After the core integration is stable, consider implementing:

### Phase 7: Financial Reporting (Months 7-9)
- Drag-and-drop report builder
- 90+ chart variations
- Branded PDF exports
- Auto-updating dashboards

### Phase 8: Forecasting (Months 10-12)
- Three-way forecasting (P&L, Balance Sheet, Cash Flow)
- Scenario planning
- Microforecasts for discrete events
- Business roadmap timeline

### Phase 9: Analysis (Months 13-15)
- 50+ pre-built KPIs
- Custom KPI builder
- Cash flow waterfall analysis
- Goalseek tool
- Benchmarking

See full strategic plan in your plan file: `/Users/danielonzimai/.claude/plans/immutable-waddling-candle.md`

---

**Ready to connect!** 🚀

Navigate to **Finance → Integrations** and click "Connect QuickBooks" to get started.
