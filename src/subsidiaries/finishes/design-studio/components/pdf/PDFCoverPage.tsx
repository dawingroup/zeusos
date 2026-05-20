/**
 * PDFCoverPage — React-PDF cover page component
 *
 * Project name, customer, date, cabinet count, total value.
 */
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { DesignScene } from '../../types/scene.types';

const styles = StyleSheet.create({
  page: { padding: 60, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  header: { marginBottom: 40 },
  logo: { fontSize: 10, color: '#6b7280', letterSpacing: 2, marginBottom: 4 },
  company: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  titleBlock: { marginTop: 80, marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280' },
  infoGrid: { marginTop: 40, gap: 16 },
  infoRow: { flexDirection: 'row', gap: 40 },
  infoLabel: { fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  infoValue: { fontSize: 12, color: '#374151' },
  footer: { position: 'absolute', bottom: 40, left: 60, right: 60, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#9ca3af' },
});

interface PDFCoverPageProps {
  scene: DesignScene;
  customer?: { name: string; address: string };
  generatedAt: Date;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US')}`;
  return `UGX ${amount.toLocaleString()}`;
}

export function PDFCoverPage({ scene, customer, generatedAt }: PDFCoverPageProps) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.logo}>DAWIN FINISHES</Text>
        <Text style={styles.company}>Design Studio</Text>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{scene.name}</Text>
        {scene.description && <Text style={styles.subtitle}>{scene.description}</Text>}
      </View>

      <View style={styles.infoGrid}>
        {customer && (
          <View style={styles.infoRow}>
            <View>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>{customer.name}</Text>
            </View>
            {customer.address && (
              <View>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{customer.address}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.infoRow}>
          <View>
            <Text style={styles.infoLabel}>Cabinets</Text>
            <Text style={styles.infoValue}>{scene.totalCabinetCount}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Estimated Value</Text>
            <Text style={styles.infoValue}>{formatCurrency(scene.totalEstimatedValue, scene.currency)}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{scene.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Dawin Finishes — Custom Furniture & Interiors</Text>
        <Text style={styles.footerText}>Generated {generatedAt.toISOString().slice(0, 10)}</Text>
      </View>
    </Page>
  );
}
