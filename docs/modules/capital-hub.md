# Capital Hub Module

## Overview

Capital Hub manages investment deal pipeline, portfolio tracking, and investor relations for Dawin Capital.

## Features

### Deal Pipeline
- Deal sourcing and screening
- Due diligence tracking
- Investment committee workflow
- Deal closing management

### Portfolio Management
- Portfolio company tracking
- Valuation updates
- Performance monitoring
- Exit planning

### Investor CRM
- Investor profiles
- Communication tracking
- Reporting schedules
- Fund commitments

### Capital Allocation
- Fund management
- Deployment tracking
- Reserve management
- Distribution planning

## Deal Stages

```
Sourcing → Screening → Due Diligence → Negotiation → Closed/Rejected
```

## Permissions

| Permission | Description |
|------------|-------------|
| `capital:read` | View deal data |
| `capital:write` | Create/update deals |
| `capital:admin` | Full capital access |
| `capital:approve` | Investment approval |

## Data Model

### Deal

```typescript
interface Deal {
  id: string;
  name: string;
  company: string;
  sector: string;
  stage: 'sourcing' | 'screening' | 'due_diligence' | 'negotiation' | 'closed' | 'rejected';
  amount: number;
  currency: string;
  valuation: number;
  ownership: number;
  probability: number;
  expectedCloseDate: Date;
  leadPartner: string;
  status: 'active' | 'on_hold' | 'closed' | 'rejected';
  approvedBy?: string;
  subsidiaryId: string;
}
```

### Portfolio Company

```typescript
interface PortfolioCompany {
  id: string;
  name: string;
  sector: string;
  investmentDate: Date;
  investedAmount: number;
  currentValue: number;
  ownership: number;
  status: 'active' | 'exited' | 'written_off';
  irr: number;
  multiple: number;
  boardSeat: boolean;
  subsidiaryId: string;
}
```

### Investor

```typescript
interface Investor {
  id: string;
  name: string;
  type: 'institutional' | 'family_office' | 'hnwi' | 'corporate';
  commitment: number;
  contributed: number;
  distributed: number;
  contact: ContactInfo;
  relationship: string;
  subsidiaryId: string;
}
```

## Integration Points

### Financial
- Investment transactions
- Portfolio valuations
- Fund accounting

### Market Intelligence
- Sector analysis
- Competitor investments
- Market trends
