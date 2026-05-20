/**
 * DescriptionGenerator Component
 * AI-powered product content generation panel
 */

import { useState } from 'react';
import { Sparkles, Loader2, Check, Edit2, Copy, AlertCircle } from 'lucide-react';
import { generateContentFromProduct } from '../../services/aiService';
import type { LaunchProduct } from '../../types/product.types';
import type { AIGeneratedContent } from '../../types/ai.types';

interface DescriptionGeneratorProps {
  product: LaunchProduct;
  onApply: (content: Partial<AIGeneratedContent>) => void;
  onClose?: () => void;
}

type ContentTab = 'short' | 'full' | 'meta' | 'bullets' | 'faqs';

const TABS: { id: ContentTab; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'full', label: 'Full' },
  { id: 'meta', label: 'Meta' },
  { id: 'bullets', label: 'Bullets' },
  { id: 'faqs', label: 'FAQs' },
];

const TONES = [
  { id: 'professional', label: 'Professional', desc: 'Authoritative and detailed' },
  { id: 'casual', label: 'Casual', desc: 'Warm and approachable' },
  { id: 'luxury', label: 'Luxury', desc: 'Elegant and exclusive' },
] as const;

export function DescriptionGenerator({ product, onApply, onClose }: DescriptionGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTab>('short');
  const [tone, setTone] = useState<'professional' | 'casual' | 'luxury'>('professional');
  const [content, setContent] = useState<Partial<AIGeneratedContent> | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await generateContentFromProduct(product, ['short', 'full', 'meta', 'bullets', 'faqs'], tone);
      setContent(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleApply = () => {
    if (content) {
      onApply(content);
    }
  };

  const updateContent = (field: keyof AIGeneratedContent, value: any) => {
    setContent(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Content Generator</h3>
              <p className="text-sm text-gray-500">Generate product descriptions and content</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tone Selection */}
      <div className="px-6 py-4 border-b border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">Content Tone</label>
        <div className="flex gap-2">
          {TONES.map(t => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                tone === t.id
                  ? 'bg-[#872E5C] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="font-medium">{t.label}</span>
              <span className="hidden sm:inline text-xs ml-1 opacity-75">- {t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Generate Button */}
      {!content && (
        <div className="p-6">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-[#872E5C] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Content...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate AI Content
              </>
            )}
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">
            This will generate descriptions, bullet points, and FAQs for "{product.name}"
          </p>
        </div>
      )}

      {/* Content Preview */}
      {content && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex px-6">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#872E5C] text-[#872E5C]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6 min-h-[200px]">
            {/* Short Description */}
            {activeTab === 'short' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Short Description</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingField(editingField === 'short' ? null : 'short')}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopy(content.shortDescription || '', 'short')}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    >
                      {copied === 'short' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {editingField === 'short' ? (
                  <textarea
                    value={content.shortDescription || ''}
                    onChange={(e) => updateContent('shortDescription', e.target.value)}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-700 leading-relaxed">{content.shortDescription}</p>
                )}
                <p className="text-xs text-gray-500">{(content.shortDescription || '').length} characters</p>
              </div>
            )}

            {/* Full Description */}
            {activeTab === 'full' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Full Description (HTML)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingField(editingField === 'full' ? null : 'full')}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopy(content.fullDescription || '', 'full')}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    >
                      {copied === 'full' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {editingField === 'full' ? (
                  <textarea
                    value={content.fullDescription || ''}
                    onChange={(e) => updateContent('fullDescription', e.target.value)}
                    className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                  />
                ) : (
                  <div 
                    className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg"
                    dangerouslySetInnerHTML={{ __html: content.fullDescription || '' }}
                  />
                )}
              </div>
            )}

            {/* Meta Description */}
            {activeTab === 'meta' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Meta Description (SEO)</label>
                  <button
                    onClick={() => handleCopy(content.metaDescription || '', 'meta')}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                  >
                    {copied === 'meta' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <textarea
                  value={content.metaDescription || ''}
                  onChange={(e) => updateContent('metaDescription', e.target.value)}
                  maxLength={155}
                  className="w-full h-20 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                />
                <p className={`text-xs ${(content.metaDescription || '').length > 155 ? 'text-red-500' : 'text-gray-500'}`}>
                  {(content.metaDescription || '').length}/155 characters
                </p>
              </div>
            )}

            {/* Bullet Points */}
            {activeTab === 'bullets' && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Key Features</label>
                <ul className="space-y-2">
                  {(content.bulletPoints || []).map((bullet, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-[#872E5C] mt-1">•</span>
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) => {
                          const newBullets = [...(content.bulletPoints || [])];
                          newBullets[index] = e.target.value;
                          updateContent('bulletPoints', newBullets);
                        }}
                        className="flex-1 px-2 py-1 border border-transparent hover:border-gray-300 focus:border-[#872E5C] rounded focus:outline-none focus:ring-1 focus:ring-[#872E5C]"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* FAQs */}
            {activeTab === 'faqs' && (
              <div className="space-y-4">
                <label className="text-sm font-medium text-gray-700">Frequently Asked Questions</label>
                {(content.faqs || []).map((faq, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => {
                        const newFaqs = [...(content.faqs || [])];
                        newFaqs[index] = { ...faq, question: e.target.value };
                        updateContent('faqs', newFaqs);
                      }}
                      className="w-full px-2 py-1 font-medium bg-transparent border border-transparent hover:border-gray-300 focus:border-[#872E5C] rounded focus:outline-none"
                      placeholder="Question"
                    />
                    <textarea
                      value={faq.answer}
                      onChange={(e) => {
                        const newFaqs = [...(content.faqs || [])];
                        newFaqs[index] = { ...faq, answer: e.target.value };
                        updateContent('faqs', newFaqs);
                      }}
                      className="w-full px-2 py-1 text-sm text-gray-600 bg-transparent border border-transparent hover:border-gray-300 focus:border-[#872E5C] rounded focus:outline-none resize-none"
                      rows={2}
                      placeholder="Answer"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Regenerate
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-2 px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6a2449]"
            >
              <Check className="w-4 h-4" />
              Apply to Product
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default DescriptionGenerator;
