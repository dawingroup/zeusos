/**
 * ProviderSearchResults
 * Displays AI-discovered capital providers with their products.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  Building2,
  ExternalLink,
  Save,
  Loader2,
  Sparkles,
  Globe,
} from 'lucide-react';
import { StatusChip } from '../shared/StatusChip';
import { formatCurrency } from '../shared/CurrencyDisplay';
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_COLORS,
  PROVIDER_TYPE_LABELS,
  INTEREST_TYPE_LABELS,
} from '../../constants/capital.constants';
import type {
  ProviderSearchResponse,
  CapitalProductType,
} from '../../types/capital.types';

interface ProviderSearchResultsProps {
  results: ProviderSearchResponse;
  isSaving: boolean;
  isEnrichingProvider: boolean;
  onEnrichProvider: (providerIndex: number) => void;
  onSaveAllProducts: (providerIndex: number) => void;
  onSaveProduct: (providerIndex: number, productIndex: number) => void;
  onEnrichProduct: (providerName: string, productName: string, productType?: CapitalProductType) => void;
}

export function ProviderSearchResults({
  results,
  isSaving,
  isEnrichingProvider,
  onEnrichProvider,
  onSaveAllProducts,
  onSaveProduct,
  onEnrichProduct,
}: ProviderSearchResultsProps) {
  const [expandedProviders, setExpandedProviders] = useState<Set<number>>(new Set());

  const toggleProvider = (index: number) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (results.providers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No providers found. Try a different search query.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Found {results.providers.length} provider{results.providers.length !== 1 ? 's' : ''}
        </h3>
      </div>

      {results.providers.map((provider, providerIndex) => {
        const isExpanded = expandedProviders.has(providerIndex);
        return (
          <Card key={providerIndex} className="overflow-hidden">
            <CardHeader
              className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleProvider(providerIndex)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {provider.name}
                      {provider.website && (
                        <a
                          href={provider.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {PROVIDER_TYPE_LABELS[provider.providerType] || provider.providerType}
                      {provider.specializations?.length
                        ? ` · ${provider.specializations.join(', ')}`
                        : ''}
                    </p>
                    {provider.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {provider.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {provider.products.length} product{provider.products.length !== 1 ? 's' : ''}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-3">
                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEnrichProvider(providerIndex)}
                    disabled={isEnrichingProvider}
                  >
                    {isEnrichingProvider ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Enrich Profile
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSaveAllProducts(providerIndex)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Save All Products
                  </Button>
                </div>

                {/* Products */}
                <div className="space-y-2">
                  {provider.products.map((product, productIndex) => (
                    <div
                      key={productIndex}
                      className="border rounded-lg p-3 bg-muted/20 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{product.name}</span>
                            <StatusChip
                              label={PRODUCT_TYPE_LABELS[product.productType] || product.productType}
                              color={PRODUCT_TYPE_COLORS[product.productType] || '#666'}
                            />
                          </div>
                          {product.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onEnrichProduct(provider.name, product.name, product.productType)}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onSaveProduct(providerIndex, productIndex)}
                            disabled={isSaving}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {(product.minAmount || product.maxAmount) && (
                          <div>
                            <span className="text-muted-foreground block">Amount</span>
                            <span className="font-medium">
                              {product.minAmount
                                ? formatCurrency(product.minAmount, product.currency, true)
                                : '—'}
                              {' – '}
                              {product.maxAmount
                                ? formatCurrency(product.maxAmount, product.currency, true)
                                : '—'}
                            </span>
                          </div>
                        )}
                        {product.interestRate !== undefined && (
                          <div>
                            <span className="text-muted-foreground block">Rate</span>
                            <span className="font-medium">
                              {product.interestRate}% p.a.
                              {product.interestType && (
                                <span className="text-muted-foreground ml-1">
                                  ({INTEREST_TYPE_LABELS[product.interestType] || product.interestType})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {(product.tenorMinMonths || product.tenorMaxMonths) && (
                          <div>
                            <span className="text-muted-foreground block">Tenor</span>
                            <span className="font-medium">
                              {product.tenorMinMonths ?? '—'} – {product.tenorMaxMonths ?? '—'} months
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground block">Collateral</span>
                          <span className="font-medium">
                            {product.collateralRequired ? 'Required' : 'Not required'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Contact info */}
                {provider.contactInfo && (
                  <div className="text-xs text-muted-foreground border-t pt-2 flex gap-4">
                    {provider.contactInfo.phone && <span>Tel: {provider.contactInfo.phone}</span>}
                    {provider.contactInfo.email && <span>Email: {provider.contactInfo.email}</span>}
                    {provider.contactInfo.address && <span>{provider.contactInfo.address}</span>}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Grounding Sources */}
      {results.sources?.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Globe className="h-3.5 w-3.5" />
            Sources
          </div>
          <div className="flex flex-wrap gap-2">
            {results.sources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {source.title || source.url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
