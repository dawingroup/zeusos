// ============================================================================
// TAX PORTAL LINKS
// ZeusOS v2.0 - Financial Management Module
// Grid of tax portal quick-link cards organized by category
// ============================================================================

import { useState } from 'react';
import {
  ExternalLink,
  Plus,
  Trash2,
  Landmark,
  Shield,
  Building,
  Scale,
  CreditCard,
  Link,
  Globe,
  Receipt,
  FileText,
  FileCheck,
} from 'lucide-react';
import type { TaxPortalLink, TaxPortalCategory } from '../../types/integrations.types';
import {
  TAX_PORTAL_CATEGORIES,
} from '../../constants/integrations.constants';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Landmark,
  Shield,
  Building,
  Scale,
  CreditCard,
  Link,
  Globe,
  Receipt,
  FileText,
  FileCheck,
};

interface TaxPortalLinksProps {
  groupedByCategory: Record<TaxPortalCategory, TaxPortalLink[]>;
  loading: boolean;
  onAddLink: () => void;
  onDeleteLink: (linkId: string) => void;
}

export function TaxPortalLinks({
  groupedByCategory,
  loading,
  onAddLink,
  onDeleteLink,
}: TaxPortalLinksProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="animate-pulse h-28 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  const categories = Object.keys(groupedByCategory) as TaxPortalCategory[];

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Globe className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tax portal links configured</p>
        <button
          onClick={onAddLink}
          className="mt-3 text-green-600 text-sm hover:underline"
        >
          Add a custom link
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const links = groupedByCategory[category];
        if (!links || links.length === 0) return null;

        return (
          <div key={category}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              {TAX_PORTAL_CATEGORIES[category] || category}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {links.map((link) => {
                const IconComponent = ICON_MAP[link.icon] || Globe;
                const isHovered = hoveredId === link.id;

                return (
                  <div
                    key={link.id}
                    className="relative group"
                    onMouseEnter={() => setHoveredId(link.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white rounded-lg border p-4 hover:shadow-md hover:border-green-300 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="p-2 rounded-lg bg-green-50">
                          <IconComponent className="w-5 h-5 text-green-600" />
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-green-500 transition-colors" />
                      </div>
                      <h5 className="text-sm font-medium text-gray-900 mb-0.5 line-clamp-1">
                        {link.name}
                      </h5>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {link.description}
                      </p>
                    </a>

                    {/* Delete button for custom (non-default) links */}
                    {!link.isDefault && isHovered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLink(link.id);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add Custom Link */}
      <button
        onClick={onAddLink}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Custom Portal Link
      </button>
    </div>
  );
}

export default TaxPortalLinks;
