/**
 * PDFProjectSummaryPage — Project summary with cabinet roster and totals
 */
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { DesignScene, SceneCabinet } from '../../types/scene.types';
import type { PricingBreakdown } from '../../types/constraintEngine.types';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginTop: 16, color: '#374151' },
  table: { width: '100%' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  colCode: { width: '15%', fontFamily: 'Courier', fontSize: 9 },
  colName: { width: '40%' },
  colType: { width: '15%', fontSize: 9, color: '#6b7280' },
  colPrice: { width: '20%', textAlign: 'right' },
  colStatus: { width: '10%', textAlign: 'center', fontSize: 8 },
  headerText: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalRow: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: '#374151' },
  totalLabel: { width: '70%', fontWeight: 'bold' },
  totalValue: { width: '30%', textAlign: 'right', fontWeight: 'bold', fontSize: 12 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
});

interface PDFProjectSummaryPageProps {
  scene: DesignScene;
  cabinets: SceneCabinet[];
  totalPricing: PricingBreakdown;
}

function fmt(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US')}`;
  return `UGX ${amount.toLocaleString()}`;
}

export function PDFProjectSummaryPage({ scene, cabinets, totalPricing }: PDFProjectSummaryPageProps) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Project Summary</Text>

      <Text style={styles.sectionTitle}>Cabinet Roster</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.colCode, styles.headerText]}>Code</Text>
          <Text style={[styles.colName, styles.headerText]}>Description</Text>
          <Text style={[styles.colType, styles.headerText]}>Type</Text>
          <Text style={[styles.colPrice, styles.headerText]}>Est. Price</Text>
          <Text style={[styles.colStatus, styles.headerText]}>Status</Text>
        </View>

        {cabinets.map(cab => {
          const price = cab.estimatedPrice;
          const total = price?.total ?? 0;
          return (
            <View key={cab.id} style={styles.tableRow}>
              <Text style={styles.colCode}>{cab.cabinetCode}</Text>
              <Text style={styles.colName}>{cab.displayName}</Text>
              <Text style={styles.colType}>{(cab.configuration as Record<string, unknown>)?.productType as string ?? ''}</Text>
              <Text style={styles.colPrice}>{total > 0 ? fmt(total, totalPricing.currency) : '—'}</Text>
              <Text style={styles.colStatus}>{cab.isLocked ? 'Locked' : 'Draft'}</Text>
            </View>
          );
        })}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{cabinets.length} cabinet{cabinets.length !== 1 ? 's' : ''}</Text>
          <Text style={styles.totalValue}>{fmt(totalPricing.total, totalPricing.currency)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Cost Breakdown</Text>
      <View style={styles.table}>
        {[
          { label: 'Materials', amount: totalPricing.materialsCost },
          { label: 'Edge Banding', amount: totalPricing.edgeBandingCost },
          { label: 'Hardware', amount: totalPricing.hardwareCost },
          { label: 'Labor', amount: totalPricing.laborCost },
          { label: 'Overhead', amount: totalPricing.overheadCost },
          { label: 'Margin', amount: totalPricing.marginAmount },
        ].filter(l => l.amount > 0).map(line => (
          <View key={line.label} style={styles.tableRow}>
            <Text style={{ width: '70%', color: '#6b7280' }}>{line.label}</Text>
            <Text style={{ width: '30%', textAlign: 'right' }}>{fmt(line.amount, totalPricing.currency)}</Text>
          </View>
        ))}
        {totalPricing.vatAmount > 0 && (
          <View style={styles.tableRow}>
            <Text style={{ width: '70%', color: '#6b7280' }}>VAT (18%)</Text>
            <Text style={{ width: '30%', textAlign: 'right' }}>{fmt(totalPricing.vatAmount, totalPricing.currency)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{fmt(totalPricing.total, totalPricing.currency)}</Text>
        </View>
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{scene.name}</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}
