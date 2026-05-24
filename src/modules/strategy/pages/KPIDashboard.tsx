// ============================================================================
// KPIDashboard PAGE
// ZeusOS v2.0 - CEO Strategy Command Module
// KPI management and scorecard dashboard
// ============================================================================

import React from 'react';
import { BarChart3, Construction } from 'lucide-react';

export const KPIDashboard: React.FC = () => {
  return (
    <div>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            KPIs & Scorecards
          </h1>
          <p className="text-muted-foreground">
            Monitor Key Performance Indicators and manage scorecards.
          </p>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-[var(--bg-sunken)] rounded-full p-6 mb-4">
              <Construction className="w-16 h-16 text-[var(--fg-tertiary)]" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Coming Soon
            </h2>
            <p className="text-muted-foreground max-w-md">
              The KPI management interface is under development.
              Check back soon for full KPI definition, tracking, and scorecard capabilities.
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <BarChart3 className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                KPI Features
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  This page will include KPI definition, target setting, trend analysis,
                  and balanced scorecard management.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPIDashboard;
