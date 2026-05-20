/**
 * EnrichmentPanel
 * Displays enriched provider profile and product detail from AI research.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import {
  Loader2,
  Save,
  X,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Newspaper,
  Sparkles,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { StatusChip } from '../shared/StatusChip';
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_COLORS,
  PROVIDER_TYPE_LABELS,
} from '../../constants/capital.constants';
import type {
  EnrichedProviderProfile,
  EnrichedProductDetail,
  CapitalProductType,
} from '../../types/capital.types';

interface EnrichmentPanelProps {
  enrichedProvider: EnrichedProviderProfile | null;
  enrichedProduct: EnrichedProductDetail | null;
  isEnrichingProvider: boolean;
  isEnrichingProduct: boolean;
  isSaving: boolean;
  error?: string | null;
  onSaveProduct: () => void;
  onEnrichProduct: (providerName: string, productName: string, productType?: CapitalProductType) => void;
  onClose: () => void;
}

export function EnrichmentPanel({
  enrichedProvider,
  enrichedProduct,
  isEnrichingProvider,
  isEnrichingProduct,
  isSaving,
  error,
  onSaveProduct,
  onEnrichProduct,
  onClose,
}: EnrichmentPanelProps) {
  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600" />
            AI Enrichment
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Loading states */}
        {isEnrichingProvider && (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-amber-600" />
            <p className="text-sm text-muted-foreground">Researching provider profile...</p>
          </div>
        )}

        {isEnrichingProduct && (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-amber-600" />
            <p className="text-sm text-muted-foreground">Researching product details...</p>
          </div>
        )}

        {/* Enriched Provider Profile */}
        {enrichedProvider && !isEnrichingProvider && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">{enrichedProvider.fullName}</h3>
                <p className="text-sm text-muted-foreground">
                  {PROVIDER_TYPE_LABELS[enrichedProvider.providerType] || enrichedProvider.providerType}
                  {enrichedProvider.yearEstablished && ` · Est. ${enrichedProvider.yearEstablished}`}
                  {enrichedProvider.regulatedBy && ` · Regulated by ${enrichedProvider.regulatedBy}`}
                </p>
                {enrichedProvider.description && (
                  <p className="text-sm mt-2">{enrichedProvider.description}</p>
                )}
              </div>
            </div>

            {/* Headquarters */}
            {enrichedProvider.headquarters && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  {enrichedProvider.headquarters.address}, {enrichedProvider.headquarters.city},{' '}
                  {enrichedProvider.headquarters.country}
                </span>
              </div>
            )}

            {/* Contact Info */}
            {enrichedProvider.contactInfo && (
              <div className="space-y-1 text-sm">
                {enrichedProvider.contactInfo.generalPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {enrichedProvider.contactInfo.generalPhone}
                  </div>
                )}
                {enrichedProvider.contactInfo.generalEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {enrichedProvider.contactInfo.generalEmail}
                  </div>
                )}
                {enrichedProvider.contactInfo.smeUnit && (
                  <div className="ml-6 text-xs text-muted-foreground border-l-2 pl-3 mt-2">
                    <span className="font-medium text-foreground">SME Unit:</span>
                    {enrichedProvider.contactInfo.smeUnit.contactPerson && (
                      <span className="block">{enrichedProvider.contactInfo.smeUnit.contactPerson}</span>
                    )}
                    {enrichedProvider.contactInfo.smeUnit.phone && (
                      <span className="block">{enrichedProvider.contactInfo.smeUnit.phone}</span>
                    )}
                    {enrichedProvider.contactInfo.smeUnit.email && (
                      <span className="block">{enrichedProvider.contactInfo.smeUnit.email}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {enrichedProvider.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <a
                  href={enrichedProvider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {enrichedProvider.website}
                </a>
              </div>
            )}

            {/* Branches */}
            {enrichedProvider.branches && enrichedProvider.branches.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  Branches ({enrichedProvider.branches.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                  {enrichedProvider.branches.slice(0, 6).map((branch, i) => (
                    <span key={i} className="bg-muted/50 rounded px-2 py-1">
                      {branch.name} — {branch.city}
                    </span>
                  ))}
                  {enrichedProvider.branches.length > 6 && (
                    <span className="text-muted-foreground px-2 py-1">
                      +{enrichedProvider.branches.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Products from enriched profile */}
            {enrichedProvider.products?.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Products</h4>
                <div className="space-y-2">
                  {enrichedProvider.products.map((product, i) => (
                    <div key={i} className="border rounded-md p-2 bg-background flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusChip
                          label={PRODUCT_TYPE_LABELS[product.productType] || product.productType}
                          color={PRODUCT_TYPE_COLORS[product.productType] || '#666'}
                        />
                        <span className="text-sm font-medium">{product.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          onEnrichProduct(enrichedProvider.fullName, product.name, product.productType)
                        }
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent News */}
            {enrichedProvider.recentNews && enrichedProvider.recentNews.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Newspaper className="h-3.5 w-3.5" />
                  Recent News
                </h4>
                <div className="space-y-2">
                  {enrichedProvider.recentNews.map((news, i) => (
                    <div key={i} className="text-sm border-l-2 pl-3">
                      <div className="font-medium">
                        {news.url ? (
                          <a
                            href={news.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {news.title}
                          </a>
                        ) : (
                          news.title
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {news.date} — {news.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enriched Product Detail */}
        {enrichedProduct && !isEnrichingProduct && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{enrichedProduct.name}</h3>
                  <StatusChip
                    label={PRODUCT_TYPE_LABELS[enrichedProduct.productType] || enrichedProduct.productType}
                    color={PRODUCT_TYPE_COLORS[enrichedProduct.productType] || '#666'}
                  />
                </div>
                {enrichedProduct.description && (
                  <p className="text-sm text-muted-foreground mt-1">{enrichedProduct.description}</p>
                )}
              </div>
              <Button
                size="sm"
                onClick={onSaveProduct}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save to Catalog
              </Button>
            </div>

            {/* Terms Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {(enrichedProduct.minAmount || enrichedProduct.maxAmount) && (
                <div>
                  <span className="text-xs text-muted-foreground block">Amount Range</span>
                  <span className="font-medium">
                    {enrichedProduct.minAmount?.toLocaleString()} – {enrichedProduct.maxAmount?.toLocaleString()}{' '}
                    {enrichedProduct.currency}
                  </span>
                </div>
              )}
              {enrichedProduct.interestRate !== undefined && (
                <div>
                  <span className="text-xs text-muted-foreground block">Interest Rate</span>
                  <span className="font-medium">{enrichedProduct.interestRate}% p.a.</span>
                </div>
              )}
              {(enrichedProduct.tenorMinMonths || enrichedProduct.tenorMaxMonths) && (
                <div>
                  <span className="text-xs text-muted-foreground block">Tenor</span>
                  <span className="font-medium">
                    {enrichedProduct.tenorMinMonths ?? '—'} – {enrichedProduct.tenorMaxMonths ?? '—'} months
                  </span>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground block">Collateral</span>
                <span className="font-medium">
                  {enrichedProduct.collateralRequired ? 'Required' : 'Not required'}
                </span>
              </div>
              {enrichedProduct.processingFee !== undefined && (
                <div>
                  <span className="text-xs text-muted-foreground block">Processing Fee</span>
                  <span className="font-medium">{enrichedProduct.processingFee}%</span>
                </div>
              )}
            </div>

            {/* Collateral Types */}
            {enrichedProduct.collateralTypes && enrichedProduct.collateralTypes.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Accepted Collateral</span>
                <div className="flex flex-wrap gap-1.5">
                  {enrichedProduct.collateralTypes.map((type, i) => (
                    <span key={i} className="text-xs bg-muted rounded px-2 py-0.5">{type}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Requirements */}
            {enrichedProduct.requirements && enrichedProduct.requirements.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Requirements
                </h4>
                <div className="space-y-1">
                  {enrichedProduct.requirements.map((req, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                          req.mandatory ? 'text-amber-600' : 'text-muted-foreground'
                        }`}
                      />
                      <span>
                        {req.document}
                        {req.mandatory && <span className="text-xs text-amber-600 ml-1">(mandatory)</span>}
                        {req.description && (
                          <span className="text-xs text-muted-foreground block">{req.description}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Eligibility & Process */}
            {enrichedProduct.eligibilityCriteria && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Eligibility Criteria</h4>
                <p className="text-sm">{enrichedProduct.eligibilityCriteria}</p>
              </div>
            )}

            {enrichedProduct.applicationProcess && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Application Process</h4>
                <p className="text-sm">{enrichedProduct.applicationProcess}</p>
              </div>
            )}

            {enrichedProduct.typicalTimeline && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Typical timeline:</span>
                <span>{enrichedProduct.typicalTimeline}</span>
              </div>
            )}

            {/* Success Factors */}
            {enrichedProduct.successFactors && enrichedProduct.successFactors.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Success Factors</h4>
                <ul className="text-sm space-y-1">
                  {enrichedProduct.successFactors.map((factor, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
