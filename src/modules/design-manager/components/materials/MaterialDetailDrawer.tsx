/**
 * MaterialDetailDrawer Component
 * Side drawer showing full material details: info, dimensions, pricing,
 * cost analysis, inventory link, AI enhancement, and clip provenance.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { Badge } from '@/core/components/ui/badge';
import {
  Package,
  Ruler,
  DollarSign,
  Link2,
  Sparkles,
  ExternalLink,
  Boxes,
  TrendingUp,
  Ship,
  ArrowRightLeft,
  Wrench,
  Truck,
  Layers,
  Image,
  FileText,
  MessageCircle,
} from 'lucide-react';
import type { Material } from '../../types/materials';
import { MATERIAL_CATEGORIES, MATERIAL_UNITS } from '../../types/materials';
import {
  formatCurrency,
} from '@/modules/finance/constants/currency.constants';

interface MaterialDetailDrawerProps {
  material: Material | null;
  open: boolean;
  onClose: () => void;
}

export function MaterialDetailDrawer({ material, open, onClose }: MaterialDetailDrawerProps) {
  if (!material) return null;

  const categoryMeta = MATERIAL_CATEGORIES[material.category];
  const pricing = material.pricing;
  const dims = material.dimensions;
  const ai = material.aiEnhancement;
  const landed = pricing?.landedCostEstimate;

  const statusColor =
    material.status === 'active'
      ? 'bg-green-100 text-green-700'
      : material.status === 'discontinued'
        ? 'bg-gray-100 text-gray-600'
        : 'bg-amber-100 text-amber-700';

  const qualityColor =
    material.qualityTier === 'luxury'
      ? 'bg-purple-100 text-purple-700'
      : material.qualityTier === 'premium'
        ? 'bg-blue-100 text-blue-700'
        : material.qualityTier === 'standard'
          ? 'bg-gray-100 text-gray-700'
          : 'bg-orange-100 text-orange-700';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-3">
            {material.sourceImageUrl && (
              <img
                src={material.sourceImageUrl}
                alt={material.name}
                className="w-16 h-16 rounded-lg object-cover border"
              />
            )}
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight">{material.name}</SheetTitle>
              <SheetDescription className="font-mono text-xs mt-0.5">
                {material.code}
              </SheetDescription>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="outline" className="text-xs">
                  {categoryMeta?.icon} {categoryMeta?.label}
                </Badge>
                {material.subcategory && (
                  <Badge variant="outline" className="text-xs">
                    {material.subcategory}
                  </Badge>
                )}
                <Badge className={`text-xs ${statusColor}`}>
                  {material.status}
                </Badge>
                {material.qualityTier && (
                  <Badge className={`text-xs ${qualityColor}`}>
                    {material.qualityTier}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs capitalize">
                  {material.tier}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-3">
          <button
            onClick={() => {
              const phone = prompt('Enter WhatsApp number (e.g. +256XXXXXXXXX):');
              if (!phone) return;
              import('@/modules/whatsapp/services/designIntegrationService').then(
                ({ shareMaterialViaWhatsApp }) =>
                  shareMaterialViaWhatsApp(phone, {
                    name: material.name,
                    description: material.description,
                    imageUrl: material.sourceImageUrl,
                    price: pricing?.unitPrice
                      ? `${pricing.currency || 'USD'} ${pricing.unitPrice}`
                      : undefined,
                  }).catch((err) => console.error('WhatsApp share failed:', err))
              );
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Share via WhatsApp
          </button>
        </div>

        <div className="space-y-5 pt-5">
          {/* Description */}
          {material.description && (
            <Section icon={Package} title="Description">
              <p className="text-sm text-muted-foreground leading-relaxed">{material.description}</p>
            </Section>
          )}

          {/* Use Cases & Application */}
          {(material.functionalUse || material.useCases?.length || material.applicationAreas?.length) && (
            <Section icon={Wrench} title="Use Cases & Application">
              {material.functionalUse && (
                <DetailField label="Functional Use" value={material.functionalUse} className="capitalize" />
              )}
              {material.useCases && material.useCases.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground block mb-1">Use Cases</span>
                  <div className="flex flex-wrap gap-1">
                    {material.useCases.map((uc, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{uc}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {material.applicationAreas && material.applicationAreas.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground block mb-1">Application Areas</span>
                  <div className="flex flex-wrap gap-1">
                    {material.applicationAreas.map((area, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{area}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Supplier Info */}
          {(material.preferredSupplier || material.alternateSuppliers?.length) && (
            <Section icon={Truck} title="Supplier Info">
              {material.preferredSupplier && (
                <div className="grid grid-cols-2 gap-3">
                  <DetailField label="Preferred Supplier" value={material.preferredSupplier.name} />
                  {material.preferredSupplier.leadTimeDays != null && (
                    <DetailField label="Lead Time" value={`${material.preferredSupplier.leadTimeDays} days`} />
                  )}
                  {material.preferredSupplier.moq != null && (
                    <DetailField
                      label="MOQ"
                      value={`${material.preferredSupplier.moq} ${material.preferredSupplier.moqUnit || 'units'}`}
                    />
                  )}
                  {material.preferredSupplier.contactInfo && (
                    <DetailField label="Contact" value={material.preferredSupplier.contactInfo} />
                  )}
                </div>
              )}
              {material.alternateSuppliers && material.alternateSuppliers.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground block mb-1">Alternate Suppliers</span>
                  <div className="flex flex-wrap gap-1">
                    {material.alternateSuppliers.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Material Properties */}
          {material.properties && Object.values(material.properties).some(v => v != null) && (
            <Section icon={Layers} title="Properties">
              <div className="grid grid-cols-2 gap-3">
                {material.properties.weight != null && (
                  <DetailField label="Weight" value={`${material.properties.weight}`} />
                )}
                {material.properties.density != null && (
                  <DetailField label="Density" value={`${material.properties.density}`} />
                )}
                {material.properties.fireRating && (
                  <DetailField label="Fire Rating" value={material.properties.fireRating} />
                )}
                {material.properties.moistureResistance && (
                  <DetailField label="Moisture Resistance" value={material.properties.moistureResistance} />
                )}
                {material.properties.durabilityRating && (
                  <DetailField label="Durability" value={material.properties.durabilityRating} />
                )}
                {material.properties.colorCode && (
                  <DetailField label="Color Code" value={material.properties.colorCode} />
                )}
                {material.properties.finish && (
                  <DetailField label="Finish" value={material.properties.finish} />
                )}
                {material.properties.texture && (
                  <DetailField label="Texture" value={material.properties.texture} />
                )}
              </div>
            </Section>
          )}

          {/* Images & Datasheet */}
          {(material.images?.length || material.datasheetUrl) && (
            <Section icon={Image} title="Images & Datasheet">
              {material.images && material.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {material.images.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Material image ${i + 1}`}
                        className="w-full h-20 rounded border object-cover hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              )}
              {material.datasheetUrl && (
                <a
                  href={material.datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Datasheet
                </a>
              )}
            </Section>
          )}

          {/* Dimensions */}
          {dims && (dims.length || dims.width || dims.thickness) && (
            <Section icon={Ruler} title="Dimensions">
              <div className="grid grid-cols-3 gap-3">
                <DetailField label="Length" value={dims.length ? `${dims.length} mm` : '-'} />
                <DetailField label="Width" value={dims.width ? `${dims.width} mm` : '-'} />
                <DetailField label="Thickness" value={dims.thickness ? `${dims.thickness} mm` : '-'} />
              </div>
              {material.grainPattern && material.grainPattern !== 'none' && (
                <DetailField label="Grain Pattern" value={material.grainPattern} className="mt-2 capitalize" />
              )}
            </Section>
          )}

          {/* Pricing */}
          {pricing && (
            <Section icon={DollarSign} title="Pricing">
              <div className="grid grid-cols-3 gap-3">
                <DetailField
                  label="Unit Cost"
                  value={`${pricing.currency} ${formatCurrency(pricing.unitCost, pricing.currency)}`}
                />
                <DetailField
                  label="Unit"
                  value={MATERIAL_UNITS[pricing.unit] || pricing.unit}
                />
                <DetailField
                  label="Supplier"
                  value={pricing.supplier || '-'}
                />
              </div>

              {/* Functional Currency Conversion */}
              {pricing.functionalCurrencyCost != null && pricing.currency !== 'UGX' && (
                <div className="mt-3 rounded-md bg-muted/50 p-2.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    Functional Currency
                  </span>
                  <span className="text-sm font-medium">
                    {pricing.currency} {formatCurrency(pricing.unitCost, pricing.currency)}
                    {pricing.exchangeRate ? ` × ${formatCurrency(pricing.exchangeRate, 'UGX')}` : ''}
                    {' = '}
                    <span className="text-primary font-semibold">
                      UGX {formatCurrency(pricing.functionalCurrencyCost, 'UGX')}
                    </span>
                  </span>
                </div>
              )}

              {/* Landed Cost */}
              {landed && landed.total > 0 && (
                <div className="mt-3 rounded-md bg-muted/50 p-2.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                    <Ship className="h-3 w-3" />
                    Landed Cost Breakdown
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {landed.shipping != null && landed.shipping > 0 && (
                      <div>
                        <span className="text-muted-foreground block">Shipping</span>
                        <span className="font-medium">UGX {formatCurrency(landed.shipping, 'UGX')}</span>
                      </div>
                    )}
                    {landed.customs != null && landed.customs > 0 && (
                      <div>
                        <span className="text-muted-foreground block">Customs</span>
                        <span className="font-medium">UGX {formatCurrency(landed.customs, 'UGX')}</span>
                      </div>
                    )}
                    {landed.other != null && landed.other > 0 && (
                      <div>
                        <span className="text-muted-foreground block">Other</span>
                        <span className="font-medium">UGX {formatCurrency(landed.other, 'UGX')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t text-sm">
                    <span className="text-muted-foreground">Total Landed</span>
                    <span className="font-semibold">UGX {formatCurrency(landed.total, 'UGX')}</span>
                  </div>
                </div>
              )}

              {/* Margin & Selling Price */}
              {pricing.marginPercent != null && pricing.estimatedSellingPrice != null && (
                <div className="mt-3 rounded-md bg-muted/50 p-2.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3" />
                    Margin & Selling Price
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Target Margin</span>
                      <span className="font-medium">{pricing.marginPercent}%</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Est. Selling Price</span>
                      <span className="font-semibold text-primary">
                        UGX {formatCurrency(pricing.estimatedSellingPrice, 'UGX')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Inventory Link */}
          {material.inventoryItemId && (
            <Section icon={Link2} title="Inventory Link">
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="SKU" value={material.inventoryItemSku || material.inventoryItemId} />
                <DetailField
                  label="Linked"
                  value={
                    material.linkedAt
                      ? new Date(material.linkedAt.toDate()).toLocaleDateString()
                      : '-'
                  }
                />
              </div>
            </Section>
          )}

          {/* AI Enhancement */}
          {ai && (
            <Section icon={Sparkles} title="AI Enhancement">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <DetailField
                  label="Confidence"
                  value={`${Math.round(ai.confidence * 100)}%`}
                  className={
                    ai.confidence >= 0.8
                      ? 'text-green-700'
                      : ai.confidence >= 0.5
                        ? 'text-amber-700'
                        : 'text-red-700'
                  }
                />
                <DetailField
                  label="Strategy Fit"
                  value={`${ai.strategyAlignment}/100`}
                />
                <DetailField label="Model" value={ai.model} />
              </div>
              {ai.competitivePosition && (
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground block mb-0.5">Competitive Position</span>
                  <p className="text-sm leading-relaxed">{ai.competitivePosition}</p>
                </div>
              )}
              {ai.suggestedAlternatives && ai.suggestedAlternatives.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground block mb-1">Suggested Alternatives</span>
                  <div className="flex flex-wrap gap-1">
                    {ai.suggestedAlternatives.map((alt, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {alt}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {ai.notes && (
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">AI Notes</span>
                  <p className="text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded p-2">
                    {ai.notes}
                  </p>
                </div>
              )}
            </Section>
          )}

          {/* Source / Clip Provenance */}
          {material.sourceUrl && (
            <Section icon={ExternalLink} title="Source">
              <a
                href={material.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
              >
                {material.sourceUrl}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </Section>
          )}

          {/* Metadata */}
          <Section icon={Boxes} title="Metadata">
            <div className="grid grid-cols-2 gap-3">
              <DetailField
                label="Created"
                value={
                  material.createdAt
                    ? new Date(material.createdAt.toDate()).toLocaleDateString()
                    : '-'
                }
              />
              <DetailField label="Created By" value={material.createdBy || '-'} />
              <DetailField
                label="Updated"
                value={
                  material.updatedAt
                    ? new Date(material.updatedAt.toDate()).toLocaleDateString()
                    : '-'
                }
              />
              <DetailField label="Updated By" value={material.updatedBy || '-'} />
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Helper Sub-components
// ============================================

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium flex items-center gap-1.5 text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      <div className="pl-5.5">{children}</div>
    </div>
  );
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className={`text-sm font-medium ${className || ''}`}>{value}</span>
    </div>
  );
}
