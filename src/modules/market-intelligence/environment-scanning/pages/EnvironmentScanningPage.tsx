// ============================================================================
// ENVIRONMENT SCANNING PAGE
// ZeusOS v2.0 - Market Intelligence Module
// Main page wrapper for environment scanning module
// ============================================================================

import React, { useState } from 'react';
import { useEnvironmentScanning } from '../hooks/useEnvironmentScanning';
import { EnvironmentScanningDashboard } from '../components/EnvironmentScanningDashboard';
import { PESTELDashboard } from '../components/PESTELAnalysis';
import { SignalFeed } from '../components/SignalDetection';

type ActiveSection = 'dashboard' | 'pestel' | 'signals' | 'regulatory' | 'scenarios' | 'alerts';

export const EnvironmentScanningPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [, setShowCreatePESTELModal] = useState(false);
  const [, setShowCreateSignalModal] = useState(false);
  
  const {
    analytics,
    analyticsLoading,
    pestelAnalyses,
    selectedAnalysis,
    pestelLoading,
    signals,
    signalLoading,
    regulations,
    scenarios,
    alerts,
    indicators,
    refreshAll,
    loadPESTELAnalyses: _loadPESTELAnalyses,
    loadSignals,
    setSelectedAnalysis,
    setSelectedSignal,
  } = useEnvironmentScanning();

  const handleNavigate = (section: ActiveSection) => {
    setActiveSection(section);
  };

  const handleCreatePESTELAnalysis = () => {
    setShowCreatePESTELModal(true);
    setActiveSection('pestel');
  };

  const handleCreateSignal = () => {
    setShowCreateSignalModal(true);
    setActiveSection('signals');
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'pestel':
        return (
          <PESTELDashboard
            analyses={pestelAnalyses}
            selectedAnalysis={selectedAnalysis}
            isLoading={pestelLoading}
            onSelectAnalysis={(analysis) => setSelectedAnalysis(analysis)}
            onCreateAnalysis={handleCreatePESTELAnalysis}
            onSelectFactor={(factor) => console.log('Selected factor:', factor)}
          />
        );
      
      case 'signals':
        return (
          <SignalFeed
            signals={signals}
            isLoading={signalLoading}
            onSelectSignal={(signal) => setSelectedSignal(signal)}
            onCreateSignal={handleCreateSignal}
            onRefresh={() => loadSignals()}
          />
        );
      
      case 'regulatory':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Regulatory Tracking</h2>
            <p className="text-gray-500">
              {regulations.length} regulations tracked
            </p>
          </div>
        );
      
      case 'scenarios':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Scenario Planning</h2>
            <p className="text-gray-500">
              {scenarios.length} scenarios created
            </p>
          </div>
        );
      
      case 'alerts':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Early Warning System</h2>
            <p className="text-gray-500">
              {alerts.filter(a => a.status === 'active').length} active alerts
            </p>
          </div>
        );
      
      default:
        return (
          <EnvironmentScanningDashboard
            analytics={analytics}
            pestelAnalyses={pestelAnalyses}
            signals={signals}
            regulations={regulations}
            scenarios={scenarios}
            alerts={alerts}
            indicators={indicators}
            isLoading={analyticsLoading}
            onRefresh={refreshAll}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <div className="p-6">
      {/* Breadcrumb / Navigation */}
      {activeSection !== 'dashboard' && (
        <div className="mb-4">
          <button
            onClick={() => setActiveSection('dashboard')}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            ← Back to Dashboard
          </button>
        </div>
      )}
      
      {renderContent()}
    </div>
  );
};

export default EnvironmentScanningPage;
