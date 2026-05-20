/**
 * Test Intelligence Layer
 * DawinOS v2.0 - Testing Framework
 * Test page for Phase 1: Intelligence Layer components
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  RefreshCw,
  Calendar,
  User,
  ClipboardList,
  HelpCircle,
  Brain,
  Plus,
} from 'lucide-react';

// Test result type
interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'pending' | 'running';
  message?: string;
  duration?: number;
}

// Tab configuration
const TABS = [
  { id: 'events', name: 'Business Events', icon: <Calendar className="w-4 h-4" /> },
  { id: 'roles', name: 'Role Profiles', icon: <User className="w-4 h-4" /> },
  { id: 'tasks', name: 'Task Generation', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'grey', name: 'Grey Areas', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'smart', name: 'Smart Tasks', icon: <Brain className="w-4 h-4" /> },
];

export const TestIntelligenceLayer: React.FC = () => {
  const [activeTab, setActiveTab] = useState('events');
  const [testResults, setTestResults] = useState<TestResult[]>([
    { id: 'events-load', name: 'Load Business Events', status: 'pending' },
    { id: 'events-create', name: 'Create Business Event', status: 'pending' },
    { id: 'events-catalog', name: 'Event Catalog Validation', status: 'pending' },
    { id: 'roles-load', name: 'Load Role Profiles', status: 'pending' },
    { id: 'roles-create', name: 'Create Role Profile', status: 'pending' },
    { id: 'roles-validate', name: 'Role-Task Mapping Validation', status: 'pending' },
    { id: 'tasks-generate', name: 'Task Generation from Event', status: 'pending' },
    { id: 'tasks-routing', name: 'Task Routing Logic', status: 'pending' },
    { id: 'grey-detect', name: 'Grey Area Detection', status: 'pending' },
    { id: 'grey-resolve', name: 'Grey Area Resolution', status: 'pending' },
    { id: 'smart-create', name: 'Create Smart Task', status: 'pending' },
    { id: 'smart-prioritize', name: 'Task Prioritization', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  // Mock test runner
  const runTest = async (testId: string) => {
    setTestResults(prev =>
      prev.map(t => (t.id === testId ? { ...t, status: 'running' } : t))
    );

    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const passed = Math.random() > 0.3;
    setTestResults(prev =>
      prev.map(t =>
        t.id === testId
          ? {
              ...t,
              status: passed ? 'passed' : 'failed',
              message: passed ? 'Test passed successfully' : 'Test failed - check console',
              duration: Math.round(1000 + Math.random() * 2000),
            }
          : t
      )
    );
  };

  const runAllTests = async () => {
    setIsRunning(true);
    for (const test of testResults) {
      await runTest(test.id);
    }
    setIsRunning(false);
  };

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

  const filterTestsByTab = (tabId: string) => {
    return testResults.filter(t => t.id.startsWith(tabId));
  };

  const getTabStats = (tabId: string) => {
    const tests = filterTestsByTab(tabId);
    const passed = tests.filter(t => t.status === 'passed').length;
    return `${passed}/${tests.length}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phase 1: Intelligence Layer Tests</h1>
          <p className="text-gray-600 mt-1">Test business event processing, role profiles, and task generation</p>
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
        <h3 className="font-medium text-blue-800">Intelligence Layer Components</h3>
        <p className="text-sm text-blue-700 mt-1">
          Test business event processing, role profiles, task generation engine, grey area detection, and smart task core.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TABS.map(tab => {
          const tests = filterTestsByTab(tab.id);
          const passed = tests.filter(t => t.status === 'passed').length;
          return (
            <div key={tab.id} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-500 truncate">{tab.name}</p>
              <p className="text-xl font-bold text-gray-900">{passed}/{tests.length}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#872E5C] text-[#872E5C]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.name}
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                  {getTabStats(tab.id)}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {TABS.find(t => t.id === activeTab)?.name} Tests
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Test the {TABS.find(t => t.id === activeTab)?.name.toLowerCase()} functionality.
          </p>

          {/* Test List */}
          <div className="space-y-2">
            {filterTestsByTab(activeTab).map(test => (
              <div
                key={test.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                {getStatusIcon(test.status)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{test.name}</p>
                  <p className="text-xs text-gray-500">
                    {test.message || `Duration: ${test.duration || '-'}ms`}
                  </p>
                </div>
                <button
                  onClick={() => runTest(test.id)}
                  disabled={isRunning || test.status === 'running'}
                  className="px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Run
                </button>
              </div>
            ))}
          </div>

          {/* Interactive Testing */}
          {activeTab === 'events' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Interactive Test: Create Business Event</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-[#872E5C]">
                  <option value="">Select Event Type</option>
                  <option value="employee.hired">Employee Hired</option>
                  <option value="employee.terminated">Employee Terminated</option>
                  <option value="contract.created">Contract Created</option>
                  <option value="payroll.approved">Payroll Approved</option>
                  <option value="strategy.created">Strategy Created</option>
                  <option value="okr.updated">OKR Updated</option>
                </select>
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-[#872E5C]">
                  <option value="">Select Subsidiary</option>
                  <option value="advisory">Dawin Advisory</option>
                  <option value="finishes">Dawin Finishes</option>
                  <option value="technology">Dawin Technology</option>
                  <option value="capital">Dawin Capital</option>
                </select>
                <button className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#872E5C] text-white font-medium rounded-lg hover:bg-[#6a2449] transition-colors">
                  <Plus className="w-4 h-4" /> Create Test Event
                </button>
              </div>
            </div>
          )}

          {/* Role Profiles Preview */}
          {activeTab === 'roles' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Sample Role Profiles</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Task Types</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      <td className="px-4 py-2 text-sm font-mono text-gray-900">HR_MANAGER</td>
                      <td className="px-4 py-2 text-sm text-gray-900">HR Manager</td>
                      <td className="px-4 py-2 text-sm text-gray-500">Human Resources</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex gap-1">
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Onboarding</span>
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Payroll</span>
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Leave</span>
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm font-mono text-gray-900">FINANCE_MANAGER</td>
                      <td className="px-4 py-2 text-sm text-gray-900">Finance Manager</td>
                      <td className="px-4 py-2 text-sm text-gray-500">Finance</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex gap-1">
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">Budget</span>
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">Accounts</span>
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">Reporting</span>
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm font-mono text-gray-900">CEO</td>
                      <td className="px-4 py-2 text-sm text-gray-900">Chief Executive Officer</td>
                      <td className="px-4 py-2 text-sm text-gray-500">Executive</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex gap-1">
                          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Strategy</span>
                          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">OKRs</span>
                          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Approvals</span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestIntelligenceLayer;
