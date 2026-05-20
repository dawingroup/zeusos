// ============================================================================
// EDIT COMPETITOR DIALOG
// DawinOS v2.0 - Market Intelligence Module
// Dialog form to edit an existing competitor in Firestore
// ============================================================================

import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Badge } from '@/core/components/ui/badge';
import { Loader2, X, Plus } from 'lucide-react';

import { Competitor, CompetitorFormInput } from '../../types/competitor.types';
import {
  COMPETITOR_TYPE_LABELS,
  THREAT_LEVEL_LABELS,
  INDUSTRY_LABELS,
  COMPANY_SIZE_LABELS,
  CompetitorType,
  ThreatLevel,
  Industry,
  Geography,
  CompanySize,
} from '../../constants/competitor.constants';

interface EditCompetitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, updates: Partial<CompetitorFormInput>) => Promise<void>;
  competitor: Competitor;
}

export const EditCompetitorDialog: React.FC<EditCompetitorDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  competitor,
}) => {
  const [form, setForm] = useState<CompetitorFormInput>({
    name: '',
    description: '',
    website: '',
    type: 'direct' as CompetitorType,
    threatLevel: 'moderate' as ThreatLevel,
    industries: [],
    geographies: ['uganda'] as Geography[],
    companySize: 'medium' as CompanySize,
    revenueCurrency: 'USD',
    estimatedRevenue: undefined,
    employeeCount: undefined,
    headquarters: { city: '', country: 'Uganda' },
    foundedYear: undefined,
    products: [],
    services: [],
    subsidiariesCompeting: [],
    monitoringFrequency: 'monthly',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState('');
  const [newService, setNewService] = useState('');

  // Populate form from competitor data
  useEffect(() => {
    if (competitor && open) {
      setForm({
        name: competitor.name || '',
        legalName: competitor.legalName,
        description: competitor.description || '',
        website: competitor.website || '',
        type: competitor.type,
        threatLevel: competitor.threatLevel,
        industries: competitor.industries || [],
        geographies: competitor.geographies || ['uganda'] as Geography[],
        companySize: competitor.companySize || 'medium' as CompanySize,
        revenueCurrency: competitor.revenueCurrency || 'USD',
        estimatedRevenue: competitor.estimatedRevenue,
        employeeCount: competitor.employeeCount,
        headquarters: competitor.headquarters || { city: '', country: 'Uganda' },
        foundedYear: competitor.foundedYear,
        products: competitor.products || [],
        services: competitor.services || [],
        subsidiariesCompeting: competitor.subsidiariesCompeting || [],
        monitoringFrequency: competitor.monitoringFrequency || 'monthly',
      });
      setError(null);
    }
  }, [competitor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Company name is required');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(competitor.id, form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update competitor');
    } finally {
      setSaving(false);
    }
  };

  const toggleIndustry = (industry: Industry) => {
    setForm(prev => ({
      ...prev,
      industries: prev.industries.includes(industry)
        ? prev.industries.filter(i => i !== industry)
        : [...prev.industries, industry],
    }));
  };

  const addProduct = () => {
    if (newProduct.trim() && !form.products.includes(newProduct.trim())) {
      setForm(prev => ({ ...prev, products: [...prev.products, newProduct.trim()] }));
      setNewProduct('');
    }
  };

  const addService = () => {
    if (newService.trim() && !form.services.includes(newService.trim())) {
      setForm(prev => ({ ...prev, services: [...prev.services, newService.trim()] }));
      setNewService('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Competitor</DialogTitle>
          <DialogDescription>
            Update competitor information for {competitor.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          {/* Name & Legal Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-name">Company Name *</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Company name"
              />
            </div>
            <div>
              <Label htmlFor="edit-legal">Legal Name</Label>
              <Input
                id="edit-legal"
                value={form.legalName || ''}
                onChange={(e) => setForm(prev => ({ ...prev, legalName: e.target.value }))}
                placeholder="Official legal name"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the competitor"
              rows={3}
            />
          </div>

          {/* Website & Founded Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                value={form.website || ''}
                onChange={(e) => setForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="edit-founded">Founded Year</Label>
              <Input
                id="edit-founded"
                type="number"
                value={form.foundedYear || ''}
                onChange={(e) => setForm(prev => ({ ...prev, foundedYear: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="2010"
              />
            </div>
          </div>

          {/* Type & Threat Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Competitor Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm(prev => ({ ...prev, type: v as CompetitorType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPETITOR_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Threat Level</Label>
              <Select value={form.threatLevel} onValueChange={(v) => setForm(prev => ({ ...prev, threatLevel: v as ThreatLevel }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(THREAT_LEVEL_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Size, Revenue, Employees */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Company Size</Label>
              <Select value={form.companySize} onValueChange={(v) => setForm(prev => ({ ...prev, companySize: v as CompanySize }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPANY_SIZE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-revenue">Est. Revenue (USD)</Label>
              <Input
                id="edit-revenue"
                type="number"
                value={form.estimatedRevenue || ''}
                onChange={(e) => setForm(prev => ({ ...prev, estimatedRevenue: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-employees">Employees</Label>
              <Input
                id="edit-employees"
                type="number"
                value={form.employeeCount || ''}
                onChange={(e) => setForm(prev => ({ ...prev, employeeCount: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          </div>

          {/* Headquarters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-city">HQ City</Label>
              <Input
                id="edit-city"
                value={form.headquarters.city}
                onChange={(e) => setForm(prev => ({ ...prev, headquarters: { ...prev.headquarters, city: e.target.value } }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-country">HQ Country</Label>
              <Input
                id="edit-country"
                value={form.headquarters.country}
                onChange={(e) => setForm(prev => ({ ...prev, headquarters: { ...prev.headquarters, country: e.target.value } }))}
              />
            </div>
          </div>

          {/* Industries */}
          <div>
            <Label>Industries</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {(Object.entries(INDUSTRY_LABELS) as [Industry, string][]).map(([key, label]) => (
                <Badge
                  key={key}
                  variant={form.industries.includes(key) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleIndustry(key)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <Label>Products</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                placeholder="Add product"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProduct())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addProduct}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.products.map((p) => (
                <Badge key={p} variant="secondary" className="gap-1">
                  {p}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(prev => ({ ...prev, products: prev.products.filter(x => x !== p) }))} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <Label>Services</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                placeholder="Add service"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addService}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {form.services.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1">
                  {s}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(prev => ({ ...prev, services: prev.services.filter(x => x !== s) }))} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Monitoring Frequency */}
          <div>
            <Label>Monitoring Frequency</Label>
            <Select value={form.monitoringFrequency} onValueChange={(v: 'weekly' | 'monthly' | 'quarterly') => setForm(prev => ({ ...prev, monitoringFrequency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
