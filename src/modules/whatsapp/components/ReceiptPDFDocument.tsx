/**
 * ReceiptPDFDocument - Branded PDF receipt using @react-pdf/renderer
 * Follows the same Outfit font + Dawin branding pattern as quote-pdf-generator
 */

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register Outfit font (same as quote-pdf-generator)
Font.register({
  family: 'Outfit',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf',
      fontWeight: 400,
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
// TYPES
// ============================================================================

export interface ReceiptData {
  receiptNumber: string;
  orderNumber: string;
  customerName: string;
  paymentDate: string;
  paymentMethod: string;
  paymentReference: string;
  amountPaid: number;
  currency: string;
  totalOrderAmount: number;
  milestone?: string;
  balanceRemaining: number;
  companyLogoUrl?: string;
}

// ============================================================================
// STYLES
// ============================================================================

const BRAND_PRIMARY = '#872E5C';
const BRAND_ACCENT = '#E18425';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Outfit',
    fontSize: 10,
    padding: 40,
    color: '#333',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    borderBottomWidth: 3,
    borderBottomColor: BRAND_PRIMARY,
    paddingBottom: 15,
  },
  headerLeft: {
    flex: 1,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 700,
    color: BRAND_PRIMARY,
    marginBottom: 4,
  },
  companyAddress: {
    fontSize: 8,
    color: '#666',
    lineHeight: 1.4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  receiptLabel: {
    fontSize: 24,
    fontWeight: 700,
    color: BRAND_PRIMARY,
    letterSpacing: 2,
  },
  receiptNumber: {
    fontSize: 11,
    fontWeight: 600,
    color: '#555',
    marginTop: 4,
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: 'contain',
    marginBottom: 8,
  },

  // Title Bar
  titleBar: {
    backgroundColor: BRAND_PRIMARY,
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  titleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1,
  },

  // Info Grid
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 25,
    gap: 20,
  },
  infoColumn: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 4,
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: 600,
    color: '#333',
  },

  // Payment Details Table
  table: {
    marginBottom: 25,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND_PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  colDescription: { flex: 3 },
  colAmount: { flex: 2, textAlign: 'right' },

  // Amount Summary
  summarySection: {
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  summaryBox: {
    width: 250,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryHighlight: {
    backgroundColor: BRAND_PRIMARY,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#555',
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 600,
    color: '#333',
  },
  summaryLabelWhite: {
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
  },
  summaryValueWhite: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
  },

  // Status Badge
  statusSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  paidBadge: {
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  paidText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#999',
  },
  footerBrand: {
    fontSize: 8,
    fontWeight: 600,
    color: BRAND_ACCENT,
  },

  // Note
  noteSection: {
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_ACCENT,
  },
  noteText: {
    fontSize: 9,
    color: '#92400e',
    lineHeight: 1.5,
  },
});

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// DOCUMENT COMPONENT
// ============================================================================

export function ReceiptPDFDocument({ data }: { data: ReceiptData }) {
  const isFullyPaid = data.balanceRemaining <= 0;

  return (
    <Document title={`Receipt ${data.receiptNumber}`} author="Dawin Finishes">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {data.companyLogoUrl ? (
              <Image src={data.companyLogoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.companyName}>Dawin Finishes</Text>
            )}
            <Text style={styles.companyAddress}>
              Kayondo Road, Kyambogo Upper Estate{'\n'}
              Ground Floor, Jordan House{'\n'}
              Kampala, Uganda{'\n'}
              dawinfinishes.com
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.receiptLabel}>RECEIPT</Text>
            <Text style={styles.receiptNumber}>{data.receiptNumber}</Text>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Received From</Text>
            <Text style={styles.infoValue}>{data.customerName}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Payment Date</Text>
            <Text style={styles.infoValue}>{formatDate(data.paymentDate)}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Order Reference</Text>
            <Text style={styles.infoValue}>{data.orderNumber}</Text>
          </View>
        </View>

        {/* Payment Details Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colDescription}>
              <Text style={styles.tableHeaderText}>Description</Text>
            </View>
            <View style={styles.colAmount}>
              <Text style={{ ...styles.tableHeaderText, textAlign: 'right' }}>Amount</Text>
            </View>
          </View>

          {/* Payment Row */}
          <View style={styles.tableRow}>
            <View style={styles.colDescription}>
              <Text style={{ fontSize: 11, fontWeight: 600 }}>
                {data.milestone ? `${data.milestone} Payment` : 'Payment Received'}
              </Text>
              <Text style={{ fontSize: 9, color: '#666', marginTop: 2 }}>
                Method: {data.paymentMethod}
              </Text>
              <Text style={{ fontSize: 9, color: '#666' }}>
                Ref: {data.paymentReference}
              </Text>
            </View>
            <View style={styles.colAmount}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', textAlign: 'right' }}>
                {formatCurrency(data.amountPaid, data.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order Total</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(data.totalOrderAmount, data.currency)}
              </Text>
            </View>
            <View style={{ ...styles.summaryRow, ...styles.summaryHighlight, borderBottomWidth: 0 }}>
              <Text style={styles.summaryLabelWhite}>Amount Paid</Text>
              <Text style={styles.summaryValueWhite}>
                {formatCurrency(data.amountPaid, data.currency)}
              </Text>
            </View>
            {data.balanceRemaining > 0 && (
              <View style={{ ...styles.summaryRow, borderBottomWidth: 0 }}>
                <Text style={{ ...styles.summaryLabel, color: BRAND_ACCENT, fontWeight: 600 }}>
                  Balance Remaining
                </Text>
                <Text style={{ ...styles.summaryValue, color: BRAND_ACCENT }}>
                  {formatCurrency(data.balanceRemaining, data.currency)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Paid Badge */}
        <View style={styles.statusSection}>
          <View style={styles.paidBadge}>
            <Text style={styles.paidText}>
              {isFullyPaid ? 'PAID IN FULL' : 'PAYMENT RECEIVED'}
            </Text>
          </View>
        </View>

        {/* Note */}
        {data.balanceRemaining > 0 && (
          <View style={styles.noteSection}>
            <Text style={styles.noteText}>
              This receipt acknowledges partial payment. The remaining balance of{' '}
              {formatCurrency(data.balanceRemaining, data.currency)} is due per the agreed payment schedule.
              For questions about your balance, please contact us.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            This is a system-generated receipt. No signature required.
          </Text>
          <Text style={styles.footerBrand}>Dawin Finishes | dawinfinishes.com</Text>
        </View>
      </Page>
    </Document>
  );
}
