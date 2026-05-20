/**
 * ShopTravelerSection Component
 * UI for generating and downloading shop traveler PDFs
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  AlertTriangle, 
  Loader2,
  Table,
  CheckCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { 
  downloadShopTraveler, 
  downloadLabelsCSV,
  downloadCutListCSV,
} from '@/shared/services/pdf/shopTravelerService.tsx';
import type { Project, ShopTravelerSettings } from '@/shared/types';
import { DEFAULT_SHOP_TRAVELER_SETTINGS } from '@/shared/types/project';

// ============================================
// Types
// ============================================

interface ShopTravelerSectionProps {
  project: Project;
  onError?: (error: string) => void;
  onSettingsChange?: (settings: ShopTravelerSettings) => void;
  onRefresh?: () => Promise<void>;
}

type DownloadType = 'pdf' | 'labels' | 'cutlist';

// ============================================
// Main Component
// ============================================

export const ShopTravelerSection: React.FC<ShopTravelerSectionProps> = ({ 
  project,
  onError,
  onSettingsChange,
  onRefresh,
}) => {
  const [isGenerating, setIsGenerating] = useState<DownloadType | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastDownloaded, setLastDownloaded] = useState<DownloadType | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ShopTravelerSettings>(
    project.optimizationState?.shopTravelerSettings || DEFAULT_SHOP_TRAVELER_SETTINGS
  );

  const production = project.optimizationState?.production;
  const hasProduction = !!production && (
    (production.nestingSheets?.length || 0) > 0 ||
    (production.timberCuttingResults?.length || 0) > 0 ||
    (production.linearStockCuttingResults?.length || 0) > 0
  );
  const isOutdated = !!production?.invalidatedAt;

  const handleSettingToggle = (key: keyof ShopTravelerSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error: any) {
      console.error('Refresh error:', error);
      onError?.(error.message || 'Failed to refresh production data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsGenerating('pdf');
    try {
      // Convert ShopTravelerSettings to ShopTravelerOptions format
      const pdfOptions = {
        includeCoverPage: settings.includeCoverPage,
        includeCuttingMaps: settings.includeCuttingMaps,
        includeTimberCutting: settings.includeTimberCuttingDiagrams,
        includeLinearStockCutting: settings.includeLinearStockCuttingDiagrams,
        includeEdgeBanding: settings.includeEdgeBandingSchedule,
        includeRemnants: settings.includeRemnantRegister,
        includeLabels: settings.includePartLabels,
      };
      await downloadShopTraveler(project.id, pdfOptions);
      setLastDownloaded('pdf');
    } catch (error: any) {
      console.error('PDF generation error:', error);
      onError?.(error.message || 'Failed to generate PDF');
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDownloadLabels = async () => {
    setIsGenerating('labels');
    try {
      await downloadLabelsCSV(project.id);
      setLastDownloaded('labels');
    } catch (error: any) {
      console.error('Labels CSV error:', error);
      onError?.(error.message || 'Failed to generate labels CSV');
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDownloadCutList = async () => {
    setIsGenerating('cutlist');
    try {
      await downloadCutListCSV(project.id);
      setLastDownloaded('cutlist');
    } catch (error: any) {
      console.error('Cut list CSV error:', error);
      onError?.(error.message || 'Failed to generate cut list CSV');
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h4 className="font-medium text-gray-900">Shop Traveler</h4>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Refresh production data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
          {hasProduction && !isOutdated && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
              <CheckCircle className="w-3 h-3" />
              Ready
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Warning for outdated optimization */}
        {isOutdated && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Optimization Outdated</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Design items have changed since last optimization. PDF will use stale data.
              </p>
            </div>
          </div>
        )}

        {/* No production warning */}
        {!hasProduction && (
          <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">No Production Data</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Run production optimization first to generate shop traveler documents.
              </p>
            </div>
          </div>
        )}

        {/* Download Buttons */}
        <div className="space-y-3">
          {/* Main PDF Download */}
          <button
            onClick={handleDownloadPDF}
            disabled={!hasProduction || isGenerating !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating === 'pdf' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Shop Traveler PDF
              </>
            )}
          </button>

          {/* Secondary Downloads */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadLabels}
              disabled={!hasProduction || isGenerating !== null}
              className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating === 'labels' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Table className="w-4 h-4" />
              )}
              <span className="text-sm">Labels CSV</span>
            </button>

            <button
              onClick={handleDownloadCutList}
              disabled={!hasProduction || isGenerating !== null}
              className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating === 'cutlist' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span className="text-sm">Cut List CSV</span>
            </button>
          </div>
        </div>

        {/* Last Downloaded Indicator */}
        {lastDownloaded && (
          <p className="text-xs text-center text-gray-500">
            Last downloaded: {lastDownloaded === 'pdf' ? 'Shop Traveler PDF' : 
              lastDownloaded === 'labels' ? 'Labels CSV' : 'Cut List CSV'}
          </p>
        )}

        {/* Section Settings */}
        {hasProduction && (
          <div className="pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-800"
            >
              <span className="flex items-center gap-1">
                <Settings className="w-3 h-3" />
                PDF Sections
              </span>
              {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showSettings && (
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeCoverPage}
                    onChange={() => handleSettingToggle('includeCoverPage')}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Cover page with project summary</span>
                </label>
                
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeCuttingMaps}
                    onChange={() => handleSettingToggle('includeCuttingMaps')}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Cutting maps ({production.nestingSheets?.length || 0} sheets)</span>
                </label>
                
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeTimberCuttingDiagrams}
                    onChange={() => handleSettingToggle('includeTimberCuttingDiagrams')}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Timber cutting ({production?.timberCuttingResults?.length || 0} sticks)</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeLinearStockCuttingDiagrams}
                    onChange={() => handleSettingToggle('includeLinearStockCuttingDiagrams')}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Bar stock cutting ({production?.linearStockCuttingResults?.length || 0} bars)</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeEdgeBandingSchedule}
                    onChange={() => handleSettingToggle('includeEdgeBandingSchedule')}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Edge banding schedule</span>
                </label>
                
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeRemnantRegister}
                    onChange={() => handleSettingToggle('includeRemnantRegister')}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Remnant register</span>
                </label>
                
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includePartLabels}
                    onChange={() => handleSettingToggle('includePartLabels')}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Part labels</span>
                </label>
                
                <p className="text-[10px] text-gray-400 mt-2 italic">
                  Settings are saved per project
                </p>
              </div>
            )}
            
            {!showSettings && (
              <p className="text-[10px] text-gray-400 mt-1">
                {[
                  settings.includeCoverPage && 'Cover',
                  settings.includeCuttingMaps && 'Cutting Maps',
                  settings.includeTimberCuttingDiagrams && 'Timber',
                  settings.includeLinearStockCuttingDiagrams && 'Bar Stock',
                  settings.includeEdgeBandingSchedule && 'Edge Banding',
                  settings.includeRemnantRegister && 'Remnants',
                  settings.includePartLabels && 'Labels',
                ].filter(Boolean).join(' • ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopTravelerSection;
