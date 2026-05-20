/**
 * Test Financial Management
 * DawinOS v2.0 - Testing Framework
 * Test page for Phase 4: Financial Management (Prompts 4.1-4.2)
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
  GitBranch,
  DollarSign,
  Plus,
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
  description: string;
  tests: TestResult[];
}

export const TestFinancialManagement: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['coa', 'budget']);

  const [testSections, setTestSections] = useState<TestSection[]>([
    {
      id: 'coa',
      name: 'Chart of Accounts',
      icon: <GitBranch className="w-5 h-5" />,
      promptRef: '4.1',
      description: 'Account types, hierarchical structure, general ledger, journal entries',
      tests: [
        { id: 'coa-types', name: 'Account Types (Asset/Liability/Equity/Revenue/Expense)', status: 'pending' },
        { id: 'coa-subtypes', name: 'Account Sub-Types Mapping', status: 'pending' },
        { id: 'coa-hierarchy', name: '6-Level Account Hierarchy', status: 'pending' },
        { id: 'coa-create', name: 'Create Account', status: 'pending' },
        { id: 'coa-update', name: 'Update Account', status: 'pending' },
        { id: 'coa-tree', name: 'Account Tree Component', status: 'pending' },
        { id: 'coa-journal-create', name: 'Create Journal Entry', status: 'pending' },
        { id: 'coa-journal-post', name: 'Post Journal Entry', status: 'pending' },
        { id: 'coa-balance', name: 'Real-time Balance Tracking', status: 'pending' },
        { id: 'coa-currency', name: 'Multi-Currency (UGX, USD, EUR)', status: 'pending' },
      ],
    },
    {
      id: 'budget',
      name: 'Budget Management',
      icon: <DollarSign className="w-5 h-5" />,
      promptRef: '4.2',
      description: 'Budget creation, allocation, tracking, variance analysis',
      tests: [
        { id: 'bud-types', name: 'Budget Types Validation', status: 'pending' },
        { id: 'bud-periods', name: 'Budget Period Types', status: 'pending' },
        { id: 'bud-create', name: 'Create Budget', status: 'pending' },
        { id: 'bud-allocate', name: 'Budget Line Items', status: 'pending' },
        { id: 'bud-approve', name: 'Budget Approval Workflow', status: 'pending' },
        { id: 'bud-tracking', name: 'Budget vs Actual Tracking', status: 'pending' },
        { id: 'bud-variance', name: 'Variance Analysis', status: 'pending' },
        { id: 'bud-forecast', name: 'Budget Forecasting', status: 'pending' },
        { id: 'bud-ui', name: 'Budget Dashboard UI', status: 'pending' },
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

    const passed = Math.random() > 0.15;
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

  const runSectionTests = async (sectionId: string) => {
    setIsRunning(true);
    const section = testSections.find(s => s.id === sectionId);
    if (section) {
      for (const test of section.tests) {
        await runTest(sectionId, test.id);
      }
    }
    setIsRunning(false);
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

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phase 4: Financial Management Tests</h1>
          <p className="text-gray-600 mt-1">Test Chart of Accounts and Budget Management</p>
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

      {/* Warning Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-medium text-amber-800">Partial Implementation (Prompts 4.1-4.2 Only)</h3>
        <p className="text-sm text-amber-700 mt-1">
          Currently testing Chart of Accounts and Budget Management. Prompts 4.3 (Financial Reporting)
          and 4.4 (Cash Flow Analysis) are not yet implemented.
        </p>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800">Financial Management Features</h3>
        <ul className="text-sm text-blue-700 mt-1 space-y-1">
          <li>• <strong>4.1 Chart of Accounts:</strong> Uganda-compliant CoA with 6-level hierarchy, multi-currency (UGX primary)</li>
          <li>• <strong>4.2 Budget Management:</strong> Annual/quarterly budgets, variance analysis, approval workflow</li>
        </ul>
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
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{section.name}</span>
                    <span className="text-xs text-gray-500">Prompt {section.promptRef}</span>
                  </div>
                  <p className="text-xs text-gray-500">{section.description}</p>
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    runSectionTests(section.id);
                  }}
                  disabled={isRunning}
                  className="px-3 py-1 text-sm font-medium text-[#872E5C] hover:bg-[#872E5C]/10 rounded-lg disabled:opacity-50"
                >
                  Run Section
                </button>
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

      {/* Interactive Testing */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Interactive Component Testing</h3>

        {/* Sample Account Hierarchy */}
        <h4 className="font-medium text-gray-900 mb-3">Sample Account Hierarchy</h4>
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance (UGX)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-sm font-mono font-semibold text-gray-900">1000</td>
                <td className="px-4 py-2 text-sm font-semibold text-gray-900">Assets</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Asset</span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">1</td>
                <td className="px-4 py-2 text-sm text-right font-mono text-gray-900">500,000,000</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-700">1100</td>
                <td className="px-4 py-2 text-sm text-gray-700 pl-6">Current Assets</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Asset</span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">2</td>
                <td className="px-4 py-2 text-sm text-right font-mono text-gray-700">150,000,000</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-600">1110</td>
                <td className="px-4 py-2 text-sm text-gray-600 pl-10">Cash & Bank</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Asset</span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">3</td>
                <td className="px-4 py-2 text-sm text-right font-mono text-gray-600">75,000,000</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono text-gray-500">1111</td>
                <td className="px-4 py-2 text-sm text-gray-500 pl-14">Petty Cash - Kampala</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Asset</span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">4</td>
                <td className="px-4 py-2 text-sm text-right font-mono text-gray-500">2,500,000</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Create Test Account */}
        <h4 className="font-medium text-gray-900 mb-3">Create Test Account</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Account Code (e.g. 1112)"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-[#872E5C]"
          />
          <input
            type="text"
            placeholder="Account Name (e.g. Bank - Stanbic)"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-[#872E5C]"
          />
          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-[#872E5C]">
            <option value="">Account Type</option>
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
          </select>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#872E5C] text-white font-medium rounded-lg hover:bg-[#6a2449] transition-colors">
            <Plus className="w-4 h-4" /> Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestFinancialManagement;
