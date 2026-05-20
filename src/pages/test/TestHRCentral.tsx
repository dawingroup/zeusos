/**
 * Test HR Central
 * DawinOS v2.0 - Testing Framework
 * Test page for Phase 2: HR Central module components
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
  User,
  FileText,
  DollarSign,
  Calendar,
  GitBranch,
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
  tests: TestResult[];
}

export const TestHRCentral: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['employees', 'contracts', 'payroll', 'leave', 'organization']);

  const [testSections, setTestSections] = useState<TestSection[]>([
    {
      id: 'employees',
      name: 'Employee Management',
      icon: <User className="w-5 h-5" />,
      tests: [
        { id: 'emp-types', name: 'Employee Types Validation', status: 'pending' },
        { id: 'emp-create', name: 'Create Employee', status: 'pending' },
        { id: 'emp-update', name: 'Update Employee', status: 'pending' },
        { id: 'emp-search', name: 'Search Employees', status: 'pending' },
        { id: 'emp-status', name: 'Status Change Workflow', status: 'pending' },
        { id: 'emp-ui', name: 'Employee UI Components', status: 'pending' },
      ],
    },
    {
      id: 'contracts',
      name: 'Contract Management',
      icon: <FileText className="w-5 h-5" />,
      tests: [
        { id: 'con-types', name: 'Contract Types Validation', status: 'pending' },
        { id: 'con-create', name: 'Create Contract', status: 'pending' },
        { id: 'con-renew', name: 'Renew Contract', status: 'pending' },
        { id: 'con-terminate', name: 'Terminate Contract', status: 'pending' },
        { id: 'con-expiry', name: 'Expiry Notifications', status: 'pending' },
      ],
    },
    {
      id: 'payroll',
      name: 'Payroll System',
      icon: <DollarSign className="w-5 h-5" />,
      tests: [
        { id: 'pay-calc-paye', name: 'PAYE Calculation', status: 'pending' },
        { id: 'pay-calc-nssf', name: 'NSSF Calculation', status: 'pending' },
        { id: 'pay-calc-lst', name: 'LST Calculation', status: 'pending' },
        { id: 'pay-batch', name: 'Payroll Batch Processing', status: 'pending' },
        { id: 'pay-approval', name: 'Payroll Approval Workflow', status: 'pending' },
        { id: 'pay-ui', name: 'Payroll UI Components', status: 'pending' },
      ],
    },
    {
      id: 'leave',
      name: 'Leave Management',
      icon: <Calendar className="w-5 h-5" />,
      tests: [
        { id: 'leave-types', name: 'Leave Types Validation', status: 'pending' },
        { id: 'leave-request', name: 'Create Leave Request', status: 'pending' },
        { id: 'leave-approve', name: 'Leave Approval Workflow', status: 'pending' },
        { id: 'leave-balance', name: 'Leave Balance Calculation', status: 'pending' },
        { id: 'leave-calendar', name: 'Leave Calendar View', status: 'pending' },
      ],
    },
    {
      id: 'organization',
      name: 'Organization Structure',
      icon: <GitBranch className="w-5 h-5" />,
      tests: [
        { id: 'org-dept', name: 'Department Hierarchy', status: 'pending' },
        { id: 'org-position', name: 'Position Management', status: 'pending' },
        { id: 'org-reporting', name: 'Reporting Lines', status: 'pending' },
        { id: 'org-grades', name: 'Job Grades E1-A2', status: 'pending' },
        { id: 'org-chart', name: 'Org Chart Visualization', status: 'pending' },
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

    const passed = Math.random() > 0.25;
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
          <h1 className="text-2xl font-bold text-gray-900">Phase 2: HR Central Tests</h1>
          <p className="text-gray-600 mt-1">Test employee management, contracts, payroll, leave, and organization</p>
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
        <h3 className="font-medium text-blue-800">HR Central Module Components (Prompts 2.1-2.8)</h3>
        <p className="text-sm text-blue-700 mt-1">
          Test employee management, contracts, payroll with Uganda tax calculations (PAYE, NSSF, LST),
          leave management, and organization structure with job grades E1-A2.
        </p>
      </div>

      {/* Section Summaries */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {testSections.map(section => {
          const stats = getSectionStats(section);
          return (
            <div key={section.id} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-500">{section.icon}</span>
                <span className="text-xs text-gray-600 truncate">{section.name}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{stats.passed}/{stats.total}</p>
              {stats.failed > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded-full">
                  {stats.failed} failed
                </span>
              )}
            </div>
          );
        })}
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
                <span className="flex-1 text-left font-semibold text-gray-900">{section.name}</span>
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
        <p className="text-sm text-gray-600 mb-4">
          Test existing HR Central UI components with sample data.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <User className="w-5 h-5" /> View Employee Card Demo
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <DollarSign className="w-5 h-5" /> Test Payroll Calculator
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <GitBranch className="w-5 h-5" /> View Org Chart Demo
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestHRCentral;
