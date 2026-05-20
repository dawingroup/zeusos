/**
 * Deliverables List Component
 * Displays project deliverables (drawings, models, specs) with payment-gated downloads
 */

import { useState, useEffect } from 'react';
import { UnifiedFileManager } from '@/shared/components/file-manager';
import { 
  FileText, 
  Download, 
  Eye, 
  Lock, 
  CheckCircle,
  Clock,
  Box,
  Image as ImageIcon,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  getProjectDeliverables,
  canDownloadDeliverable,
  trackDeliverableDownload,
} from '../../services/clientPortalExtendedService';
import { getPortalSharedDeliverables } from '../../services/firestore';
import type { ProjectDeliverable, DeliverableType, DeliverableStatus } from '../../types/clientPortal';
import RequestRevisionButton from './RequestRevisionButton';
import MyRevisionRequests from './MyRevisionRequests';

interface DeliverablesListProps {
  projectId: string;
  quoteId?: string;
  isClientView?: boolean;
  clientName?: string;
}

const TYPE_CONFIG: Record<DeliverableType, { label: string; icon: typeof FileText }> = {
  drawing: { label: '2D Drawing', icon: FileText },
  model: { label: '3D Model', icon: Box },
  specification: { label: 'Specification', icon: FileText },
  cutlist: { label: 'Cut List', icon: FileSpreadsheet },
  bom: { label: 'Bill of Materials', icon: FileSpreadsheet },
  render: { label: 'Render', icon: ImageIcon },
  other: { label: 'Document', icon: FileText },
};

const STATUS_CONFIG: Record<DeliverableStatus, { label: string; color: string }> = {
  draft: { label: 'In Progress', color: 'bg-gray-100 text-gray-800' },
  pending_payment: { label: 'Payment Required', color: 'bg-yellow-100 text-yellow-800' },
  available: { label: 'Available', color: 'bg-green-100 text-green-800' },
  downloaded: { label: 'Downloaded', color: 'bg-blue-100 text-blue-800' },
  superseded: { label: 'Superseded', color: 'bg-gray-100 text-gray-600' },
};

export default function DeliverablesList({
  projectId,
  quoteId,
  isClientView: _isClientView = false,
  clientName,
}: DeliverablesListProps) {
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDeliverables();
  }, [projectId, quoteId]);

  // Map design manager deliverable types to portal types
  const mapDeliverableType = (type: string): DeliverableType => {
    const typeMap: Record<string, DeliverableType> = {
      'concept-sketch': 'drawing',
      'mood-board': 'render',
      '3d-model': 'model',
      'rendering': 'render',
      'shop-drawing': 'drawing',
      'cut-list': 'cutlist',
      'bom': 'bom',
      'assembly-instructions': 'specification',
      'specification-sheet': 'specification',
      'client-presentation': 'other',
      'other': 'other',
    };
    return typeMap[type] || 'other';
  };

  const loadDeliverables = async () => {
    try {
      // Fetch both portal deliverables and shared design manager files
      const [portalDeliverables, sharedDeliverables] = await Promise.all([
        getProjectDeliverables(projectId, quoteId),
        getPortalSharedDeliverables(projectId),
      ]);
      
      // Convert shared design manager deliverables to portal format
      const convertedShared: ProjectDeliverable[] = sharedDeliverables.map((del): any => ({
        id: `dm-${del.id}`,
        projectId,
        type: mapDeliverableType(del.type),
        name: del.portalDisplayName || del.name,
        description: del.description || `From: ${del.itemName}`,
        fileUrl: del.storageUrl,
        fileName: del.name,
        fileSize: del.fileSize,
        mimeType: del.fileType,
        version: del.version,
        status: 'available' as DeliverableStatus,
        requiresPayment: false,
        createdAt: del.uploadedAt,
        createdBy: del.uploadedBy,
        // Source tracking
        sourceType: 'design-manager' as const,
        sourceItemId: del.itemId,
        sourceItemName: del.itemName,
        downloadCount: 0,
      }));
      
      // Combine and deduplicate
      const allDeliverables = [...portalDeliverables, ...convertedShared];
      setDeliverables(allDeliverables);
    } catch (err) {
      console.error('Failed to load deliverables:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (deliverable: ProjectDeliverable) => {
    setDownloading(deliverable.id);
    setError(null);
    
    try {
      // Check if download is allowed
      const { canDownload, reason } = await canDownloadDeliverable(
        deliverable.id,
        projectId
      );
      
      if (!canDownload) {
        setError(reason || 'Download not available');
        return;
      }
      
      // Track the download
      await trackDeliverableDownload(deliverable.id, clientName);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = deliverable.fileUrl;
      link.download = deliverable.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Reload to update status
      await loadDeliverables();
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = (deliverable: ProjectDeliverable) => {
    // Open in new tab for preview
    window.open(deliverable.fileUrl, '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'UGX') => {
    return new Intl.NumberFormat('en-UG', {
      style: 'decimal',
      minimumFractionDigits: 0,
    }).format(amount) + ' ' + currency;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading deliverables...
        </CardContent>
      </Card>
    );
  }

  if (deliverables.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No deliverables available yet</p>
        </CardContent>
      </Card>
    );
  }

  // Group by type
  const groupedDeliverables = deliverables.reduce((acc, d) => {
    if (!acc[d.type]) acc[d.type] = [];
    acc[d.type].push(d);
    return acc;
  }, {} as Record<DeliverableType, ProjectDeliverable[]>);

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Project Deliverables
          <Badge variant="outline" className="ml-auto">
            {deliverables.length} files
          </Badge>
          {/* Phase 3b — F-D3 client feedback loop. Tracked in the
              designer's RevisionRequestsPanel inbox. */}
          <RequestRevisionButton
            projectId={projectId}
            clientName={clientName}
          />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        {Object.entries(groupedDeliverables).map(([type, typeDeliverables]) => {
          const config = TYPE_CONFIG[type as DeliverableType];
          const TypeIcon = config.icon;
          
          return (
            <div key={type}>
              {/* Type Header */}
              <div className="flex items-center gap-2 mb-3">
                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{config.label}s</span>
              </div>

              {/* Deliverables */}
              <div className="space-y-2">
                {typeDeliverables.map((deliverable) => {
                  const statusConfig = STATUS_CONFIG[deliverable.status];
                  const isDownloading = downloading === deliverable.id;
                  const canDownloadNow = ['available', 'downloaded'].includes(deliverable.status);
                  const needsPayment = deliverable.status === 'pending_payment';
                  
                  return (
                    <div
                      key={deliverable.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      {/* Thumbnail */}
                      {deliverable.thumbnailUrl ? (
                        <img
                          src={deliverable.thumbnailUrl}
                          alt={deliverable.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <TypeIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{deliverable.name}</span>
                          {deliverable.version > 1 && (
                            <span className="text-xs text-muted-foreground">
                              v{deliverable.version}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatFileSize(deliverable.fileSize)}</span>
                          <span>•</span>
                          <span>{formatDate(deliverable.createdAt)}</span>
                          {deliverable.downloadCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{deliverable.downloadCount} downloads</span>
                            </>
                          )}
                        </div>
                        {deliverable.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {deliverable.description}
                          </p>
                        )}
                      </div>

                      {/* Status Badge */}
                      <Badge className={statusConfig.color}>
                        {needsPayment && <Lock className="h-3 w-3 mr-1" />}
                        {deliverable.status === 'downloaded' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {deliverable.status === 'draft' && <Clock className="h-3 w-3 mr-1" />}
                        {statusConfig.label}
                      </Badge>

                      {/* Payment Info */}
                      {needsPayment && deliverable.paymentAmount && (
                        <span className="text-sm font-medium">
                          {formatCurrency(deliverable.paymentAmount, deliverable.paymentCurrency)}
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex gap-1">
                        {canDownloadNow && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePreview(deliverable)}
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDownload(deliverable)}
                              disabled={isDownloading}
                              title="Download"
                            >
                              {isDownloading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        {needsPayment && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            title="Payment required"
                          >
                            <Lock className="h-4 w-4 mr-1" />
                            Unlock
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>

    {/* Phase 4b — portal My Requests feedback-loop closure.
        Renders nothing when the client has no requests yet, so the
        DeliverablesList stays compact for new projects. */}
    <div className="mt-6">
      <MyRevisionRequests projectId={projectId} />
    </div>

    <div className="mt-6">
      <UnifiedFileManager
        projectId={projectId}
        userId=""
        readOnly
        showBulkActions={false}
        module="shared"
      />
    </div>
  </>
  );
}
