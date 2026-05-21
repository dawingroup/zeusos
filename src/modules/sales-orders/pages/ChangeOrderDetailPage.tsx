/**
 * ChangeOrderDetailPage — full CO view with line-item diff, approval
 * history timeline, price impact, and every state-machine action
 * (submit for internal, send to client, approve, reject, withdraw).
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  TextField,
  Stack,
} from '@mui/material';
import {
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
  Send,
  UserCheck,
  Undo2,
  Phone,
  Pencil,
  FileDown,
  Eye,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getChangeOrder,
  submitForInternalApproval,
  submitToClient,
  approveChangeOrder,
  rejectChangeOrder,
  withdrawChangeOrder,
} from '../services/changeOrderService';
import { CO_STATUS_LABELS, CO_TYPE_LABELS, CO_TERMINAL_STATUSES } from '../constants';
import type { ChangeOrder, ChangeOrderStatus, SalesOrder, SendVia } from '../types';
import { useChangeOrderApprovalEvents } from '../hooks/useChangeOrderApprovalEvents';
import { useChangeOrderPriceImpact } from '../hooks/useChangeOrderPriceImpact';
import ApprovalHistoryTimeline from '../components/ApprovalHistoryTimeline';
import ChangeOrderPriceImpactCard from '../components/ChangeOrderPriceImpactCard';
import ChangeOrderDeliveryStatusCard from '../components/ChangeOrderDeliveryStatusCard';
import SendChangeOrderWhatsAppDialog from '../components/SendChangeOrderWhatsAppDialog';
import ChangeOrderCreateWizard from '../components/ChangeOrderCreateWizard';
import { getSalesOrder } from '../services/salesOrderService';
import { useAuth } from '@/shared/hooks/useAuth';
import { getSubsidiaryBrandingLogoUrl } from '@/shared/services/branding.service';

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusColor(
  status: ChangeOrderStatus,
): 'success' | 'error' | 'warning' | 'info' | 'default' {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
    case 'withdrawn':
      return 'error';
    case 'pending_internal':
      return 'warning';
    case 'pending_client':
      return 'info';
    default:
      return 'default';
  }
}

export default function ChangeOrderDetailPage() {
  const { orderId, coId } = useParams<{ orderId: string; coId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid ?? '';
  const userName = user?.displayName ?? undefined;

  const [co, setCo] = useState<ChangeOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [channels, setChannels] = useState<SendVia[]>(['client_portal']);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  // Parent SO lazy-loaded when the user opens the edit wizard — the
  // wizard needs the full scope items / currency / subsidiary context
  // that the CO doc doesn't carry.
  const [parentSO, setParentSO] = useState<SalesOrder | null>(null);
  const [parentSOLoading, setParentSOLoading] = useState(false);

  const { events, loading: eventsLoading } = useChangeOrderApprovalEvents(coId);
  const {
    impact,
    loading: impactLoading,
    error: impactError,
    refresh: refreshImpact,
  } = useChangeOrderPriceImpact(coId);

  const reload = useCallback(async () => {
    if (!coId) return;
    const updated = await getChangeOrder(coId);
    setCo(updated);
  }, [coId]);

  useEffect(() => {
    if (!coId) return;
    setLoading(true);
    getChangeOrder(coId)
      .then(setCo)
      .finally(() => setLoading(false));
  }, [coId]);

  const openEditWizard = useCallback(async () => {
    if (!co) return;
    setParentSOLoading(true);
    setError(null);
    try {
      const so = await getSalesOrder(co.salesOrderId);
      if (!so) {
        setError('Parent sales order not found.');
        return;
      }
      setParentSO(so);
      setShowEditWizard(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setParentSOLoading(false);
    }
  }, [co]);

  const runAction = useCallback(
    async (fn: () => Promise<void>) => {
      setActionLoading(true);
      setError(null);
      try {
        await fn();
        await reload();
        await refreshImpact();
        setNotes('');
        setReason('');
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [reload, refreshImpact],
  );

  const handleDownloadPdf = useCallback(async () => {
    if (!co) return;
    setPdfLoading(true);
    setError(null);
    try {
      const [so, { changeOrderPdfService }] = await Promise.all([
        getSalesOrder(co.salesOrderId),
        import('../services/changeOrderPdfGenerator'),
      ]);
      if (!so) {
        throw new Error('Parent sales order not found. Cannot generate PDF.');
      }

      let logoUrl: string | undefined;
      try {
        logoUrl = await getSubsidiaryBrandingLogoUrl(so.subsidiaryId);
      } catch {
        logoUrl = undefined;
      }

      const blob = await changeOrderPdfService.generateBlob({
        changeOrder: co,
        salesOrder: so,
        approvalEvents: events,
        generatedBy: userName || userId || undefined,
        company: {
          name: 'Zeus Group',
          ...(logoUrl ? { logoUrl } : {}),
          addressLine1: 'Kayondo Road, Kyambogo Upper Estate Ground Floor, Jordan House',
          addressLine2: 'Kampala, Uganda',
          website: 'dawinfinishes.com',
        },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = changeOrderPdfService.buildFilename(co);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message || 'Failed to generate change-order PDF');
    } finally {
      setPdfLoading(false);
    }
  }, [co, events, userId, userName]);

  const handlePreviewPdf = useCallback(async () => {
    if (!co) return;
    setPdfPreviewLoading(true);
    setError(null);
    try {
      const [so, { changeOrderPdfService }] = await Promise.all([
        getSalesOrder(co.salesOrderId),
        import('../services/changeOrderPdfGenerator'),
      ]);
      if (!so) {
        throw new Error('Parent sales order not found. Cannot generate PDF preview.');
      }

      let logoUrl: string | undefined;
      try {
        logoUrl = await getSubsidiaryBrandingLogoUrl(so.subsidiaryId);
      } catch {
        logoUrl = undefined;
      }

      const blob = await changeOrderPdfService.generateBlob({
        changeOrder: co,
        salesOrder: so,
        approvalEvents: events,
        generatedBy: userName || userId || undefined,
        company: {
          name: 'Zeus Group',
          ...(logoUrl ? { logoUrl } : {}),
          addressLine1: 'Kayondo Road, Kyambogo Upper Estate Ground Floor, Jordan House',
          addressLine2: 'Kampala, Uganda',
          website: 'dawinfinishes.com',
        },
      });

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError((err as Error).message || 'Failed to preview change-order PDF');
    } finally {
      setPdfPreviewLoading(false);
    }
  }, [co, events, userId, userName]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!co) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Change order not found.</Alert>
      </Box>
    );
  }

  const isTerminal = CO_TERMINAL_STATUSES.includes(co.status);
  const canSubmitForInternal = co.status === 'draft' && co.internalApprovalRequired;
  const canSkipInternal = co.status === 'draft' && !co.internalApprovalRequired && co.clientApprovalRequired;
  const canInternalApprove = co.status === 'pending_internal';
  const canClientApprove = co.status === 'pending_client';
  const canSubmitToClient = co.status === 'pending_internal' && co.clientApprovalRequired;
  const canWithdraw = !isTerminal;
  const canRejectInternally = co.status === 'pending_internal' || co.status === 'draft';

  const toggleChannel = (c: SendVia) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowLeft size={16} />}
          onClick={() => navigate(`/sales-orders/${orderId}`)}
          size="small"
        >
          Back to Order
        </Button>
        <Typography variant="h5" fontWeight={700}>
          {co.changeOrderNumber}
        </Typography>
        <Chip
          label={CO_STATUS_LABELS[co.status]}
          color={statusColor(co.status)}
          variant="outlined"
        />
        {co.isPostScopeFreeze && (
          <Chip
            icon={<AlertTriangle size={14} />}
            label="Post-Scope Freeze"
            color="error"
            size="small"
          />
        )}
        {co.appliedAt && (
          <Chip label={`Applied → Scope v${co.scopeVersionAfter}`} color="info" size="small" />
        )}
        <Button
          variant="text"
          size="small"
          startIcon={pdfPreviewLoading ? <CircularProgress size={14} color="inherit" /> : <Eye size={14} />}
          disabled={pdfPreviewLoading || pdfLoading}
          onClick={handlePreviewPdf}
          sx={{ ml: 'auto' }}
        >
          {pdfPreviewLoading ? 'Preparing preview…' : 'Preview PDF'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={pdfLoading ? <CircularProgress size={14} color="inherit" /> : <FileDown size={14} />}
          disabled={pdfLoading || pdfPreviewLoading}
          onClick={handleDownloadPdf}
        >
          {pdfLoading ? 'Generating PDF…' : 'Download PDF'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left: diff */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {co.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={CO_TYPE_LABELS[co.type] ?? co.type} size="small" variant="outlined" />
                <Chip label={`Requested by: ${co.requestedBy}`} size="small" variant="outlined" />
                {co.sentToClientVia && co.sentToClientVia.length > 0 && (
                  <Chip
                    label={`Sent: ${co.sentToClientVia.join(', ')}`}
                    size="small"
                    variant="outlined"
                    color="info"
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {co.description}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Reason:</strong> {co.reason}
              </Typography>
              {co.negotiatedAdjustmentNote && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Negotiation note:</strong> {co.negotiatedAdjustmentNote}
                </Typography>
              )}
              {co.rejectionReason && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <strong>Rejected:</strong> {co.rejectionReason}
                </Alert>
              )}
              {co.withdrawnReason && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <strong>Withdrawn:</strong> {co.withdrawnReason}
                </Alert>
              )}
            </CardContent>
          </Card>

          {co.itemsAdded.length > 0 && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} color="success.main" gutterBottom>
                  Items Added
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {co.itemsAdded.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {item.description}
                            {item.specification && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                {item.specification}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">{item.quantity} {item.unit}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.totalPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {co.itemsRemoved.length > 0 && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} color="error.main" gutterBottom>
                  Items Removed
                </Typography>
                {co.itemsRemoved.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>
                      {item.description}
                    </Typography>
                    <Typography variant="body2" color="error.main">
                      -{formatCurrency(item.amount)}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {co.itemsModified.length > 0 && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} color="info.main" gutterBottom>
                  Items Modified
                </Typography>
                {co.itemsModified.map((mod, idx) => (
                  <Box
                    key={idx}
                    sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Typography variant="body2">
                      <strong>{mod.field}</strong>: {mod.oldValue} → {mod.newValue}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={mod.priceImpact >= 0 ? 'success.main' : 'error.main'}
                    >
                      Price impact: {mod.priceImpact >= 0 ? '+' : ''}
                      {formatCurrency(mod.priceImpact)}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Approval history timeline */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Approval history
              </Typography>
              <ApprovalHistoryTimeline
                events={events}
                loading={eventsLoading}
                emptyMessage="No events logged yet."
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Right: impact + actions */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Documents
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                Generate or preview the latest change-order PDF.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="text"
                  size="small"
                  startIcon={pdfPreviewLoading ? <CircularProgress size={14} color="inherit" /> : <Eye size={14} />}
                  disabled={pdfPreviewLoading || pdfLoading}
                  onClick={handlePreviewPdf}
                >
                  {pdfPreviewLoading ? 'Preparing…' : 'Preview PDF'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={pdfLoading ? <CircularProgress size={14} color="inherit" /> : <FileDown size={14} />}
                  disabled={pdfLoading || pdfPreviewLoading}
                  onClick={handleDownloadPdf}
                >
                  {pdfLoading ? 'Generating…' : 'Download PDF'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Box sx={{ mb: 3 }}>
            <ChangeOrderPriceImpactCard
              impact={impact}
              currency="UGX"
              loading={impactLoading}
              error={impactError}
            />
          </Box>

          {co.deliveryTracking && (
            <Box sx={{ mb: 3 }}>
              <ChangeOrderDeliveryStatusCard tracking={co.deliveryTracking} />
            </Box>
          )}

          {/* Client-notification shortcuts — visible any time the CO
              is client-approvable (sent or still with client). */}
          {(co.status === 'pending_internal' || co.status === 'pending_client' || co.status === 'draft') && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Notify client
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                  Send a pre-filled WhatsApp message with a one-tap approval link.
                </Typography>
                <Button
                  variant="outlined"
                  color="success"
                  size="small"
                  fullWidth
                  startIcon={<Phone size={14} />}
                  onClick={() => setShowWhatsAppDialog(true)}
                  disabled={actionLoading}
                >
                  Preview & send via WhatsApp
                </Button>
              </CardContent>
            </Card>
          )}

          {!isTerminal && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Actions
                </Typography>

                {(canInternalApprove || canRejectInternally) && (
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      multiline
                      minRows={2}
                      sx={{ mb: 1 }}
                    />
                  </Box>
                )}

                <Stack spacing={1}>
                  {co.status === 'draft' && (
                    <Button
                      variant="contained"
                      color="secondary"
                      fullWidth
                      size="small"
                      startIcon={
                        parentSOLoading ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <Pencil size={14} />
                        )
                      }
                      disabled={parentSOLoading || actionLoading}
                      onClick={openEditWizard}
                    >
                      {parentSOLoading ? 'Opening…' : 'Continue editing draft'}
                    </Button>
                  )}
                  {canSubmitForInternal && (
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      size="small"
                      startIcon={<UserCheck size={14} />}
                      disabled={actionLoading}
                      onClick={() =>
                        runAction(() =>
                          submitForInternalApproval(coId!, userId, userName, notes || undefined),
                        )
                      }
                    >
                      Submit for internal approval
                    </Button>
                  )}

                  {canSkipInternal && (
                    <Button
                      variant="contained"
                      color="info"
                      fullWidth
                      size="small"
                      startIcon={<Send size={14} />}
                      disabled={actionLoading || channels.length === 0}
                      onClick={() =>
                        runAction(() =>
                          submitToClient(coId!, userId, channels, userName, notes || undefined),
                        )
                      }
                    >
                      Send to client
                    </Button>
                  )}

                  {canInternalApprove && (
                    <>
                      <Button
                        variant="contained"
                        color="success"
                        fullWidth
                        size="small"
                        startIcon={<Check size={14} />}
                        disabled={actionLoading}
                        onClick={() =>
                          runAction(() =>
                            approveChangeOrder(coId!, 'internal', userId, undefined, {
                              userName,
                              notes: notes || undefined,
                            }),
                          )
                        }
                      >
                        Approve internally
                      </Button>

                      {canSubmitToClient && (
                        <Button
                          variant="outlined"
                          color="info"
                          fullWidth
                          size="small"
                          startIcon={<Send size={14} />}
                          disabled={actionLoading || channels.length === 0}
                          onClick={() =>
                            runAction(() =>
                              submitToClient(coId!, userId, channels, userName, notes || undefined),
                            )
                          }
                        >
                          Send to client
                        </Button>
                      )}
                    </>
                  )}

                  {canClientApprove && (
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      size="small"
                      startIcon={<Check size={14} />}
                      disabled={actionLoading}
                      onClick={() =>
                        runAction(() =>
                          approveChangeOrder(coId!, 'client', userId, notes || undefined, {
                            channel: 'in_person',
                            userName,
                            evidenceType: notes ? 'free_text' : undefined,
                          }),
                        )
                      }
                    >
                      Record client approval
                    </Button>
                  )}

                  {canRejectInternally && (
                    <>
                      <TextField
                        fullWidth
                        size="small"
                        label="Rejection reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        sx={{ mb: 1 }}
                      />
                      <Button
                        variant="outlined"
                        color="error"
                        fullWidth
                        size="small"
                        startIcon={<X size={14} />}
                        disabled={actionLoading || !reason.trim()}
                        onClick={() =>
                          runAction(() =>
                            rejectChangeOrder(coId!, userId, reason.trim(), {
                              approvalType: 'internal',
                              userName,
                            }),
                          )
                        }
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  {canWithdraw && (
                    <Button
                      variant="text"
                      color="warning"
                      fullWidth
                      size="small"
                      startIcon={<Undo2 size={14} />}
                      disabled={actionLoading}
                      onClick={() =>
                        runAction(() =>
                          withdrawChangeOrder(
                            coId!,
                            userId,
                            reason.trim() || 'Withdrawn by internal user',
                            { userName },
                          ),
                        )
                      }
                    >
                      Withdraw
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {(canSkipInternal || canSubmitToClient || canClientApprove) && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Delivery channels
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Which channels to send the client approval request on.
                </Typography>
                <Stack spacing={0.5}>
                  {(['client_portal', 'whatsapp', 'email', 'in_person'] as SendVia[]).map((c) => (
                    <label
                      key={c}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    >
                      <input
                        type="checkbox"
                        checked={channels.includes(c)}
                        onChange={() => toggleChannel(c)}
                      />
                      {c === 'client_portal'
                        ? 'Client portal'
                        : c === 'whatsapp'
                          ? 'WhatsApp'
                          : c === 'email'
                            ? 'Email'
                            : 'In person'}
                    </label>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* WhatsApp preview / send dialog */}
      {showWhatsAppDialog && coId && (
        <SendChangeOrderWhatsAppDialog
          coId={coId}
          userId={userId}
          userName={userName}
          onClose={() => setShowWhatsAppDialog(false)}
          onSent={async (result) => {
            if (result.success) {
              await reload();
              await refreshImpact();
            }
          }}
        />
      )}

      {/* Edit-draft wizard — re-uses the create wizard in edit mode */}
      {showEditWizard && parentSO && co && (
        <ChangeOrderCreateWizard
          salesOrder={parentSO}
          userId={userId}
          userName={userName}
          subsidiaryId={parentSO.subsidiaryId}
          existingCO={co}
          onClose={() => setShowEditWizard(false)}
          onUpdated={async () => {
            setShowEditWizard(false);
            await reload();
            await refreshImpact();
          }}
        />
      )}
    </Box>
  );
}
