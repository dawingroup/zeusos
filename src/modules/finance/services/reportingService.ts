// ============================================================================
// REPORTING SERVICE
// DawinOS v2.0 - Financial Management Module
// Service for generating financial reports
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import {
  REPORTS_COLLECTION,
  REPORT_TYPES,
  getFiscalYear,
} from '../constants/reporting.constants';
import { ACCOUNT_TYPES } from '../constants/account.constants';
import {
  ReportParameters,
  ReportFilters,
  GeneratedReport,
  IncomeStatement,
  BalanceSheet,
  TrialBalance,
  TrialBalanceLine,
  ReportSection,
  ReportLineItem,
  ReportTotal,
  VATReturn,
  AccountBalance,
} from '../types/reporting.types';
import { Account } from '../types/account.types';

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const formatPeriodLabel = (startDate: Date, endDate: Date): string => {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${startDate.toLocaleDateString('en-UG', options)} - ${endDate.toLocaleDateString('en-UG', options)}`;
};

const getFiscalYearFromDate = (date: Date): number => {
  return getFiscalYear(date);
};

// ----------------------------------------------------------------------------
// GET ACCOUNTS
// ----------------------------------------------------------------------------

const getAccounts = async (companyId: string): Promise<Account[]> => {
  const accountsRef = collection(db, 'accounts');
  const q = query(
    accountsRef,
    where('companyId', '==', companyId),
    orderBy('code')
  );
  
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
  } catch {
    // Fallback: get all accounts if no company filter
    const allQ = query(accountsRef, orderBy('code'), limit(500));
    const snapshot = await getDocs(allQ);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
  }
};

// ----------------------------------------------------------------------------
// GET ACCOUNT BALANCES
// ----------------------------------------------------------------------------

const getAccountBalancesForPeriod = async (
  _companyId: string,
  _startDate: Date,
  _endDate: Date,
  accounts: Account[]
): Promise<AccountBalance[]> => {
  // In production, this would query journal entries and calculate balances
  // For now, we use the account's current balance
  return accounts.map(account => {
    const bal = typeof account.balance === 'object' ? account.balance?.balance || 0 : (account.balance || 0);
    return {
      accountId: account.id,
      accountCode: account.code || '',
      accountName: account.name,
      accountType: account.type,
      accountCategory: account.subType,
      balance: bal,
      debitBalance: account.type === ACCOUNT_TYPES.ASSET || account.type === ACCOUNT_TYPES.EXPENSE 
        ? Math.abs(bal) 
        : 0,
      creditBalance: account.type === ACCOUNT_TYPES.LIABILITY || account.type === ACCOUNT_TYPES.EQUITY || account.type === ACCOUNT_TYPES.REVENUE
        ? Math.abs(bal) 
        : 0,
    };
  });
};

const getAccountBalancesAsOf = async (
  companyId: string,
  asOfDate: Date,
  accounts: Account[]
): Promise<AccountBalance[]> => {
  // Same as period balances for now
  return getAccountBalancesForPeriod(companyId, new Date(0), asOfDate, accounts);
};

// ----------------------------------------------------------------------------
// BUILD REPORT SECTION
// ----------------------------------------------------------------------------

const buildReportSection = (
  key: string,
  label: string,
  accounts: Account[],
  balances: AccountBalance[],
  sign: number,
  params: ReportParameters
): ReportSection => {
  const lines: ReportLineItem[] = accounts
    .filter(a => !a.isHeader && a.isPostable !== false)
    .map(account => {
      const balance = balances.find(b => b.accountId === account.id);
      const amount = (balance?.balance || 0) * sign;
      
      return {
        id: account.id,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        accountCategory: account.subType,
        level: 0,
        isHeader: false,
        isTotal: false,
        isCalculated: false,
        currentAmount: amount,
      };
    })
    .filter(line => params.showZeroBalances || line.currentAmount !== 0)
    .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''));
  
  const total = lines.reduce((sum, line) => sum + line.currentAmount, 0);
  
  return {
    key,
    label,
    lines,
    total,
  };
};

// ----------------------------------------------------------------------------
// INCOME STATEMENT GENERATION
// ----------------------------------------------------------------------------

export const generateIncomeStatement = async (
  params: ReportParameters,
  userId: string
): Promise<IncomeStatement> => {
  const reportId = generateId();
  
  // Get all accounts for the company
  const accounts = await getAccounts(params.companyId);
  
  // Get account balances for the period
  const balances = await getAccountBalancesForPeriod(
    params.companyId,
    params.startDate,
    params.endDate,
    accounts
  );
  
  // Build sections
  const revenue = buildReportSection(
    'revenue',
    'Revenue',
    accounts.filter(a => a.type === ACCOUNT_TYPES.REVENUE),
    balances,
    1,
    params
  );
  
  const costOfSales = buildReportSection(
    'cost_of_sales',
    'Cost of Sales',
    accounts.filter(a => a.subType === 'cost_of_sales'),
    balances,
    -1,
    params
  );
  
  const grossProfit: ReportTotal = {
    key: 'gross_profit',
    label: 'Gross Profit',
    amount: revenue.total - Math.abs(costOfSales.total),
    isCalculated: true,
  };
  
  const operatingExpenses = buildReportSection(
    'operating_expenses',
    'Operating Expenses',
    accounts.filter(a => a.type === ACCOUNT_TYPES.EXPENSE && 
      ['operating_expense', 'administrative_expense'].includes(a.subType || '')),
    balances,
    -1,
    params
  );
  
  const operatingProfit: ReportTotal = {
    key: 'operating_profit',
    label: 'Operating Profit (EBIT)',
    amount: grossProfit.amount - Math.abs(operatingExpenses.total),
    isCalculated: true,
  };
  
  const otherIncome = buildReportSection(
    'other_income',
    'Other Income',
    accounts.filter(a => a.subType === 'other_income' || a.subType === 'non_operating_revenue'),
    balances,
    1,
    params
  );
  
  const otherExpenses = buildReportSection(
    'other_expenses',
    'Other Expenses',
    accounts.filter(a => a.subType === 'financial_expense' || a.subType === 'other_expense'),
    balances,
    -1,
    params
  );
  
  const profitBeforeTax: ReportTotal = {
    key: 'profit_before_tax',
    label: 'Profit Before Tax',
    amount: operatingProfit.amount + otherIncome.total - Math.abs(otherExpenses.total),
    isCalculated: true,
  };
  
  const taxExpense = buildReportSection(
    'tax_expense',
    'Income Tax Expense',
    accounts.filter(a => a.name?.toLowerCase().includes('tax') && a.type === ACCOUNT_TYPES.EXPENSE),
    balances,
    -1,
    params
  );
  
  const netProfit: ReportTotal = {
    key: 'net_profit',
    label: 'Net Profit',
    amount: profitBeforeTax.amount - Math.abs(taxExpense.total),
    isCalculated: true,
  };
  
  // Calculate margins
  const totalRevenue = revenue.total || 1;
  const grossProfitMargin = (grossProfit.amount / totalRevenue) * 100;
  const operatingProfitMargin = (operatingProfit.amount / totalRevenue) * 100;
  const netProfitMargin = (netProfit.amount / totalRevenue) * 100;
  
  const now = Timestamp.now();
  const fiscalYear = params.fiscalYear || getFiscalYearFromDate(params.endDate);
  
  const incomeStatement: IncomeStatement = {
    id: reportId,
    companyId: params.companyId,
    reportType: 'income_statement',
    
    startDate: params.startDate,
    endDate: params.endDate,
    fiscalYear,
    periodLabel: formatPeriodLabel(params.startDate, params.endDate),
    
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses,
    operatingProfit,
    otherIncome,
    otherExpenses,
    profitBeforeTax,
    taxExpense,
    netProfit,
    
    grossProfitMargin,
    operatingProfitMargin,
    netProfitMargin,
    
    currency: params.currency || 'UGX',
    generatedAt: now,
    generatedBy: userId,
    status: 'draft',
  };
  
  // Save to Firestore
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);
  await setDoc(reportRef, {
    ...incomeStatement,
    reportType: REPORT_TYPES.INCOME_STATEMENT,
    parameters: params,
    startDate: Timestamp.fromDate(params.startDate),
    endDate: Timestamp.fromDate(params.endDate),
  });
  
  return incomeStatement;
};

// ----------------------------------------------------------------------------
// BALANCE SHEET GENERATION
// ----------------------------------------------------------------------------

export const generateBalanceSheet = async (
  params: ReportParameters,
  userId: string
): Promise<BalanceSheet> => {
  const reportId = generateId();
  
  const accounts = await getAccounts(params.companyId);
  const balances = await getAccountBalancesAsOf(params.companyId, params.endDate, accounts);
  
  // Assets
  const currentAssets = buildReportSection(
    'current_assets',
    'Current Assets',
    accounts.filter(a => a.type === ACCOUNT_TYPES.ASSET && a.subType === 'current_asset'),
    balances,
    1,
    params
  );
  
  const nonCurrentAssets = buildReportSection(
    'non_current_assets',
    'Non-Current Assets',
    accounts.filter(a => a.type === ACCOUNT_TYPES.ASSET && 
      ['fixed_asset', 'intangible_asset', 'other_asset'].includes(a.subType || '')),
    balances,
    1,
    params
  );
  
  const totalAssets: ReportTotal = {
    key: 'total_assets',
    label: 'Total Assets',
    amount: currentAssets.total + nonCurrentAssets.total,
    isCalculated: true,
  };
  
  // Liabilities
  const currentLiabilities = buildReportSection(
    'current_liabilities',
    'Current Liabilities',
    accounts.filter(a => a.type === ACCOUNT_TYPES.LIABILITY && a.subType === 'current_liability'),
    balances,
    1,
    params
  );
  
  const nonCurrentLiabilities = buildReportSection(
    'non_current_liabilities',
    'Non-Current Liabilities',
    accounts.filter(a => a.type === ACCOUNT_TYPES.LIABILITY && 
      ['long_term_liability', 'other_liability'].includes(a.subType || '')),
    balances,
    1,
    params
  );
  
  const totalLiabilities: ReportTotal = {
    key: 'total_liabilities',
    label: 'Total Liabilities',
    amount: currentLiabilities.total + nonCurrentLiabilities.total,
    isCalculated: true,
  };
  
  // Equity
  const shareCapital = buildReportSection(
    'share_capital',
    'Share Capital',
    accounts.filter(a => a.type === ACCOUNT_TYPES.EQUITY && a.subType === 'share_capital'),
    balances,
    1,
    params
  );
  
  const retainedEarnings = buildReportSection(
    'retained_earnings',
    'Retained Earnings',
    accounts.filter(a => a.type === ACCOUNT_TYPES.EQUITY && a.subType === 'retained_earnings'),
    balances,
    1,
    params
  );
  
  const reserves = buildReportSection(
    'reserves',
    'Reserves',
    accounts.filter(a => a.type === ACCOUNT_TYPES.EQUITY && a.subType === 'reserves'),
    balances,
    1,
    params
  );
  
  const totalEquity: ReportTotal = {
    key: 'total_equity',
    label: 'Total Equity',
    amount: shareCapital.total + retainedEarnings.total + reserves.total,
    isCalculated: true,
  };
  
  const totalLiabilitiesEquity: ReportTotal = {
    key: 'total_liabilities_equity',
    label: 'Total Liabilities & Equity',
    amount: totalLiabilities.amount + totalEquity.amount,
    isCalculated: true,
  };
  
  // Validation
  const difference = totalAssets.amount - totalLiabilitiesEquity.amount;
  const isBalanced = Math.abs(difference) < 0.01;
  
  // Ratios
  const currentRatio = currentLiabilities.total > 0 
    ? currentAssets.total / currentLiabilities.total 
    : 0;
  
  const quickRatio = currentLiabilities.total > 0 
    ? (currentAssets.total * 0.8) / currentLiabilities.total // Simplified
    : 0;
  
  const debtToEquityRatio = totalEquity.amount > 0 
    ? totalLiabilities.amount / totalEquity.amount 
    : 0;
  
  const now = Timestamp.now();
  const fiscalYear = params.fiscalYear || getFiscalYearFromDate(params.endDate);
  
  const balanceSheet: BalanceSheet = {
    id: reportId,
    companyId: params.companyId,
    reportType: 'balance_sheet',
    
    asOfDate: params.endDate,
    fiscalYear,
    
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    
    currentLiabilities,
    nonCurrentLiabilities,
    totalLiabilities,
    
    shareCapital,
    retainedEarnings,
    reserves,
    totalEquity,
    
    totalLiabilitiesEquity,
    
    isBalanced,
    difference,
    
    currentRatio,
    quickRatio,
    debtToEquityRatio,
    
    currency: params.currency || 'UGX',
    generatedAt: now,
    generatedBy: userId,
    status: 'draft',
  };
  
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);
  await setDoc(reportRef, {
    ...balanceSheet,
    reportType: REPORT_TYPES.BALANCE_SHEET,
    parameters: params,
    asOfDate: Timestamp.fromDate(params.endDate),
  });
  
  return balanceSheet;
};

// ----------------------------------------------------------------------------
// TRIAL BALANCE GENERATION
// ----------------------------------------------------------------------------

export const generateTrialBalance = async (
  params: ReportParameters,
  userId: string
): Promise<TrialBalance> => {
  const reportId = generateId();
  
  const accounts = await getAccounts(params.companyId);
  const balances = await getAccountBalancesForPeriod(
    params.companyId,
    params.startDate,
    params.endDate,
    accounts
  );
  
  const lines: TrialBalanceLine[] = accounts
    .filter(a => !a.isHeader && a.isPostable !== false)
    .map(account => {
      const balance = balances.find(b => b.accountId === account.id);
      const bal = balance?.balance || 0;
      
      const isDebitNormal = account.type === ACCOUNT_TYPES.ASSET || account.type === ACCOUNT_TYPES.EXPENSE;
      
      return {
        accountId: account.id,
        accountCode: account.code || '',
        accountName: account.name,
        accountType: account.type,
        accountCategory: account.subType,
        
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: isDebitNormal ? Math.abs(bal) : 0,
        periodCredit: !isDebitNormal ? Math.abs(bal) : 0,
        closingDebit: isDebitNormal ? Math.abs(bal) : 0,
        closingCredit: !isDebitNormal ? Math.abs(bal) : 0,
      };
    })
    .filter(line => 
      params.showZeroBalances || 
      line.closingDebit !== 0 || 
      line.closingCredit !== 0
    )
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  
  const totalDebits = lines.reduce((sum, l) => sum + l.closingDebit, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.closingCredit, 0);
  const difference = totalDebits - totalCredits;
  const isBalanced = Math.abs(difference) < 0.01;
  
  const now = Timestamp.now();
  
  const trialBalance: TrialBalance = {
    id: reportId,
    companyId: params.companyId,
    reportType: 'trial_balance',
    
    asOfDate: params.endDate,
    fiscalYear: params.fiscalYear || getFiscalYearFromDate(params.endDate),
    
    lines,
    
    totalDebits,
    totalCredits,
    isBalanced,
    difference,
    
    currency: params.currency || 'UGX',
    generatedAt: now,
    generatedBy: userId,
  };
  
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);
  await setDoc(reportRef, {
    ...trialBalance,
    reportType: REPORT_TYPES.TRIAL_BALANCE,
    parameters: params,
    asOfDate: Timestamp.fromDate(params.endDate),
  });
  
  return trialBalance;
};

// ----------------------------------------------------------------------------
// VAT RETURN GENERATION (Uganda)
// ----------------------------------------------------------------------------

export const generateVATReturn = async (
  params: ReportParameters,
  userId: string
): Promise<VATReturn> => {
  const reportId = generateId();
  
  const accounts = await getAccounts(params.companyId);
  const balances = await getAccountBalancesForPeriod(
    params.companyId,
    params.startDate,
    params.endDate,
    accounts
  );
  
  // Calculate sales figures from revenue accounts
  const revenueAccounts = accounts.filter(a => a.type === ACCOUNT_TYPES.REVENUE);
  const totalSales = revenueAccounts.reduce((sum, a) => {
    const bal = balances.find(b => b.accountId === a.id);
    return sum + Math.abs(bal?.balance || 0);
  }, 0);
  
  const standardRatedSales = totalSales;
  const zeroRatedSales = 0;
  const exemptSales = 0;
  const outputVAT = standardRatedSales * 0.18;
  
  // Calculate purchases from expense accounts
  const purchaseAccounts = accounts.filter(a => a.type === ACCOUNT_TYPES.EXPENSE);
  const totalPurchases = purchaseAccounts.reduce((sum, a) => {
    const bal = balances.find(b => b.accountId === a.id);
    return sum + Math.abs(bal?.balance || 0);
  }, 0);
  
  const standardRatedPurchases = totalPurchases * 0.8;
  const capitalPurchases = totalPurchases * 0.2;
  const exemptPurchases = 0;
  const inputVAT = (standardRatedPurchases + capitalPurchases) * 0.18;
  
  const netVATPayable = outputVAT - inputVAT;
  
  // Filing deadline: 15th of following month
  const filingDeadline = new Date(params.endDate);
  filingDeadline.setMonth(filingDeadline.getMonth() + 1);
  filingDeadline.setDate(15);
  
  const now = Timestamp.now();
  
  const vatReturn: VATReturn = {
    id: reportId,
    companyId: params.companyId,
    reportType: 'vat_return',
    
    periodStart: params.startDate,
    periodEnd: params.endDate,
    filingDeadline,
    
    standardRatedSales,
    zeroRatedSales,
    exemptSales,
    totalSales,
    outputVAT,
    
    standardRatedPurchases,
    capitalPurchases,
    exemptPurchases,
    totalPurchases,
    inputVAT,
    
    netVATPayable,
    
    status: 'draft',
    
    generatedAt: now,
    generatedBy: userId,
  };
  
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);
  await setDoc(reportRef, {
    ...vatReturn,
    reportType: REPORT_TYPES.VAT_RETURN,
    parameters: params,
    periodStart: Timestamp.fromDate(params.startDate),
    periodEnd: Timestamp.fromDate(params.endDate),
    filingDeadline: Timestamp.fromDate(filingDeadline),
  });
  
  return vatReturn;
};

// ----------------------------------------------------------------------------
// GET REPORTS
// ----------------------------------------------------------------------------

export const getReport = async (reportId: string): Promise<GeneratedReport | null> => {
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);
  const snapshot = await getDoc(reportRef);
  
  if (!snapshot.exists()) return null;
  
  return { id: snapshot.id, ...snapshot.data() } as GeneratedReport;
};

export const getReports = async (filters: ReportFilters): Promise<GeneratedReport[]> => {
  const reportsRef = collection(db, REPORTS_COLLECTION);
  let q = query(reportsRef, orderBy('createdAt', 'desc'), limit(50));
  
  if (filters.reportType) {
    if (Array.isArray(filters.reportType)) {
      q = query(q, where('reportType', 'in', filters.reportType));
    } else {
      q = query(q, where('reportType', '==', filters.reportType));
    }
  }
  
  if (filters.fiscalYear) {
    q = query(q, where('fiscalYear', '==', filters.fiscalYear));
  }
  
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneratedReport));
};
