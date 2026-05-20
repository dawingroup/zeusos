/**
 * WhatsAppCampaignConfig Component
 * Configuration UI for WhatsApp campaigns
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Zap, Clock, AlertCircle } from 'lucide-react';
import type { WhatsAppCampaignConfig } from '../../types';
import { DEFAULT_THROTTLE_CONFIG } from '../../constants';

interface WhatsAppCampaignConfigProps {
  value: WhatsAppCampaignConfig | undefined;
  onChange: (config: WhatsAppCampaignConfig) => void;
}

// Mock templates - in real implementation, fetch from whatsappTemplates collection
const MOCK_TEMPLATES = [
  {
    id: 'template_1',
    name: 'product_launch',
    displayName: 'Product Launch',
    placeholders: ['customer_name', 'product_name', 'launch_date'],
  },
  {
    id: 'template_2',
    name: 'special_offer',
    displayName: 'Special Offer',
    placeholders: ['customer_name', 'discount_amount', 'expiry_date'],
  },
  {
    id: 'template_3',
    name: 'event_invitation',
    displayName: 'Event Invitation',
    placeholders: ['customer_name', 'event_name', 'event_date', 'event_location'],
  },
];

export function WhatsAppCampaignConfig({ value, onChange }: WhatsAppCampaignConfigProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(
    MOCK_TEMPLATES.find(t => t.id === value?.templateId)
  );

  useEffect(() => {
    if (!value) {
      // Initialize with defaults
      onChange({
        templateId: '',
        templateName: '',
        usePersonalization: true,
        sendRate: 'throttled',
        throttleConfig: DEFAULT_THROTTLE_CONFIG,
      });
    }
  }, []);

  const handleTemplateChange = (templateId: string) => {
    const template = MOCK_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      onChange({
        ...value!,
        templateId: template.id,
        templateName: template.name,
        templateParams: {},
      });
    }
  };

  const handleParamChange = (paramKey: string, paramValue: string) => {
    onChange({
      ...value!,
      templateParams: {
        ...value?.templateParams,
        [paramKey]: paramValue,
      },
    });
  };

  const handleSendRateChange = (sendRate: 'immediate' | 'throttled') => {
    onChange({
      ...value!,
      sendRate,
      throttleConfig: sendRate === 'throttled'
        ? (value?.throttleConfig || DEFAULT_THROTTLE_CONFIG)
        : undefined,
    });
  };

  const handleThrottleChange = (messagesPerMinute: number) => {
    onChange({
      ...value!,
      throttleConfig: {
        messagesPerMinute,
        messagesPerHour: messagesPerMinute * 60,
      },
    });
  };

  if (!value) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          WhatsApp Template
        </label>
        <select
          value={value.templateId}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          required
        >
          <option value="">Select a template...</option>
          {MOCK_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.displayName}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Templates must be pre-approved by WhatsApp. Contact your administrator to add new templates.
        </p>
      </div>

      {/* Template Parameters */}
      {selectedTemplate && selectedTemplate.placeholders.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Template Parameters</h4>
          <p className="text-xs text-gray-500">
            These values will be personalized for each customer. Use customer fields like name, phone, etc.
          </p>
          {selectedTemplate.placeholders.map((placeholder) => (
            <div key={placeholder}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {placeholder.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </label>
              <input
                type="text"
                value={value.templateParams?.[placeholder] || ''}
                onChange={(e) => handleParamChange(placeholder, e.target.value)}
                placeholder={`Enter ${placeholder.replace('_', ' ')}`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          ))}
        </div>
      )}

      {/* Send Rate */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Send Rate
        </label>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="sendRate"
              value="immediate"
              checked={value.sendRate === 'immediate'}
              onChange={() => handleSendRateChange('immediate')}
              className="mt-1 text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-900">Immediate</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Send all messages as fast as possible. Use for small audiences (&lt;100 customers).
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="sendRate"
              value="throttled"
              checked={value.sendRate === 'throttled'}
              onChange={() => handleSendRateChange('throttled')}
              className="mt-1 text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">Throttled (Recommended)</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Send messages at a controlled rate to avoid WhatsApp limits and improve deliverability.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Throttle Configuration */}
      {value.sendRate === 'throttled' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 mb-1">Throttle Settings</h4>
              <p className="text-xs text-blue-700 mb-3">
                Control how many messages are sent per minute to stay within WhatsApp's rate limits.
              </p>

              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Messages per Minute: {value.throttleConfig?.messagesPerMinute || DEFAULT_THROTTLE_CONFIG.messagesPerMinute}
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={value.throttleConfig?.messagesPerMinute || DEFAULT_THROTTLE_CONFIG.messagesPerMinute}
                  onChange={(e) => handleThrottleChange(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-blue-700 mt-1">
                  <span>5/min (Slowest)</span>
                  <span>60/min (Fastest)</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-blue-700">
                <div>Estimated time for 1000 messages: ~{Math.ceil(1000 / (value.throttleConfig?.messagesPerMinute || DEFAULT_THROTTLE_CONFIG.messagesPerMinute))} minutes</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Limits Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">WhatsApp Messaging Guidelines</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Only send messages to customers who have opted in</li>
              <li>Use approved templates with proper parameters</li>
              <li>Respect WhatsApp's 24-hour messaging window</li>
              <li>Monitor delivery rates and adjust send rate if needed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppCampaignConfig;
