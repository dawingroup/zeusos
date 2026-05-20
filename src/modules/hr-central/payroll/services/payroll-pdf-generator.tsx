/**
 * ============================================================================
 * DAWIN OS - PAYROLL PDF GENERATOR MODULE
 * ============================================================================
 * 
 * Generates PDF payslips and payroll reports with Uganda tax compliance
 * 
 * Usage:
 *   import { payrollPdfService, PayslipPDFDocument, PayrollReportPDFDocument } from './payroll-pdf-generator';
 * 
 * ============================================================================
 */

import { useState, useCallback } from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
  Font,
} from '@react-pdf/renderer';
import { format } from 'date-fns';

// ============================================================================
// FONT REGISTRATION - Outfit Font Family
// ============================================================================

Font.register({
  family: 'Outfit',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-300-normal.ttf',
      fontWeight: 300,
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-500-normal.ttf',
      fontWeight: 500,
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-600-normal.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf',
      fontWeight: 700,
    },
  ],
});

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PayslipEmployee {
  id: string;
  name: string;
  employeeNumber?: string;
  department?: string;
  position?: string;
  bankName?: string;
  bankAccountNumber?: string;
  tinNumber?: string;
  nssfNumber?: string;
}

export interface PayslipEarnings {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  lunchAllowance: number;
  otherAllowances: number;
  overtime?: number;
  bonus?: number;
}

export interface PayslipDeductions {
  paye: number;
  nssf: number;
  lst: number;
  otherDeductions?: number;
}

export interface PayslipData {
  employee: PayslipEmployee;
  period: string; // YYYY-MM format
  earnings: PayslipEarnings;
  deductions: PayslipDeductions;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  employerNssf: number;
  paymentDate?: Date;
  /** Cost allocation split when the employee works across multiple
   *  subsidiaries. The payslip itself still shows the full net pay
   *  (one employer of record, one paycheck) — this field is rendered
   *  as a footnote so the employee can see how their cost is
   *  apportioned internally. See PAYROLL-ALLOCATIONS.md. */
  subsidiaryAllocations?: Array<{ subsidiaryName: string; allocationPercent: number; isHost?: boolean }>;
}

export interface PayrollReportData {
  period: string;
  generatedAt: Date;
  employees: PayslipData[];
  totals: {
    grossPay: number;
    totalPaye: number;
    totalNssf: number;
    totalLst: number;
    totalDeductions: number;
    netPay: number;
    employerNssf: number;
  };
  companyInfo: CompanyInfo;
}

export interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  tinNumber?: string;
  nssfNumber?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'Dawin Group',
  address: 'Kayondo Road, Kyambogo Upper Estate',
  city: 'Kampala, Uganda',
  tinNumber: '1000000000',
  nssfNumber: 'NSSF/000000',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (amount: number): string => {
  return `UGX ${new Intl.NumberFormat('en-UG').format(Math.round(amount))}`;
};

const formatPeriod = (period: string): string => {
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return format(date, 'MMMM yyyy');
};

// ============================================================================
// PDF STYLES
// ============================================================================

const colors = {
  primary: '#2196F3', // HR Blue
  text: '#333333',
  textLight: '#666666',
  border: '#E0E0E0',
  background: '#F5F5F5',
  white: '#FFFFFF',
  green: '#22C55E',
  red: '#EF4444',
  orange: '#F97316',
  cyan: '#06B6D4',
  violet: '#8B5CF6',
};

const styles = StyleSheet.create({
  // Page Layout
  page: {
    padding: 40,
    fontFamily: 'Outfit',
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.primary,
  },
  companyAddress: {
    fontSize: 9,
    color: colors.textLight,
    marginTop: 2,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.text,
  },
  periodText: {
    fontSize: 11,
    fontWeight: 500,
    color: colors.textLight,
    marginTop: 4,
  },

  // Employee Info Section
  employeeSection: {
    flexDirection: 'row',
    marginBottom: 20,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 4,
  },
  employeeColumn: {
    flex: 1,
  },
  employeeLabel: {
    fontSize: 8,
    fontWeight: 400,
    color: colors.textLight,
    marginBottom: 2,
  },
  employeeValue: {
    fontSize: 10,
    fontWeight: 500,
    marginBottom: 6,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
  },

  // Earnings & Deductions Tables
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.primary,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableContainer: {
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.background,
  },
  tableLabel: {
    fontSize: 10,
    fontWeight: 400,
  },
  tableValue: {
    fontSize: 10,
    fontWeight: 500,
    textAlign: 'right',
  },
  tableTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.background,
    marginTop: 4,
  },
  tableTotalLabel: {
    fontSize: 11,
    fontWeight: 600,
  },
  tableTotalValue: {
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'right',
  },

  // Two column layout
  twoColumn: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  column: {
    flex: 1,
  },

  // Summary Box
  summaryBox: {
    padding: 15,
    backgroundColor: colors.primary,
    borderRadius: 4,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 400,
    color: colors.white,
    opacity: 0.9,
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 500,
    color: colors.white,
  },
  netPayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  netPayLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.white,
  },
  netPayValue: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.white,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 8,
    color: colors.textLight,
  },

  // Cost-allocation footnote (Model A — see PAYROLL-ALLOCATIONS.md)
  allocationNote: {
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.background,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  allocationTitle: {
    fontSize: 9,
    fontWeight: 600,
    color: colors.text,
    marginBottom: 4,
  },
  allocationLine: {
    fontSize: 8,
    color: colors.textLight,
    marginBottom: 2,
  },

  // Report specific styles
  reportTable: {
    marginBottom: 20,
  },
  reportTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  reportTableHeaderCell: {
    fontSize: 8,
    fontWeight: 600,
    color: colors.white,
  },
  reportTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  reportTableCell: {
    fontSize: 9,
    fontWeight: 400,
  },
  reportTableCellRight: {
    fontSize: 9,
    fontWeight: 400,
    textAlign: 'right',
  },
  reportTotalsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderTopWidth: 2,
    borderTopColor: colors.text,
  },
  reportTotalsCell: {
    fontSize: 9,
    fontWeight: 700,
  },
  // Column widths for report
  colName: { width: '20%' },
  colGross: { width: '13%', textAlign: 'right' },
  colPaye: { width: '13%', textAlign: 'right' },
  colNssf: { width: '11%', textAlign: 'right' },
  colLst: { width: '10%', textAlign: 'right' },
  colDeductions: { width: '13%', textAlign: 'right' },
  colNet: { width: '15%', textAlign: 'right' },
});

// ============================================================================
// PAYSLIP PDF DOCUMENT
// ============================================================================

export function PayslipPDFDocument({ data }: { data: PayslipData }) {
  const { employee, period, earnings, deductions, grossPay, totalDeductions, netPay, employerNssf, subsidiaryAllocations } = data;
  const showAllocations = Array.isArray(subsidiaryAllocations) && subsidiaryAllocations.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{DEFAULT_COMPANY_INFO.name}</Text>
            <Text style={styles.companyAddress}>{DEFAULT_COMPANY_INFO.address}</Text>
            <Text style={styles.companyAddress}>{DEFAULT_COMPANY_INFO.city}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.documentTitle}>PAYSLIP</Text>
            <Text style={styles.periodText}>{formatPeriod(period)}</Text>
          </View>
        </View>

        {/* Employee Information */}
        <View style={styles.employeeSection}>
          <View style={styles.employeeColumn}>
            <Text style={styles.employeeName}>{employee.name}</Text>
            <Text style={styles.employeeLabel}>Employee ID</Text>
            <Text style={styles.employeeValue}>{employee.employeeNumber || employee.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.employeeLabel}>Department</Text>
            <Text style={styles.employeeValue}>{employee.department || 'N/A'}</Text>
          </View>
          <View style={styles.employeeColumn}>
            <Text style={styles.employeeLabel}>Position</Text>
            <Text style={styles.employeeValue}>{employee.position || 'N/A'}</Text>
            <Text style={styles.employeeLabel}>TIN Number</Text>
            <Text style={styles.employeeValue}>{employee.tinNumber || 'N/A'}</Text>
            <Text style={styles.employeeLabel}>NSSF Number</Text>
            <Text style={styles.employeeValue}>{employee.nssfNumber || 'N/A'}</Text>
          </View>
          <View style={styles.employeeColumn}>
            <Text style={styles.employeeLabel}>Bank Name</Text>
            <Text style={styles.employeeValue}>{employee.bankName || 'N/A'}</Text>
            <Text style={styles.employeeLabel}>Account Number</Text>
            <Text style={styles.employeeValue}>{employee.bankAccountNumber || 'N/A'}</Text>
          </View>
        </View>

        {/* Earnings & Deductions */}
        <View style={styles.twoColumn}>
          {/* Earnings */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <View style={styles.tableContainer}>
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>Basic Salary</Text>
                <Text style={styles.tableValue}>{formatCurrency(earnings.basicSalary)}</Text>
              </View>
              {earnings.housingAllowance > 0 && (
                <View style={[styles.tableRow, styles.tableRowAlt]}>
                  <Text style={styles.tableLabel}>Housing Allowance</Text>
                  <Text style={styles.tableValue}>{formatCurrency(earnings.housingAllowance)}</Text>
                </View>
              )}
              {earnings.transportAllowance > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Transport Allowance</Text>
                  <Text style={styles.tableValue}>{formatCurrency(earnings.transportAllowance)}</Text>
                </View>
              )}
              {earnings.lunchAllowance > 0 && (
                <View style={[styles.tableRow, styles.tableRowAlt]}>
                  <Text style={styles.tableLabel}>Lunch Allowance</Text>
                  <Text style={styles.tableValue}>{formatCurrency(earnings.lunchAllowance)}</Text>
                </View>
              )}
              {earnings.otherAllowances > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Other Allowances</Text>
                  <Text style={styles.tableValue}>{formatCurrency(earnings.otherAllowances)}</Text>
                </View>
              )}
              {earnings.overtime && earnings.overtime > 0 && (
                <View style={[styles.tableRow, styles.tableRowAlt]}>
                  <Text style={styles.tableLabel}>Overtime</Text>
                  <Text style={styles.tableValue}>{formatCurrency(earnings.overtime)}</Text>
                </View>
              )}
              {earnings.bonus && earnings.bonus > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Bonus</Text>
                  <Text style={styles.tableValue}>{formatCurrency(earnings.bonus)}</Text>
                </View>
              )}
              <View style={styles.tableTotalRow}>
                <Text style={styles.tableTotalLabel}>Gross Pay</Text>
                <Text style={styles.tableTotalValue}>{formatCurrency(grossPay)}</Text>
              </View>
            </View>
          </View>

          {/* Deductions */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Deductions</Text>
            <View style={styles.tableContainer}>
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>PAYE (Income Tax)</Text>
                <Text style={[styles.tableValue, { color: colors.orange }]}>{formatCurrency(deductions.paye)}</Text>
              </View>
              <View style={[styles.tableRow, styles.tableRowAlt]}>
                <Text style={styles.tableLabel}>NSSF (Employee 5%)</Text>
                <Text style={[styles.tableValue, { color: colors.cyan }]}>{formatCurrency(deductions.nssf)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>LST (Local Service Tax)</Text>
                <Text style={[styles.tableValue, { color: colors.violet }]}>{formatCurrency(deductions.lst)}</Text>
              </View>
              {deductions.otherDeductions && deductions.otherDeductions > 0 && (
                <View style={[styles.tableRow, styles.tableRowAlt]}>
                  <Text style={styles.tableLabel}>Other Deductions</Text>
                  <Text style={styles.tableValue}>{formatCurrency(deductions.otherDeductions)}</Text>
                </View>
              )}
              <View style={styles.tableTotalRow}>
                <Text style={styles.tableTotalLabel}>Total Deductions</Text>
                <Text style={[styles.tableTotalValue, { color: colors.red }]}>{formatCurrency(totalDeductions)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Net Pay Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Gross Earnings</Text>
            <Text style={styles.summaryValue}>{formatCurrency(grossPay)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Deductions</Text>
            <Text style={styles.summaryValue}>-{formatCurrency(totalDeductions)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Employer NSSF (10%)</Text>
            <Text style={styles.summaryValue}>{formatCurrency(employerNssf)}</Text>
          </View>
          <View style={styles.netPayRow}>
            <Text style={styles.netPayLabel}>NET PAY</Text>
            <Text style={styles.netPayValue}>{formatCurrency(netPay)}</Text>
          </View>
        </View>

        {/* Cost-allocation footnote — split employees only.
            Net pay above is the full amount the employee actually receives;
            this section just shows how the cost is apportioned across
            the group for internal accounting. */}
        {showAllocations && (
          <View style={styles.allocationNote}>
            <Text style={styles.allocationTitle}>Cost allocation</Text>
            {subsidiaryAllocations!.map((a, i) => (
              <Text key={i} style={styles.allocationLine}>
                {a.isHost ? '• ' : '  '}
                {a.subsidiaryName}: {a.allocationPercent.toFixed(0)}%
                {a.isHost ? '  (employer of record)' : ''}
              </Text>
            ))}
            <Text style={[styles.allocationLine, { marginTop: 4, fontStyle: 'italic' }]}>
              For internal cost accounting only. Net pay shown above is the full amount payable.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated on {format(new Date(), 'dd MMM yyyy, HH:mm')}</Text>
          <Text style={styles.footerText}>This is a computer-generated document.</Text>
        </View>
      </Page>
    </Document>
  );
}

// ============================================================================
// PAYROLL REPORT PDF DOCUMENT (Summary for all employees)
// ============================================================================

export function PayrollReportPDFDocument({ data }: { data: PayrollReportData }) {
  const { period, generatedAt, employees, totals, companyInfo } = data;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{companyInfo.name}</Text>
            <Text style={styles.companyAddress}>{companyInfo.address}</Text>
            <Text style={styles.companyAddress}>{companyInfo.city}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.documentTitle}>PAYROLL REPORT</Text>
            <Text style={styles.periodText}>{formatPeriod(period)}</Text>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', marginBottom: 20, gap: 10 }}>
          <View style={{ flex: 1, padding: 12, backgroundColor: colors.background, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
            <Text style={{ fontSize: 8, color: colors.textLight }}>TOTAL EMPLOYEES</Text>
            <Text style={{ fontSize: 16, fontWeight: 700 }}>{employees.length}</Text>
          </View>
          <View style={{ flex: 1, padding: 12, backgroundColor: colors.background, borderLeftWidth: 3, borderLeftColor: colors.green }}>
            <Text style={{ fontSize: 8, color: colors.textLight }}>GROSS PAYROLL</Text>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(totals.grossPay)}</Text>
          </View>
          <View style={{ flex: 1, padding: 12, backgroundColor: colors.background, borderLeftWidth: 3, borderLeftColor: colors.red }}>
            <Text style={{ fontSize: 8, color: colors.textLight }}>TOTAL DEDUCTIONS</Text>
            <Text style={{ fontSize: 14, fontWeight: 700, color: colors.red }}>{formatCurrency(totals.totalDeductions)}</Text>
          </View>
          <View style={{ flex: 1, padding: 12, backgroundColor: colors.background, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
            <Text style={{ fontSize: 8, color: colors.textLight }}>NET PAYROLL</Text>
            <Text style={{ fontSize: 14, fontWeight: 700, color: colors.green }}>{formatCurrency(totals.netPay)}</Text>
          </View>
        </View>

        {/* Employee Table */}
        <View style={styles.reportTable}>
          {/* Table Header */}
          <View style={styles.reportTableHeader}>
            <Text style={[styles.reportTableHeaderCell, styles.colName]}>Employee</Text>
            <Text style={[styles.reportTableHeaderCell, styles.colGross]}>Gross Pay</Text>
            <Text style={[styles.reportTableHeaderCell, styles.colPaye]}>PAYE</Text>
            <Text style={[styles.reportTableHeaderCell, styles.colNssf]}>NSSF (5%)</Text>
            <Text style={[styles.reportTableHeaderCell, styles.colLst]}>LST</Text>
            <Text style={[styles.reportTableHeaderCell, styles.colDeductions]}>Deductions</Text>
            <Text style={[styles.reportTableHeaderCell, styles.colNet]}>Net Pay</Text>
          </View>

          {/* Table Rows */}
          {employees.map((emp, index) => (
            <View key={emp.employee.id} style={[styles.reportTableRow, index % 2 === 1 && { backgroundColor: colors.background }] as any}>
              <Text style={[styles.reportTableCell, styles.colName]}>{emp.employee.name}</Text>
              <Text style={[styles.reportTableCellRight, styles.colGross]}>{formatCurrency(emp.grossPay)}</Text>
              <Text style={[styles.reportTableCellRight, styles.colPaye, { color: colors.orange }]}>-{formatCurrency(emp.deductions.paye)}</Text>
              <Text style={[styles.reportTableCellRight, styles.colNssf, { color: colors.cyan }]}>-{formatCurrency(emp.deductions.nssf)}</Text>
              <Text style={[styles.reportTableCellRight, styles.colLst, { color: colors.violet }]}>-{formatCurrency(emp.deductions.lst)}</Text>
              <Text style={[styles.reportTableCellRight, styles.colDeductions, { color: colors.red }]}>-{formatCurrency(emp.totalDeductions)}</Text>
              <Text style={[styles.reportTableCellRight, styles.colNet, { color: colors.green, fontWeight: 600 }]}>{formatCurrency(emp.netPay)}</Text>
            </View>
          ))}

          {/* Totals Row */}
          <View style={styles.reportTotalsRow}>
            <Text style={[styles.reportTotalsCell, styles.colName]}>TOTAL ({employees.length} employees)</Text>
            <Text style={[styles.reportTotalsCell, styles.colGross, { textAlign: 'right' }]}>{formatCurrency(totals.grossPay)}</Text>
            <Text style={[styles.reportTotalsCell, styles.colPaye, { textAlign: 'right', color: colors.orange }]}>-{formatCurrency(totals.totalPaye)}</Text>
            <Text style={[styles.reportTotalsCell, styles.colNssf, { textAlign: 'right', color: colors.cyan }]}>-{formatCurrency(totals.totalNssf)}</Text>
            <Text style={[styles.reportTotalsCell, styles.colLst, { textAlign: 'right', color: colors.violet }]}>-{formatCurrency(totals.totalLst)}</Text>
            <Text style={[styles.reportTotalsCell, styles.colDeductions, { textAlign: 'right', color: colors.red }]}>-{formatCurrency(totals.totalDeductions)}</Text>
            <Text style={[styles.reportTotalsCell, styles.colNet, { textAlign: 'right', color: colors.green }]}>{formatCurrency(totals.netPay)}</Text>
          </View>
        </View>

        {/* Tax Summary */}
        <View style={{ flexDirection: 'row', gap: 15, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Tax Remittance Summary</Text>
            <View style={styles.tableContainer}>
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>PAYE (Income Tax) - URA</Text>
                <Text style={[styles.tableValue, { color: colors.orange }]}>{formatCurrency(totals.totalPaye)}</Text>
              </View>
              <View style={[styles.tableRow, styles.tableRowAlt]}>
                <Text style={styles.tableLabel}>NSSF (Employee 5%)</Text>
                <Text style={[styles.tableValue, { color: colors.cyan }]}>{formatCurrency(totals.totalNssf)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>NSSF (Employer 10%)</Text>
                <Text style={[styles.tableValue, { color: colors.cyan }]}>{formatCurrency(totals.employerNssf)}</Text>
              </View>
              <View style={[styles.tableRow, styles.tableRowAlt]}>
                <Text style={styles.tableLabel}>LST (Local Service Tax) - KCCA</Text>
                <Text style={[styles.tableValue, { color: colors.violet }]}>{formatCurrency(totals.totalLst)}</Text>
              </View>
              <View style={styles.tableTotalRow}>
                <Text style={styles.tableTotalLabel}>Total Statutory Remittances</Text>
                <Text style={styles.tableTotalValue}>{formatCurrency(totals.totalPaye + totals.totalNssf + totals.employerNssf + totals.totalLst)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated on {format(generatedAt, 'dd MMM yyyy, HH:mm')}</Text>
          <Text style={styles.footerText}>Dawin Group - Confidential Payroll Document</Text>
        </View>
      </Page>
    </Document>
  );
}

// ============================================================================
// PDF SERVICE
// ============================================================================

export const payrollPdfService = {
  /**
   * Generate individual payslip PDF blob
   */
  async generatePayslipBlob(data: PayslipData): Promise<Blob> {
    const document = <PayslipPDFDocument data={data} />;
    return await pdf(document).toBlob();
  },

  /**
   * Download individual payslip PDF
   */
  async downloadPayslip(data: PayslipData, filename?: string): Promise<void> {
    const blob = await this.generatePayslipBlob(data);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `Payslip_${data.employee.name.replace(/\s+/g, '_')}_${data.period}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Generate payroll report PDF blob
   */
  async generateReportBlob(data: PayrollReportData): Promise<Blob> {
    const document = <PayrollReportPDFDocument data={data} />;
    return await pdf(document).toBlob();
  },

  /**
   * Download payroll report PDF
   */
  async downloadReport(data: PayrollReportData, filename?: string): Promise<void> {
    const blob = await this.generateReportBlob(data);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `Payroll_Report_${data.period}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Preview payslip in new tab
   */
  async previewPayslip(data: PayslipData): Promise<void> {
    const blob = await this.generatePayslipBlob(data);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  },

  /**
   * Preview payroll report in new tab
   */
  async previewReport(data: PayrollReportData): Promise<void> {
    const blob = await this.generateReportBlob(data);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  },
};

// ============================================================================
// REACT HOOK
// ============================================================================

interface UsePayrollPDFReturn {
  generating: boolean;
  error: Error | null;
  downloadPayslip: (data: PayslipData, filename?: string) => Promise<void>;
  downloadReport: (data: PayrollReportData, filename?: string) => Promise<void>;
  previewPayslip: (data: PayslipData) => Promise<void>;
  previewReport: (data: PayrollReportData) => Promise<void>;
}

export function usePayrollPDF(): UsePayrollPDFReturn {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const downloadPayslip = useCallback(async (data: PayslipData, filename?: string) => {
    setGenerating(true);
    setError(null);
    try {
      await payrollPdfService.downloadPayslip(data, filename);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Payslip PDF generation failed');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, []);

  const downloadReport = useCallback(async (data: PayrollReportData, filename?: string) => {
    setGenerating(true);
    setError(null);
    try {
      await payrollPdfService.downloadReport(data, filename);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Payroll report PDF generation failed');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, []);

  const previewPayslip = useCallback(async (data: PayslipData) => {
    setGenerating(true);
    setError(null);
    try {
      await payrollPdfService.previewPayslip(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Payslip preview failed');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, []);

  const previewReport = useCallback(async (data: PayrollReportData) => {
    setGenerating(true);
    setError(null);
    try {
      await payrollPdfService.previewReport(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Payroll report preview failed');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, []);

  return {
    generating,
    error,
    downloadPayslip,
    downloadReport,
    previewPayslip,
    previewReport,
  };
}

export default payrollPdfService;
