// ============================================================================
// DISCOVER COMPETITORS DIALOG
// ZeusOS v2.0 - Market Intelligence Module
// AI-driven competitor discovery — scans for direct, indirect & emerging
// competitors, presents candidates for user review before adding
// ============================================================================

import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent } from '@/core/components/ui/card';
// Using native checkbox - the ui/checkbox component is empty
import { ScrollArea } from '@/core/components/ui/scroll-area';
import {
  Loader2,
  Radar,
  Building2,
  Globe,
  MapPin,
  Users,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { CompetitorFormInput } from '../../types/competitor.types';
import { MODULE_COLOR } from '../../constants';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
interface DiscoveredCandidate {
  id: string;
  name: string;
  legalName: string | null;
  type: 'direct' | 'indirect' | 'emerging';
  description: string;
  website: string;
  threatLevel: string;
  industries: string[];
  products: string[];
  services: string[];
  headquarters: { city: string; country: string };
  companySize: string;
  estimatedEmployeeCount: number | null;
  estimatedRevenue: number | null;
  foundedYear: number | null;
  competitiveOverlap: string;
  strengths: string[];
  weaknesses: string[];
  confidence: number;
}

interface DiscoverCompetitorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCompetitors: (inputs: CompetitorFormInput[]) => Promise<void>;
  existingCompetitorNames: string[];
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------
const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  direct: { label: 'Direct', color: '#EF4444', icon: '🎯' },
  indirect: { label: 'Indirect', color: '#F59E0B', icon: '↔️' },
  emerging: { label: 'Emerging', color: '#10B981', icon: '🚀' },
};

const THREAT_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high: '#EF4444',
  moderate: '#F59E0B',
  low: '#22C55E',
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export const DiscoverCompetitorsDialog: React.FC<DiscoverCompetitorsDialogProps> = ({
  open,
  onOpenChange,
  onAddCompetitors,
  existingCompetitorNames,
}) => {
  // Scan form
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [products, setProducts] = useState('');
  const [services, setServices] = useState('');
  const [region, setRegion] = useState('Uganda and East Africa');
  const [description, setDescription] = useState('');

  // State
  const [step, setStep] = useState<'form' | 'scanning' | 'results'>('form');
  const [candidates, setCandidates] = useState<DiscoveredCandidate[]>([]);
  const [marketSummary, setMarketSummary] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleScan = async () => {
    if (!companyName.trim() || !industry.trim()) {
      setError('Company name and industry are required');
      return;
    }
    setError(null);
    setStep('scanning');

    try {
      const functions = getFunctions();
      const discoverFn = httpsCallable(functions, 'discoverCompetitors');
      const result = await discoverFn({
        companyName: companyName.trim(),
        industry: industry.trim(),
        products: products.split(',').map(p => p.trim()).filter(Boolean),
        services: services.split(',').map(s => s.trim()).filter(Boolean),
        region: region.trim() || 'Uganda and East Africa',
        description: description.trim(),
        existingCompetitorNames,
      });

      const data = result.data as {
        candidates: DiscoveredCandidate[];
        marketSummary: string;
      };

      setCandidates(data.candidates || []);
      setMarketSummary(data.marketSummary || '');
      setSelected(new Set());
      setStep('results');
    } catch (err) {
      console.error('Discover error:', err);
      setError(err instanceof Error ? err.message : 'Discovery scan failed');
      setStep('form');
    }
  };

  const handleAddSelected = async () => {
    const toAdd = candidates.filter(c => selected.has(c.id));
    if (!toAdd.length) return;

    setAdding(true);
    try {
      const inputs = toAdd.map(c => ({
        name: c.name,
        legalName: c.legalName || undefined,
        description: c.description,
        website: c.website,
        type: c.type === 'emerging' ? 'emerging' : c.type as 'direct' | 'indirect',
        threatLevel: (['critical', 'high', 'moderate', 'low'].includes(c.threatLevel)
          ? c.threatLevel
          : 'moderate') as 'critical' | 'high' | 'moderate' | 'low',
        industries: c.industries,
        geographies: [],
        companySize: (c.companySize || 'medium') as 'micro' | 'small' | 'medium' | 'large' | 'enterprise',
        revenueCurrency: 'USD',
        estimatedRevenue: c.estimatedRevenue || undefined,
        employeeCount: c.estimatedEmployeeCount || undefined,
        headquarters: c.headquarters || { city: '', country: '' },
        foundedYear: c.foundedYear || undefined,
        products: c.products || [],
        services: c.services || [],
        subsidiariesCompeting: [],
        monitoringFrequency: 'monthly',
      }));

      await onAddCompetitors(inputs as any);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add competitors');
    } finally {
      setAdding(false);
    }
  };

  const resetForm = () => {
    setStep('form');
    setCandidates([]);
    setSelected(new Set());
    setExpanded(new Set());
    setMarketSummary('');
    setError(null);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map(c => c.id)));
    }
  };

  const directCount = candidates.filter(c => c.type === 'direct').length;
  const indirectCount = candidates.filter(c => c.type === 'indirect').length;
  const emergingCount = candidates.filter(c => c.type === 'emerging').length;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5" style={{ color: MODULE_COLOR }} />
            {step === 'form' && 'Discover Competitors'}
            {step === 'scanning' && 'Scanning Market...'}
            {step === 'results' && `Found ${candidates.length} Competitors`}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && 'AI will scan the market to identify direct, indirect, and emerging competitors'}
            {step === 'scanning' && 'Gemini is searching the web for competitor intelligence...'}
            {step === 'results' && 'Review discovered competitors and select which ones to add'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-[var(--rag-red)] bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-md p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* STEP 1: Input Form */}
        {step === 'form' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="disc-company">Your Company Name *</Label>
                <Input
                  id="disc-company"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Zeus Group"
                />
              </div>
              <div>
                <Label htmlFor="disc-industry">Industry / Sector *</Label>
                <Input
                  id="disc-industry"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  placeholder="e.g. Furniture Manufacturing"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="disc-products">Products (comma-separated)</Label>
                <Input
                  id="disc-products"
                  value={products}
                  onChange={e => setProducts(e.target.value)}
                  placeholder="e.g. Office furniture, Kitchen cabinets"
                />
              </div>
              <div>
                <Label htmlFor="disc-services">Services (comma-separated)</Label>
                <Input
                  id="disc-services"
                  value={services}
                  onChange={e => setServices(e.target.value)}
                  placeholder="e.g. Interior design, Custom millwork"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="disc-region">Target Region</Label>
              <Input
                id="disc-region"
                value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder="Uganda and East Africa"
              />
            </div>

            <div>
              <Label htmlFor="disc-desc">Business Description (optional)</Label>
              <Textarea
                id="disc-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of your company to help AI better identify competitors..."
                rows={3}
              />
            </div>

            {existingCompetitorNames.length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                <strong>{existingCompetitorNames.length}</strong> already-tracked competitors will be excluded from results
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Scanning Animation */}
        {step === 'scanning' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <Radar className="h-16 w-16 animate-pulse" style={{ color: MODULE_COLOR }} />
              <Sparkles className="h-6 w-6 absolute -top-1 -right-1 text-[var(--rag-amber)] animate-bounce" />
            </div>
            <p className="mt-6 font-medium text-lg">Scanning the competitive landscape...</p>
            <p className="text-muted-foreground text-sm mt-1">Gemini is searching the web for competitors in your market</p>
            <div className="flex gap-2 mt-4">
              <Badge variant="outline">Direct competitors</Badge>
              <Badge variant="outline">Indirect competitors</Badge>
              <Badge variant="outline">Emerging players</Badge>
            </div>
          </div>
        )}

        {/* STEP 3: Results */}
        {step === 'results' && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Market Summary */}
            {marketSummary && (
              <div className="text-sm bg-muted/50 rounded-lg p-3 border">
                <strong className="text-xs uppercase tracking-wide text-muted-foreground">Market Summary</strong>
                <p className="mt-1">{marketSummary}</p>
              </div>
            )}

            {/* Stats Bar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <Badge style={{ backgroundColor: `${TYPE_CONFIG.direct.color}20`, color: TYPE_CONFIG.direct.color }}>
                  {TYPE_CONFIG.direct.icon} {directCount} Direct
                </Badge>
                <Badge style={{ backgroundColor: `${TYPE_CONFIG.indirect.color}20`, color: TYPE_CONFIG.indirect.color }}>
                  {TYPE_CONFIG.indirect.icon} {indirectCount} Indirect
                </Badge>
                <Badge style={{ backgroundColor: `${TYPE_CONFIG.emerging.color}20`, color: TYPE_CONFIG.emerging.color }}>
                  {TYPE_CONFIG.emerging.icon} {emergingCount} Emerging
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selected.size === candidates.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {/* Candidate List */}
            <ScrollArea className="flex-1 max-h-[400px] pr-2">
              <div className="space-y-2">
                {candidates.map(candidate => {
                  const typeConf = TYPE_CONFIG[candidate.type] || TYPE_CONFIG.indirect;
                  const threatColor = THREAT_COLORS[candidate.threatLevel] || '#6B7280';
                  const isExpanded = expanded.has(candidate.id);
                  const isSelected = selected.has(candidate.id);

                  return (
                    <Card
                      key={candidate.id}
                      className={`transition-all ${isSelected ? 'ring-2' : 'hover:shadow-sm'}`}
                      style={isSelected ? { borderColor: MODULE_COLOR } as React.CSSProperties : {}}
                    >
                      <CardContent className="p-3">
                        {/* Main Row */}
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(candidate.id)}
                            className="mt-1 h-4 w-4 rounded border-[var(--border-default)] accent-current cursor-pointer"
                            style={{ accentColor: MODULE_COLOR }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{candidate.name}</span>
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ backgroundColor: `${typeConf.color}15`, color: typeConf.color, borderColor: typeConf.color }}
                              >
                                {typeConf.icon} {typeConf.label}
                              </Badge>
                              <Badge
                                className="text-xs"
                                style={{ backgroundColor: `${threatColor}20`, color: threatColor }}
                              >
                                {candidate.threatLevel}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {Math.round(candidate.confidence * 100)}% confidence
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{candidate.description}</p>

                            {/* Quick Info */}
                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                              {candidate.website && (
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {candidate.website.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}
                                </span>
                              )}
                              {candidate.headquarters?.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {candidate.headquarters.city}, {candidate.headquarters.country}
                                </span>
                              )}
                              {candidate.estimatedEmployeeCount && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {candidate.estimatedEmployeeCount.toLocaleString()} employees
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7"
                            onClick={() => toggleExpand(candidate.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t space-y-3 text-sm">
                            {candidate.competitiveOverlap && (
                              <div>
                                <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Competitive Overlap</span>
                                <p className="mt-0.5">{candidate.competitiveOverlap}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              {candidate.strengths.length > 0 && (
                                <div>
                                  <span className="font-medium text-xs uppercase tracking-wide text-[var(--rag-green)]">Strengths</span>
                                  <ul className="mt-0.5 space-y-0.5">
                                    {candidate.strengths.map((s, i) => (
                                      <li key={i} className="text-xs flex items-start gap-1">
                                        <CheckCircle2 className="h-3 w-3 text-[var(--rag-green)] mt-0.5 shrink-0" />
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {candidate.weaknesses.length > 0 && (
                                <div>
                                  <span className="font-medium text-xs uppercase tracking-wide text-[var(--rag-red)]">Weaknesses</span>
                                  <ul className="mt-0.5 space-y-0.5">
                                    {candidate.weaknesses.map((w, i) => (
                                      <li key={i} className="text-xs flex items-start gap-1">
                                        <AlertTriangle className="h-3 w-3 text-[var(--rag-red)] mt-0.5 shrink-0" />
                                        {w}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            {candidate.products.length > 0 && (
                              <div>
                                <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Products</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {candidate.products.map(p => (
                                    <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {candidate.services.length > 0 && (
                              <div>
                                <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Services</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {candidate.services.map(s => (
                                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={handleScan}
                disabled={!companyName.trim() || !industry.trim()}
                style={{ backgroundColor: MODULE_COLOR }}
              >
                <Radar className="h-4 w-4 mr-2" />
                Scan for Competitors
              </Button>
            </>
          )}
          {step === 'results' && (
            <>
              <Button variant="outline" onClick={resetForm}>
                Scan Again
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={selected.size === 0 || adding}
                style={{ backgroundColor: MODULE_COLOR }}
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4 mr-2" />
                )}
                {adding ? 'Adding...' : `Add ${selected.size} Competitor${selected.size !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
