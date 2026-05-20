/**
 * DiscoverabilityPanel Component
 * AI discovery metadata editor for SEO and search optimization
 */

import { useState } from 'react';
import { Sparkles, Loader2, Check, Plus, X, Code, AlertCircle } from 'lucide-react';
import { generateDiscoverabilityData } from '../../services/aiService';
import type { LaunchProduct } from '../../types/product.types';
import type { AIDiscoveryData } from '../../types/product.types';

interface DiscoverabilityPanelProps {
  product: LaunchProduct;
  onApply: (data: AIDiscoveryData) => void;
  onClose?: () => void;
}

interface TagEditorProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  color: string;
}

function TagEditor({ label, tags, onChange, suggestions = [], color }: TagEditorProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span 
            key={tag} 
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${color}`}
          >
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag(inputValue)}
            placeholder="Add..."
            className="w-24 px-2 py-1 text-sm border border-dashed border-gray-300 rounded-full focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {suggestions.filter(s => !tags.includes(s)).slice(0, 5).map(suggestion => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className="px-2 py-0.5 text-xs text-gray-500 bg-gray-100 rounded-full hover:bg-gray-200"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DiscoverabilityPanel({ product, onApply, onClose }: DiscoverabilityPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [data, setData] = useState<AIDiscoveryData | null>(product.aiDiscovery || null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await generateDiscoverabilityData(product);
      setData({
        whatItIs: result.whatItIs,
        bestFor: result.bestFor,
        comparedTo: result.comparedTo,
        uniqueFeatures: result.uniqueFeatures,
        useCases: result.useCases,
        faqs: result.faqs,
        semanticTags: result.semanticTags,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate discoverability data');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (data) {
      onApply(data);
    }
  };

  const updateField = (field: keyof AIDiscoveryData, value: any) => {
    setData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const generateSchemaPreview = () => {
    if (!data) return '';
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: data.whatItIs,
      category: product.category,
      brand: {
        '@type': 'Brand',
        name: 'Dawin Finishes',
      },
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Best For', value: data.bestFor },
        ...data.uniqueFeatures.map(f => ({ '@type': 'PropertyValue', name: 'Feature', value: f })),
      ],
    }, null, 2);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Discoverability</h3>
              <p className="text-sm text-gray-500">SEO and search optimization data</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          )}
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
      {!data && (
        <div className="p-6">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Product...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Discoverability Data
              </>
            )}
          </button>
        </div>
      )}

      {/* Content */}
      {data && (
        <div className="p-6 space-y-6">
          {/* What It Is */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">What It Is</label>
            <textarea
              value={data.whatItIs}
              onChange={(e) => updateField('whatItIs', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Best For */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Best For</label>
            <textarea
              value={data.bestFor}
              onChange={(e) => updateField('bestFor', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Compared To */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Compared To</label>
            <textarea
              value={data.comparedTo}
              onChange={(e) => updateField('comparedTo', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Unique Features */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Unique Features</label>
            <div className="space-y-2">
              {data.uniqueFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => {
                      const newFeatures = [...data.uniqueFeatures];
                      newFeatures[index] = e.target.value;
                      updateField('uniqueFeatures', newFeatures);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => {
                      const newFeatures = data.uniqueFeatures.filter((_, i) => i !== index);
                      updateField('uniqueFeatures', newFeatures);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateField('uniqueFeatures', [...data.uniqueFeatures, ''])}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" /> Add Feature
              </button>
            </div>
          </div>

          {/* Semantic Tags */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900">Semantic Tags</h4>
            
            <TagEditor
              label="Material Types"
              tags={data.semanticTags.materialType}
              onChange={(tags) => updateField('semanticTags', { ...data.semanticTags, materialType: tags })}
              suggestions={['wood', 'metal', 'glass', 'stone', 'veneer', 'laminate']}
              color="bg-amber-100 text-amber-700"
            />
            
            <TagEditor
              label="Style Categories"
              tags={data.semanticTags.styleCategory}
              onChange={(tags) => updateField('semanticTags', { ...data.semanticTags, styleCategory: tags })}
              suggestions={['modern', 'traditional', 'transitional', 'contemporary', 'rustic', 'minimalist']}
              color="bg-purple-100 text-purple-700"
            />
            
            <TagEditor
              label="Room Types"
              tags={data.semanticTags.roomType}
              onChange={(tags) => updateField('semanticTags', { ...data.semanticTags, roomType: tags })}
              suggestions={['kitchen', 'bathroom', 'bedroom', 'living room', 'office', 'dining room']}
              color="bg-green-100 text-green-700"
            />
            
            <TagEditor
              label="Color Family"
              tags={data.semanticTags.colorFamily}
              onChange={(tags) => updateField('semanticTags', { ...data.semanticTags, colorFamily: tags })}
              suggestions={['natural', 'white', 'black', 'gray', 'warm', 'cool']}
              color="bg-blue-100 text-blue-700"
            />
          </div>

          {/* FAQs */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">FAQs</label>
            {data.faqs.map((faq, index) => (
              <div key={index} className="p-3 border border-gray-200 rounded-lg space-y-2">
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => {
                    const newFaqs = [...data.faqs];
                    newFaqs[index] = { ...faq, question: e.target.value };
                    updateField('faqs', newFaqs);
                  }}
                  placeholder="Question"
                  className="w-full px-2 py-1 font-medium border-b border-gray-200 focus:border-blue-500 focus:outline-none"
                />
                <textarea
                  value={faq.answer}
                  onChange={(e) => {
                    const newFaqs = [...data.faqs];
                    newFaqs[index] = { ...faq, answer: e.target.value };
                    updateField('faqs', newFaqs);
                  }}
                  placeholder="Answer"
                  rows={2}
                  className="w-full px-2 py-1 text-sm text-gray-600 focus:outline-none resize-none"
                />
              </div>
            ))}
          </div>

          {/* Schema Preview */}
          <div className="space-y-2">
            <button
              onClick={() => setShowSchema(!showSchema)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <Code className="w-4 h-4" />
              {showSchema ? 'Hide' : 'Show'} Schema.org Preview
            </button>
            {showSchema && (
              <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto">
                {generateSchemaPreview()}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {data && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
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
      )}
    </div>
  );
}

export default DiscoverabilityPanel;
