/**
 * Quick Export Panel Component
 * Fast data export without report generation
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useQuickExport } from '../../hooks/useExport';
import { DataExportConfig } from '../../types/export';
import { cn } from '@/shared/lib/utils';

interface QuickExportPanelProps {
  projectId: string;
  className?: string;
}

const entities = [
  { id: 'boqItems', label: 'BOQ Items', description: 'All bill of quantities items' },
  { id: 'deliveries', label: 'Deliveries', description: 'Delivery logs and records' },
  { id: 'materials', label: 'Materials', description: 'Material requirements' },
  { id: 'invoices', label: 'Invoices', description: 'EFRIS validated invoices' },
] as const;

type EntityId = typeof entities[number]['id'];

export function QuickExportPanel({ projectId, className }: QuickExportPanelProps) {
  const { exportData, isExporting } = useQuickExport();
  const [selectedEntities, setSelectedEntities] = useState<EntityId[]>(['boqItems']);
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');
  const [includeRelated, setIncludeRelated] = useState(true);
  
  const toggleEntity = (entityId: EntityId) => {
    setSelectedEntities(prev =>
      prev.includes(entityId)
        ? prev.filter(e => e !== entityId)
        : [...prev, entityId]
    );
  };
  
  const handleExport = () => {
    const config: DataExportConfig = {
      entities: selectedEntities as DataExportConfig['entities'],
      projectId,
      format,
      includeRelated,
    };
    
    exportData(config);
  };
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Quick Data Export
        </CardTitle>
        <CardDescription>
          Export raw data without generating a formatted report
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Entity Selection */}
        <div className="space-y-3">
          <Label>Select Data to Export</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entities.map((entity) => {
              const isSelected = selectedEntities.includes(entity.id);
              
              return (
                <button
                  key={entity.id}
                  onClick={() => toggleEntity(entity.id)}
                  className={cn(
                    'flex items-start gap-3 p-3 border rounded-lg text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  )}
                >
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-primary mt-0.5" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground mt-0.5" />
                  )}
                  <div>
                    <span className={cn(
                      'text-sm font-medium',
                      isSelected && 'text-primary'
                    )}>
                      {entity.label}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {entity.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Format Selection */}
        <div className="space-y-2">
          <Label>Export Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as 'xlsx' | 'csv' | 'json')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel (.xlsx)
                </div>
              </SelectItem>
              <SelectItem value="csv">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CSV (.csv)
                </div>
              </SelectItem>
              <SelectItem value="json">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4" />
                  JSON (.json)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Options */}
        <button
          onClick={() => setIncludeRelated(!includeRelated)}
          className="flex items-center gap-2 text-sm"
        >
          {includeRelated ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground" />
          )}
          Include related data (linked records)
        </button>
        
        {/* Export Button */}
        <Button
          onClick={handleExport}
          disabled={selectedEntities.length === 0 || isExporting}
          className="w-full"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default QuickExportPanel;
