/**
 * ============================================================================
 * DAWIN OS - QUOTE PDF GENERATOR MODULE
 * ============================================================================
 * 
 * Generates PDF quotes matching the Dawin Finishes structure (Reference: SO-33)
 * 
 * Installation:
 *   npm install @react-pdf/renderer
 * 
 * Usage:
 *   import { QuotePDFDocument, pdfGeneratorService, useQuotePDF } from './quote-pdf-generator';
 * 
 * ============================================================================
 */

import React, { useState, useCallback } from 'react';
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

// ============================================================================
// FONT REGISTRATION - Outfit Font Family
// ============================================================================

// Register Outfit font from Google Fonts CDN (using correct static font URLs)
Font.register({
  family: 'Outfit',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-300-normal.ttf',
      fontWeight: 300, // Light
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf',
      fontWeight: 400, // Regular
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-500-normal.ttf',
      fontWeight: 500, // Medium
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-600-normal.ttf',
      fontWeight: 600, // SemiBold
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf',
      fontWeight: 700, // Bold
    },
  ],
});

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Address {
  street: string;
  building?: string;
  floor?: string;
  city: string;
  region: string;
  postalCode?: string;
  country: string;
}

export interface Customer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address: Address;
  companyName?: string;
  tinNumber?: string;
}

export interface LineItem {
  id: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  totalPrice: number;
  taxRateId: 'no_vat' | 'standard_vat' | 'exempt';
  // Link to design item
  linkedDesignItemId?: string;
  category?: string;
  notes?: string;
}

export interface Financials {
  currency: 'UGX' | 'USD';
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  // Margin and overhead info
  overheadPercent?: number;
  overheadAmount?: number;
  marginPercent?: number;
  marginAmount?: number;
}

export interface BankDetails {
  name: string;
  accountName: string;
  accountNumber: string;
}

export interface MobileMoneyDetails {
  merchantCode: string;
  merchantName: string;
}

export interface PesapalDetails {
  description: string;
}

export interface PaymentInfo {
  bank?: BankDetails;
  mtnMomo?: MobileMoneyDetails;
  airtelMoney?: MobileMoneyDetails;
  pesapal?: PesapalDetails;
}

export interface CompanyInfo {
  name: string;
  logoUrl?: string;
  address: string;
  city: string;
  region: string;
  country: string;
  website?: string;
  email?: string;
  phone?: string;
}

export interface QuoteData {
  quoteNumber: string;
  customerReference: string;
  createdAt: Date | string;
  validUntil?: Date | string;
  customer: Customer;
  billingAddress?: Address;
  shippingAddress?: Address;
  lineItems: LineItem[];
  financials: Financials;
  companyInfo: CompanyInfo;
  paymentInfo: PaymentInfo;
  notes?: string;
  termsAndConditions?: string;
  // Project info
  projectName?: string;
  projectCode?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'Dawin Finishes',
  logoUrl: undefined, // Set your logo URL here
  address: 'Kayondo Road, Kyambogo Upper Estate Ground Floor, Jordan House',
  city: 'Kampala',
  region: 'Central Region',
  country: 'Uganda',
  website: 'dawinfinishes.com',
};

export const DEFAULT_PAYMENT_INFO: PaymentInfo = {
  bank: {
    name: 'ABSA BANK',
    accountName: 'DAWIN FINISHES SMC LIMITED',
    accountNumber: '6006867063',
  },
  mtnMomo: {
    merchantCode: '595946',
    merchantName: 'DAWIN FINISHES SMC LTD',
  },
  pesapal: {
    description:
      'Payments can be made in-person via POS or online via a payment link generated on request. Terminal supports VISA, MasterCard, Union, Mobile money (MTN and Airtel)',
  },
};

export const TAX_RATE_LABELS: Record<string, string> = {
  no_vat: '0% - No VAT',
  standard_vat: '18% - VAT',
  exempt: 'Exempt',
};

export const QUANTITY_UNITS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'SM', label: 'Square Meters (SM)' },
  { value: 'LM', label: 'Linear Meters (LM)' },
  { value: 'Item', label: 'Item' },
  { value: 'Set', label: 'Set' },
  { value: 'Box', label: 'Box' },
  { value: 'Roll', label: 'Roll' },
  { value: 'Bag', label: 'Bag' },
  { value: 'Kg', label: 'Kilograms (Kg)' },
  { value: 'L', label: 'Liters (L)' },
  { value: 'units', label: 'Units' },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format number with thousand separators (Uganda format)
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-UG').format(Math.round(num));
};

/**
 * Format currency with code
 */
export const formatCurrency = (
  amount: number,
  currency: 'UGX' | 'USD' = 'UGX'
): string => {
  return `${formatNumber(amount)} ${currency}`;
};

/**
 * Format date to YYYY-MM-DD
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

/**
 * Get tax label from tax rate ID
 */
export const getTaxLabel = (taxRateId: string): string => {
  return TAX_RATE_LABELS[taxRateId] || '0% - No VAT';
};

/**
 * Format address lines
 */
export const formatAddressLines = (address: Address): string[] => {
  return [
    [address.street, address.building, address.floor].filter(Boolean).join(', '),
    address.city,
    `${address.region} ${address.postalCode || '000256'}, ${address.country}`,
  ];
};

// ============================================================================
// PDF STYLES — shared colours for quote & receipt PDFs (keep in sync)
// ============================================================================

export const QUOTE_PDF_THEME_COLORS = {
  primary: '#6B2D5B', // Dawin purple/maroon
  text: '#333333',
  textLight: '#666666',
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  background: '#F5F5F5',
  backgroundLight: '#FAFAFA',
  white: '#FFFFFF',
} as const;

const colors = QUOTE_PDF_THEME_COLORS;

const styles = StyleSheet.create({
  // Page Layout
  page: {
    padding: 40,
    paddingBottom: 80,
    fontFamily: 'Outfit',
    fontWeight: 400,
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },

  // ==================== HEADER ====================
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  quoteTitle: {
    fontSize: 22,
    fontFamily: 'Outfit',
    fontWeight: 700,
    color: colors.primary,
  },
  projectName: {
    fontSize: 12,
    fontFamily: 'Outfit',
    fontWeight: 500,
    color: colors.text,
    marginTop: 4,
  },
  createdDate: {
    fontSize: 10,
    fontFamily: 'Outfit',
    fontWeight: 400,
    color: colors.textLight,
    marginTop: 4,
  },
  validUntil: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 300,
    color: colors.textLight,
    marginTop: 2,
  },
  logo: {
    width: 140,
    height: 60,
    objectFit: 'contain',
  },
  companyNameFallback: {
    fontSize: 16,
    fontFamily: 'Outfit',
    fontWeight: 700,
    color: colors.primary,
  },

  // ==================== CUSTOMER SECTION ====================
  customerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  customerColumn: {
    flex: 1,
    paddingRight: 15,
  },
  addressColumn: {
    flex: 1,
    paddingRight: 15,
  },
  referenceColumn: {
    width: 130,
    alignItems: 'flex-end',
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 400,
    color: colors.textLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 3,
    marginBottom: 8,
  },
  customerName: {
    fontSize: 13,
    fontFamily: 'Outfit',
    fontWeight: 600,
    marginBottom: 10,
  },
  addressText: {
    fontSize: 10,
    fontFamily: 'Outfit',
    fontWeight: 400,
    lineHeight: 1.4,
    marginBottom: 2,
  },
  referenceLabel: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 400,
    color: colors.textLight,
    marginBottom: 3,
  },
  referenceValue: {
    fontSize: 13,
    fontFamily: 'Outfit',
    fontWeight: 600,
  },

  // ==================== ITEMS TABLE ====================
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 5,
    paddingHorizontal: 8,
    minHeight: 24,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: colors.backgroundLight,
  },
  headerCell: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 600,
    color: colors.text,
  },
  cell: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 400,
    color: colors.text,
  },
  cellSmall: {
    fontSize: 8,
    fontFamily: 'Outfit',
    fontWeight: 300,
    color: colors.textLight,
  },
  // Column widths
  colNum: { width: 25 },
  colItem: { flex: 1, paddingRight: 10 },
  colQty: { width: 65, textAlign: 'center' },
  colPrice: { width: 75, textAlign: 'right' },
  colDiscount: { width: 55, textAlign: 'center' },
  colTotal: { width: 75, textAlign: 'right' },
  colTax: { width: 55, textAlign: 'center' },
  // Tax summary row
  taxSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  taxSummaryText: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 400,
    textAlign: 'right',
    color: colors.textLight,
  },

  // ==================== TOTALS SECTION ====================
  totalsContainer: {
    alignItems: 'flex-end',
    marginBottom: 25,
  },
  totalsBox: {
    width: 220,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  totalsFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: colors.text,
    marginTop: 4,
  },
  totalsLabel: {
    fontSize: 10,
    fontFamily: 'Outfit',
    fontWeight: 400,
    color: colors.textLight,
  },
  totalsValue: {
    fontSize: 10,
    fontFamily: 'Outfit',
    fontWeight: 500,
    textAlign: 'right',
  },
  totalsFinalLabel: {
    fontSize: 11,
    fontFamily: 'Outfit',
    fontWeight: 700,
  },
  totalsFinalValue: {
    fontSize: 11,
    fontFamily: 'Outfit',
    fontWeight: 700,
  },
  currencyLabel: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 300,
    color: colors.textLight,
    marginLeft: 5,
  },
  valueWithCurrency: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  // ==================== PAYMENT SECTION ====================
  paymentSection: {
    backgroundColor: colors.backgroundLight,
    padding: 15,
    marginBottom: 20,
  },
  paymentRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  paymentColumn: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 600,
    color: colors.text,
  },
  paymentValue: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 400,
    color: colors.text,
    marginTop: 1,
  },
  pesapalNote: {
    fontSize: 8,
    fontFamily: 'Outfit',
    fontWeight: 300,
    color: colors.textLight,
    marginTop: 8,
    lineHeight: 1.4,
  },

  // ==================== NOTES SECTION ====================
  notesSection: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 10,
    fontFamily: 'Outfit',
    fontWeight: 600,
    marginBottom: 5,
  },
  notesText: {
    fontSize: 9,
    fontFamily: 'Outfit',
    fontWeight: 400,
    color: colors.text,
    lineHeight: 1.4,
  },

  // ==================== FOOTER ====================
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 8,
    fontFamily: 'Outfit',
    fontWeight: 400,
    color: colors.textLight,
    marginBottom: 2,
  },
  footerWebsite: {
    fontSize: 8,
    fontFamily: 'Outfit',
    fontWeight: 500,
    color: colors.primary,
  },
  footerPowered: {
    fontSize: 7,
    fontFamily: 'Outfit',
    fontWeight: 300,
    color: colors.textLight,
  },
});

// ============================================================================
// PDF COMPONENTS
// ============================================================================

/**
 * PDF Header Component
 * Displays quote number, creation date, and company logo
 */
interface PDFHeaderProps {
  quoteNumber: string;
  projectName?: string;
  logoUrl?: string;
  companyName?: string;
}

const PDFHeader: React.FC<PDFHeaderProps> = ({
  quoteNumber,
  projectName,
  logoUrl,
  companyName = 'Dawin Finishes',
}) => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <Text style={styles.quoteTitle}>Quote</Text>
      {projectName && <Text style={styles.projectName}>{projectName}</Text>}
      <Text style={styles.createdDate}>Ref: {quoteNumber}</Text>
    </View>
    <View style={styles.headerRight}>
      {logoUrl ? (
        <Image src={logoUrl} style={styles.logo} />
      ) : (
        <Text style={styles.companyNameFallback}>{companyName}</Text>
      )}
    </View>
  </View>
);

/**
 * PDF Customer Section Component
 * Displays customer info, addresses, and reference number
 */
interface PDFCustomerSectionProps {
  customerName: string;
  customerReference: string;
  billingAddress: Address;
  shippingAddress?: Address;
  createdDate: string;
  validUntil?: string;
}

const PDFCustomerSection: React.FC<PDFCustomerSectionProps> = ({
  customerName,
  customerReference,
  billingAddress,
  shippingAddress,
  createdDate,
  validUntil,
}) => {
  const billing = formatAddressLines(billingAddress);
  const shipping = formatAddressLines(shippingAddress || billingAddress);

  return (
    <View style={{ marginBottom: 25 }}>
      {/* Customer Name + Reference Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View>
          <Text style={styles.sectionLabel}>Customer</Text>
          <Text style={styles.customerName}>{customerName}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.referenceLabel}>Customer reference:</Text>
          <Text style={styles.referenceValue}>{customerReference}</Text>
          <Text style={[styles.addressText, { marginTop: 4 }]}>Created: {createdDate}</Text>
          {validUntil && <Text style={styles.addressText}>Valid until: {validUntil}</Text>}
        </View>
      </View>

      {/* Addresses Row */}
      <View style={{ flexDirection: 'row' }}>
        {/* Billing Address */}
        <View style={styles.customerColumn}>
          <Text style={styles.sectionLabel}>Bill To:</Text>
          {billing.map((line, i) => (
            <Text key={`billing-${i}`} style={styles.addressText}>
              {line}
            </Text>
          ))}
        </View>

        {/* Shipping Address */}
        <View style={styles.addressColumn}>
          <Text style={styles.sectionLabel}>Ship To:</Text>
          {shipping.map((line, i) => (
            <Text key={`shipping-${i}`} style={styles.addressText}>
              {line}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};

/**
 * PDF Items Table Component
 * Displays line items in a formatted table
 */
interface PDFItemsTableProps {
  items: Array<LineItem & { taxLabel?: string }>;
  showDiscount?: boolean;
  currency?: 'UGX' | 'USD';
}

const PDFItemsTable: React.FC<PDFItemsTableProps> = ({
  items,
  showDiscount = false,
  currency = 'UGX',
}) => {
  // Calculate total tax amount for summary
  const totalTaxAmount = items.reduce((sum, item) => {
    if (item.taxRateId === 'standard_vat') {
      return sum + item.totalPrice * 0.18;
    }
    return sum;
  }, 0);

  return (
    <View style={styles.table}>
      {/* Header Row */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.colNum]}></Text>
        <Text style={[styles.headerCell, styles.colItem]}>Item</Text>
        <Text style={[styles.headerCell, styles.colQty]}>Quantity</Text>
        <Text style={[styles.headerCell, styles.colPrice]}>Price per unit</Text>
        {showDiscount && (
          <Text style={[styles.headerCell, styles.colDiscount]}>Discount</Text>
        )}
        <Text style={[styles.headerCell, styles.colTotal]}>Total price</Text>
        <Text style={[styles.headerCell, styles.colTax]}>Tax</Text>
      </View>

      {/* Data Rows */}
      {items.map((item, index) => (
        <View
          key={item.id}
          style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
        >
          <Text style={[styles.cell, styles.colNum]}>{index + 1}.</Text>
          <View style={styles.colItem}>
            <Text style={styles.cell}>{item.itemName}</Text>
          </View>
          <Text style={[styles.cell, styles.colQty]}>
            {item.quantity} {item.unit}
          </Text>
          <Text style={[styles.cell, styles.colPrice]}>
            {formatNumber(item.unitPrice)}
          </Text>
          {showDiscount && (
            <Text style={[styles.cell, styles.colDiscount]}>
              {item.discountPercent.toFixed(2)}%
            </Text>
          )}
          <Text style={[styles.cell, styles.colTotal]}>
            {formatNumber(item.totalPrice)}
          </Text>
          <Text style={[styles.cell, styles.colTax]}>
            {item.taxLabel || getTaxLabel(item.taxRateId)}
          </Text>
        </View>
      ))}

      {/* Tax Summary Row */}
      {totalTaxAmount > 0 && (
        <View style={styles.taxSummaryRow}>
          <Text style={styles.taxSummaryText}>
            Tax total: {formatNumber(totalTaxAmount)} {currency}
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * PDF Totals Section Component
 * Displays financial summary (subtotal, tax, total)
 */
interface PDFTotalsSectionProps {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  currency?: 'UGX' | 'USD';
}

const PDFTotalsSection: React.FC<PDFTotalsSectionProps> = ({
  subtotal,
  taxTotal,
  grandTotal,
  currency = 'UGX',
}) => (
  <View style={styles.totalsContainer}>
    <View style={styles.totalsBox}>
      {/* Subtotal */}
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotal:</Text>
        <View style={styles.valueWithCurrency}>
          <Text style={styles.totalsValue}>{formatNumber(subtotal)}</Text>
          <Text style={styles.currencyLabel}>{currency}</Text>
        </View>
      </View>

      {/* Tax */}
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Plus tax:</Text>
        <View style={styles.valueWithCurrency}>
          <Text style={styles.totalsValue}>{formatNumber(taxTotal)}</Text>
          <Text style={styles.currencyLabel}>{currency}</Text>
        </View>
      </View>

      {/* Grand Total */}
      <View style={styles.totalsFinalRow}>
        <Text style={styles.totalsFinalLabel}>Total:</Text>
        <View style={styles.valueWithCurrency}>
          <Text style={styles.totalsFinalValue}>{formatNumber(grandTotal)}</Text>
          <Text style={styles.currencyLabel}>{currency}</Text>
        </View>
      </View>
    </View>
  </View>
);

/**
 * PDF Payment Section Component
 * Displays payment methods and details
 */
interface PDFPaymentSectionProps {
  paymentInfo: PaymentInfo;
}

const PDFPaymentSection: React.FC<PDFPaymentSectionProps> = ({ paymentInfo }) => (
  <View style={styles.paymentSection}>
    <View style={styles.paymentRow}>
      {/* Bank Details */}
      {paymentInfo.bank && (
        <View style={styles.paymentColumn}>
          <Text style={styles.paymentLabel}>Bank: {paymentInfo.bank.name}</Text>
          <Text style={styles.paymentValue}>
            Account: {paymentInfo.bank.accountName}
          </Text>
          <Text style={styles.paymentValue}>
            Account No: {paymentInfo.bank.accountNumber}
          </Text>
        </View>
      )}

      {/* MTN Mobile Money */}
      {paymentInfo.mtnMomo && (
        <View style={styles.paymentColumn}>
          <Text style={styles.paymentLabel}>
            MTN Merchant Code: {paymentInfo.mtnMomo.merchantCode}
          </Text>
          <Text style={styles.paymentValue}>
            Merchant Name: {paymentInfo.mtnMomo.merchantName}
          </Text>
        </View>
      )}
    </View>

    {/* Airtel Money (if enabled) */}
    {paymentInfo.airtelMoney && (
      <View style={styles.paymentRow}>
        <View style={styles.paymentColumn}>
          <Text style={styles.paymentLabel}>
            Airtel Merchant Code: {paymentInfo.airtelMoney.merchantCode}
          </Text>
          <Text style={styles.paymentValue}>
            Merchant Name: {paymentInfo.airtelMoney.merchantName}
          </Text>
        </View>
      </View>
    )}

    {/* Pesapal Note */}
    {paymentInfo.pesapal && (
      <Text style={styles.pesapalNote}>
        Pesapal: {paymentInfo.pesapal.description}
      </Text>
    )}
  </View>
);

/**
 * PDF Notes Section Component
 * Displays additional notes if present
 */
interface PDFNotesSectionProps {
  notes: string;
}

const PDFNotesSection: React.FC<PDFNotesSectionProps> = ({ notes }) => (
  <View style={styles.notesSection}>
    <Text style={styles.notesLabel}>Notes:</Text>
    <Text style={styles.notesText}>{notes}</Text>
  </View>
);

/**
 * PDF Footer Component
 * Displays company address, website, page number, and print date
 */
interface PDFFooterProps {
  companyInfo: CompanyInfo;
  pageNumber?: number;
  totalPages?: number;
}

const PDFFooter: React.FC<PDFFooterProps> = ({
  companyInfo,
  pageNumber = 1,
  totalPages = 1,
}) => {
  const printDate = formatDate(new Date());

  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerLeft}>
        <Text style={styles.footerText}>{companyInfo.address}</Text>
        <Text style={styles.footerText}>
          {companyInfo.city}, {companyInfo.region}, {companyInfo.country}
        </Text>
        {companyInfo.website && (
          <Text style={styles.footerWebsite}>{companyInfo.website}</Text>
        )}
      </View>
      <View style={styles.footerRight}>
        <Text style={styles.footerText}>
          {pageNumber}/{totalPages}
        </Text>
        <Text style={styles.footerText}>Printed on {printDate}</Text>
        <Text style={styles.footerPowered}>Powered by DawinOS</Text>
      </View>
    </View>
  );
};

// ============================================================================
// MAIN PDF DOCUMENT COMPONENT
// ============================================================================

interface QuotePDFDocumentProps {
  quote: QuoteData;
  showDiscount?: boolean;
  showNotes?: boolean;
}

export const QuotePDFDocument: React.FC<QuotePDFDocumentProps> = ({
  quote,
  showDiscount = false,
  showNotes = true,
}) => {
  // Prepare line items with tax labels
  const lineItemsWithLabels = quote.lineItems.map((item) => ({
    ...item,
    taxLabel: getTaxLabel(item.taxRateId),
  }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <PDFHeader
          quoteNumber={quote.quoteNumber}
          projectName={quote.projectName}
          logoUrl={quote.companyInfo.logoUrl}
          companyName={quote.companyInfo.name}
        />

        {/* Customer Section */}
        <PDFCustomerSection
          customerName={quote.customer.name}
          customerReference={quote.customerReference}
          billingAddress={quote.billingAddress || quote.customer.address}
          shippingAddress={quote.shippingAddress}
          createdDate={formatDate(quote.createdAt)}
          validUntil={quote.validUntil ? formatDate(quote.validUntil) : undefined}
        />

        {/* Items Table */}
        <PDFItemsTable items={lineItemsWithLabels} showDiscount={showDiscount} currency={quote.financials.currency} />

        {/* Totals */}
        <PDFTotalsSection
          subtotal={quote.financials.subtotal}
          taxTotal={quote.financials.totalTax}
          grandTotal={quote.financials.grandTotal}
          currency={quote.financials.currency}
        />

        {/* Payment Info */}
        <PDFPaymentSection paymentInfo={quote.paymentInfo} />

        {/* Notes (optional) */}
        {showNotes && quote.notes && <PDFNotesSection notes={quote.notes} />}

        {/* Footer */}
        <PDFFooter companyInfo={quote.companyInfo} />
      </Page>
    </Document>
  );
};

// ============================================================================
// PDF GENERATOR SERVICE
// ============================================================================

export const pdfGeneratorService = {
  /**
   * Generate PDF blob from quote data
   */
  async generateBlob(quote: QuoteData): Promise<Blob> {
    const document = <QuotePDFDocument quote={quote} />;
    return await pdf(document).toBlob();
  },

  /**
   * Download PDF directly to user's device
   */
  async download(quote: QuoteData, filename?: string): Promise<void> {
    const blob = await this.generateBlob(quote);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `Quote_${quote.quoteNumber.replace('-', '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Open PDF in new browser tab for preview
   */
  async preview(quote: QuoteData): Promise<void> {
    const blob = await this.generateBlob(quote);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  },

  /**
   * Get PDF as base64 string (useful for email attachments)
   */
  async toBase64(quote: QuoteData): Promise<string> {
    const blob = await this.generateBlob(quote);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * Get PDF as data URL
   */
  async toDataURL(quote: QuoteData): Promise<string> {
    const blob = await this.generateBlob(quote);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },
};

// ============================================================================
// REACT HOOK
// ============================================================================

interface UseQuotePDFReturn {
  generating: boolean;
  error: Error | null;
  downloadPDF: (quote: QuoteData, filename?: string) => Promise<void>;
  previewPDF: (quote: QuoteData) => Promise<void>;
  getPDFBlob: (quote: QuoteData) => Promise<Blob>;
  getPDFBase64: (quote: QuoteData) => Promise<string>;
}

export function useQuotePDF(): UseQuotePDFReturn {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const downloadPDF = useCallback(
    async (quote: QuoteData, filename?: string) => {
      setGenerating(true);
      setError(null);
      try {
        await pdfGeneratorService.download(quote, filename);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('PDF generation failed');
        setError(error);
        throw error;
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  const previewPDF = useCallback(async (quote: QuoteData) => {
    setGenerating(true);
    setError(null);
    try {
      await pdfGeneratorService.preview(quote);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('PDF preview failed');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, []);

  const getPDFBlob = useCallback(async (quote: QuoteData) => {
    setGenerating(true);
    setError(null);
    try {
      return await pdfGeneratorService.generateBlob(quote);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('PDF generation failed');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, []);

  const getPDFBase64 = useCallback(async (quote: QuoteData) => {
    setGenerating(true);
    setError(null);
    try {
      return await pdfGeneratorService.toBase64(quote);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('PDF generation failed');
      setError(error);
      throw error;
    } finally {
      setGenerating(false);
    }
  }, []);

  return {
    generating,
    error,
    downloadPDF,
    previewPDF,
    getPDFBlob,
    getPDFBase64,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default QuotePDFDocument;
