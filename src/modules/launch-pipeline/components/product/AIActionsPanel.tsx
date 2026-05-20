/**
 * AIActionsPanel
 * Inline AI enhancement actions for a single product
 * Shows status indicators and action buttons for AI-powered content generation
 */

import { useState } from 'react';
import {
  Sparkles,
  FileText,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import type { LaunchProduct } from '../../types/product.types';
import { aiService } from '../../services/aiService';
import { updateProduct } from '../../services/pipelineService';

interface AIActionsPanelProps {
  product: LaunchProduct;
  onProductUpdated?: () => void;
}

type ActionType = 'description' | 'seo' | 'naming' | 'all';

function StatusIndicator({ present }: { present: boolean }) {
  return present ? (
    <CheckCircle className="w-4 h-4 text-green-500" />
  ) : (
    <AlertCircle className="w-4 h-4 text-amber-500" />
  );
}

export function AIActionsPanel({ product, onProductUpdated }: AIActionsPanelProps) {
  const [loadingAction, setLoadingAction] = useState<ActionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasDescription = !!(product.aiContent?.shortDescription || product.aiContent?.fullDescription);
  const hasSEO = !!(product.seoMetadata?.metaTitle || product.aiContent?.metaDescription);
  const hasDiscovery = !!product.aiDiscovery;
  const hasBulletPoints = !!(product.aiContent?.bulletPoints?.length);

  const allEnhanced = hasDescription && hasSEO && hasDiscovery && hasBulletPoints;

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleGenerateDescription = async () => {
    setLoadingAction('description');
    setError(null);
    try {
      const content = await aiService.generateContentFromProduct(
        product,
        ['short', 'full', 'bullets', 'faqs'],
        'professional'
      );
      await updateProduct(product.id, {
        aiContent: {
          shortDescription: content.shortDescription || product.aiContent?.shortDescription || '',
          fullDescription: content.fullDescription || product.aiContent?.fullDescription || '',
          metaDescription: product.aiContent?.metaDescription || '',
          bulletPoints: content.bulletPoints || product.aiContent?.bulletPoints || [],
          faqs: content.faqs || product.aiContent?.faqs || [],
          altTexts: product.aiContent?.altTexts || [],
          generatedAt: Timestamp.now(),
          modelVersion: 'gemini-2.5-flash',
          editedByUser: false,
        },
      });
      showSuccess('Description generated');
      onProductUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate description');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGenerateSEO = async () => {
    setLoadingAction('seo');
    setError(null);
    try {
      const [content, discovery] = await Promise.all([
        aiService.generateContentFromProduct(product, ['meta'], 'professional'),
        aiService.generateDiscoverabilityData(product),
      ]);

      const updates: Partial<LaunchProduct> = {};

      if (content.metaDescription) {
        updates.aiContent = {
          shortDescription: product.aiContent?.shortDescription || '',
          fullDescription: product.aiContent?.fullDescription || '',
          metaDescription: content.metaDescription,
          bulletPoints: product.aiContent?.bulletPoints || [],
          faqs: product.aiContent?.faqs || [],
          altTexts: product.aiContent?.altTexts || [],
          generatedAt: Timestamp.now(),
          modelVersion: 'gemini-2.5-flash',
          editedByUser: false,
        };
      }

      if (discovery) {
        updates.aiDiscovery = discovery;
        updates.seoMetadata = {
          metaTitle: product.name,
          metaDescription: content.metaDescription || product.seoMetadata?.metaDescription || '',
          keywords: discovery.searchKeywords || product.seoMetadata?.keywords || [],
        };
      }

      await updateProduct(product.id, updates);
      showSuccess('SEO data generated');
      onProductUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate SEO data');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEnhanceAll = async () => {
    setLoadingAction('all');
    setError(null);
    try {
      const [content, discovery] = await Promise.all([
        aiService.generateContentFromProduct(product, ['short', 'full', 'meta', 'bullets', 'faqs'], 'professional'),
        aiService.generateDiscoverabilityData(product),
      ]);

      await updateProduct(product.id, {
        aiContent: {
          shortDescription: content.shortDescription || product.aiContent?.shortDescription || '',
          fullDescription: content.fullDescription || product.aiContent?.fullDescription || '',
          metaDescription: content.metaDescription || product.aiContent?.metaDescription || '',
          bulletPoints: content.bulletPoints || product.aiContent?.bulletPoints || [],
          faqs: content.faqs || product.aiContent?.faqs || [],
          altTexts: product.aiContent?.altTexts || [],
          generatedAt: Timestamp.now(),
          modelVersion: 'gemini-2.5-flash',
          editedByUser: false,
        },
        aiDiscovery: discovery,
        seoMetadata: {
          metaTitle: product.name,
          metaDescription: content.metaDescription || '',
          keywords: discovery.searchKeywords || [],
        },
      });
      showSuccess('All content enhanced');
      onProductUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance product');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI Enhancement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <StatusIndicator present={hasDescription} />
              <span className="text-gray-700">Description & Bullet Points</span>
            </div>
            <span className="text-xs text-gray-500">{hasDescription ? 'Generated' : 'Missing'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <StatusIndicator present={hasSEO} />
              <span className="text-gray-700">SEO Metadata</span>
            </div>
            <span className="text-xs text-gray-500">{hasSEO ? 'Generated' : 'Missing'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <StatusIndicator present={hasDiscovery} />
              <span className="text-gray-700">Discoverability Data</span>
            </div>
            <span className="text-xs text-gray-500">{hasDiscovery ? 'Generated' : 'Missing'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t">
          {!allEnhanced && (
            <Button
              onClick={handleEnhanceAll}
              disabled={!!loadingAction}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              {loadingAction === 'all' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Enhance All Content
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateDescription}
              disabled={!!loadingAction}
            >
              {loadingAction === 'description' ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 mr-1.5" />
              )}
              Description
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSEO}
              disabled={!!loadingAction}
            >
              {loadingAction === 'seo' ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5 mr-1.5" />
              )}
              SEO Data
            </Button>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {successMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIActionsPanel;
