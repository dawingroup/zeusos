/**
 * OrderUpdateDialog - Send order status updates via WhatsApp template
 */

import { useState } from 'react';
import { X, Package, Send, Loader2 } from 'lucide-react';
import { useWhatsAppTemplates } from '../hooks';
import { sendWhatsAppMessage } from '../services/whatsappApiService';
import { logWhatsAppActivity } from '../services/crmIntegrationService';
import { TemplatePreview } from './TemplatePreview';
import type { WhatsAppTemplate } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  phoneNumber: string;
  conversationId?: string;
  dealId?: string;
  dealTitle?: string;
  customerName?: string;
}

const UPDATE_TYPES = [
  { value: 'confirmation', label: 'Order Confirmation' },
  { value: 'shipping', label: 'Shipping Update' },
  { value: 'delivery', label: 'Delivery Notification' },
  { value: 'status_change', label: 'Status Change' },
  { value: 'custom', label: 'Custom Update' },
];

export function OrderUpdateDialog({
  open,
  onClose,
  phoneNumber,
  conversationId,
  dealId,
  dealTitle,
  customerName,
}: Props) {
  const { templates } = useWhatsAppTemplates();
  const [updateType, setUpdateType] = useState('confirmation');
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    const initialParams: Record<string, string> = {};
    for (let i = 1; i <= template.parameterCount; i++) {
      // Pre-fill with known values
      if (i === 1 && customerName) {
        initialParams[String(i)] = customerName;
      } else if (i === 2 && dealTitle) {
        initialParams[String(i)] = dealTitle;
      } else {
        initialParams[String(i)] = '';
      }
    }
    setParams(initialParams);
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    setError(null);

    try {
      await sendWhatsAppMessage({
        conversationId,
        phoneNumber,
        messageType: 'template',
        templateId: selectedTemplate.metaTemplateName || selectedTemplate.name,
        templateName: selectedTemplate.name,
        templateParams: params,
      });

      if (dealId) {
        await logWhatsAppActivity(dealId, 'order_update', {
          phoneNumber,
          updateType,
          templateName: selectedTemplate.name,
          dealTitle,
        });
      }

      onClose();
      setSelectedTemplate(null);
      setParams({});
    } catch (err: any) {
      setError(err.message || 'Failed to send update');
    } finally {
      setSending(false);
    }
  };

  const allParamsFilled = selectedTemplate
    ? selectedTemplate.parameterCount === 0 ||
      Array.from({ length: selectedTemplate.parameterCount }, (_, i) => String(i + 1)).every(
        (key) => params[key]?.trim()
      )
    : false;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            Send Order Update
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-gray-500">
            Send an order update to <span className="font-medium">{phoneNumber}</span>
            {dealTitle && <> for <span className="font-medium">{dealTitle}</span></>}
          </p>

          {/* Update Type */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Update Type</label>
            <select
              value={updateType}
              onChange={(e) => setUpdateType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {UPDATE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Select Template</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No approved templates. Sync templates first.
                </p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left p-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors ${
                      selectedTemplate?.id === template.id ? 'border-green-500 bg-green-50' : ''
                    }`}
                  >
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">{template.bodyText}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Parameters */}
          {selectedTemplate && selectedTemplate.parameterCount > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Fill template parameters:</p>
              {Array.from({ length: selectedTemplate.parameterCount }, (_, i) => (
                <div key={i}>
                  <label className="block text-xs text-gray-400 mb-0.5">
                    Parameter {'{{'}{i + 1}{'}}'}
                  </label>
                  <input
                    type="text"
                    value={params[String(i + 1)] || ''}
                    onChange={(e) =>
                      setParams((prev) => ({ ...prev, [String(i + 1)]: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {selectedTemplate && (
            <TemplatePreview template={selectedTemplate} params={params} />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !selectedTemplate || !allParamsFilled}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Update
          </button>
        </div>
      </div>
    </div>
  );
}
