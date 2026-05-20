/**
 * Purchase Order Detail Component
 * View and manage a single purchase order with workflow actions
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  Send,
  Truck,
  Edit,
  MoreVertical,
  Printer,
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';

type POStatus = 
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent_to_supplier'
  | 'acknowledged'
  | 'partially_delivered'
  | 'completed'
  | 'cancelled';

interface POItem {
  id: string;
  description: string;
  specifications?: string;
  quantity: number;
  unit: string;
  unitRate: number;
  discountPercentage?: number;
  taxPercentage?: number;
  totalAmount: number;
  quantityReceived: number;
}

interface PurchaseOrder {
  id: string;
  number: string;
  description: string;
  status: POStatus;
  supplier: {
    id: string;
    name: string;
    code: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
  };
  items: POItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  deliveryAddress?: {
    street: string;
    city: string;
    region: string;
  };
  expectedDeliveryDate?: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  history?: Array<{
    action: string;
    timestamp: string;
    user: { name: string };
  }>;
}

const STATUS_STEPS = ['draft', 'pending_approval', 'approved', 'sent_to_supplier', 'acknowledged', 'partially_delivered', 'completed'];

const STATUS_COLORS: Record<POStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  sent_to_supplier: 'bg-purple-100 text-purple-700',
  acknowledged: 'bg-indigo-100 text-indigo-700',
  partially_delivered: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PODetail: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, poId } = useParams<{ projectId: string; poId: string }>();

  // Placeholder data - will connect to hooks
  const po: PurchaseOrder = {
    id: poId || '1',
    number: 'PO-2024-0032',
    description: 'Construction materials for foundation works',
    status: 'approved',
    supplier: {
      id: 's1',
      name: 'Hima Cement Ltd',
      code: 'SUP-001',
      contactPerson: 'John Mukasa',
      phone: '+256 772 123 456',
      email: 'sales@himacement.co.ug',
    },
    items: [
      { id: '1', description: 'Portland Cement 50kg bags', quantity: 500, unit: 'bags', unitRate: 42000, totalAmount: 21000000, quantityReceived: 0 },
      { id: '2', description: 'River Sand', quantity: 100, unit: 'm³', unitRate: 85000, totalAmount: 8500000, quantityReceived: 0 },
      { id: '3', description: 'Crushed Stone 20mm', quantity: 80, unit: 'm³', unitRate: 120000, totalAmount: 9600000, quantityReceived: 0 },
    ],
    subtotal: 39100000,
    totalDiscount: 1955000,
    totalTax: 5572500,
    grandTotal: 42717500,
    deliveryAddress: {
      street: 'Plot 45, Industrial Area',
      city: 'Kampala',
      region: 'Central',
    },
    expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: { id: 'u1', name: 'Sarah Nambi' },
    history: [
      { action: 'Created', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), user: { name: 'Sarah Nambi' } },
      { action: 'Submitted for approval', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), user: { name: 'Sarah Nambi' } },
      { action: 'Approved', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), user: { name: 'James Okello' } },
    ],
  };

  const loading = false;
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [sendMethod, setSendMethod] = useState<'email' | 'whatsapp' | 'manual'>('email');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepIndex = STATUS_STEPS.indexOf(po.status);

  // Action handlers
  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Will connect to service
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setShowRejectDialog(false);
      setRejectReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToSupplier = async () => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setShowSendDialog(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordDelivery = () => {
    navigate(`/advisory/matflow/${projectId}/deliveries/record?poId=${poId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{po.number}</h1>
              <span className={cn('px-3 py-1 text-sm font-medium rounded-full', STATUS_COLORS[po.status])}>
                {po.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600">{po.description}</p>
            <p className="text-sm text-gray-500 mt-1">
              Created: {formatDateTime(po.createdAt)} by {po.createdBy.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Status-based actions */}
            {po.status === 'pending_approval' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </>
            )}

            {po.status === 'approved' && (
              <button
                onClick={() => setShowSendDialog(true)}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send to Supplier
              </button>
            )}

            {(po.status === 'acknowledged' || po.status === 'partially_delivered') && (
              <button
                onClick={handleRecordDelivery}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Truck className="w-4 h-4" />
                Record Delivery
              </button>
            )}

            {/* More actions */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                      <Printer className="w-4 h-4" /> Print
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                    {po.status === 'draft' && (
                      <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                        <Edit className="w-4 h-4" /> Edit
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Stepper */}
        <div className="mt-6 overflow-x-auto">
          <div className="flex items-center min-w-max">
            {STATUS_STEPS.filter(s => s !== 'cancelled').map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                        isCompleted && 'bg-green-600 text-white',
                        isCurrent && 'bg-blue-600 text-white',
                        !isCompleted && !isCurrent && 'bg-gray-200 text-gray-500'
                      )}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    <span className={cn(
                      'text-xs mt-1 whitespace-nowrap',
                      isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'
                    )}>
                      {step.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {index < STATUS_STEPS.length - 2 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2 min-w-[40px]',
                        index < currentStepIndex ? 'bg-green-600' : 'bg-gray-200'
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Supplier Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">{po.supplier.name}</p>
                  <p className="text-sm text-gray-500">{po.supplier.code}</p>
                </div>
              </div>
              {po.supplier.contactPerson && (
                <div>
                  <p className="text-sm text-gray-500">Contact Person</p>
                  <p className="font-medium">{po.supplier.contactPerson}</p>
                </div>
              )}
              {po.supplier.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{po.supplier.phone}</span>
                </div>
              )}
              {po.supplier.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{po.supplier.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* PO Items */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Order Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">#</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Qty</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Rate</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Total</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {po.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{item.description}</p>
                        {item.specifications && (
                          <p className="text-xs text-gray-500">{item.specifications}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(item.unitRate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatCurrency(item.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.quantityReceived > 0 ? (
                          <span className={cn(
                            'px-2 py-1 text-xs rounded-full',
                            item.quantityReceived >= item.quantity
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          )}>
                            {item.quantityReceived}/{item.quantity}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-sm text-right">Subtotal:</td>
                    <td className="px-4 py-2 text-sm text-right">{formatCurrency(po.subtotal)}</td>
                    <td />
                  </tr>
                  {po.totalDiscount > 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-sm text-right">Discount:</td>
                      <td className="px-4 py-2 text-sm text-right text-green-600">-{formatCurrency(po.totalDiscount)}</td>
                      <td />
                    </tr>
                  )}
                  {po.totalTax > 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-sm text-right">Tax:</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(po.totalTax)}</td>
                      <td />
                    </tr>
                  )}
                  <tr className="border-t border-gray-200">
                    <td colSpan={4} className="px-4 py-3 text-right font-semibold">Grand Total:</td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-blue-600">{formatCurrency(po.grandTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Delivery Info */}
          {po.deliveryAddress && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Delivery Address</p>
                    <p>{po.deliveryAddress.street}</p>
                    <p className="text-sm text-gray-600">{po.deliveryAddress.city}, {po.deliveryAddress.region}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Expected Delivery</p>
                    <p>{po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Items:</span>
                <span>{po.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal:</span>
                <span>{formatCurrency(po.subtotal)}</span>
              </div>
              {po.totalDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Discount:</span>
                  <span className="text-green-600">-{formatCurrency(po.totalDiscount)}</span>
                </div>
              )}
              {po.totalTax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax:</span>
                  <span>{formatCurrency(po.totalTax)}</span>
                </div>
              )}
              <hr className="border-gray-200" />
              <div className="flex justify-between">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-blue-600">{formatCurrency(po.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Activity</h2>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-4">
                {po.history?.map((event, index) => (
                  <div key={index} className="relative flex gap-4 pl-8">
                    <div className="absolute left-0 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium">{event.action}</p>
                      <p className="text-xs text-gray-500">{event.user.name}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(event.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRejectDialog(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Reject Purchase Order</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRejectDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || isSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Supplier Dialog */}
      {showSendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSendDialog(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Send to Supplier</h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose how to send this purchase order to the supplier:
            </p>
            <div className="flex gap-2 mb-4">
              {(['email', 'whatsapp', 'manual'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setSendMethod(method)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                    sendMethod === method
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  )}
                >
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSendDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSendToSupplier}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PODetail;
