/**
 * NamingWizard Component
 * Step-by-step wizard for AI-powered product naming
 */

import { useState } from 'react';
import { X, Sparkles, ArrowRight, ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { NameCandidateCard } from './NameCandidateCard';
import { generateProductNames } from '../../services/aiService';
import type { NamingContext, NameCandidate } from '../../types/ai.types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface NamingWizardProps {
  productId: string;
  initialContext?: Partial<NamingContext>;
  existingNames?: string[];
  onComplete: (selectedName: string, handle: string) => void;
  onClose: () => void;
}

type WizardStep = 'context' | 'candidates' | 'confirm';

const CATEGORIES = [
  'casework',
  'furniture', 
  'millwork',
  'doors',
  'fixtures',
  'specialty',
];

const COMMON_MATERIALS = [
  'Oak', 'Walnut', 'Maple', 'Cherry', 'Ash',
  'MDF', 'Plywood', 'Veneer', 'Laminate',
  'Steel', 'Brass', 'Glass', 'Marble',
];

const COMMON_FEATURES = [
  'Soft-close', 'Push-to-open', 'Adjustable shelving',
  'Hidden hinges', 'Integrated lighting', 'Cable management',
  'Dovetail joints', 'Hand-finished', 'Custom sizing',
];

export function NamingWizard({
  productId: _productId,
  initialContext,
  existingNames = [],
  onComplete, 
  onClose,
}: NamingWizardProps) {
  const [step, setStep] = useState<WizardStep>('context');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Context form state
  const [context, setContext] = useState<NamingContext>({
    category: initialContext?.category || '',
    materials: initialContext?.materials || [],
    features: initialContext?.features || [],
    targetMarket: initialContext?.targetMarket || '',
    collectionHint: initialContext?.collectionHint || '',
  });
  
  // Candidates state
  const [candidates, setCandidates] = useState<NameCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<NameCandidate | null>(null);

  const handleGenerateNames = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await generateProductNames(context, undefined, existingNames);
      setCandidates(result.candidates);
      setStep('candidates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate names');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await generateProductNames(
        context, 
        'Generate completely different names from before. Be more creative.',
        [...existingNames, ...candidates.map(c => c.name)]
      );
      setCandidates(result.candidates);
      setSelectedCandidate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate names');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = () => {
    if (selectedCandidate) {
      onComplete(selectedCandidate.name, selectedCandidate.handle);
    }
  };

  const toggleMaterial = (material: string) => {
    setContext(prev => ({
      ...prev,
      materials: prev.materials.includes(material)
        ? prev.materials.filter(m => m !== material)
        : [...prev.materials, material],
    }));
  };

  const toggleFeature = (feature: string) => {
    setContext(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">AI Product Naming</h2>
              <p className="text-sm text-gray-500">
                {step === 'context' && 'Step 1: Define product context'}
                {step === 'candidates' && 'Step 2: Review name candidates'}
                {step === 'confirm' && 'Step 3: Confirm selection'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {(['context', 'candidates', 'confirm'] as WizardStep[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s 
                    ? 'bg-[#872E5C] text-white' 
                    : i < ['context', 'candidates', 'confirm'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {i < ['context', 'candidates', 'confirm'].indexOf(step) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && (
                  <div className={`w-16 h-1 mx-2 rounded ${
                    i < ['context', 'candidates', 'confirm'].indexOf(step)
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Context */}
          {step === 'context' && (
            <div className="space-y-6">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Category *
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setContext(prev => ({ ...prev, category: cat }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                        context.category === cat
                          ? 'bg-[#872E5C] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Materials */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Materials
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_MATERIALS.map(mat => (
                    <button
                      key={mat}
                      onClick={() => toggleMaterial(mat)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        context.materials.includes(mat)
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {mat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Features
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_FEATURES.map(feat => (
                    <button
                      key={feat}
                      onClick={() => toggleFeature(feat)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        context.features.includes(feat)
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {feat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Market */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Market
                </label>
                <input
                  type="text"
                  value={context.targetMarket || ''}
                  onChange={(e) => setContext(prev => ({ ...prev, targetMarket: e.target.value }))}
                  placeholder="e.g., Luxury residential, Commercial offices"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                />
              </div>

              {/* Collection Hint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collection/Series Hint (optional)
                </label>
                <input
                  type="text"
                  value={context.collectionHint || ''}
                  onChange={(e) => setContext(prev => ({ ...prev, collectionHint: e.target.value }))}
                  placeholder="e.g., Inspired by Scandinavian design"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Step 2: Candidates */}
          {step === 'candidates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Select a name for your product. Click on a card to select it.
                </p>
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Generate New Names
                </button>
              </div>

              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
                  <p className="text-gray-600">Generating name candidates...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidates.map((candidate, index) => (
                    <NameCandidateCard
                      key={`${candidate.handle}-${index}`}
                      candidate={candidate}
                      isSelected={selectedCandidate?.handle === candidate.handle}
                      onSelect={() => setSelectedCandidate(candidate)}
                      showRegenerate={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedCandidate && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedCandidate.name}
                </h3>
                <p className="text-gray-500 font-mono">/{selectedCandidate.handle}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-medium text-gray-900 mb-2">Why this name works:</h4>
                <p className="text-gray-600">{selectedCandidate.rationale}</p>
              </div>

              <KPIGrid cols={3}>
                <KPICard label="Brand Fit" value={selectedCandidate.scores.brandFit} />
                <KPICard label="SEO Score" value={selectedCandidate.scores.seoScore} />
                <KPICard label="Uniqueness" value={selectedCandidate.scores.uniqueness} />
              </KPIGrid>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This name will be applied to your product. 
                  You can always change it later.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button
            onClick={() => {
              if (step === 'candidates') setStep('context');
              if (step === 'confirm') setStep('candidates');
            }}
            disabled={step === 'context'}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>

            {step === 'context' && (
              <button
                onClick={handleGenerateNames}
                disabled={!context.category || isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6a2449] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Names
              </button>
            )}

            {step === 'candidates' && (
              <button
                onClick={() => setStep('confirm')}
                disabled={!selectedCandidate}
                className="flex items-center gap-2 px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6a2449] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 'confirm' && (
              <button
                onClick={handleConfirm}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Check className="w-4 h-4" />
                Apply Name
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NamingWizard;
