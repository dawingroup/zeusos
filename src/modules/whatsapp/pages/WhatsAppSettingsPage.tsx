/**
 * WhatsAppSettingsPage - Module settings and configuration
 * Shows provider status, allowed roles, migration state,
 * and template header image management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Phone,
  Shield,
  RefreshCw,
  ImageIcon,
  Upload,
  Trash2,
  X,
  Send,
  FileText,
} from 'lucide-react';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { uploadFile, deleteFile } from '@/shared/services/firebase/storage';
import type { WhatsAppConfig } from '../types';

const AVAILABLE_ROLES = [
  'owner',
  'admin',
  'manager',
  'design-manager',
  'client-liaison',
  'member',
];

const TEMPLATE_IMAGE_SLOTS = [
  { key: 'quoteSubmission', label: 'Quote Submission', description: 'Shown when sending quotes to clients' },
  { key: 'changeOrderSubmission', label: 'Change Order Submission', description: 'Shown when sending change-order approval requests' },
  { key: 'orderConfirmation', label: 'Order Confirmation', description: 'Shown when confirming a sales order' },
  { key: 'depositRequest', label: 'Deposit Payment Request', description: 'Shown when requesting deposit payment from clients' },
  { key: 'orderUpdate', label: 'Order Update', description: 'Shown for order status notifications' },
  { key: 'paymentReceipt', label: 'Payment Receipt', description: 'Shown when sharing payment receipts with clients' },
  { key: 'welcome', label: 'Welcome', description: 'Shown for welcome/greeting messages' },
  { key: 'default', label: 'Default', description: 'Fallback used when no specific image is set' },
] as const;

type TemplateImageKey = (typeof TEMPLATE_IMAGE_SLOTS)[number]['key'];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [submittingTemplate, setSubmittingTemplate] = useState<string | null>(null);
  const [templateStatuses, setTemplateStatuses] = useState<Record<string, { status: string; headerType: string | null }>>({});

  useEffect(() => {
    const ref = doc(db, 'systemConfig', 'whatsappConfig');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as WhatsAppConfig;
        setConfig(data);
        setEditRoles(data.allowedSenderRoles || ['admin', 'owner']);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch registered template statuses from Firestore
  useEffect(() => {
    const names = [
      'quote_submission',
      'quote_document',
      'change_order_submission',
      'change_order_document',
      'order_confirmation',
      'deposit_payment_request',
      'payment_receipt',
      'receipt_document',
      'order_status_update',
      'welcome_message',
    ];
    Promise.all(
      names.map(async (name) => {
        const snap = await getDoc(doc(db, 'whatsappTemplates', name));
        if (snap.exists()) {
          const d = snap.data();
          return [name, { status: d.status || 'unknown', headerType: d.headerType || null }] as const;
        }
        return [name, { status: 'not_registered', headerType: null }] as const;
      })
    ).then((entries) => setTemplateStatuses(Object.fromEntries(entries)));
  }, [submittingTemplate]); // refetch after submission

  const handleSubmitTemplate = async (predefinedTemplate: string) => {
    const templateKey = String(predefinedTemplate || '').trim();
    if (!templateKey) {
      alert('Template key is missing. Please refresh and try again.');
      return;
    }

    setSubmittingTemplate(templateKey);
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('@/shared/services/firebase');
      const createTemplate = httpsCallable(functions, 'createWhatsAppTemplate', { timeout: 150_000 });
      const result = await createTemplate({
        predefinedTemplate: templateKey,
        // Backward-compatible alias used by older function revisions.
        templateName: templateKey,
      });
      const data = result.data as { status?: string; templateName?: string };
      alert(`Template "${data.templateName}" submitted. Status: ${data.status || 'PENDING'}`);
    } catch (err: any) {
      console.error('Template submission failed:', err);
      alert(`Failed to submit template: ${err.message}`);
    } finally {
      setSubmittingTemplate(null);
    }
  };

  const toggleRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const ref = doc(db, 'systemConfig', 'whatsappConfig');
      await setDoc(ref, {
        allowedSenderRoles: editRoles,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }, [editRoles]);

  const handleImageUpload = async (key: TemplateImageKey, file: File) => {
    setImageError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImageError('Only PNG, JPG, and WebP images are supported.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setImageError('Image must be under 5MB.');
      return;
    }

    setUploadingKey(key);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const storagePath = `organizations/default/whatsapp/template-headers/${key}.${ext}`;
      const { url } = await uploadFile(storagePath, file);

      const configRef = doc(db, 'systemConfig', 'whatsappConfig');
      await setDoc(configRef, {
        templateHeaderImages: { [key]: url },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to upload header image:', err);
      setImageError('Upload failed. Please try again.');
    } finally {
      setUploadingKey(null);
      // Reset file input
      const input = fileInputRefs.current[key];
      if (input) input.value = '';
    }
  };

  const handleImageDelete = async (key: TemplateImageKey) => {
    setImageError(null);
    setUploadingKey(key);
    try {
      // Try to delete the file from storage (may fail if path has different extension)
      const basePath = `organizations/default/whatsapp/template-headers/${key}`;
      for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
        try { await deleteFile(`${basePath}.${ext}`); } catch { /* ignore */ }
      }

      // Clear URL in Firestore
      const configRef = doc(db, 'systemConfig', 'whatsappConfig');
      await setDoc(configRef, {
        templateHeaderImages: { [key]: null },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to delete header image:', err);
      setImageError('Delete failed. Please try again.');
    } finally {
      setUploadingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const headerImages = config?.templateHeaderImages || {};

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            WhatsApp module configuration and provider management
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Provider Status */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-green-600" />
          <h3 className="font-medium">Provider Status</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-gray-500">Active Provider</p>
            <p className="font-medium text-sm capitalize">
              {config?.activeProvider || 'meta'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-gray-500">Webhook Status</p>
            <p className="flex items-center gap-1 text-sm">
              {config?.metaWebhookVerified ? (
                <><CheckCircle2 className="w-4 h-4 text-green-600" /> Verified</>
              ) : (
                <><AlertCircle className="w-4 h-4 text-amber-500" /> Not Verified</>
              )}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-gray-500">Phone Number ID</p>
            <p className="font-mono text-xs text-gray-700">
              {config?.metaPhoneNumberId || '—'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-gray-500">Business Account ID</p>
            <p className="font-mono text-xs text-gray-700">
              {config?.metaBusinessAccountId || '—'}
            </p>
          </div>
        </div>

        {config?.lastTemplateSyncAt && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Last template sync: {config.lastTemplateSyncAt.toDate?.().toLocaleString() || '—'}
          </p>
        )}
      </section>

      {/* Template Header Images */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-purple-600" />
          <h3 className="font-medium">Template Header Images</h3>
        </div>
        <p className="text-sm text-gray-500">
          Upload branded images displayed at the top of WhatsApp template messages.
          Recommended size: 1125 x 600 px (landscape). Max 5MB, PNG/JPG/WebP.
        </p>

        {imageError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {imageError}
            <button onClick={() => setImageError(null)} className="ml-auto">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {TEMPLATE_IMAGE_SLOTS.map((slot) => {
            const imageUrl = headerImages[slot.key as keyof typeof headerImages];
            const isUploading = uploadingKey === slot.key;

            return (
              <div
                key={slot.key}
                className="border rounded-lg overflow-hidden group"
              >
                {/* Image preview / placeholder — aspect ratio 1125:600 (15:8) */}
                <div className="relative bg-gray-100" style={{ aspectRatio: '1125 / 600' }}>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={slot.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-[#872E5C]/20 to-[#E18425]/20 flex flex-col items-center justify-center gap-1">
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                      <span className="text-[10px] text-gray-400">1125 x 600 px</span>
                    </div>
                  )}

                  {/* Upload overlay */}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}

                  {/* Action buttons (shown on hover) */}
                  {!isUploading && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => fileInputRefs.current[slot.key]?.click()}
                        className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        {imageUrl ? 'Replace' : 'Upload'}
                      </button>
                      {imageUrl && (
                        <button
                          onClick={() => handleImageDelete(slot.key)}
                          className="px-2.5 py-1.5 bg-red-500 rounded-lg text-xs font-medium text-white shadow-sm hover:bg-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Hidden file input */}
                  <input
                    ref={(el) => { fileInputRefs.current[slot.key] = el; }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(slot.key, file);
                    }}
                  />
                </div>

                {/* Label */}
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{slot.label}</p>
                  <p className="text-xs text-gray-500">{slot.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Template Registration (Meta) */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="font-medium">Template Registration</h3>
        </div>
        <p className="text-sm text-gray-500">
          Submit or re-submit message templates to Meta for approval.
          Templates default to TEXT headers. To enable IMAGE headers, upload a header image above first, then re-submit.
        </p>

        {/* Show notice if quote_submission has TEXT header but an image is available */}
        {templateStatuses['quote_submission']?.headerType === 'text' && headerImages.quoteSubmission && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            A header image is uploaded but the quote template is using TEXT header. Re-submit to upgrade to IMAGE.
          </div>
        )}
        {templateStatuses['change_order_submission']?.headerType === 'text' && headerImages.changeOrderSubmission && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            A header image is uploaded but the change-order template is using TEXT header. Re-submit to upgrade to IMAGE.
          </div>
        )}

        <div className="space-y-2">
          {[
            { key: 'quote_submission', label: 'Quote Submission', desc: 'Quote with Approve/Reject buttons' },
            { key: 'quote_document', label: 'Quote Document', desc: 'PDF quote attachment via document template' },
              { key: 'change_order_submission', label: 'Change Order Submission', desc: 'Send change-order approval request with branded image header' },
              { key: 'change_order_document', label: 'Change Order Document', desc: 'PDF change-order attachment via document template' },
            { key: 'order_confirmation', label: 'Order Confirmation', desc: 'Confirm sales order with payment schedule' },
            { key: 'deposit_payment_request', label: 'Deposit Payment Request', desc: 'Request deposit with bank/MoMo/Pesapal options' },
            { key: 'payment_receipt', label: 'Payment Receipt', desc: 'Branded receipt confirmation with header image' },
            { key: 'receipt_document', label: 'Receipt Document', desc: 'PDF receipt attachment via document template' },
            { key: 'order_status_update', label: 'Order Status Update', desc: 'Order status notifications' },
            { key: 'welcome_message', label: 'Welcome Message', desc: 'New contact greeting' },
          ].map((tmpl) => {
            const info = templateStatuses[tmpl.key];
            const isSubmitting = submittingTemplate === tmpl.key;
            return (
              <div
                key={tmpl.key}
                className="flex items-center justify-between border rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{tmpl.label}</p>
                  <p className="text-xs text-gray-500">{tmpl.desc}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      info?.status === 'APPROVED'
                        ? 'bg-green-100 text-green-700'
                        : info?.status === 'not_registered'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {info?.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                      {info?.status || 'unknown'}
                    </span>
                    {info?.headerType && (
                      <span className="text-xs text-gray-400">
                        Header: {info.headerType.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleSubmitTemplate(tmpl.key)}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {info?.status === 'not_registered' ? 'Submit' : 'Re-submit'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Allowed Sender Roles */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium">Allowed Sender Roles</h3>
        </div>
        <p className="text-sm text-gray-500">
          Select which roles can send WhatsApp messages from the platform.
        </p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => toggleRole(role)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                editRoles.includes(role)
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </section>

      {/* Migration Status */}
      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium">Migration Status</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Migration from Zoko to Meta Cloud API is complete.
          </div>
        </div>
      </section>

      {/* General Settings */}
      <section className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium">General</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Default Country Code</label>
            <input
              type="text"
              value={config?.defaultCountryCode || '256'}
              readOnly
              className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rate Limit (per minute)</label>
            <input
              type="number"
              value={config?.rateLimitPerMinute || 30}
              readOnly
              className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
