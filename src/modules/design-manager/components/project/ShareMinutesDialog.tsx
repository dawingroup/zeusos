/**
 * ShareMinutesDialog
 *
 * Generates a branded meeting-minutes PDF from a ClientInteraction and
 * offers three ways to share it:
 *   1. Download — saves the PDF locally.
 *   2. Send via WhatsApp — uploads to Firebase Storage and sends as a
 *      document message through the existing whatsappApiService.
 *   3. Copy link — copies the public download URL (fallback when the
 *      24-hour WhatsApp session window is closed).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Download,
  Send,
  Loader2,
  FileText,
  Phone,
  Link as LinkIcon,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import { uploadFile } from '@/shared/services/firebase/storage';
import { sendWhatsAppMessage } from '@/modules/whatsapp/services/whatsappApiService';
import { getOrganizationSettings } from '@/core/settings';
import type { ClientInteraction } from '../../types';
import {
  minutesPdfService,
  DEFAULT_COMPANY_INFO,
  type MinutesContext,
  type MinutesCompanyInfo,
} from '../../services/minutesPdfGenerator';

// ---------------------------------------------------------------------------
// WhatsApp caption builder — compact, WhatsApp-styled (bold via *asterisks*)
// ---------------------------------------------------------------------------

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  if (typeof ts?.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(ts: any): string {
  const d = tsToDate(ts);
  return d
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

const TYPE_LABEL: Record<string, string> = {
  meeting: 'Meeting',
  'phone-call': 'Phone Call',
  email: 'Email',
  'site-visit': 'Site Visit',
  presentation: 'Presentation',
  workshop: 'Workshop',
  'approval-session': 'Approval Session',
  delivery: 'Delivery',
  other: 'Engagement',
};

function buildWhatsAppCaption(
  interaction: ClientInteraction,
  opts: { projectCode?: string; projectName?: string; clientName?: string },
): string {
  const { projectCode, projectName, clientName } = opts;
  const lines: string[] = [];

  lines.push(`*${TYPE_LABEL[interaction.type] || 'Minutes'}: ${interaction.title}*`);

  const meta: string[] = [];
  meta.push(fmtDate(interaction.date));
  if (interaction.duration) meta.push(`${interaction.duration} min`);
  if (interaction.location) meta.push(interaction.location);
  lines.push(`_${meta.join(' · ')}_`);
  lines.push('');

  if (clientName || projectCode || projectName) {
    if (clientName) lines.push(`*Client:* ${clientName}`);
    if (projectCode || projectName) {
      lines.push(
        `*Project:* ${[projectCode, projectName].filter(Boolean).join(' — ')}`,
      );
    }
    lines.push('');
  }

  const attendees = interaction.attendees || [];
  if (attendees.length > 0) {
    const names = attendees
      .slice(0, 6)
      .map((a) => (a.isClient ? `${a.name} (client)` : a.name))
      .join(', ');
    const extra = attendees.length > 6 ? ` +${attendees.length - 6} more` : '';
    lines.push(`*Attendees:* ${names}${extra}`);
    lines.push('');
  }

  if (interaction.summary) {
    const summary =
      interaction.summary.length > 400
        ? `${interaction.summary.slice(0, 400).trim()}…`
        : interaction.summary;
    lines.push('*Summary*');
    lines.push(summary);
    lines.push('');
  }

  const actions = interaction.actionItems || [];
  const openActions = actions.filter((a) => !a.completed);
  if (openActions.length > 0) {
    lines.push(`*Action Items (${openActions.length})*`);
    openActions.slice(0, 5).forEach((a, i) => {
      const owner = a.assignedTo ? ` — ${a.assignedTo}` : '';
      const due = a.dueDate ? ` (due ${fmtDate(a.dueDate)})` : '';
      lines.push(`${i + 1}. ${a.description}${owner}${due}`);
    });
    if (openActions.length > 5) {
      lines.push(`…and ${openActions.length - 5} more (see PDF)`);
    }
    lines.push('');
  }

  if (interaction.nextSteps) {
    lines.push('*Next Steps*');
    lines.push(
      interaction.nextSteps.length > 240
        ? `${interaction.nextSteps.slice(0, 240).trim()}…`
        : interaction.nextSteps,
    );
    if (interaction.followUpDate) {
      lines.push(`_Follow-up: ${fmtDate(interaction.followUpDate)}_`);
    }
    lines.push('');
  }

  lines.push('Full minutes attached as PDF.');
  lines.push('— Dawin Finishes');

  // WhatsApp document caption cap is ~1024 chars. Trim defensively.
  const joined = lines.join('\n');
  return joined.length > 1000 ? `${joined.slice(0, 997)}…` : joined;
}

interface ShareMinutesDialogProps {
  open: boolean;
  onClose: () => void;
  interaction: ClientInteraction;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  customerId?: string;
  customerName?: string;
}

export function ShareMinutesDialog({
  open,
  onClose,
  interaction,
  projectId,
  projectCode,
  projectName,
  customerId,
  customerName,
}: ShareMinutesDialogProps) {
  const { user } = useAuth();

  const [manualPhone, setManualPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);

  const [companyInfo, setCompanyInfo] = useState<MinutesCompanyInfo>(DEFAULT_COMPANY_INFO);

  // Generated artifact state — cached so repeated actions reuse the blob/URL.
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const resolvedPhone = customerPhone || manualPhone.trim();

  const context: MinutesContext = useMemo(
    () => ({
      projectCode,
      projectName,
      clientName: customerName,
      preparedBy: user?.displayName || user?.email || 'Dawin Finishes',
    }),
    [projectCode, projectName, customerName, user?.displayName, user?.email],
  );

  const filename = useMemo(
    () => minutesPdfService.buildFilename(interaction, context),
    [interaction, context],
  );

  const captionPreview = useMemo(
    () =>
      buildWhatsAppCaption(interaction, {
        projectCode,
        projectName,
        clientName: customerName,
      }),
    [interaction, projectCode, projectName, customerName],
  );

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccessMsg(null);
    setLinkCopied(false);
    setPdfBlob(null);
    setPdfUrl(null);
    setManualPhone('');
    setCustomerPhone('');
  }, [open]);

  // Fetch Dawin Finishes logo from org settings so the PDF brand-stamps.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getOrganizationSettings()
      .then((settings) => {
        if (cancelled || !settings) return;
        const subs = (settings as any)?.branding?.subsidiaries || {};
        const logoUrl = subs['dawin-finishes']?.logoUrl;
        if (logoUrl) {
          setCompanyInfo((prev) => ({ ...prev, logoUrl }));
        }
      })
      .catch(() => {
        /* non-fatal — PDF will render the text wordmark fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Look up customer phone
  useEffect(() => {
    if (!open || !customerId) return;
    let cancelled = false;
    setLoadingPhone(true);
    import('@/modules/customer-hub/services/customerService')
      .then(({ getCustomer }) => getCustomer(customerId))
      .then((customer) => {
        if (cancelled || !customer) return;
        const phone =
          customer.phone ||
          customer.contacts?.find((c: any) => c.isPrimary)?.phone ||
          customer.contacts?.[0]?.phone ||
          '';
        setCustomerPhone(phone);
      })
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        if (!cancelled) setLoadingPhone(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  // Lazily build the PDF blob; memo-cache in state.
  async function ensureBlob(): Promise<Blob> {
    if (pdfBlob) return pdfBlob;
    setBusyLabel('Generating PDF…');
    const blob = await minutesPdfService.generateBlob({
      interaction,
      context,
      company: companyInfo,
    });
    setPdfBlob(blob);
    return blob;
  }

  // Ensure uploaded + return URL.
  async function ensureUploaded(): Promise<string> {
    if (pdfUrl) return pdfUrl;
    const blob = await ensureBlob();
    setUploading(true);
    setBusyLabel('Uploading PDF…');
    try {
      const storagePath = `minutes/${projectId}/${interaction.id}_${Date.now()}.pdf`;
      const { url } = await uploadFile(storagePath, blob);
      setPdfUrl(url);
      return url;
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload() {
    setError(null);
    setSuccessMsg(null);
    try {
      const blob = await ensureBlob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      setSuccessMsg('PDF downloaded.');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate PDF.');
    } finally {
      setBusyLabel('');
    }
  }

  async function handleCopyLink() {
    setError(null);
    setSuccessMsg(null);
    try {
      const url = await ensureUploaded();
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setSuccessMsg('Public link copied to clipboard.');
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to prepare link.');
    } finally {
      setBusyLabel('');
    }
  }

  async function handleSendWhatsApp() {
    setError(null);
    setSuccessMsg(null);
    if (!resolvedPhone) {
      setError('Enter a recipient phone number.');
      return;
    }
    setSending(true);
    try {
      const url = await ensureUploaded();
      setBusyLabel('Sending via WhatsApp…');

      const caption = buildWhatsAppCaption(interaction, {
        projectCode,
        projectName,
        clientName: customerName,
      });

      const result = await sendWhatsAppMessage({
        phoneNumber: resolvedPhone,
        customerId: customerId || undefined,
        customerName: customerName || undefined,
        messageType: 'document',
        documentUrl: url,
        documentCaption: caption,
        documentFilename: filename,
      } as any);

      if (!result?.success) {
        throw new Error(
          result?.error ||
            'WhatsApp send failed. The 24-hour conversation window may be closed — use "Copy link" and share the PDF through the customer\'s preferred channel.',
        );
      }

      setSuccessMsg(`Minutes sent to ${resolvedPhone} via WhatsApp.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to send minutes.');
    } finally {
      setSending(false);
      setBusyLabel('');
    }
  }

  if (!open) return null;

  const isBusy = uploading || sending || !!busyLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#872E5C]" />
            Share Meeting Minutes
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
            disabled={isBusy}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Document summary */}
          <div className="border rounded-lg p-3 bg-[#faf5f8]">
            <p className="text-xs font-semibold text-[#872E5C] uppercase tracking-wide">
              Document
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {interaction.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {projectCode ? `${projectCode} · ` : ''}
              {customerName || '—'}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 font-mono truncate">
              {filename}
            </p>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Recipient WhatsApp number
            </label>
            {customerPhone ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium">{customerPhone}</span>
                <button
                  type="button"
                  onClick={() => setCustomerPhone('')}
                  className="ml-auto text-xs text-[#872E5C] hover:underline"
                >
                  Change
                </button>
              </div>
            ) : loadingPhone ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up customer phone…
              </div>
            ) : (
              <input
                type="tel"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="+256 7XX XXX XXX"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#872E5C]"
              />
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Delivered as a WhatsApp document message. Requires an open 24-hour
              session — otherwise use Copy link.
            </p>
          </div>

          {/* WhatsApp caption preview */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">
              WhatsApp message preview
            </p>
            <div className="bg-[#e5f6df] px-3 py-2 rounded-lg text-[13px] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto border border-green-100">
              {captionPreview}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Sent as the caption on the PDF document message.
            </p>
          </div>

          {/* Status */}
          {busyLabel && (
            <div className="flex items-center gap-2 text-xs text-[#872E5C]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {busyLabel}
            </div>
          )}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-100 text-red-700 text-xs rounded">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 text-green-700 text-xs rounded">
              <CheckCircle2 className="w-4 h-4" />
              {successMsg}
            </div>
          )}

          {pdfUrl && (
            <div className="text-[11px] text-gray-500 break-all">
              <span className="font-semibold">Link:</span>{' '}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#872E5C] hover:underline"
              >
                {pdfUrl}
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={handleDownload}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={handleCopyLink}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50"
          >
            {linkCopied ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <LinkIcon className="w-4 h-4" />
            )}
            {linkCopied ? 'Copied' : 'Copy link'}
          </button>
          <button
            onClick={handleSendWhatsApp}
            disabled={isBusy || !resolvedPhone}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-[#872E5C] hover:bg-[#6e2449] rounded-lg disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareMinutesDialog;
