/**
 * Location Card - Project location details with coordinates
 */

import { MapPin, ExternalLink, Globe } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface LocationCardProps {
  project: Project;
}

export function LocationCard({ project }: LocationCardProps) {
  const loc = project.location;
  if (!loc) {
    return (
      <BaseCard padding="lg">
        <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          Location
        </h3>
        <p className="text-sm text-gray-500">Location not specified</p>
      </BaseCard>
    );
  }

  const hasCoordinates = loc.coordinates?.latitude && loc.coordinates?.longitude;
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${loc.coordinates!.latitude},${loc.coordinates!.longitude}`
    : null;

  return (
    <BaseCard padding="lg">
      <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-gray-400" />
        Location
      </h3>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500">Site Name</div>
            <div className="text-sm font-medium text-gray-900">{loc.siteName || 'N/A'}</div>
          </div>
          {loc.address && (
            <div>
              <div className="text-xs text-gray-500">Address</div>
              <div className="text-sm text-gray-600">{loc.address}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500">District</div>
            <div className="text-sm font-medium text-gray-900">{loc.district || 'N/A'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Region</div>
            <div className="text-sm font-medium text-gray-900">{loc.region || 'N/A'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Country
            </div>
            <div className="text-sm font-medium text-gray-900">{loc.country || 'Uganda'}</div>
          </div>
        </div>

        {hasCoordinates && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Coordinates</div>
                <div className="text-sm text-gray-600 font-mono">
                  {loc.coordinates!.latitude.toFixed(6)}, {loc.coordinates!.longitude.toFixed(6)}
                </div>
              </div>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open in Maps <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
}
