import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  pdf,
  Font,
} from '@react-pdf/renderer';
import { QUOTE_PDF_THEME_COLORS } from '@/modules/design-manager/services/quote-pdf-generator';
import { CO_STATUS_LABELS, CO_TYPE_LABELS } from '../constants';
import type { ChangeOrder, ChangeOrderApprovalEvent, SalesOrder } from '../types';

Font.register({
  family: 'Outfit',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

const q = QUOTE_PDF_THEME_COLORS;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Outfit',
    fontSize: 9,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    padding: 32,
    paddingBottom: 72,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: q.primary,
    paddingBottom: 10,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerRight: { alignItems: 'flex-end' },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: q.primary,
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 10,
    color: '#4B5563',
    marginTop: 3,
  },
  logo: {
    width: 170,
    height: 58,
    objectFit: 'contain',
  },
  fallbackCompany: {
    fontSize: 14,
    fontWeight: 700,
    color: q.primary,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaCard: {
    flexGrow: 1,
    flexBasis: '31%',
    backgroundColor: '#FAFAFA',
    borderLeftWidth: 2,
    borderLeftColor: q.primary,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaLabel: {
    fontSize: 7,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: 600,
  },
  metaValue: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: 600,
    color: '#111827',
  },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 9,
    color: q.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: 700,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 3,
    marginBottom: 5,
  },
  bodyText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#1F2937',
    marginBottom: 3,
  },
  summaryTable: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryRowAlt: { backgroundColor: '#FAFAFA' },
  summaryLabel: { color: '#4B5563', fontSize: 8.5 },
  summaryValue: { color: '#111827', fontSize: 8.5, fontWeight: 600 },
  summaryImpactPositive: { color: '#047857', fontWeight: 700 },
  summaryImpactNegative: { color: '#B91C1C', fontWeight: 700 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderText: {
    fontSize: 7.5,
    fontWeight: 700,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 5,
    paddingHorizontal: 6,
    minHeight: 20,
    alignItems: 'center',
  },
  rowAlt: { backgroundColor: '#FAFAFA' },
  cell: { fontSize: 8, color: '#1F2937' },
  cellMuted: { color: '#6B7280' },
  tableNumCol: { width: 18 },
  tableDescCol: { flex: 1.8, paddingRight: 6 },
  tableQtyCol: { width: 58, textAlign: 'right' },
  tableMoneyCol: { width: 82, textAlign: 'right' },
  approvalActionCol: { flex: 1.5, paddingRight: 6 },
  approvalChannelCol: { width: 70 },
  approvalDateCol: { width: 76, textAlign: 'right' },
  signoffRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 14,
  },
  signoffCard: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#9CA3AF',
    paddingTop: 4,
  },
  signoffLabel: {
    fontSize: 7,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signoffName: {
    fontSize: 9,
    color: '#111827',
    fontWeight: 600,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
  footerBrand: { fontSize: 7, color: q.primary, fontWeight: 600 },
});

export interface ChangeOrderPdfCompanyInfo {
  name: string;
  logoUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  website?: string;
}

export interface ChangeOrderPdfData {
  changeOrder: ChangeOrder;
  salesOrder: SalesOrder;
  approvalEvents?: ChangeOrderApprovalEvent[];
  company: ChangeOrderPdfCompanyInfo;
  generatedBy?: string;
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(ts: any): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency || 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function channelLabel(channel: string): string {
  switch (channel) {
    case 'internal':
      return 'Internal';
    case 'portal':
      return 'Client Portal';
    case 'whatsapp':
      return 'WhatsApp';
    case 'email':
      return 'Email';
    case 'in_person':
      return 'In Person';
    default:
      return channel || '—';
  }
}

const ChangeOrderPdfDocument: React.FC<{ data: ChangeOrderPdfData }> = ({ data }) => {
  const { changeOrder: co, salesOrder: so, approvalEvents = [], company } = data;
  const added = co.itemsAdded || [];
  const removed = co.itemsRemoved || [];
  const modified = co.itemsModified || [];
  const events = approvalEvents.length > 0
    ? approvalEvents
    : [
      {
        id: 'created',
        action: 'created',
        fromStatus: null,
        toStatus: co.status,
        channel: 'internal',
        actorId: co.createdBy,
        actorName: co.createdBy,
        createdAt: co.createdAt,
      } as ChangeOrderApprovalEvent,
    ];

  const totalAdded = added.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const totalRemoved = removed.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalModified = modified.reduce((sum, item) => sum + (item.priceImpact || 0), 0);
  const negotiatedAdjustment = co.negotiatedPriceAdjustment || 0;

  return (
    <Document title={`Change Order ${co.changeOrderNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>CHANGE ORDER</Text>
            <Text style={styles.subtitle}>Ref: {co.changeOrderNumber}</Text>
          </View>
          <View style={styles.headerRight}>
            {company.logoUrl ? (
              <Image src={company.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.fallbackCompany}>{company.name}</Text>
            )}
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Sales Order</Text>
            <Text style={styles.metaValue}>{so.orderNumber}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue}>{so.customerName}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{CO_STATUS_LABELS[co.status] ?? co.status}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Type</Text>
            <Text style={styles.metaValue}>{CO_TYPE_LABELS[co.type] ?? co.type}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Requested By</Text>
            <Text style={styles.metaValue}>{co.requestedBy}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>{fmtDate(co.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Summary</Text>
          <Text style={styles.bodyText}><Text style={{ fontWeight: 600 }}>{co.title}</Text></Text>
          <Text style={styles.bodyText}>{co.description}</Text>
          <Text style={styles.bodyText}><Text style={{ fontWeight: 600 }}>Reason:</Text> {co.reason}</Text>
          {co.negotiatedAdjustmentNote ? (
            <Text style={styles.bodyText}>
              <Text style={{ fontWeight: 600 }}>Negotiation note:</Text> {co.negotiatedAdjustmentNote}
            </Text>
          ) : null}
          <Text style={styles.bodyText}>
            <Text style={{ fontWeight: 600 }}>Scope version:</Text> {co.scopeVersionBefore} → {co.scopeVersionAfter}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Impact</Text>
          <View style={styles.summaryTable}>
            {[
              ['Previous order total', fmtCurrency(co.previousOrderTotal, so.currency)],
              ['Added items total', fmtCurrency(totalAdded, so.currency)],
              ['Removed items total', `-${fmtCurrency(totalRemoved, so.currency)}`],
              ['Modified items net', `${totalModified >= 0 ? '+' : ''}${fmtCurrency(totalModified, so.currency)}`],
              ['Negotiated adjustment', `${negotiatedAdjustment >= 0 ? '+' : ''}${fmtCurrency(negotiatedAdjustment, so.currency)}`],
              ['Net change (CO impact)', `${co.priceImpact >= 0 ? '+' : ''}${fmtCurrency(co.priceImpact, so.currency)}`],
              ['New order total', fmtCurrency(co.newOrderTotal, so.currency)],
            ].map(([label, value], idx) => (
              <View key={label} style={[styles.summaryRow, idx % 2 ? styles.summaryRowAlt : {}]}>
                <Text style={styles.summaryLabel}>{label}</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    label.includes('Net change')
                      ? (co.priceImpact >= 0 ? styles.summaryImpactPositive : styles.summaryImpactNegative)
                      : {},
                  ]}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {added.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items Added</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableNumCol]}>#</Text>
              <Text style={[styles.tableHeaderText, styles.tableDescCol]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.tableQtyCol]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.tableMoneyCol]}>Unit</Text>
              <Text style={[styles.tableHeaderText, styles.tableMoneyCol]}>Total</Text>
            </View>
            {added.map((item, idx) => (
              <View key={item.id || idx} style={[styles.row, idx % 2 ? styles.rowAlt : {}]}>
                <Text style={[styles.cell, styles.tableNumCol]}>{idx + 1}</Text>
                <View style={styles.tableDescCol}>
                  <Text style={styles.cell}>{item.description}</Text>
                  {item.specification ? (
                    <Text style={[styles.cell, styles.cellMuted]}>{item.specification}</Text>
                  ) : null}
                </View>
                <Text style={[styles.cell, styles.tableQtyCol]}>{item.quantity} {item.unit}</Text>
                <Text style={[styles.cell, styles.tableMoneyCol]}>{fmtCurrency(item.unitPrice, so.currency)}</Text>
                <Text style={[styles.cell, styles.tableMoneyCol]}>{fmtCurrency(item.totalPrice, so.currency)}</Text>
              </View>
            ))}
          </View>
        )}

        {removed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items Removed</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableNumCol]}>#</Text>
              <Text style={[styles.tableHeaderText, styles.tableDescCol]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.tableMoneyCol]}>Amount</Text>
            </View>
            {removed.map((item, idx) => (
              <View key={`${item.itemId}-${idx}`} style={[styles.row, idx % 2 ? styles.rowAlt : {}]}>
                <Text style={[styles.cell, styles.tableNumCol]}>{idx + 1}</Text>
                <Text style={[styles.cell, styles.tableDescCol]}>{item.description}</Text>
                <Text style={[styles.cell, styles.tableMoneyCol]}>-{fmtCurrency(item.amount, so.currency)}</Text>
              </View>
            ))}
          </View>
        )}

        {modified.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items Modified</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableNumCol]}>#</Text>
              <Text style={[styles.tableHeaderText, styles.tableDescCol]}>Change</Text>
              <Text style={[styles.tableHeaderText, styles.tableMoneyCol]}>Price Impact</Text>
            </View>
            {modified.map((item, idx) => (
              <View key={`${item.itemId}-${item.field}-${idx}`} style={[styles.row, idx % 2 ? styles.rowAlt : {}]}>
                <Text style={[styles.cell, styles.tableNumCol]}>{idx + 1}</Text>
                <View style={styles.tableDescCol}>
                  <Text style={styles.cell}>{item.field}: {item.oldValue} → {item.newValue}</Text>
                </View>
                <Text style={[styles.cell, styles.tableMoneyCol]}>
                  {item.priceImpact >= 0 ? '+' : ''}{fmtCurrency(item.priceImpact, so.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approval Timeline</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.tableNumCol]}>#</Text>
            <Text style={[styles.tableHeaderText, styles.approvalActionCol]}>Action</Text>
            <Text style={[styles.tableHeaderText, styles.approvalChannelCol]}>Channel</Text>
            <Text style={[styles.tableHeaderText, styles.approvalDateCol]}>Date</Text>
          </View>
          {events.map((event, idx) => (
            <View key={event.id || idx} style={[styles.row, idx % 2 ? styles.rowAlt : {}]}>
              <Text style={[styles.cell, styles.tableNumCol]}>{idx + 1}</Text>
              <View style={styles.approvalActionCol}>
                <Text style={styles.cell}>{event.action.replace(/_/g, ' ')}</Text>
                {event.actorName || event.actorId ? (
                  <Text style={[styles.cell, styles.cellMuted]}>by {event.actorName || event.actorId}</Text>
                ) : null}
              </View>
              <Text style={[styles.cell, styles.approvalChannelCol]}>{channelLabel(event.channel)}</Text>
              <Text style={[styles.cell, styles.approvalDateCol]}>{fmtDate(event.createdAt)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signoffRow} wrap={false}>
          <View style={styles.signoffCard}>
            <Text style={styles.signoffLabel}>Prepared by</Text>
            <Text style={styles.signoffName}>{data.generatedBy || co.createdBy}</Text>
            <Text style={styles.signoffLabel}>Internal</Text>
          </View>
          <View style={styles.signoffCard}>
            <Text style={styles.signoffLabel}>Client acknowledgement</Text>
            <Text style={styles.signoffName}>{so.customerName}</Text>
            <Text style={styles.signoffLabel}>Client</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {company.addressLine1 || 'Kayondo Road, Kyambogo Upper Estate'}
            {company.addressLine2 ? ` · ${company.addressLine2}` : ''}
          </Text>
          <Text style={styles.footerBrand}>{company.website || 'dawinfinishes.com'}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export const changeOrderPdfService = {
  async generateBlob(data: ChangeOrderPdfData): Promise<Blob> {
    return await pdf(<ChangeOrderPdfDocument data={data} />).toBlob();
  },

  buildFilename(changeOrder: ChangeOrder): string {
    const safe = changeOrder.changeOrderNumber.replace(/[^a-zA-Z0-9-_]+/g, '_');
    return `ChangeOrder_${safe}.pdf`;
  },
};

export default changeOrderPdfService;
