/**
 * PDFCutListPage — Landscape aggregated cut list grouped by material
 */
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { AggregatedCutList } from '../../types/assembly.types';

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 8 },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  materialHeader: { fontSize: 10, fontWeight: 'bold', marginTop: 10, marginBottom: 4, color: '#374151', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 2 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#9ca3af', paddingBottom: 2, marginBottom: 2 },
  row: { flexDirection: 'row', paddingVertical: 1.5, borderBottomWidth: 0.25, borderBottomColor: '#e5e7eb' },
  headerText: { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase' },
  colPart: { width: '25%' },
  colL: { width: '10%', textAlign: 'right', fontFamily: 'Courier' },
  colW: { width: '10%', textAlign: 'right', fontFamily: 'Courier' },
  colT: { width: '8%', textAlign: 'right', fontFamily: 'Courier' },
  colGrain: { width: '8%', textAlign: 'center' },
  colQty: { width: '7%', textAlign: 'right' },
  colEdge: { width: '22%', fontSize: 7, color: '#6b7280' },
  colArea: { width: '10%', textAlign: 'right' },
  subtotalRow: { flexDirection: 'row', marginTop: 2, paddingTop: 2, borderTopWidth: 0.5, borderTopColor: '#9ca3af' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 6, color: '#9ca3af' },
});

interface PDFCutListPageProps {
  cutList: AggregatedCutList;
  totalSheetCount: Record<string, number>;
}

export function PDFCutListPage({ cutList, totalSheetCount }: PDFCutListPageProps) {
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>Aggregated Cut List</Text>

      {cutList.byMaterial.map((group, gi) => (
        <View key={gi} wrap={false}>
          <Text style={styles.materialHeader}>
            {group.material} — {group.totalArea.toFixed(2)} m²
            {totalSheetCount[group.material] ? ` (~${totalSheetCount[group.material]} sheets)` : ''}
          </Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.colPart, styles.headerText]}>Part Name</Text>
            <Text style={[styles.colL, styles.headerText]}>Length</Text>
            <Text style={[styles.colW, styles.headerText]}>Width</Text>
            <Text style={[styles.colT, styles.headerText]}>Thk</Text>
            <Text style={[styles.colGrain, styles.headerText]}>Grain</Text>
            <Text style={[styles.colQty, styles.headerText]}>Qty</Text>
            <Text style={[styles.colEdge, styles.headerText]}>Edge Banding</Text>
            <Text style={[styles.colArea, styles.headerText]}>Area m²</Text>
          </View>

          {group.parts.map((part, pi) => {
            const dims = part.dimensions;
            const eb = part.edgeBanding;
            const edgeStr = eb ? [
              eb.top?.type ? `T:${eb.top.type}` : '',
              eb.bottom?.type ? `B:${eb.bottom.type}` : '',
              eb.left?.type ? `L:${eb.left.type}` : '',
              eb.right?.type ? `R:${eb.right.type}` : '',
            ].filter(Boolean).join(' ') : '';
            const area = dims ? (dims.length * dims.width * part.quantity) / 1_000_000 : 0;

            return (
              <View key={pi} style={styles.row}>
                <Text style={styles.colPart}>{part.partName}</Text>
                <Text style={styles.colL}>{dims?.length ?? '—'}</Text>
                <Text style={styles.colW}>{dims?.width ?? '—'}</Text>
                <Text style={styles.colT}>{dims?.thickness ?? '—'}</Text>
                <Text style={styles.colGrain}>{dims?.grainDirection === 'none' ? '—' : dims?.grainDirection?.charAt(0).toUpperCase() ?? '—'}</Text>
                <Text style={styles.colQty}>{part.quantity}</Text>
                <Text style={styles.colEdge}>{edgeStr || '—'}</Text>
                <Text style={styles.colArea}>{area > 0 ? area.toFixed(3) : '—'}</Text>
              </View>
            );
          })}

          <View style={styles.subtotalRow}>
            <Text style={[styles.colPart, { fontWeight: 'bold' }]}>Subtotal</Text>
            <Text style={[styles.colArea, { fontWeight: 'bold', width: '75%', textAlign: 'right' }]}>
              {group.totalArea.toFixed(3)} m²
            </Text>
          </View>
        </View>
      ))}

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Cut List — All Materials</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}
