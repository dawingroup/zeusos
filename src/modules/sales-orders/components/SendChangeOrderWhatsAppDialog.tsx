/**
 * SendChangeOrderWhatsAppDialog — preview + send a CO approval
 * request via WhatsApp. Opens from the CO detail page.
 *
 * Flow:
 *   1. On open → call `previewChangeOrderMessage` to get the exact
 *      text the client will receive (including the signed portal URL).
 *   2. User can edit nothing (we show a read-only preview to keep the
 *      approval path consistent) — just confirm & send.
 *   3. On send → `sendChangeOrderViaWhatsApp` handles the outbound
 *      call, stamps delivery metadata, and (if still internal) moves
 *      the CO to `pending_client`.
 */

import { useCallback, useEffect, useState } from 'react';
import { X, Send, Phone, AlertTriangle, Loader2, CheckCircle2, Copy, Eye } from 'lucide-react';
import {
  previewChangeOrderMessage,
  sendChangeOrderViaWhatsApp,
  type COMessagePreview,
  type SendResult,
} from '../services/changeOrderNotificationService';
import { getChangeOrder, getApprovalEvents } from '../services/changeOrderService';
import { getSalesOrder } from '../services/salesOrderService';
import { changeOrderPdfService } from '../services/changeOrderPdfGenerator';
import { getSubsidiaryBrandingLogoUrl } from '@/shared/services/branding.service';

interface Props {
  coId: string;
  userId: string;
  userName?: string;
  onClose: () => void;
  onSent?: (result: SendResult) => void;
}

export default function SendChangeOrderWhatsAppDialog({
  coId,
  userId,
  userName,
  onClose,
  onSent,
}: Props) {
  const [preview, setPreview] = useState<COMessagePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [previewingPdf, setPreviewingPdf] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPreviewError(null);
      try {
        const p = await previewChangeOrderMessage(coId, 'whatsapp', userId);
        if (!cancelled) setPreview(p);
      } catch (err) {
        if (!cancelled) setPreviewError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coId, userId]);

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      const result = await sendChangeOrderViaWhatsApp(coId, userId, userName);
      setSendResult(result);
      onSent?.(result);
    } finally {
      setSending(false);
    }
  }, [coId, userId, userName, onSent]);

  const handlePreviewPdf = useCallback(async () => {
    setPreviewingPdf(true);
    try {
      const [co, events] = await Promise.all([
        getChangeOrder(coId),
        getApprovalEvents(coId).catch(() => []),
      ]);
      if (!co) throw new Error('Change order not found');

      const so = await getSalesOrder(co.salesOrderId);
      if (!so) throw new Error('Parent sales order not found');

      let logoUrl: string | undefined;
      try {
        logoUrl = await getSubsidiaryBrandingLogoUrl(so.subsidiaryId);
      } catch {
        logoUrl = undefined;
      }

      const blob = await changeOrderPdfService.generateBlob({
        changeOrder: co,
        salesOrder: so,
        approvalEvents: events,
        generatedBy: userName || userId || undefined,
        company: {
          name: 'Dawin Finishes',
          ...(logoUrl ? { logoUrl } : {}),
          addressLine1: 'Kayondo Road, Kyambogo Upper Estate Ground Floor, Jordan House',
          addressLine2: 'Kampala, Uganda',
          website: 'dawinfinishes.com',
        },
      });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setPreviewError((err as Error).message || 'Could not generate preview PDF');
    } finally {
      setPreviewingPdf(false);
    }
  }, [coId, userId, userName]);

  const handleCopy = useCallback(() => {
    if (!preview?.portalUrl) return;
    void navigator.clipboard?.writeText(preview.portalUrl);
  }, [preview?.portalUrl]);

  const noPhone = preview && !preview.phoneNumber;
  const canSend = !loading && !sending && !!preview?.phoneNumber && !sendResult?.success;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Send change order via WhatsApp
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-md"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building preview…
            </div>
          )}

          {previewError && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{previewError}</span>
            </div>
          )}

          {preview && (
            <>
              {noPhone && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{preview.recipientName}</strong> has no phone number on
                    file. Add one to the customer record before sending via WhatsApp.
                  </span>
                </div>
              )}

              {/* Recipient */}
              <div className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase text-gray-500 font-semibold">
                      Recipient
                    </p>
                    <p className="font-medium text-gray-900">{preview.recipientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-500 font-semibold">
                      Phone
                    </p>
                    <p className="font-mono text-xs text-gray-800">
                      {preview.phoneNumber ?? 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message preview — styled like a WhatsApp chat bubble */}
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-semibold mb-1">
                  Message preview
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">Template Message Preview</p>
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                      {preview.templateName || 'change_order_submission'}
                    </span>
                  </div>
                  <div className="bg-[#e5f6df] p-3 m-2 rounded-lg text-sm space-y-1.5">
                    {/* Header preview */}
                    {preview.templateHeaderType === 'image' && preview.templateHeaderImageUrl ? (
                      <div className="-mx-3 -mt-3 mb-2">
                        <img
                          src={preview.templateHeaderImageUrl}
                          alt="Change order template header"
                          className="w-full h-28 object-cover rounded-t-lg"
                        />
                      </div>
                    ) : preview.templateHeaderType === 'image' ? (
                      <div className="-mx-3 -mt-3 mb-2 bg-gradient-to-r from-[#872E5C] to-[#E18425] h-28 rounded-t-lg flex items-center justify-center">
                        <p className="text-white font-bold text-lg tracking-wide">Dawin Finishes</p>
                      </div>
                    ) : preview.templateHeaderType === 'text' ? (
                      <p className="text-xs text-gray-500 font-medium">
                        {preview.templateParams?.changeOrderNumber || 'Change Order Update'}
                      </p>
                    ) : null}

                    <div>
                      <p>Hello {preview.templateParams?.customerName || preview.recipientName},</p>
                      <p className="mt-1">A change order is ready for your review.</p>
                      <p className="mt-1">
                        <strong>Change Order:</strong>{' '}
                        {preview.templateParams?.changeOrderNumber || '—'}
                      </p>
                      <p>
                        <strong>Title:</strong> {preview.templateParams?.changeOrderTitle || '—'}
                      </p>
                      <p>
                        <strong>Project Order:</strong>{' '}
                        {preview.templateParams?.salesOrderNumber || '—'}
                      </p>
                      <p>
                        <strong>Impact:</strong>{' '}
                        {preview.templateParams?.impactAmountAbs || '—'}{' '}
                        {preview.templateParams?.impactDirection || ''}
                      </p>
                      {preview.templateParams?.negotiatedAdjustmentNote && (
                        <p>
                          <strong>Negotiation note:</strong>{' '}
                          {preview.templateParams.negotiatedAdjustmentNote}
                        </p>
                      )}
                      <p>
                        <strong>New Order Total:</strong>{' '}
                        {preview.templateParams?.newOrderTotal || '—'}
                      </p>
                      <p className="text-blue-600 mt-1 text-xs break-all">
                        Please review and approve here: {preview.templateParams?.approvalUrl || preview.portalUrl}
                      </p>
                      <p className="mt-1 text-gray-600">
                        If anything needs clarification, reply to this message.
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-400">Dawin Finishes</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Sent using an approved WhatsApp template, followed by the
                  attached change-order PDF document.
                </p>
              </div>

              {/* Portal URL with copy button */}
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-semibold mb-1">
                  Approval link
                </p>
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
                  <input
                    readOnly
                    value={preview.portalUrl}
                    className="flex-1 bg-transparent text-[11px] text-gray-700 font-mono outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded hover:bg-gray-200 text-gray-500"
                    title="Copy link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <details className="rounded-md border border-gray-200 bg-gray-50">
                <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-semibold text-gray-700">
                  Raw Template Payload (debug)
                </summary>
                <div className="border-t border-gray-200 px-3 py-2">
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-700">
                    {JSON.stringify(
                      {
                        templateName: preview.templateName || 'change_order_submission',
                        headerType: preview.templateHeaderType ?? null,
                        headerImageUrl: preview.templateHeaderImageUrl ?? null,
                        params: preview.templateParams ?? null,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </details>

              {/* Send result */}
              {sendResult && (
                <div
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] ${
                    sendResult.success
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {sendResult.success ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    {sendResult.success ? (
                      <>
                        <strong>Message sent.</strong> The client will receive a
                        WhatsApp notification shortly.
                        {sendResult.waMessageId && (
                          <p className="text-[11px] text-emerald-700 mt-1 font-mono">
                            {sendResult.waMessageId}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>Send failed.</strong>
                        {sendResult.windowClosed && (
                          <p className="mt-1">
                            The 24-hour customer service window is closed. A
                            Meta-approved template is required to message this
                            client right now.
                          </p>
                        )}
                        {sendResult.error && <p className="mt-1">{sendResult.error}</p>}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-700">
                {sendResult?.pdfUrl
                  ? 'A branded change-order PDF was attached after the template message was sent.'
                  : 'A branded change-order PDF will be attached when storage permissions allow uploads.'}
                {sendResult?.pdfUrl && (
                  <div className="mt-1">
                    <a
                      href={sendResult.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-800 underline"
                    >
                      View attached PDF
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
          >
            {sendResult?.success ? 'Close' : 'Cancel'}
          </button>
          {!sendResult?.success && (
            <button
              type="button"
              onClick={handlePreviewPdf}
              disabled={loading || previewingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
            >
              {previewingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {previewingPdf ? 'Building PDF…' : 'Preview PDF'}
            </button>
          )}
          {!sendResult?.success && (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {sending ? 'Sending…' : 'Send via WhatsApp'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
