/**
 * GENERATE ALLOCATION MEMO (Cloud Function)
 *
 * Callable function that generates a PDF allocation memo for a multi-project
 * allocation group. The memo is stored in Firebase Storage and the URL is
 * written back to the allocation group document.
 *
 * Trigger: onCall (authenticated users only)
 * Input:  { allocationGroupId: string, organizationId: string }
 * Output: { memoUrl: string }
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { ALLOWED_ORIGINS } = require('../config/cors');

/**
 * Format a number as currency string
 */
function formatAmount(amount, currency) {
  if (currency === 'USD') {
    return `USD ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `UGX ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format a Firestore Timestamp to readable date
 */
function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return '—';
  return timestamp.toDate().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Generate HTML for the allocation memo
 */
function generateMemoHtml(group) {
  const rows = group.allocations
    .map(
      (alloc, i) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${alloc.projectName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${alloc.budgetCategory}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${alloc.percentage.toFixed(1)}%</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatAmount(alloc.allocatedAmount, group.currency)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Allocation Memo ${group.groupNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; color: #111827; }
    .memo { max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #4f46e5; margin: 0 0 4px 0; }
    .header p { margin: 0; color: #6b7280; font-size: 14px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .meta-item { padding: 12px; background: #f9fafb; border-radius: 8px; }
    .meta-label { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    .meta-value { font-size: 15px; font-weight: 600; color: #111827; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.03em; }
    thead th:nth-child(4), thead th:nth-child(5) { text-align: right; }
    tfoot td { padding: 10px 12px; font-weight: 700; border-top: 2px solid #e5e7eb; background: #f9fafb; }
    .rationale { padding: 16px; background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; margin-bottom: 24px; }
    .rationale h3 { font-size: 13px; text-transform: uppercase; color: #92400e; margin: 0 0 8px 0; }
    .rationale p { margin: 0; font-size: 14px; color: #78350f; line-height: 1.5; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 20px; } .memo { max-width: none; } }
  </style>
</head>
<body>
  <div class="memo">
    <div class="header">
      <h1>Allocation Memo</h1>
      <p>${group.groupNumber} &mdash; ${formatDate(group.date)}</p>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Vendor</div>
        <div class="meta-value">${group.vendorName}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Total Amount</div>
        <div class="meta-value">${formatAmount(group.totalAmount, group.currency)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Method</div>
        <div class="meta-value">${group.allocationMethod}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Status</div>
        <div class="meta-value">${group.status}</div>
      </div>
    </div>

    ${group.description ? `<p style="margin-bottom: 20px; color: #374151;">${group.description}</p>` : ''}

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Project</th>
          <th>Budget Category</th>
          <th style="text-align: right;">%</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">Total</td>
          <td style="text-align: right;">100%</td>
          <td style="text-align: right;">${formatAmount(group.totalAmount, group.currency)}</td>
        </tr>
      </tfoot>
    </table>

    ${
      group.rationale
        ? `<div class="rationale">
            <h3>Rationale</h3>
            <p>${group.rationale}</p>
          </div>`
        : ''
    }

    <div class="footer">
      Generated by DawinOS &mdash; ${new Date().toISOString().split('T')[0]}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Cloud Function: generateAllocationMemo
 *
 * Generates an HTML allocation memo, converts to PDF-like HTML,
 * uploads to Firebase Storage, and updates the allocation group.
 */
exports.generateAllocationMemo = onCall(
  {
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { allocationGroupId, organizationId } = request.data;
    if (!allocationGroupId || !organizationId) {
      throw new HttpsError(
        'invalid-argument',
        'allocationGroupId and organizationId are required'
      );
    }

    const db = getFirestore();
    const groupRef = db.doc(
      `organizations/${organizationId}/allocation_groups/${allocationGroupId}`
    );
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      throw new HttpsError('not-found', 'Allocation group not found');
    }

    const group = { id: groupSnap.id, ...groupSnap.data() };

    // Generate HTML memo
    const html = generateMemoHtml(group);

    // Upload HTML to Firebase Storage
    const bucket = getStorage().bucket();
    const filePath = `organizations/${organizationId}/allocation_memos/${group.groupNumber}.html`;
    const file = bucket.file(filePath);

    await file.save(html, {
      contentType: 'text/html',
      metadata: {
        cacheControl: 'public, max-age=31536000',
        customMetadata: {
          allocationGroupId,
          groupNumber: group.groupNumber,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    // Get public URL
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '01-01-2100', // Long-lived URL
    });

    // Update allocation group with memo URL
    await groupRef.update({
      memoUrl: signedUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { memoUrl: signedUrl };
  }
);
