/**
 * Test Data Factory
 * Generates test data for all entity types
 */

import { generateTestId } from '../utils/test-environment';

// ============================================================================
// Types for test data
// ============================================================================

export type EngagementType = 'infrastructure' | 'investment' | 'advisory';
export type EngagementStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type FundingType = 'grant' | 'government' | 'private' | 'mixed' | 'self_funded';
export type ProjectStatus = 'planning' | 'procurement' | 'construction' | 'completed' | 'on_hold';
export type ImplementationType = 'contractor' | 'direct';
export type PaymentStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
export type PaymentType = 'ipc' | 'requisition' | 'advance' | 'retention_release' | 'final';
export type DealStage = 'origination' | 'screening' | 'due_diligence' | 'structuring' | 'negotiation' | 'closing' | 'closed' | 'declined';
export type BOQStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'superseded';

// ============================================================================
// Helper functions
// ============================================================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function pastDate(daysBack: number = 365): Date {
  const now = new Date();
  return new Date(now.getTime() - randomInt(1, daysBack) * 24 * 60 * 60 * 1000);
}

function futureDate(daysAhead: number = 365): Date {
  const now = new Date();
  return new Date(now.getTime() + randomInt(1, daysAhead) * 24 * 60 * 60 * 1000);
}

function generateCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// ============================================================================
// Test Data Factory
// ============================================================================

export class TestDataFactory {
  // --------------------------------------------------------------------------
  // Client Factories
  // --------------------------------------------------------------------------

  static createClient(overrides: Record<string, any> = {}): Record<string, any> {
    const id = generateTestId('client');
    const types = ['organization', 'government', 'ngo', 'private', 'individual'];
    
    return {
      id,
      name: `Test Client ${id.slice(-6)}`,
      type: randomElement(types),
      status: 'active',
      primaryContact: {
        name: `Contact Person ${randomInt(1, 100)}`,
        email: `contact${randomInt(1, 1000)}@testclient.com`,
        phone: `+256${randomInt(700000000, 799999999)}`,
        role: randomElement(['CEO', 'Director', 'Manager', 'Coordinator']),
      },
      address: {
        street: `${randomInt(1, 500)} Test Street`,
        city: randomElement(['Kampala', 'Jinja', 'Mbarara', 'Gulu', 'Mbale']),
        region: randomElement(['Central', 'Eastern', 'Western', 'Northern']),
        country: 'Uganda',
        postalCode: `${randomInt(10000, 99999)}`,
      },
      metadata: {
        industry: randomElement(['Healthcare', 'Education', 'Agriculture', 'Energy', 'Finance']),
        size: randomElement(['small', 'medium', 'large', 'enterprise']),
        source: randomElement(['referral', 'direct', 'partner', 'marketing']),
      },
      createdAt: pastDate(180),
      updatedAt: new Date(),
      createdBy: generateTestId('user'),
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // Engagement Factories
  // --------------------------------------------------------------------------

  static createEngagement(overrides: Record<string, any> = {}): Record<string, any> {
    const id = generateTestId('engagement');
    const type: EngagementType = overrides.type || randomElement(['infrastructure', 'investment', 'advisory']);
    const statuses: EngagementStatus[] = ['draft', 'active', 'on_hold', 'completed', 'cancelled'];
    const fundingTypes: FundingType[] = ['grant', 'government', 'private', 'mixed'];
    const totalBudget = randomInt(100000000, 5000000000);

    return {
      id,
      clientId: overrides.clientId || generateTestId('client'),
      name: `${type === 'infrastructure' ? 'Construction Project' : type === 'investment' ? 'Investment Deal' : 'Advisory Mandate'} ${id.slice(-6)}`,
      type,
      status: overrides.status || randomElement(statuses),
      startDate: pastDate(365),
      endDate: futureDate(365),
      description: `Test engagement description for ${id}`,
      funding: {
        type: randomElement(fundingTypes),
        sources: [{
          id: generateTestId('source'),
          name: randomElement(['AMH Foundation', 'World Bank', 'GoU', 'Private Investor']),
          type: 'grant',
          amount: totalBudget,
          currency: 'UGX',
          conditions: 'Standard grant conditions apply',
        }],
        totalBudget,
        currency: 'UGX',
      },
      team: {
        leadId: generateTestId('user'),
        members: [{
          userId: generateTestId('user'),
          role: 'project_manager',
          permissions: ['read', 'write', 'approve'],
          assignedAt: pastDate(30),
        }],
      },
      metadata: {
        region: randomElement(['Central', 'Eastern', 'Western', 'Northern']),
        sector: randomElement(['healthcare', 'education', 'water', 'energy', 'transport']),
        tags: ['test', 'automated'],
      },
      createdAt: pastDate(180),
      updatedAt: new Date(),
      createdBy: generateTestId('user'),
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // Project Factories
  // --------------------------------------------------------------------------

  static createProject(engagementId: string, overrides: Record<string, any> = {}): Record<string, any> {
    const id = generateTestId('project');
    const statuses: ProjectStatus[] = ['planning', 'procurement', 'construction', 'completed', 'on_hold'];
    const contractValue = randomInt(100000000, 2000000000);
    const certified = randomInt(0, contractValue * 0.8);
    const paid = randomInt(0, certified * 0.9);

    return {
      id,
      engagementId,
      name: `${randomElement(['Hospital', 'School', 'Clinic', 'Water System', 'Road'])} Construction ${id.slice(-6)}`,
      code: generateCode('PRJ'),
      status: overrides.status || randomElement(statuses),
      implementationType: overrides.implementationType || randomElement(['contractor', 'direct'] as ImplementationType[]),
      location: {
        district: randomElement(['Kampala', 'Wakiso', 'Jinja', 'Mbale', 'Mbarara']),
        subcounty: `Subcounty ${randomInt(1, 10)}`,
        village: `Village ${randomInt(1, 20)}`,
        coordinates: {
          latitude: randomFloat(0, 4),
          longitude: randomFloat(29, 35),
        },
      },
      contractor: {
        id: generateTestId('contractor'),
        name: `Test Contractor ${randomInt(1, 100)}`,
        contractNumber: generateCode('CON'),
        contractValue,
        startDate: pastDate(180),
        endDate: futureDate(180),
      },
      financials: {
        contractValue,
        certified,
        paid,
        retention: Math.floor(certified * 0.05),
        variations: randomInt(0, contractValue * 0.1),
      },
      progress: {
        physical: randomInt(0, 100),
        financial: Math.floor((paid / contractValue) * 100),
        lastUpdated: new Date(),
      },
      milestones: [],
      createdAt: pastDate(180),
      updatedAt: new Date(),
      createdBy: generateTestId('user'),
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // Payment Factories
  // --------------------------------------------------------------------------

  static createPayment(
    engagementId: string,
    projectId: string,
    overrides: Record<string, any> = {}
  ): Record<string, any> {
    const id = generateTestId('payment');
    const paymentTypes: PaymentType[] = ['ipc', 'requisition', 'advance', 'retention_release', 'final'];
    const statuses: PaymentStatus[] = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid'];
    const paymentType = overrides.type || randomElement(paymentTypes);
    const gross = randomInt(10000000, 500000000);
    const retention = Math.floor(gross * 0.05);
    const previous = randomInt(0, gross * 2);

    return {
      id,
      engagementId,
      projectId,
      type: paymentType,
      referenceNumber: paymentType === 'ipc'
        ? `IPC/${randomInt(1, 20)}/${new Date().getFullYear()}`
        : generateCode('REQ'),
      status: overrides.status || randomElement(statuses),
      amount: {
        gross,
        retention,
        previousPayments: previous,
        net: gross - retention,
        currency: 'UGX',
      },
      period: {
        from: pastDate(60),
        to: pastDate(30),
        certificateDate: new Date(),
      },
      approvals: [],
      documents: [],
      createdAt: pastDate(30),
      updatedAt: new Date(),
      createdBy: generateTestId('user'),
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // Deal Factories
  // --------------------------------------------------------------------------

  static createDeal(engagementId: string, overrides: Record<string, any> = {}): Record<string, any> {
    const id = generateTestId('deal');
    const stages: DealStage[] = ['origination', 'screening', 'due_diligence', 'structuring', 'negotiation', 'closing', 'closed', 'declined'];
    const targetSize = randomInt(1000000, 100000000);

    return {
      id,
      engagementId,
      name: `${randomElement(['Acquisition', 'Investment', 'Partnership', 'Expansion'])} Deal ${id.slice(-6)}`,
      type: randomElement(['equity', 'debt', 'mezzanine', 'structured']),
      stage: overrides.stage || randomElement(stages),
      target: {
        companyName: `Target Company ${randomInt(1, 100)}`,
        sector: randomElement(['healthcare', 'education', 'energy', 'agriculture', 'fintech']),
        country: 'Uganda',
        description: `Target company description for ${id}`,
      },
      financials: {
        targetSize,
        valuationRange: {
          low: targetSize * 3,
          high: targetSize * 8,
        },
        expectedReturn: randomFloat(10, 30),
        currency: 'USD',
      },
      timeline: {
        originationDate: pastDate(180),
        expectedClosing: futureDate(180),
        actualClosing: null,
      },
      team: {
        leadId: generateTestId('user'),
        members: [],
      },
      createdAt: pastDate(180),
      updatedAt: new Date(),
      createdBy: generateTestId('user'),
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // Portfolio Factories
  // --------------------------------------------------------------------------

  static createPortfolio(engagementId: string, overrides: Record<string, any> = {}): Record<string, any> {
    const id = generateTestId('portfolio');
    const total = randomInt(10000000, 1000000000);
    const committed = randomInt(total * 0.3, total * 0.7);
    const deployed = randomInt(committed * 0.3, committed * 0.8);

    return {
      id,
      engagementId,
      name: `Investment Portfolio ${id.slice(-6)}`,
      type: randomElement(['fund', 'institutional', 'family_office', 'corporate']),
      strategy: {
        targetReturn: randomFloat(8, 20),
        riskTolerance: randomElement(['conservative', 'moderate', 'aggressive']),
        investmentHorizon: randomElement(['short', 'medium', 'long']),
        sectorFocus: [randomElement(['healthcare', 'education', 'energy', 'agriculture'])],
        geographyFocus: ['East Africa', 'Uganda'],
      },
      aum: {
        total,
        committed,
        deployed,
        currency: 'USD',
      },
      performance: {
        irr: randomFloat(-5, 25),
        tvpi: randomFloat(0.8, 2.5),
        dpi: randomFloat(0, 1.5),
        asOfDate: new Date(),
      },
      holdings: [],
      createdAt: pastDate(365),
      updatedAt: new Date(),
      createdBy: generateTestId('user'),
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // BOQ Factories
  // --------------------------------------------------------------------------

  static createBOQ(
    engagementId: string,
    projectId: string,
    overrides: Record<string, any> = {}
  ): Record<string, any> {
    const id = generateTestId('boq');
    const statuses: BOQStatus[] = ['draft', 'pending_review', 'approved', 'rejected', 'superseded'];
    const itemCount = randomInt(5, 20);
    const items = Array.from({ length: itemCount }, (_, index) => {
      const quantity = randomFloat(1, 1000);
      const rate = randomInt(1000, 500000);
      return {
        id: generateTestId('boq-item'),
        itemNo: `${index + 1}.${randomInt(1, 10)}`,
        description: `BOQ Item ${index + 1} - ${randomElement(['Concrete', 'Steel', 'Electrical', 'Plumbing', 'Finishes'])}`,
        unit: randomElement(['m³', 'm²', 'm', 'No.', 'kg', 'L', 'Sum']),
        quantity,
        rate,
        amount: Math.floor(quantity * rate),
        category: randomElement(['structural', 'electrical', 'plumbing', 'finishes', 'external']),
      };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    return {
      id,
      engagementId,
      projectId,
      name: `BOQ - ${randomElement(['Structural Works', 'Electrical', 'Plumbing', 'Roofing', 'Finishes'])} ${id.slice(-6)}`,
      version: randomInt(1, 5),
      status: overrides.status || randomElement(statuses),
      items,
      summary: {
        totalItems: items.length,
        totalAmount,
        currency: 'UGX',
      },
      source: {
        type: randomElement(['manual', 'excel_import', 'ai_parsed']),
        fileName: `boq_${id.slice(-6)}.xlsx`,
        uploadedAt: pastDate(30),
      },
      createdAt: pastDate(60),
      updatedAt: new Date(),
      createdBy: generateTestId('user'),
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // V5 Data Factories (for migration testing)
  // --------------------------------------------------------------------------

  static createV5Program(overrides: Record<string, any> = {}): Record<string, any> {
    const id = generateTestId('v5-program');
    const totalBudget = randomInt(1000000000, 50000000000);

    return {
      id,
      name: `V5 Program ${id.slice(-6)}`,
      funder: randomElement(['AMH Foundation', 'World Bank', 'GoU', 'USAID', 'EU']),
      totalBudget,
      currency: 'UGX',
      startDate: pastDate(730),
      endDate: futureDate(365),
      status: randomElement(['active', 'completed', 'suspended']),
      countryManager: `Manager ${randomInt(1, 50)}`,
      region: randomElement(['Central', 'Eastern', 'Western', 'Northern']),
      createdAt: pastDate(730),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createV5Project(programId: string, overrides: Record<string, any> = {}): Record<string, any> {
    const id = generateTestId('v5-project');
    const contractValue = randomInt(100000000, 5000000000);

    return {
      id,
      programId,
      name: `V5 ${randomElement(['Hospital', 'School', 'Clinic'])} Construction ${id.slice(-6)}`,
      projectCode: generateCode('V5PRJ'),
      implementationType: randomElement(['contractor', 'direct']),
      contractorName: `V5 Contractor ${randomInt(1, 100)}`,
      contractValue,
      district: randomElement(['Kampala', 'Wakiso', 'Jinja', 'Mbale']),
      subcounty: `Subcounty ${randomInt(1, 10)}`,
      status: randomElement(['planning', 'construction', 'completed']),
      physicalProgress: randomInt(0, 100),
      createdAt: pastDate(365),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createV5Payment(
    programId: string,
    projectId: string,
    overrides: Record<string, any> = {}
  ): Record<string, any> {
    const id = generateTestId('v5-payment');
    const grossAmount = randomInt(10000000, 500000000);
    const retentionAmount = Math.floor(grossAmount * 0.05);

    return {
      id,
      programId,
      projectId,
      paymentType: randomElement(['IPC', 'Requisition', 'Advance']),
      certificateNumber: `IPC/${randomInt(1, 20)}`,
      grossAmount,
      retentionAmount,
      netAmount: grossAmount - retentionAmount,
      status: randomElement(['draft', 'approved', 'paid']),
      periodFrom: pastDate(90),
      periodTo: pastDate(30),
      createdAt: pastDate(60),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // Batch Factories
  // --------------------------------------------------------------------------

  static createBatch<T>(
    factory: (overrides?: Record<string, any>) => T,
    count: number,
    overridesArray: Record<string, any>[] = []
  ): T[] {
    return Array.from({ length: count }, (_, index) =>
      factory(overridesArray[index] || {})
    );
  }

  static createEngagementWithProjects(
    projectCount: number = 3,
    overrides: Record<string, any> = {}
  ): { engagement: Record<string, any>; projects: Record<string, any>[] } {
    const engagement = this.createEngagement(overrides);
    const projects = this.createBatch(
      () => this.createProject(engagement.id),
      projectCount
    );
    return { engagement, projects };
  }

  static createProjectWithPayments(
    engagementId: string,
    paymentCount: number = 3,
    overrides: Record<string, any> = {}
  ): { project: Record<string, any>; payments: Record<string, any>[] } {
    const project = this.createProject(engagementId, overrides);
    const payments = this.createBatch(
      () => this.createPayment(engagementId, project.id),
      paymentCount
    );
    return { project, payments };
  }

  static createFullV5Dataset(
    programCount: number = 2,
    projectsPerProgram: number = 3,
    paymentsPerProject: number = 2
  ): {
    programs: Record<string, any>[];
    projects: Record<string, any>[];
    payments: Record<string, any>[];
  } {
    const programs = this.createBatch(() => this.createV5Program(), programCount);
    const projects: Record<string, any>[] = [];
    const payments: Record<string, any>[] = [];

    for (const program of programs) {
      const programProjects = this.createBatch(
        () => this.createV5Project(program.id),
        projectsPerProgram
      );
      projects.push(...programProjects);

      for (const project of programProjects) {
        const projectPayments = this.createBatch(
          () => this.createV5Payment(program.id, project.id),
          paymentsPerProject
        );
        payments.push(...projectPayments);
      }
    }

    return { programs, projects, payments };
  }
}
