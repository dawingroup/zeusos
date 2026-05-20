// ============================================================================
// STRATEGY DATA AGGREGATOR SERVICE
// DawinOS v2.0 - CEO Strategy Command
// Pulls cross-module data (HR, Assets, Finance, Market Intelligence) for
// strategy review context and AI prompt enrichment
// ============================================================================

import { getEmployeeStats, listEmployees } from '../../hr-central/services/employee.service';
import type { EmployeeStats, EmployeeSummary } from '../../hr-central/types/employee.types';
import type { Asset } from '@/shared/types';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import type { BusinessPivot } from '../types/strategy.types';

// ----------------------------------------------------------------------------
// Aggregated Data Types
// ----------------------------------------------------------------------------

export interface HRSummaryData {
  stats: EmployeeStats | null;
  departmentBreakdown: { department: string; count: number; managers: number }[];
  recentHires: { name: string; title: string; department: string; date: string }[];
  recentExits: { name: string; title: string; department: string; date: string }[];
  skillsInventory: { skill: string; count: number; level: string }[];
  managementSpan: { manager: string; directReports: number }[];
}

export interface AssetSummaryData {
  totalAssets: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  maintenanceOverdue: number;
  recentAdditions: { name: string; category: string; date: string }[];
  utilizationSummary: string;
}

export interface FinanceSummaryData {
  hasData: boolean;
  revenueOverview?: string;
  expenseOverview?: string;
  keyMetrics?: Record<string, string>;
  plPeriod?: string;
  bsPeriod?: string;
}

export interface MarketIntelSummaryData {
  recentSignals: { title: string; category: string; impact: string; date: string }[];
  activeScenarios: { title: string; probability: string; impact: string }[];
  regulatoryItems: { title: string; status: string; deadline: string }[];
  trackedIndicators: { name: string; value: string; trend: string }[];
  pestelSummary: { category: string; factorCount: number }[];
  reports: { title: string; type: string; status: string; keyFindings: string[] }[];
}

export interface AggregatedStrategyContext {
  hr: HRSummaryData;
  assets: AssetSummaryData;
  finance: FinanceSummaryData;
  marketIntel: MarketIntelSummaryData;
  pivots: BusinessPivot[];
  fetchedAt: string;
}

// ----------------------------------------------------------------------------
// HR Data Aggregation
// ----------------------------------------------------------------------------

async function fetchHRData(_companyId: string, subsidiaryId?: string): Promise<HRSummaryData> {
  const empty: HRSummaryData = {
    stats: null,
    departmentBreakdown: [],
    recentHires: [],
    recentExits: [],
    skillsInventory: [],
    managementSpan: [],
  };

  try {
    const stats = await getEmployeeStats();
    // Map external subsidiary IDs (dawin-finishes) to HR SubsidiaryId format (finishes)
    const SUBSIDIARY_ID_MAP: Record<string, string> = {
      'dawin-finishes': 'finishes',
      'dawin-advisory': 'advisory',
      'dawin-capital': 'capital',
      'dawin-technology': 'technology',
      'dawin-group': 'group',
    };
    const filters: Parameters<typeof listEmployees>[0] = {
      employmentStatuses: ['active', 'probation'],
    };
    if (subsidiaryId) {
      const mapped = SUBSIDIARY_ID_MAP[subsidiaryId] || subsidiaryId;
      (filters as Record<string, unknown>).subsidiaryIds = [mapped];
    }
    const employees = await listEmployees(
      filters,
      { field: 'fullName', direction: 'asc' },
      500
    );

    const empList: EmployeeSummary[] = 'employees' in employees
      ? (employees as { employees: EmployeeSummary[] }).employees
      : [];

    // Department breakdown
    const deptMap: Record<string, { count: number; managers: number }> = {};
    empList.forEach(e => {
      const dept = e.departmentName || e.departmentId || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { count: 0, managers: 0 };
      deptMap[dept].count++;
      if (e.directReports > 0) deptMap[dept].managers++;
    });

    const departmentBreakdown = Object.entries(deptMap)
      .map(([department, d]) => ({ department, count: d.count, managers: d.managers }))
      .sort((a, b) => b.count - a.count);

    // Management span
    const managementSpan = empList
      .filter(e => e.directReports > 0)
      .map(e => ({ manager: e.fullName, directReports: e.directReports }))
      .sort((a, b) => b.directReports - a.directReports)
      .slice(0, 10);

    return {
      stats,
      departmentBreakdown,
      recentHires: [],
      recentExits: [],
      skillsInventory: [],
      managementSpan,
    };
  } catch (error) {
    console.warn('[StrategyAggregator] HR data fetch failed:', error);
    return empty;
  }
}

// ----------------------------------------------------------------------------
// Asset Data Aggregation
// ----------------------------------------------------------------------------

async function fetchAssetData(): Promise<AssetSummaryData> {
  const empty: AssetSummaryData = {
    totalAssets: 0,
    byCategory: {},
    byStatus: {},
    maintenanceOverdue: 0,
    recentAdditions: [],
    utilizationSummary: 'No data available',
  };

  try {
    const snap = await getDocs(collection(db, 'assets'));
    const assets = snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset));

    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let maintenanceOverdue = 0;

    assets.forEach(a => {
      byCategory[a.category] = (byCategory[a.category] || 0) + 1;
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (a.maintenance?.nextServiceDue) {
        const due = a.maintenance.nextServiceDue instanceof Date
          ? a.maintenance.nextServiceDue
          : new Date(a.maintenance.nextServiceDue as unknown as string);
        if (due < new Date()) maintenanceOverdue++;
      }
    });

    const operational = (byStatus['OPERATIONAL'] || 0);
    const total = assets.length;
    const utilizationSummary = total > 0
      ? `${operational}/${total} operational (${Math.round(operational / total * 100)}%)`
      : 'No assets';

    return {
      totalAssets: total,
      byCategory,
      byStatus,
      maintenanceOverdue,
      recentAdditions: [],
      utilizationSummary,
    };
  } catch (error) {
    console.warn('[StrategyAggregator] Asset data fetch failed:', error);
    return empty;
  }
}

// ----------------------------------------------------------------------------
// Finance Data Aggregation — reads from QuickBooks synced data
// ----------------------------------------------------------------------------

async function fetchFinanceData(companyId: string): Promise<FinanceSummaryData> {
  try {
    const syncedRef = collection(db, 'companies', companyId, 'qbo_synced_data');
    const snap = await getDocs(syncedRef);
    if (snap.empty) {
      return { hasData: false };
    }

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Find latest P&L
    const plDocs = docs.filter(d => d.id.startsWith('pl_')).sort((a, b) => b.id.localeCompare(a.id));
    const latestPL = plDocs[0] as Record<string, any> | undefined;

    // Find latest Balance Sheet
    const bsDocs = docs.filter(d => d.id.startsWith('bs_')).sort((a, b) => b.id.localeCompare(a.id));
    const latestBS = bsDocs[0] as Record<string, any> | undefined;

    const keyMetrics: Record<string, string> = {};
    let revenueOverview = '';
    let expenseOverview = '';

    if (latestPL) {
      const totalIncome = (latestPL.income || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      const totalExpenses = (latestPL.expenses || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      const netIncome = latestPL.netIncome ?? (totalIncome - totalExpenses);
      const grossProfit = latestPL.grossProfit ?? 0;

      revenueOverview = `Total Income: ${formatCurrency(totalIncome)} | Gross Profit: ${formatCurrency(grossProfit)}`;
      expenseOverview = `Total Expenses: ${formatCurrency(totalExpenses)} | Net Income: ${formatCurrency(netIncome)}`;

      keyMetrics['Net Income'] = formatCurrency(netIncome);
      keyMetrics['Gross Profit'] = formatCurrency(grossProfit);
      if (totalIncome > 0) {
        keyMetrics['Gross Margin'] = `${((grossProfit / totalIncome) * 100).toFixed(1)}%`;
        keyMetrics['Net Margin'] = `${((netIncome / totalIncome) * 100).toFixed(1)}%`;
      }
    }

    if (latestBS) {
      keyMetrics['Total Assets'] = formatCurrency(latestBS.totalAssets || 0);
      keyMetrics['Total Liabilities'] = formatCurrency(latestBS.totalLiabilities || 0);
      keyMetrics['Total Equity'] = formatCurrency(latestBS.totalEquity || 0);
    }

    return {
      hasData: true,
      revenueOverview: revenueOverview || 'QuickBooks data available',
      expenseOverview: expenseOverview || 'QuickBooks data available',
      keyMetrics,
      plPeriod: latestPL ? `${latestPL.startDate} to ${latestPL.endDate}` : undefined,
      bsPeriod: latestBS ? `As of ${latestBS.asOfDate}` : undefined,
    };
  } catch (error) {
    console.warn('[StrategyAggregator] Finance data fetch failed:', error);
    return { hasData: false };
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

// ----------------------------------------------------------------------------
// Market Intelligence Aggregation
// ----------------------------------------------------------------------------

async function fetchMarketIntelData(): Promise<MarketIntelSummaryData> {
  const empty: MarketIntelSummaryData = {
    recentSignals: [],
    activeScenarios: [],
    regulatoryItems: [],
    trackedIndicators: [],
    pestelSummary: [],
    reports: [],
  };

  try {
    // Signals (last 90 days, high/critical)
    // Signals (last 90 days)
    const signalsSnap = await getDocs(
      query(collection(db, 'environment_signals'), orderBy('detectedAt', 'desc'), limit(20))
    );
    const recentSignals = signalsSnap.docs
      .map(d => {
        const data = d.data();
        return {
          title: data.title || '',
          category: data.category || '',
          impact: data.impactLevel || data.impact || '',
          date: data.detectedAt?.toDate?.()?.toISOString?.() || '',
        };
      })
      .filter(s => s.title);

    // Scenarios
    const scenariosSnap = await getDocs(
      query(collection(db, 'scenarios'), orderBy('createdAt', 'desc'), limit(10))
    );
    const activeScenarios = scenariosSnap.docs.map(d => {
      const data = d.data();
      return {
        title: data.title || '',
        probability: data.probability || '',
        impact: data.impact || '',
      };
    });

    // Regulatory
    const regSnap = await getDocs(
      query(collection(db, 'regulatory_items'), orderBy('trackedAt', 'desc'), limit(10))
    );
    const regulatoryItems = regSnap.docs.map(d => {
      const data = d.data();
      return {
        title: data.title || '',
        status: data.status || '',
        deadline: data.effectiveDate?.toDate?.()?.toISOString?.() || '',
      };
    });

    // Indicators
    const indSnap = await getDocs(collection(db, 'tracked_indicators'));
    const trackedIndicators = indSnap.docs.map(d => {
      const data = d.data();
      return {
        name: data.name || '',
        value: String(data.currentValue ?? ''),
        trend: data.trend || '',
      };
    });

    // PESTEL summary
    const pestelSnap = await getDocs(
      query(collection(db, 'pestel_analyses'), orderBy('createdAt', 'desc'), limit(5))
    );
    const pestelCategories: Record<string, number> = {};
    pestelSnap.docs.forEach(d => {
      const data = d.data();
      const factors = data.factors || [];
      factors.forEach((f: { category?: string }) => {
        const cat = f.category || 'unknown';
        pestelCategories[cat] = (pestelCategories[cat] || 0) + 1;
      });
    });
    const pestelSummary = Object.entries(pestelCategories)
      .map(([category, factorCount]) => ({ category, factorCount }));

    // Intelligence Dashboard reports (market_intelligence_reports collection)
    let reports: MarketIntelSummaryData['reports'] = [];
    try {
      const reportsSnap = await getDocs(
        query(collection(db, 'market_intelligence_reports'), orderBy('createdAt', 'desc'), limit(10))
      );
      reports = reportsSnap.docs.map(d => {
        const data = d.data();
        return {
          title: data.title || '',
          type: data.type || '',
          status: data.status || '',
          keyFindings: (data.keyFindings || []).slice(0, 5),
        };
      }).filter(r => r.title);
    } catch {
      // Collection may not exist yet — that's fine
    }

    return { recentSignals, activeScenarios, regulatoryItems, trackedIndicators, pestelSummary, reports };
  } catch (error) {
    console.warn('[StrategyAggregator] Market intel fetch failed:', error);
    return empty;
  }
}

// ----------------------------------------------------------------------------
// Business Pivots
// ----------------------------------------------------------------------------

async function fetchPivots(companyId: string): Promise<BusinessPivot[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'companies', companyId, 'business_pivots'), orderBy('pivotDate', 'desc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessPivot));
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------------------
// Main Aggregator
// ----------------------------------------------------------------------------

export async function aggregateStrategyContext(companyId: string, subsidiaryId?: string): Promise<AggregatedStrategyContext> {
  const [hr, assets, finance, marketIntel, pivots] = await Promise.all([
    fetchHRData(companyId, subsidiaryId),
    fetchAssetData(),
    fetchFinanceData(companyId),
    fetchMarketIntelData(),
    fetchPivots(companyId),
  ]);

  return {
    hr,
    assets,
    finance,
    marketIntel,
    pivots,
    fetchedAt: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Context-to-Text for AI prompts
// ----------------------------------------------------------------------------

export function contextToPromptText(ctx: AggregatedStrategyContext): string {
  const parts: string[] = [];

  // HR
  if (ctx.hr.stats) {
    const s = ctx.hr.stats;
    parts.push('=== HR & ORGANIZATIONAL DATA ===');
    parts.push(`Total employees: ${s.totalEmployees}`);
    parts.push(`By status: ${Object.entries(s.byStatus).filter(([,v]) => v > 0).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
    parts.push(`By type: ${Object.entries(s.byType).filter(([,v]) => v > 0).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
    parts.push(`Avg tenure: ${s.avgTenureYears.toFixed(1)} years | Turnover rate: ${(s.turnoverRate * 100).toFixed(1)}%`);
    if (ctx.hr.departmentBreakdown.length > 0) {
      parts.push('Departments: ' + ctx.hr.departmentBreakdown.map(d => `${d.department} (${d.count} staff, ${d.managers} mgrs)`).join(', '));
    }
    if (ctx.hr.managementSpan.length > 0) {
      parts.push('Management span: ' + ctx.hr.managementSpan.slice(0, 5).map(m => `${m.manager}: ${m.directReports} reports`).join(', '));
    }
  }

  // Assets
  if (ctx.assets.totalAssets > 0) {
    parts.push('\n=== ASSETS & EQUIPMENT ===');
    parts.push(`Total assets: ${ctx.assets.totalAssets} | Utilization: ${ctx.assets.utilizationSummary}`);
    parts.push(`By category: ${Object.entries(ctx.assets.byCategory).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
    parts.push(`By status: ${Object.entries(ctx.assets.byStatus).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
    if (ctx.assets.maintenanceOverdue > 0) {
      parts.push(`Maintenance overdue: ${ctx.assets.maintenanceOverdue} assets`);
    }
  }

  // Finance
  if (ctx.finance.hasData) {
    parts.push('\n=== FINANCIAL DATA (QuickBooks) ===');
    if (ctx.finance.plPeriod) parts.push(`P&L Period: ${ctx.finance.plPeriod}`);
    if (ctx.finance.bsPeriod) parts.push(`Balance Sheet: ${ctx.finance.bsPeriod}`);
    if (ctx.finance.revenueOverview) parts.push(`Revenue: ${ctx.finance.revenueOverview}`);
    if (ctx.finance.expenseOverview) parts.push(`Expenses: ${ctx.finance.expenseOverview}`);
    if (ctx.finance.keyMetrics) {
      Object.entries(ctx.finance.keyMetrics).forEach(([k, v]) => parts.push(`${k}: ${v}`));
    }
  }

  // Market Intelligence
  const mi = ctx.marketIntel;
  if (mi.recentSignals.length || mi.activeScenarios.length || mi.regulatoryItems.length || mi.reports.length) {
    parts.push('\n=== MARKET INTELLIGENCE ===');
    if (mi.recentSignals.length > 0) {
      parts.push('Recent Signals:');
      mi.recentSignals.slice(0, 5).forEach(s => parts.push(`  - [${s.category}/${s.impact}] ${s.title}`));
    }
    if (mi.activeScenarios.length > 0) {
      parts.push('Active Scenarios:');
      mi.activeScenarios.slice(0, 3).forEach(s => parts.push(`  - ${s.title} (P: ${s.probability}, Impact: ${s.impact})`));
    }
    if (mi.regulatoryItems.length > 0) {
      parts.push('Regulatory Tracking:');
      mi.regulatoryItems.slice(0, 3).forEach(r => parts.push(`  - ${r.title} [${r.status}]`));
    }
    if (mi.trackedIndicators.length > 0) {
      parts.push('Economic Indicators:');
      mi.trackedIndicators.slice(0, 5).forEach(i => parts.push(`  - ${i.name}: ${i.value} (${i.trend})`));
    }
    if (mi.reports.length > 0) {
      parts.push('Intelligence Reports:');
      mi.reports.slice(0, 5).forEach(r => {
        parts.push(`  - [${r.status}] ${r.title} (${r.type})`);
        if (r.keyFindings.length > 0) {
          r.keyFindings.slice(0, 3).forEach(f => parts.push(`    • ${f}`));
        }
      });
    }
  }

  // Business Pivots
  if (ctx.pivots.length > 0) {
    parts.push('\n=== BUSINESS PIVOTS HISTORY ===');
    ctx.pivots.slice(0, 5).forEach(p => {
      parts.push(`  - [${p.status}] ${p.title} (${p.category}, ${new Date(p.pivotDate).toLocaleDateString()})`);
      if (p.outcomes) parts.push(`    Outcomes: ${p.outcomes}`);
    });
  }

  return parts.join('\n');
}
