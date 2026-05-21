/**
 * Payslip Generator Service
 * ZeusOS HR Central - Payroll Module
 * 
 * Generates payslips in HTML format for PDF conversion and printing.
 * Supports individual and batch payslip generation.
 */

import { EmployeePayroll } from '../types/payroll.types';
import { PayslipData } from '../types/payroll-batch.types';
import { numberToWords } from '../utils/tax-calculator';

// ============================================================================
// Company Info Interface
// ============================================================================

export interface CompanyInfo {
  name: string;
  address: string;
  tin: string;
  logo?: string;
  nssfNumber?: string;
  contactPhone?: string;
  contactEmail?: string;
}

/** Default Zeus Group identity for HTML payslips. Mirrors the
 *  react-pdf DEFAULT_COMPANY_INFO so the two pipelines stay aligned. */
export const DEFAULT_HTML_COMPANY_INFO: CompanyInfo = {
  name: 'Zeus Group',
  address: 'Kayondo Road, Kyambogo Upper Estate, Kampala, Uganda',
  tin: '1000000000',
  nssfNumber: 'NSSF/000000',
};

// ============================================================================
// Payslip Data Generation
// ============================================================================

/**
 * Generate payslip data from employee payroll.
 *
 * `subsidiaryNames` (optional): map of subsidiaryId → display name so
 * the cost-allocation footnote can render readable names. If omitted,
 * the IDs are used as fallback labels.
 */
export function generatePayslipData(
  payroll: EmployeePayroll,
  companyInfo: CompanyInfo,
  employeeDetails?: {
    nssfNumber?: string;
    tinNumber?: string;
  },
  subsidiaryNames?: Record<string, string>,
): PayslipData {
  // Format earnings
  const earnings = [
    { description: 'Basic Salary', amount: payroll.basicSalary },
    ...payroll.earnings
      .filter(e => e.type !== 'basic_salary')
      .map(e => ({
        description: e.description,
        amount: e.amount
      }))
  ];

  // Format deductions
  const deductions = payroll.deductions.map(d => ({
    description: d.description,
    amount: d.amount
  }));

  // Generate payslip number
  const payslipNumber = `PS-${payroll.employeeNumber}-${payroll.year}${String(payroll.month).padStart(2, '0')}`;

  return {
    companyName: companyInfo.name,
    companyAddress: companyInfo.address,
    companyLogo: companyInfo.logo,
    companyTIN: companyInfo.tin,
    
    employeeName: payroll.employeeName,
    employeeNumber: payroll.employeeNumber,
    department: payroll.departmentName,
    position: payroll.position,
    nssfNumber: employeeDetails?.nssfNumber,
    tinNumber: employeeDetails?.tinNumber,
    
    payPeriod: formatPayPeriod(payroll.year, payroll.month),
    paymentDate: formatDate(payroll.paymentDate),
    
    basicSalary: payroll.basicSalary,
    earnings,
    totalEarnings: payroll.totalEarnings,
    
    deductions,
    totalDeductions: payroll.totalDeductions,
    
    netPay: payroll.netPay,
    netPayWords: numberToWords(Math.round(payroll.netPay)),
    
    ytdGross: payroll.ytd.grossEarnings,
    ytdPAYE: payroll.ytd.paye,
    ytdNSSF: payroll.ytd.nssfEmployee,
    ytdNetPay: payroll.ytd.netPay,
    
    paymentMethod: formatPaymentMethod(payroll),
    bankDetails: payroll.bankDetails 
      ? `${payroll.bankDetails.bankName} - ${maskAccountNumber(payroll.bankDetails.accountNumber)}`
      : undefined,
    
    payslipNumber,
    generatedAt: new Date().toISOString(),

    // Pass through the snapshot from the payroll record so the
    // footnote stays correct even if the employee's split is edited
    // after the payslip is generated.
    subsidiaryAllocations: Array.isArray(payroll.subsidiaryAllocations) && payroll.subsidiaryAllocations.length > 0
      ? payroll.subsidiaryAllocations.map(a => ({
          subsidiaryId: a.subsidiaryId,
          subsidiaryName: subsidiaryNames?.[a.subsidiaryId] || a.subsidiaryId,
          allocationPercent: a.allocationPercent,
          isHost: a.subsidiaryId === payroll.subsidiaryId,
        }))
      : undefined,
  };
}

// ============================================================================
// HTML Payslip Generation
// ============================================================================

/**
 * Generate HTML payslip for PDF conversion or printing
 */
export function generatePayslipHTML(payslipData: PayslipData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${payslipData.employeeName} - ${payslipData.payPeriod}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #333;
      background: #fff;
      padding: 20px;
    }
    .payslip-container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #ddd;
      padding: 20px;
    }
    
    /* Header */
    .header {
      text-align: center;
      border-bottom: 2px solid #1a365d;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    .company-name {
      font-size: 20px;
      font-weight: bold;
      color: #1a365d;
      margin-bottom: 5px;
    }
    .company-details {
      font-size: 10px;
      color: #666;
    }
    .payslip-title {
      font-size: 16px;
      font-weight: bold;
      color: #1a365d;
      margin-top: 10px;
      padding: 8px;
      background: #f0f4f8;
      border-radius: 4px;
    }
    
    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    .info-section {
      background: #fafafa;
      padding: 10px;
      border-radius: 4px;
    }
    .info-section h4 {
      font-size: 11px;
      color: #1a365d;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
    }
    .info-label {
      color: #666;
      font-weight: 500;
    }
    .info-value {
      font-weight: 600;
      color: #333;
    }
    
    /* Tables */
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #1a365d;
      background: #e2e8f0;
      padding: 8px 10px;
      margin-top: 15px;
      border-radius: 4px 4px 0 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #4a5568;
      font-size: 10px;
      text-transform: uppercase;
    }
    td.amount {
      text-align: right;
      font-family: 'Consolas', monospace;
    }
    tr.total-row {
      background: #f0f4f8;
      font-weight: bold;
    }
    tr.total-row td {
      border-top: 2px solid #cbd5e0;
    }
    
    /* Net Pay Box */
    .net-pay-section {
      background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%);
      color: white;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
    }
    .net-pay-label {
      font-size: 12px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .net-pay-amount {
      font-size: 24px;
      font-weight: bold;
      font-family: 'Consolas', monospace;
    }
    .net-pay-words {
      font-size: 10px;
      font-style: italic;
      opacity: 0.85;
      margin-top: 5px;
    }

    /* Cost allocation footnote (Model A — see PAYROLL-ALLOCATIONS.md) */
    .allocation-section {
      background: #f8fafc;
      border-left: 3px solid #1a365d;
      padding: 10px 12px;
      margin: 15px 0;
      border-radius: 0 4px 4px 0;
    }
    .allocation-title {
      font-size: 11px;
      font-weight: 600;
      color: #1a365d;
      margin-bottom: 6px;
    }
    .allocation-line {
      font-size: 10px;
      color: #475569;
      line-height: 1.5;
    }
    .allocation-host {
      color: #1a365d;
      font-weight: 500;
    }
    .allocation-note {
      font-size: 9px;
      color: #64748b;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed #e2e8f0;
    }

    /* YTD Section */
    .ytd-section {
      background: #f8fafc;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .ytd-title {
      font-size: 11px;
      font-weight: bold;
      color: #1a365d;
      margin-bottom: 10px;
    }
    .ytd-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .ytd-item {
      text-align: center;
    }
    .ytd-item-label {
      font-size: 9px;
      color: #666;
      text-transform: uppercase;
    }
    .ytd-item-value {
      font-size: 11px;
      font-weight: bold;
      color: #333;
      font-family: 'Consolas', monospace;
    }
    
    /* Footer */
    .footer {
      border-top: 1px solid #ddd;
      padding-top: 15px;
      margin-top: 20px;
      text-align: center;
      font-size: 9px;
      color: #999;
    }
    .footer-ref {
      margin-bottom: 5px;
      font-family: 'Consolas', monospace;
    }
    
    /* Print Styles */
    @media print {
      body {
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .payslip-container {
        border: none;
        max-width: 100%;
      }
      .no-print {
        display: none;
      }
    }
    
    /* Page Break for Batch Printing */
    .page-break {
      page-break-after: always;
    }
  </style>
</head>
<body>
  <div class="payslip-container">
    <!-- Header -->
    <div class="header">
      ${payslipData.companyLogo ? `<img src="${payslipData.companyLogo}" alt="Company Logo" style="height: 50px; margin-bottom: 10px;">` : ''}
      <div class="company-name">${escapeHtml(payslipData.companyName)}</div>
      <div class="company-details">${escapeHtml(payslipData.companyAddress)}</div>
      <div class="company-details">TIN: ${escapeHtml(payslipData.companyTIN)}</div>
      <div class="payslip-title">PAYSLIP - ${escapeHtml(payslipData.payPeriod)}</div>
    </div>
    
    <!-- Employee & Payment Info -->
    <div class="info-grid">
      <div class="info-section">
        <h4>Employee Information</h4>
        <div class="info-row">
          <span class="info-label">Name:</span>
          <span class="info-value">${escapeHtml(payslipData.employeeName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Employee No:</span>
          <span class="info-value">${escapeHtml(payslipData.employeeNumber)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Department:</span>
          <span class="info-value">${escapeHtml(payslipData.department)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Position:</span>
          <span class="info-value">${escapeHtml(payslipData.position)}</span>
        </div>
        ${payslipData.nssfNumber ? `
        <div class="info-row">
          <span class="info-label">NSSF No:</span>
          <span class="info-value">${escapeHtml(payslipData.nssfNumber)}</span>
        </div>` : ''}
        ${payslipData.tinNumber ? `
        <div class="info-row">
          <span class="info-label">TIN:</span>
          <span class="info-value">${escapeHtml(payslipData.tinNumber)}</span>
        </div>` : ''}
      </div>
      
      <div class="info-section">
        <h4>Payment Information</h4>
        <div class="info-row">
          <span class="info-label">Pay Period:</span>
          <span class="info-value">${escapeHtml(payslipData.payPeriod)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Date:</span>
          <span class="info-value">${escapeHtml(payslipData.paymentDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Method:</span>
          <span class="info-value">${escapeHtml(payslipData.paymentMethod)}</span>
        </div>
        ${payslipData.bankDetails ? `
        <div class="info-row">
          <span class="info-label">Bank Details:</span>
          <span class="info-value">${escapeHtml(payslipData.bankDetails)}</span>
        </div>` : ''}
      </div>
    </div>
    
    <!-- Earnings Table -->
    <div class="section-title">EARNINGS</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount (UGX)</th>
        </tr>
      </thead>
      <tbody>
        ${payslipData.earnings.map(e => `
        <tr>
          <td>${escapeHtml(e.description)}</td>
          <td class="amount">${formatNumber(e.amount)}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td>Total Earnings</td>
          <td class="amount">${formatNumber(payslipData.totalEarnings)}</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Deductions Table -->
    <div class="section-title">DEDUCTIONS</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount (UGX)</th>
        </tr>
      </thead>
      <tbody>
        ${payslipData.deductions.map(d => `
        <tr>
          <td>${escapeHtml(d.description)}</td>
          <td class="amount">${formatNumber(d.amount)}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td>Total Deductions</td>
          <td class="amount">${formatNumber(payslipData.totalDeductions)}</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Net Pay -->
    <div class="net-pay-section">
      <div class="net-pay-label">NET PAY</div>
      <div class="net-pay-amount">UGX ${formatNumber(payslipData.netPay)}</div>
      <div class="net-pay-words">(${escapeHtml(payslipData.netPayWords)})</div>
    </div>
    
    <!-- Cost allocation footnote (split employees only) -->
    ${payslipData.subsidiaryAllocations && payslipData.subsidiaryAllocations.length > 0 ? `
    <div class="allocation-section">
      <div class="allocation-title">Cost allocation</div>
      ${payslipData.subsidiaryAllocations.map(a => `
        <div class="allocation-line${a.isHost ? ' allocation-host' : ''}">
          ${a.isHost ? '&bull; ' : '&nbsp;&nbsp;'}${escapeHtml(a.subsidiaryName)}: ${a.allocationPercent.toFixed(0)}%${a.isHost ? ' <em>(employer of record)</em>' : ''}
        </div>
      `).join('')}
      <div class="allocation-note">
        <em>For internal cost accounting only. Net pay above is the full amount payable.</em>
      </div>
    </div>
    ` : ''}

    <!-- Year to Date -->
    <div class="ytd-section">
      <div class="ytd-title">YEAR TO DATE SUMMARY</div>
      <div class="ytd-grid">
        <div class="ytd-item">
          <div class="ytd-item-label">Gross Earnings</div>
          <div class="ytd-item-value">${formatNumber(payslipData.ytdGross)}</div>
        </div>
        <div class="ytd-item">
          <div class="ytd-item-label">PAYE</div>
          <div class="ytd-item-value">${formatNumber(payslipData.ytdPAYE)}</div>
        </div>
        <div class="ytd-item">
          <div class="ytd-item-label">NSSF</div>
          <div class="ytd-item-value">${formatNumber(payslipData.ytdNSSF)}</div>
        </div>
        <div class="ytd-item">
          <div class="ytd-item-label">Net Pay</div>
          <div class="ytd-item-value">${formatNumber(payslipData.ytdNetPay)}</div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-ref">Payslip No: ${escapeHtml(payslipData.payslipNumber)}</div>
      <div>Generated: ${new Date().toLocaleDateString('en-UG', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</div>
      <div style="margin-top: 10px;">This is a computer-generated document. No signature required.</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate batch payslips HTML (multiple payslips in one document)
 */
export function generateBatchPayslipsHTML(
  payslips: PayslipData[],
  title?: string
): string {
  const payslipPages = payslips.map((payslip, index) => {
    const html = generatePayslipHTML(payslip);
    // Extract body content and add page break
    const bodyContent = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || '';
    return `
      <div class="payslip-page ${index < payslips.length - 1 ? 'page-break' : ''}">
        ${bodyContent}
      </div>
    `;
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Batch Payslips'}</title>
  <style>
    ${getPayslipStyles()}
    .payslip-page {
      margin-bottom: 30px;
    }
    @media print {
      .page-break {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  ${payslipPages.join('\n')}
</body>
</html>`;
}

// ============================================================================
// PDF Generation (using browser print)
// ============================================================================

/**
 * Open payslip in new window for printing/PDF
 */
export function openPayslipForPrint(payslipData: PayslipData): void {
  const html = generatePayslipHTML(payslipData);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Trigger print dialog after a short delay
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

/**
 * Download payslip as HTML file
 */
export function downloadPayslipHTML(
  payslipData: PayslipData,
  filename?: string
): void {
  const html = generatePayslipHTML(payslipData);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `Payslip-${payslipData.employeeNumber}-${payslipData.payPeriod.replace(/\s+/g, '-')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate batch payslips and download as HTML.
 *
 * `subsidiaryNames` (optional): map of subsidiaryId → display name so
 * split-employee payslips render a readable cost-allocation footnote
 * (Model A). Without it the IDs are used as fallback labels.
 */
export function downloadBatchPayslipsHTML(
  payrolls: EmployeePayroll[],
  companyInfo: CompanyInfo,
  filename?: string,
  subsidiaryNames?: Record<string, string>,
): void {
  const payslips = payrolls.map(p => generatePayslipData(p, companyInfo, undefined, subsidiaryNames));
  const html = generateBatchPayslipsHTML(payslips);

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `Batch-Payslips-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Bank File Generation
// ============================================================================

/**
 * Generate bank transfer file (CSV format)
 */
export function generateBankTransferCSV(
  payrolls: EmployeePayroll[],
  options: {
    bankName: string;
    valueDate: Date;
    reference: string;
    debitAccount?: string;
  }
): string {
  const bankPayrolls = payrolls.filter(
    p => p.paymentMethod === 'bank_transfer' && 
         p.bankDetails?.bankName === options.bankName
  );

  const headers = [
    'Employee Number',
    'Employee Name',
    'Bank Name',
    'Branch',
    'Account Number',
    'Account Name',
    'Amount',
    'Reference',
    'Narration'
  ];

  const rows = bankPayrolls.map(p => [
    p.employeeNumber,
    p.employeeName,
    p.bankDetails?.bankName || '',
    p.bankDetails?.branchName || '',
    p.bankDetails?.accountNumber || '',
    p.bankDetails?.accountName || p.employeeName,
    p.netPay.toString(),
    options.reference,
    `Salary ${formatPayPeriod(p.year, p.month)}`
  ]);

  // Add summary row
  const totalAmount = bankPayrolls.reduce((sum, p) => sum + p.netPay, 0);
  rows.push(['', '', '', '', '', 'TOTAL', totalAmount.toString(), '', '']);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
}

/**
 * Generate mobile money transfer file (CSV format)
 */
export function generateMobileMoneyCSV(
  payrolls: EmployeePayroll[],
  options: {
    provider: 'mtn' | 'airtel';
    reference: string;
  }
): string {
  const mobilePayrolls = payrolls.filter(
    p => p.paymentMethod === 'mobile_money' &&
         p.mobileMoneyDetails?.provider === options.provider
  );

  const headers = [
    'Employee Number',
    'Employee Name',
    'Phone Number',
    'Registered Name',
    'Amount',
    'Reference'
  ];

  const rows = mobilePayrolls.map(p => [
    p.employeeNumber,
    p.employeeName,
    p.mobileMoneyDetails?.phoneNumber || '',
    p.mobileMoneyDetails?.registeredName || p.employeeName,
    p.netPay.toString(),
    options.reference
  ]);

  // Add summary row
  const totalAmount = mobilePayrolls.reduce((sum, p) => sum + p.netPay, 0);
  rows.push(['', '', '', 'TOTAL', totalAmount.toString(), '']);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Tax Return Generation
// ============================================================================

/**
 * Generate URA PAYE return data
 */
export function generateURAReturnData(
  payrolls: EmployeePayroll[],
  companyInfo: CompanyInfo
): {
  summary: {
    period: string;
    employerTIN: string;
    employerName: string;
    totalEmployees: number;
    totalGrossEmoluments: number;
    totalTaxablePay: number;
    totalPAYE: number;
  };
  entries: Array<{
    employeeTIN: string;
    employeeName: string;
    grossPay: number;
    taxablePay: number;
    paye: number;
  }>;
} {
  const firstPayroll = payrolls[0];
  const period = firstPayroll 
    ? `${firstPayroll.year}-${String(firstPayroll.month).padStart(2, '0')}`
    : '';

  const totalGrossEmoluments = payrolls.reduce((sum, p) => sum + p.grossPay, 0);
  const totalTaxablePay = payrolls.reduce((sum, p) => sum + p.taxableIncome, 0);
  const totalPAYE = payrolls.reduce((sum, p) => sum + p.payeBreakdown.netPAYE, 0);

  return {
    summary: {
      period,
      employerTIN: companyInfo.tin,
      employerName: companyInfo.name,
      totalEmployees: payrolls.length,
      totalGrossEmoluments,
      totalTaxablePay,
      totalPAYE
    },
    entries: payrolls.map(p => ({
      employeeTIN: '', // Would come from employee record
      employeeName: p.employeeName,
      grossPay: p.grossPay,
      taxablePay: p.taxableIncome,
      paye: p.payeBreakdown.netPAYE
    }))
  };
}

/**
 * Generate NSSF return data
 */
export function generateNSSFReturnData(
  payrolls: EmployeePayroll[],
  companyInfo: CompanyInfo
): {
  summary: {
    period: string;
    employerNumber: string;
    employerName: string;
    totalEmployees: number;
    totalWages: number;
    totalEmployeeContribution: number;
    totalEmployerContribution: number;
    totalContribution: number;
  };
  entries: Array<{
    nssfNumber: string;
    employeeName: string;
    wages: number;
    employeeContribution: number;
    employerContribution: number;
  }>;
} {
  const firstPayroll = payrolls[0];
  const period = firstPayroll 
    ? `${firstPayroll.year}-${String(firstPayroll.month).padStart(2, '0')}`
    : '';

  const totalWages = payrolls.reduce((sum, p) => sum + p.nssfBreakdown.contributionBase, 0);
  const totalEmployeeContribution = payrolls.reduce((sum, p) => sum + p.nssfBreakdown.employeeContribution, 0);
  const totalEmployerContribution = payrolls.reduce((sum, p) => sum + p.nssfBreakdown.employerContribution, 0);

  return {
    summary: {
      period,
      employerNumber: companyInfo.nssfNumber || '',
      employerName: companyInfo.name,
      totalEmployees: payrolls.length,
      totalWages,
      totalEmployeeContribution,
      totalEmployerContribution,
      totalContribution: totalEmployeeContribution + totalEmployerContribution
    },
    entries: payrolls.map(p => ({
      nssfNumber: '', // Would come from employee record
      employeeName: p.employeeName,
      wages: p.nssfBreakdown.contributionBase,
      employeeContribution: p.nssfBreakdown.employeeContribution,
      employerContribution: p.nssfBreakdown.employerContribution
    }))
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format pay period string
 */
function formatPayPeriod(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Format date string
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format number with thousand separators
 */
function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-UG').format(Math.round(amount));
}

/**
 * Format payment method display string
 */
function formatPaymentMethod(payroll: EmployeePayroll): string {
  switch (payroll.paymentMethod) {
    case 'bank_transfer':
      return `Bank Transfer${payroll.bankDetails ? ` - ${payroll.bankDetails.bankName}` : ''}`;
    case 'mobile_money':
      return `Mobile Money${payroll.mobileMoneyDetails ? ` - ${payroll.mobileMoneyDetails.provider.toUpperCase()}` : ''}`;
    case 'cash':
      return 'Cash';
    case 'cheque':
      return 'Cheque';
    default:
      return payroll.paymentMethod;
  }
}

/**
 * Mask account number for display
 */
function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) return accountNumber;
  const lastFour = accountNumber.slice(-4);
  const masked = '*'.repeat(accountNumber.length - 4);
  return masked + lastFour;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Get common payslip styles (for batch generation)
 */
function getPayslipStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #333; background: #fff; padding: 20px; }
    .payslip-container { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #1a365d; padding-bottom: 15px; margin-bottom: 15px; }
    .company-name { font-size: 20px; font-weight: bold; color: #1a365d; margin-bottom: 5px; }
    .company-details { font-size: 10px; color: #666; }
    .payslip-title { font-size: 16px; font-weight: bold; color: #1a365d; margin-top: 10px; padding: 8px; background: #f0f4f8; border-radius: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .info-section { background: #fafafa; padding: 10px; border-radius: 4px; }
    .info-section h4 { font-size: 11px; color: #1a365d; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 8px; }
    .info-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .info-label { color: #666; font-weight: 500; }
    .info-value { font-weight: 600; color: #333; }
    .section-title { font-size: 12px; font-weight: bold; color: #1a365d; background: #e2e8f0; padding: 8px 10px; margin-top: 15px; border-radius: 4px 4px 0 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8fafc; font-weight: 600; color: #4a5568; font-size: 10px; text-transform: uppercase; }
    td.amount { text-align: right; font-family: 'Consolas', monospace; }
    tr.total-row { background: #f0f4f8; font-weight: bold; }
    tr.total-row td { border-top: 2px solid #cbd5e0; }
    .net-pay-section { background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); color: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .net-pay-label { font-size: 12px; opacity: 0.9; margin-bottom: 5px; }
    .net-pay-amount { font-size: 24px; font-weight: bold; font-family: 'Consolas', monospace; }
    .net-pay-words { font-size: 10px; font-style: italic; opacity: 0.85; margin-top: 5px; }
    .ytd-section { background: #f8fafc; padding: 12px; border-radius: 4px; margin-bottom: 15px; }
    .ytd-title { font-size: 11px; font-weight: bold; color: #1a365d; margin-bottom: 10px; }
    .ytd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .ytd-item { text-align: center; }
    .ytd-item-label { font-size: 9px; color: #666; text-transform: uppercase; }
    .ytd-item-value { font-size: 11px; font-weight: bold; color: #333; font-family: 'Consolas', monospace; }
    .footer { border-top: 1px solid #ddd; padding-top: 15px; margin-top: 20px; text-align: center; font-size: 9px; color: #999; }
    .footer-ref { margin-bottom: 5px; font-family: 'Consolas', monospace; }
    @media print { body { padding: 0; } .payslip-container { border: none; max-width: 100%; } }
  `;
}
