/**
 * Receipt PDF Generator
 * Generates a professional payment receipt PDF using @react-pdf/renderer.
 * Typography and table chrome match `quote-pdf-generator.tsx` (QUOTE_PDF_THEME_COLORS).
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  pdf,
  Font,
} from '@react-pdf/renderer';
import { QUOTE_PDF_THEME_COLORS } from '@/modules/design-manager/services/quote-pdf-generator';
import type { PaymentRecord } from '@/modules/sales-orders/types';

// Register Outfit font (same as quote PDF)
Font.register({
  family: 'Outfit',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

const q = QUOTE_PDF_THEME_COLORS;

// ============================================================================
// Types
// ============================================================================

export interface ReceiptData {
  receiptNumber: string;
  orderNumber: string;
  customerName: string;
  paymentDate: string;
  paymentType: 'deposit' | 'milestone' | 'full';
  paymentMethod: string;
  amountReceived: number;
  currency: string;
  orderTotal: number;
  balanceRemaining: number;
  /** Manual / external reference; shown separately from {@link receiptNumber}. */
  receiptRef?: string;
  invoiceNumber?: string;
  logoUrl?: string;
  /** Payments on the order before this receipt (excludes the payment this PDF is for). */
  previousPayments?: ReceiptPriorPaymentLine[];
}

/** One row in the “previous payments” summary (plain data for the PDF). */
export interface ReceiptPriorPaymentLine {
  dateLabel: string;
  amount: number;
  typeLabel: string;
  method: string;
}

// ============================================================================
// Receipt number (RCP-…) — never use pasted receiptRef as the document id
// ============================================================================

/**
 * Stable official receipt id for PDFs and filenames.
 * Uses stored `receiptDocumentNumber` when present; else derives from payment `id`.
 * When `payment` is null (PDF before save), generates a new id — callers should cache it per send.
 */
export function resolveReceiptDocumentNumber(
  orderNumber: string,
  payment: Pick<PaymentRecord, 'id' | 'receiptDocumentNumber'> | null | undefined,
): string {
  const stored = payment?.receiptDocumentNumber?.trim();
  if (stored) return stored;
  const ord = orderNumber.replace(/^SO-/, '').replace(/^so-/i, '');
  if (payment?.id) {
    const tail = payment.id.replace(/[^a-zA-Z0-9]/g, '').slice(-10);
    return `RCP-${ord}-${tail}`;
  }
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return `RCP-${ord}-${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  }
  return `RCP-${ord}-${Date.now().toString(36)}`;
}

function paymentTypeLabel(type: string): string {
  switch (type) {
    case 'deposit': return 'Deposit Payment';
    case 'milestone': return 'Milestone Payment';
    case 'full': return 'Full Payment';
    default: return 'Payment';
  }
}

function paymentRecordSortTime(p: PaymentRecord): number {
  const pd = p.paymentDate as { toMillis?: () => number; toDate?: () => Date } | undefined;
  const ra = p.recordedAt as { toMillis?: () => number; toDate?: () => Date } | undefined;
  if (pd?.toMillis) return pd.toMillis();
  if (ra?.toMillis) return ra.toMillis();
  if (pd?.toDate) return pd.toDate().getTime();
  if (ra?.toDate) return ra.toDate().getTime();
  return 0;
}

function formatPaymentRecordDateLabel(p: PaymentRecord): string {
  const pd = p.paymentDate as { toDate?: () => Date } | undefined;
  if (pd?.toDate) {
    return pd.toDate().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  const ra = p.recordedAt as { toDate?: () => Date } | undefined;
  if (ra?.toDate) {
    return ra.toDate().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  return '—';
}

/**
 * Lines for earlier payments on the same order (chronological).
 * @param excludePaymentId When set, drops that row (the payment this receipt documents).
 */
export function buildReceiptPriorPaymentLines(
  payments: PaymentRecord[] | undefined,
  excludePaymentId: string | undefined,
): ReceiptPriorPaymentLine[] {
  if (!payments?.length) return [];
  const list = excludePaymentId
    ? payments.filter((p) => p.id !== excludePaymentId)
    : [...payments];
  if (!list.length) return [];

  const sorted = [...list].sort((a, b) => paymentRecordSortTime(a) - paymentRecordSortTime(b));
  return sorted.map((p) => ({
    dateLabel: formatPaymentRecordDateLabel(p),
    amount: p.amount,
    typeLabel: paymentTypeLabel(p.type),
    method: typeof p.method === 'string' && p.method.trim() ? p.method : '—',
  }));
}

// ============================================================================
// Styles — match quotation PDF
// ============================================================================

/** Aligns with quotation PDF footer (`DEFAULT_COMPANY_INFO` in quote-pdf-generator). */
const RECEIPT_COMPANY_FOOTER = {
  address: 'Kayondo Road, Kyambogo Upper Estate Ground Floor, Jordan House',
  city: 'Kampala',
  region: 'Central Region',
  country: 'Uganda',
  website: 'dawinfinishes.com',
};

function buildReceiptStyles() {
  /** Reserve vertical space for up to ~4 prior-payment rows on one A4 page */
  const priorRowMinHeight = 20;

  return {
    page: {
      fontFamily: 'Outfit',
      fontSize: 9,
      fontWeight: 400,
      padding: 32,
      paddingBottom: 76,
      backgroundColor: q.white,
      color: q.text,
    },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'flex-start' as const,
      /** Slight inset so title + logo sit below the page edge together */
      paddingTop: 4,
      marginBottom: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: q.border,
    },
    headerLeft: {
      flex: 1,
      paddingRight: 16,
      minWidth: 0,
      alignSelf: 'flex-start' as const,
      /**
       * Logos often include transparent space above the mark with `objectFit: contain`.
       * Nudge the title down so the cap height lines up with the visible / coloured part of the logo.
       */
      paddingTop: 5,
    },
    headerRight: {
      alignItems: 'flex-end' as const,
      alignSelf: 'flex-start' as const,
      paddingTop: 4,
    },
    receiptDocTitle: {
      fontSize: 34,
      fontWeight: 700,
      color: q.primary,
      lineHeight: 1.05,
    },
    receiptRefLine: {
      fontSize: 9,
      fontWeight: 400,
      color: q.textLight,
      marginTop: 4,
    },
    logo: {
      width: 188,
      height: 80,
      objectFit: 'contain' as const,
    },
    companyNameFallback: {
      fontSize: 15,
      fontWeight: 700,
      color: q.primary,
      textAlign: 'right' as const,
    },
    infoGrid: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 12,
    },
    infoColumn: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 7,
      fontWeight: 600,
      color: q.textLight,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 10,
      fontWeight: 600,
      color: q.text,
      marginBottom: 6,
    },
    amountBox: {
      backgroundColor: q.backgroundLight,
      borderRadius: 6,
      padding: 12,
      marginBottom: 12,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: q.borderLight,
    },
    amountLabel: {
      fontSize: 8,
      fontWeight: 600,
      color: q.primary,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      marginBottom: 4,
    },
    amountValue: {
      fontSize: 22,
      fontWeight: 700,
      color: q.primary,
    },
    /** Quote-style table wrapper (no heavy outer border). */
    detailsTable: {
      marginBottom: 12,
    },
    detailsTableHeader: {
      flexDirection: 'row' as const,
      backgroundColor: q.background,
      borderBottomWidth: 1,
      borderBottomColor: q.border,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    detailsHeaderCell: {
      flex: 1,
      fontSize: 8,
      fontWeight: 600,
      color: q.text,
    },
    detailsHeaderCellRight: {
      flex: 1,
      fontSize: 8,
      fontWeight: 600,
      color: q.text,
      textAlign: 'right' as const,
    },
    detailRow: {
      flexDirection: 'row' as const,
      borderBottomWidth: 1,
      borderBottomColor: q.borderLight,
      paddingVertical: 5,
      paddingHorizontal: 8,
      minHeight: 20,
      alignItems: 'center' as const,
    },
    detailRowAlt: {
      backgroundColor: q.backgroundLight,
    },
    detailRowLast: {
      borderBottomWidth: 0,
    },
    detailLabel: {
      flex: 1,
      fontSize: 8,
      fontWeight: 400,
      color: q.text,
    },
    detailValue: {
      flex: 1,
      fontSize: 8,
      fontWeight: 400,
      color: q.text,
      textAlign: 'right' as const,
    },
    summaryRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    summaryLabel: {
      fontSize: 9,
      color: q.textLight,
    },
    summaryValue: {
      fontSize: 9,
      fontWeight: 600,
      color: q.text,
    },
    priorPaymentsBlock: {
      marginTop: 8,
      marginBottom: 6,
    },
    priorPaymentsTitle: {
      fontSize: 8,
      fontWeight: 600,
      color: q.textLight,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    priorTable: {
      marginBottom: 2,
    },
    priorTableHeader: {
      flexDirection: 'row' as const,
      backgroundColor: q.background,
      borderBottomWidth: 1,
      borderBottomColor: q.border,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    priorHeaderCell: {
      fontSize: 7,
      fontWeight: 600,
      color: q.text,
    },
    priorColDate: { width: '24%' as const },
    priorColType: { width: '26%' as const, paddingRight: 4 },
    priorColMethod: { width: '30%' as const, paddingRight: 4 },
    priorColAmount: { width: '20%' as const, textAlign: 'right' as const },
    priorRow: {
      flexDirection: 'row' as const,
      borderBottomWidth: 1,
      borderBottomColor: q.borderLight,
      paddingVertical: 3,
      paddingHorizontal: 8,
      minHeight: priorRowMinHeight,
      alignItems: 'center' as const,
    },
    priorRowAlt: {
      backgroundColor: q.backgroundLight,
    },
    priorCell: {
      fontSize: 7,
      fontWeight: 400,
      color: q.text,
    },
    priorTotalRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginTop: 2,
    },
    priorTotalLabel: {
      fontSize: 8,
      fontWeight: 600,
      color: q.text,
    },
    priorTotalValue: {
      fontSize: 8,
      fontWeight: 600,
      color: q.text,
    },
    summaryDivider: {
      borderTopWidth: 1,
      borderTopColor: q.border,
      marginVertical: 2,
      marginHorizontal: 12,
    },
    balanceRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: q.backgroundLight,
      borderRadius: 4,
      marginTop: 2,
    },
    balanceLabel: {
      fontSize: 10,
      fontWeight: 700,
      color: q.text,
    },
    balanceValue: {
      fontSize: 10,
      fontWeight: 700,
      color: q.text,
    },
    balancePaid: {
      color: q.primary,
    },
    footer: {
      position: 'absolute' as const,
      bottom: 24,
      left: 32,
      right: 32,
      borderTopWidth: 1,
      borderTopColor: q.border,
      paddingTop: 8,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
    },
    footerLeft: {
      flex: 1,
    },
    footerRight: {
      alignItems: 'flex-end' as const,
    },
    footerText: {
      fontSize: 8,
      fontWeight: 400,
      color: q.textLight,
      marginBottom: 2,
    },
    footerWebsite: {
      fontSize: 8,
      fontWeight: 500,
      color: q.primary,
      marginBottom: 2,
    },
    footerPowered: {
      fontSize: 7,
      fontWeight: 300,
      color: q.textLight,
    },
    thankYou: {
      textAlign: 'center' as const,
      fontSize: 11,
      fontWeight: 600,
      color: q.primary,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: q.border,
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatPrintDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ============================================================================
// PDF Document
// ============================================================================

const ReceiptPDFDocument: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const styles = buildReceiptStyles();
  const prior = data.previousPayments ?? [];
  const priorTotal = prior.reduce((sum, line) => sum + line.amount, 0);

  const rows = [
    { label: 'Order Number', value: data.orderNumber },
    { label: 'Payment Type', value: paymentTypeLabel(data.paymentType) },
    { label: 'Payment Method', value: data.paymentMethod || '—' },
    { label: 'Payment Date', value: data.paymentDate },
    ...(data.receiptRef ? [{ label: 'Receipt Reference', value: data.receiptRef }] : []),
    ...(data.invoiceNumber ? [{ label: 'Invoice Number', value: data.invoiceNumber }] : []),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.receiptDocTitle}>RECEIPT</Text>
            <Text style={styles.receiptRefLine}>Ref: {data.receiptNumber}</Text>
          </View>
          <View style={styles.headerRight}>
            {data.logoUrl ? (
              <Image src={data.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.companyNameFallback}>DAWIN FINISHES</Text>
            )}
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Received From</Text>
            <Text style={styles.infoValue}>{data.customerName}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{data.paymentDate}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Receipt No.</Text>
            <Text style={styles.infoValue}>{data.receiptNumber}</Text>
          </View>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount Received</Text>
          <Text style={styles.amountValue}>
            {formatCurrency(data.amountReceived, data.currency)}
          </Text>
        </View>

        <View style={styles.detailsTable}>
          <View style={styles.detailsTableHeader}>
            <Text style={styles.detailsHeaderCell}>Detail</Text>
            <Text style={styles.detailsHeaderCellRight}>Value</Text>
          </View>
          {rows.map((row, i) => (
            <View
              key={row.label}
              style={[
                styles.detailRow,
                i % 2 === 1 ? styles.detailRowAlt : {},
                i === rows.length - 1 ? styles.detailRowLast : {},
              ]}
            >
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order Total</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(data.orderTotal, data.currency)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>This Payment</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(data.amountReceived, data.currency)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance Remaining</Text>
            <Text
              style={[
                styles.balanceValue,
                data.balanceRemaining <= 0 ? styles.balancePaid : {},
              ]}
            >
              {data.balanceRemaining <= 0
                ? 'FULLY PAID'
                : formatCurrency(data.balanceRemaining, data.currency)}
            </Text>
          </View>
        </View>

        {prior.length > 0 ? (
          <View style={styles.priorPaymentsBlock}>
            <Text style={styles.priorPaymentsTitle}>Previous payments on this order</Text>
            <View style={styles.priorTable}>
              <View style={styles.priorTableHeader}>
                <Text style={[styles.priorHeaderCell, styles.priorColDate]}>Date</Text>
                <Text style={[styles.priorHeaderCell, styles.priorColType]}>Type</Text>
                <Text style={[styles.priorHeaderCell, styles.priorColMethod]}>Method</Text>
                <Text style={[styles.priorHeaderCell, styles.priorColAmount]}>Amount</Text>
              </View>
              {prior.map((line, i) => (
                <View
                  key={`${line.dateLabel}-${line.typeLabel}-${i}`}
                  style={[
                    styles.priorRow,
                    i % 2 === 1 ? styles.priorRowAlt : {},
                  ]}
                >
                  <Text style={[styles.priorCell, styles.priorColDate]}>{line.dateLabel}</Text>
                  <Text style={[styles.priorCell, styles.priorColType]}>{line.typeLabel}</Text>
                  <Text style={[styles.priorCell, styles.priorColMethod]}>{line.method}</Text>
                  <Text style={[styles.priorCell, styles.priorColAmount]}>
                    {formatCurrency(line.amount, data.currency)}
                  </Text>
                </View>
              ))}
              <View style={styles.priorTotalRow}>
                <Text style={styles.priorTotalLabel}>Total paid before this receipt</Text>
                <Text style={styles.priorTotalValue}>
                  {formatCurrency(priorTotal, data.currency)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.thankYou}>
          Thank you for your payment!
        </Text>

        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            <Text style={styles.footerText}>{RECEIPT_COMPANY_FOOTER.address}</Text>
            <Text style={styles.footerText}>
              {RECEIPT_COMPANY_FOOTER.city}, {RECEIPT_COMPANY_FOOTER.region},{' '}
              {RECEIPT_COMPANY_FOOTER.country}
            </Text>
            <Text style={styles.footerWebsite}>{RECEIPT_COMPANY_FOOTER.website}</Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.footerText}>1/1</Text>
            <Text style={styles.footerText}>Printed on {formatPrintDate(new Date())}</Text>
            <Text style={styles.footerPowered}>Powered by DawinOS</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export const receiptPdfService = {
  async generateBlob(data: ReceiptData): Promise<Blob> {
    const document = <ReceiptPDFDocument data={data} />;
    return await pdf(document).toBlob();
  },
};
