/**
 * Deal Overview - Investment thesis and key information
 */

import { Target, TrendingUp, MapPin, Building2 } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  description?: string;
  investmentThesis?: string;
  sector: string;
  subsector?: string;
  dealType: string;
  geography: { country: string; region?: string; city?: string };
  investmentStructure: { type: string; equityPercentage?: number };
  targetInvestment: { amount: number; currency: string };
}

interface DealOverviewProps {
  deal: Deal;
}

function getCountryName(code: string): string {
  const names: Record<string, string> = {
    UG: 'Uganda',
    KE: 'Kenya',
    TZ: 'Tanzania',
    RW: 'Rwanda',
    ET: 'Ethiopia',
  };
  return names[code] || code;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export function DealOverview({ deal }: DealOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-3">Description</h3>
        <p className="text-gray-600">
          {deal.description || 'No description provided.'}
        </p>
      </div>

      {/* Investment Thesis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Investment Thesis</h3>
        </div>
        <p className="text-gray-600">
          {deal.investmentThesis || 'Investment thesis not documented yet.'}
        </p>
      </div>

      {/* Key Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Structure */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Investment Structure</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-medium capitalize">{deal.investmentStructure.type.replace(/_/g, ' ')}</span>
            </div>
            {deal.investmentStructure.equityPercentage && (
              <div className="flex justify-between">
                <span className="text-gray-500">Equity Stake</span>
                <span className="font-medium">{deal.investmentStructure.equityPercentage}%</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Target Amount</span>
              <span className="font-medium">{formatCurrency(deal.targetInvestment.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Deal Type</span>
              <span className="font-medium capitalize">{deal.dealType.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        {/* Geography */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold">Geography</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Country</span>
              <span className="font-medium">{getCountryName(deal.geography.country)}</span>
            </div>
            {deal.geography.region && (
              <div className="flex justify-between">
                <span className="text-gray-500">Region</span>
                <span className="font-medium">{deal.geography.region}</span>
              </div>
            )}
            {deal.geography.city && (
              <div className="flex justify-between">
                <span className="text-gray-500">City</span>
                <span className="font-medium">{deal.geography.city}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sector */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Sector</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Primary Sector</span>
              <span className="font-medium capitalize">{deal.sector}</span>
            </div>
            {deal.subsector && (
              <div className="flex justify-between">
                <span className="text-gray-500">Subsector</span>
                <span className="font-medium">{deal.subsector}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DealOverview;
