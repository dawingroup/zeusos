/**
 * Minutes PDF Generator
 *
 * Produces a professionally branded "Meeting Minutes" PDF from a
 * ClientInteraction. Mirrors the Outfit font + Dawin Finishes palette used
 * by quote-pdf-generator and receiptPdfGenerator.
 *
 * Consumed by ShareMinutesDialog (download / WhatsApp share).
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
  pdf,
} from '@react-pdf/renderer';
import type { ClientInteraction, InteractionType } from '../types';

// ---------------------------------------------------------------------------
// Font registration — same CDN as other branded PDFs
// ---------------------------------------------------------------------------

Font.register({
  family: 'Outfit',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

const BRAND_PRIMARY = '#872E5C';
const BRAND_ACCENT = '#E18425';
const TEXT_DARK = '#1F2937';
const TEXT_MED = '#4B5563';
const TEXT_LIGHT = '#9CA3AF';
const BORDER = '#E5E7EB';
const BG_SOFT = '#FAFAFA';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MinutesCompanyInfo {
  name: string; // e.g. "Dawin Finishes"
  tagline?: string;
  address?: string[]; // multi-line
  website?: string;
  logoUrl?: string;
}

export interface MinutesContext {
  projectCode?: string;
  projectName?: string;
  clientName?: string;
  preparedBy?: string; // author's name / email
  documentRef?: string; // e.g. "MIN-2026-0042"
}

export interface MinutesPdfData {
  interaction: ClientInteraction;
  context: MinutesContext;
  company: MinutesCompanyInfo;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_COMPANY_INFO: MinutesCompanyInfo = {
  name: 'Dawin Finishes',
  tagline: 'Custom Millwork & Furniture',
  address: [
    'Kayondo Road, Kyambogo Upper Estate',
    'Ground Floor, Jordan House',
    'Kampala, Uganda',
  ],
  website: 'dawinfinishes.com',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Outfit',
    fontSize: 10,
    padding: 40,
    color: TEXT_DARK,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: BRAND_PRIMARY,
  },
  headerLeft: { flex: 1 },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: BRAND_PRIMARY,
    letterSpacing: 0.5,
  },
  companyTagline: {
    fontSize: 9,
    color: BRAND_ACCENT,
    fontWeight: 600,
    marginTop: 1,
  },
  companyAddress: {
    fontSize: 8,
    color: TEXT_LIGHT,
    lineHeight: 1.4,
    marginTop: 4,
  },
  headerRight: { alignItems: 'flex-end' },
  docTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: BRAND_PRIMARY,
    letterSpacing: 2,
  },
  docRef: {
    fontSize: 10,
    fontWeight: 600,
    color: TEXT_MED,
    marginTop: 3,
  },
  logo: {
    width: 180,
    height: 64,
    objectFit: 'contain',
    objectPosition: 'left center',
    alignSelf: 'flex-start',
    marginLeft: 0,
    marginBottom: 6,
  },

  // Title strip
  titleStrip: {
    backgroundColor: BRAND_PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    marginBottom: 16,
  },
  titleStripLabel: {
    color: '#FCE6F0',
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  titleStripText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    marginTop: 2,
  },

  // Meta grid
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
    gap: 10,
  },
  metaCell: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: BG_SOFT,
    borderLeftWidth: 2,
    borderLeftColor: BRAND_PRIMARY,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 2,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: TEXT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 600,
    color: TEXT_DARK,
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: BRAND_PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sectionBody: {
    fontSize: 10,
    lineHeight: 1.5,
    color: TEXT_DARK,
  },

  // Attendees
  attendeeRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  attendeeRowLast: { borderBottomWidth: 0 },
  attendeeName: { flex: 2, fontSize: 10, fontWeight: 600 },
  attendeeRole: { flex: 2, fontSize: 9, color: TEXT_MED },
  attendeeSide: { flex: 1, fontSize: 8, textAlign: 'right', fontWeight: 600 },
  attendeeSideClient: { color: BRAND_PRIMARY },
  attendeeSideInternal: { color: BRAND_ACCENT },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    alignItems: 'flex-start',
  },
  actionNum: {
    width: 18,
    fontSize: 9,
    fontWeight: 700,
    color: BRAND_PRIMARY,
  },
  actionDesc: { flex: 3, fontSize: 10, lineHeight: 1.4 },
  actionOwner: { flex: 1.2, fontSize: 9, color: TEXT_MED },
  actionDue: { flex: 1, fontSize: 9, color: TEXT_MED, textAlign: 'right' },
  actionStatus: {
    width: 60,
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionDone: { color: '#16A34A' },
  actionOpen: { color: BRAND_ACCENT },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: BRAND_PRIMARY,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: TEXT_MED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Next steps box
  nextStepsBox: {
    padding: 10,
    backgroundColor: '#FFF7ED',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_ACCENT,
  },
  nextStepsTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND_ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  nextStepsText: {
    fontSize: 10,
    color: TEXT_DARK,
    lineHeight: 1.5,
  },

  // Signatures
  signatureRow: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 20,
  },
  signatureBlock: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: TEXT_DARK,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: TEXT_MED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signatureName: {
    fontSize: 10,
    fontWeight: 600,
    color: TEXT_DARK,
    marginTop: 2,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: TEXT_LIGHT },
  footerBrand: { fontSize: 7, fontWeight: 600, color: BRAND_ACCENT },
  pageNum: { fontSize: 7, color: TEXT_LIGHT },

  emptyNote: {
    fontSize: 9,
    fontStyle: 'italic',
    color: TEXT_LIGHT,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTERACTION_LABEL: Record<InteractionType, string> = {
  meeting: 'Meeting',
  'phone-call': 'Phone Call',
  email: 'Email',
  'site-visit': 'Site Visit',
  presentation: 'Presentation',
  workshop: 'Workshop',
  'approval-session': 'Approval Session',
  delivery: 'Delivery',
  other: 'Engagement',
};

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(ts: any): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtShortDate(ts: any): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

const MinutesPDFDocument: React.FC<{ data: MinutesPdfData }> = ({ data }) => {
  const { interaction, context, company } = data;
  const clients = (interaction.attendees || []).filter((a) => a.isClient);
  const internal = (interaction.attendees || []).filter((a) => !a.isClient);
  const actions = interaction.actionItems || [];

  const preparedBy = context.preparedBy || '—';
  const docRef =
    context.documentRef ||
    `MIN-${(tsToDate(interaction.date) || new Date()).getFullYear()}-${interaction.id.slice(0, 6).toUpperCase()}`;

  return (
    <Document
      title={`Minutes — ${interaction.title}`}
      author={company.name}
      subject={`${INTERACTION_LABEL[interaction.type]} Minutes`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            {company.logoUrl ? (
              <Image src={company.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.companyName}>{company.name}</Text>
            )}
            {company.address && company.address.length > 0 ? (
              <Text style={styles.companyAddress}>
                {company.address.join('\n')}
                {company.website ? `\n${company.website}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>MINUTES</Text>
            <Text style={styles.docRef}>{docRef}</Text>
          </View>
        </View>

        {/* Title strip */}
        <View style={styles.titleStrip}>
          <Text style={styles.titleStripLabel}>
            {INTERACTION_LABEL[interaction.type]}
            {context.projectCode ? `  ·  ${context.projectCode}` : ''}
          </Text>
          <Text style={styles.titleStripText}>{interaction.title}</Text>
        </View>

        {/* Meta grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{fmtDate(interaction.date)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>{fmtDuration(interaction.duration)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Type</Text>
            <Text style={styles.metaValue}>{INTERACTION_LABEL[interaction.type]}</Text>
          </View>
          {context.clientName ? (
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Client</Text>
              <Text style={styles.metaValue}>{context.clientName}</Text>
            </View>
          ) : null}
          {context.projectName ? (
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Project</Text>
              <Text style={styles.metaValue}>{context.projectName}</Text>
            </View>
          ) : null}
          {interaction.location ? (
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Location</Text>
              <Text style={styles.metaValue}>{interaction.location}</Text>
            </View>
          ) : null}
        </View>

        {/* Attendees */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendees</Text>
          {(interaction.attendees || []).length === 0 ? (
            <Text style={styles.emptyNote}>No attendees recorded.</Text>
          ) : (
            <View>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderText, flex: 2, paddingLeft: 4 }}>
                  Name
                </Text>
                <Text style={{ ...styles.tableHeaderText, flex: 2 }}>Role</Text>
                <Text style={{ ...styles.tableHeaderText, flex: 1, textAlign: 'right' }}>
                  Side
                </Text>
              </View>
              {[...clients, ...internal].map((a, i, arr) => (
                <View
                  key={i}
                  style={[
                    styles.attendeeRow,
                    i === arr.length - 1 ? styles.attendeeRowLast : {},
                  ]}
                >
                  <Text style={{ ...styles.attendeeName, paddingLeft: 4 }}>
                    {a.name || '—'}
                  </Text>
                  <Text style={styles.attendeeRole}>{a.role || '—'}</Text>
                  <Text
                    style={[
                      styles.attendeeSide,
                      a.isClient ? styles.attendeeSideClient : styles.attendeeSideInternal,
                    ]}
                  >
                    {a.isClient ? 'Client' : 'Internal'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.sectionBody}>
            {interaction.summary || 'No summary provided.'}
          </Text>
        </View>

        {/* Discussion / Notes */}
        {interaction.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discussion Notes</Text>
            <Text style={styles.sectionBody}>{interaction.notes}</Text>
          </View>
        ) : null}

        {/* Action items */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Action Items</Text>
          {actions.length === 0 ? (
            <Text style={styles.emptyNote}>No action items captured.</Text>
          ) : (
            <View>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderText, width: 18 }}>#</Text>
                <Text style={{ ...styles.tableHeaderText, flex: 3 }}>Action</Text>
                <Text style={{ ...styles.tableHeaderText, flex: 1.2 }}>Owner</Text>
                <Text
                  style={{
                    ...styles.tableHeaderText,
                    flex: 1,
                    textAlign: 'right',
                  }}
                >
                  Due
                </Text>
                <Text
                  style={{
                    ...styles.tableHeaderText,
                    width: 60,
                    textAlign: 'right',
                  }}
                >
                  Status
                </Text>
              </View>
              {actions.map((a, i) => (
                <View key={a.id || i} style={styles.actionRow}>
                  <Text style={styles.actionNum}>{i + 1}</Text>
                  <Text style={styles.actionDesc}>{a.description}</Text>
                  <Text style={styles.actionOwner}>{a.assignedTo || '—'}</Text>
                  <Text style={styles.actionDue}>{fmtShortDate(a.dueDate)}</Text>
                  <Text
                    style={[
                      styles.actionStatus,
                      a.completed ? styles.actionDone : styles.actionOpen,
                    ]}
                  >
                    {a.completed ? 'Done' : 'Open'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Next steps */}
        {interaction.nextSteps || interaction.followUpDate ? (
          <View style={styles.section} wrap={false}>
            <View style={styles.nextStepsBox}>
              <Text style={styles.nextStepsTitle}>Next Steps</Text>
              {interaction.nextSteps ? (
                <Text style={styles.nextStepsText}>{interaction.nextSteps}</Text>
              ) : null}
              {interaction.followUpDate ? (
                <Text
                  style={{
                    ...styles.nextStepsText,
                    marginTop: 4,
                    fontWeight: 600,
                  }}
                >
                  Follow-up: {fmtDate(interaction.followUpDate)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Signatures */}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Prepared by</Text>
            <Text style={styles.signatureName}>{preparedBy}</Text>
            <Text style={styles.signatureLabel}>{company.name}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Acknowledged by</Text>
            <Text style={styles.signatureName}>
              {clients[0]?.name || context.clientName || '—'}
            </Text>
            <Text style={styles.signatureLabel}>Client representative</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {company.name}
            {company.website ? ` · ${company.website}` : ''}
          </Text>
          <Text
            style={styles.pageNum}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text style={styles.footerBrand}>
            Generated {new Date().toLocaleDateString('en-GB')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

export const minutesPdfService = {
  async generateBlob(data: MinutesPdfData): Promise<Blob> {
    return await pdf(<MinutesPDFDocument data={data} />).toBlob();
  },

  buildFilename(interaction: ClientInteraction, context: MinutesContext): string {
    const d = tsToDate(interaction.date) || new Date();
    const ymd = d.toISOString().split('T')[0];
    const title = (interaction.title || 'interaction')
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .slice(0, 40);
    const code = context.projectCode ? `${context.projectCode}_` : '';
    return `Minutes_${code}${ymd}_${title}.pdf`;
  },
};

export default minutesPdfService;
