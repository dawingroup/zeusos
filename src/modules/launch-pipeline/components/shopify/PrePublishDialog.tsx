/**
 * PrePublishDialog
 * AI readiness check before Shopify publish
 * Shows checklist of requirements and offers AI fixes for gaps
 */

import { useState } from 'react';
import {
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Store,
  Loader2,
  Zap,
  FileText,
  Image,
  DollarSign,
  Search,
  Package,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/shared/components/ui/button';
import type { LaunchProduct } from '../../types/product.types';
import { aiService } from '../../services/aiService';
import { updateProduct } from '../../services/pipelineService';

interface PrePublishDialogProps {
  product: LaunchProduct;
  onPublish: () => Promise<void>;
  onClose: () => void;
}

interface CheckItem {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fixable: boolean;
  fixAction?: () => Promise<void>;
}

export function PrePublishDialog({ product, onPublish, onClose }: PrePublishDialogProps) {
  const [isFixing, setIsFixing] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [fixedItems, setFixedItems] = useState<Set<string>>(new Set());

  const hasDescription = !!(product.aiContent?.fullDescription || product.description);
  const hasImages = product.deliverables?.some(d => d.type === 'hero_images' && d.url);
  const imageCount = product.deliverables?.filter(d => ['hero_images', 'lifestyle_photos', 'detail_shots'].includes(d.type) && d.url).length || 0;
  const hasSEO = !!(product.seoMetadata?.metaTitle || product.aiContent?.metaDescription);
  const hasPricing = !!(product.pricing?.basePrice && product.pricing.basePrice > 0);
  const hasVariants = !!(product.variants?.length && product.variants.length > 0);

  const fixDescription = async () => {
    setIsFixing('description');
    try {
      const content = await aiService.generateContentFromProduct(product, ['short', 'full', 'bullets'], 'professional');
      await updateProduct(product.id, {
        aiContent: {
          shortDescription: content.shortDescription || '',
          fullDescription: content.fullDescription || '',
          metaDescription: product.aiContent?.metaDescription || '',
          bulletPoints: content.bulletPoints || [],
          faqs: content.faqs || product.aiContent?.faqs || [],
          altTexts: product.aiContent?.altTexts || [],
          generatedAt: Timestamp.now(),
          modelVersion: 'gemini-2.5-flash',
          editedByUser: false,
        },
      });
      setFixedItems(prev => new Set([...prev, 'description']));
    } catch (err) {
      console.error('Failed to fix description:', err);
    } finally {
      setIsFixing(null);
    }
  };

  const fixSEO = async () => {
    setIsFixing('seo');
    try {
      const [content, discovery] = await Promise.all([
        aiService.generateContentFromProduct(product, ['meta'], 'professional'),
        aiService.generateDiscoverabilityData(product),
      ]);
      await updateProduct(product.id, {
        seoMetadata: {
          metaTitle: product.name,
          metaDescription: content.metaDescription || '',
          keywords: discovery.searchKeywords || [],
        },
        aiDiscovery: discovery,
        aiContent: {
          shortDescription: product.aiContent?.shortDescription || '',
          fullDescription: product.aiContent?.fullDescription || '',
          metaDescription: content.metaDescription || product.aiContent?.metaDescription || '',
          bulletPoints: product.aiContent?.bulletPoints || [],
          faqs: product.aiContent?.faqs || [],
          altTexts: product.aiContent?.altTexts || [],
          generatedAt: Timestamp.now(),
          modelVersion: 'gemini-2.5-flash',
          editedByUser: false,
        },
      });
      setFixedItems(prev => new Set([...prev, 'seo']));
    } catch (err) {
      console.error('Failed to fix SEO:', err);
    } finally {
      setIsFixing(null);
    }
  };

  const fixAll = async () => {
    setIsFixing('all');
    try {
      const [content, discovery] = await Promise.all([
        aiService.generateContentFromProduct(product, ['short', 'full', 'meta', 'bullets', 'faqs'], 'professional'),
        aiService.generateDiscoverabilityData(product),
      ]);
      await updateProduct(product.id, {
        aiContent: {
          shortDescription: content.shortDescription || '',
          fullDescription: content.fullDescription || '',
          metaDescription: content.metaDescription || '',
          bulletPoints: content.bulletPoints || [],
          faqs: content.faqs || [],
          altTexts: product.aiContent?.altTexts || [],
          generatedAt: Timestamp.now(),
          modelVersion: 'gemini-2.5-flash',
          editedByUser: false,
        },
        seoMetadata: {
          metaTitle: product.name,
          metaDescription: content.metaDescription || '',
          keywords: discovery.searchKeywords || [],
        },
        aiDiscovery: discovery,
      });
      setFixedItems(prev => new Set([...prev, 'description', 'seo']));
    } catch (err) {
      console.error('Failed to fix all:', err);
    } finally {
      setIsFixing(null);
    }
  };

  const checks: CheckItem[] = [
    {
      id: 'description',
      label: 'Product Description',
      icon: FileText,
      status: hasDescription || fixedItems.has('description') ? 'pass' : 'fail',
      message: hasDescription || fixedItems.has('description')
        ? 'Description is ready'
        : 'Missing product description',
      fixable: true,
      fixAction: fixDescription,
    },
    {
      id: 'images',
      label: 'Product Images',
      icon: Image,
      status: hasImages ? (imageCount >= 3 ? 'pass' : 'warn') : 'fail',
      message: hasImages
        ? `${imageCount} image${imageCount !== 1 ? 's' : ''} uploaded${imageCount < 3 ? ' (3+ recommended)' : ''}`
        : 'No hero images uploaded',
      fixable: false,
    },
    {
      id: 'seo',
      label: 'SEO Metadata',
      icon: Search,
      status: hasSEO || fixedItems.has('seo') ? 'pass' : 'warn',
      message: hasSEO || fixedItems.has('seo')
        ? 'SEO metadata is set'
        : 'Missing SEO meta title/description',
      fixable: true,
      fixAction: fixSEO,
    },
    {
      id: 'pricing',
      label: 'Pricing',
      icon: DollarSign,
      status: hasPricing ? 'pass' : 'warn',
      message: hasPricing
        ? `${product.pricing!.currency} ${product.pricing!.basePrice.toFixed(2)}`
        : 'No pricing set (will publish as $0.00)',
      fixable: false,
    },
    {
      id: 'variants',
      label: 'Variants',
      icon: Package,
      status: hasVariants ? 'pass' : 'warn',
      message: hasVariants
        ? `${product.variants!.length} variant${product.variants!.length !== 1 ? 's' : ''} configured`
        : 'No variants (will publish as single variant)',
      fixable: false,
    },
  ];

  const hasBlockers = checks.some(c => c.status === 'fail' && !fixedItems.has(c.id));
  const hasFixableIssues = checks.some(c => c.status !== 'pass' && c.fixable && !fixedItems.has(c.id));
  const passCount = checks.filter(c => c.status === 'pass' || fixedItems.has(c.id)).length;

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
      onClose();
    } catch (err) {
      console.error('Publish failed:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#95BF47]/10 rounded-lg">
              <Store className="w-5 h-5 text-[#95BF47]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Publish to Shopify</h2>
              <p className="text-sm text-gray-500">{product.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Readiness Score */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Readiness</span>
            <span className="text-sm font-medium text-gray-900">{passCount}/{checks.length} checks passed</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${
                passCount === checks.length ? 'bg-green-500' : passCount >= 3 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${(passCount / checks.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="px-4 space-y-2 max-h-[400px] overflow-y-auto">
          {checks.map((check) => {
            const Icon = check.icon;
            const isFixed = fixedItems.has(check.id);
            const effectiveStatus = isFixed ? 'pass' : check.status;

            return (
              <div key={check.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                <div className={`p-1.5 rounded-lg ${
                  effectiveStatus === 'pass' ? 'bg-green-100' :
                  effectiveStatus === 'warn' ? 'bg-amber-100' :
                  'bg-red-100'
                }`}>
                  <Icon className={`w-4 h-4 ${
                    effectiveStatus === 'pass' ? 'text-green-600' :
                    effectiveStatus === 'warn' ? 'text-amber-600' :
                    'text-red-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{check.label}</p>
                  <p className="text-xs text-gray-500">{check.message}</p>
                </div>
                {effectiveStatus === 'pass' ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : check.fixable ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={check.fixAction}
                    disabled={!!isFixing}
                    className="text-xs flex-shrink-0"
                  >
                    {isFixing === check.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    Fix with AI
                  </Button>
                ) : effectiveStatus === 'warn' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="p-4 border-t space-y-3">
          {hasFixableIssues && (
            <Button
              onClick={fixAll}
              disabled={!!isFixing}
              variant="outline"
              className="w-full"
            >
              {isFixing === 'all' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Enhance All Missing with AI
            </Button>
          )}

          <Button
            onClick={handlePublish}
            disabled={hasBlockers || isPublishing || !!isFixing}
            className="w-full bg-[#95BF47] hover:bg-[#7EA83D] text-white"
          >
            {isPublishing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Store className="w-4 h-4 mr-2" />
            )}
            {isPublishing ? 'Publishing...' : hasBlockers ? 'Fix Issues to Publish' : 'Publish to Shopify'}
          </Button>

          {hasBlockers && (
            <p className="text-xs text-center text-red-600">
              Fix critical issues before publishing
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PrePublishDialog;
