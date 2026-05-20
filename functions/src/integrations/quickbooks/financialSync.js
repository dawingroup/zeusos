/**
 * QuickBooks Financial Data Sync Service
 * Syncs P&L, Balance Sheet, Accounts, Invoices, Bills, and Bank Transactions
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { refreshTokens, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('./auth');
const { ALLOWED_ORIGINS } = require('../../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

// ----------------------------------------------------------------------------
// HELPER: Authenticated QBO API Request
// ----------------------------------------------------------------------------

/** Simple delay helper */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function qboRequest(endpoint, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const encryptionKey = TOKEN_ENCRYPTION_KEY.value();
      const tokens = await refreshTokens(encryptionKey);

      const url = `${QBO_API_BASE}/${tokens.realm_id}${endpoint}`;
      if (attempt === 1) console.log('📡 QBO API:', endpoint.slice(0, 80));

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      // Rate limited — back off and retry
      if (response.status === 429) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000); // 2s, 4s, 8s...
        console.warn(`⏳ QBO rate limited (429). Retry ${attempt}/${retries} in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ QuickBooks API error:', response.status, errorText);
        throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) {
        console.error('❌ qboRequest failed after retries:', error.message);
        throw error;
      }
      // For non-429 errors, also retry with backoff
      const backoffMs = 2000 * attempt;
      console.warn(`⚠ qboRequest error (attempt ${attempt}): ${error.message}. Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }
}

// ----------------------------------------------------------------------------
// HELPER: Create Sync Job Record
// ----------------------------------------------------------------------------

async function createSyncJob(companyId, category, userId) {
  const jobRef = db.collection('companies').doc(companyId)
    .collection('qbo_sync_jobs').doc();

  const job = {
    id: jobRef.id,
    companyId,
    category,
    status: 'syncing',
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    triggeredBy: userId,
  };

  await jobRef.set(job);
  return { ref: jobRef, job };
}

async function completeSyncJob(jobRef, recordCount) {
  await jobRef.update({
    status: 'success',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    recordCount,
  });
}

async function failSyncJob(jobRef, error) {
  await jobRef.update({
    status: 'error',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    error: error.message || 'Unknown error',
  });
}

// ----------------------------------------------------------------------------
// HELPER: Generate Monthly Periods
// ----------------------------------------------------------------------------

/**
 * Split a date range into individual month periods.
 * Partial months at boundaries use actual start/end dates.
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @returns {Array<{start: string, end: string}>}
 */
function generateMonthlyPeriods(startDate, endDate) {
  const periods = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  let cursor = new Date(start);

  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth(); // 0-based

    // Period start: either the original startDate (first iteration) or 1st of month
    const periodStart = (cursor.getTime() === start.getTime())
      ? startDate
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    // Period end: either end of month or the original endDate (last iteration)
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
    const monthEnd = new Date(y, m, lastDayOfMonth);
    const periodEnd = (monthEnd > end)
      ? endDate
      : `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    periods.push({ start: periodStart, end: periodEnd });

    // Advance to 1st of next month
    cursor = new Date(y, m + 1, 1);
  }

  return periods;
}

// ----------------------------------------------------------------------------
// SYNC ORCHESTRATOR: Monthly Financials
// ----------------------------------------------------------------------------

/**
 * Sync P&L, BS, and CF for each month in the date range.
 * Creates individual monthly docs (e.g. pl_2025-07-01_2025-07-31)
 * alongside the existing fiscal-year-wide docs.
 *
 * @param {string} companyId
 * @param {string} startDate   FY start (YYYY-MM-DD)
 * @param {string} endDate     Today (YYYY-MM-DD)
 * @param {string} userId
 * @param {object} options     { includePriorFY: bool, parallelBatch: number }
 */
async function syncMonthlyFinancials(companyId, startDate, endDate, userId, options = {}) {
  const { includePriorFY = false } = options;

  let periods = generateMonthlyPeriods(startDate, endDate);

  // Optionally prepend prior FY months for lookback
  if (includePriorFY) {
    const fyStartDate = new Date(startDate + 'T00:00:00');
    const priorFYStart = `${fyStartDate.getFullYear() - 1}-${String(fyStartDate.getMonth() + 1).padStart(2, '0')}-01`;
    // Day before current FY start
    const priorFYEndDate = new Date(fyStartDate);
    priorFYEndDate.setDate(priorFYEndDate.getDate() - 1);
    const priorFYEnd = priorFYEndDate.toISOString().split('T')[0];

    const priorPeriods = generateMonthlyPeriods(priorFYStart, priorFYEnd);
    periods = [...priorPeriods, ...periods];
  }

  console.log(`📅 Monthly sync: ${periods.length} months to process (sequential with delays)`);

  const results = { months: 0, errors: [] };

  // Process ONE month at a time with delays to avoid QBO rate limits
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    console.log(`📊 Syncing month ${i + 1}/${periods.length}: ${p.start.slice(0, 7)}`);

    try {
      // Sync P&L, BS, CF for this month (3 API calls in parallel per month is OK)
      await Promise.all([
        syncProfitAndLoss(companyId, p.start, p.end, userId),
        syncBalanceSheet(companyId, p.end, userId, p.start),
        syncCashFlow(companyId, p.start, p.end, userId),
      ]);
      results.months++;
    } catch (err) {
      console.error(`❌ Monthly sync failed for ${p.start}→${p.end}:`, err.message);
      results.errors.push({ period: p.start.slice(0, 7), error: err.message });
    }

    // Wait 1.5s between months to stay well within QBO rate limits
    if (i < periods.length - 1) {
      await sleep(1500);
    }
  }

  console.log(`✅ Monthly sync complete: ${results.months}/${periods.length} months synced`);
  return results;
}

// ----------------------------------------------------------------------------
// SYNC: Profit & Loss Report
// ----------------------------------------------------------------------------

async function syncProfitAndLoss(companyId, startDate, endDate, userId) {
  const { ref: jobRef } = await createSyncJob(companyId, 'profit_and_loss', userId);

  try {
    const response = await qboRequest(
      `/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`
    );

    const report = response;
    const header = report.Header || {};
    const rows = report.Rows?.Row || [];

    // Parse QBO report rows into structured data
    const parsed = parseReportRows(rows);

    const plData = {
      companyId,
      startDate,
      endDate,
      currency: header.Currency || 'USD',
      income: parsed.Income || [],
      costOfGoodsSold: parsed['Cost of Goods Sold'] || parsed['Cost of Sales'] || [],
      grossProfit: parsed._totals?.['Gross Profit'] || 0,
      expenses: parsed.Expenses || [],
      netOperatingIncome: parsed._totals?.['Net Operating Income'] || 0,
      otherIncome: parsed['Other Income'] || [],
      otherExpenses: parsed['Other Expenses'] || [],
      netIncome: parsed._totals?.['Net Income'] || 0,
      rawData: report,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docId = `pl_${startDate}_${endDate}`;
    await db.collection('companies').doc(companyId)
      .collection('qbo_synced_data').doc(docId).set(plData);

    await completeSyncJob(jobRef, 1);
    return plData;
  } catch (error) {
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// SYNC: Balance Sheet
// ----------------------------------------------------------------------------

async function syncBalanceSheet(companyId, asOfDate, userId, startDate) {
  const { ref: jobRef } = await createSyncJob(companyId, 'balance_sheet', userId);

  try {
    const bsDate = asOfDate || new Date().toISOString().split('T')[0];
    // Use end_date (not as_of_date) — QBO ignores unrecognized params and defaults to today.
    // Also pass start_date so Net Income in Equity is period-specific.
    const params = [`end_date=${bsDate}`, 'accounting_method=Accrual'];
    if (startDate) params.push(`start_date=${startDate}`);
    const response = await qboRequest(
      `/reports/BalanceSheet?${params.join('&')}`
    );

    const report = response;
    const header = report.Header || {};
    const rows = report.Rows?.Row || [];

    const parsed = parseReportRows(rows);
    const bsSections = extractBSSections(parsed);

    const bsData = {
      companyId,
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
      currency: header.Currency || 'USD',
      assets: bsSections.assets,
      totalAssets: bsSections.totalAssets,
      liabilities: bsSections.liabilities,
      totalLiabilities: bsSections.totalLiabilities,
      equity: bsSections.equity,
      totalEquity: bsSections.totalEquity,
      rawData: report,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docId = `bs_${bsData.asOfDate}`;
    await db.collection('companies').doc(companyId)
      .collection('qbo_synced_data').doc(docId).set(bsData);

    await completeSyncJob(jobRef, 1);
    return bsData;
  } catch (error) {
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// SYNC: Chart of Accounts
// ----------------------------------------------------------------------------

async function syncAccounts(companyId, userId) {
  const { ref: jobRef } = await createSyncJob(companyId, 'accounts', userId);

  try {
    const query = encodeURIComponent('SELECT * FROM Account MAXRESULTS 1000');
    const response = await qboRequest(`/query?query=${query}`);
    const accounts = response.QueryResponse?.Account || [];

    const batch = db.batch();
    const collectionRef = db.collection('companies').doc(companyId)
      .collection('qbo_accounts');

    for (const acct of accounts) {
      const docRef = collectionRef.doc(acct.Id);
      batch.set(docRef, {
        qboId: acct.Id,
        name: acct.Name,
        fullyQualifiedName: acct.FullyQualifiedName || acct.Name,
        accountType: acct.AccountType,
        accountSubType: acct.AccountSubType || '',
        currentBalance: acct.CurrentBalance || 0,
        currencyRef: acct.CurrencyRef?.value || 'USD',
        active: acct.Active !== false,
        classification: acct.Classification || '',
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    await completeSyncJob(jobRef, accounts.length);
    return { count: accounts.length };
  } catch (error) {
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// SYNC: Items (Products & Services)
// ----------------------------------------------------------------------------

async function syncItems(companyId, userId) {
  const { ref: jobRef } = await createSyncJob(companyId, 'items', userId);

  try {
    const query = encodeURIComponent("SELECT * FROM Item WHERE Type IN ('Service', 'NonInventory') MAXRESULTS 1000");
    const response = await qboRequest(`/query?query=${query}`);
    const items = response.QueryResponse?.Item || [];

    const batch = db.batch();
    const collectionRef = db.collection('companies').doc(companyId)
      .collection('qbo_items');

    for (const item of items) {
      const docRef = collectionRef.doc(item.Id);
      batch.set(docRef, {
        qboId: item.Id,
        name: item.Name,
        fullyQualifiedName: item.FullyQualifiedName || item.Name,
        type: item.Type,
        description: item.Description || '',
        unitPrice: item.UnitPrice || 0,
        incomeAccountRef: item.IncomeAccountRef?.value || '',
        expenseAccountRef: item.ExpenseAccountRef?.value || '',
        active: item.Active !== false,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    await completeSyncJob(jobRef, items.length);
    return { count: items.length };
  } catch (error) {
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// SYNC: Invoices
// ----------------------------------------------------------------------------

async function syncInvoices(companyId, userId, maxResults = 100) {
  const { ref: jobRef } = await createSyncJob(companyId, 'invoices', userId);

  try {
    const query = encodeURIComponent(
      `SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`
    );
    const response = await qboRequest(`/query?query=${query}`);
    const invoices = response.QueryResponse?.Invoice || [];

    const batch = db.batch();
    const collectionRef = db.collection('companies').doc(companyId)
      .collection('qbo_invoices');

    for (const inv of invoices) {
      const now = new Date();
      const dueDate = inv.DueDate ? new Date(inv.DueDate) : null;
      const isPaid = (inv.Balance || 0) === 0;
      let status = 'sent';
      if (isPaid) status = 'paid';
      else if (dueDate && dueDate < now) status = 'overdue';

      const lineItems = (inv.Line || [])
        .filter(l => l.DetailType === 'SalesItemLineDetail')
        .map(l => ({
          description: l.Description || '',
          amount: l.Amount || 0,
          quantity: l.SalesItemLineDetail?.Qty || 1,
          unitPrice: l.SalesItemLineDetail?.UnitPrice || l.Amount || 0,
          accountRef: l.SalesItemLineDetail?.ItemAccountRef?.value || '',
        }));

      const docRef = collectionRef.doc(inv.Id);
      batch.set(docRef, {
        qboId: inv.Id,
        docNumber: inv.DocNumber || '',
        customerName: inv.CustomerRef?.name || '',
        customerId: inv.CustomerRef?.value || '',
        txnDate: inv.TxnDate || '',
        dueDate: inv.DueDate || '',
        totalAmt: inv.TotalAmt || 0,
        balance: inv.Balance || 0,
        currency: inv.CurrencyRef?.value || 'USD',
        status,
        lineItems,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    await completeSyncJob(jobRef, invoices.length);
    return { count: invoices.length };
  } catch (error) {
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// SYNC: Bills
// ----------------------------------------------------------------------------

async function syncBills(companyId, userId, maxResults = 100) {
  const { ref: jobRef } = await createSyncJob(companyId, 'bills', userId);

  try {
    const query = encodeURIComponent(
      `SELECT * FROM Bill ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`
    );
    const response = await qboRequest(`/query?query=${query}`);
    const bills = response.QueryResponse?.Bill || [];

    const batch = db.batch();
    const collectionRef = db.collection('companies').doc(companyId)
      .collection('qbo_bills');

    for (const bill of bills) {
      const now = new Date();
      const dueDate = bill.DueDate ? new Date(bill.DueDate) : null;
      const isPaid = (bill.Balance || 0) === 0;
      let status = 'open';
      if (isPaid) status = 'paid';
      else if (dueDate && dueDate < now) status = 'overdue';

      const docRef = collectionRef.doc(bill.Id);
      batch.set(docRef, {
        qboId: bill.Id,
        docNumber: bill.DocNumber || '',
        vendorName: bill.VendorRef?.name || '',
        vendorId: bill.VendorRef?.value || '',
        txnDate: bill.TxnDate || '',
        dueDate: bill.DueDate || '',
        totalAmt: bill.TotalAmt || 0,
        balance: bill.Balance || 0,
        currency: bill.CurrencyRef?.value || 'USD',
        status,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    await completeSyncJob(jobRef, bills.length);
    return { count: bills.length };
  } catch (error) {
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// SYNC: Bank Transactions (Purchases + Deposits)
// ----------------------------------------------------------------------------

async function syncBankTransactions(companyId, userId, maxResults = 200) {
  const { ref: jobRef } = await createSyncJob(companyId, 'bank_transactions', userId);

  try {
    // Fetch purchases (expenses)
    const purchaseQuery = encodeURIComponent(
      `SELECT * FROM Purchase ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`
    );
    const purchaseRes = await qboRequest(`/query?query=${purchaseQuery}`);
    const purchases = purchaseRes.QueryResponse?.Purchase || [];

    // Fetch deposits
    const depositQuery = encodeURIComponent(
      `SELECT * FROM Deposit ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`
    );
    const depositRes = await qboRequest(`/query?query=${depositQuery}`);
    const deposits = depositRes.QueryResponse?.Deposit || [];

    const batch = db.batch();
    const collectionRef = db.collection('companies').doc(companyId)
      .collection('qbo_bank_transactions');

    let count = 0;

    for (const p of purchases) {
      const docRef = collectionRef.doc(`purchase_${p.Id}`);
      batch.set(docRef, {
        qboId: p.Id,
        txnDate: p.TxnDate || '',
        amount: p.TotalAmt || 0,
        accountRef: p.AccountRef?.value || '',
        accountName: p.AccountRef?.name || '',
        description: p.PrivateNote || (p.Line?.[0]?.Description) || '',
        txnType: 'expense',
        payee: p.EntityRef?.name || '',
        currency: p.CurrencyRef?.value || 'USD',
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    }

    for (const d of deposits) {
      const docRef = collectionRef.doc(`deposit_${d.Id}`);
      batch.set(docRef, {
        qboId: d.Id,
        txnDate: d.TxnDate || '',
        amount: d.TotalAmt || 0,
        accountRef: d.DepositToAccountRef?.value || '',
        accountName: d.DepositToAccountRef?.name || '',
        description: d.PrivateNote || '',
        txnType: 'deposit',
        payee: '',
        currency: d.CurrencyRef?.value || 'USD',
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    }

    await batch.commit();
    await completeSyncJob(jobRef, count);
    return { count };
  } catch (error) {
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// SYNC: Cash Flow Statement (flat named-field structure)
// ----------------------------------------------------------------------------

/**
 * Flatten all Data rows from a QBO CF report into [{label, value}].
 * Recurses into Section rows to capture nested items.
 */
function flattenCFRows(rows) {
  const items = [];
  for (const row of rows) {
    if (row.type === 'Data') {
      const label = (row.ColData?.[0]?.value || '').trim();
      const value = parseFloat(row.ColData?.[1]?.value) || 0;
      if (label) items.push({ label, value });
    } else if (row.type === 'Section') {
      const subRows = row.Rows?.Row || [];
      items.push(...flattenCFRows(subRows));
      // Also capture section summary row
      const footer = row.Summary?.ColData || [];
      if (footer.length >= 2) {
        const footLabel = (footer[0]?.value || '').trim();
        const footValue = parseFloat(footer[1]?.value) || 0;
        if (footLabel) items.push({ label: footLabel, value: footValue });
      }
    }
  }
  return items;
}

/**
 * Find first matching CF row value by keyword patterns (case-insensitive).
 * Returns the raw QBO value (already signed per QBO convention).
 */
function findCFValue(items, patterns) {
  for (const item of items) {
    const lbl = item.label.toLowerCase();
    if (patterns.some(p => lbl.includes(p.toLowerCase()))) {
      return item.value;
    }
  }
  return 0;
}

async function syncCashFlow(companyId, startDate, endDate, userId) {
  const { ref: jobRef } = await createSyncJob(companyId, 'cash_flow', userId);

  try {
    // Fetch P&L and Cash Flow reports in parallel
    const [plResponse, cfResponse] = await Promise.all([
      qboRequest(`/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`),
      qboRequest(`/reports/CashFlow?start_date=${startDate}&end_date=${endDate}`),
    ]);

    const currency = plResponse.Header?.Currency || cfResponse.Header?.Currency || 'USD';

    // ── P&L → Revenue, COGS, Expenses, Other Income ──────────────────────────
    const plRows = plResponse.Rows?.Row || [];
    const plParsed = parseReportRows(plRows);

    // Revenue: always positive (cash in). QBO reports income as positive.
    const revenue = Math.abs(plParsed._totals['Total Income'] || 0)
      || sumRows(plParsed['Income'] || plParsed['income'] || []);

    // Cost of Sales: cash out → store negative
    const cogsRaw = Math.abs(plParsed._totals['Total Cost of Goods Sold'] || plParsed._totals['Total Cost of Sales'] || 0)
      || sumRows(plParsed['Cost of Goods Sold'] || plParsed['Cost of Sales'] || []);
    const costOfSales = cogsRaw > 0 ? -cogsRaw : cogsRaw;

    // Expenses: cash out → store negative
    const expRaw = Math.abs(plParsed._totals['Total Expenses'] || 0)
      || sumRows(plParsed['Expenses'] || []);
    const expenses = expRaw > 0 ? -expRaw : expRaw;

    // Other Income: positive (cash in)
    const otherIncome = Math.abs(plParsed._totals['Total Other Income'] || 0)
      || sumRows(plParsed['Other Income'] || []);

    // ── Cash Flow report → working capital + investing + financing ────────────
    const cfRows = cfResponse.Rows?.Row || [];
    const cfItems = flattenCFRows(cfRows);

    // Helper: find CF row by keywords. QBO uses + for sources of cash, - for uses.
    const find = (patterns) => findCFValue(cfItems, patterns);

    // ── Operating working-capital items (sign from QBO) ───────────────────────
    // Cash Tax Paid: cash out → LESS → if QBO gives negative, keep; else negate
    const taxRaw = find(['income tax payable', 'taxes payable', 'income tax', 'tax paid']);
    const cashTaxPaid = taxRaw <= 0 ? taxRaw : -taxRaw; // ensure negative (cash out)

    // AP: increase in AP = source of cash = positive (ADD)
    const changeInAccountsPayable = find(['accounts payable', 'trade payables']);

    // Other Current Liabilities: source of cash = positive (ADD)
    const changeInOtherCurrentLiabilities = find([
      'other current liab', 'accrued liab', 'accrued expenses', 'other liabilities',
      'credit card', 'deferred revenue',
    ]);

    // AR: increase in AR = use of cash = negative (LESS). QBO shows AR increase as negative.
    const changeInAccountsReceivable = find(['accounts receivable', 'trade receivables']);

    // Inventory: increase = use of cash = negative (LESS)
    const changeInInventory = find(['inventory', 'stock on hand']);

    // WIP: increase = use of cash = negative (LESS)
    const changeInWorkInProgress = find(['work in progress', 'wip', 'work-in-progress', 'contract assets']);

    // Other Current Assets: increase = use of cash = negative (LESS)
    const changeInOtherCurrentAssets = find([
      'other current assets', 'prepaid', 'prepayments', 'other assets',
    ]);

    // ── Investing (all represent cash outflows → LESS) ────────────────────────
    const changeInFixedAssets = find([
      'fixed assets', 'property plant', 'plant and equipment', 'ppe',
      'purchase of fixed', 'capital expenditure', 'capex',
    ]);

    const changeInIntangibleAssets = find([
      'intangible', 'goodwill', 'intellectual property', 'patents',
    ]);

    const changeInInvestments = find([
      'investments', 'non-current assets', 'other non-current', 'long-term investments',
      'financial assets',
    ]);

    // ── Financing ─────────────────────────────────────────────────────────────
    // Net Interest: cash out = LESS → ensure negative
    const interestRaw = find(['interest', 'finance costs', 'interest expense', 'interest paid']);
    const netInterest = interestRaw <= 0 ? interestRaw : -interestRaw;

    // Other Non-Current Liabilities: LESS → ensure negative
    const ncLiabRaw = find([
      'long-term liab', 'non-current liab', 'long term debt', 'notes payable',
      'loans payable', 'mortgage', 'deferred tax',
    ]);
    const changeInOtherNonCurrentLiabilities = ncLiabRaw <= 0 ? ncLiabRaw : -ncLiabRaw;

    // Dividends: ADD → positive
    const divRaw = find(['dividend', 'distribution to owner', 'owner draw']);
    const dividends = divRaw >= 0 ? divRaw : -divRaw;

    // Retained Earnings & Equity: ADD → positive
    const reRaw = find([
      'retained earnings', 'share capital', 'owner equity', 'equity', 'paid-in capital',
    ]);
    const changeInRetainedEarnings = reRaw >= 0 ? reRaw : -reRaw;

    // Adjustments (depreciation add-back, etc.): ADD → positive
    const adjRaw = find([
      'depreciation', 'amortisation', 'amortization', 'adjustment',
      'non-cash', 'unrealised', 'unrealized',
    ]);
    const adjustments = adjRaw >= 0 ? adjRaw : -adjRaw;

    // ── Calculate subtotals ───────────────────────────────────────────────────
    const operatingCashFlow = (
      revenue + costOfSales + expenses + otherIncome + cashTaxPaid
      + changeInAccountsPayable + changeInOtherCurrentLiabilities
      + changeInAccountsReceivable + changeInInventory
      + changeInWorkInProgress + changeInOtherCurrentAssets
    );

    const freeCashFlow = operatingCashFlow
      + changeInFixedAssets + changeInIntangibleAssets + changeInInvestments;

    const netCashFlow = freeCashFlow
      + netInterest + changeInOtherNonCurrentLiabilities
      + dividends + changeInRetainedEarnings + adjustments;

    const cfData = {
      companyId,
      startDate,
      endDate,
      currency,
      // Operating Activities
      revenue,
      costOfSales,
      expenses,
      otherIncome,
      cashTaxPaid,
      changeInAccountsPayable,
      changeInOtherCurrentLiabilities,
      changeInAccountsReceivable,
      changeInInventory,
      changeInWorkInProgress,
      changeInOtherCurrentAssets,
      operatingCashFlow,
      // Investing Activities
      changeInFixedAssets,
      changeInIntangibleAssets,
      changeInInvestments,
      freeCashFlow,
      // Financing Activities
      netInterest,
      changeInOtherNonCurrentLiabilities,
      dividends,
      changeInRetainedEarnings,
      adjustments,
      netCashFlow,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docId = `cf_${startDate}_${endDate}`;
    await db.collection('companies').doc(companyId)
      .collection('qbo_synced_data').doc(docId).set(cfData);

    await completeSyncJob(jobRef, 1);
    return cfData;
  } catch (error) {
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// HELPER: Sum a rows array from parseReportRows output
// ----------------------------------------------------------------------------

function sumRows(rows) {
  if (!Array.isArray(rows)) return 0;
  let total = 0;
  for (const row of rows) {
    if (typeof row.value === 'number') total += row.value;
    if (Array.isArray(row.subRows)) total += sumRows(row.subRows);
  }
  return total;
}

// ----------------------------------------------------------------------------
// HELPER: Parse QBO Report Rows
// ----------------------------------------------------------------------------

function parseReportRows(rows, depth = 0) {
  const result = { _totals: {} };

  for (const row of rows) {
    if (row.type === 'Section') {
      const sectionName = row.Header?.ColData?.[0]?.value || `Section_${depth}`;
      const subRows = row.Rows?.Row || [];
      const footer = row.Summary?.ColData || [];

      result[sectionName] = subRows
        .filter(r => r.type === 'Data')
        .map(r => ({
          label: r.ColData?.[0]?.value || '',
          value: parseFloat(r.ColData?.[1]?.value) || 0,
        }));

      // Also parse nested sections
      const nested = subRows.filter(r => r.type === 'Section');
      if (nested.length > 0) {
        const nestedParsed = parseReportRows(nested, depth + 1);
        for (const [key, val] of Object.entries(nestedParsed)) {
          if (key === '_totals') {
            Object.assign(result._totals, val);
          } else {
            result[sectionName] = [
              ...(result[sectionName] || []),
              { group: key, label: key, value: 0, subRows: val },
            ];
          }
        }
      }

      // Extract total from footer
      if (footer.length >= 2) {
        const totalLabel = footer[0]?.value || sectionName;
        const totalValue = parseFloat(footer[1]?.value) || 0;
        result._totals[totalLabel] = totalValue;
      }
    }
  }

  return result;
}

// ----------------------------------------------------------------------------
// HELPER: Extract BS Sections (handles combined liabilities+equity)
// ----------------------------------------------------------------------------

/**
 * Extract BS sections from parsed report data.
 * Handles QBO's variable section naming — some companies return separate
 * "Liabilities" and "Equity" sections, others return a combined
 * "Liabilities and shareholder's equity" section.
 */
function extractBSSections(parsed) {
  // ── Assets ──
  const assets = parsed.Assets || parsed['ASSETS'] || [];
  let totalAssets = parsed._totals?.['ASSETS'] || parsed._totals?.['Total Assets'] || 0;
  // Also check for "Total ASSETS" or other variations
  if (!totalAssets) {
    for (const [k, v] of Object.entries(parsed._totals || {})) {
      if (k.toLowerCase().includes('asset') && k.toLowerCase().includes('total')) {
        totalAssets = v;
        break;
      }
    }
  }

  // ── Liabilities & Equity — try direct keys first ──
  let liabilities = parsed.Liabilities || parsed['LIABILITIES'] || [];
  let totalLiabilities = parsed._totals?.['LIABILITIES'] || parsed._totals?.['Total Liabilities'] || 0;
  let equity = parsed.Equity || parsed['EQUITY'] || [];
  let totalEquity = parsed._totals?.['EQUITY'] || parsed._totals?.['Total Equity'] || 0;

  // If both are empty, look for a combined section
  if (liabilities.length === 0 && equity.length === 0) {
    for (const [key, value] of Object.entries(parsed)) {
      if (key === '_totals') continue;
      const keyLower = key.toLowerCase();

      // Match combined sections like "Liabilities and shareholder's equity"
      if (keyLower.includes('liabilit') && (keyLower.includes('equity') || keyLower.includes('shareholder'))) {
        const items = Array.isArray(value) ? value : [];
        console.log(`📊 BS: Found combined section "${key}" with ${items.length} sub-items`);

        for (const item of items) {
          const itemLabel = ((item.group || '') + ' ' + (item.label || '')).toLowerCase();

          if (itemLabel.includes('equity') || itemLabel.includes('shareholder') || itemLabel.includes('retained') || itemLabel.includes('capital')) {
            // Equity sub-section
            if (Array.isArray(item.subRows) && item.subRows.length > 0) {
              equity.push(...item.subRows);
            } else {
              equity.push(item);
            }
          } else {
            // Liabilities sub-section (accounts payable, loans, current liabilities, etc.)
            if (Array.isArray(item.subRows) && item.subRows.length > 0) {
              liabilities.push(...item.subRows);
            } else {
              liabilities.push(item);
            }
          }
        }

        // Extract totals from _totals keys
        for (const [tk, tv] of Object.entries(parsed._totals || {})) {
          const tkLower = tk.toLowerCase();
          if (!totalLiabilities && tkLower.includes('liabilit') && !tkLower.includes('equity') && !tkLower.includes('shareholder')) {
            totalLiabilities = tv;
          }
          if (!totalEquity && (tkLower.includes('equity') || tkLower.includes('shareholder')) && !tkLower.includes('liabilit')) {
            totalEquity = tv;
          }
        }

        console.log(`📊 BS: Split into ${liabilities.length} liability rows, ${equity.length} equity rows`);
        break;
      }
    }
  }

  return { assets, totalAssets, liabilities, totalLiabilities, equity, totalEquity };
}

// ============================================================================
// CALLABLE FUNCTIONS
// ============================================================================

/**
 * Sync all QBO financial data
 */
exports.syncAllQBOData = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 540,
  memory: '1GiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, categories } = request.data;
  if (!companyId) {
    throw new HttpsError('invalid-argument', 'companyId is required');
  }

  const userId = request.auth.uid;
  const results = {};
  const errors = {};

  // Default date range: current fiscal year
  const now = new Date();
  const fyStart = now.getMonth() >= 6
    ? `${now.getFullYear()}-07-01`
    : `${now.getFullYear() - 1}-07-01`;
  const today = now.toISOString().split('T')[0];

  const categoriesToSync = categories || [
    'profit_and_loss', 'balance_sheet', 'cash_flow', 'accounts',
    'invoices', 'bills', 'bank_transactions',
  ];

  // Track whether monthly sync has been done (P&L, BS, CF are handled together)
  let monthlyDone = false;

  for (const cat of categoriesToSync) {
    try {
      switch (cat) {
        case 'profit_and_loss':
        case 'balance_sheet':
        case 'cash_flow':
          // Monthly sync handles P&L, BS, and CF together
          if (!monthlyDone) {
            console.log('📅 Starting monthly financial sync...');
            results.monthly = await syncMonthlyFinancials(companyId, fyStart, today, userId, {
              includePriorFY: true,
            });
            monthlyDone = true;
            // Pause before fiscal-year-wide calls to avoid rate limits
            await sleep(3000);
          }
          // Also keep fiscal-year-wide P&L for existing report pages
          if (cat === 'profit_and_loss') {
            results.profit_and_loss = await syncProfitAndLoss(companyId, fyStart, today, userId);
            await sleep(2000);
          }
          // Also keep fiscal-year-wide CF for existing report pages
          if (cat === 'cash_flow') {
            results.cash_flow = await syncCashFlow(companyId, fyStart, today, userId);
          }
          break;
        case 'accounts':
          results.accounts = await syncAccounts(companyId, userId);
          break;
        case 'items':
          results.items = await syncItems(companyId, userId);
          break;
        case 'invoices':
          results.invoices = await syncInvoices(companyId, userId);
          break;
        case 'bills':
          results.bills = await syncBills(companyId, userId);
          break;
        case 'bank_transactions':
          results.bank_transactions = await syncBankTransactions(companyId, userId);
          break;
      }
    } catch (error) {
      console.error(`Error syncing ${cat}:`, error);
      errors[cat] = error.message;
    }
  }

  // Update last sync timestamp
  await db.collection('integrations').doc('quickbooks').update({
    lastFullSync: admin.firestore.FieldValue.serverTimestamp(),
    lastSyncBy: userId,
  });

  return {
    success: Object.keys(errors).length === 0,
    results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
});

/**
 * Sync a single QBO data category
 */
exports.syncQBOCategory = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 120,
  memory: '256MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, category, startDate, endDate } = request.data;
  if (!companyId || !category) {
    throw new HttpsError('invalid-argument', 'companyId and category are required');
  }

  console.log(`📊 Syncing QBO category: ${category} for company: ${companyId}`);

  const userId = request.auth.uid;
  const now = new Date();
  const fyStart = now.getMonth() >= 6
    ? `${now.getFullYear()}-07-01`
    : `${now.getFullYear() - 1}-07-01`;
  const today = now.toISOString().split('T')[0];

  try {
    let result;
    switch (category) {
      case 'profit_and_loss':
        result = await syncProfitAndLoss(companyId, startDate || fyStart, endDate || today, userId);
        break;
      case 'balance_sheet':
        result = await syncBalanceSheet(companyId, endDate || today, userId, startDate || fyStart);
        break;
      case 'cash_flow':
        result = await syncCashFlow(companyId, startDate || fyStart, endDate || today, userId);
        break;
      case 'accounts':
        result = await syncAccounts(companyId, userId);
        break;
      case 'items':
        result = await syncItems(companyId, userId);
        break;
      case 'invoices':
        result = await syncInvoices(companyId, userId);
        break;
      case 'bills':
        result = await syncBills(companyId, userId);
        break;
      case 'bank_transactions':
        result = await syncBankTransactions(companyId, userId);
        break;
      default:
        throw new HttpsError('invalid-argument', `Unknown category: ${category}`);
    }

    console.log(`✅ Successfully synced ${category}`);
    return { success: true, category, result };
  } catch (error) {
    console.error(`❌ Failed to sync ${category}:`, error.message);
    console.error('Error details:', error);
    throw new HttpsError('internal', error.message || `Failed to sync ${category}`);
  }
});

/**
 * Get QBO sync history for a company
 */
exports.getQBOSyncHistory = onCall({
  cors: ALLOWED_ORIGINS,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, limit: maxJobs = 20 } = request.data;
  if (!companyId) {
    throw new HttpsError('invalid-argument', 'companyId is required');
  }

  const snapshot = await db.collection('companies').doc(companyId)
    .collection('qbo_sync_jobs')
    .orderBy('startedAt', 'desc')
    .limit(maxJobs)
    .get();

  const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return { jobs };
});
