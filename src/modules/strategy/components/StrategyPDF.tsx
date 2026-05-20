/**
 * Strategy PDF Component
 * Renders the strategy report as a downloadable PDF using @react-pdf/renderer
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { StrategyReport } from '../types';

// Helvetica is a built-in font in react-pdf, no registration needed

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #1a365d',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#4a5568',
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    fontSize: 9,
    color: '#718096',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 10,
    backgroundColor: '#edf2f7',
    padding: 8,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: '#4a5568',
    textAlign: 'justify',
  },
  trendCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f7fafc',
    borderRadius: 4,
    borderLeft: '3px solid #4299e1',
  },
  trendName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2b6cb0',
    marginBottom: 4,
  },
  trendDescription: {
    fontSize: 9,
    color: '#4a5568',
    marginBottom: 4,
  },
  trendMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#718096',
  },
  recommendationCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fffaf0',
    borderRadius: 4,
    borderLeft: '3px solid #ed8936',
  },
  recommendationTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#c05621',
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 9,
    color: '#4a5568',
    marginBottom: 8,
  },
  featureList: {
    marginTop: 6,
    paddingLeft: 10,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 4,
    fontSize: 9,
  },
  featureBullet: {
    width: 15,
    color: '#48bb78',
  },
  featureText: {
    flex: 1,
    color: '#2d3748',
  },
  priorityBadge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    color: '#ffffff',
  },
  priorityHigh: {
    backgroundColor: '#e53e3e',
  },
  priorityMedium: {
    backgroundColor: '#ed8936',
  },
  priorityLow: {
    backgroundColor: '#48bb78',
  },
  colorPalette: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  colorSwatch: {
    width: 60,
    height: 40,
    marginRight: 10,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorLabel: {
    fontSize: 8,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  colorDescription: {
    fontSize: 9,
    color: '#4a5568',
    marginTop: 5,
  },
  materialTable: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2d3748',
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    color: '#4a5568',
  },
  feasibilitySection: {
    backgroundColor: '#e6fffa',
    padding: 15,
    borderRadius: 4,
    marginBottom: 15,
  },
  feasibilityScore: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#234e52',
    textAlign: 'center',
  },
  feasibilityLabel: {
    fontSize: 10,
    color: '#285e61',
    textAlign: 'center',
    marginTop: 4,
  },
  feasibilityNotes: {
    fontSize: 9,
    color: '#285e61',
    marginTop: 10,
    textAlign: 'center',
  },
  productionTable: {
    marginTop: 10,
  },
  assetTag: {
    fontSize: 8,
    backgroundColor: '#bee3f8',
    color: '#2b6cb0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    marginRight: 4,
  },
  nextStepsList: {
    paddingLeft: 15,
  },
  nextStepItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  nextStepNumber: {
    width: 20,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4299e1',
  },
  nextStepText: {
    flex: 1,
    fontSize: 10,
    color: '#4a5568',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#a0aec0',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 10,
  },
});

interface StrategyPDFProps {
  report: StrategyReport;
}

export function StrategyPDF({ report }: StrategyPDFProps) {
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high': return styles.priorityHigh;
      case 'medium': return styles.priorityMedium;
      case 'low': return styles.priorityLow;
      default: return styles.priorityMedium;
    }
  };

  return (
    <Document>
      {/* Page 1: Executive Summary & Trends */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{report.reportTitle}</Text>
          <Text style={styles.subtitle}>Design Strategy Report</Text>
          <View style={styles.metadata}>
            <Text>Project: {report.metadata.projectName}</Text>
            <Text>Location: {report.metadata.location}</Text>
            <Text>Generated: {new Date(report.metadata.generatedAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Executive Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text style={styles.summaryText}>{report.executiveSummary}</Text>
        </View>

        {/* Trends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market Trends Analysis</Text>
          {report.trends.map((trend, index) => (
            <View key={index} style={styles.trendCard}>
              <Text style={styles.trendName}>{trend.name}</Text>
              <Text style={styles.trendDescription}>{trend.description}</Text>
              <View style={styles.trendMeta}>
                <Text>Relevance: {trend.relevanceScore}%</Text>
                <Text>Source: {trend.source}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Dawin Design Strategy</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Page 2: Recommendations */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strategic Recommendations</Text>
          {report.recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.recommendationTitle}>{rec.title}</Text>
                <Text style={[styles.priorityBadge, getPriorityStyle(rec.priority)]}>
                  {rec.priority.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.recommendationDescription}>{rec.description}</Text>
              <Text style={{ fontSize: 8, color: '#718096', marginBottom: 4 }}>
                Related Trend: {rec.trendName} | Complexity: {rec.complexity} | Est. {rec.estimatedDays} days
              </Text>
              
              {rec.matchedFeatures.length > 0 && (
                <View style={styles.featureList}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#2d3748', marginBottom: 4 }}>
                    Matched Features:
                  </Text>
                  {rec.matchedFeatures.map((mf, mfIndex) => (
                    <View key={mfIndex} style={styles.featureItem}>
                      <Text style={styles.featureBullet}>✓</Text>
                      <Text style={styles.featureText}>
                        {mf.featureName} - {mf.rationale}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Dawin Design Strategy</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Page 3: Materials, Colors & Production Feasibility */}
      <Page size="A4" style={styles.page}>
        {/* Color Scheme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color Scheme</Text>
          <View style={styles.colorPalette}>
            <View style={[styles.colorSwatch, { backgroundColor: report.colorScheme.primary }]}>
              <Text style={styles.colorLabel}>Primary</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: report.colorScheme.secondary }]}>
              <Text style={styles.colorLabel}>Secondary</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: report.colorScheme.accent }]}>
              <Text style={styles.colorLabel}>Accent</Text>
            </View>
          </View>
          <Text style={styles.colorDescription}>{report.colorScheme.description}</Text>
        </View>

        {/* Material Palette */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Material Palette</Text>
          <View style={styles.materialTable}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Material</Text>
              <Text style={styles.tableHeaderCell}>Application</Text>
              <Text style={styles.tableHeaderCell}>Finish</Text>
            </View>
            {report.materialPalette.map((mat, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{mat.material}</Text>
                <Text style={styles.tableCell}>{mat.application}</Text>
                <Text style={styles.tableCell}>{mat.finish}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Production Feasibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Production Feasibility</Text>
          <View style={styles.feasibilitySection}>
            <Text style={styles.feasibilityScore}>{report.productionFeasibility.overallScore}%</Text>
            <Text style={styles.feasibilityLabel}>Feasibility Score</Text>
            <Text style={styles.feasibilityNotes}>{report.productionFeasibility.notes}</Text>
            <Text style={{ fontSize: 9, color: '#285e61', textAlign: 'center', marginTop: 8 }}>
              Estimated Total: {report.productionFeasibility.estimatedTotalDays} days
            </Text>
          </View>

          {/* Production Details */}
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#2d3748', marginBottom: 8 }}>
            Required Features & Assets
          </Text>
          <View style={styles.productionTable}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Feature</Text>
              <Text style={styles.tableHeaderCell}>Category</Text>
              <Text style={styles.tableHeaderCell}>Required Assets</Text>
            </View>
            {report.productionDetails.map((pd, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{pd.featureName}</Text>
                <Text style={styles.tableCell}>{pd.category}</Text>
                <Text style={styles.tableCell}>
                  {pd.requiredAssets.map(a => a.name).join(', ') || 'None specified'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Dawin Design Strategy</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Page 4: Next Steps */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Steps</Text>
          <View style={styles.nextStepsList}>
            {report.nextSteps.map((step, index) => (
              <View key={index} style={styles.nextStepItem}>
                <Text style={styles.nextStepNumber}>{index + 1}.</Text>
                <Text style={styles.nextStepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Summary Stats */}
        <View style={[styles.section, { marginTop: 30 }]}>
          <Text style={styles.sectionTitle}>Report Summary</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 15 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#4299e1' }}>
                {report.trends.length}
              </Text>
              <Text style={{ fontSize: 10, color: '#718096' }}>Trends Analyzed</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#ed8936' }}>
                {report.recommendations.length}
              </Text>
              <Text style={{ fontSize: 10, color: '#718096' }}>Recommendations</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#48bb78' }}>
                {report.metadata.featuresProposed}
              </Text>
              <Text style={{ fontSize: 10, color: '#718096' }}>Features Proposed</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#9f7aea' }}>
                {report.productionFeasibility.estimatedTotalDays}
              </Text>
              <Text style={{ fontSize: 10, color: '#718096' }}>Est. Days</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Dawin Design Strategy</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
