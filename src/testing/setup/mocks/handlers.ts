// ============================================================================
// MSW HANDLERS
// DawinOS v2.0 - Testing Strategy
// Mock Service Worker request handlers
// ============================================================================

import { http, HttpResponse, delay } from 'msw';
import { TEST_USERS } from '../../constants/test.constants';

const API_BASE = '/api/v1';

// =============================================================================
// AUTH HANDLERS
// =============================================================================

export const authHandlers = [
  http.post(`${API_BASE}/auth/login`, async () => {
    await delay(100);
    return HttpResponse.json({
      user: TEST_USERS.ADMIN,
      token: 'mock-jwt-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
  }),

  http.post(`${API_BASE}/auth/logout`, async () => {
    await delay(50);
    return HttpResponse.json({ success: true });
  }),

  http.get(`${API_BASE}/auth/me`, async () => {
    await delay(50);
    return HttpResponse.json(TEST_USERS.ADMIN);
  }),

  http.post(`${API_BASE}/auth/refresh`, async () => {
    await delay(50);
    return HttpResponse.json({
      token: 'new-mock-jwt-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
  }),
];

// =============================================================================
// EMPLOYEE HANDLERS
// =============================================================================

export const employeeHandlers = [
  http.get(`${API_BASE}/employees`, async ({ request }) => {
    await delay(100);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');

    const employees = Array.from({ length: 50 }, (_, i) => ({
      id: `emp-${i + 1}`,
      employeeNumber: `EMP-${String(i + 1).padStart(5, '0')}`,
      firstName: `First${i + 1}`,
      lastName: `Last${i + 1}`,
      email: `employee${i + 1}@dawinos.test`,
      status: 'active',
      departmentId: `dept-${(i % 5) + 1}`,
    }));

    const start = (page - 1) * limit;
    const paginatedEmployees = employees.slice(start, start + limit);

    return HttpResponse.json({
      data: paginatedEmployees,
      pagination: {
        page,
        limit,
        total: employees.length,
        totalPages: Math.ceil(employees.length / limit),
      },
    });
  }),

  http.get(`${API_BASE}/employees/:id`, async ({ params }) => {
    await delay(50);

    return HttpResponse.json({
      id: params.id,
      employeeNumber: 'EMP-00001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@dawinos.test',
      phone: '+256700123456',
      status: 'active',
      employmentType: 'permanent',
      salary: { grossAmount: 5000000, currency: 'UGX', frequency: 'monthly' },
    });
  }),

  http.post(`${API_BASE}/employees`, async ({ request }) => {
    await delay(150);

    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json(
      {
        id: crypto.randomUUID(),
        ...body,
        createdAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  http.patch(`${API_BASE}/employees/:id`, async ({ params, request }) => {
    await delay(100);

    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json({
      id: params.id,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/employees/:id`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true });
  }),
];

// =============================================================================
// PAYROLL HANDLERS
// =============================================================================

export const payrollHandlers = [
  http.get(`${API_BASE}/payroll/:period`, async ({ params }) => {
    await delay(100);

    const employees = Array.from({ length: 25 }, (_, i) => {
      const basicSalary = 2000000 + i * 500000;
      const allowances = basicSalary * 0.3;
      const grossSalary = basicSalary + allowances;
      const paye = Math.round(grossSalary * 0.25);
      const nssf = Math.round(grossSalary * 0.05);
      const lst = 45000;
      const netPay = grossSalary - paye - nssf - lst;

      return {
        employeeId: `emp-${i + 1}`,
        employeeName: `Employee ${i + 1}`,
        period: params.period,
        basicSalary,
        allowances,
        grossSalary,
        paye,
        nssf,
        lst,
        netPay,
      };
    });

    return HttpResponse.json({
      data: employees,
      summary: {
        totalEmployees: employees.length,
        totalGross: employees.reduce((sum, e) => sum + e.grossSalary, 0),
        totalDeductions: employees.reduce((sum, e) => sum + e.paye + e.nssf + e.lst, 0),
        totalNet: employees.reduce((sum, e) => sum + e.netPay, 0),
      },
    });
  }),

  http.post(`${API_BASE}/payroll/:period/process`, async () => {
    await delay(500);
    return HttpResponse.json({
      status: 'processed',
      processedAt: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/payroll/:period/approve`, async () => {
    await delay(200);
    return HttpResponse.json({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: TEST_USERS.CEO.id,
    });
  }),
];

// =============================================================================
// STRATEGY HANDLERS
// =============================================================================

export const strategyHandlers = [
  http.get(`${API_BASE}/okrs`, async () => {
    await delay(100);

    const okrs = Array.from({ length: 10 }, (_, i) => ({
      id: `okr-${i + 1}`,
      title: `Objective ${i + 1}`,
      level: i < 3 ? 'company' : i < 7 ? 'department' : 'individual',
      progress: Math.floor(Math.random() * 100),
      status: ['on_track', 'at_risk', 'behind'][Math.floor(Math.random() * 3)],
      keyResults: Array.from({ length: 3 }, (_, j) => ({
        id: `kr-${i + 1}-${j + 1}`,
        title: `Key Result ${j + 1}`,
        target: 100,
        current: Math.floor(Math.random() * 100),
        unit: '%',
      })),
    }));

    return HttpResponse.json({ data: okrs });
  }),

  http.get(`${API_BASE}/kpis`, async () => {
    await delay(100);

    const kpis = Array.from({ length: 15 }, (_, i) => ({
      id: `kpi-${i + 1}`,
      name: `KPI ${i + 1}`,
      category: ['financial', 'operational', 'customer', 'employee'][i % 4],
      target: 100,
      actual: Math.floor(Math.random() * 120),
      unit: ['%', 'UGX', 'count', 'days', 'score'][i % 5],
      trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)],
      frequency: ['daily', 'weekly', 'monthly', 'quarterly'][i % 4],
    }));

    return HttpResponse.json({ data: kpis });
  }),
];

// =============================================================================
// FINANCIAL HANDLERS
// =============================================================================

export const financialHandlers = [
  http.get(`${API_BASE}/accounts`, async () => {
    await delay(100);

    const accounts = Array.from({ length: 20 }, (_, i) => ({
      id: crypto.randomUUID(),
      code: `${1000 + i * 100}`,
      name: `Account ${i + 1}`,
      type: ['asset', 'liability', 'equity', 'revenue', 'expense'][i % 5],
      balance: Math.floor(Math.random() * 100000000),
      currency: 'UGX',
      isActive: true,
    }));

    return HttpResponse.json({ data: accounts });
  }),

  http.get(`${API_BASE}/budgets/:id`, async ({ params }) => {
    await delay(100);

    return HttpResponse.json({
      id: params.id,
      name: 'FY2025 Budget - Operations',
      fiscalYear: '2025',
      status: 'active',
      totalBudget: 2500000000,
      allocated: 1800000000,
      spent: 1200000000,
      lineItems: Array.from({ length: 15 }, (_, i) => ({
        id: crypto.randomUUID(),
        category: `Category ${i + 1}`,
        budgeted: Math.floor(Math.random() * 500000000),
        spent: Math.floor(Math.random() * 400000000),
      })),
    });
  }),
];

// =============================================================================
// CAPITAL HANDLERS
// =============================================================================

export const capitalHandlers = [
  http.get(`${API_BASE}/deals`, async () => {
    await delay(100);

    const deals = Array.from({ length: 15 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Investment Deal ${i + 1}`,
      stage: ['sourcing', 'screening', 'due_diligence', 'negotiation', 'closed', 'rejected'][i % 6],
      amount: Math.floor(Math.random() * 5000000) + 100000,
      currency: 'USD',
      sector: ['technology', 'healthcare', 'agriculture', 'fintech', 'manufacturing'][i % 5],
      probability: Math.floor(Math.random() * 80) + 10,
      expectedClose: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    return HttpResponse.json({ data: deals });
  }),

  http.get(`${API_BASE}/portfolio`, async () => {
    await delay(100);

    const investments = Array.from({ length: 10 }, (_, i) => ({
      id: crypto.randomUUID(),
      companyName: `Portfolio Company ${i + 1}`,
      investmentDate: new Date(Date.now() - Math.random() * 1000 * 24 * 60 * 60 * 1000).toISOString(),
      investedAmount: Math.floor(Math.random() * 2000000) + 100000,
      currentValue: Math.floor(Math.random() * 5000000) + 80000,
      ownership: Math.floor(Math.random() * 25) + 5,
      status: ['active', 'exited', 'written_off'][i % 3 === 0 ? 1 : 0],
      sector: ['technology', 'healthcare', 'agriculture', 'fintech'][i % 4],
    }));

    return HttpResponse.json({
      data: investments,
      summary: {
        totalInvested: investments.reduce((sum, i) => sum + i.investedAmount, 0),
        totalValue: investments.reduce((sum, i) => sum + i.currentValue, 0),
        activeInvestments: investments.filter((i) => i.status === 'active').length,
        irr: 22.5,
      },
    });
  }),
];

// =============================================================================
// INTELLIGENCE HANDLERS
// =============================================================================

export const intelligenceHandlers = [
  http.get(`${API_BASE}/competitors`, async () => {
    await delay(100);

    const competitors = Array.from({ length: 8 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Competitor ${i + 1}`,
      industry: ['manufacturing', 'consulting', 'technology', 'investment'][i % 4],
      website: `https://competitor${i + 1}.com`,
      description: `Description for competitor ${i + 1}`,
      threatLevel: ['low', 'medium', 'high'][i % 3],
      marketShare: Math.floor(Math.random() * 20) + 5,
    }));

    return HttpResponse.json({ data: competitors });
  }),

  http.get(`${API_BASE}/market-trends`, async () => {
    await delay(100);

    const trends = Array.from({ length: 12 }, (_, i) => ({
      id: crypto.randomUUID(),
      title: `Market Trend ${i + 1}`,
      category: ['economic', 'technology', 'regulatory', 'social', 'industry'][i % 5],
      impact: ['positive', 'negative', 'neutral'][i % 3],
      significance: ['low', 'medium', 'high', 'critical'][i % 4],
      description: `Description for trend ${i + 1}`,
      source: `Source ${i + 1}`,
      publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    return HttpResponse.json({ data: trends });
  }),
];

// =============================================================================
// COMBINED HANDLERS
// =============================================================================

export const handlers = [
  ...authHandlers,
  ...employeeHandlers,
  ...payrollHandlers,
  ...strategyHandlers,
  ...financialHandlers,
  ...capitalHandlers,
  ...intelligenceHandlers,
];
