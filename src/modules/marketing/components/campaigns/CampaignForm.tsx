/**
 * CampaignForm Component
 * Multi-step form for creating and editing marketing campaigns
 */

import { useState, useEffect } from 'react';
import { X, ArrowLeft, ArrowRight, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { campaignFormSchema } from '../../schemas';
import { createCampaign, updateCampaign } from '../../services/campaignService';
import { AudienceSelector } from './AudienceSelector';
import { WhatsAppCampaignConfig } from './WhatsAppCampaignConfig';
import type { MarketingCampaign, CampaignType, CampaignStatus, AudienceSegment, WhatsAppCampaignConfig as WhatsAppConfigType } from '../../types';

interface CampaignFormProps {
  campaign?: MarketingCampaign;
  onClose: () => void;
  onSuccess?: (campaignId: string) => void;
}

interface FormData {
  name: string;
  description: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  scheduledStartDate: string;
  scheduledEndDate: string;
  targetAudience: AudienceSegment;
  estimatedReach: number;
  whatsappConfig?: WhatsAppConfigType;
  budget?: number;
  goals: Array<{ type: string; name: string; targetValue: number; unit: string }>;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  description: '',
  campaignType: 'whatsapp',
  status: 'draft',
  scheduledStartDate: '',
  scheduledEndDate: '',
  targetAudience: {
    segmentType: 'all',
    estimatedSize: 0,
  },
  estimatedReach: 0,
  goals: [],
};

const STEPS = [
  { id: 'basics', label: 'Campaign Basics' },
  { id: 'audience', label: 'Target Audience' },
  { id: 'config', label: 'Campaign Configuration' },
  { id: 'goals', label: 'Goals & Budget' },
];

export function CampaignForm({ campaign, onClose, onSuccess }: CampaignFormProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const isEditing = !!campaign;

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        campaignType: campaign.campaignType,
        status: campaign.status,
        scheduledStartDate: campaign.scheduledStartDate?.toDate().toISOString().slice(0, 16) || '',
        scheduledEndDate: campaign.scheduledEndDate?.toDate().toISOString().slice(0, 16) || '',
        targetAudience: campaign.targetAudience,
        estimatedReach: campaign.estimatedReach,
        whatsappConfig: campaign.whatsappConfig,
        budget: campaign.budget,
        goals: campaign.goals || [],
      });
    }
  }, [campaign]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      // Basics validation
      if (!formData.name.trim()) {
        newErrors.name = 'Campaign name is required';
      }
      if (!formData.campaignType) {
        newErrors.campaignType = 'Campaign type is required';
      }
    } else if (step === 1) {
      // Audience validation
      if (formData.estimatedReach === 0) {
        newErrors.audience = 'Please select a valid audience';
      }
    } else if (step === 2) {
      // Config validation
      if (
        (formData.campaignType === 'whatsapp' || formData.campaignType === 'hybrid') &&
        (!formData.whatsappConfig || !formData.whatsappConfig.templateId)
      ) {
        newErrors.whatsappConfig = 'WhatsApp template is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStep) || !user?.email || !user?.companyId) return;

    // Validate entire form with Zod
    const result = campaignFormSchema.safeParse({
      ...formData,
      scheduledStartDate: formData.scheduledStartDate ? new Date(formData.scheduledStartDate) : undefined,
      scheduledEndDate: formData.scheduledEndDate ? new Date(formData.scheduledEndDate) : undefined,
    });

    if (!result.success) {
      const zodErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        zodErrors[String(err.path[0])] = err.message;
      });
      setErrors(zodErrors);
      return;
    }

    setLoading(true);
    try {
      const campaignData = {
        ...formData,
        companyId: user.companyId,
        scheduledStartDate: formData.scheduledStartDate ? new Date(formData.scheduledStartDate) : null,
        scheduledEndDate: formData.scheduledEndDate ? new Date(formData.scheduledEndDate) : null,
        createdBy: user.email,
      };

      let campaignId: string;
      if (isEditing && campaign) {
        await updateCampaign(campaign.id, campaignData as any);
        campaignId = campaign.id;
      } else {
        campaignId = await createCampaign(
          user.companyId,
          campaignData as any,
          user.email,
          user.displayName || 'Unknown'
        );
      }

      onSuccess?.(campaignId);
      onClose();
    } catch (error) {
      console.error('Failed to save campaign:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save campaign' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Edit Campaign' : 'Create New Campaign'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index === currentStep
                    ? 'bg-primary text-white'
                    : index < currentStep
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`ml-2 text-sm ${
                  index === currentStep ? 'text-gray-900 font-medium' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className="w-12 h-0.5 bg-gray-200 mx-4" />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g., Summer Sale 2024"
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Describe the campaign purpose and goals..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Type *
                </label>
                <select
                  value={formData.campaignType}
                  onChange={(e) => setFormData({ ...formData, campaignType: e.target.value as CampaignType })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="whatsapp">WhatsApp Campaign</option>
                  <option value="social_media">Social Media Campaign</option>
                  <option value="product_promotion">Product Promotion</option>
                  <option value="hybrid">Hybrid Campaign</option>
                </select>
                {errors.campaignType && <p className="text-xs text-red-600 mt-1">{errors.campaignType}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledStartDate}
                    onChange={(e) => setFormData({ ...formData, scheduledStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledEndDate}
                    onChange={(e) => setFormData({ ...formData, scheduledEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && user?.companyId && (
            <AudienceSelector
              companyId={user.companyId}
              value={formData.targetAudience}
              onChange={(audience) => setFormData({ ...formData, targetAudience: audience })}
              onEstimateUpdate={(estimate) => setFormData({ ...formData, estimatedReach: estimate })}
            />
          )}

          {currentStep === 2 && (
            <div>
              {(formData.campaignType === 'whatsapp' || formData.campaignType === 'hybrid') && (
                <WhatsAppCampaignConfig
                  value={formData.whatsappConfig}
                  onChange={(config) => setFormData({ ...formData, whatsappConfig: config })}
                />
              )}
              {errors.whatsappConfig && (
                <p className="text-sm text-red-600 mt-2">{errors.whatsappConfig}</p>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget (Optional)
                </label>
                <input
                  type="number"
                  value={formData.budget || ''}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Goals (Optional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Define measurable goals for your campaign
                </p>
                {/* Goal management UI would go here - simplified for MVP */}
                <div className="text-sm text-gray-500 italic">
                  Goals configuration will be enhanced in the next phase
                </div>
              </div>
            </div>
          )}

          {errors.submit && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {errors.submit}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0 || loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {isEditing ? 'Update Campaign' : 'Create Campaign'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignForm;
