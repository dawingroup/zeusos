/**
 * TemplatesPage - WhatsApp message template management
 * View, search, filter, sync, and create templates for Meta Cloud API
 */

import { useState, useMemo } from 'react';
import { RefreshCw, Search, Filter, Eye, FileText, Loader2, Plus, Trash2, Rocket } from 'lucide-react';
import { useWhatsAppTemplates } from '../hooks';
import { TemplatePreview } from '../components/TemplatePreview';
import {
  syncTemplates,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
} from '../services/whatsappApiService';
import type { WhatsAppTemplate, TemplateStatus } from '../types';

type StatusFilter = TemplateStatus | 'all';
type CategoryFilter = string | 'all';

interface PredefinedTemplate {
  key: string;
  name: string;
  category: string;
  language: string;
  description: string;
  bodyPreview: string;
  hasButtons: boolean;
  parameterCount: number;
}

/** Static predefined templates — matches the Cloud Function definitions */
const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  {
    key: 'quote_submission',
    name: 'quote_submission',
    category: 'UTILITY',
    language: 'en',
    description: 'Send a quote to clients with Approve/Reject quick-reply buttons. Works outside the 24h window.',
    bodyPreview: 'Hello {{1}},\n\nHere is your quote from *Dawin Finishes*.\n\n*{{2}}*\nQuote #: {{3}}\nProject: {{4}}\nAmount: *{{5}}*...',
    hasButtons: true,
    parameterCount: 7,
  },
  {
    key: 'order_status_update',
    name: 'order_status_update',
    category: 'UTILITY',
    language: 'en',
    description: 'Notify customers about order status changes (shipped, delivered, etc.).',
    bodyPreview: 'Hello {{1}},\n\nYour order *{{2}}* has been updated.\n\nStatus: *{{3}}*\n{{4}}...',
    hasButtons: false,
    parameterCount: 4,
  },
  {
    key: 'quote_document',
    name: 'quote_document',
    category: 'UTILITY',
    language: 'en',
    description: 'Send a PDF quote document as a template attachment. Works outside the 24h window.',
    bodyPreview: 'Hello {{1}},\n\nPlease find attached the detailed quote for *{{2}}*.\n\nQuote #: {{3}}\nAmount: *{{4}}*...',
    hasButtons: false,
    parameterCount: 4,
  },
  {
    key: 'change_order_submission',
    name: 'change_order_submission',
    category: 'UTILITY',
    language: 'en',
    description: 'Send a change-order approval request with branded header image and approval link.',
    bodyPreview: 'Hello {{1}},\n\nA change order is ready for your review.\n\nChange Order: {{2}}\nTitle: {{3}}\nProject Order: {{4}}\nImpact: {{5}} {{6}}...',
    hasButtons: false,
    parameterCount: 8,
  },
  {
    key: 'change_order_document',
    name: 'change_order_document',
    category: 'UTILITY',
    language: 'en',
    description: 'Send a change-order PDF as a document template follow-up.',
    bodyPreview: 'Hello {{1}},\n\nPlease find the change-order PDF attached.\n\nChange Order: {{2}}\nTitle: {{3}}\nNet Impact: {{4}}...',
    hasButtons: false,
    parameterCount: 4,
  },
  {
    key: 'document_share',
    name: 'document_share',
    category: 'UTILITY',
    language: 'en',
    description: 'Send any PDF document (invoice, contract, report, etc.) to a client. Works outside the 24h window.',
    bodyPreview: 'Hello {{1}},\n\nPlease find attached: *{{2}}*\n\n{{3}}\n\nIf you have any questions, reply to this message.',
    hasButtons: false,
    parameterCount: 3,
  },
  {
    key: 'order_confirmation',
    name: 'order_confirmation',
    category: 'UTILITY',
    language: 'en',
    description: 'Confirm a sales order with payment schedule breakdown. Includes branded header image.',
    bodyPreview: 'Hello {{1}},\n\nYour order has been confirmed! 🎉\n\n*Order:* {{2}}\n*Total:* {{3}}\n\n*Payment Schedule:*\n{{4}}\n{{5}}...',
    hasButtons: false,
    parameterCount: 5,
  },
  {
    key: 'deposit_payment_request',
    name: 'deposit_payment_request',
    category: 'UTILITY',
    language: 'en',
    description: 'Request deposit payment from client with bank, MTN MoMo, and Pesapal payment options.',
    bodyPreview: 'Hello {{1}},\n\nThank you for confirming your order *{{2}}*.\n\nTo proceed, kindly make the deposit payment of *{{3}}* ({{4}} of {{5}}).\n\n*Payment Options:*\n🏦 Bank Transfer...',
    hasButtons: true,
    parameterCount: 5,
  },
  {
    key: 'payment_receipt',
    name: 'payment_receipt',
    category: 'UTILITY',
    language: 'en',
    description: 'Share a PDF payment receipt with the client. Includes order details, amount paid, date, and payment method.',
    bodyPreview: 'Hello {{1}},\n\nThank you for your payment! Here is your official receipt.\n\n*Order:* {{2}}\n*Amount Paid:* {{3}}\n*Date:* {{4}}\n*Method:* {{5}}...',
    hasButtons: false,
    parameterCount: 5,
  },
  {
    key: 'receipt_document',
    name: 'receipt_document',
    category: 'UTILITY',
    language: 'en',
    description: 'Send an official PDF receipt document to a client with order and payment details.',
    bodyPreview: 'Hello {{1}},\n\nPlease find your official receipt attached.\n\n*Order:* {{2}}\n*Amount:* {{3}}\n*Date:* {{4}}...',
    hasButtons: false,
    parameterCount: 4,
  },
  {
    key: 'meeting_minutes',
    name: 'meeting_minutes',
    category: 'UTILITY',
    language: 'en',
    description: 'Share branded meeting / interaction minutes with a client as a PDF attachment. Includes subject, date, project, and a short summary line.',
    bodyPreview: 'Hello {{1}},\n\nPlease find attached the minutes from our recent engagement.\n\n*Subject:* {{2}}\n*Date:* {{3}}\n*Project:* {{4}}\n\n{{5}}\n\nThe full branded minutes are attached as a PDF...',
    hasButtons: false,
    parameterCount: 5,
  },
  {
    key: 'welcome_message',
    name: 'welcome_message',
    category: 'MARKETING',
    language: 'en',
    description: 'Welcome new contacts with a branded greeting message.',
    bodyPreview: 'Hello {{1}}! Welcome to *Dawin Finishes*. We specialize in premium interior and exterior finishes...',
    hasButtons: false,
    parameterCount: 1,
  },
];

export default function TemplatesPage() {
  const { templates, loading } = useWhatsAppTemplates({ includeAll: true });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);

  // Create template dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Custom template state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('UTILITY');
  const [customLanguage, setCustomLanguage] = useState('en');
  const [customHeaderText, setCustomHeaderText] = useState('');
  const [customBodyText, setCustomBodyText] = useState('');
  const [customFooterText, setCustomFooterText] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return Array.from(cats).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(s) ||
          t.bodyText.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [templates, statusFilter, categoryFilter, search]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncTemplates();
      setSyncResult(`Synced ${result.synced} templates, removed ${result.removed}`);
    } catch (err: any) {
      setSyncResult(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenCreate = () => {
    setShowCreateDialog(true);
    setCreateResult(null);
    setShowCustomForm(false);
  };

  const handleCreatePredefined = async (templateKey: string) => {
    setCreating(templateKey);
    setCreateResult(null);
    try {
      const result = await createWhatsAppTemplate({ predefinedTemplate: templateKey });
      setCreateResult(`Template "${result.templateName}" submitted! Status: ${result.status}`);
      // Sync to get the latest state
      await handleSync();
    } catch (err: any) {
      setCreateResult(`Failed: ${err.message}`);
    } finally {
      setCreating(null);
    }
  };

  const handleCreateCustom = async () => {
    if (!customName.trim() || !customBodyText.trim()) return;

    const sanitizedName = customName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setCreating('custom');
    setCreateResult(null);

    const components: Record<string, unknown>[] = [];

    if (customHeaderText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: customHeaderText.trim(),
      });
    }

    components.push({
      type: 'BODY',
      text: customBodyText.trim(),
    });

    if (customFooterText.trim()) {
      components.push({
        type: 'FOOTER',
        text: customFooterText.trim(),
      });
    }

    try {
      const result = await createWhatsAppTemplate({
        name: sanitizedName,
        category: customCategory,
        language: customLanguage,
        components,
      });
      setCreateResult(`Template "${result.templateName}" submitted! Status: ${result.status}`);
      setShowCustomForm(false);
      setCustomName('');
      setCustomBodyText('');
      setCustomHeaderText('');
      setCustomFooterText('');
      await handleSync();
    } catch (err: any) {
      setCreateResult(`Failed: ${err.message}`);
    } finally {
      setCreating(null);
    }
  };

  const handleDelete = async (templateName: string) => {
    if (!confirm(`Delete template "${templateName}"? This cannot be undone.`)) return;

    setDeleting(templateName);
    try {
      await deleteWhatsAppTemplate(templateName);
      setSyncResult(`Template "${templateName}" deleted`);
      await handleSync();
    } catch (err: any) {
      setSyncResult(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const statusColor: Record<TemplateStatus, string> = {
    approved: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-700',
    removed: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Message Templates</h2>
          <p className="text-sm text-muted-foreground">
            {templates.length} template{templates.length !== 1 ? 's' : ''} synced from Meta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Templates'}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`text-sm px-3 py-2 rounded-lg ${syncResult.includes('failed') || syncResult.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {syncResult}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="removed">Removed</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Template Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No templates found</p>
          {templates.length === 0 && (
            <p className="text-xs mt-1">Click "Sync Templates" to fetch from Meta</p>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Language</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Params</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Header</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setPreviewTemplate(template)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{template.bodyText}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                      {template.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{template.language}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs rounded px-2 py-0.5 font-medium ${statusColor[template.status]}`}>
                      {template.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{template.parameterCount || 0}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {template.headerType || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewTemplate(template);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                        title="Preview template"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.name);
                        }}
                        disabled={deleting === template.name}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 disabled:opacity-50"
                        title="Delete template"
                      >
                        {deleting === template.name ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Dialog */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{previewTemplate.name}</h3>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500"
              >
                &times;
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs rounded px-2 py-0.5 font-medium ${statusColor[previewTemplate.status]}`}>
                {previewTemplate.status}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                {previewTemplate.category}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                {previewTemplate.language}
              </span>
              {previewTemplate.provider && (
                <span className="text-xs bg-blue-100 text-blue-600 rounded px-2 py-0.5">
                  {previewTemplate.provider}
                </span>
              )}
            </div>

            <TemplatePreview template={previewTemplate} params={{}} />

            {previewTemplate.buttons && previewTemplate.buttons.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Buttons</p>
                <div className="space-y-1">
                  {previewTemplate.buttons.map((btn, i) => (
                    <div key={i} className="text-sm bg-gray-50 rounded px-3 py-1.5 flex items-center justify-between">
                      <span>{btn.text}</span>
                      <span className="text-xs text-gray-400">{btn.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Create Template
              </h3>
              <button
                onClick={() => { setShowCreateDialog(false); setShowCustomForm(false); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-500"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {createResult && (
                <div className={`text-sm px-3 py-2 rounded-lg ${createResult.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {createResult}
                </div>
              )}

              <p className="text-sm text-gray-500">
                Submit a new template to Meta Business Manager for approval.
                Templates typically take a few minutes to a few hours to be reviewed.
              </p>

              {/* Predefined Templates */}
              {!showCustomForm && (
                <>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Templates</h4>
                      <div className="space-y-2">
                        {PREDEFINED_TEMPLATES.map((tpl) => {
                          const alreadyExists = templates.some((t) => t.name === tpl.name);
                          return (
                            <div
                              key={tpl.key}
                              className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm text-gray-900">{tpl.name}</p>
                                    <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                                      {tpl.category}
                                    </span>
                                    {tpl.hasButtons && (
                                      <span className="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">
                                        Buttons
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{tpl.description}</p>
                                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{tpl.bodyPreview}</p>
                                </div>
                                <button
                                  onClick={() => handleCreatePredefined(tpl.key)}
                                  disabled={creating === tpl.key || alreadyExists}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex-shrink-0"
                                  title={alreadyExists ? 'Template already exists' : 'Submit to Meta'}
                                >
                                  {creating === tpl.key ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Rocket className="w-3.5 h-3.5" />
                                  )}
                                  {alreadyExists ? 'Exists' : 'Submit'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  </div>

                  <div className="border-t pt-3">
                    <button
                      onClick={() => setShowCustomForm(true)}
                      className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      + Create custom template
                    </button>
                  </div>
                </>
              )}

              {/* Custom Template Form */}
              {showCustomForm && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowCustomForm(false)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    &larr; Back to quick templates
                  </button>

                  <h4 className="text-sm font-medium text-gray-700">Custom Template</h4>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Template Name <span className="text-gray-400">(lowercase, underscores only)</span>
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. payment_reminder"
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Category</label>
                      <select
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="UTILITY">Utility</option>
                        <option value="MARKETING">Marketing</option>
                        <option value="AUTHENTICATION">Authentication</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Language</label>
                      <select
                        value={customLanguage}
                        onChange={(e) => setCustomLanguage(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="en">English</option>
                        <option value="en_US">English (US)</option>
                        <option value="sw">Swahili</option>
                        <option value="fr">French</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Header Text <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={customHeaderText}
                      onChange={(e) => setCustomHeaderText(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Payment Reminder"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Body Text <span className="text-red-400">*</span>
                      <span className="text-gray-400 ml-1">Use {'{{1}}'}, {'{{2}}'} for parameters</span>
                    </label>
                    <textarea
                      value={customBodyText}
                      onChange={(e) => setCustomBodyText(e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                      placeholder={'Hello {{1}},\n\nYour payment of {{2}} is due on {{3}}.\n\nPlease contact us if you have questions.'}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Footer Text <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={customFooterText}
                      onChange={(e) => setCustomFooterText(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Dawin Finishes"
                    />
                  </div>

                  <button
                    onClick={handleCreateCustom}
                    disabled={creating === 'custom' || !customName.trim() || !customBodyText.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    {creating === 'custom' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Rocket className="w-4 h-4" />
                    )}
                    Submit to Meta for Approval
                  </button>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t flex justify-end">
              <button
                onClick={() => { setShowCreateDialog(false); setShowCustomForm(false); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
