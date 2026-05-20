/**
 * TemplatePicker - Dialog to select and fill a WhatsApp template
 * Supports synced templates from Meta and manually added templates
 */

import { useState } from 'react';
import { X, Send, Loader2, Plus, RefreshCw } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useWhatsAppTemplates } from '../hooks';
import { TemplatePreview } from './TemplatePreview';
import { syncTemplates } from '../services/whatsappApiService';
import type { WhatsAppTemplate, TemplateFormData } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSend: (data: TemplateFormData) => void;
  sending?: boolean;
}

type View = 'list' | 'fill' | 'add';

export function TemplatePicker({ open, onClose, onSend, sending }: Props) {
  const { templates, loading } = useWhatsAppTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [view, setView] = useState<View>('list');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Manual template form state
  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState('utility');
  const [newLanguage, setNewLanguage] = useState('en');
  const [addingTemplate, setAddingTemplate] = useState(false);

  if (!open) return null;

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    const initialParams: Record<string, string> = {};
    for (let i = 1; i <= template.parameterCount; i++) {
      initialParams[String(i)] = '';
    }
    setParams(initialParams);
    setView('fill');
  };

  const handleParamChange = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleSend = () => {
    if (!selectedTemplate) return;
    onSend({
      templateId: selectedTemplate.metaTemplateName || selectedTemplate.name,
      templateName: selectedTemplate.name,
      params,
    });
    setSelectedTemplate(null);
    setParams({});
    setView('list');
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncTemplates();
      if (result.synced === 0) {
        setSyncError('No templates returned from Meta. You can add templates manually instead.');
      }
    } catch (err: any) {
      setSyncError(err.message || 'Sync failed. Try adding templates manually.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newName.trim() || !newBody.trim()) return;
    setAddingTemplate(true);
    try {
      const paramCount = (newBody.match(/\{\{\d+\}\}/g) || []).length;
      await addDoc(collection(db, 'whatsappTemplates'), {
        metaTemplateName: newName.trim().toLowerCase().replace(/\s+/g, '_'),
        name: newName.trim(),
        language: newLanguage,
        category: newCategory,
        bodyText: newBody.trim(),
        headerType: null,
        headerText: null,
        footerText: null,
        parameterCount: paramCount,
        status: 'approved',
        lastSyncedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewName('');
      setNewBody('');
      setNewCategory('utility');
      setNewLanguage('en');
      setView('list');
    } catch (err: any) {
      console.error('Failed to add template:', err);
      setSyncError(err.message || 'Failed to add template');
    } finally {
      setAddingTemplate(false);
    }
  };

  const allParamsFilled = selectedTemplate
    ? Array.from({ length: selectedTemplate.parameterCount }, (_, i) => String(i + 1)).every(
        (key) => params[key]?.trim()
      )
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">
            {view === 'fill' ? 'Fill Template' : view === 'add' ? 'Add Template' : 'Select Template'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : view === 'list' ? (
            /* Template list */
            <div className="space-y-3">
              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setView('add')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Template
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Templates'}
                </button>
              </div>

              {syncError && (
                <p className="text-amber-600 text-xs bg-amber-50 rounded-lg p-2">{syncError}</p>
              )}

              {templates.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No templates yet. Add a template manually or sync from Meta.
                </p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.bodyText}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                        {template.language}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                        {template.category}
                      </span>
                      {template.parameterCount > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-600 rounded px-1.5 py-0.5">
                          {template.parameterCount} params
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : view === 'add' ? (
            /* Add template form */
            <div className="space-y-4">
              <button
                onClick={() => setView('list')}
                className="text-sm text-blue-600 hover:underline"
              >
                &larr; Back to templates
              </button>

              <p className="text-sm text-gray-600">
                Enter the template details exactly as they appear in Meta Business Manager.
                Use {'{{1}}'}, {'{{2}}'}, etc. for parameter placeholders in the body.
              </p>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g. order_confirmation"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Body Text *</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Hello {{1}}, your order {{2}} is confirmed."
                />
                {newBody && (
                  <p className="text-xs text-gray-400 mt-1">
                    Detected {(newBody.match(/\{\{\d+\}\}/g) || []).length} parameter(s)
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="utility">Utility</option>
                    <option value="marketing">Marketing</option>
                    <option value="authentication">Authentication</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Language</label>
                  <input
                    type="text"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="en"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Parameter form (fill view) */
            <div className="space-y-4">
              <button
                onClick={() => { setSelectedTemplate(null); setView('list'); }}
                className="text-sm text-blue-600 hover:underline"
              >
                &larr; Back to templates
              </button>

              <div>
                <p className="font-medium">{selectedTemplate!.name}</p>
                <p className="text-xs text-gray-500">{selectedTemplate!.category} &middot; {selectedTemplate!.language}</p>
              </div>

              {selectedTemplate!.parameterCount > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Fill in the template parameters:</p>
                  {Array.from({ length: selectedTemplate!.parameterCount }, (_, i) => (
                    <div key={i}>
                      <label className="block text-xs text-gray-500 mb-1">
                        Parameter {'{{'}{i + 1}{'}}'}
                      </label>
                      <input
                        type="text"
                        value={params[String(i + 1)] || ''}
                        onChange={(e) => handleParamChange(String(i + 1), e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder={`Value for parameter ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <TemplatePreview template={selectedTemplate!} params={params} />
            </div>
          )}
        </div>

        {/* Footer */}
        {view === 'fill' && selectedTemplate && (
          <div className="px-4 py-3 border-t flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || (selectedTemplate.parameterCount > 0 && !allParamsFilled)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Template
            </button>
          </div>
        )}
        {view === 'add' && (
          <div className="px-4 py-3 border-t flex justify-end gap-2">
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddTemplate}
              disabled={addingTemplate || !newName.trim() || !newBody.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
