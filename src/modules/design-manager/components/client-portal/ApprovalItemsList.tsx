/**
 * Approval Items List Component
 * Displays materials, standard parts, and special parts requiring client approval
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  Layers,
  Wrench,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Star,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Textarea } from '@/core/components/ui/textarea';
import {
  getApprovalItems,
  submitApprovalResponse,
} from '../../services/clientPortalExtendedService';
import type { 
  ClientApprovalItem, 
  ApprovalItemType, 
  ApprovalItemStatus 
} from '../../types/clientPortal';

interface ApprovalItemsListProps {
  projectId: string;
  quoteId?: string;
  isClientView?: boolean;
  clientName?: string;
  onApprovalChange?: () => void;
}

const TYPE_CONFIG: Record<ApprovalItemType, { label: string; icon: typeof Package; color: string }> = {
  material: { label: 'Material', icon: Layers, color: 'bg-blue-100 text-blue-800' },
  standard_part: { label: 'Standard Part', icon: Package, color: 'bg-green-100 text-green-800' },
  special_part: { label: 'Special Part', icon: Wrench, color: 'bg-purple-100 text-purple-800' },
  procurement: { label: 'Procurement', icon: Package, color: 'bg-orange-100 text-orange-800' },
  design_change: { label: 'Design Change', icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800' },
  design_option: { label: 'Design Option', icon: Lightbulb, color: 'bg-yellow-100 text-yellow-700' },
};

const STATUS_CONFIG: Record<ApprovalItemStatus, { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', icon: Clock, variant: 'outline' },
  approved: { label: 'Approved', icon: CheckCircle, variant: 'default' },
  rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' },
  revision: { label: 'Revision Requested', icon: AlertTriangle, variant: 'secondary' },
  superseded: { label: 'Superseded', icon: Clock, variant: 'outline' },
};

export default function ApprovalItemsList({
  projectId,
  quoteId,
  isClientView = false,
  clientName,
  onApprovalChange,
}: ApprovalItemsListProps) {
  const [items, setItems] = useState<ClientApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadItems();
  }, [projectId, quoteId]);

  const loadItems = async () => {
    try {
      const data = await getApprovalItems(projectId, { quoteId });
      setItems(data);
    } catch (err) {
      console.error('Failed to load approval items:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleResponse = async (itemId: string, status: ApprovalItemStatus) => {
    if (!clientName) return;
    
    setSubmitting(true);
    try {
      await submitApprovalResponse(itemId, status, clientName, {
        notes: responseNotes || undefined,
      });
      setRespondingTo(null);
      setResponseNotes('');
      await loadItems();
      onApprovalChange?.();
    } catch (err) {
      console.error('Failed to submit response:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'UGX') => {
    return new Intl.NumberFormat('en-UG', {
      style: 'decimal',
      minimumFractionDigits: 0,
    }).format(amount) + ' ' + currency;
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;

  // Group items by type
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<ApprovalItemType, ClientApprovalItem[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading approval items...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No items requiring approval</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Items for Approval
          </span>
          {pendingCount > 0 && (
            <Badge variant="outline">
              {pendingCount} pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {Object.entries(groupedItems).map(([type, typeItems]) => {
          const config = TYPE_CONFIG[type as ApprovalItemType];
          const TypeIcon = config.icon;
          
          return (
            <div key={type}>
              {/* Type Header */}
              <div className="flex items-center gap-2 mb-3">
                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{config.label}s</span>
                <Badge variant="outline" className="ml-auto">
                  {typeItems.length}
                </Badge>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {typeItems.map((item) => {
                  const statusConfig = STATUS_CONFIG[item.status];
                  const StatusIcon = statusConfig.icon;
                  const isExpanded = expandedItems.has(item.id);
                  const isResponding = respondingTo === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Item Header */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                            <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.name}</span>
                            {item.sku && (
                              <span className="text-xs text-muted-foreground">
                                {item.sku}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{item.quantity} {item.unit}</span>
                            <span>•</span>
                            <span>{formatCurrency(item.totalCost, item.currency)}</span>
                          </div>
                        </div>

                        <Badge variant={statusConfig.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>

                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t px-3 py-3 bg-muted/30 space-y-3">
                          {/* Description */}
                          {item.description && (
                            <p className="text-sm">{item.description}</p>
                          )}

                          {/* Design Option: Inspirations Gallery */}
                          {item.type === 'design_option' && item.designOption?.inspirations && item.designOption.inspirations.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Inspirations</span>
                                {item.designOption.isRecommended && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                                    <Star className="h-3 w-3 fill-yellow-500" />
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {item.designOption.inspirations.map((insp) => (
                                  <div
                                    key={insp.id}
                                    className="relative group rounded-lg overflow-hidden border border-border bg-background"
                                  >
                                    <div className="aspect-square bg-muted">
                                      <img
                                        src={insp.thumbnailUrl || insp.imageUrl}
                                        alt={insp.title}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="p-2">
                                      <p className="text-xs font-medium truncate">{insp.title}</p>
                                      {insp.sourceUrl && (
                                        <a
                                          href={insp.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ExternalLink className="h-2.5 w-2.5" />
                                          Source
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {item.designOption.comparisonNotes && (
                                <p className="text-xs text-muted-foreground italic">
                                  Note: {item.designOption.comparisonNotes}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Material Details */}
                          {item.material && (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {item.material.species && (
                                <div>
                                  <span className="text-muted-foreground">Species:</span>{' '}
                                  {item.material.species}
                                </div>
                              )}
                              {item.material.thickness && (
                                <div>
                                  <span className="text-muted-foreground">Thickness:</span>{' '}
                                  {item.material.thickness}
                                </div>
                              )}
                              {item.material.grade && (
                                <div>
                                  <span className="text-muted-foreground">Grade:</span>{' '}
                                  {item.material.grade}
                                </div>
                              )}
                              {item.material.finish && (
                                <div>
                                  <span className="text-muted-foreground">Finish:</span>{' '}
                                  {item.material.finish}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Part Details */}
                          {item.part && (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {item.part.manufacturer && (
                                <div>
                                  <span className="text-muted-foreground">Manufacturer:</span>{' '}
                                  {item.part.manufacturer}
                                </div>
                              )}
                              {item.part.partNumber && (
                                <div>
                                  <span className="text-muted-foreground">Part #:</span>{' '}
                                  {item.part.partNumber}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Vendor & Lead Time */}
                          <div className="flex gap-4 text-sm">
                            {item.vendor && (
                              <div>
                                <span className="text-muted-foreground">Vendor:</span>{' '}
                                {item.vendor}
                              </div>
                            )}
                            {item.leadTime && (
                              <div>
                                <span className="text-muted-foreground">Lead Time:</span>{' '}
                                {item.leadTime}
                              </div>
                            )}
                          </div>

                          {/* Pricing */}
                          <div className="flex items-center justify-between text-sm font-medium bg-background rounded p-2">
                            <span>
                              {formatCurrency(item.unitCost, item.currency)} × {item.quantity} {item.unit}
                            </span>
                            <span>
                              Total: {formatCurrency(item.totalCost, item.currency)}
                            </span>
                          </div>

                          {/* Specification Link */}
                          {item.specificationUrl && (
                            <a
                              href={item.specificationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Specifications
                            </a>
                          )}

                          {/* Alternative Options */}
                          {item.alternativeOptions && item.alternativeOptions.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-sm font-medium">Alternative Options:</span>
                              <div className="grid gap-2">
                                {item.alternativeOptions.map((alt) => (
                                  <div
                                    key={alt.id}
                                    className="flex items-center gap-2 p-2 bg-background rounded"
                                  >
                                    {alt.imageUrl && (
                                      <img
                                        src={alt.imageUrl}
                                        alt={alt.name}
                                        className="w-8 h-8 rounded object-cover"
                                      />
                                    )}
                                    <div className="flex-1">
                                      <span className="text-sm">{alt.name}</span>
                                      {alt.description && (
                                        <p className="text-xs text-muted-foreground">
                                          {alt.description}
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-sm font-medium">
                                      {formatCurrency(alt.unitCost, item.currency)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Client Response */}
                          {item.clientResponse && (
                            <div className="bg-background rounded p-2 text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={STATUS_CONFIG[item.clientResponse.status].variant}>
                                  {STATUS_CONFIG[item.clientResponse.status].label}
                                </Badge>
                                <span className="text-muted-foreground">
                                  by {item.clientResponse.respondedBy}
                                </span>
                              </div>
                              {item.clientResponse.notes && (
                                <p className="text-muted-foreground">
                                  {item.clientResponse.notes}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Approval Actions (Client View) */}
                          {isClientView && item.status === 'pending' && (
                            <div className="space-y-3 pt-2">
                              {isResponding ? (
                                <>
                                  <Textarea
                                    value={responseNotes}
                                    onChange={(e) => setResponseNotes(e.target.value)}
                                    placeholder="Add notes (optional)"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleResponse(item.id, 'approved')}
                                      disabled={submitting}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleResponse(item.id, 'revision')}
                                      disabled={submitting}
                                    >
                                      Request Changes
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleResponse(item.id, 'rejected')}
                                      disabled={submitting}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setRespondingTo(null);
                                        setResponseNotes('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => setRespondingTo(item.id)}
                                >
                                  Respond to This Item
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
