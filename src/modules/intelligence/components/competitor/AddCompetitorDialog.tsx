// ============================================================================
// ADD COMPETITOR DIALOG
// ZeusOS v2.0 - Market Intelligence Module
// Dialog form to add a new competitor to Firestore
// ============================================================================

import React, { useState } from 'react';
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

import { CompetitorFormInput } from '../../types/competitor.types';
import {
  COMPETITOR_TYPE_LABELS,
  THREAT_LEVEL_LABELS,
  INDUSTRY_LABELS,
  GEOGRAPHY_LABELS,
  COMPANY_SIZE_LABELS,
  CompetitorType,
  ThreatLevel,
  Industry,
  Geography,
  CompanySize,
} from '../../constants/competitor.constants';

interface AddCompetitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CompetitorFormInput, userId: string) => Promise<string>;
  userId: string;
}

const initialForm: CompetitorFormInput = {
  name: '',
  description: '',
  website: '',
  type: 'direct' as CompetitorType,
  threatLevel: 'moderate' as ThreatLevel,
  industries: [],
  geographies: ['uganda'] as Geography[],
  companySize: 'medium' as CompanySize,
  revenueCurrency: 'USD',
  headquarters: { city: '', country: 'Uganda' },
  products: [],
  services: [],
  subsidiariesCompeting: [],
  monitoringFrequency: 'monthly',
};

export const AddCompetitorDialog: React.FC<AddCompetitorDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  userId,
}) => {
  const [form, setForm] = useState<CompetitorFormInput>({ ...initialForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productInput, setProductInput] = useState('');
  const [serviceInput, setServiceInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Company name is required');
      return;
    }
    if (!form.description.trim() || form.description.length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }
    if (form.industries.length === 0) {
      setError('Select at least one industry');
      return;
    }
    if (!form.headquarters.city.trim()) {
      setError('Headquarters city is required');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(form, userId);
      setForm({ ...initialForm });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add competitor');
    } finally {
      setSaving(false);
    }
  };

  const addProduct = () => {
    if (productInput.trim()) {
      setForm(prev => ({ ...prev, products: [...prev.products, productInput.trim()] }));
      setProductInput('');
    }
  };

  const removeProduct = (index: number) => {
    setForm(prev => ({ ...prev, products: prev.products.filter((_, i) => i !== index) }));
  };

  const addService = () => {
    if (serviceInput.trim()) {
      setForm(prev => ({ ...prev, services: [...prev.services, serviceInput.trim()] }));
      setServiceInput('');
    }
  };

  const removeService = (index: number) => {
    setForm(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== index) }));
  };

  const toggleIndustry = (industry: Industry) => {
    setForm(prev => ({
      ...prev,
      industries: prev.industries.includes(industry)
        ? prev.industries.filter(i => i !== industry)
        : [...prev.industries, industry],
    }));
  };

  const toggleGeography = (geo: Geography) => {
    setForm(prev => ({
      ...prev,
      geographies: prev.geographies.includes(geo)
        ? prev.geographies.filter(g => g !== geo)
        : [...prev.geographies, geo],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Competitor</DialogTitle>
          <DialogDescription>
            Add a new competitor to track. After adding, you can discover their digital profiles automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. MTN Uganda"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the competitor..."
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Classification</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Competitor Type</Label>
                <Select
                  value={form.type}
                  onValueChange={v => setForm(prev => ({ ...prev, type: v as CompetitorType }))}
                >
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
                <Select
                  value={form.threatLevel}
                  onValueChange={v => setForm(prev => ({ ...prev, threatLevel: v as ThreatLevel }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(THREAT_LEVEL_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Company Size</Label>
                <Select
                  value={form.companySize}
                  onValueChange={v => setForm(prev => ({ ...prev, companySize: v as CompanySize }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPANY_SIZE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Monitoring Frequency</Label>
                <Select
                  value={form.monitoringFrequency}
                  onValueChange={v => setForm(prev => ({ ...prev, monitoringFrequency: v as 'weekly' | 'monthly' | 'quarterly' }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Industries */}
          <div className="space-y-2">
            <Label>Industries *</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
                <Badge
                  key={key}
                  variant={form.industries.includes(key as Industry) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleIndustry(key as Industry)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Geographies */}
          <div className="space-y-2">
            <Label>Geographies</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(GEOGRAPHY_LABELS).map(([key, label]) => (
                <Badge
                  key={key}
                  variant={form.geographies.includes(key as Geography) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleGeography(key as Geography)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Headquarters */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Headquarters</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hq-city">City *</Label>
                <Input
                  id="hq-city"
                  value={form.headquarters.city}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    headquarters: { ...prev.headquarters, city: e.target.value },
                  }))}
                  placeholder="Kampala"
                />
              </div>
              <div>
                <Label htmlFor="hq-country">Country</Label>
                <Input
                  id="hq-country"
                  value={form.headquarters.country}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    headquarters: { ...prev.headquarters, country: e.target.value },
                  }))}
                  placeholder="Uganda"
                />
              </div>
            </div>
          </div>

          {/* Products & Services */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Products & Services</h4>

            <div>
              <Label>Products</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={productInput}
                  onChange={e => setProductInput(e.target.value)}
                  placeholder="Add a product..."
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProduct(); } }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addProduct}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {form.products.map((p, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {p}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeProduct(i)} />
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Services</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={serviceInput}
                  onChange={e => setServiceInput(e.target.value)}
                  placeholder="Add a service..."
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addService}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {form.services.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {s}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeService(i)} />
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Financial (Optional) */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financial (Optional)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="revenue">Est. Revenue</Label>
                <Input
                  id="revenue"
                  type="number"
                  value={form.estimatedRevenue || ''}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    estimatedRevenue: e.target.value ? Number(e.target.value) : undefined,
                  }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="employees">Employees</Label>
                <Input
                  id="employees"
                  type="number"
                  value={form.employeeCount || ''}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    employeeCount: e.target.value ? Number(e.target.value) : undefined,
                  }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="founded">Founded Year</Label>
                <Input
                  id="founded"
                  type="number"
                  value={form.foundedYear || ''}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    foundedYear: e.target.value ? Number(e.target.value) : undefined,
                  }))}
                  placeholder="2010"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? 'Adding...' : 'Add Competitor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCompetitorDialog;
