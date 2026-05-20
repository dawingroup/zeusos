/**
 * FundLocationBadge
 *
 * Badge showing which office / fund location processed a payment.
 * Uses FUND_LOCATION_TYPE_CONFIG colours to distinguish HQ vs regional vs field.
 */

import { MapPin } from 'lucide-react';
import { FUND_LOCATION_TYPE_CONFIG } from '../../types/fund-location';
import type { FundLocationType } from '../../types/fund-location';

interface FundLocationBadgeProps {
  locationName?: string;
  locationType?: FundLocationType;
  className?: string;
}

export function FundLocationBadge({
  locationName,
  locationType,
  className = '',
}: FundLocationBadgeProps) {
  if (!locationName) return null;

  const config = locationType
    ? FUND_LOCATION_TYPE_CONFIG[locationType]
    : null;

  const colorClass = config
    ? `${config.color} ${config.bgColor}`
    : 'text-gray-600 bg-gray-100';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass} ${className}`}
    >
      <MapPin className="h-3 w-3 shrink-0" />
      {locationName}
    </span>
  );
}
