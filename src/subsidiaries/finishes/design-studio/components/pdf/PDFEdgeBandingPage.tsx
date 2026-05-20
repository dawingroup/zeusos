/**
 * PDFEdgeBandingPage — Edge banding totals by type
 */
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 16 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 4, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  headerText: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase' },
  colType: { width: '50%' },
  colLength: { width: '25%', textAlign: 'right', fontFamily: 'Courier' },
  colUnit: { width: '25%', textAlign: 'right', color: '#6b7280' },
  totalRow: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: '#374151' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
});

interface PDFEdgeBandingPageProps {
  edgeBandingByType: Record<string, number>;
}

export function PDFEdgeBandingPage({ edgeBandingByType }: PDFEdgeBandingPageProps) {
  const entries = Object.entries(edgeBandingByType).sort(([, a], [, b]) => b - a);
  const totalLength = entries.reduce((sum, [, len]) => sum + len, 0);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Edge Banding Schedule</Text>

      <View style={styles.tableHeader}>
        <Text style={[styles.colType, styles.headerText]}>Edge Type</Text>
        <Text style={[styles.colLength, styles.headerText]}>Total Length</Text>
        <Text style={[styles.colUnit, styles.headerText]}>Unit</Text>
      </View>

      {entries.map(([type, length]) => (
        <View key={type} style={styles.row}>
          <Text style={styles.colType}>{type}</Text>
          <Text style={styles.colLength}>{(length / 1000).toFixed(1)}</Text>
          <Text style={styles.colUnit}>lm</Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={[styles.colType, { fontWeight: 'bold' }]}>Total</Text>
        <Text style={[styles.colLength, { fontWeight: 'bold' }]}>{(totalLength / 1000).toFixed(1)}</Text>
        <Text style={[styles.colUnit, { fontWeight: 'bold' }]}>lm</Text>
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Edge Banding Schedule</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}
