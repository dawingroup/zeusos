# HR Central Module

## Overview

HR Central provides comprehensive human resource management for Dawin Group subsidiaries, with Uganda-specific payroll compliance.

## Features

### Employee Management
- Employee lifecycle (hire to retire)
- Personal information management
- Employment history tracking
- Document storage

### Payroll Processing
- Monthly payroll calculation
- Uganda tax compliance (PAYE, NSSF, LST)
- Payslip generation
- Payroll approval workflow

### Leave Management
- Leave request submission
- Manager approval workflow
- Leave balance tracking
- Holiday calendar

### Organization Structure
- Department management
- Position hierarchy
- Reporting relationships
- Cost center assignment

## Uganda Tax Compliance

### PAYE (Pay As You Earn)

| Income Bracket (UGX/month) | Rate |
|---------------------------|------|
| 0 - 235,000 | 0% |
| 235,001 - 335,000 | 10% |
| 335,001 - 410,000 | 20% |
| 410,001 - 10,000,000 | 30% |
| Above 10,000,000 | 40% |

### NSSF (National Social Security Fund)

| Contribution | Rate |
|-------------|------|
| Employee | 5% |
| Employer | 10% |

### LST (Local Service Tax)

Flat rate based on income bracket, ranging from UGX 0 to UGX 100,000 per month.

## Permissions

| Permission | Description |
|------------|-------------|
| `hr:read` | View employee data |
| `hr:write` | Create/update employees |
| `hr:admin` | Full HR access |
| `hr:payroll` | Payroll access |
| `hr:approve` | Approval authority |

## Data Model

### Employee

```typescript
interface Employee {
  id: string;
  employeeNumber: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'active' | 'on_leave' | 'suspended' | 'terminated';
  employmentType: 'permanent' | 'contract' | 'probation' | 'intern';
  departmentId: string;
  positionId: string;
  managerId?: string;
  hireDate: Date;
  salary: {
    grossAmount: number;
    currency: string;
    frequency: string;
  };
  subsidiaryId: string;
  nationalId: string;
  tinNumber: string;
  nssfNumber: string;
  bankDetails: BankDetails;
}
```

### Payroll

```typescript
interface PayrollRecord {
  id: string;
  employeeId: string;
  period: string; // YYYY-MM
  basicSalary: number;
  allowances: Allowance[];
  deductions: Deduction[];
  paye: number;
  nssf: number;
  lst: number;
  netPay: number;
  status: 'draft' | 'processed' | 'approved' | 'paid';
  approvedBy?: string;
  approvedAt?: Date;
}
```

## API Endpoints (via Firestore)

### Collections

- `employees` - Employee records
- `payroll` - Payroll data
- `leave_requests` - Leave requests
- `departments` - Departments
- `positions` - Job positions

## Integration Points

### CEO Strategy
- Employee linked to OKR ownership

### Staff Performance
- Employee linked to goals and reviews

### Financial
- Payroll expenses linked to budgets
