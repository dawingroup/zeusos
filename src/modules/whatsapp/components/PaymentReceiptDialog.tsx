/**
 * PaymentReceiptDialog
 * Sends payment receipt via WhatsApp using the payment_receipt template.
 * Uses the uploaded header image from WhatsApp settings for the template,
 * then sends the generated receipt PDF as a follow-up document message.
 * Falls back to text message if template send fails.
 */

import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Phone, Receipt, FileText, AlertTriangle, Image } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/shared/hooks/useAuth';
import { sendWhatsAppMessage } from '../services/whatsappApiService';
import { logWhatsAppActivity } from '../services/crmIntegrationService';
import { uploadFile } from '@/shared/services/firebase/storage';
import { db } from '@/shared/services/firebase/firestore';
import { recordPayment, patchPaymentWhatsAppDelivery } from '@/modules/sales-orders/services/salesOrderService';
import { getSubsidiaryBrandingLogoUrl } from '@/shared/services/branding.service';
import {
  receiptPdfService,
  resolveReceiptDocumentNumber,
  buildReceiptPriorPaymentLines,
} from '../services/receiptPdfGenerator';
import { syncPaymentToQBO } from '@/modules/finance/services/qboSyncService';
import type { PaymentTerms, PaymentRecord } from '@/modules/sales-orders/types';

interface PaymentReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: string;
  customerId: string;
  customerName: string;
  dealId?: string;
  salesOrder: {
    id: string;
    orderNumber: string;
    currentAmount: number;
    currency: string;
    paymentTerms?: PaymentTerms;
    qboInvoiceId?: string;
    qboInvoiceDocNumber?: string;
    /** Used to load subsidiary logo on the PDF (Settings → branding). */
    subsidiaryId?: string;
    /** Existing payments on the order (for “previous payments” summary on the receipt PDF). */
    payments?: PaymentRecord[];
  };
  /** Resend template + PDF for a payment already on the order (does not create a duplicate payment). */
  existingPayment?: Pick<
    PaymentRecord,
    | 'id'
    | 'type'
    | 'method'
    | 'amount'
    | 'currency'
    | 'paymentDate'
    | 'recordedAt'
    | 'receiptRef'
    | 'receiptDocumentNumber'
    | 'receiptPdfUrl'
  >;
  /** Balance remaining immediately after `existingPayment` (for accurate PDF). */
  balanceAfterThisPayment?: number;
}

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

/**
 * Build template components for payment_receipt template.
 * Adapts to the registered header format (IMAGE or DOCUMENT).
 */
function buildTemplateComponents(
  params: { customerName: string; orderNumber: string; amount: string; date: string; method: string },
  headerType: 'image' | 'document' | 'text' | null,
  headerImageUrl?: string,
) {
  const components: Record<string, unknown>[] = [];

  // Header — IMAGE with uploaded header image
  if (headerType === 'image' && headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [
        { type: 'image', image: { link: headerImageUrl } },
      ],
    });
  }

  // Body parameters: {{1}}-{{5}}
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: params.customerName },
      { type: 'text', text: params.orderNumber },
      { type: 'text', text: params.amount },
      { type: 'text', text: params.date },
      { type: 'text', text: params.method },
    ],
  });

  return components;
}

export function PaymentReceiptDialog({
  open,
  onClose,
  phoneNumber,
  customerId,
  customerName,
  dealId,
  salesOrder,
  existingPayment,
  balanceAfterThisPayment,
}: PaymentReceiptDialogProps) {
  const { user } = useAuth();
  const [manualPhone, setManualPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'deposit' | 'milestone' | 'full'>('deposit');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const provisionalReceiptNumberRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && !existingPayment) {
      provisionalReceiptNumberRef.current = null;
    }
  }, [open, existingPayment]);
  const [headerImageUrl, setHeaderImageUrl] = useState<string>('');
  const [registeredHeaderType, setRegisteredHeaderType] = useState<'image' | 'document' | 'text' | null>(null);

  const resolvedPhone = phoneNumber || customerPhone || manualPhone.trim();

  const depositAmount = salesOrder.paymentTerms?.depositAmount
    ?? Math.round(salesOrder.currentAmount * ((salesOrder.paymentTerms?.depositPercent ?? 50) / 100));

  const paymentDateStr = (() => {
    if (existingPayment?.paymentDate && typeof existingPayment.paymentDate.toDate === 'function') {
      return existingPayment.paymentDate.toDate().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    if (existingPayment?.recordedAt && typeof existingPayment.recordedAt.toDate === 'function') {
      return existingPayment.recordedAt.toDate().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    return new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  })();

  // Fetch template config (header image + registered type) on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        // Check registered template's header type
        const templateSnap = await getDoc(doc(db, 'whatsappTemplates', 'payment_receipt'));
        if (templateSnap.exists()) {
          const ht = templateSnap.data()?.headerType;
          setRegisteredHeaderType(ht || null);
        }

        // Fetch header image URL from whatsappConfig
        const waSnap = await getDoc(doc(db, 'systemConfig', 'whatsappConfig'));
        if (waSnap.exists()) {
          const images = waSnap.data()?.templateHeaderImages;
          const url = images?.paymentReceipt || images?.default;
          if (url) setHeaderImageUrl(url);
        }
      } catch (err) {
        console.warn('Failed to fetch template config:', err);
      }
    })();
  }, [open]);

  // Fetch customer phone if not provided
  useEffect(() => {
    if (!open || !customerId || phoneNumber) return;
    setLoadingPhone(true);
    import('@/modules/customer-hub/services/customerService')
      .then(({ getCustomer }) => getCustomer(customerId))
      .then((customer) => {
        if (customer) {
          const phone = customer.phone
            || customer.contacts?.find((c: { isPrimary: boolean; phone?: string }) => c.isPrimary)?.phone
            || customer.contacts?.[0]?.phone
            || '';
          setCustomerPhone(phone);
        }
      })
      .catch((err) => console.warn('Failed to fetch customer phone:', err))
      .finally(() => setLoadingPhone(false));
  }, [open, customerId, phoneNumber]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setError(null);
    setManualPhone('');
    setSendStatus('');
    setHeaderImageUrl('');
    setRegisteredHeaderType(null);
    if (existingPayment) {
      setPaymentType(existingPayment.type);
      setAmountReceived(String(existingPayment.amount));
      setPaymentMethod(typeof existingPayment.method === 'string' ? existingPayment.method : '');
      setReceiptRef(existingPayment.receiptRef || '');
    } else {
      setPaymentType('deposit');
      setAmountReceived('');
      setPaymentMethod('');
      setReceiptRef('');
    }
  }, [open, existingPayment?.id]);

  const parsedInput = amountReceived.trim() !== '' ? parseFloat(amountReceived) : NaN;
  const displayAmount = Number.isFinite(parsedInput) && parsedInput > 0
    ? parsedInput
    : existingPayment
      ? existingPayment.amount
      : paymentType === 'deposit'
        ? depositAmount
        : paymentType === 'full'
          ? salesOrder.currentAmount
          : 0;

  const balanceAfter =
    existingPayment && balanceAfterThisPayment !== undefined
      ? balanceAfterThisPayment
      : salesOrder.currentAmount - displayAmount;

  // Template preview text (matches payment_receipt template body)
  const templatePreview = `Hello ${customerName},

Thank you for your payment! Here is your official receipt.

*Order:* ${salesOrder.orderNumber}
*Amount Paid:* ${formatCurrency(displayAmount, salesOrder.currency)}
*Date:* ${paymentDateStr}
*Method:* ${paymentMethod || '—'}

Please find the detailed receipt attached as a PDF.

For any questions, reply to this message.`;

  /**
   * Generate receipt PDF blob and upload to Firebase Storage.
   */
  async function generateAndUploadPdf(): Promise<string | null> {
    try {
      setSendStatus('Generating receipt PDF...');

      let logoUrl: string | undefined;
      try {
        logoUrl = await getSubsidiaryBrandingLogoUrl(salesOrder.subsidiaryId);
      } catch {
        logoUrl = undefined;
      }

      const receiptNumber = existingPayment
        ? resolveReceiptDocumentNumber(salesOrder.orderNumber, {
            id: existingPayment.id,
            receiptDocumentNumber: existingPayment.receiptDocumentNumber,
          })
        : (provisionalReceiptNumberRef.current ??= resolveReceiptDocumentNumber(
            salesOrder.orderNumber,
            null,
          ));

      const previousPayments = buildReceiptPriorPaymentLines(
        salesOrder.payments,
        existingPayment?.id,
      );

      const data = {
        receiptNumber,
        orderNumber: salesOrder.orderNumber,
        customerName,
        paymentDate: paymentDateStr,
        paymentType,
        paymentMethod: paymentMethod || '—',
        amountReceived: displayAmount,
        currency: salesOrder.currency,
        orderTotal: salesOrder.currentAmount,
        balanceRemaining: balanceAfter,
        receiptRef: receiptRef || undefined,
        invoiceNumber: salesOrder.qboInvoiceDocNumber || undefined,
        ...(logoUrl ? { logoUrl } : {}),
        ...(previousPayments.length > 0 ? { previousPayments } : {}),
      };

      const blob = await receiptPdfService.generateBlob(data);
      const idSuffix = existingPayment?.id ? `_${existingPayment.id.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}` : '';
      const filename = `Receipt_${salesOrder.orderNumber.replace(/-/g, '_')}${idSuffix}.pdf`;
      const storagePath = `receipts/${salesOrder.id}/${filename}`;

      setSendStatus('Uploading PDF...');
      const { url } = await uploadFile(storagePath, blob);
      return url;
    } catch (err) {
      console.warn('Receipt PDF generation failed:', err);
      return null;
    }
  }

  const handleSend = async () => {
    if (!resolvedPhone || displayAmount <= 0) return;
    setSending(true);
    setError(null);
    setSendStatus('');

    try {
      // 1. Generate and upload receipt PDF
      const pdfUrl = await generateAndUploadPdf();
      const pdfFilename = `Receipt_${salesOrder.orderNumber.replace(/-/g, '_')}${
        existingPayment?.id ? `_${existingPayment.id.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}` : ''
      }.pdf`;

      // 2. Send payment_receipt template (with header image)
      setSendStatus('Sending template message...');
      const components = buildTemplateComponents(
        {
          customerName,
          orderNumber: salesOrder.orderNumber,
          amount: formatCurrency(displayAmount, salesOrder.currency),
          date: paymentDateStr,
          method: paymentMethod || '—',
        },
        registeredHeaderType,
        headerImageUrl,
      );

      const templateResult = await sendWhatsAppMessage({
        customerId,
        customerName,
        phoneNumber: resolvedPhone,
        messageType: 'template',
        templateName: 'payment_receipt',
        templateParams: {
          '1': customerName,
          '2': salesOrder.orderNumber,
          '3': formatCurrency(displayAmount, salesOrder.currency),
          '4': paymentDateStr,
          '5': paymentMethod || '—',
        },
        interactive: { templateComponents: components } as Record<string, unknown>,
      });

      let sent = templateResult.success;
      const conversationId = templateResult.conversationId;

      if (!sent) {
        console.warn('Template send failed:', templateResult.error);
        // If template failed, throw immediately — text/document fallbacks
        // won't work either when the 24h window is closed
        throw new Error(
          templateResult.error || 'Failed to send payment_receipt template. Check that the template is registered and approved in Meta Business Manager.',
        );
      }

      // 3. Send PDF via receipt_document template (works outside 24h window)
      if (pdfUrl && sent) {
        setSendStatus('Sending receipt PDF...');
        try {
          const pdfComponents: Record<string, unknown>[] = [
            {
              type: 'header',
              parameters: [
                { type: 'document', document: { link: pdfUrl, filename: pdfFilename } },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customerName },
                { type: 'text', text: salesOrder.orderNumber },
                { type: 'text', text: formatCurrency(displayAmount, salesOrder.currency) },
                { type: 'text', text: paymentDateStr },
              ],
            },
          ];

          const pdfResult = await sendWhatsAppMessage({
            conversationId: conversationId || undefined,
            customerId,
            customerName,
            phoneNumber: resolvedPhone,
            messageType: 'template',
            templateName: 'receipt_document',
            templateParams: {
              '1': customerName,
              '2': salesOrder.orderNumber,
              '3': formatCurrency(displayAmount, salesOrder.currency),
              '4': paymentDateStr,
            },
            headerConfig: {
              format: 'document',
              url: pdfUrl,
              filename: pdfFilename,
            },
            interactive: { templateComponents: pdfComponents } as Record<string, unknown>,
          });

          if (!pdfResult.success) {
            // Template may not be registered yet — try as regular document (needs window)
            console.warn('receipt_document template failed, trying direct document:', pdfResult.error);
            const docResult = await sendWhatsAppMessage({
              conversationId: conversationId || undefined,
              customerId,
              customerName,
              phoneNumber: resolvedPhone,
              messageType: 'document',
              documentUrl: pdfUrl,
              documentCaption: `Payment Receipt — ${salesOrder.orderNumber}`,
              documentFilename: pdfFilename,
            });
            if (!docResult.success) {
              console.warn('PDF follow-up skipped (window may be closed):', docResult.error);
            }
          }
        } catch (pdfErr) {
          // Don't fail the whole operation — the primary template was already sent
          console.warn('PDF follow-up failed:', pdfErr);
        }
      }

      // Log CRM activity
      if (sent && dealId) {
        logWhatsAppActivity(dealId, 'payment_receipt_sent', {
          phoneNumber: resolvedPhone,
          orderNumber: salesOrder.orderNumber,
          paymentType,
          amountReceived: displayAmount,
          currency: salesOrder.currency,
          ...(receiptRef ? { receiptRef } : {}),
          pdfAttached: !!pdfUrl,
          ...(existingPayment ? { paymentId: existingPayment.id, resend: true } : {}),
        }).catch((err) => console.warn('CRM activity log failed:', err));
      }

      if (sent && existingPayment) {
        try {
          setSendStatus('Updating payment record...');
          await patchPaymentWhatsAppDelivery(
            salesOrder.id,
            existingPayment.id,
            {
              ...(pdfUrl ? { receiptPdfUrl: pdfUrl } : {}),
              sharedViaWhatsApp: true,
              whatsAppPhone: resolvedPhone,
            },
            user?.uid || 'system',
          );
        } catch (patchErr) {
          console.warn('Failed to update payment with receipt URL:', patchErr);
        }
      }

      // Record payment on the Sales Order document (new payments only)
      if (sent && !existingPayment) {
        try {
          setSendStatus('Recording payment...');
          const paymentRecord = await recordPayment(
            salesOrder.id,
            {
              type: paymentType,
              method: paymentMethod,
              amount: displayAmount,
              currency: salesOrder.currency,
              paymentDate: new Date().toISOString().split('T')[0],
              receiptRef: receiptRef || undefined,
              receiptDocumentNumber: provisionalReceiptNumberRef.current || undefined,
              receiptPdfUrl: pdfUrl || undefined,
              sharedViaWhatsApp: true,
              whatsAppPhone: resolvedPhone,
            },
            user?.uid || 'system',
          );

          if (salesOrder.qboInvoiceId && paymentRecord?.id) {
            try {
              setSendStatus('Syncing payment to QuickBooks...');
              await syncPaymentToQBO(salesOrder.id, paymentRecord.id);
            } catch (qboErr) {
              console.warn('QBO payment sync failed (can retry from SO page):', qboErr);
            }
          }
        } catch (recordErr) {
          console.warn('Payment recording failed:', recordErr);
        }
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send payment receipt');
    } finally {
      setSending(false);
      setSendStatus('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            {existingPayment ? 'Send receipt (WhatsApp)' : 'Share Payment Receipt'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" disabled={sending}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Phone number */}
          {resolvedPhone ? (
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Send to <span className="font-medium">{resolvedPhone}</span>
            </p>
          ) : loadingPhone ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Looking up customer phone...
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recipient phone number</label>
              <input
                type="tel"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+256 7XX XXX XXX"
              />
            </div>
          )}

          {/* Template info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Sends via <span className="font-medium">payment_receipt</span> template
              {headerImageUrl ? ' with header image' : ''}
              {' + PDF receipt attachment'}
              {existingPayment && (
                <span className="block mt-1 text-blue-800/90">
                  Selected payment is already on this order — nothing new will be recorded; we only send the message
                  and refresh receipt / WhatsApp fields on that line.
                </span>
              )}
            </p>
          </div>

          {/* Payment type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Type</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(['deposit', 'milestone', 'full'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setPaymentType(type);
                    setAmountReceived('');
                  }}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                    paymentType === type
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Amount & details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount Received ({salesOrder.currency})</label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={displayAmount.toString()}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select...</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Receipt Reference (optional)</label>
            <input
              type="text"
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. RCP-2026-001 or transaction ID"
            />
          </div>

          {/* Message preview */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b flex items-center gap-2">
              <p className="text-xs font-medium text-gray-500">Template Preview</p>
              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                payment_receipt
              </span>
            </div>
            {/* Header image preview */}
            {headerImageUrl ? (
              <div className="mx-2 mt-2">
                <img
                  src={headerImageUrl}
                  alt="Template header"
                  className="w-full h-28 object-cover rounded-t-lg"
                />
              </div>
            ) : (
              <div className="mx-2 mt-2 px-3 py-3 bg-gray-100 rounded-t-lg flex items-center justify-center gap-2 text-gray-400">
                <Image className="w-4 h-4" />
                <span className="text-xs">No header image uploaded</span>
              </div>
            )}
            <div className="bg-[#e5f6df] p-3 mx-2 rounded-b-lg text-sm whitespace-pre-wrap">
              {templatePreview}
            </div>
            {/* PDF follow-up indicator */}
            <div className="mx-2 my-2 px-3 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-700">
                  Receipt_{salesOrder.orderNumber.replace(/-/g, '_')}.pdf
                </p>
                <p className="text-[10px] text-gray-400">Sent as follow-up document</p>
              </div>
            </div>
          </div>

          {/* Balance info */}
          {displayAmount > 0 && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              balanceAfter <= 0
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {balanceAfter <= 0 ? (
                <>✅ Order will be fully paid</>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Remaining balance: {formatCurrency(balanceAfter, salesOrder.currency)}
                </>
              )}
            </div>
          )}

          {/* Send status */}
          {sendStatus && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {sendStatus}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !resolvedPhone || displayAmount <= 0 || !paymentMethod}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
