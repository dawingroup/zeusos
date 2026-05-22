/**
 * Client-facing invoice PDF preview (in-browser).
 *
 * Uses @react-pdf/renderer (already a project dependency). Only takes a
 * ClientFacingInvoice — the TypeScript type makes it structurally
 * impossible to pass an internal invoice with `costMinor` /
 * `sourceSubsidiaryId` fields into this component.
 */

import {
  PDFViewer,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { ClientFacingInvoice } from '../types/client-invoice.types';

interface InvoicePDFPreviewProps {
  invoice: ClientFacingInvoice;
  /** When false, render only the <Document> (useful for downloadable
   *  links elsewhere). Defaults to true. */
  withViewer?: boolean;
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1pt solid #ccc',
  },
  brand: { fontSize: 16, fontWeight: 700 },
  meta: { fontSize: 9, color: '#555', marginTop: 2 },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 700,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '0.5pt solid #eee',
  },
  cellDesc: { flexGrow: 1 },
  cellAmount: { width: 100, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 6,
    borderTop: '1pt solid #333',
    fontWeight: 700,
  },
  footer: {
    marginTop: 24,
    fontSize: 8,
    color: '#666',
  },
});

function format(amountMinor: number, currency: string) {
  // Most ZeusOS currencies use 0 decimals (UGX/KES); USD uses 2.
  const decimals = currency === 'USD' || currency === 'EUR' || currency === 'GBP' ? 2 : 0;
  const major = amountMinor / Math.pow(10, decimals);
  return `${currency} ${major.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function ClientInvoiceDocument({ invoice }: { invoice: ClientFacingInvoice }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Zeus Group</Text>
          <Text style={styles.meta}>
            Invoice {invoice.id} · Client {invoice.clientId}
          </Text>
          <Text style={styles.meta}>
            Status: {invoice.status} ·{' '}
            {invoice.issuedAt ? `Issued ${String(invoice.issuedAt)}` : 'Not yet issued'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Services</Text>
        {invoice.lines.map((line) => (
          <View key={line.id} style={styles.row}>
            <Text style={styles.cellDesc}>{line.description}</Text>
            <Text style={styles.cellAmount}>
              {format(line.amountMinor, invoice.total.currency)}
            </Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.cellDesc}>Total</Text>
          <Text style={styles.cellAmount}>
            {format(invoice.total.amountMinor, invoice.total.currency)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Tax</Text>
        <Text>
          {invoice.taxTreatment.note} · Rate{' '}
          {(invoice.taxTreatment.rateBps / 100).toFixed(2)}%
        </Text>

        <Text style={styles.footer}>
          Zeus Group — East African marketing consortium. This invoice is
          issued by the Zeus parent entity. Questions: billing@zeustheagency.com.
        </Text>
      </Page>
    </Document>
  );
}

export function InvoicePDFPreview({ invoice, withViewer = true }: InvoicePDFPreviewProps) {
  if (!withViewer) {
    return <ClientInvoiceDocument invoice={invoice} />;
  }
  return (
    <div style={{ height: 600, border: '1px solid #ddd' }}>
      <PDFViewer width="100%" height="100%" showToolbar={false}>
        <ClientInvoiceDocument invoice={invoice} />
      </PDFViewer>
    </div>
  );
}

export default InvoicePDFPreview;
