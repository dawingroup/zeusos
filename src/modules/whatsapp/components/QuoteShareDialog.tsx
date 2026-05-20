/**
 * QuoteShareDialog - Share a quote/proposal via WhatsApp
 * Fetches quotes from Design Manager, sends as a template message
 * (quote_submission) with Approve / Reject quick-reply buttons.
 * Also generates a PDF and sends it as a follow-up document.
 * Template messages work outside the 24-hour conversation window.
 */

import { useState, useEffect } from 'react';
import {
  X, FileText, Send, Loader2, ExternalLink,
  CheckCircle2, Clock, Eye, AlertCircle, ThumbsUp, ThumbsDown, Phone,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { sendWhatsAppMessage } from '../services/whatsappApiService';
import { logWhatsAppActivity } from '../services/crmIntegrationService';
import { auth } from '@/shared/services/firebase/auth';
import { db } from '@/shared/services/firebase/firestore';
import { uploadFile } from '@/shared/services/firebase/storage';
import type { ClientQuote } from '@/modules/design-manager/types/clientPortal';

interface Props {
  open: boolean;
  onClose: () => void;
  phoneNumber: string;
  customerId?: string;
  conversationId?: string;
  dealId?: string;
  dealTitle?: string;
  linkedProjectId?: string;
  customerName?: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  draft: { icon: Clock, color: 'text-gray-500', label: 'Draft' },
  sent: { icon: Send, color: 'text-blue-500', label: 'Sent' },
  viewed: { icon: Eye, color: 'text-purple-500', label: 'Viewed' },
  approved: { icon: CheckCircle2, color: 'text-green-600', label: 'Approved' },
  rejected: { icon: AlertCircle, color: 'text-red-500', label: 'Rejected' },
  revision: { icon: AlertCircle, color: 'text-orange-500', label: 'Revision' },
  expired: { icon: Clock, color: 'text-gray-400', label: 'Expired' },
};

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

/**
 * Build template components for the quote_submission template.
 * Adapts to the registered template's header format:
 *  - IMAGE header → sends image URL parameter
 *  - TEXT header  → sends text parameter (quote number)
 *
 * Body params: {{1}} = customer name, {{2}} = title, {{3}} = quote number,
 *              {{4}} = project, {{5}} = amount, {{6}} = portal URL
 */
function buildTemplateComponents(
  quote: ClientQuote,
  customerName: string,
  headerType: 'image' | 'text',
  headerImageUrl?: string,
) {
  const portalUrl = quote.accessUrl || 'Contact us for details';

  const components: Record<string, unknown>[] = [];

  // Header — adapt to registered template format
  if (headerType === 'image' && headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [
        { type: 'image', image: { link: headerImageUrl } },
      ],
    });
  } else if (headerType === 'text') {
    components.push({
      type: 'header',
      parameters: [
        { type: 'text', text: quote.quoteNumber },
      ],
    });
  }

  // Body parameters
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: customerName },
      { type: 'text', text: quote.title },
      { type: 'text', text: quote.quoteNumber },
      { type: 'text', text: quote.projectName },
      { type: 'text', text: formatCurrency(quote.total, quote.currency) },
      { type: 'text', text: portalUrl },
    ],
  });

  // Quick-reply buttons
  components.push(
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '0',
      parameters: [
        { type: 'payload', payload: `quote_approve_${quote.id}` },
      ],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '1',
      parameters: [
        { type: 'payload', payload: `quote_reject_${quote.id}` },
      ],
    },
  );

  return components;
}

export function QuoteShareDialog({
  open,
  onClose,
  phoneNumber,
  customerId,
  conversationId,
  dealId,
  dealTitle,
  linkedProjectId,
  customerName = 'Customer',
}: Props) {
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<ClientQuote | null>(null);
  const [mode, setMode] = useState<'select' | 'manual'>('select');
  const [documentUrl, setDocumentUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualPhone, setManualPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);
  const [headerImageUrl, setHeaderImageUrl] = useState<string>('');
  const [registeredHeaderType, setRegisteredHeaderType] = useState<'image' | 'text'>('text');

  // Resolve phone: prop > customer record > manual input
  const resolvedPhone = phoneNumber || customerPhone || manualPhone.trim();

  // Fetch header image URL and registered template headerType on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        // Check registered template's header type
        const templateSnap = await getDoc(doc(db, 'whatsappTemplates', 'quote_submission'));
        if (templateSnap.exists()) {
          const ht = templateSnap.data()?.headerType;
          if (ht === 'image') setRegisteredHeaderType('image');
          else setRegisteredHeaderType('text');
        }

        // Fetch header image URL from whatsappConfig or org branding
        const waSnap = await getDoc(doc(db, 'systemConfig', 'whatsappConfig'));
        if (waSnap.exists()) {
          const images = waSnap.data()?.templateHeaderImages;
          const url = images?.quoteSubmission || images?.default;
          if (url) { setHeaderImageUrl(url); return; }
        }
        const settingsSnap = await getDoc(doc(db, 'organizations/default/settings', 'general'));
        if (settingsSnap.exists()) {
          const subs = settingsSnap.data()?.branding?.subsidiaries;
          const url = subs?.['zeus-the-agency']?.logoUrl;
          if (url) { setHeaderImageUrl(url); return; }
        }
      } catch (err) {
        console.warn('Failed to fetch template config:', err);
      }
    })();
  }, [open]);

  // Fetch customer phone from Customer Hub when dialog opens
  useEffect(() => {
    if (!open || !customerId || phoneNumber) return;

    setLoadingPhone(true);
    import('@/modules/customer-hub/services/customerService')
      .then(({ getCustomer }) => getCustomer(customerId))
      .then((customer) => {
        if (customer) {
          // Use primary phone, or find primary contact's phone
          const phone = customer.phone
            || customer.contacts?.find((c: { isPrimary: boolean; phone?: string }) => c.isPrimary)?.phone
            || customer.contacts?.[0]?.phone
            || '';
          setCustomerPhone(phone);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch customer phone:', err);
      })
      .finally(() => setLoadingPhone(false));
  }, [open, customerId, phoneNumber]);

  // Fetch quotes from Design Manager when dialog opens with a linked project
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedQuote(null);
    setCaption('');
    setManualPhone('');
    setCustomerPhone('');
    setSendStatus('');

    if (linkedProjectId) {
      setMode('select');
      setLoadingQuotes(true);
      import('@/modules/design-manager/services/clientPortalService')
        .then(({ getQuotesForProject }) => getQuotesForProject(linkedProjectId))
        .then((data) => {
          setQuotes(data);
          if (data.length === 0) setMode('manual');
        })
        .catch((err) => {
          console.warn('Failed to load quotes:', err);
          setMode('manual');
        })
        .finally(() => setLoadingQuotes(false));
    } else {
      setMode('manual');
      setQuotes([]);
    }
  }, [open, linkedProjectId]);

  /**
   * Generate PDF from quote and upload to Firebase Storage
   * Returns the download URL or null if generation fails
   */
  async function generateAndUploadPdf(quote: ClientQuote): Promise<string | null> {
    try {
      const { pdfGeneratorService, DEFAULT_COMPANY_INFO, DEFAULT_PAYMENT_INFO } =
        await import('@/modules/design-manager/services/quote-pdf-generator');

      // Fetch org branding for the logo
      let logoUrl: string | undefined;
      try {
        const settingsSnap = await getDoc(doc(db, 'organizations/default/settings', 'general'));
        if (settingsSnap.exists()) {
          const subs = settingsSnap.data()?.branding?.subsidiaries;
          logoUrl = subs?.['zeus-the-agency']?.logoUrl;
        }
      } catch { /* proceed without logo */ }

      // Convert ClientQuote to QuoteData format
      const quoteData = {
        quoteNumber: quote.quoteNumber,
        customerReference: quote.quoteNumber,
        createdAt: quote.createdAt?.toDate ? quote.createdAt.toDate() : new Date(),
        validUntil: quote.validUntil?.toDate ? quote.validUntil.toDate() : undefined,
        customer: {
          name: quote.customerName || customerName,
          email: quote.customerEmail || '',
          address: { street: '', city: 'Kampala', region: 'Central', country: 'Uganda' },
        },
        lineItems: quote.lineItems.map((item) => ({
          id: item.id,
          itemName: item.description,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          totalPrice: item.totalPrice,
          taxRateId: (item.taxRateId || 'no_vat') as 'no_vat' | 'standard_vat' | 'exempt',
          category: item.category,
        })),
        financials: {
          currency: (quote.currency === 'USD' ? 'USD' : 'UGX') as 'UGX' | 'USD',
          subtotal: quote.subtotal,
          totalDiscount: 0,
          totalTax: quote.taxAmount,
          grandTotal: quote.total,
          overheadPercent: quote.overheadPercent,
          overheadAmount: quote.overheadAmount,
          marginPercent: quote.marginPercent,
          marginAmount: quote.marginAmount,
        },
        companyInfo: { ...DEFAULT_COMPANY_INFO, ...(logoUrl ? { logoUrl } : {}) },
        paymentInfo: DEFAULT_PAYMENT_INFO,
        projectName: quote.projectName,
        projectCode: quote.projectCode,
      };

      const blob = await pdfGeneratorService.generateBlob(quoteData);
      const filename = `Quote_${quote.quoteNumber.replace(/-/g, '_')}.pdf`;
      const storagePath = `quotes/${quote.id}/${filename}`;

      const { url } = await uploadFile(storagePath, blob);
      return url;
    } catch (err) {
      console.warn('PDF generation failed, continuing without PDF:', err);
      return null;
    }
  }

  const handleSend = async () => {
    setSending(true);
    setError(null);
    setSendStatus('');

    try {
      if (mode === 'select' && selectedQuote) {
        // Ensure accessUrl exists — generate if needed
        let quote = selectedQuote;
        if (!quote.accessUrl) {
          setSendStatus('Generating portal link...');
          try {
            const { sendQuoteToClient } = await import(
              '@/modules/design-manager/services/clientPortalService'
            );
            const uid = auth.currentUser?.uid || '';
            const { accessUrl } = await sendQuoteToClient(quote.id, uid);
            quote = { ...quote, accessUrl };
            setSelectedQuote(quote);
          } catch (err) {
            console.warn('Failed to generate access URL:', err);
            // Continue without accessUrl — template will use fallback text
          }
        }

        // 1. Send template message (works outside 24h window)
        setSendStatus('Sending template message...');
        console.log('[QuoteShare] Header type:', registeredHeaderType, '| Image URL:', headerImageUrl ? 'set' : 'none');
        const components = buildTemplateComponents(quote, customerName, registeredHeaderType, headerImageUrl || undefined);
        console.log('[QuoteShare] Template components:', JSON.stringify(components.find((c: Record<string, unknown>) => c.type === 'header')));

        const result = await sendWhatsAppMessage({
          conversationId,
          customerId,
          customerName,
          phoneNumber: resolvedPhone,
          messageType: 'template',
          templateName: 'quote_submission',
          templateParams: {
            '1': customerName,
            '2': quote.title,
            '3': quote.quoteNumber,
            '4': quote.projectName,
            '5': formatCurrency(quote.total, quote.currency),
            '6': quote.accessUrl || 'Contact us for details',
          },
          interactive: { templateComponents: components } as Record<string, unknown>,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to send template message');
        }

        // 2. Generate PDF and send as follow-up
        if (attachPdf) {
          setSendStatus('Generating PDF...');
          const pdfUrl = await generateAndUploadPdf(quote);

          if (pdfUrl) {
            const pdfFilename = `Quote_${quote.quoteNumber.replace(/-/g, '_')}.pdf`;
            let pdfSent = false;
            let pdfError = '';

            // Try document template first (works outside 24h window)
            // Always attempt via template — even if local approval check failed,
            // the server resolves the actual Meta template name and sends it.
            setSendStatus('Sending PDF document template...');
            const pdfResult = await sendWhatsAppMessage({
              conversationId: result.conversationId,
              phoneNumber: resolvedPhone,
              messageType: 'template',
              templateName: 'quote_document',
              templateParams: {
                '1': customerName,
                '2': quote.title,
                '3': quote.quoteNumber,
                '4': formatCurrency(quote.total, quote.currency),
              },
              headerConfig: {
                format: 'document',
                url: pdfUrl,
                filename: pdfFilename,
              },
            });

            if (pdfResult.success) {
              pdfSent = true;
            } else {
              pdfError = pdfResult.error || 'Template send failed';
              console.warn('PDF document template send failed:', pdfResult.error, 'metaCode:', pdfResult.metaErrorCode);
            }

            // Fallback: send PDF as a plain document message (requires open 24h window)
            if (!pdfSent) {
              setSendStatus('Template failed — sending PDF as document...');
              const docResult = await sendWhatsAppMessage({
                conversationId: result.conversationId,
                phoneNumber: resolvedPhone,
                messageType: 'document',
                documentUrl: pdfUrl,
                documentCaption: `Quote ${quote.quoteNumber} — ${quote.title}`,
                documentFilename: pdfFilename,
              });

              if (docResult.success) {
                pdfSent = true;
              } else {
                pdfError = docResult.error || 'Document send failed';
                console.warn('PDF document send failed:', docResult.error);
              }
            }

            // Warn user if PDF couldn't be sent (quote message itself succeeded)
            if (!pdfSent) {
              setError(`Quote sent, but PDF attachment failed: ${pdfError}`);
              setSending(false);
              setSendStatus('');
              return; // Don't close dialog — let user see the warning
            }
          }
        }

        // 3. Log CRM activity (best-effort — don't block success)
        if (dealId) {
          logWhatsAppActivity(dealId, 'quote_shared', {
            phoneNumber: resolvedPhone,
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            quoteTotal: quote.total,
            quoteCurrency: quote.currency,
            sentVia: 'template',
            templateName: 'quote_submission',
            ...(quote.accessUrl ? { accessUrl: quote.accessUrl } : {}),
            ...(dealTitle ? { dealTitle } : {}),
          }).catch((err) => console.warn('CRM activity log failed:', err));
        }
      } else {
        // Manual mode — send as text with URL
        const text = caption.trim() || `Quote: ${documentUrl.trim()}`;
        const manualResult = await sendWhatsAppMessage({
          conversationId,
          phoneNumber: resolvedPhone,
          messageType: 'text',
          text,
        });

        if (!manualResult.success) {
          throw new Error(manualResult.error || 'Failed to send message');
        }

        if (dealId) {
          logWhatsAppActivity(dealId, 'quote_shared', {
            phoneNumber: resolvedPhone,
            ...(documentUrl.trim() ? { documentUrl: documentUrl.trim() } : {}),
            ...(dealTitle ? { dealTitle } : {}),
          }).catch((err) => console.warn('CRM activity log failed:', err));
        }
      }

      onClose();
      setSelectedQuote(null);
      setDocumentUrl('');
      setCaption('');
    } catch (err: any) {
      setError(err.message || 'Failed to send quote');
    } finally {
      setSending(false);
      setSendStatus('');
    }
  };

  const canSend = !!resolvedPhone && (mode === 'select'
    ? !!selectedQuote
    : !!(documentUrl.trim() || caption.trim()));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            Share Quote via WhatsApp
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Phone number section */}
          {resolvedPhone ? (
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Send to <span className="font-medium">{resolvedPhone}</span>
              {!phoneNumber && customerPhone && (
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                  from client file
                </span>
              )}
              {dealTitle && <> for <span className="font-medium">{dealTitle}</span></>}
            </p>
          ) : loadingPhone ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Looking up customer phone...
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Recipient phone number {dealTitle && <span className="font-medium">({dealTitle})</span>}
              </label>
              <input
                type="tel"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="+256 7XX XXX XXX"
              />
            </div>
          )}

          {/* Template badge */}
          {mode === 'select' && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sends via approved template — works anytime (no 24h window restriction)
            </div>
          )}

          {/* Mode toggle */}
          {linkedProjectId && quotes.length > 0 && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => { setMode('select'); setSelectedQuote(null); setCaption(''); }}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'select' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                From Design Manager
              </button>
              <button
                onClick={() => { setMode('manual'); setSelectedQuote(null); setCaption(''); }}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'manual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Manual URL
              </button>
            </div>
          )}

          {mode === 'select' && (
            <>
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading quotes...</span>
                </div>
              ) : quotes.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No quotes found for this project.</p>
                  <button
                    onClick={() => setMode('manual')}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                  >
                    Enter URL manually instead
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Select a quote</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {quotes.map((quote) => {
                      const status = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft;
                      const StatusIcon = status.icon;
                      const isSelected = selectedQuote?.id === quote.id;
                      return (
                        <button
                          key={quote.id}
                          onClick={() => setSelectedQuote(quote)}
                          className={`w-full text-left p-3 border rounded-lg text-sm transition-colors ${
                            isSelected
                              ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">{quote.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {quote.quoteNumber} &middot; {quote.projectName}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(quote.total, quote.currency)}
                              </p>
                              <div className={`flex items-center gap-1 text-xs ${status.color} mt-0.5 justify-end`}>
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </div>
                            </div>
                          </div>
                          {quote.accessUrl && (
                            <div className="flex items-center gap-1 text-xs text-blue-500 mt-1.5">
                              <ExternalLink className="w-3 h-3" />
                              Client portal link available
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Message preview */}
              {selectedQuote && (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-500">Template Message Preview</p>
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                        quote_submission
                      </span>
                    </div>
                    <div className="bg-[#e5f6df] p-3 m-2 rounded-lg text-sm space-y-1.5">
                      {/* Header — adapts to registered template format */}
                      {registeredHeaderType === 'image' && headerImageUrl ? (
                        <div className="-mx-3 -mt-3 mb-2">
                          <img
                            src={headerImageUrl}
                            alt="Quote header"
                            className="w-full h-28 object-cover rounded-t-lg"
                          />
                        </div>
                      ) : registeredHeaderType === 'image' ? (
                        <div className="-mx-3 -mt-3 mb-2 bg-gradient-to-r from-[#872E5C] to-[#E18425] h-28 rounded-t-lg flex items-center justify-center">
                          <p className="text-white font-bold text-lg tracking-wide">Dawin Finishes</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 font-medium">
                          Quote {selectedQuote.quoteNumber}
                        </p>
                      )}
                      <div>
                        <p>Hello {customerName},</p>
                        <p className="mt-1">Here is your quote from <strong>Dawin Finishes</strong>.</p>
                        <p className="mt-1"><strong>{selectedQuote.title}</strong></p>
                        <p>Quote #: {selectedQuote.quoteNumber}</p>
                        <p>Project: {selectedQuote.projectName}</p>
                        <p>Amount: <strong>{formatCurrency(selectedQuote.total, selectedQuote.currency)}</strong></p>
                        {selectedQuote.accessUrl ? (
                          <p className="text-blue-600 mt-1 text-xs break-all">
                            View full details: {selectedQuote.accessUrl}
                          </p>
                        ) : (
                          <p className="text-orange-500 mt-1 text-xs">
                            Portal link will be generated on send
                          </p>
                        )}
                        <p className="mt-1 text-gray-600">Please review and tap a button below to respond.</p>
                      </div>
                      <p className="text-[10px] text-gray-400">Dawin Finishes</p>
                      <div className="flex gap-2 pt-1 border-t border-green-200">
                        <span className="flex-1 text-center py-1.5 rounded border border-green-300 bg-white text-xs font-medium text-green-700 flex items-center justify-center gap-1">
                          <ThumbsUp className="w-3 h-3" /> Approve
                        </span>
                        <span className="flex-1 text-center py-1.5 rounded border border-red-200 bg-white text-xs font-medium text-red-600 flex items-center justify-center gap-1">
                          <ThumbsDown className="w-3 h-3" /> Reject
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PDF attachment option */}
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachPdf}
                      onChange={(e) => setAttachPdf(e.target.checked)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-700">Attach quote PDF</span>
                    <span className="text-[10px] text-green-600">(via document template — works anytime)</span>
                  </label>
                </>
              )}
            </>
          )}

          {mode === 'manual' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Document URL</label>
                <input
                  type="url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="https://storage.googleapis.com/..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Message</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Enter a message to send with the quote..."
                />
              </div>
            </>
          )}

          {sendStatus && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              {sendStatus}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !canSend}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Quote
          </button>
        </div>
      </div>
    </div>
  );
}
