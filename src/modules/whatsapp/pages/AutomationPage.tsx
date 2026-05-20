/**
 * AutomationPage - WhatsApp automation and AI agent settings
 * Manages auto-replies, keyword triggers, and AI sales agent configuration
 */

import { useState, useEffect, useCallback } from 'react';
import { Bot, Clock, MessageSquare, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useWhatsAppTemplates } from '../hooks';
import type { WhatsAppAutomation, KeywordTrigger, BusinessHours } from '../types';

const DEFAULT_AUTOMATION: WhatsAppAutomation = {
  aiAgentEnabled: false,
  aiSystemPrompt: 'You are a helpful sales assistant for DawinOS. Help customers find products, answer questions, and process orders. Be friendly and professional.',
  welcomeMessageEnabled: false,
  welcomeTemplateId: '',
  awayMessageEnabled: false,
  awayTemplateId: '',
  businessHours: {
    start: '09:00',
    end: '17:00',
    timezone: 'Africa/Kampala',
    days: [1, 2, 3, 4, 5],
  },
  keywordTriggers: [],
};

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function AutomationPage() {
  const { templates } = useWhatsAppTemplates();
  const [automation, setAutomation] = useState<WhatsAppAutomation>(DEFAULT_AUTOMATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const ref = doc(db, 'systemConfig', 'whatsappAutomation');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setAutomation({ ...DEFAULT_AUTOMATION, ...snap.data() } as WhatsAppAutomation);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const ref = doc(db, 'systemConfig', 'whatsappAutomation');
      await setDoc(ref, {
        ...automation,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save automation settings:', err);
    } finally {
      setSaving(false);
    }
  }, [automation]);

  const updateField = <K extends keyof WhatsAppAutomation>(key: K, value: WhatsAppAutomation[K]) => {
    setAutomation((prev) => ({ ...prev, [key]: value }));
  };

  const updateBusinessHours = <K extends keyof BusinessHours>(key: K, value: BusinessHours[K]) => {
    setAutomation((prev) => ({
      ...prev,
      businessHours: { ...prev.businessHours, [key]: value },
    }));
  };

  const toggleDay = (day: number) => {
    const days = automation.businessHours.days.includes(day)
      ? automation.businessHours.days.filter((d) => d !== day)
      : [...automation.businessHours.days, day].sort();
    updateBusinessHours('days', days);
  };

  const addKeywordTrigger = () => {
    updateField('keywordTriggers', [
      ...automation.keywordTriggers,
      { keyword: '', templateId: '', exact: false },
    ]);
  };

  const removeKeywordTrigger = (idx: number) => {
    updateField('keywordTriggers', automation.keywordTriggers.filter((_, i) => i !== idx));
  };

  const updateKeywordTrigger = (idx: number, updates: Partial<KeywordTrigger>) => {
    updateField(
      'keywordTriggers',
      automation.keywordTriggers.map((t, i) => (i === idx ? { ...t, ...updates } : t))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Automation</h2>
          <p className="text-sm text-muted-foreground">
            Configure auto-replies, AI agent, and keyword triggers
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

      {/* AI Agent Section */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-green-600" />
            <h3 className="font-medium">AI Sales Agent</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={automation.aiAgentEnabled}
              onChange={(e) => updateField('aiAgentEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
          </label>
        </div>
        <p className="text-sm text-gray-500">
          When enabled, Claude AI will automatically respond to customer messages with product recommendations and order assistance.
        </p>
        <div>
          <label className="block text-xs text-gray-500 mb-1">AI System Prompt</label>
          <textarea
            value={automation.aiSystemPrompt}
            onChange={(e) => updateField('aiSystemPrompt', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            placeholder="Describe how the AI agent should behave..."
          />
        </div>
      </section>

      {/* Welcome Message */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium">Welcome Message</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={automation.welcomeMessageEnabled}
              onChange={(e) => updateField('welcomeMessageEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>
        <p className="text-sm text-gray-500">
          Send a template message when a new contact messages for the first time.
        </p>
        {automation.welcomeMessageEnabled && (
          <select
            value={automation.welcomeTemplateId || ''}
            onChange={(e) => updateField('welcomeTemplateId', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </section>

      {/* Away Message */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="font-medium">Away Message</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={automation.awayMessageEnabled}
              onChange={(e) => updateField('awayMessageEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
          </label>
        </div>
        <p className="text-sm text-gray-500">
          Send a template when messages arrive outside business hours.
        </p>
        {automation.awayMessageEnabled && (
          <>
            <select
              value={automation.awayTemplateId || ''}
              onChange={(e) => updateField('awayTemplateId', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* Business hours config */}
            <div className="space-y-3 bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-600">Business Hours</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <input
                    type="time"
                    value={automation.businessHours.start}
                    onChange={(e) => updateBusinessHours('start', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">End</label>
                  <input
                    type="time"
                    value={automation.businessHours.end}
                    onChange={(e) => updateBusinessHours('end', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Working Days</label>
                <div className="flex gap-1.5">
                  {DAYS.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                        automation.businessHours.days.includes(day.value)
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Keyword Triggers */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Keyword Triggers</h3>
          <button
            onClick={addKeywordTrigger}
            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Trigger
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Auto-respond with a template when a message contains a keyword.
        </p>

        {automation.keywordTriggers.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No keyword triggers configured</p>
        ) : (
          <div className="space-y-3">
            {automation.keywordTriggers.map((trigger, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-gray-50 rounded-lg p-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={trigger.keyword}
                    onChange={(e) => updateKeywordTrigger(idx, { keyword: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Keyword (e.g. price, catalog)"
                  />
                  <select
                    value={trigger.templateId}
                    onChange={(e) => updateKeywordTrigger(idx, { templateId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={trigger.exact}
                      onChange={(e) => updateKeywordTrigger(idx, { exact: e.target.checked })}
                      className="rounded"
                    />
                    Exact match only
                  </label>
                </div>
                <button
                  onClick={() => removeKeywordTrigger(idx)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
