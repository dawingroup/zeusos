/**
 * Test Dashboard
 * DawinOS v2.0 - Testing Framework
 * Main testing hub with overview of all test modules and quick actions
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Brain,
  Users,
  TrendingUp,
  Landmark,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Database,
  Shield,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useTestRunner } from '@/testing/hooks/useTestRunner';
import { seedAllTestData, SeedResult } from '@/testing/seeders/testDataSeeder';

// Phase status type
interface PhaseStatus {
  id: string;
  name: string;
  phase: string;
  icon: React.ReactNode;
  description: string;
  path: string;
  tests: {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  };
  features: string[];
}

// Test phases configuration
const PHASE_STATUSES: PhaseStatus[] = [
  {
    id: 'setup',
    name: 'Project Setup',
    phase: 'Phase 0',
    icon: <Settings className="w-8 h-8" />,
    description: 'Module registration, shared utilities, Firebase security rules',
    path: '/test',
    tests: { total: 3, passed: 0, failed: 0, pending: 3 },
    features: [
      'Module Registration & Constants',
      'Shared Types & Utilities',
      'Firebase Security Rules',
    ],
  },
  {
    id: 'intelligence',
    name: 'Intelligence Layer',
    phase: 'Phase 1',
    icon: <Brain className="w-8 h-8" />,
    description: 'Business events, role profiles, task generation, grey area detection',
    path: '/test/intelligence',
    tests: { total: 5, passed: 0, failed: 0, pending: 5 },
    features: [
      'Business Event Types & Catalog',
      'Role Profile System',
      'Task Generation Engine',
      'Grey Area Detection',
      'Smart Task Core',
    ],
  },
  {
    id: 'hr',
    name: 'HR Central',
    phase: 'Phase 2',
    icon: <Users className="w-8 h-8" />,
    description: 'Employee management, contracts, payroll, leave, organization',
    path: '/test/hr',
    tests: { total: 8, passed: 0, failed: 0, pending: 8 },
    features: [
      'Employee Types & Schema',
      'Employee Service & CRUD',
      'Employee UI Components',
      'Contract Management',
      'Payroll Calculator',
      'Payroll UI & Workflow',
      'Leave Management',
      'Organization Structure',
    ],
  },
  {
    id: 'strategy',
    name: 'CEO Strategy Command',
    phase: 'Phase 3',
    icon: <TrendingUp className="w-8 h-8" />,
    description: 'Strategy documents, OKRs, KPIs, performance, executive dashboard',
    path: '/test/strategy',
    tests: { total: 5, passed: 0, failed: 0, pending: 5 },
    features: [
      'Strategy Document System',
      'OKR Types & Hierarchy',
      'KPI Framework',
      'Performance Aggregation',
      'Executive Dashboard UI',
    ],
  },
  {
    id: 'finance',
    name: 'Financial Management',
    phase: 'Phase 4 (Partial)',
    icon: <Landmark className="w-8 h-8" />,
    description: 'Chart of Accounts, Budget Management (4.1-4.2 only)',
    path: '/test/finance',
    tests: { total: 2, passed: 0, failed: 0, pending: 2 },
    features: [
      'Chart of Accounts & General Ledger',
      'Budget Management System',
    ],
  },
];

// Phase card component
const PhaseCard: React.FC<{ phase: PhaseStatus; onNavigate: (path: string) => void }> = ({
  phase,
  onNavigate,
}) => {
  const progress = phase.tests.total > 0
    ? Math.round((phase.tests.passed / phase.tests.total) * 100)
    : 0;

  const getStatusColor = () => {
    if (phase.tests.failed > 0) return 'bg-red-500';
    if (phase.tests.passed === phase.tests.total && phase.tests.total > 0) return 'bg-green-500';
    return 'bg-amber-500';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-[#872E5C]">{phase.icon}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{phase.name}</h3>
            <span className="inline-block px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
              {phase.phase}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">{phase.description}</p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${getStatusColor()} transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Test stats */}
        <div className="flex gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" /> {phase.tests.passed}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
            <XCircle className="w-3 h-3" /> {phase.tests.failed}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
            <AlertCircle className="w-3 h-3" /> {phase.tests.pending}
          </span>
        </div>

        {/* Features */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Features ({phase.features.length})
          </p>
          <ul className="space-y-1">
            {phase.features.slice(0, 3).map((feature, index) => (
              <li key={index} className="text-xs text-gray-600 truncate">
                • {feature}
              </li>
            ))}
            {phase.features.length > 3 && (
              <li className="text-xs text-gray-400">
                +{phase.features.length - 3} more...
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 rounded-b-xl flex gap-2">
        <button
          onClick={() => onNavigate(phase.path)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#872E5C] hover:bg-[#872E5C]/10 rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" /> Run Tests
        </button>
        <button
          onClick={() => onNavigate(phase.path)}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

export const TestDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { results, isRunning, runAllTests, getMetrics } = useTestRunner();
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResults, setSeedResults] = useState<SeedResult[] | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Get live metrics from useTestRunner
  const metrics = getMetrics();

  // Calculate phase statuses dynamically based on test results
  const getPhaseStats = (modulePrefix: string) => {
    const moduleResults = results.filter(r => r.module === modulePrefix);
    return {
      total: moduleResults.length,
      passed: moduleResults.filter(r => r.status === 'passed').length,
      failed: moduleResults.filter(r => r.status === 'failed').length,
      pending: moduleResults.filter(r => r.status === 'pending').length,
    };
  };

  // Update phase statuses with live data
  const phaseStatusesLive = PHASE_STATUSES.map(phase => {
    let stats = phase.tests;
    if (phase.id === 'finance') stats = getPhaseStats('finance');
    if (phase.id === 'hr') stats = getPhaseStats('hr');
    if (phase.id === 'strategy') stats = getPhaseStats('strategy');
    return { ...phase, tests: stats };
  });

  const overallProgress = {
    total: metrics.total || 23,
    passed: metrics.passed,
    failed: metrics.failed,
    pending: metrics.pending,
    progress: metrics.total > 0 ? Math.round((metrics.passed / metrics.total) * 100) : 0,
  };

  // Handle seed test data
  const handleSeedData = async () => {
    setIsSeeding(true);
    setSeedError(null);
    setSeedResults(null);
    try {
      const results = await seedAllTestData();
      setSeedResults(results);
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : 'Failed to seed data');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">DawinOS v2.0 Testing Dashboard</h1>
        <p className="text-gray-600 mt-1">Comprehensive testing coverage for Phases 0-4 (4.1-4.2)</p>
      </div>

      {/* Seed Results Alert */}
      {seedResults && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-800 mb-2">✅ Test Data Seeded Successfully</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {seedResults.map((result, idx) => (
              <div key={idx} className="text-sm">
                <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                  {result.success ? '✓' : '✗'} {result.module}
                </span>
                <span className="text-green-600 ml-1">({result.recordsCreated} records)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seed Error Alert */}
      {seedError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-medium text-red-800">❌ Seed Failed</h3>
          <p className="text-sm text-red-700">{seedError}</p>
        </div>
      )}

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-blue-800">Testing Suite Overview</h3>
            <p className="text-sm text-blue-700 mt-1">
              This dashboard provides comprehensive testing coverage for Phases 0-4 (4.1-4.2).
              Each phase has individual test pages to verify services, hooks, and UI components.
            </p>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Tests Completed</span>
              <span className="font-semibold">
                {overallProgress.passed}/{overallProgress.total} ({overallProgress.progress}%)
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#872E5C] transition-all duration-300"
                style={{ width: `${overallProgress.progress}%` }}
              />
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <div className="text-center px-6 py-3 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{overallProgress.passed}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Passed</div>
            </div>
            <div className="text-center px-6 py-3 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">{overallProgress.failed}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Failed</div>
            </div>
            <div className="text-center px-6 py-3 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-amber-600">{overallProgress.pending}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#872E5C] text-white font-medium rounded-lg hover:bg-[#6a2449] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </button>
          <button 
            onClick={handleSeedData}
            disabled={isSeeding}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            {isSeeding ? 'Seeding...' : 'Seed Test Data'}
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
            <Shield className="w-4 h-4" /> Check Firebase Rules
          </button>
        </div>
      </div>

      {/* Live Test Results */}
      {results.some(r => r.status !== 'pending') && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Live Test Results</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map(result => (
              <div key={result.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm">
                {result.status === 'passed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {result.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                {result.status === 'pending' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                {result.status === 'running' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                <span className="font-medium">{result.name}</span>
                <span className="text-gray-500">({result.module})</span>
                {result.duration && (
                  <span className="text-gray-400 ml-auto">{result.duration}ms</span>
                )}
                {result.message && (
                  <span className="text-gray-500 truncate max-w-xs">{result.message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Modules by Phase</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {phaseStatusesLive.map((phase) => (
            <PhaseCard key={phase.id} phase={phase} onNavigate={navigate} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestDashboard;
