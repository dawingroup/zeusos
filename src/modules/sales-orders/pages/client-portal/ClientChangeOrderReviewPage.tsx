/**
 * ClientChangeOrderReviewPage — public page for clients to review and
 * approve / decline a change order.
 *
 *   /client-portal/:token/change-order/:coId[?src=whatsapp|email|direct]
 *
 * Channel attribution: the `?src=` query param is captured verbatim as
 * approval-event metadata so every approval can be traced back to the
 * deep-link that produced it (WhatsApp template, email CTA, direct
 * portal URL).
 *
 * State handling: we render one of six screens based on
 * `loadChangeOrderForPortal`:
 *
 *   - ready_for_response  → diff + Approve / Decline form
 *   - already_approved    → confirmation screen
 *   - already_rejected    → confirmation screen
 *   - withdrawn           → withdrawn notice
 *   - not_ready_for_client→ "still with our team" notice
 *   - expired_token / invalid_token / not_found → error screen
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Divider,
  Checkbox,
  FormControlLabel,
  TextField,
  Chip,
} from '@mui/material';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  Info,
} from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { signInAnonymouslyForPortal } from '@/core/services/firebase/auth';
import {
  loadChangeOrderForPortal,
  processClientCOResponse,
  type ClientCOScreenState,
  type ClientPortalCOLoadResult,
} from '../../services/clientPortalCOService';
import type { ChangeOrderApprovalChannel } from '../../types';
import { CO_TYPE_LABELS } from '../../constants';

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Translate the `?src=` query param into a canonical approval channel.
 * Unknown / missing values fall back to 'portal' so the event log stays
 * consistent.
 */
function resolveChannel(src: string | null): ChangeOrderApprovalChannel {
  switch ((src ?? '').toLowerCase()) {
    case 'whatsapp':
      return 'whatsapp';
    case 'email':
      return 'email';
    case 'in_person':
    case 'in-person':
    case 'inperson':
      return 'in_person';
    case 'portal':
    case 'direct':
    case '':
    case null:
    default:
      return 'portal';
  }
}

export default function ClientChangeOrderReviewPage() {
  const { token, coId } = useParams<{ token: string; coId: string }>();
  const [searchParams] = useSearchParams();
  const channel = useMemo(
    () => resolveChannel(searchParams.get('src')),
    [searchParams],
  );

  const [state, setState] = useState<ClientPortalCOLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Approve form state
  const [clientName, setClientName] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Decline form state
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const reload = useCallback(async () => {
    if (!token || !coId) return;
    const result = await loadChangeOrderForPortal(token, coId);
    setState(result);
  }, [token, coId]);

  useEffect(() => {
    if (!token || !coId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        await signInAnonymouslyForPortal();
        await reload();
      } catch (err) {
        // Hide raw Firestore permission / network errors — from a client's
        // perspective an unreachable token looks the same as an invalid one.
        console.error('[ClientChangeOrderReviewPage] load failed', err);
        setState({
          screenState: 'invalid_token',
          changeOrder: null,
          errorMessage: 'This approval link is no longer valid.',
          recoveryHint: 'Please ask your project manager to resend a fresh link.',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [token, coId, reload]);

  const handleApprove = useCallback(async () => {
    if (!token || !coId || !termsAccepted || !clientName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await processClientCOResponse(token, coId, {
        action: 'approve',
        clientName: clientName.trim(),
        notes: approvalNotes.trim() || undefined,
        channel,
        channelMetadata: { src: searchParams.get('src') ?? 'direct' },
      });
      await reload();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [token, coId, termsAccepted, clientName, approvalNotes, channel, searchParams, reload]);

  const handleReject = useCallback(async () => {
    if (!token || !coId || !rejectionReason.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await processClientCOResponse(token, coId, {
        action: 'reject',
        clientName: clientName.trim() || 'Anonymous client',
        notes: rejectionReason.trim(),
        channel,
        channelMetadata: { src: searchParams.get('src') ?? 'direct' },
      });
      await reload();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [token, coId, rejectionReason, clientName, channel, searchParams, reload]);

  if (loading || !state) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const { screenState, changeOrder } = state;

  // ── Non-response screens ────────────────────────────────────────────────
  if (!changeOrder) {
    return <ErrorState state={state} />;
  }

  if (
    screenState === 'already_approved' ||
    screenState === 'already_rejected' ||
    screenState === 'withdrawn'
  ) {
    return <TerminalState state={state} />;
  }

  if (screenState === 'not_ready_for_client') {
    return <NotReadyState state={state} />;
  }

  // ── Ready for client response ──────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <FileText size={40} style={{ margin: '0 auto 12px' }} />
        <Typography variant="h4" fontWeight={700}>
          Change Order Review
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {changeOrder.changeOrderNumber}
        </Typography>
      </Box>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {/* Change details */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            {changeOrder.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={CO_TYPE_LABELS[changeOrder.type] ?? changeOrder.type}
              size="small"
              variant="outlined"
            />
            {changeOrder.isPostScopeFreeze && (
              <Chip
                icon={<AlertTriangle size={14} />}
                label="Changes requested after scope freeze"
                color="error"
                size="small"
              />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {changeOrder.description}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Reason:</strong> {changeOrder.reason}
          </Typography>
          {changeOrder.negotiatedAdjustmentNote && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Negotiation note:</strong> {changeOrder.negotiatedAdjustmentNote}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Items Added */}
      {changeOrder.itemsAdded.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="success.main"
              gutterBottom
            >
              Items added to your order
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
                  {changeOrder.itemsAdded.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {item.description}
                        {item.specification && (
                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            {item.specification}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(item.totalPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Items Removed */}
      {changeOrder.itemsRemoved.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="error.main"
              gutterBottom
            >
              Items removed from your order
            </Typography>
            {changeOrder.itemsRemoved.map((item, idx) => (
              <Box
                key={idx}
                sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}
              >
                <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>
                  {item.description}
                </Typography>
                <Typography variant="body2" color="error.main">
                  −{formatCurrency(item.amount)}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Items Modified */}
      {changeOrder.itemsModified.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="info.main"
              gutterBottom
            >
              Items modified
            </Typography>
            {changeOrder.itemsModified.map((mod, idx) => (
              <Box
                key={idx}
                sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="body2">
                  <strong>{mod.field}</strong>: {mod.oldValue} → {mod.newValue}
                </Typography>
                {mod.priceImpact !== 0 && (
                  <Typography
                    variant="caption"
                    color={mod.priceImpact >= 0 ? 'success.main' : 'error.main'}
                  >
                    Price impact: {mod.priceImpact >= 0 ? '+' : ''}
                    {formatCurrency(mod.priceImpact)}
                  </Typography>
                )}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Timeline impact */}
      {changeOrder.deliveryDateImpact !== undefined &&
        changeOrder.deliveryDateImpact !== 0 && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Clock size={24} />
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>
                  Timeline impact
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Delivery date will shift by{' '}
                  <strong>
                    {changeOrder.deliveryDateImpact > 0 ? '+' : ''}
                    {changeOrder.deliveryDateImpact} day
                    {Math.abs(changeOrder.deliveryDateImpact) !== 1 ? 's' : ''}
                  </strong>
                  .
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

      {/* Financial Impact */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Updated order total
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Previous total
              </Typography>
              <Typography variant="body2">
                {formatCurrency(changeOrder.previousOrderTotal)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Net change
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                color={changeOrder.priceImpact >= 0 ? 'success.main' : 'error.main'}
              >
                {changeOrder.priceImpact >= 0 ? '+' : ''}
                {formatCurrency(changeOrder.priceImpact)}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" fontWeight={600}>
                New total
              </Typography>
              <Typography variant="h6" fontWeight={700} color="primary">
                {formatCurrency(changeOrder.newOrderTotal)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Response form */}
      {showRejectForm ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Decline change order
            </Typography>
            <TextField
              label="Your name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            <TextField
              label="Reason for declining"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => setShowRejectForm(false)}
                fullWidth
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="error"
                fullWidth
                disabled={!rejectionReason.trim() || submitting}
                onClick={handleReject}
              >
                {submitting ? 'Submitting…' : 'Decline changes'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Your response
            </Typography>
            <TextField
              label="Your full name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            <TextField
              label="Notes (optional)"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  I accept the changes described above and the updated order total of{' '}
                  <strong>{formatCurrency(changeOrder.newOrderTotal)}</strong>.
                </Typography>
              }
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={() => setShowRejectForm(true)}
                disabled={submitting}
              >
                Decline
              </Button>
              <Button
                variant="contained"
                color="success"
                fullWidth
                startIcon={<CheckCircle size={18} />}
                disabled={!termsAccepted || !clientName.trim() || submitting}
                onClick={handleApprove}
              >
                {submitting ? 'Processing…' : 'Approve changes'}
              </Button>
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mt: 2, textAlign: 'center' }}
            >
              Responding via {channel.replace('_', ' ')}.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ============================================================================
// Non-response screens
// ============================================================================

function CenteredCard({
  icon,
  color,
  title,
  body,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Card variant="outlined">
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <Box sx={{ color, mb: 2 }}>{icon}</Box>
          <Typography variant="h5" fontWeight={700} sx={{ color }}>
            {title}
          </Typography>
          <Box sx={{ mt: 1 }}>{body}</Box>
        </CardContent>
      </Card>
    </Box>
  );
}

function TerminalState({ state }: { state: ClientPortalCOLoadResult }) {
  const { screenState, changeOrder } = state;
  if (screenState === 'already_approved') {
    return (
      <CenteredCard
        icon={<CheckCircle size={48} />}
        color="#16A34A"
        title="Change order approved"
        body={
          <>
            <Typography variant="body1" color="text.secondary">
              Thank you — the changes have been recorded. Your project manager will
              confirm the updated scope and timeline shortly.
            </Typography>
            {changeOrder?.clientApprovedAt && (
              <Typography variant="caption" display="block" sx={{ mt: 2 }}>
                Approved on{' '}
                {changeOrder.clientApprovedAt
                  .toDate()
                  .toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                .
              </Typography>
            )}
          </>
        }
      />
    );
  }
  if (screenState === 'already_rejected') {
    return (
      <CenteredCard
        icon={<XCircle size={48} />}
        color="#DC2626"
        title="Change order declined"
        body={
          <Typography variant="body1" color="text.secondary">
            Your decision has been recorded. The project will continue with the
            original scope.{' '}
            {changeOrder?.rejectionReason && (
              <>
                <br />
                <em>
                  <strong>Reason given:</strong> {changeOrder.rejectionReason}
                </em>
              </>
            )}
          </Typography>
        }
      />
    );
  }
  // withdrawn
  return (
    <CenteredCard
      icon={<Info size={48} />}
      color="#6B7280"
      title="Change order withdrawn"
      body={
        <Typography variant="body1" color="text.secondary">
          This change order has been withdrawn by our team and no longer requires
          your response.{' '}
          {changeOrder?.withdrawnReason && (
            <>
              <br />
              <em>Reason: {changeOrder.withdrawnReason}</em>
            </>
          )}
        </Typography>
      }
    />
  );
}

function NotReadyState({ state }: { state: ClientPortalCOLoadResult }) {
  const pending = state.changeOrder?.status === 'pending_internal';
  return (
    <CenteredCard
      icon={<Clock size={48} />}
      color="#D97706"
      title={pending ? 'Being reviewed by our team' : 'Not yet ready'}
      body={
        <Typography variant="body1" color="text.secondary">
          {pending
            ? 'We\'ll send you a fresh link once this change order is ready for your review.'
            : 'This change order is still being prepared. You\'ll receive a link when it\'s ready.'}
        </Typography>
      }
    />
  );
}

function ErrorState({ state }: { state: ClientPortalCOLoadResult }) {
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 4 }}>
      <Alert
        severity={state.screenState === 'expired_token' ? 'warning' : 'error'}
        icon={<AlertTriangle size={20} />}
      >
        <Typography variant="subtitle2" fontWeight={700}>
          {state.errorMessage ?? 'Unable to load change order.'}
        </Typography>
        {state.recoveryHint && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {state.recoveryHint}
          </Typography>
        )}
      </Alert>
    </Box>
  );
}

// Re-export for convenience in tests
export type { ClientCOScreenState };
