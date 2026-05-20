// ============================================================================
// REPORT EXPORT COMPONENT
// DawinOS v2.0 - Financial Management Module
// Export controls for financial reports
// ============================================================================

import React, { useState } from 'react';
import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_LABELS,
  ExportFormat,
} from '../../constants/reporting.constants';
import {
  Download,
  FileSpreadsheet,
  FileText,
  File,
  Loader2,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface ReportExportProps {
  reportId: string;
  reportName: string;
  onExport: (format: ExportFormat) => Promise<void>;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const ReportExport: React.FC<ReportExportProps> = ({
  reportId,
  reportName,
  onExport,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setExportFormat(format);
    try {
      await onExport(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case EXPORT_FORMATS.PDF:
        return FileText;
      case EXPORT_FORMATS.EXCEL:
        return FileSpreadsheet;
      case EXPORT_FORMATS.CSV:
        return File;
      default:
        return Download;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
        <Download className="w-4 h-4 text-[#872E5C]" />
        Export Report
      </h4>
      
      <p className="text-sm text-gray-600 mb-4">
        Download <strong>{reportName}</strong> in your preferred format.
      </p>

      <div className="flex flex-wrap gap-2">
        {Object.entries(EXPORT_FORMAT_LABELS).map(([format, label]) => {
          const Icon = getFormatIcon(format as ExportFormat);
          const isCurrentlyExporting = isExporting && exportFormat === format;

          return (
            <button
              key={format}
              onClick={() => handleExport(format as ExportFormat)}
              disabled={isExporting}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                isCurrentlyExporting
                  ? 'bg-[#872E5C] text-white border-[#872E5C]'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isCurrentlyExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              {label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Report ID: {reportId}
      </p>
    </div>
  );
};

export default ReportExport;
