/**
 * Template Management Page
 * Admin interface for managing report templates
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  FileText,
  ExternalLink,
  Check,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { TemplateManagerService } from '../reports/services/template-manager.service';
import { DEFAULT_TEMPLATES, REPORT_TYPE_LABELS } from '../reports/templates';
import type { ReportTemplate, ReportTemplateInput, ReportType } from '../reports/types';

const ORG_ID = 'default';

type ModalMode = 'create' | 'edit' | null;

interface TemplateFormData {
  name: string;
  description: string;
  type: ReportType;
  googleDocTemplateId: string;
  folderPath: string;
  fileNamingPattern: string;
  isActive: boolean;
  isDefault: boolean;
}

const initialFormData: TemplateFormData = {
  name: '',
  description: '',
  type: 'monthly_progress',
  googleDocTemplateId: '',
  folderPath: 'Reports/{Year}/{ReportType}',
  fileNamingPattern: '{ProjectCode}-{ReportType}-{Period}',
  isActive: true,
  isDefault: false,
};

export function TemplateManagementPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const templateService = TemplateManagerService.getInstance(db);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allTemplates = await templateService.getAllTemplates(ORG_ID, false);
      setTemplates(allTemplates);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [templateService]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Open create modal
  const handleCreate = () => {
    setFormData(initialFormData);
    setSelectedTemplate(null);
    setModalMode('create');
  };

  // Open edit modal
  const handleEdit = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      type: template.type,
      googleDocTemplateId: template.googleDocTemplateId,
      folderPath: template.folderPath || '',
      fileNamingPattern: template.fileNamingPattern || '',
      isActive: template.isActive,
      isDefault: template.isDefault || false,
    });
    setModalMode('edit');
  };

  // Close modal
  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedTemplate(null);
    setFormData(initialFormData);
  };

  // Save template
  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setError(null);

      // Get default template config for placeholders
      const defaultConfig = DEFAULT_TEMPLATES.find(t => t.type === formData.type);

      const templateInput: ReportTemplateInput = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        googleDocTemplateId: formData.googleDocTemplateId,
        placeholders: defaultConfig?.placeholders || [],
        dataSources: defaultConfig?.dataSources || [],
        defaultPeriodType: defaultConfig?.defaultPeriodType || 'monthly',
        autoPopulateFields: defaultConfig?.autoPopulateFields || [],
        folderPath: formData.folderPath,
        fileNamingPattern: formData.fileNamingPattern,
        includeFacilityBranding: true,
        includeClientLogo: true,
        includeDonorLogo: true,
        isActive: formData.isActive,
        isDefault: formData.isDefault,
      };

      if (modalMode === 'create') {
        await templateService.createTemplate(ORG_ID, templateInput, user.uid);
      } else if (modalMode === 'edit' && selectedTemplate) {
        await templateService.updateTemplate(
          ORG_ID,
          selectedTemplate.id,
          templateInput,
          user.uid
        );
      }

      handleCloseModal();
      await loadTemplates();
    } catch (err) {
      console.error('Failed to save template:', err);
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async (templateId: string) => {
    try {
      setError(null);
      await templateService.deleteTemplate(ORG_ID, templateId);
      setDeleteConfirm(null);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError('Failed to delete template');
    }
  };

  // Seed default templates
  const handleSeedDefaults = async () => {
    if (!user) return;

    try {
      setSeeding(true);
      setError(null);

      // Check which templates already exist
      const existingTypes = new Set(templates.map(t => t.type));

      for (const defaultTemplate of DEFAULT_TEMPLATES) {
        if (!existingTypes.has(defaultTemplate.type)) {
          const templateInput: ReportTemplateInput = {
            ...defaultTemplate,
            googleDocTemplateId: `PLACEHOLDER_${defaultTemplate.type.toUpperCase()}`,
          };
          await templateService.createTemplate(ORG_ID, templateInput, user.uid);
        }
      }

      await loadTemplates();
    } catch (err) {
      console.error('Failed to seed templates:', err);
      setError('Failed to seed default templates');
    } finally {
      setSeeding(false);
    }
  };

  // Toggle template active status
  const handleToggleActive = async (template: ReportTemplate) => {
    if (!user) return;

    try {
      await templateService.setTemplateActive(
        ORG_ID,
        template.id,
        !template.isActive,
        user.uid
      );
      await loadTemplates();
    } catch (err) {
      console.error('Failed to toggle template status:', err);
      setError('Failed to update template');
    }
  };

  // Extract Google Doc ID from URL
  const extractDocId = (input: string): string => {
    // If it's already just an ID, return as-is
    if (!input.includes('/')) {
      return input;
    }
    // Extract from URL format
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : input;
  };

  const handleDocIdChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      googleDocTemplateId: extractDocId(value),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Templates</h1>
          <p className="text-gray-500">
            Manage Google Docs templates for report generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTemplates}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {seeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Seed Defaults
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">How to Create a Template</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Create a Google Doc with your report format</li>
          <li>Replace data with placeholders like <code className="bg-blue-100 px-1 rounded">{'{{PROJECT_NAME}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{TOTAL_BUDGET}}'}</code></li>
          <li>Copy the Google Doc URL or ID</li>
          <li>Click "New Template" and paste the Doc ID</li>
        </ol>
        <p className="text-xs text-blue-600 mt-2">
          See the placeholder reference below for all available placeholders.
        </p>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No templates yet</h3>
          <p className="text-gray-500 mb-4">
            Click "Seed Defaults" to create default template configurations,
            or "New Template" to create a custom one.
          </p>
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Seed Default Templates
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Google Doc ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templates.map((template) => {
                const isPlaceholder = template.googleDocTemplateId.startsWith('PLACEHOLDER_');
                return (
                  <tr key={template.id} className={!template.isActive ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {template.name}
                            {template.isDefault && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </p>
                          {template.description && (
                            <p className="text-sm text-gray-500">{template.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {REPORT_TYPE_LABELS[template.type] || template.type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {isPlaceholder ? (
                        <span className="text-sm text-amber-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          Needs Google Doc ID
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded max-w-[200px] truncate">
                            {template.googleDocTemplateId}
                          </code>
                          <a
                            href={`https://docs.google.com/document/d/${template.googleDocTemplateId}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleToggleActive(template)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          template.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {template.isActive ? (
                          <>
                            <Check className="w-3 h-3" /> Active
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirm === template.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(template.id)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(template.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Placeholder Reference */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Placeholder Reference</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PlaceholderCard
            title="Project"
            placeholders={[
              { code: '{{PROJECT_NAME}}', desc: 'Project name' },
              { code: '{{PROJECT_CODE}}', desc: 'Project code' },
              { code: '{{PROJECT_STATUS}}', desc: 'Current status' },
              { code: '{{SITE_NAME}}', desc: 'Site/facility name' },
              { code: '{{DISTRICT}}', desc: 'District' },
              { code: '{{REGION}}', desc: 'Region' },
            ]}
          />
          <PlaceholderCard
            title="Budget"
            placeholders={[
              { code: '{{TOTAL_BUDGET}}', desc: 'Total budget' },
              { code: '{{TOTAL_SPENT}}', desc: 'Amount spent' },
              { code: '{{REMAINING_BUDGET}}', desc: 'Remaining budget' },
              { code: '{{VARIANCE_AMOUNT}}', desc: 'Variance amount' },
              { code: '{{VARIANCE_PERCENTAGE}}', desc: 'Variance %' },
            ]}
          />
          <PlaceholderCard
            title="Progress"
            placeholders={[
              { code: '{{PHYSICAL_PROGRESS}}', desc: 'Physical progress %' },
              { code: '{{FINANCIAL_PROGRESS}}', desc: 'Financial progress %' },
              { code: '{{TIME_ELAPSED}}', desc: 'Time elapsed %' },
              { code: '{{SCHEDULE_STATUS}}', desc: 'Schedule status' },
            ]}
          />
          <PlaceholderCard
            title="Report Metadata"
            placeholders={[
              { code: '{{REPORT_PERIOD}}', desc: 'Report period' },
              { code: '{{GENERATION_DATE}}', desc: 'Date generated' },
              { code: '{{PREPARED_BY}}', desc: 'Preparer name' },
              { code: '{{REPORT_YEAR}}', desc: 'Report year' },
            ]}
          />
          <PlaceholderCard
            title="Facility Branding"
            placeholders={[
              { code: '{{FACILITY_NAME}}', desc: 'Facility name' },
              { code: '{{FACILITY_ADDRESS}}', desc: 'Facility address' },
              { code: '{{FACILITY_TELEPHONE}}', desc: 'Telephone' },
              { code: '{{FACILITY_EMAIL}}', desc: 'Email' },
            ]}
          />
          <PlaceholderCard
            title="Program"
            placeholders={[
              { code: '{{PROGRAM_NAME}}', desc: 'Program name' },
              { code: '{{PROGRAM_CODE}}', desc: 'Program code' },
              { code: '{{PROGRAM_SECTORS}}', desc: 'Sectors' },
            ]}
          />
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {modalMode === 'create' ? 'New Template' : 'Edit Template'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g., Monthly Progress Report"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  rows={2}
                  placeholder="Brief description of this template"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ReportType })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {Object.entries(REPORT_TYPE_LABELS).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Google Doc ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Doc Template ID or URL *
                </label>
                <input
                  type="text"
                  value={formData.googleDocTemplateId}
                  onChange={(e) => handleDocIdChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
                  placeholder="Paste Google Doc URL or ID"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the full URL or just the document ID
                </p>
              </div>

              {/* Folder Path */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Folder Path
                </label>
                <input
                  type="text"
                  value={formData.folderPath}
                  onChange={(e) => setFormData({ ...formData, folderPath: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Reports/{Year}/{ReportType}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: {'{Year}'}, {'{ReportType}'}, {'{ProjectCode}'}
                </p>
              </div>

              {/* File Naming Pattern */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Naming Pattern
                </label>
                <input
                  type="text"
                  value={formData.fileNamingPattern}
                  onChange={(e) => setFormData({ ...formData, fileNamingPattern: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="{ProjectCode}-{ReportType}-{Period}"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Set as Default</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.googleDocTemplateId}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Template'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for placeholder cards
function PlaceholderCard({
  title,
  placeholders,
}: {
  title: string;
  placeholders: Array<{ code: string; desc: string }>;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="font-medium text-gray-900 mb-2">{title}</h3>
      <div className="space-y-1">
        {placeholders.map((ph) => (
          <div key={ph.code} className="flex items-center justify-between text-xs">
            <code className="bg-white px-1.5 py-0.5 rounded border font-mono">
              {ph.code}
            </code>
            <span className="text-gray-500 ml-2">{ph.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TemplateManagementPage;
