/**
 * GENERATE AMH REPORT (Cloud Function)
 *
 * Callable function that generates an AMH (Accountability, Monitoring &
 * Harmonization) report as an HTML document stored in Firebase Storage.
 * Aggregates data across selected projects for the specified period.
 *
 * Trigger: onCall (authenticated users only)
 * Input:  { organizationId, projectIds, period, sections, outputFormat }
 * Output: { reportId, pdfUrl }
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { ALLOWED_ORIGINS } = require('../config/cors');

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatAmount(amount, currency = 'UGX') {
  if (amount == null) return '—';
  if (currency === 'USD') {
    return `USD ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `UGX ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  if (timestamp.toDate) return timestamp.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (typeof timestamp === 'string') return new Date(timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return '—';
}

function formatPercent(value) {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

function varianceStatusBadge(status) {
  const colors = {
    within_budget: { bg: '#dcfce7', text: '#166534', label: 'Within Budget' },
    minor_variance: { bg: '#fef9c3', text: '#854d0e', label: 'Minor Variance' },
    significant_variance: { bg: '#fed7aa', text: '#9a3412', label: 'Significant' },
    critical_variance: { bg: '#fecaca', text: '#991b1b', label: 'Critical' },
  };
  const style = colors[status] || colors.within_budget;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${style.bg};color:${style.text};">${style.label}</span>`;
}

function proofStatusBadge(status) {
  const colors = {
    complete: { bg: '#dcfce7', text: '#166534' },
    partial: { bg: '#fef9c3', text: '#854d0e' },
    missing: { bg: '#fecaca', text: '#991b1b' },
  };
  const style = colors[status] || colors.missing;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${style.bg};color:${style.text};">${status}</span>`;
}

// ─────────────────────────────────────────────────────────────────
// DATA AGGREGATION
// ─────────────────────────────────────────────────────────────────

async function getProjects(db, organizationId, projectIds) {
  const projects = [];
  for (const id of projectIds) {
    const snap = await db.doc(`organizations/${organizationId}/projects/${id}`).get();
    if (snap.exists) projects.push({ id: snap.id, ...snap.data() });
  }
  return projects;
}

async function getAccountabilities(db, organizationId, projectIds, periodStart, periodEnd) {
  const entries = [];
  for (const projectId of projectIds) {
    const snap = await db
      .collection(`organizations/${organizationId}/accountabilities`)
      .where('projectId', '==', projectId)
      .get();
    snap.forEach((doc) => {
      const data = doc.data();
      // Filter by period if available
      const entryDate = data.submittedAt?.toDate?.() || data.createdAt?.toDate?.();
      if (entryDate && periodStart && periodEnd) {
        if (entryDate < periodStart || entryDate > periodEnd) return;
      }
      entries.push({ id: doc.id, ...data });
    });
  }
  return entries;
}

async function getRequisitions(db, organizationId, projectIds, periodStart, periodEnd) {
  const requisitions = [];
  for (const projectId of projectIds) {
    const snap = await db
      .collection(`organizations/${organizationId}/requisitions`)
      .where('projectId', '==', projectId)
      .get();
    snap.forEach((doc) => {
      const data = doc.data();
      const reqDate = data.createdAt?.toDate?.();
      if (reqDate && periodStart && periodEnd) {
        if (reqDate < periodStart || reqDate > periodEnd) return;
      }
      requisitions.push({ id: doc.id, ...data });
    });
  }
  return requisitions;
}

// ─────────────────────────────────────────────────────────────────
// SECTION GENERATORS
// ─────────────────────────────────────────────────────────────────

function buildProjectSummarySection(projects) {
  if (!projects.length) return '';
  const rows = projects.map((p) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${p.name || p.projectName || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${p.projectCode || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${p.status || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${p.projectManager || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${p.location || '—'}</td>
    </tr>`).join('');

  return `
    <div class="section">
      <h2>1. Project Summary</h2>
      <table>
        <thead><tr>
          <th>Project</th><th>Code</th><th>Status</th><th>Manager</th><th>Location</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function buildBudgetOverviewSection(projects, accountabilities, currency) {
  const projectBudgets = projects.map((p) => {
    const budget = p.totalBudget || p.budget?.total || 0;
    const spent = accountabilities
      .filter((a) => a.projectId === p.id)
      .reduce((sum, a) => {
        const expenses = a.expenses || [];
        return sum + expenses.reduce((eSum, e) => eSum + (e.amount || 0), 0);
      }, 0);
    const utilization = budget > 0 ? (spent / budget) * 100 : 0;
    return { name: p.name || p.projectName, budget, spent, remaining: budget - spent, utilization };
  });

  const consolidated = {
    budget: projectBudgets.reduce((s, b) => s + b.budget, 0),
    spent: projectBudgets.reduce((s, b) => s + b.spent, 0),
  };
  consolidated.remaining = consolidated.budget - consolidated.spent;
  consolidated.utilization = consolidated.budget > 0 ? (consolidated.spent / consolidated.budget) * 100 : 0;

  const rows = projectBudgets.map((b) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${b.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(b.budget, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(b.spent, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(b.remaining, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPercent(b.utilization)}</td>
    </tr>`).join('');

  return `
    <div class="section">
      <h2>2. Budget Overview</h2>
      <table>
        <thead><tr>
          <th>Project</th><th style="text-align:right;">Budget</th><th style="text-align:right;">Spent</th>
          <th style="text-align:right;">Remaining</th><th style="text-align:right;">Utilization</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td style="padding:8px 12px;font-weight:700;border-top:2px solid #e5e7eb;">Consolidated</td>
          <td style="padding:8px 12px;font-weight:700;text-align:right;border-top:2px solid #e5e7eb;">${formatAmount(consolidated.budget, currency)}</td>
          <td style="padding:8px 12px;font-weight:700;text-align:right;border-top:2px solid #e5e7eb;">${formatAmount(consolidated.spent, currency)}</td>
          <td style="padding:8px 12px;font-weight:700;text-align:right;border-top:2px solid #e5e7eb;">${formatAmount(consolidated.remaining, currency)}</td>
          <td style="padding:8px 12px;font-weight:700;text-align:right;border-top:2px solid #e5e7eb;">${formatPercent(consolidated.utilization)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}

function buildAccountabilitySection(accountabilities, projects, currency) {
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name || p.projectName]));
  let totalAccounted = 0;
  let entryCount = 0;
  const allExpenses = [];

  for (const acc of accountabilities) {
    const expenses = acc.expenses || [];
    for (const exp of expenses) {
      const amount = exp.amount || 0;
      totalAccounted += amount;
      entryCount++;
      allExpenses.push({
        date: exp.date || acc.submittedAt || '—',
        description: exp.description || '—',
        amount,
        category: exp.category || '—',
        vendor: exp.vendor || '—',
        project: projectMap[acc.projectId] || '—',
        proofStatus: exp.documents?.length > 0 ? 'complete' : 'missing',
      });
    }
  }

  const rows = allExpenses.slice(0, 100).map((e) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${formatDate(e.date)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${e.description}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${e.category}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${e.vendor}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;">${formatAmount(e.amount, currency)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${proofStatusBadge(e.proofStatus)}</td>
    </tr>`).join('');

  return `
    <div class="section">
      <h2>3. Accountability Entries</h2>
      <div class="summary-cards">
        <div class="card"><div class="card-label">Total Accounted</div><div class="card-value">${formatAmount(totalAccounted, currency)}</div></div>
        <div class="card"><div class="card-label">Entry Count</div><div class="card-value">${entryCount}</div></div>
      </div>
      ${allExpenses.length > 0 ? `
      <table>
        <thead><tr>
          <th>Date</th><th>Description</th><th>Category</th><th>Vendor</th><th style="text-align:right;">Amount</th><th>Proof</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${allExpenses.length > 100 ? `<p style="color:#6b7280;font-size:12px;text-align:center;">Showing 100 of ${allExpenses.length} entries</p>` : ''}
      ` : '<p style="color:#6b7280;">No accountability entries found for this period.</p>'}
    </div>`;
}

function buildVarianceSection(projects, accountabilities, currency) {
  const categoryTotals = {};
  const projectTotals = {};

  for (const acc of accountabilities) {
    const expenses = acc.expenses || [];
    for (const exp of expenses) {
      const cat = exp.category || 'other';
      if (!categoryTotals[cat]) categoryTotals[cat] = { actual: 0, budgeted: 0 };
      categoryTotals[cat].actual += exp.amount || 0;

      if (!projectTotals[acc.projectId]) projectTotals[acc.projectId] = { actual: 0, budgeted: 0 };
      projectTotals[acc.projectId].actual += exp.amount || 0;
    }
  }

  for (const p of projects) {
    if (!projectTotals[p.id]) projectTotals[p.id] = { actual: 0, budgeted: 0 };
    projectTotals[p.id].budgeted = p.totalBudget || p.budget?.total || 0;
    projectTotals[p.id].name = p.name || p.projectName;
  }

  const catRows = Object.entries(categoryTotals).map(([cat, data]) => {
    const variance = data.budgeted - data.actual;
    const pct = data.budgeted > 0 ? ((data.actual - data.budgeted) / data.budgeted) * 100 : 0;
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${cat}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(data.actual, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(variance, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPercent(Math.abs(pct))}</td>
    </tr>`;
  }).join('');

  const projRows = Object.entries(projectTotals).map(([, data]) => {
    const variance = data.budgeted - data.actual;
    const pct = data.budgeted > 0 ? ((data.actual - data.budgeted) / data.budgeted) * 100 : 0;
    let status = 'within_budget';
    if (Math.abs(pct) > 20) status = 'critical_variance';
    else if (Math.abs(pct) > 10) status = 'significant_variance';
    else if (Math.abs(pct) > 5) status = 'minor_variance';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${data.name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(data.budgeted, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(data.actual, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(variance, currency)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${varianceStatusBadge(status)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="section">
      <h2>4. Variance Analysis</h2>
      <h3>By Category</h3>
      <table>
        <thead><tr><th>Category</th><th style="text-align:right;">Actual</th><th style="text-align:right;">Variance</th><th style="text-align:right;">%</th></tr></thead>
        <tbody>${catRows || '<tr><td colspan="4" style="padding:12px;color:#6b7280;">No data</td></tr>'}</tbody>
      </table>
      <h3>By Project</h3>
      <table>
        <thead><tr><th>Project</th><th style="text-align:right;">Budget</th><th style="text-align:right;">Actual</th><th style="text-align:right;">Variance</th><th>Status</th></tr></thead>
        <tbody>${projRows || '<tr><td colspan="5" style="padding:12px;color:#6b7280;">No data</td></tr>'}</tbody>
      </table>
    </div>`;
}

function buildReconciliationSection(requisitions, accountabilities, currency) {
  const totalAdvances = requisitions.reduce((s, r) => s + (r.totalAmount || r.amount || 0), 0);
  const totalAccounted = accountabilities.reduce((s, a) => {
    const expenses = a.expenses || [];
    return s + expenses.reduce((eS, e) => eS + (e.amount || 0), 0);
  }, 0);
  const outstanding = totalAdvances - totalAccounted;
  const matched = accountabilities.filter((a) => a.requisitionId).length;
  const unmatched = accountabilities.filter((a) => !a.requisitionId).length;

  return `
    <div class="section">
      <h2>5. Reconciliation Status</h2>
      <div class="summary-cards">
        <div class="card"><div class="card-label">Total Advances</div><div class="card-value">${formatAmount(totalAdvances, currency)}</div></div>
        <div class="card"><div class="card-label">Total Accounted</div><div class="card-value">${formatAmount(totalAccounted, currency)}</div></div>
        <div class="card"><div class="card-label">Outstanding Balance</div><div class="card-value" style="color:${outstanding > 0 ? '#dc2626' : '#16a34a'};">${formatAmount(outstanding, currency)}</div></div>
      </div>
      <table>
        <thead><tr><th>Metric</th><th style="text-align:right;">Value</th></tr></thead>
        <tbody>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Matched to Requisitions</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${matched}</td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Unmatched Entries</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${unmatched}</td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Total Requisitions</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${requisitions.length}</td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Total Accountabilities</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${accountabilities.length}</td></tr>
        </tbody>
      </table>
    </div>`;
}

function buildDocumentationSection(accountabilities) {
  let totalExpenses = 0;
  let withReceipts = 0;
  const missing = [];

  for (const acc of accountabilities) {
    const expenses = acc.expenses || [];
    for (const exp of expenses) {
      totalExpenses++;
      if (exp.documents?.length > 0) {
        withReceipts++;
      } else {
        missing.push({
          description: exp.description || '—',
          amount: exp.amount || 0,
          missingDocs: ['Receipt'],
        });
      }
    }
  }

  const completeness = totalExpenses > 0 ? (withReceipts / totalExpenses) * 100 : 100;
  const completenessColor = completeness >= 80 ? '#16a34a' : completeness >= 50 ? '#ca8a04' : '#dc2626';

  const missingRows = missing.slice(0, 20).map((m) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${m.description}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;">${formatAmount(m.amount)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${m.missingDocs.join(', ')}</td>
    </tr>`).join('');

  return `
    <div class="section">
      <h2>6. Documentation Completeness</h2>
      <div class="summary-cards">
        <div class="card"><div class="card-label">Total Expenses</div><div class="card-value">${totalExpenses}</div></div>
        <div class="card"><div class="card-label">With Receipts</div><div class="card-value">${withReceipts}</div></div>
        <div class="card"><div class="card-label">Completeness</div><div class="card-value" style="color:${completenessColor};">${formatPercent(completeness)}</div></div>
      </div>
      ${missing.length > 0 ? `
      <h3>Missing Documentation</h3>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right;">Amount</th><th>Missing</th></tr></thead>
        <tbody>${missingRows}</tbody>
      </table>
      ${missing.length > 20 ? `<p style="color:#6b7280;font-size:12px;text-align:center;">Showing 20 of ${missing.length} items</p>` : ''}
      ` : '<p style="color:#16a34a;font-weight:600;">All expenses have supporting documentation ✓</p>'}
    </div>`;
}

function buildApprovalsSection(accountabilities) {
  const pending = accountabilities.filter((a) => a.status === 'pending' || a.status === 'submitted');
  const approved = accountabilities.filter((a) => a.status === 'approved');
  const rejected = accountabilities.filter((a) => a.status === 'rejected');

  const buildRows = (items) => items.slice(0, 20).map((a) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${a.description || a.requisitionNumber || '—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;">${formatAmount(
        (a.expenses || []).reduce((s, e) => s + (e.amount || 0), 0)
      )}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${a.submittedBy || '—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${formatDate(a.submittedAt || a.createdAt)}</td>
    </tr>`).join('');

  return `
    <div class="section">
      <h2>7. Approvals</h2>
      <div class="summary-cards">
        <div class="card" style="border-left:3px solid #f59e0b;"><div class="card-label">Pending</div><div class="card-value">${pending.length}</div></div>
        <div class="card" style="border-left:3px solid #22c55e;"><div class="card-label">Approved</div><div class="card-value">${approved.length}</div></div>
        <div class="card" style="border-left:3px solid #ef4444;"><div class="card-label">Rejected</div><div class="card-value">${rejected.length}</div></div>
      </div>
      ${pending.length > 0 ? `
      <h3>Pending Approvals</h3>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right;">Amount</th><th>Requested By</th><th>Date</th></tr></thead>
        <tbody>${buildRows(pending)}</tbody>
      </table>` : ''}
      ${rejected.length > 0 ? `
      <h3>Rejected Items</h3>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right;">Amount</th><th>Requested By</th><th>Date</th></tr></thead>
        <tbody>${buildRows(rejected)}</tbody>
      </table>` : ''}
    </div>`;
}

function buildAuditTrailSection(accountabilities, requisitions) {
  const events = [];

  for (const acc of accountabilities) {
    events.push({
      timestamp: acc.createdAt?.toDate?.() || new Date(),
      action: 'Accountability submitted',
      user: acc.submittedBy || '—',
      details: `${(acc.expenses || []).length} expense(s) totaling ${formatAmount(
        (acc.expenses || []).reduce((s, e) => s + (e.amount || 0), 0)
      )}`,
    });
    if (acc.approvedAt) {
      events.push({
        timestamp: acc.approvedAt?.toDate?.() || new Date(),
        action: 'Accountability approved',
        user: acc.approvedBy || '—',
        details: acc.description || '',
      });
    }
  }

  for (const req of requisitions) {
    events.push({
      timestamp: req.createdAt?.toDate?.() || new Date(),
      action: 'Requisition created',
      user: req.createdBy || req.requestedBy || '—',
      details: `${req.requisitionNumber || '—'} — ${formatAmount(req.totalAmount || req.amount)}`,
    });
  }

  events.sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));

  const rows = events.slice(0, 50).map((e) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;white-space:nowrap;">${e.timestamp?.toLocaleString?.('en-GB') || '—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600;">${e.action}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;">${e.user}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;">${e.details}</td>
    </tr>`).join('');

  return `
    <div class="section">
      <h2>8. Audit Trail</h2>
      <table>
        <thead><tr><th>Timestamp</th><th>Action</th><th>User</th><th>Details</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="padding:12px;color:#6b7280;">No audit events</td></tr>'}</tbody>
      </table>
      ${events.length > 50 ? `<p style="color:#6b7280;font-size:12px;text-align:center;">Showing 50 of ${events.length} events</p>` : ''}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// HTML REPORT TEMPLATE
// ─────────────────────────────────────────────────────────────────

function generateReportHtml({ title, period, projectNames, sectionHtml }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; color: #111827; line-height: 1.5; }
    .report { max-width: 900px; margin: 0 auto; }
    .header { border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 32px; }
    .header h1 { font-size: 28px; color: #1e40af; margin: 0 0 4px 0; }
    .header .subtitle { color: #6b7280; font-size: 14px; margin: 4px 0; }
    .header .period { font-size: 16px; color: #374151; font-weight: 600; margin-top: 8px; }
    .section { margin-bottom: 36px; page-break-inside: avoid; }
    .section h2 { font-size: 18px; color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 8px; margin-bottom: 16px; }
    .section h3 { font-size: 14px; color: #374151; margin: 16px 0 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
    thead th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.03em; }
    .summary-cards { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .card { flex: 1; min-width: 140px; padding: 12px 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
    .card-label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    .card-value { font-size: 20px; font-weight: 700; color: #111827; margin-top: 2px; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; text-align: center; margin-top: 40px; }
    @media print { body { padding: 20px; } .report { max-width: none; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>AMH Accountability Report</h1>
      <p class="subtitle">${title}</p>
      <p class="period">Period: ${period}</p>
      <p class="subtitle">Projects: ${projectNames}</p>
    </div>
    ${sectionHtml}
    <div class="footer">
      Generated by DawinOS &mdash; ${new Date().toISOString().split('T')[0]}
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────
// CLOUD FUNCTION
// ─────────────────────────────────────────────────────────────────

exports.generateAMHReport = onCall(
  {
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const {
      organizationId,
      projectIds,
      period,
      sections = ['summary', 'budget', 'accountability', 'variance', 'reconciliation', 'documentation', 'approvals', 'auditTrail'],
      outputFormat = 'pdf',
      title = 'AMH Accountability Report',
    } = request.data;

    if (!organizationId || !projectIds?.length) {
      throw new HttpsError('invalid-argument', 'organizationId and projectIds are required');
    }

    const db = getFirestore();
    const userId = request.auth.uid;

    // Create report document
    const reportRef = db.collection(`organizations/${organizationId}/amh_reports`).doc();
    await reportRef.set({
      title,
      organizationId,
      projectIds,
      period: period || null,
      enabledSections: sections,
      status: 'generating',
      generatedBy: userId,
      generatedAt: FieldValue.serverTimestamp(),
      pdfUrl: null,
      error: null,
    });

    try {
      // Parse period dates
      let periodStart = null;
      let periodEnd = null;
      if (period?.startDate) periodStart = new Date(period.startDate);
      if (period?.endDate) periodEnd = new Date(period.endDate);

      const periodLabel = period
        ? `${periodStart?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) || '—'} to ${periodEnd?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) || '—'}`
        : 'All time';

      // Fetch data in parallel
      const [projects, accountabilities, requisitions] = await Promise.all([
        getProjects(db, organizationId, projectIds),
        getAccountabilities(db, organizationId, projectIds, periodStart, periodEnd),
        getRequisitions(db, organizationId, projectIds, periodStart, periodEnd),
      ]);

      const projectNames = projects.map((p) => p.name || p.projectName || '—').join(', ');
      const currency = 'UGX'; // Default

      // Build enabled sections
      let sectionHtml = '';
      const sectionSet = new Set(sections);

      if (sectionSet.has('summary')) sectionHtml += buildProjectSummarySection(projects);
      if (sectionSet.has('budget')) sectionHtml += buildBudgetOverviewSection(projects, accountabilities, currency);
      if (sectionSet.has('accountability')) sectionHtml += buildAccountabilitySection(accountabilities, projects, currency);
      if (sectionSet.has('variance')) sectionHtml += buildVarianceSection(projects, accountabilities, currency);
      if (sectionSet.has('reconciliation')) sectionHtml += buildReconciliationSection(requisitions, accountabilities, currency);
      if (sectionSet.has('documentation')) sectionHtml += buildDocumentationSection(accountabilities);
      if (sectionSet.has('approvals')) sectionHtml += buildApprovalsSection(accountabilities);
      if (sectionSet.has('auditTrail')) sectionHtml += buildAuditTrailSection(accountabilities, requisitions);

      const html = generateReportHtml({ title, period: periodLabel, projectNames, sectionHtml });

      // Upload to Storage
      const bucket = getStorage().bucket();
      const filePath = `organizations/${organizationId}/reports/amh/${reportRef.id}.html`;
      const file = bucket.file(filePath);

      await file.save(html, {
        contentType: 'text/html',
        metadata: {
          cacheControl: 'public, max-age=86400',
          customMetadata: {
            reportId: reportRef.id,
            organizationId,
            generatedAt: new Date().toISOString(),
            projectCount: String(projectIds.length),
          },
        },
      });

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '01-01-2100',
      });

      // Update report document
      await reportRef.update({
        status: 'final',
        pdfUrl: signedUrl,
        projectNames: projects.map((p) => p.name || p.projectName || '—'),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { reportId: reportRef.id, pdfUrl: signedUrl };
    } catch (err) {
      console.error('AMH Report generation failed:', err);
      await reportRef.update({
        status: 'error',
        error: err.message || 'Unknown error',
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError('internal', `Report generation failed: ${err.message}`);
    }
  }
);
