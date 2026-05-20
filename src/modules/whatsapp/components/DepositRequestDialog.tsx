/**
 * DepositRequestDialog
 * Sends deposit request message via WhatsApp to customer.
 * Includes order details, deposit amount, and payment instructions.
 */

import { useState, useEffect } from 'react';
import { X, Send, Loader2, Phone, Banknote } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { sendWhatsAppMessage } from '../services/whatsappApiService';
import { logWhatsAppActivity } from '../services/crmIntegrationService';
import type { PaymentTerms } from '@/modules/sales-orders/types';

export interface DepositRequestDialogProps {
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

export function DepositRequestDialog({
  open,
  onClose,
  phoneNumber,
  customerId,
  customerName,
  dealId,
  dealTitle,
  salesOrder,
}: DepositRequestDialogProps) {
  const [manualPhone, setManualPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<string>('');

  const resolvedPhone = phoneNumber || customerPhone || manualPhone.trim();

  const depositPercent = salesOrder.paymentTerms?.depositPercent ?? 50;
  const depositAmount = salesOrder.paymentTerms?.depositAmount
    ?? Math.round(salesOrder.currentAmount * (depositPercent / 100));

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

  // Fetch payment/bank details from org settings
  useEffect(() => {
    if (!open) return;
    setError(null);
    setManualPhone('');

    (async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'organizations/default/settings', 'general'));
        if (settingsSnap.exists()) {
          const payment = settingsSnap.data()?.paymentInfo;
          if (payment) {
            const lines = [];
            if (payment.bankName) lines.push(`🏦 *Bank:* ${payment.bankName}`);
            if (payment.accountName) lines.push(`👤 *Account Name:* ${payment.accountName}`);
            if (payment.accountNumber) lines.push(`🔢 *Account Number:* ${payment.accountNumber}`);
            if (payment.swiftCode) lines.push(`🌐 *SWIFT:* ${payment.swiftCode}`);
            if (payment.mobileMoney) lines.push(`📱 *Mobile Money:* ${payment.mobileMoney}`);
            setBankDetails(lines.join('\n'));
          }
        }
      } catch {
        // Proceed without bank details
      }
    })();
  }, [open]);

  const paymentSection = bankDetails
    ? `\n\n*Payment Details:*\n${bankDetails}\n\n📝 *Reference:* ${salesOrder.orderNumber}`
    : `\n\n📝 Please use *${salesOrder.orderNumber}* as payment reference.\nContact us for bank or mobile money details.`;

  const messageText = `Hello ${customerName},

This is a reminder regarding the deposit payment for your order.

📦 *Order:* ${salesOrder.orderNumber}
💵 *Total Amount:* ${formatCurrency(salesOrder.currentAmount, salesOrder.currency)}
💰 *Deposit Due:* ${formatCurrency(depositAmount, salesOrder.currency)} (${depositPercent}%)${paymentSection}

Once we receive your deposit, we will begin processing your order right away.

Thank you! 🙏
Dawin Finishes`;

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
        logWhatsAppActivity(dealId, 'deposit_request_sent', {
          phoneNumber: resolvedPhone,
          orderNumber: salesOrder.orderNumber,
          depositAmount,
          depositPercent,
          currency: salesOrder.currency,
          ...(dealTitle ? { dealTitle } : {}),
        }).catch((err) => console.warn('CRM activity log failed:', err));
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send deposit request');
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
            <Banknote className="w-5 h-5 text-emerald-600" />
            Request Deposit Payment
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

          {/* Deposit summary */}
          <div className="bg-emerald-50 rounded-lg p-3 text-sm space-y-1 border border-emerald-200">
            <p><span className="text-gray-600">Order:</span> <span className="font-semibold">{salesOrder.orderNumber}</span></p>
            <p><span className="text-gray-600">Total:</span> <span className="font-semibold">{formatCurrency(salesOrder.currentAmount, salesOrder.currency)}</span></p>
            <p className="text-emerald-800 font-bold">
              Deposit: {formatCurrency(depositAmount, salesOrder.currency)} ({depositPercent}%)
            </p>
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
            Send Deposit Request
          </button>
        </div>
      </div>
    </div>
  );
}
