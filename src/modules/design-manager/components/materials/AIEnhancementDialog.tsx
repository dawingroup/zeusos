/**
 * AIEnhancementDialog Component
 * Full dialog for reviewing AI-enhanced material data before adding to the library.
 * Shows clip preview on the left, editable AI-enhanced fields on the right.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  ArrowRightLeft,
  Ship,
  TrendingUp,
  Scale,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  enhanceClipToMaterial,
  convertClipToMaterial,
  type FirestoreClipRecord,
  type MaterialEnhancement,
} from '../../services/clipToMaterialService';
import { subscribeToGlobalMaterials } from '../../services/materialService';
import type { MaterialCategory, MaterialQualityTier } from '../../types/materials';
import { MATERIAL_CATEGORIES, MATERIAL_SUBCATEGORIES, MATERIAL_UNITS } from '../../types/materials';
import {
  EXCHANGE_RATES_TO_UGX,
  FUNCTIONAL_CURRENCY,
  formatCurrency,
} from '@/modules/finance/constants/currency.constants';
import { DEFAULT_ESTIMATE_CONFIG } from '../../types/estimate';

interface AIEnhancementDialogProps {
  open: boolean;
  clip: FirestoreClipRecord;
  userId: string;
  onClose: () => void;
  onComplete: () => void;
}

type EnhancementStep = 'analyzing' | 'review' | 'saving' | 'done' | 'error';

export function AIEnhancementDialog({
  open,
  clip,
  userId,
  onClose,
  onComplete,
}: AIEnhancementDialogProps) {
  const [step, setStep] = useState<EnhancementStep>('analyzing');
  const [enhancement, setEnhancement] = useState<MaterialEnhancement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable fields (populated from AI enhancement, user can modify)
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('other');
  const [qualityTier, setQualityTier] = useState<MaterialQualityTier>('standard');
  const [unitCost, setUnitCost] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [unit, setUnit] = useState('ea');
  const [subcategory, setSubcategory] = useState('');
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimThickness, setDimThickness] = useState('');

  // Cost analysis state
  const [exchangeRate, setExchangeRate] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [customsDuties, setCustomsDuties] = useState('');
  const [otherLandedCost, setOtherLandedCost] = useState('');
  const [marginPercent, setMarginPercent] = useState(
    String(Math.round(DEFAULT_ESTIMATE_CONFIG.defaultMarginPercent * 100)),
  );

  // Existing materials for price comparison (populated during enhancement)
  const [existingMaterials, setExistingMaterials] = useState<
    Array<{ name: string; category: string; unitCost?: number; currency?: string }>
  >([]);

  // Computed cost analysis values
  const isForeignCurrency = currency !== FUNCTIONAL_CURRENCY;
  const parsedUnitCost = parseFloat(unitCost) || 0;
  const parsedExchangeRate = parseFloat(exchangeRate) || 1;

  const functionalCost = useMemo(
    () => (isForeignCurrency ? Math.round(parsedUnitCost * parsedExchangeRate) : parsedUnitCost),
    [isForeignCurrency, parsedUnitCost, parsedExchangeRate],
  );

  const totalLandedCost = useMemo(
    () =>
      functionalCost +
      (parseFloat(shippingCost) || 0) +
      (parseFloat(customsDuties) || 0) +
      (parseFloat(otherLandedCost) || 0),
    [functionalCost, shippingCost, customsDuties, otherLandedCost],
  );

  const sellingPrice = useMemo(() => {
    const margin = parseFloat(marginPercent) || 0;
    if (margin >= 100 || margin < 0 || totalLandedCost <= 0) return 0;
    return Math.round(totalLandedCost / (1 - margin / 100));
  }, [totalLandedCost, marginPercent]);

  // Price comparison against existing materials in the same category
  const priceComparison = useMemo(() => {
    const sameCat = existingMaterials.filter(
      (m) => m.category === category && m.unitCost && m.unitCost > 0,
    );
    if (sameCat.length === 0) return null;

    // Normalize all to UGX for comparison
    const ugxCosts = sameCat.map((m) => {
      const rate = EXCHANGE_RATES_TO_UGX[m.currency || 'UGX'] ?? 1;
      return (m.unitCost || 0) * rate;
    });

    const min = Math.min(...ugxCosts);
    const max = Math.max(...ugxCosts);
    const avg = Math.round(ugxCosts.reduce((a, b) => a + b, 0) / ugxCosts.length);
    const thisCostUGX = functionalCost;

    let position: 'below' | 'near' | 'above' = 'near';
    if (thisCostUGX > 0) {
      if (thisCostUGX < avg * 0.85) position = 'below';
      else if (thisCostUGX > avg * 1.15) position = 'above';
    }

    return { min, max, avg, count: sameCat.length, position };
  }, [existingMaterials, category, functionalCost]);

  // Auto-fill exchange rate when currency changes
  useEffect(() => {
    if (isForeignCurrency) {
      setExchangeRate(String(EXCHANGE_RATES_TO_UGX[currency] ?? 1));
    }
  }, [currency, isForeignCurrency]);

  const runEnhancement = useCallback(async () => {
    setStep('analyzing');
    setError(null);

    try {
      // Fetch existing materials for competitive context & price comparison
      const fetchedMaterials = await new Promise<Array<{ name: string; category: string; qualityTier?: string; unitCost?: number; currency?: string }>>((resolve) => {
        const unsub = subscribeToGlobalMaterials((mats) => {
          unsub();
          resolve(
            mats.map((m) => ({
              name: m.name,
              category: m.category,
              unitCost: m.unitCost,
              currency: m.currency,
            })),
          );
        });
        // Timeout fallback
        setTimeout(() => resolve([]), 5000);
      });
      setExistingMaterials(fetchedMaterials);

      const result = await enhanceClipToMaterial(clip, {
        existingMaterials: fetchedMaterials,
      });

      setEnhancement(result);

      // Populate editable fields
      setName(result.name);
      setCode(result.code);
      setDescription(result.description);
      setCategory(result.category);
      setSubcategory(result.subcategory || '');
      setQualityTier(result.qualityTier);
      setUnitCost(result.pricing?.unitCost?.toString() ?? '');
      const rawCurrency = result.pricing?.currency ?? 'USD';
      const supportedCurrencies = ['USD', 'UGX', 'EUR', 'GBP', 'KES', 'AED', 'ZAR'];
      setCurrency(supportedCurrencies.includes(rawCurrency) ? rawCurrency : 'USD');
      setUnit(result.pricing?.unit ?? 'ea');
      setDimLength(result.dimensions?.length?.toString() ?? '');
      setDimWidth(result.dimensions?.width?.toString() ?? '');
      setDimThickness(result.dimensions?.thickness?.toString() ?? '');

      setStep('review');
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }, [clip]);

  useEffect(() => {
    if (open) {
      runEnhancement();
    }
  }, [open, runEnhancement]);

  const handleConfirm = async () => {
    if (!enhancement) return;

    setStep('saving');
    setError(null);

    try {
      // Build the user-edited enhancement
      const editedEnhancement: MaterialEnhancement = {
        ...enhancement,
        name,
        code,
        description,
        category,
        subcategory: subcategory || undefined,
        qualityTier,
        pricing:
          unitCost && parseFloat(unitCost) > 0
            ? {
                unitCost: parseFloat(unitCost),
                currency,
                unit,
                functionalCurrencyCost: isForeignCurrency ? functionalCost : undefined,
                exchangeRate: isForeignCurrency ? parsedExchangeRate : undefined,
                landedCostEstimate:
                  (parseFloat(shippingCost) || 0) + (parseFloat(customsDuties) || 0) + (parseFloat(otherLandedCost) || 0) > 0
                    ? {
                        shipping: parseFloat(shippingCost) || 0,
                        customs: parseFloat(customsDuties) || 0,
                        other: parseFloat(otherLandedCost) || 0,
                        total: totalLandedCost,
                      }
                    : undefined,
                marginPercent: parseFloat(marginPercent) || undefined,
                estimatedSellingPrice: sellingPrice > 0 ? sellingPrice : undefined,
              }
            : undefined,
        dimensions:
          dimLength || dimWidth || dimThickness
            ? {
                length: parseFloat(dimLength) || 0,
                width: parseFloat(dimWidth) || 0,
                thickness: parseFloat(dimThickness) || 0,
              }
            : undefined,
      };

      await convertClipToMaterial(clip.id, editedEnhancement, userId);
      setStep('done');

      // Brief delay to show success, then close
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  };

  const confidenceColor =
    enhancement && enhancement.confidence >= 0.8
      ? 'text-green-700 bg-green-50 border-green-200'
      : enhancement && enhancement.confidence >= 0.5
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-red-700 bg-red-50 border-red-200';

  const alignmentColor =
    enhancement && enhancement.strategyAlignment >= 70
      ? 'text-green-700'
      : enhancement && enhancement.strategyAlignment >= 40
        ? 'text-amber-700'
        : 'text-red-700';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Material Enhancement
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Analyzing State */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <div className="text-center">
                <h3 className="font-medium">Analyzing clip with AI</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Classifying material, assessing quality, profiling competitiveness...
                </p>
              </div>
            </div>
          )}

          {/* Success State */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div className="text-center">
                <h3 className="font-medium text-green-900">Material Added</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  &ldquo;{name}&rdquo; has been added to the Global Materials Library.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <AlertTriangle className="h-10 w-10 text-red-500" />
              <div className="text-center">
                <h3 className="font-medium text-red-900">Enhancement Failed</h3>
                <p className="text-sm text-red-700 mt-1 max-w-md">{error}</p>
              </div>
              <Button variant="outline" onClick={runEnhancement} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {/* Review State — Two column layout */}
          {(step === 'review' || step === 'saving') && enhancement && (
            <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* Left: Clip Preview */}
              <div className="lg:col-span-2 p-6 space-y-4 bg-muted/30">
                {clip.imageUrl && (
                  <img
                    src={clip.imageUrl}
                    alt={clip.title}
                    className="w-full rounded-lg border object-contain max-h-64"
                  />
                )}
                <div>
                  <h4 className="font-medium text-sm">{clip.title}</h4>
                  <a
                    href={clip.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View source page
                  </a>
                </div>

                {/* Raw clip data */}
                <div className="space-y-2 text-xs text-muted-foreground">
                  {clip.brand && <div><span className="font-medium text-foreground">Brand:</span> {clip.brand}</div>}
                  {clip.sku && <div><span className="font-medium text-foreground">SKU:</span> {clip.sku}</div>}
                  {clip.price && <div><span className="font-medium text-foreground">Price:</span> {clip.price.formatted || `${clip.price.amount} ${clip.price.currency || ''}`}</div>}
                  {clip.materials && clip.materials.length > 0 && (
                    <div><span className="font-medium text-foreground">Materials:</span> {clip.materials.join(', ')}</div>
                  )}
                  {clip.colors && clip.colors.length > 0 && (
                    <div><span className="font-medium text-foreground">Colors:</span> {clip.colors.join(', ')}</div>
                  )}
                </div>

                {/* AI Analysis Summary */}
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    AI Analysis
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={confidenceColor}>
                      {Math.round(enhancement.confidence * 100)}% confidence
                    </Badge>
                    <Badge variant="outline" className={`${alignmentColor} bg-transparent`}>
                      Strategy: {enhancement.strategyAlignment}/100
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {enhancement.competitivePosition}
                  </p>
                  {enhancement.suggestedAlternatives.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-foreground">Alternatives: </span>
                      {enhancement.suggestedAlternatives.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Editable Form */}
              <div className="lg:col-span-3 p-6 space-y-5">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Material Details (edit before adding)
                </h4>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={(v) => { setCategory(v as MaterialCategory); setSubcategory(''); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MATERIAL_CATEGORIES).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {MATERIAL_SUBCATEGORIES[category]?.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Subcategory</Label>
                      <Select value={subcategory} onValueChange={setSubcategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIAL_SUBCATEGORIES[category].map((sub) => (
                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>

                {/* Classification */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Quality Tier</Label>
                    <Select value={qualityTier} onValueChange={(v) => setQualityTier(v as MaterialQualityTier)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">Economy</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dimensions */}
                <div>
                  <Label className="mb-2 block">Dimensions (mm)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Length</span>
                      <Input type="number" value={dimLength} onChange={(e) => setDimLength(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Width</span>
                      <Input type="number" value={dimWidth} onChange={(e) => setDimWidth(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Thickness</span>
                      <Input type="number" value={dimThickness} onChange={(e) => setDimThickness(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <Label className="mb-2 block">Pricing</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Unit Cost</span>
                      <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Currency</span>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="UGX">UGX</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="KES">KES</SelectItem>
                          <SelectItem value="AED">AED</SelectItem>
                          <SelectItem value="ZAR">ZAR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Unit</span>
                      <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(MATERIAL_UNITS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* ===== Cost Analysis Panel ===== */}
                {parsedUnitCost > 0 && (
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-primary" />
                      Cost Analysis
                    </h4>

                    {/* A. Currency Conversion */}
                    {isForeignCurrency && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <ArrowRightLeft className="h-3 w-3" />
                          Functional Currency Conversion
                        </span>
                        <div className="grid grid-cols-3 gap-3 items-end">
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Exchange Rate (1 {currency} =)</span>
                            <Input
                              type="number"
                              value={exchangeRate}
                              onChange={(e) => setExchangeRate(e.target.value)}
                            />
                          </div>
                          <div className="col-span-2 rounded-md bg-muted/50 p-2.5">
                            <span className="text-xs text-muted-foreground block">UGX Equivalent</span>
                            <span className="text-sm font-semibold">
                              {currency} {formatCurrency(parsedUnitCost, currency)} &times; {formatCurrency(parsedExchangeRate, 'UGX')} ={' '}
                              <span className="text-primary">UGX {formatCurrency(functionalCost, 'UGX')}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* B. Landed Cost Estimate */}
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Ship className="h-3 w-3" />
                        Landed Cost Estimate (UGX)
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Shipping</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={shippingCost}
                            onChange={(e) => setShippingCost(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Customs & Duties</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={customsDuties}
                            onChange={(e) => setCustomsDuties(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Other</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={otherLandedCost}
                            onChange={(e) => setOtherLandedCost(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-muted/50 p-2.5 text-sm">
                        <span className="text-muted-foreground">Total Landed Cost</span>
                        <span className="font-semibold">UGX {formatCurrency(totalLandedCost, 'UGX')}</span>
                      </div>
                    </div>

                    {/* C. Margin & Selling Price */}
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Margin & Selling Price
                      </span>
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Target Margin %</span>
                          <Input
                            type="number"
                            value={marginPercent}
                            onChange={(e) => setMarginPercent(e.target.value)}
                          />
                        </div>
                        <div className="rounded-md bg-muted/50 p-2.5">
                          <span className="text-xs text-muted-foreground block">Est. Selling Price</span>
                          <span className="text-sm font-semibold text-primary">
                            UGX {formatCurrency(sellingPrice, 'UGX')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* D. Price Comparison */}
                    {priceComparison && functionalCost > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          Category Comparison ({priceComparison.count} materials)
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex-1 rounded-md bg-green-50 p-2 text-center">
                            <span className="text-muted-foreground block">Lowest</span>
                            <span className="font-medium text-green-700">UGX {formatCurrency(priceComparison.min, 'UGX')}</span>
                          </div>
                          <div className="flex-1 rounded-md bg-muted/50 p-2 text-center">
                            <span className="text-muted-foreground block">Average</span>
                            <span className="font-medium">UGX {formatCurrency(priceComparison.avg, 'UGX')}</span>
                          </div>
                          <div className={`flex-1 rounded-md p-2 text-center ${
                            priceComparison.position === 'below'
                              ? 'bg-green-50'
                              : priceComparison.position === 'above'
                                ? 'bg-red-50'
                                : 'bg-amber-50'
                          }`}>
                            <span className="text-muted-foreground block">This Material</span>
                            <span className={`font-medium ${
                              priceComparison.position === 'below'
                                ? 'text-green-700'
                                : priceComparison.position === 'above'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                            }`}>
                              UGX {formatCurrency(functionalCost, 'UGX')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Notes (read-only) */}
                {enhancement.aiNotes && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                    <span className="font-medium text-foreground text-xs">AI Notes</span>
                    <p className="leading-relaxed">{enhancement.aiNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — only show during review */}
        {(step === 'review' || step === 'saving') && (
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={onClose} disabled={step === 'saving'}>
              Cancel
            </Button>
            <Button variant="outline" onClick={runEnhancement} disabled={step === 'saving'} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Re-analyze
            </Button>
            <Button onClick={handleConfirm} disabled={step === 'saving' || !name.trim()}>
              {step === 'saving' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm & Add to Library
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
