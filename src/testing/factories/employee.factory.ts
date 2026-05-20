// ============================================================================
// EMPLOYEE FACTORY
// DawinOS v2.0 - Testing Strategy
// Test data factory for employee entities
// ============================================================================

import type { Factory, FactoryOptions } from '../types/test.types';
import { TEST_SUBSIDIARIES, UGANDA_TEST_DATA } from '../constants/test.constants';

// =============================================================================
// EMPLOYEE TYPE (simplified for testing)
// =============================================================================

export interface TestEmployee {
  id: string;
  employeeNumber: string;
  userId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  employmentType: 'permanent' | 'contract' | 'probation' | 'intern';
  status: 'active' | 'on_leave' | 'suspended' | 'terminated';
  departmentId: string;
  positionId: string;
  managerId?: string;
  dateOfBirth: Date;
  hireDate: Date;
  probationEndDate?: Date;
  contractEndDate?: Date;
  terminationDate?: Date;
  terminationReason?: string;
  salary: {
    grossAmount: number;
    currency: string;
    frequency: string;
  };
  workLocation: string;
  subsidiaryId: string;
  costCenterId: string;
  nationalId: string;
  tinNumber: string;
  nssfNumber: string;
  bankDetails: {
    bankName: string;
    branchName: string;
    accountNumber: string;
    accountName: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  isManager?: boolean;
  directReports?: number;
  isExecutive?: boolean;
  jobGrade?: string;
  currentLeaveId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// =============================================================================
// SEQUENCE COUNTER
// =============================================================================

let employeeSequence = 0;

function getNextSequence(): number {
  return ++employeeSequence;
}

export function resetEmployeeSequence(): void {
  employeeSequence = 0;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomDate(yearsBack: number): Date {
  const now = new Date();
  const past = new Date(now.getFullYear() - yearsBack, 0, 1);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

function randomBirthDate(): Date {
  const now = new Date();
  const minAge = 22;
  const maxAge = 55;
  const age = randomInt(minAge, maxAge);
  return new Date(now.getFullYear() - age, randomInt(0, 11), randomInt(1, 28));
}

// =============================================================================
// EMPLOYEE FACTORY
// =============================================================================

export const employeeFactory: Factory<TestEmployee> = {
  build: (options?: FactoryOptions<TestEmployee>): TestEmployee => {
    const seq = options?.sequence ?? getNextSequence();
    const traits = options?.traits ?? [];

    const firstName = `First${seq}`;
    const lastName = `Last${seq}`;
    const email = `employee${seq}@dawinos.test`;

    const baseEmployee: TestEmployee = {
      id: generateUUID(),
      employeeNumber: `EMP-${String(seq).padStart(5, '0')}`,
      userId: generateUUID(),
      firstName,
      lastName,
      middleName: undefined,
      email,
      phone: `+256${randomInt(700000000, 799999999)}`,
      alternatePhone: undefined,

      employmentType: randomElement(['permanent', 'contract', 'probation', 'intern'] as const),
      status: 'active',
      departmentId: generateUUID(),
      positionId: generateUUID(),
      managerId: undefined,

      dateOfBirth: randomBirthDate(),
      hireDate: randomDate(5),
      probationEndDate: undefined,
      contractEndDate: undefined,

      salary: {
        grossAmount: randomInt(1500000, 15000000),
        currency: 'UGX',
        frequency: 'monthly',
      },

      workLocation: randomElement(Object.values(UGANDA_TEST_DATA.LOCATIONS)).name,

      subsidiaryId: TEST_SUBSIDIARIES.DAWIN_GROUP.id,
      costCenterId: generateUUID(),

      nationalId: `CM${randomInt(10000000000000, 99999999999999)}`.slice(0, 14),
      tinNumber: String(randomInt(1000000000, 9999999999)),
      nssfNumber: `NSSF${randomInt(1000000000, 9999999999)}`,

      bankDetails: {
        bankName: randomElement(['Stanbic Bank', 'DFCU Bank', 'Centenary Bank', 'Equity Bank']),
        branchName: randomElement(['Kampala', 'Garden City', 'Acacia Mall', 'Forest Mall']),
        accountNumber: String(randomInt(1000000000000, 9999999999999)),
        accountName: `${firstName} ${lastName}`,
      },

      emergencyContact: {
        name: `Emergency Contact ${seq}`,
        relationship: randomElement(['Spouse', 'Parent', 'Sibling', 'Friend']),
        phone: `+256${randomInt(700000000, 799999999)}`,
      },

      createdAt: randomDate(2),
      updatedAt: new Date(),
      createdBy: 'system',
    };

    // Apply traits
    if (traits.includes('manager')) {
      baseEmployee.isManager = true;
      baseEmployee.directReports = randomInt(3, 12);
    }

    if (traits.includes('executive')) {
      baseEmployee.salary.grossAmount = randomInt(20000000, 50000000);
      baseEmployee.jobGrade = 'E1';
      baseEmployee.isExecutive = true;
    }

    if (traits.includes('contractor')) {
      baseEmployee.employmentType = 'contract';
      baseEmployee.contractEndDate = new Date(Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000);
    }

    if (traits.includes('probation')) {
      baseEmployee.employmentType = 'probation';
      baseEmployee.probationEndDate = new Date(Date.now() + randomInt(30, 90) * 24 * 60 * 60 * 1000);
    }

    if (traits.includes('terminated')) {
      baseEmployee.status = 'terminated';
      baseEmployee.terminationDate = randomDate(0.5);
      baseEmployee.terminationReason = randomElement(['Resignation', 'End of Contract', 'Redundancy']);
    }

    if (traits.includes('on_leave')) {
      baseEmployee.status = 'on_leave';
      baseEmployee.currentLeaveId = generateUUID();
    }

    // Apply overrides
    if (options?.overrides) {
      Object.assign(baseEmployee, options.overrides);
    }

    return baseEmployee;
  },

  buildList: (count: number, options?: FactoryOptions<TestEmployee>): TestEmployee[] => {
    return Array.from({ length: count }, (_, index) =>
      employeeFactory.build({ ...options, sequence: (options?.sequence ?? 0) + index + 1 })
    );
  },

  create: async (options?: FactoryOptions<TestEmployee>): Promise<TestEmployee> => {
    const employee = employeeFactory.build(options);
    return employee;
  },

  createList: async (count: number, options?: FactoryOptions<TestEmployee>): Promise<TestEmployee[]> => {
    const employees = employeeFactory.buildList(count, options);
    return employees;
  },
};

// =============================================================================
// PAYROLL FACTORY
// =============================================================================

export interface TestPayrollData {
  employeeId: string;
  period: string;
  basicSalary: number;
  allowances: Array<{ name: string; amount: number }>;
  deductions: Array<{ name: string; amount: number }>;
  paye: number;
  nssf: number;
  lst: number;
  netPay: number;
}

function calculatePAYE(grossSalary: number): number {
  let paye = 0;
  let remainingSalary = grossSalary;

  for (const bracket of UGANDA_TEST_DATA.PAYE_BRACKETS) {
    if (remainingSalary <= 0) break;

    const taxableInBracket = Math.min(remainingSalary, bracket.max - bracket.min);

    if (taxableInBracket > 0) {
      paye += taxableInBracket * bracket.rate;
      remainingSalary -= taxableInBracket;
    }
  }

  return Math.round(paye);
}

function calculateLST(grossSalary: number): number {
  for (const bracket of UGANDA_TEST_DATA.LST_BRACKETS) {
    if (grossSalary >= bracket.min && grossSalary <= bracket.max) {
      return bracket.amount;
    }
  }
  return 0;
}

export const payrollFactory: Factory<TestPayrollData> = {
  build: (options?: FactoryOptions<TestPayrollData>): TestPayrollData => {
    const basicSalary = options?.overrides?.basicSalary ?? randomInt(1500000, 10000000);

    const allowances = [
      { name: 'Housing', amount: Math.round(basicSalary * 0.15) },
      { name: 'Transport', amount: Math.round(basicSalary * 0.1) },
      { name: 'Medical', amount: Math.round(basicSalary * 0.05) },
    ];

    const grossSalary = basicSalary + allowances.reduce((sum, a) => sum + a.amount, 0);

    const paye = calculatePAYE(grossSalary);
    const nssf = Math.round(grossSalary * UGANDA_TEST_DATA.NSSF.EMPLOYEE_RATE);
    const lst = calculateLST(grossSalary);

    const deductions = [
      { name: 'PAYE', amount: paye },
      { name: 'NSSF', amount: nssf },
      { name: 'LST', amount: lst },
    ];

    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = grossSalary - totalDeductions;

    return {
      employeeId: options?.overrides?.employeeId ?? generateUUID(),
      period: options?.overrides?.period ?? new Date().toISOString().slice(0, 7),
      basicSalary,
      allowances,
      deductions,
      paye,
      nssf,
      lst,
      netPay,
      ...options?.overrides,
    };
  },

  buildList: (count: number, options?: FactoryOptions<TestPayrollData>): TestPayrollData[] => {
    return Array.from({ length: count }, () => payrollFactory.build(options));
  },

  create: async (options?: FactoryOptions<TestPayrollData>): Promise<TestPayrollData> => {
    return payrollFactory.build(options);
  },

  createList: async (count: number, options?: FactoryOptions<TestPayrollData>): Promise<TestPayrollData[]> => {
    return payrollFactory.buildList(count, options);
  },
};
