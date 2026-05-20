/**
 * CreateBroadcastDialog - Multi-step wizard for creating WhatsApp broadcasts
 * Step 1: Select template
 * Step 2: Define audience (manual phone numbers)
 * Step 3: Fill template parameters
 * Step 4: Review & send/schedule
 */

import { useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Send, Loader2, Plus, Trash2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { auth } from '@/shared/services/firebase/auth';
import { useWhatsAppTemplates } from '../hooks';
import { TemplatePreview } from './TemplatePreview';
import type { WhatsAppTemplate } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function CreateBroadcastDialog({ open, onClose }: Props) {
  const { templates } = useWhatsAppTemplates();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);

  // Step 2: Audience
  const [name, setName] = useState('');
  const [phones, setPhones] = useState<string[]>(['']);

  // Step 3: Parameters
  const [params, setParams] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setStep(1);
    setSelectedTemplate(null);
    setName('');
    setPhones(['']);
    setParams({});
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    const initialParams: Record<string, string> = {};
    for (let i = 1; i <= template.parameterCount; i++) {
      initialParams[String(i)] = '';
    }
    setParams(initialParams);
  };

  const addPhoneField = () => setPhones((prev) => [...prev, '']);
  const removePhoneField = (idx: number) => setPhones((prev) => prev.filter((_, i) => i !== idx));
  const updatePhone = (idx: number, value: string) =>
    setPhones((prev) => prev.map((p, i) => (i === idx ? value : p)));

  const validPhones = phones.filter((p) => p.trim().length >= 10);
  const allParamsFilled = selectedTemplate
    ? selectedTemplate.parameterCount === 0 ||
      Array.from({ length: selectedTemplate.parameterCount }, (_, i) => String(i + 1)).every(
        (key) => params[key]?.trim()
      )
    : false;

  const handleCreate = async () => {
    if (!selectedTemplate || !name.trim() || validPhones.length === 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'whatsappBroadcasts'), {
        name: name.trim(),
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language,
        parameters: params,
        audience: {
          type: 'manual',
          phones: validPhones,
          totalCount: validPhones.length,
        },
        status: 'draft',
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
        createdBy: auth.currentUser?.uid || '',
        createdByName: auth.currentUser?.displayName || auth.currentUser?.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      handleClose();
    } catch (err) {
      console.error('Failed to create broadcast:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">
            New Broadcast — Step {step} of 4
          </h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Select a template to send:</p>
              {templates.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No approved templates. Sync templates from the Templates tab first.
                </p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                      selectedTemplate?.id === template.id ? 'border-green-500 bg-green-50' : ''
                    }`}
                  >
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.bodyText}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{template.language}</span>
                      <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{template.category}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Broadcast Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. January Sale Announcement"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Recipient Phone Numbers ({validPhones.length} valid)
                </label>
                <div className="space-y-2">
                  {phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => updatePhone(idx, e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="+256 XXX XXXXXXX"
                      />
                      {phones.length > 1 && (
                        <button
                          onClick={() => removePhoneField(idx)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addPhoneField}
                  className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add number
                </button>
              </div>
            </div>
          )}

          {step === 3 && selectedTemplate && (
            <div className="space-y-4">
              {selectedTemplate.parameterCount === 0 ? (
                <p className="text-sm text-gray-600">
                  This template has no parameters. Continue to review.
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">Fill in the template parameters:</p>
                  {Array.from({ length: selectedTemplate.parameterCount }, (_, i) => (
                    <div key={i}>
                      <label className="block text-xs text-gray-500 mb-1">
                        Parameter {'{{'}{i + 1}{'}}'}
                      </label>
                      <input
                        type="text"
                        value={params[String(i + 1)] || ''}
                        onChange={(e) =>
                          setParams((prev) => ({ ...prev, [String(i + 1)]: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder={`Value for parameter ${i + 1}`}
                      />
                    </div>
                  ))}
                </>
              )}
              <TemplatePreview template={selectedTemplate} params={params} />
            </div>
          )}

          {step === 4 && selectedTemplate && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Review Broadcast</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">{name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Template</span>
                  <span className="font-medium">{selectedTemplate.name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Recipients</span>
                  <span className="font-medium">{validPhones.length}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Language</span>
                  <span>{selectedTemplate.language}</span>
                </div>
              </div>
              <TemplatePreview template={selectedTemplate} params={params} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-between">
          <button
            onClick={step === 1 ? handleClose : () => setStep((s) => (s - 1) as Step)}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {step === 1 ? 'Cancel' : <><ChevronLeft className="w-4 h-4" /> Back</>}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={
                (step === 1 && !selectedTemplate) ||
                (step === 2 && (!name.trim() || validPhones.length === 0)) ||
                (step === 3 && !allParamsFilled)
              }
              className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Create Broadcast
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
