/**
 * ClientCreatePage
 * Form to create a new client (shared across all subsidiaries)
 */

import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Building2, User } from 'lucide-react';
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
import { createClient } from '@/subsidiaries/advisory/advisory/services/client-service';
import type { ClientType, ClientTier } from '@/subsidiaries/advisory/advisory/types';

const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: 'hnwi', label: 'Individual (HNWI)' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'institutional', label: 'Institution' },
  { value: 'government', label: 'Government' },
  { value: 'endowment', label: 'Endowment / Foundation' },
  { value: 'dfi', label: 'DFI / Development Finance' },
  { value: 'fund_of_funds', label: 'Fund of Funds' },
  { value: 'other', label: 'Other' },
];

const CLIENT_TIERS: { value: ClientTier; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'professional', label: 'Professional' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'strategic', label: 'Strategic' },
];

const COUNTRIES = [
  'Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Ethiopia', 
  'Nigeria', 'Ghana', 'South Africa', 'United States', 
  'United Kingdom', 'Other'
];

export default function ClientCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    legalName: '',
    tradingName: '',
    clientType: 'corporate' as ClientType,  // 'corporate' is valid
    tier: 'standard' as ClientTier,  // 'standard' is valid
    country: 'Uganda',
    city: '',
    email: '',
    phone: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.legalName.trim()) {
      setError('Legal name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const clientData = {
        legalName: formData.legalName.trim(),
        tradingName: formData.tradingName.trim() || undefined,
        clientType: formData.clientType,
        tier: formData.tier,
        status: 'prospect' as const,
        engagementId: '', // Will be linked when engagement is created
        jurisdiction: {
          country: formData.country,
          taxResidencies: [formData.country],
        },
        investorProfile: {
          investmentHorizon: 'long_term' as const,
          liquidityNeeds: 'low' as const,
          incomeRequirements: { requiresIncome: false },
        },
        riskProfile: {
          tolerance: 'moderate' as const,
          capacity: 'medium' as const,
          overallScore: 50,
        },
        mandates: [],
        compliance: {
          status: 'pending' as const,
          kyc: {
            status: 'not_started' as const,
            documents: [],
          },
          aml: {
            status: 'not_started' as const,
            riskRating: 'medium' as const,
          },
          taxCompliance: {
            status: 'pending' as const,
          },
          issues: [],
        },
        contacts: formData.email ? [{
          id: crypto.randomUUID(),
          name: formData.legalName,
          email: formData.email,
          phone: formData.phone || undefined,
          isPrimary: true,
          role: 'primary',
        }] : [],
        communicationPreferences: {
          preferredChannel: 'email' as const,
          frequency: 'monthly' as const,
          language: 'en',
        },
        totalCommitments: { amount: 0, currency: 'USD' },
        totalDeployed: { amount: 0, currency: 'USD' },
        unrealizedValue: { amount: 0, currency: 'USD' },
        realizedValue: { amount: 0, currency: 'USD' },
        portfolioIds: [],
        holdingIds: [],
        source: 'direct_inquiry' as const,
        notes: formData.notes || undefined,
      };

      const clientId = await createClient(clientData as any);
      navigate(`/clients/${clientId}`);
    } catch (err) {
      console.error('Failed to create client:', err);
      setError('Failed to create client. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>New Client | DawinOS</title>
      </Helmet>

      <div className="p-6 max-w-2xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/clients')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">New Client</h1>
          <p className="text-muted-foreground">
            Add a new client to the shared client database
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="legalName">Legal Name *</Label>
                <Input
                  id="legalName"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="Enter legal company/individual name"
                  required
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="tradingName">Trading Name (Optional)</Label>
                <Input
                  id="tradingName"
                  value={formData.tradingName}
                  onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                  placeholder="Enter trading/display name if different"
                />
              </div>

              <div>
                <Label htmlFor="clientType">Client Type</Label>
                <Select
                  value={formData.clientType}
                  onValueChange={(value) => setFormData({ ...formData, clientType: value as ClientType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tier">Client Tier</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(value) => setFormData({ ...formData, tier: value as ClientTier })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TIERS.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>
                        {tier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Location & Contact
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Enter city"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+256 700 000 000"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes about this client..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/clients')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Client
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
