/**
 * Client Portal Page
 * Public-facing page for clients to view quotes and approve procurement items
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  Package,
  AlertCircle,
  Loader2,
  Building2,
  Mail,
  Phone,
  Globe,
  MessageSquare,
  Send,
  RefreshCw,
  Box,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/core/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { signInAnonymouslyForPortal } from '@/core/services/firebase/auth';
import {
  getClientPortalData,
  processClientResponse,
  QuoteAlreadyRespondedError,
  QuoteExpiredError,
} from '../../services/clientPortalService';
import type { ClientPortalData, ClientProcurementItem, ProcurementApprovalStatus } from '../../types/clientPortal';
import PortalMessaging from './PortalMessaging';
import ApprovalItemsList from './ApprovalItemsList';
import DeliverablesList from './DeliverablesList';
import SketchUpViewer from './SketchUpViewer';

/**
 * Format currency
 */
function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    sent: { label: 'Awaiting Response', variant: 'outline' },
    viewed: { label: 'Viewed', variant: 'outline' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    revision: { label: 'Revision Requested', variant: 'secondary' },
    expired: { label: 'Expired', variant: 'destructive' },
    pending: { label: 'Pending', variant: 'outline' },
  };
  
  const { label, variant } = config[status] || { label: status, variant: 'secondary' };
  
  return <Badge variant={variant}>{label}</Badge>;
}

/**
 * Procurement item card
 */
function ProcurementItemCard({
  item,
  onStatusChange,
  disabled,
}: {
  item: ClientProcurementItem;
  onStatusChange: (itemId: string, status: ProcurementApprovalStatus, notes?: string) => void;
  disabled: boolean;
}) {
  const [notes, setNotes] = useState(item.clientNotes || '');
  const [showNotes, setShowNotes] = useState(false);
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{item.name}</CardTitle>
            <CardDescription>{item.designItemName}</CardDescription>
          </div>
          <StatusBadge status={item.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {item.description && (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        )}
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Quantity:</span>
            <span className="ml-2 font-medium">{item.quantity}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Unit Cost:</span>
            <span className="ml-2 font-medium">{formatCurrency(item.unitCost, item.currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total:</span>
            <span className="ml-2 font-medium">{formatCurrency(item.totalCost, item.currency)}</span>
          </div>
          {item.vendor && (
            <div>
              <span className="text-muted-foreground">Vendor:</span>
              <span className="ml-2 font-medium">{item.vendor}</span>
            </div>
          )}
        </div>
        
        {item.leadTime && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Lead Time:</span>
            <span>{item.leadTime}</span>
          </div>
        )}
        
        {item.referenceImageUrl && (
          <img 
            src={item.referenceImageUrl} 
            alt={item.name}
            className="w-full h-32 object-cover rounded-md"
          />
        )}
        
        {showNotes && (
          <div className="space-y-2">
            <Label htmlFor={`notes-${item.id}`}>Your Notes</Label>
            <Textarea
              id={`notes-${item.id}`}
              placeholder="Add any notes or requirements..."
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              disabled={disabled}
            />
          </div>
        )}
      </CardContent>
      
      {item.status === 'pending' && !disabled && (
        <CardFooter className="flex flex-col gap-2 pt-0">
          {!showNotes && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowNotes(true)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Notes
            </Button>
          )}
          <div className="flex gap-2 w-full">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={() => onStatusChange(item.id, 'approved', notes)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onStatusChange(item.id, 'revision', notes)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Request Change
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => onStatusChange(item.id, 'rejected', notes)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * Main Client Portal Page
 */
export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'revision' | null>(null);
  const [overallNotes, setOverallNotes] = useState('');
  const [procurementApprovals, setProcurementApprovals] = useState<Map<string, { status: ProcurementApprovalStatus; notes?: string }>>(new Map());
  
  useEffect(() => {
    async function loadData() {
      if (!token) {
        setError('Invalid access link');
        setLoading(false);
        return;
      }

      try {
        // Try anonymous auth for write operations (mark as viewed, org settings)
        // but don't block portal rendering if it fails
        try { await signInAnonymouslyForPortal(); } catch { /* optional */ }

        const portalData = await getClientPortalData(token);
        if (!portalData) {
          setError('Quote not found or access link has expired');
        } else {
          setData(portalData);
          // Initialize procurement approvals
          const approvals = new Map<string, { status: ProcurementApprovalStatus; notes?: string }>();
          portalData.quote.procurementItems.forEach((item) => {
            approvals.set(item.id, { status: item.status, notes: item.clientNotes });
          });
          setProcurementApprovals(approvals);
        }
      } catch (err) {
        setError('Failed to load quote data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [token]);
  
  const handleProcurementStatusChange = (
    itemId: string,
    status: ProcurementApprovalStatus,
    notes?: string
  ) => {
    setProcurementApprovals((prev) => {
      const next = new Map(prev);
      next.set(itemId, { status, notes });
      return next;
    });
  };
  
  const handleConfirmAction = (action: 'approve' | 'reject' | 'revision') => {
    setConfirmAction(action);
    setShowConfirmDialog(true);
  };
  
  const handleSubmitResponse = async () => {
    if (!token || !confirmAction) return;
    
    setSubmitting(true);
    try {
      await processClientResponse(token, {
        quoteId: data!.quote.id,
        action: confirmAction,
        notes: overallNotes,
        procurementApprovals: Array.from(procurementApprovals.entries()).map(([itemId, { status, notes }]) => ({
          itemId,
          status,
          notes,
        })),
      });
      
      // Refresh data
      const portalData = await getClientPortalData(token);
      setData(portalData);
      setShowConfirmDialog(false);
      setConfirmAction(null);
    } catch (err) {
      console.error(err);
      if (err instanceof QuoteAlreadyRespondedError) {
        // Not really an error — the quote was responded to on another
        // session/device. Refresh the data so the UI shows the
        // already-responded state instead of a red toast.
        const portalData = await getClientPortalData(token).catch(() => null);
        if (portalData) setData(portalData);
        setShowConfirmDialog(false);
        setConfirmAction(null);
        setError(
          `This quote was already ${err.existingStatus} — ` +
            `you\'re seeing the latest recorded response. ` +
            `Contact your project manager if you need to make a change.`,
        );
      } else if (err instanceof QuoteExpiredError) {
        setError(
          'This quote has expired. Please ask your project manager to issue a fresh link.',
        );
      } else {
        setError('Failed to submit response. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading quote...</p>
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {error || 'Unable to load the quote. The link may be invalid or expired.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { quote, companyInfo, canApprove, isExpired } = data;
  
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {companyInfo.logoUrl ? (
                <img 
                  src={companyInfo.logoUrl} 
                  alt={companyInfo.name}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
              <div>
                <h1 className="font-bold text-lg">{companyInfo.name}</h1>
                <p className="text-sm text-muted-foreground">Client Portal</p>
              </div>
            </div>
            <StatusBadge status={quote.status} />
          </div>
        </div>
      </header>
      
      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Expired Alert */}
        {isExpired && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Quote Expired</AlertTitle>
            <AlertDescription>
              This quote has expired. Please contact us for an updated quote.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Response Status */}
        {quote.clientResponse && (
          <Alert variant={quote.clientResponse.status === 'approved' ? 'default' : 'destructive'}>
            {quote.clientResponse.status === 'approved' ? (
              <CheckCircle className="h-4 w-4" />
            ) : quote.clientResponse.status === 'rejected' ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <AlertTitle>
              {quote.clientResponse.status === 'approved' ? 'Quote Approved' :
               quote.clientResponse.status === 'rejected' ? 'Quote Rejected' : 'Revision Requested'}
            </AlertTitle>
            {quote.clientResponse.notes && (
              <AlertDescription>{quote.clientResponse.notes}</AlertDescription>
            )}
          </Alert>
        )}

        {/* Main Tabbed Interface */}
        <Tabs defaultValue="quote" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="quote" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Quote</span>
            </TabsTrigger>
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Approvals</span>
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Files</span>
            </TabsTrigger>
            <TabsTrigger value="3d-view" className="flex items-center gap-2">
              <Box className="h-4 w-4" />
              <span className="hidden sm:inline">3D View</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
          </TabsList>

          {/* Quote Tab */}
          <TabsContent value="quote" className="space-y-6 mt-6">
        {/* Quote Details */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {quote.title}
                </CardTitle>
                <CardDescription className="mt-1">
                  Quote #{quote.quoteNumber} • {quote.projectName}
                </CardDescription>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Valid until: {format(quote.validUntil.toDate(), 'PPP')}</p>
                <p>Created: {format(quote.createdAt.toDate(), 'PPP')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {quote.description && (
              <p className="text-muted-foreground mb-4">{quote.description}</p>
            )}
            
            {/* Line Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Qty</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quote.lineItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice, quote.currency)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.totalPrice, quote.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-sm">Subtotal</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(quote.subtotal, quote.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-sm">Tax ({(quote.taxRate * 100).toFixed(0)}%)</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(quote.taxAmount, quote.currency)}</td>
                  </tr>
                  <tr className="text-lg">
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(quote.total, quote.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            {/* Payment Terms */}
            {(quote.paymentTerms || quote.depositRequired) && (
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Payment Terms</h4>
                {quote.paymentTerms && <p className="text-sm text-muted-foreground">{quote.paymentTerms}</p>}
                {quote.depositRequired && (
                  <p className="text-sm mt-1">
                    <span className="font-medium">Deposit Required: </span>
                    {quote.depositType === 'percentage' 
                      ? `${quote.depositRequired}%` 
                      : formatCurrency(quote.depositRequired, quote.currency)}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Procurement Items */}
        {quote.procurementItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Items Requiring Your Approval
              </CardTitle>
              <CardDescription>
                The following items need to be procured from external suppliers. Please review and approve each item.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {quote.procurementItems.map((item) => (
                  <ProcurementItemCard
                    key={item.id}
                    item={item}
                    onStatusChange={handleProcurementStatusChange}
                    disabled={!canApprove}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Action Buttons */}
        {canApprove && (
          <Card>
            <CardHeader>
              <CardTitle>Your Response</CardTitle>
              <CardDescription>
                Please review the quote and procurement items above, then submit your response.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="overall-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="overall-notes"
                  placeholder="Add any comments or special requirements..."
                  value={overallNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOverallNotes(e.target.value)}
                  className="mt-2"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                onClick={() => handleConfirmAction('approve')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Quote
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleConfirmAction('revision')}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Request Revision
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleConfirmAction('reject')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Quote
              </Button>
            </CardFooter>
          </Card>
        )}
          </TabsContent>

          {/* Approvals Tab */}
          <TabsContent value="approvals" className="mt-6">
            <ApprovalItemsList
              projectId={quote.projectId}
              quoteId={quote.id}
              isClientView={true}
              clientName={quote.clientName}
              onApprovalChange={() => {
                // Refresh data after approval
                if (token) {
                  getClientPortalData(token).then(setData);
                }
              }}
            />
          </TabsContent>

          {/* Deliverables Tab */}
          <TabsContent value="deliverables" className="mt-6">
            <DeliverablesList
              projectId={quote.projectId}
              quoteId={quote.id}
              isClientView={true}
              clientName={quote.clientName}
            />
          </TabsContent>

          {/* 3D View Tab */}
          <TabsContent value="3d-view" className="mt-6">
            <SketchUpViewer
              projectId={quote.projectId}
            />
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-6">
            <PortalMessaging
              projectId={quote.projectId}
              quoteId={quote.id}
              currentUserType="client"
              currentUserName={quote.clientName || ''}
              currentUserEmail={quote.clientEmail || ''}
            />
          </TabsContent>
        </Tabs>
        
        {/* Company Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Us</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              {companyInfo.email && (
                <a href={`mailto:${companyInfo.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Mail className="h-4 w-4" />
                  {companyInfo.email}
                </a>
              )}
              {companyInfo.phone && (
                <a href={`tel:${companyInfo.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Phone className="h-4 w-4" />
                  {companyInfo.phone}
                </a>
              )}
              {companyInfo.website && (
                <a href={companyInfo.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Globe className="h-4 w-4" />
                  {companyInfo.website}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'approve' ? 'Confirm Approval' :
               confirmAction === 'reject' ? 'Confirm Rejection' : 'Request Revision'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'approve' 
                ? 'Are you sure you want to approve this quote? This action will confirm your acceptance of the pricing and terms.'
                : confirmAction === 'reject'
                ? 'Are you sure you want to reject this quote? Please let us know your reasons so we can better serve you.'
                : 'Would you like to request changes to this quote? Please describe what changes you need.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              variant={confirmAction === 'reject' ? 'destructive' : 'default'}
              onClick={handleSubmitResponse}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Response
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
