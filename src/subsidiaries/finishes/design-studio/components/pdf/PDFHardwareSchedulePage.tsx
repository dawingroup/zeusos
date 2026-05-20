/**
 * PDFHardwareSchedulePage — Hardware schedule grouped by item
 */
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { HardwareScheduleEntry } from '../../types/mdp.types';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 16 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 4, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  headerText: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase' },
  colName: { width: '40%' },
  colSku: { width: '20%', fontFamily: 'Courier', fontSize: 8, color: '#6b7280' },
  colQty: { width: '15%', textAlign: 'right' },
  colBoring: { width: '25%', fontSize: 8, color: '#6b7280' },
  totalRow: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: '#374151' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
});

interface PDFHardwareSchedulePageProps {
  hardwareSchedule: HardwareScheduleEntry[];
}

export function PDFHardwareSchedulePage({ hardwareSchedule }: PDFHardwareSchedulePageProps) {
  const totalItems = hardwareSchedule.reduce((sum, h) => sum + h.quantity, 0);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Hardware Schedule</Text>

      <View style={styles.tableHeader}>
        <Text style={[styles.colName, styles.headerText]}>Hardware Item</Text>
        <Text style={[styles.colSku, styles.headerText]}>SKU</Text>
        <Text style={[styles.colQty, styles.headerText]}>Qty</Text>
        <Text style={[styles.colBoring, styles.headerText]}>Boring Required</Text>
      </View>

      {hardwareSchedule.map((item, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.colName}>{item.hardwareName}</Text>
          <Text style={styles.colSku}>{item.inventoryItemId}</Text>
          <Text style={styles.colQty}>{item.quantity}</Text>
          <Text style={styles.colBoring}>{item.boringRequired ? 'Yes' : 'No'}</Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={[styles.colName, { fontWeight: 'bold' }]}>Total</Text>
        <Text style={styles.colSku} />
        <Text style={[styles.colQty, { fontWeight: 'bold' }]}>{totalItems}</Text>
        <Text style={styles.colBoring} />
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Hardware Schedule</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}
