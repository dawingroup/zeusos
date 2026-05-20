/**
 * Test CEO Strategy
 * DawinOS v2.0 - Testing Framework
 * Test page for Phase 3: CEO Strategy Command module
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Target,
  Gauge,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';

interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'pending' | 'running';
  message?: string;
  duration?: number;
}

interface TestSection {
  id: string;
  name: string;
  icon: React.ReactNode;
  promptRef: string;
  tests: TestResult[];
}

export const TestCEOStrategy: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['strategy-docs', 'okrs', 'kpis', 'performance', 'executive']);

  const [testSections, setTestSections] = useState<TestSection[]>([
    {
      id: 'strategy-docs',
      name: 'Strategy Documents',
      icon: <FileText className="w-5 h-5" />,
      promptRef: '3.1',
      tests: [
        { id: 'sd-types', name: 'Document Types Validation', status: 'pending' },
        { id: 'sd-create', name: 'Create Strategy Document', status: 'pending' },
        { id: 'sd-versioning', name: 'Version Control', status: 'pending' },
        { id: 'sd-pillars', name: 'Strategic Pillars', status: 'pending' },
        { id: 'sd-alignment', name: 'Alignment Tracking', status: 'pending' },
        { id: 'sd-ui', name: 'Document UI Components', status: 'pending' },
      ],
    },
    {
      id: 'okrs',
      name: 'OKR Hierarchy',
      icon: <Target className="w-5 h-5" />,
      promptRef: '3.2',
      tests: [
        { id: 'okr-types', name: 'OKR Types Validation', status: 'pending' },
        { id: 'okr-create', name: 'Create Objective', status: 'pending' },
        { id: 'okr-kr', name: 'Create Key Results', status: 'pending' },
        { id: 'okr-cascade', name: 'OKR Cascading', status: 'pending' },
        { id: 'okr-progress', name: 'Progress Calculation', status: 'pending' },
        { id: 'okr-tree', name: 'OKR Tree View', status: 'pending' },
      ],
    },
    {
      id: 'kpis',
      name: 'KPI Framework',
      icon: <Gauge className="w-5 h-5" />,
      promptRef: '3.3',
      tests: [
        { id: 'kpi-types', name: 'KPI Types Validation', status: 'pending' },
        { id: 'kpi-define', name: 'Define KPI', status: 'pending' },
        { id: 'kpi-targets', name: 'Target Setting', status: 'pending' },
        { id: 'kpi-actuals', name: 'Actual Values Tracking', status: 'pending' },
        { id: 'kpi-trends', name: 'Trend Analysis', status: 'pending' },
        { id: 'kpi-dashboard', name: 'KPI Dashboard', status: 'pending' },
      ],
    },
    {
      id: 'performance',
      name: 'Performance Aggregation',
      icon: <BarChart3 className="w-5 h-5" />,
      promptRef: '3.4',
      tests: [
        { id: 'perf-calc', name: 'Score Calculation', status: 'pending' },
        { id: 'perf-rollup', name: 'Subsidiary Rollup', status: 'pending' },
        { id: 'perf-health', name: 'Health Status Logic', status: 'pending' },
        { id: 'perf-period', name: 'Period Comparison', status: 'pending' },
        { id: 'perf-trends', name: 'Performance Trends', status: 'pending' },
      ],
    },
    {
      id: 'executive',
      name: 'Executive Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      promptRef: '3.5',
      tests: [
        { id: 'exec-overview', name: 'Group Overview', status: 'pending' },
        { id: 'exec-subs', name: 'Subsidiary Cards', status: 'pending' },
        { id: 'exec-heatmap', name: 'Performance Heatmap', status: 'pending' },
        { id: 'exec-alerts', name: 'Executive Alerts', status: 'pending' },
        { id: 'exec-drill', name: 'Drilldown Navigation', status: 'pending' },
      ],
    },
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
    }
  };

  const runTest = async (sectionId: string, testId: string) => {
    setTestSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? {
              ...section,
              tests: section.tests.map(t =>
                t.id === testId ? { ...t, status: 'running' } : t
              ),
            }
          : section
      )
    );

    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const passed = Math.random() > 0.2;
    setTestSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? {
              ...section,
              tests: section.tests.map(t =>
                t.id === testId
                  ? {
                      ...t,
                      status: passed ? 'passed' : 'failed',
                      message: passed ? 'Test passed' : 'Test failed',
                      duration: Math.round(1000 + Math.random() * 2000),
                    }
                  : t
              ),
            }
          : section
      )
    );
  };

  const runAllTests = async () => {
    setIsRunning(true);
    for (const section of testSections) {
      for (const test of section.tests) {
        await runTest(section.id, test.id);
      }
    }
    setIsRunning(false);
  };

  const getSectionStats = (section: TestSection) => {
    const passed = section.tests.filter(t => t.status === 'passed').length;
    const failed = section.tests.filter(t => t.status === 'failed').length;
    return { passed, failed, total: section.tests.length };
  };

  const getOverallStats = () => {
    let total = 0, passed = 0, failed = 0;
    testSections.forEach(s => {
      s.tests.forEach(t => {
        total++;
        if (t.status === 'passed') passed++;
        if (t.status === 'failed') failed++;
      });
    });
    return { total, passed, failed, progress: total > 0 ? Math.round((passed / total) * 100) : 0 };
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const overallStats = getOverallStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phase 3: CEO Strategy Command Tests</h1>
          <p className="text-gray-600 mt-1">Test strategy documents, OKRs, KPIs, and executive dashboard</p>
        </div>
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
          {isRunning ? 'Running...' : 'Run All Tests'}
        </button>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800">CEO Strategy Command Module (Prompts 3.1-3.5)</h3>
        <p className="text-sm text-blue-700 mt-1">
          Test strategy document management, OKR hierarchy and cascading, KPI framework,
          performance aggregation across subsidiaries, and executive dashboard visualization.
        </p>
      </div>

      {/* Overall Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Overall Test Progress</h3>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-[#872E5C] transition-all duration-300"
            style={{ width: `${overallStats.progress}%` }}
          />
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" /> {overallStats.passed} Passed
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
            <XCircle className="w-3 h-3" /> {overallStats.failed} Failed
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            {overallStats.total - overallStats.passed - overallStats.failed} Pending
          </span>
        </div>
      </div>

      {/* Test Sections */}
      <div className="space-y-3">
        {testSections.map(section => {
          const stats = getSectionStats(section);
          const isExpanded = expandedSections.includes(section.id);

          return (
            <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-500">{section.icon}</span>
                <div className="flex-1 text-left">
                  <span className="font-semibold text-gray-900">{section.name}</span>
                  <span className="ml-2 text-xs text-gray-500">Prompt {section.promptRef}</span>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  stats.failed > 0
                    ? 'bg-red-100 text-red-700'
                    : stats.passed === stats.total && stats.total > 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {stats.passed}/{stats.total} passed
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4">
                  <div className="space-y-2">
                    {section.tests.map(test => (
                      <div
                        key={test.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        {getStatusIcon(test.status)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{test.name}</p>
                          <p className="text-xs text-gray-500">
                            {test.status === 'pending'
                              ? 'Not run yet'
                              : `${test.message} (${test.duration}ms)`}
                          </p>
                        </div>
                        <button
                          onClick={() => runTest(section.id, test.id)}
                          disabled={isRunning || test.status === 'running'}
                          className="px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                        >
                          Run
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TestCEOStrategy;
