/**
 * Report Generator Component
 * UI for configuring and generating reports
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  FileText,
  FileSpreadsheet,
  FileJson,
  Settings2,
  Building2,
  TrendingUp,
  Receipt,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useExport, useReportConfigBuilder, useReportTemplates } from '../../hooks/useExport';
import { ReportType, ExportFormat, ReportConfig } from '../../types/export';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/shared/lib/utils';

interface ReportGeneratorProps {
  projectId: string;
  projectName: string;
  className?: string;
}

// Report type options
const reportTypes: { value: ReportType; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  {
    value: 'project_overview',
    label: 'Project Overview',
    icon: Building2,
    description: 'Complete project status with progress and budget',
  },
  {
    value: 'boq_summary',
    label: 'BOQ Summary',
    icon: FileText,
    description: 'Bill of Quantities with all items and amounts',
  },
  {
    value: 'material_requirements',
    label: 'Material Requirements',
    icon: Receipt,
    description: 'All materials needed with delivery status',
  },
  {
    value: 'variance_analysis',
    label: 'Variance Analysis',
    icon: TrendingUp,
    description: 'Planned vs actual comparison',
  },
  {
    value: 'procurement_log',
    label: 'Procurement Log',
    icon: Receipt,
    description: 'All deliveries and purchase orders',
  },
  {
    value: 'tax_compliance',
    label: 'Tax Compliance',
    icon: CheckCircle,
    description: 'EFRIS validation and VAT summary',
  },
];

// Format options
const formatOptions: { value: ExportFormat; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'pdf', label: 'PDF Document', icon: FileText },
  { value: 'xlsx', label: 'Excel Spreadsheet', icon: FileSpreadsheet },
  { value: 'csv', label: 'CSV File', icon: FileText },
  { value: 'json', label: 'JSON Data', icon: FileJson },
];

export function ReportGenerator({
  projectId,
  projectName,
  className,
}: ReportGeneratorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  
  const { generateReport, isGenerating } = useExport(projectId);
  const { templates } = useReportTemplates();
  const {
    config,
    updateConfig,
    setType,
    setFormat,
    applyTemplate,
  } = useReportConfigBuilder('project_overview');
  
  // Initialize with project ID
  useEffect(() => {
    updateConfig({ projectId });
  }, [projectId, updateConfig]);
  
  const handleGenerate = () => {
    if (!config.title) {
      updateConfig({ title: reportTypes.find(t => t.value === config.type)?.label || 'Report' });
    }
    
    const fullConfig: ReportConfig = {
      ...config,
      projectId,
      title: config.title || 'Report',
      format: config.format || 'pdf',
      includeSummary: config.includeSummary ?? true,
      includeDetails: config.includeDetails ?? true,
      includeCharts: config.includeCharts ?? false,
      includeAppendix: config.includeAppendix ?? false,
      dateRange: dateRange.from && dateRange.to ? {
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
      } : undefined,
    } as ReportConfig;
    
    generateReport(fullConfig);
  };
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generate Report
        </CardTitle>
        <CardDescription>
          Create reports for {projectName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Report Type Selection */}
        <div className="space-y-3">
          <Label>Report Type</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {reportTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = config.type === type.value;
              
              return (
                <button
                  key={type.value}
                  onClick={() => {
                    setType(type.value);
                    updateConfig({ title: type.label });
                  }}
                  className={cn(
                    'flex flex-col items-start p-3 rounded-lg border-2 transition-colors text-left',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  )}
                >
                  <Icon className={cn(
                    'h-5 w-5 mb-2',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <span className={cn(
                    'font-medium text-sm',
                    isSelected && 'text-primary'
                  )}>
                    {type.label}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {type.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Date Range */}
        <div className="space-y-2">
          <Label>Date Range (Optional)</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value) : prev.from }))}
              className="flex-1"
            />
            <span className="flex items-center text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value) : prev.to }))}
              className="flex-1"
            />
          </div>
        </div>
        
        {/* Format Selection */}
        <div className="space-y-2">
          <Label>Export Format</Label>
          <div className="flex gap-2">
            {formatOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = config.format === option.value;
              
              return (
                <Button
                  key={option.value}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormat(option.value)}
                  className="flex-1"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {option.label.split(' ')[0]}
                </Button>
              );
            })}
          </div>
        </div>
        
        {/* Report Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Report Title</Label>
          <Input
            id="title"
            value={config.title || ''}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="Enter report title..."
          />
        </div>
        
        {/* Content Options */}
        <div className="space-y-3">
          <Label>Include in Report</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="summary"
                checked={config.includeSummary}
                onChange={(e) => updateConfig({ includeSummary: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="summary" className="text-sm">Summary</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="details"
                checked={config.includeDetails}
                onChange={(e) => updateConfig({ includeDetails: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="details" className="text-sm">Details</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="charts"
                checked={config.includeCharts}
                onChange={(e) => updateConfig({ includeCharts: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="charts" className="text-sm">Charts</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="appendix"
                checked={config.includeAppendix}
                onChange={(e) => updateConfig({ includeAppendix: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="appendix" className="text-sm">Appendix</label>
            </div>
          </div>
        </div>
        
        {/* Advanced Options Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </Button>
        
        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Paper Size</Label>
                <Select
                  value={config.paperSize}
                  onValueChange={(v) => updateConfig({ paperSize: v as 'a4' | 'letter' | 'legal' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Orientation</Label>
                <Select
                  value={config.orientation}
                  onValueChange={(v) => updateConfig({ orientation: v as 'portrait' | 'landscape' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="header">Header Text</Label>
              <Input
                id="header"
                value={config.headerText || ''}
                onChange={(e) => updateConfig({ headerText: e.target.value })}
                placeholder="Optional header text..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="footer">Footer Text</Label>
              <Input
                id="footer"
                value={config.footerText || ''}
                onChange={(e) => updateConfig({ footerText: e.target.value })}
                placeholder="Optional footer text..."
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="logo"
                checked={config.includeLogo}
                onChange={(e) => updateConfig({ includeLogo: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="logo" className="text-sm">Include Company Logo</label>
            </div>
          </div>
        )}
        
        {/* Templates */}
        {templates.length > 0 && (
          <div className="space-y-2">
            <Label>Or use a template</Label>
            <Select onValueChange={(id) => {
              const template = templates.find(t => t.id === id);
              if (template) applyTemplate(template);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!config.type || isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default ReportGenerator;
