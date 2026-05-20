// ============================================================================
// SETTINGS LANDING PAGE
// DawinOS v2.0 - Finance Module
// Replaces card-grid with a vertical list for direct access to settings.
// ============================================================================

import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Link,
  RefreshCw,
  GitBranch,
  Calculator,
  ChevronRight,
} from 'lucide-react';

// ── Section Definitions ────────────────────────────────────────────────────

interface SettingsSection {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
}

const SECTIONS: SettingsSection[] = [
  {
    id: 'accounts',
    label: 'Chart of Accounts',
    description: 'Manage account hierarchy, types & classifications',
    icon: BookOpen,
    path: '/finance/settings/accounts',
  },
  {
    id: 'integrations',
    label: 'QBO Integration',
    description: 'QuickBooks Online connection & data sync',
    icon: Link,
    path: '/finance/settings/integrations',
  },
  {
    id: 'sync',
    label: 'Sync Dashboard',
    description: 'QBO sync status monitoring & history',
    icon: RefreshCw,
    path: '/finance/settings/sync',
  },
  {
    id: 'mappings',
    label: 'Account Mappings',
    description: 'Map DawinOS accounts to QBO counterparts',
    icon: GitBranch,
    path: '/finance/settings/mappings',
  },
  {
    id: 'pricing',
    label: 'Pricing Assumptions',
    description: 'Labour rates, markups & costing parameters',
    icon: Calculator,
    path: '/finance/settings/pricing',
  },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export function SettingsLandingPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Finance Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configuration, integrations & account management
        </p>
      </div>

      {/* Vertical list of settings sections */}
      <div className="space-y-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => navigate(section.path)}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm text-left transition-all"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 shrink-0">
                <Icon className="w-5 h-5 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  {section.label}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {section.description}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SettingsLandingPage;
