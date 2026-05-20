/**
 * Quote Management Component
 * Internal view for managing client quotes within a project
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  FileText,
  Plus,
  Send,
  Copy,
  ExternalLink,
  MoreVertical,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Loader2,
  Trash2,
  ClipboardCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { getQuotesForProject, sendQuoteToClient, regenerateAccessToken, deleteQuote } from '../../services/clientPortalService';
import type { ClientQuote } from '../../types/clientPortal';
import { pdfGeneratorService, DEFAULT_COMPANY_INFO, DEFAULT_PAYMENT_INFO, type QuoteData, type CompanyInfo } from '../../services/quote-pdf-generator';
import { useOrganizationSettings } from '@/core/settings';
import CreateQuoteDialog from './CreateQuoteDialog';
import EditQuoteDialog from './EditQuoteDialog';
import QuotePreviewDialog from './QuotePreviewDialog';
import { LineItemApprovalDialog } from './LineItemApprovalDialog';
import { useCurrentUserId } from '@/contexts/AuthContext';

interface QuoteManagementProps {
  projectId: string;
  projectName: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  onQuoteCreated?: () => void;
}

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
 * Status badge with icon
 */
function QuoteStatusBadge({ status }: { status: ClientQuote['status'] }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    draft: { label: 'Draft', variant: 'secondary', icon: <FileText className="h-3 w-3" /> },
    sent: { label: 'Sent', variant: 'outline', icon: <Send className="h-3 w-3" /> },
    viewed: { label: 'Viewed', variant: 'outline', icon: <Eye className="h-3 w-3" /> },
    approved: { label: 'Approved', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
    rejected: { label: 'Rejected', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    revision: { label: 'Revision', variant: 'secondary', icon: <RefreshCw className="h-3 w-3" /> },
    expired: { label: 'Expired', variant: 'destructive', icon: <Clock className="h-3 w-3" /> },
  };

  const { label, variant, icon } = config[status] || { label: status, variant: 'secondary', icon: null };

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {icon}
      {label}
    </Badge>
  );
}

export default function QuoteManagement({
  projectId,
  projectName,
  customerId,
  customerName,
  customerEmail,
  onQuoteCreated,
}: QuoteManagementProps) {
  const userId = useCurrentUserId();
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingQuote, setEditingQuote] = useState<ClientQuote | null>(null);
  const [previewQuote, setPreviewQuote] = useState<ClientQuote | null>(null);
  const [sendingQuote, setSendingQuote] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
  const [approvalQuote, setApprovalQuote] = useState<ClientQuote | null>(null);
  const { settings: orgSettings } = useOrganizationSettings();

  // Build company info with logo from Dawin Finishes subsidiary branding
  const getCompanyInfo = (): CompanyInfo => {
    const dawinFinishesBranding = orgSettings?.branding?.subsidiaries?.['dawin-finishes'];
    return {
      ...DEFAULT_COMPANY_INFO,
      name: orgSettings?.info?.name || DEFAULT_COMPANY_INFO.name,
      logoUrl: dawinFinishesBranding?.logoUrl || undefined,
      website: dawinFinishesBranding?.website || orgSettings?.info?.website || DEFAULT_COMPANY_INFO.website,
      email: orgSettings?.info?.email || DEFAULT_COMPANY_INFO.email,
      phone: orgSettings?.info?.phone || DEFAULT_COMPANY_INFO.phone,
    };
  };

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const projectQuotes = await getQuotesForProject(projectId);
      setQuotes(projectQuotes);
      setError(null);
    } catch (err) {
      console.error('Failed to load quotes:', err);
      setError('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [projectId]);

  const handleSendQuote = async (quoteId: string) => {
    try {
      setSendingQuote(quoteId);
      const { accessUrl } = await sendQuoteToClient(quoteId, userId);
      await loadQuotes();
      
      // Copy URL to clipboard
      await navigator.clipboard.writeText(accessUrl);
      setCopiedUrl(quoteId);
      setTimeout(() => setCopiedUrl(null), 3000);
    } catch (err) {
      console.error('Failed to send quote:', err);
      setError('Failed to send quote');
    } finally {
      setSendingQuote(null);
    }
  };

  const handleCopyLink = async (quote: ClientQuote) => {
    // Generate URL from accessToken if accessUrl not set yet
    const portalUrl = quote.accessUrl || `${window.location.origin}/client-portal/${quote.accessToken}`;
    await navigator.clipboard.writeText(portalUrl);
    setCopiedUrl(quote.id);
    setTimeout(() => setCopiedUrl(null), 3000);
  };

  const handleRegenerateToken = async (quoteId: string) => {
    try {
      await regenerateAccessToken(quoteId, userId);
      await loadQuotes();
    } catch (err) {
      console.error('Failed to regenerate token:', err);
      setError('Failed to regenerate access link');
    }
  };

  const handleDeleteQuote = async (quote: ClientQuote) => {
    if (!confirm(`Are you sure you want to delete quote ${quote.quoteNumber}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteQuote(quote.id, userId);
      await loadQuotes();
    } catch (err) {
      console.error('Failed to delete quote:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete quote');
    }
  };

  const handleDownloadPDF = async (quote: ClientQuote) => {
    setDownloadingPDF(quote.id);
    try {
      const quoteData: QuoteData = {
        quoteNumber: quote.quoteNumber,
        customerReference: quote.projectCode,
        createdAt: quote.createdAt.toDate(),
        validUntil: quote.validUntil.toDate(),
        projectName: quote.projectName,
        projectCode: quote.projectCode,
        customer: {
          name: quote.customerName,
          email: quote.customerEmail,
          address: {
            street: '',
            city: 'Kampala',
            region: 'Central Region',
            country: 'Uganda',
          },
        },
        lineItems: quote.lineItems.map((item) => ({
          id: item.id,
          itemName: item.description,
          description: item.notes,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          totalPrice: item.totalPrice,
          taxRateId: item.taxRateId || 'no_vat',
          linkedDesignItemId: item.linkedDesignItemId,
          category: item.category,
          notes: item.notes,
        })),
        financials: {
          currency: (quote.currency as 'UGX' | 'USD') || 'UGX',
          subtotal: quote.subtotal,
          totalDiscount: quote.totalDiscount || 0,
          totalTax: quote.taxAmount,
          grandTotal: quote.total,
          overheadPercent: quote.overheadPercent,
          overheadAmount: quote.overheadAmount,
          marginPercent: quote.marginPercent,
          marginAmount: quote.marginAmount,
        },
        companyInfo: getCompanyInfo(),
        paymentInfo: DEFAULT_PAYMENT_INFO,
        notes: quote.paymentTerms,
      };
      await pdfGeneratorService.download(quoteData, `${quote.quoteNumber}.pdf`);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setError('Failed to download PDF');
    } finally {
      setDownloadingPDF(null);
    }
  };

  const handleQuoteCreated = () => {
    loadQuotes();
    setShowCreateDialog(false);
    onQuoteCreated?.();
  };

  if (!customerId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please assign a customer to this project before creating quotes.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Client Quotes</h3>
          <p className="text-sm text-muted-foreground">
            Manage quotes and approvals for {customerName || 'this project'}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Quote
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading quotes...
          </CardContent>
        </Card>
      ) : quotes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">No quotes created yet</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Quote
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Procurement</TableHead>
                <TableHead>Line Items</TableHead>
                <TableHead>Portal Link</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => {
                const pendingProcurement = quote.procurementItems.filter(
                  (p) => p.status === 'pending'
                ).length;
                const approvedProcurement = quote.procurementItems.filter(
                  (p) => p.status === 'approved'
                ).length;

                return (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{quote.title}</p>
                        <p className="text-sm text-muted-foreground">
                          v{quote.version} • {format(quote.createdAt.toDate(), 'PP')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(quote.total, quote.currency)}
                    </TableCell>
                    <TableCell>
                      <QuoteStatusBadge status={quote.status} />
                    </TableCell>
                    <TableCell>
                      {format(quote.validUntil.toDate(), 'PP')}
                    </TableCell>
                    <TableCell>
                      {quote.procurementItems.length > 0 ? (
                        <div className="text-sm">
                          <span className="text-green-600">{approvedProcurement}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span>{quote.procurementItems.length}</span>
                          {pendingProcurement > 0 && (
                            <Badge variant="outline" className="ml-2">
                              {pendingProcurement} pending
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {quote.lineItemApprovals ? (
                        <div className="text-sm">
                          <span className="text-green-600">{quote.lineItemApprovals.approvedCount}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span>{quote.lineItemApprovals.totalCount}</span>
                          {quote.lineItemApprovals.pendingCount > 0 && (
                            <Badge variant="outline" className="ml-2">
                              {quote.lineItemApprovals.pendingCount} pending
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setApprovalQuote(quote)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Review
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(quote)}
                          className="h-8"
                        >
                          {copiedUrl === quote.id ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1" />
                              Copy Link
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <a
                            href={quote.accessUrl || `${window.location.origin}/client-portal/${quote.accessToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Portal"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Preview & PDF Options - Always available */}
                          <DropdownMenuItem onClick={() => setPreviewQuote(quote)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview Quote
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDownloadPDF(quote)}
                            disabled={downloadingPDF === quote.id}
                          >
                            {downloadingPDF === quote.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            {downloadingPDF === quote.id ? 'Generating...' : 'Download PDF'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setApprovalQuote(quote)}>
                            <ClipboardCheck className="h-4 w-4 mr-2" />
                            Approve Line Items
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />

                          {quote.status === 'draft' && (
                            <>
                              <DropdownMenuItem onClick={() => setEditingQuote(quote)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Edit Quote
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSendQuote(quote.id)}
                                disabled={sendingQuote === quote.id}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                {sendingQuote === quote.id ? 'Sending...' : 'Send to Client'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteQuote(quote)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Quote
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {quote.accessUrl && (
                            <>
                              <DropdownMenuItem onClick={() => handleCopyLink(quote)}>
                                <Copy className="h-4 w-4 mr-2" />
                                {copiedUrl === quote.id ? 'Copied!' : 'Copy Link'}
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a href={quote.accessUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open Portal
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRegenerateToken(quote.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Regenerate Link
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Client Response Summary */}
      {quotes.some((q) => q.clientResponse) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quotes
                .filter((q) => q.clientResponse)
                .map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-start justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{quote.quoteNumber}</span>
                        <QuoteStatusBadge status={quote.status} />
                      </div>
                      {quote.clientResponse?.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          "{quote.clientResponse.notes}"
                        </p>
                      )}
                      {quote.lineItemApprovals && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Line Items: {quote.lineItemApprovals.approvedCount} approved
                          {quote.lineItemApprovals.rejectedCount > 0 && `, ${quote.lineItemApprovals.rejectedCount} rejected`}
                          {' '}— {formatCurrency(quote.lineItemApprovals.approvedTotal, quote.currency)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Responded: {format(quote.clientResponse!.respondedAt.toDate(), 'PPp')}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CreateQuoteDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
        projectName={projectName}
        customerId={customerId}
        customerName={customerName || ''}
        customerEmail={customerEmail}
        onQuoteCreated={handleQuoteCreated}
      />

      {editingQuote && (
        <EditQuoteDialog
          open={!!editingQuote}
          onOpenChange={(open) => !open && setEditingQuote(null)}
          quote={editingQuote}
          onQuoteUpdated={() => {
            loadQuotes();
            setEditingQuote(null);
          }}
        />
      )}

      {previewQuote && (
        <QuotePreviewDialog
          open={!!previewQuote}
          onOpenChange={(open: boolean) => !open && setPreviewQuote(null)}
          quote={previewQuote}
          projectId={projectId}
        />
      )}

      {approvalQuote && (
        <LineItemApprovalDialog
          open={!!approvalQuote}
          onClose={() => setApprovalQuote(null)}
          quote={approvalQuote}
          onApproved={() => {
            loadQuotes();
            setApprovalQuote(null);
          }}
        />
      )}
    </div>
  );
}
