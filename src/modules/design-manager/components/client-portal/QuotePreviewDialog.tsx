/**
 * Quote Preview Dialog
 * Displays a formatted quote preview matching the PDF structure
 */

import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { UnifiedFileManager } from '@/shared/components/file-manager';
import type { ClientQuote } from '../../types/clientPortal';
import { 
  pdfGeneratorService, 
  DEFAULT_COMPANY_INFO, 
  DEFAULT_PAYMENT_INFO,
  type QuoteData,
  type CompanyInfo,
} from '../../services/quote-pdf-generator';
import { useState } from 'react';
import { useOrganizationSettings } from '@/core/settings';

interface QuotePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: ClientQuote;
  projectId?: string;
  customerAddress?: {
    street: string;
    city: string;
    region: string;
    country: string;
  };
  companyInfo?: CompanyInfo;
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG').format(Math.round(amount));
}

/**
 * Convert ClientQuote to QuoteData for PDF
 */
function convertToQuoteData(
  quote: ClientQuote, 
  customerAddress?: QuotePreviewDialogProps['customerAddress'],
  companyInfo?: CompanyInfo
): QuoteData {
  return {
    quoteNumber: quote.quoteNumber,
    customerReference: quote.projectCode,
    createdAt: quote.createdAt.toDate(),
    validUntil: quote.validUntil.toDate(),
    projectName: quote.projectName,
    projectCode: quote.projectCode,
    customer: {
      name: quote.customerName,
      email: quote.customerEmail,
      address: customerAddress || {
        street: '',
        city: 'Kampala',
        region: 'Central Region',
        country: 'Uganda',
      },
    },
    lineItems: quote.lineItems.map((item) => ({
      id: item.id,
      itemName: item.description,
      description: item.notes,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent || 0,
      totalPrice: item.totalPrice,
      taxRateId: item.taxRateId || 'no_vat',
      linkedDesignItemId: item.linkedDesignItemId,
      category: item.category,
      notes: item.notes,
    })),
    financials: {
      currency: (quote.currency as 'UGX' | 'USD') || 'UGX',
      subtotal: quote.subtotal,
      totalDiscount: quote.totalDiscount || 0,
      totalTax: quote.taxAmount,
      grandTotal: quote.total,
      overheadPercent: quote.overheadPercent,
      overheadAmount: quote.overheadAmount,
      marginPercent: quote.marginPercent,
      marginAmount: quote.marginAmount,
    },
    companyInfo: companyInfo || DEFAULT_COMPANY_INFO,
    paymentInfo: DEFAULT_PAYMENT_INFO,
    notes: quote.paymentTerms,
  };
}

/**
 * Category labels for display
 */
const CATEGORY_LABELS: Record<string, string> = {
  material: 'Materials',
  labor: 'Labor',
  hardware: 'Hardware',
  finishing: 'Finishing',
  outsourcing: 'Outsourcing',
  overhead: 'Overhead',
  procurement: 'Procured Items',
  'procurement-logistics': 'Logistics',
  'procurement-customs': 'Customs',
  other: 'Other',
};

export default function QuotePreviewDialog({
  open,
  onOpenChange,
  quote,
  projectId,
  customerAddress,
  companyInfo: propCompanyInfo,
}: QuotePreviewDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const { settings: orgSettings } = useOrganizationSettings();

  // Build company info with logo from Dawin Finishes subsidiary branding
  const getCompanyInfo = (): CompanyInfo => {
    if (propCompanyInfo) return propCompanyInfo;
    const dawinFinishesBranding = orgSettings?.branding?.subsidiaries?.['zeus-the-agency'];
    return {
      ...DEFAULT_COMPANY_INFO,
      name: orgSettings?.info?.name || DEFAULT_COMPANY_INFO.name,
      logoUrl: dawinFinishesBranding?.logoUrl || undefined,
      website: dawinFinishesBranding?.website || orgSettings?.info?.website || DEFAULT_COMPANY_INFO.website,
      email: orgSettings?.info?.email || DEFAULT_COMPANY_INFO.email,
      phone: orgSettings?.info?.phone || DEFAULT_COMPANY_INFO.phone,
    };
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const quoteData = convertToQuoteData(quote, customerAddress, getCompanyInfo());
      await pdfGeneratorService.download(quoteData, `${quote.quoteNumber}.pdf`);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPDF = async () => {
    setDownloading(true);
    try {
      const quoteData = convertToQuoteData(quote, customerAddress, getCompanyInfo());
      await pdfGeneratorService.preview(quoteData);
    } catch (error) {
      console.error('Failed to preview PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Quote Preview</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrintPDF} disabled={downloading}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} disabled={downloading}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Quote Document Preview */}
        <div className="bg-white border rounded-lg p-8 shadow-sm">
          {/* Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-[#6B2D5B]">Quote: {quote.quoteNumber}</h1>
              {quote.projectName && (
                <p className="text-gray-700 mt-1">{quote.projectName}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Created: {format(quote.createdAt.toDate(), 'yyyy-MM-dd')}
              </p>
              <p className="text-sm text-gray-500">
                Valid until: {format(quote.validUntil.toDate(), 'yyyy-MM-dd')}
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-[#6B2D5B]">Dawin Finishes</h2>
              <p className="text-sm text-gray-600">Kayondo Road, Kyambogo</p>
              <p className="text-sm text-gray-600">Kampala, Uganda</p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-xs text-gray-500 border-b border-gray-200 pb-1 mb-2">Customer:</p>
              <p className="font-semibold text-lg mb-2">{quote.customerName}</p>
              {quote.customerEmail && (
                <p className="text-sm text-gray-600">{quote.customerEmail}</p>
              )}
              {customerAddress && (
                <>
                  <p className="text-sm text-gray-600">{customerAddress.street}</p>
                  <p className="text-sm text-gray-600">{customerAddress.city}</p>
                  <p className="text-sm text-gray-600">{customerAddress.region}, {customerAddress.country}</p>
                </>
              )}
            </div>
            <div>
              {/* Shipping address placeholder */}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Customer reference:</p>
              <p className="font-bold text-lg">{quote.projectCode}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="text-left py-2 px-3 font-semibold">#</th>
                  <th className="text-left py-2 px-3 font-semibold">Item</th>
                  <th className="text-center py-2 px-3 font-semibold">Qty</th>
                  <th className="text-right py-2 px-3 font-semibold">Unit Price</th>
                  <th className="text-right py-2 px-3 font-semibold">Total</th>
                  <th className="text-center py-2 px-3 font-semibold">Tax</th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((item, index) => (
                  <tr 
                    key={item.id} 
                    className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}
                  >
                    <td className="py-3 px-3 text-gray-600">{index + 1}.</td>
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium">
                      {formatCurrency(item.totalPrice)}
                    </td>
                    <td className="py-3 px-3 text-center text-xs">
                      {item.taxRateId === 'standard_vat' ? '18% VAT' : 
                       item.taxRateId === 'exempt' ? 'Exempt' : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Subtotal:</span>
                <span>{formatCurrency(quote.subtotal)} {quote.currency}</span>
              </div>
              {quote.overheadAmount && quote.overheadAmount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Overhead ({((quote.overheadPercent || 0) * 100).toFixed(0)}%):</span>
                  <span>{formatCurrency(quote.overheadAmount)} {quote.currency}</span>
                </div>
              )}
              {quote.marginAmount && quote.marginAmount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Margin ({((quote.marginPercent || 0) * 100).toFixed(0)}%):</span>
                  <span>{formatCurrency(quote.marginAmount)} {quote.currency}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Tax ({(quote.taxRate * 100).toFixed(0)}%):</span>
                <span>{formatCurrency(quote.taxAmount)} {quote.currency}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-gray-800 mt-2">
                <span className="font-bold">Total:</span>
                <span className="font-bold text-lg">{formatCurrency(quote.total)} {quote.currency}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">Payment Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Bank: ABSA BANK</p>
                <p className="text-gray-600">Account: DAWIN FINISHES SMC LIMITED</p>
                <p className="text-gray-600">Account No: 6006867063</p>
              </div>
              <div>
                <p className="font-medium">MTN Merchant Code: 595946</p>
                <p className="text-gray-600">Merchant Name: DAWIN FINISHES SMC LTD</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 italic">
              Pesapal: Payments can be made in-person via POS or online via a payment link generated on request.
            </p>
          </div>

          {/* Payment Terms */}
          {quote.paymentTerms && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Payment Terms</h3>
              <p className="text-sm text-gray-700">{quote.paymentTerms}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 flex justify-between text-xs text-gray-500">
            <div>
              <p>Kayondo Road, Kyambogo Upper Estate Ground Floor, Jordan House</p>
              <p>Kampala, Central Region, Uganda</p>
              <p className="text-[#6B2D5B]">dawinfinishes.com</p>
            </div>
            <div className="text-right">
              <p>Printed on {format(new Date(), 'yyyy-MM-dd')}</p>
              <p>Powered by DawinOS</p>
            </div>
          </div>
        </div>

        {projectId && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Project Files</h3>
            <UnifiedFileManager
              projectId={projectId}
              userId=""
              readOnly
              showBulkActions={false}
              module="design-manager"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
