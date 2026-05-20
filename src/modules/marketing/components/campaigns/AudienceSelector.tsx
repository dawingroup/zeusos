/**
 * AudienceSelector Component
 * UI for selecting and configuring campaign audience segments
 */

import { useState, useEffect } from 'react';
import { Users, Info, RefreshCw } from 'lucide-react';
import type { AudienceSegment } from '../../types';
import { estimateAudienceSize } from '../../services/audienceService';

interface AudienceSelectorProps {
  companyId: string;
  value: AudienceSegment;
  onChange: (segment: AudienceSegment) => void;
  onEstimateUpdate?: (estimate: number) => void;
}

export function AudienceSelector({ companyId, value, onChange, onEstimateUpdate }: AudienceSelectorProps) {
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);

  // Estimate audience size when segment changes
  useEffect(() => {
    const doEstimate = async () => {
      if (!companyId) return;

      setEstimating(true);
      try {
        const size = await estimateAudienceSize(companyId, value);
        setEstimate(size);
        onEstimateUpdate?.(size);
      } catch (error) {
        console.error('Failed to estimate audience size:', error);
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    };

    doEstimate();
  }, [companyId, value, onEstimateUpdate]);

  const handleSegmentTypeChange = (segmentType: 'all' | 'filters' | 'customer_ids') => {
    onChange({
      ...value,
      segmentType,
      filters: segmentType === 'filters' ? (value.filters || {}) : undefined,
      customerIds: segmentType === 'customer_ids' ? (value.customerIds || []) : undefined,
    });
  };

  const handleFilterChange = (filterKey: string, filterValue: any) => {
    onChange({
      ...value,
      filters: {
        ...value.filters,
        [filterKey]: filterValue || undefined,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Segment Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Audience Type
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="segmentType"
              value="all"
              checked={value.segmentType === 'all'}
              onChange={() => handleSegmentTypeChange('all')}
              className="text-primary focus:ring-primary"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">All Customers</div>
              <div className="text-xs text-gray-500">Target all customers in your database</div>
            </div>
          </label>

          <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="segmentType"
              value="filtered"
              checked={value.segmentType === 'filters'}
              onChange={() => handleSegmentTypeChange('filters')}
              className="text-primary focus:ring-primary"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Filtered Segment</div>
              <div className="text-xs text-gray-500">Target customers matching specific criteria</div>
            </div>
          </label>

          <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="segmentType"
              value="specific"
              checked={value.segmentType === 'customer_ids'}
              onChange={() => handleSegmentTypeChange('customer_ids')}
              className="text-primary focus:ring-primary"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Specific Customers</div>
              <div className="text-xs text-gray-500">Manually select individual customers</div>
            </div>
          </label>
        </div>
      </div>

      {/* Filters (when filtered type is selected) */}
      {value.segmentType === 'filters' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-gray-900">Audience Filters</h4>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Status
            </label>
            <select
              value={value.filters?.customerStatus?.[0] || ''}
              onChange={(e) => handleFilterChange('customerStatus', e.target.value ? [e.target.value] : undefined)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="prospect">Prospect</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Type
            </label>
            <select
              value={value.filters?.customerType?.[0] || ''}
              onChange={(e) => handleFilterChange('customerType', e.target.value ? [e.target.value] : undefined)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">All Types</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="contractor">Contractor</option>
              <option value="designer">Designer</option>
            </select>
          </div>

          {/* Tags Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={value.filters?.tags?.join(', ') || ''}
              onChange={(e) => {
                const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                handleFilterChange('tags', tags.length > 0 ? tags : undefined);
              }}
              placeholder="e.g., vip, premium"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* WhatsApp Filter */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.filters?.hasWhatsApp || false}
              onChange={(e) => handleFilterChange('hasWhatsApp', e.target.checked || undefined)}
              className="rounded text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700">Only customers with WhatsApp</span>
          </label>
        </div>
      )}

      {/* Specific Customers (when specific type is selected) */}
      {value.segmentType === 'customer_ids' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              Specific customer selection will be available in the next phase. For now, use filtered segments.
            </div>
          </div>
        </div>
      )}

      {/* Audience Estimate */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">Estimated Reach</span>
          </div>
          {estimating ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Calculating...
            </div>
          ) : estimate !== null ? (
            <div className="text-lg font-bold text-gray-900">
              {estimate.toLocaleString()} {estimate === 1 ? 'customer' : 'customers'}
            </div>
          ) : (
            <div className="text-sm text-gray-500">Unable to estimate</div>
          )}
        </div>
        {estimate !== null && estimate === 0 && (
          <div className="mt-2 text-xs text-orange-600">
            No customers match your criteria. Try adjusting your filters.
          </div>
        )}
      </div>
    </div>
  );
}

export default AudienceSelector;
