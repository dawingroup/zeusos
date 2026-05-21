/**
 * OrderConfirmationDialog
 * Sends order confirmation message via WhatsApp to customer.
 * Composes a text message with order details including order number, amount, and payment terms.
 */

import { useState, useEffect } from 'react';
import { X, Send, Loader2, Phone, CheckCircle2 } from 'lucide-react';
import { sendWhatsAppMessage } from '../services/whatsappApiService';
import { logWhatsAppActivity } from '../services/crmIntegrationService';
import type { PaymentTerms } from '@/modules/sales-orders/types';

export interface OrderConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: string;
  customerId: string;
  customerName: string;
  dealId?: string;
  dealTitle?: string;
  salesOrder: {
    id: string;
    orderNumber: string;
    currentAmount: number;
    currency: string;
    paymentTerms?: PaymentTerms;
  };
}

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export function OrderConfirmationDialog({
  open,
  onClose,
  phoneNumber,
  customerId,
  customerName,
  dealId,
  dealTitle,
  salesOrder,
}: OrderConfirmationDialogProps) {
  const [manualPhone, setManualPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedPhone = phoneNumber || customerPhone || manualPhone.trim();

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

  // Reset state on open
  useEffect(() => {
    if (open) {
      setError(null);
      setManualPhone('');
    }
  }, [open]);

  const depositInfo = salesOrder.paymentTerms?.depositRequired
    ? `\n\n💰 *Deposit Required:* ${salesOrder.paymentTerms.depositPercent ?? 50}% (${formatCurrency(salesOrder.paymentTerms.depositAmount ?? Math.round(salesOrder.currentAmount * ((salesOrder.paymentTerms.depositPercent ?? 50) / 100)), salesOrder.currency)})`
    : '';

  const milestoneInfo = salesOrder.paymentTerms?.milestonePayments?.length
    ? '\n\n📋 *Payment Schedule:*\n' + salesOrder.paymentTerms.milestonePayments
        .map((m: { label: string; percentage: number }) => `  • ${m.label}: ${m.percentage}%`)
        .join('\n')
    : '';

  const messageText = `Hello ${customerName},

Thank you for your order! We're pleased to confirm the following:

📦 *Order Number:* ${salesOrder.orderNumber}
💵 *Total Amount:* ${formatCurrency(salesOrder.currentAmount, salesOrder.currency)}${depositInfo}${milestoneInfo}

We will keep you updated on the progress of your order. If you have any questions, please don't hesitate to reach out.

Thank you for choosing Zeus Group! 🙏`;

  const handleSend = async () => {
    if (!resolvedPhone) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendWhatsAppMessage({
        customerId,
        customerName,
        phoneNumber: resolvedPhone,
        messageType: 'text',
        text: messageText,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      if (dealId) {
        logWhatsAppActivity(dealId, 'order_confirmation_sent', {
          phoneNumber: resolvedPhone,
          orderNumber: salesOrder.orderNumber,
          orderAmount: salesOrder.currentAmount,
          currency: salesOrder.currency,
          ...(dealTitle ? { dealTitle } : {}),
        }).catch((err) => console.warn('CRM activity log failed:', err));
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send order confirmation');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Send Order Confirmation
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
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
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="+256 7XX XXX XXX"
              />
            </div>
          )}

          {/* Order summary */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-gray-500">Order:</span> <span className="font-semibold">{salesOrder.orderNumber}</span></p>
            <p><span className="text-gray-500">Amount:</span> <span className="font-semibold">{formatCurrency(salesOrder.currentAmount, salesOrder.currency)}</span></p>
            <p><span className="text-gray-500">Customer:</span> <span className="font-medium">{customerName}</span></p>
          </div>

          {/* Message preview */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b">
              <p className="text-xs font-medium text-gray-500">Message Preview</p>
            </div>
            <div className="bg-[#e5f6df] p-3 m-2 rounded-lg text-sm whitespace-pre-wrap">
              {messageText}
            </div>
          </div>

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
            disabled={sending || !resolvedPhone}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Confirmation
          </button>
        </div>
      </div>
    </div>
  );
}
