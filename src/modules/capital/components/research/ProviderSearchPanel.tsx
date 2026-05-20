/**
 * ProviderSearchPanel
 * Search input + filter dropdowns + quick-search chips for AI provider research.
 * Includes manual provider entry for direct scanning/enrichment.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Search, Loader2, X, Sparkles, Building2 } from 'lucide-react';
import { useProviderResearch } from '../../hooks/useProviderResearch';
import { PROVIDER_TYPE_LABELS, PRODUCT_TYPE_LABELS } from '../../constants/capital.constants';
import type { ProviderType, CapitalProductType } from '../../types/capital.types';
import { ProviderSearchResults } from './ProviderSearchResults';
import { EnrichmentPanel } from './EnrichmentPanel';

const QUICK_SEARCHES = [
  'Banks offering SME loans in Uganda',
  'DFIs for manufacturing companies',
  'Asset finance for equipment purchases',
  'Trade finance and LPO financing Uganda',
  'Microfinance institutions Kampala',
  'Fintech lenders East Africa',
  'Government grants for SMEs in Uganda',
  'Tax incentives for manufacturing Uganda',
  'Grants for women-owned businesses East Africa',
  'Development partner grants and subsidies Uganda',
];

interface ProviderSearchPanelProps {
  companyId: string;
  onProductsSaved?: () => void;
}

export function ProviderSearchPanel({ companyId, onProductsSaved }: ProviderSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [providerTypeFilter, setProviderTypeFilter] = useState<ProviderType | ''>('');
  const [productTypeFilter, setProductTypeFilter] = useState<CapitalProductType | ''>('');
  const [manualProviderName, setManualProviderName] = useState('');
  const [manualProviderType, setManualProviderType] = useState<ProviderType>('bank');

  const {
    searchResults,
    enrichedProvider,
    enrichedProduct,
    isSearching,
    isEnrichingProvider,
    isEnrichingProduct,
    isSaving,
    error,
    search,
    enrichProviderProfile,
    enrichProductDetail,
    saveProduct,
    saveAllProducts,
    clearResults,
  } = useProviderResearch();

  const handleSearch = (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    search({
      query: q.trim(),
      filters: {
        ...(providerTypeFilter ? { providerType: providerTypeFilter } : {}),
        ...(productTypeFilter ? { productType: productTypeFilter } : {}),
      },
    });
  };

  const handleManualEnrich = () => {
    if (!manualProviderName.trim()) return;
    enrichProviderProfile({
      name: manualProviderName.trim(),
      providerType: manualProviderType,
    });
  };

  const handleSaveAllProducts = async (providerIndex: number) => {
    if (!searchResults) return;
    const provider = searchResults.providers[providerIndex];
    if (!provider) return;
    const saved = await saveAllProducts(companyId, provider);
    if (saved.length > 0) onProductsSaved?.();
  };

  const handleSaveProduct = async (providerIndex: number, productIndex: number) => {
    if (!searchResults) return;
    const provider = searchResults.providers[providerIndex];
    const product = provider?.products[productIndex];
    if (!provider || !product) return;
    const enrichedProd = {
      ...product,
      requirements: product.requirements?.map(r =>
        typeof r === 'string' ? { document: r, mandatory: true } : r
      ) || [],
    };
    const result = await saveProduct(companyId, provider, enrichedProd);
    if (result) onProductsSaved?.();
  };

  const handleEnrichProvider = (providerIndex: number) => {
    if (!searchResults) return;
    const provider = searchResults.providers[providerIndex];
    if (!provider) return;
    enrichProviderProfile({
      name: provider.name,
      providerType: provider.providerType,
      website: provider.website,
    });
  };

  const handleEnrichProduct = (providerName: string, productName: string, productType?: CapitalProductType) => {
    enrichProductDetail(providerName, productName, productType);
  };

  const handleSaveEnrichedProduct = async () => {
    if (!enrichedProvider || !enrichedProduct) return;
    const result = await saveProduct(companyId, enrichedProvider, enrichedProduct);
    if (result) onProductsSaved?.();
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for capital providers... (e.g., 'banks with asset finance in Uganda')"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={() => handleSearch()} disabled={isSearching || !query.trim()}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
            {searchResults && (
              <Button variant="ghost" size="icon" onClick={clearResults}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={providerTypeFilter}
              onChange={e => setProviderTypeFilter(e.target.value as ProviderType | '')}
              className="text-sm border rounded-md px-3 py-1.5 bg-background"
            >
              <option value="">All Provider Types</option>
              {Object.entries(PROVIDER_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={productTypeFilter}
              onChange={e => setProductTypeFilter(e.target.value as CapitalProductType | '')}
              className="text-sm border rounded-md px-3 py-1.5 bg-background"
            >
              <option value="">All Product Types</option>
              {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Quick Search Chips */}
          <div className="flex gap-2 flex-wrap">
            {QUICK_SEARCHES.map(suggestion => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                  handleSearch(suggestion);
                }}
                disabled={isSearching}
                className="text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Manual Provider Scan */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Scan a Specific Provider</span>
            <span className="text-xs text-muted-foreground">
              — Enter a provider name to discover their products
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter provider name (e.g., 'Stanbic Bank', 'Uganda Development Bank')"
              value={manualProviderName}
              onChange={e => setManualProviderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualEnrich()}
              className="flex-1"
            />
            <select
              value={manualProviderType}
              onChange={e => setManualProviderType(e.target.value as ProviderType)}
              className="text-sm border rounded-md px-3 py-1.5 bg-background"
            >
              {Object.entries(PROVIDER_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <Button
              onClick={handleManualEnrich}
              disabled={isEnrichingProvider || !manualProviderName.trim()}
            >
              {isEnrichingProvider ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isSearching && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-amber-600" />
            <p className="text-sm text-muted-foreground">
              Searching for capital providers... This may take a moment.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults && !isSearching && (
        <ProviderSearchResults
          results={searchResults}
          isSaving={isSaving}
          isEnrichingProvider={isEnrichingProvider}
          onEnrichProvider={handleEnrichProvider}
          onSaveAllProducts={handleSaveAllProducts}
          onSaveProduct={handleSaveProduct}
          onEnrichProduct={handleEnrichProduct}
        />
      )}

      {/* Enrichment Panel */}
      {(enrichedProvider || enrichedProduct || isEnrichingProvider || isEnrichingProduct) && (
        <EnrichmentPanel
          enrichedProvider={enrichedProvider}
          enrichedProduct={enrichedProduct}
          isEnrichingProvider={isEnrichingProvider}
          isEnrichingProduct={isEnrichingProduct}
          isSaving={isSaving}
          error={error}
          onSaveProduct={handleSaveEnrichedProduct}
          onEnrichProduct={handleEnrichProduct}
          onClose={() => clearResults()}
        />
      )}
    </div>
  );
}
