import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  BarChart3,
  PieChart,
  Building2,
  TrendingUp,
  Briefcase,
  Package,
  ChevronRight,
  X
} from 'lucide-react';
import { CrossModuleReportViewer } from '../components/CrossModuleReportViewer';
import { crossModuleReportsService } from '../services/cross-module-reports';
import {
  CrossModuleReport,
  CrossModuleReportConfig,
  CrossModuleReportType,
  ModuleType
} from '../types/cross-module';

interface CrossModuleReportsPageProps {
  userId: string;
}

const MODULE_ICONS: Record<ModuleType, React.ReactNode> = {
  infrastructure: <Building2 className="w-4 h-4" />,
  investment: <TrendingUp className="w-4 h-4" />,
  advisory: <Briefcase className="w-4 h-4" />,
  matflow: <Package className="w-4 h-4" />
};

const REPORT_ICONS: Record<CrossModuleReportType, React.ReactNode> = {
  portfolio_infrastructure: <Building2 className="w-5 h-5" />,
  deal_project_pipeline: <TrendingUp className="w-5 h-5" />,
  procurement_analysis: <Package className="w-5 h-5" />,
  engagement_overview: <Briefcase className="w-5 h-5" />,
  financial_consolidated: <BarChart3 className="w-5 h-5" />,
  supplier_performance: <PieChart className="w-5 h-5" />
};

export const CrossModuleReportsPage: React.FC<CrossModuleReportsPageProps> = ({ userId }) => {
  const [templates] = useState<CrossModuleReportConfig[]>(
    crossModuleReportsService.getAllReportTemplates()
  );
  const [selectedReport, setSelectedReport] = useState<CrossModuleReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState<CrossModuleReportType | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    dateRange?: { start: string; end: string };
    status?: string;
  }>({});

  const handleGenerateReport = async (type: CrossModuleReportType) => {
    setGeneratingReport(type);
    try {
      const report = await crossModuleReportsService.generateReport(
        type,
        {
          startDate: filters.dateRange?.start,
          endDate: filters.dateRange?.end,
          status: filters.status
        },
        userId
      );
      setSelectedReport(report);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(null);
    }
  };

  const handleExport = (format: 'csv' | 'pdf' | 'excel') => {
    console.log('Exporting report as:', format);
  };

  const handleRefresh = () => {
    if (selectedReport) {
      handleGenerateReport(selectedReport.config.type);
    }
  };

  return (
    <div>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cross-Module Reports</h1>
            <p className="text-gray-500 mt-1">
              Generate comprehensive reports across multiple modules
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg font-medium flex items-center gap-2 ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl border p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Report Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.dateRange?.start || ''}
                  onChange={e =>
                    setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange, start: e.target.value, end: filters.dateRange?.end || '' }
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.dateRange?.end || ''}
                  onChange={e =>
                    setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange, start: filters.dateRange?.start || '', end: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status || ''}
                  onChange={e => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setFilters({})}
                className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Templates */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Templates</h2>
            <div className="space-y-3">
              {templates.map(template => (
                <div
                  key={template.id}
                  className={`bg-white rounded-xl border p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer ${
                    selectedReport?.config.type === template.type ? 'border-blue-500 ring-2 ring-blue-100' : ''
                  }`}
                  onClick={() => handleGenerateReport(template.type)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                      {REPORT_ICONS[template.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.modules.map(module => (
                          <span
                            key={module}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                          >
                            {MODULE_ICONS[module]}
                          </span>
                        ))}
                      </div>
                    </div>
                    {generatingReport === template.type ? (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Viewer */}
          <div className="lg:col-span-2">
            {selectedReport ? (
              <CrossModuleReportViewer
                report={selectedReport}
                onRefresh={handleRefresh}
                onExport={handleExport}
              />
            ) : (
              <div className="bg-white rounded-xl border p-12 text-center">
                <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a Report Template
                </h3>
                <p className="text-gray-500 max-w-sm mx-auto">
                  Choose a report template from the list to generate and view cross-module insights
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {templates.map(template => (
              <div
                key={template.id}
                className="bg-white rounded-lg border p-4 text-center"
              >
                <div className="p-2 bg-gray-50 rounded-lg w-fit mx-auto mb-2 text-gray-500">
                  {REPORT_ICONS[template.type]}
                </div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {template.name.split(' ').slice(0, 2).join(' ')}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {template.metrics.length} metrics
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrossModuleReportsPage;
