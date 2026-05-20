/**
 * Reports List Component
 * Displays generated reports with download options
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
import { Badge } from '@/core/components/ui/badge';
import {
  Download,
  MoreVertical,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Eye,
} from 'lucide-react';
import { useExport } from '../../hooks/useExport';
import { ReportRecord, ReportStatus } from '../../types/export';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';

interface ReportsListProps {
  projectId: string;
  className?: string;
}

const statusConfig: Record<ReportStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-yellow-600 bg-yellow-50',
  },
  generating: {
    label: 'Generating',
    icon: RefreshCw,
    color: 'text-blue-600 bg-blue-50',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    color: 'text-green-600 bg-green-50',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-600 bg-red-50',
  },
  expired: {
    label: 'Expired',
    icon: AlertCircle,
    color: 'text-gray-600 bg-gray-50',
  },
};

// Helper functions
function formatDate(dateString: string, formatStr: string = 'PPp'): string {
  try {
    return format(new Date(dateString), formatStr);
  } catch {
    return dateString;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function ReportsList({ projectId, className }: ReportsListProps) {
  const {
    reports,
    isLoading,
    refetch,
    downloadReport,
    deleteReport,
    isDeleting,
  } = useExport(projectId);
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  
  const handleDelete = (reportId: string) => {
    deleteReport(reportId);
    setDeleteConfirm(null);
  };
  
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>
            View and download your reports
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No reports generated yet</p>
            <p className="text-sm">Use the report generator to create your first report</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report: ReportRecord) => {
              const status = statusConfig[report.status];
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{report.config.title}</p>
                      <Badge
                        variant="secondary"
                        className={cn('inline-flex items-center gap-1 text-xs', status.color)}
                      >
                        <StatusIcon className={cn(
                          'h-3 w-3',
                          report.status === 'generating' && 'animate-spin'
                        )} />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="uppercase">{report.config.format}</span>
                      <span>•</span>
                      <span>{report.config.type.replace(/_/g, ' ')}</span>
                      {report.generatedAt && (
                        <>
                          <span>•</span>
                          <span>{formatDate(report.generatedAt, 'PP')}</span>
                        </>
                      )}
                      {report.fileSize && (
                        <>
                          <span>•</span>
                          <span>{formatFileSize(report.fileSize)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {report.status === 'ready' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadReport(report)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {report.downloadUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(report.downloadUrl, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                    
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMenuOpen(menuOpen === report.id ? null : report.id)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      
                      {menuOpen === report.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-10 min-w-[120px]">
                          <button
                            onClick={() => {
                              setDeleteConfirm(report.id);
                              setMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-2">Delete Report</h3>
              <p className="text-muted-foreground mb-4">
                Are you sure you want to delete this report? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReportsList;
