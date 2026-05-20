# Financial Management Module

## Overview

Financial Management provides comprehensive accounting, budgeting, and expense management for Dawin Group subsidiaries.

## Features

### Chart of Accounts
- Account structure management
- Account categories
- Currency support (UGX primary)
- Multi-subsidiary consolidation

### Budget Management
- Annual budget planning
- Department allocations
- Variance tracking
- Approval workflows

### Expense Management
- Expense submission
- Receipt uploads
- Manager approvals
- Reimbursement tracking

### Financial Reporting
- Profit & Loss statements
- Balance sheets
- Cash flow reports
- Custom reports

## Permissions

| Permission | Description |
|------------|-------------|
| `finance:read` | View financial data |
| `finance:write` | Create transactions |
| `finance:admin` | Full financial access |
| `finance:approve` | Approval authority |

## Data Model

### Account

```typescript
interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentId?: string;
  balance: number;
  currency: string;
  isActive: boolean;
  subsidiaryId: string;
}
```

### Budget

```typescript
interface Budget {
  id: string;
  name: string;
  fiscalYear: string;
  departmentId: string;
  departmentHeadId: string;
  totalAmount: number;
  allocated: number;
  spent: number;
  status: 'draft' | 'pending' | 'approved' | 'active';
  lineItems: BudgetLineItem[];
  approvedBy?: string;
  approvedAt?: Date;
  subsidiaryId: string;
}
```

### Expense

```typescript
interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  submittedBy: string;
  submittedAt: Date;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  receipts: string[];
  budgetId?: string;
  approvedBy?: string;
  subsidiaryId: string;
}
```

### Transaction

```typescript
interface Transaction {
  id: string;
  date: Date;
  description: string;
  accountId: string;
  debit: number;
  credit: number;
  reference: string;
  createdBy: string;
  subsidiaryId: string;
  // Immutable - no update/delete
}
```

## Uganda Specifics

### Currency
- Primary: Uganda Shillings (UGX)
- Secondary: USD for international transactions
- Exchange rate management

### Tax
- VAT tracking (18%)
- WHT (Withholding Tax) tracking
- Tax reporting periods

## Integration Points

### HR Central
- Payroll expenses
- Employee cost centers

### CEO Strategy
- Financial KPIs
- Budget alignment with strategy
