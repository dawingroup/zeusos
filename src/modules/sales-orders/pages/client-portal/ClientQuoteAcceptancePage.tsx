/**
 * ClientQuoteAcceptancePage — Public page for clients to review and accept a quote/sales order.
 * Accessed via /client-portal/:token/accept
 */

import { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import { CheckCircle, FileText, AlertTriangle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { signInAnonymouslyForPortal } from '@/core/services/firebase/auth';
import { advanceStatus, passGate } from '../../services/salesOrderService';
import type { SalesOrder } from '../../types';
import { SO_STATUS_LABELS } from '../../constants';

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ClientQuoteAcceptancePage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [clientName, setClientName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function loadData() {
      try {
        await signInAnonymouslyForPortal();

        // Look up token
        const tokenQuery = query(
          collection(db, 'clientPortalTokens'),
          where('token', '==', token),
          where('type', '==', 'sales_order_accept'),
        );
        const tokenSnap = await getDocs(tokenQuery);

        if (tokenSnap.empty) {
          setError('Invalid or expired link. Please contact your project manager.');
          return;
        }

        const tokenData = tokenSnap.docs[0].data();

        // Check expiry
        if (tokenData.expiresAt && tokenData.expiresAt.toMillis() < Date.now()) {
          setError('This link has expired. Please request a new one from your project manager.');
          return;
        }

        // Load the sales order
        const soSnap = await getDoc(doc(db, 'salesOrders', tokenData.entityId));
        if (!soSnap.exists()) {
          setError('Sales order not found.');
          return;
        }

        const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;

        if (so.status !== 'sent_to_client' && so.status !== 'negotiation') {
          setAccepted(true);
        }

        setOrder(so);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  const handleAccept = useCallback(async () => {
    if (!order || !termsAccepted || !clientName.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      // Pass the client acceptance gate
      await passGate(
        order.id,
        'clientAcceptance',
        'client-portal',
        `Accepted via portal by ${clientName}`,
      );

      // Advance status to client_accepted
      await advanceStatus(order.id, 'client_accepted', 'client-portal', `Client ${clientName} accepted`);

      setAccepted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [order, termsAccepted, clientName]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !order) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 4 }}>
        <Alert severity="error" icon={<AlertTriangle size={20} />}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!order) return null;

  const activeItems = order.scopeItems.filter((item) => item.isActive);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <FileText size={40} style={{ margin: '0 auto 12px' }} />
        <Typography variant="h4" fontWeight={700}>
          Quote Review
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {order.orderNumber} — {order.title}
        </Typography>
      </Box>

      {accepted ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircle size={48} color="#16A34A" style={{ margin: '0 auto 16px' }} />
            <Typography variant="h5" fontWeight={700} color="success.main">
              Quote Accepted
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Thank you for accepting this quote. Your project manager will be in touch shortly.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Order Summary */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Order Details
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2">
                  <strong>Client:</strong> {order.customerName}
                </Typography>
                {order.description && (
                  <Typography variant="body2">
                    <strong>Scope:</strong> {order.description}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>Status:</strong> {SO_STATUS_LABELS[order.status]}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Scope & Pricing
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeItems.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.description}</Typography>
                          {item.specification && (
                            <Typography variant="caption" color="text.secondary">
                              {item.specification}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{item.quantity} {item.unit}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unitPrice, order.currency)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalPrice, order.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                {order.totalDiscountAmount > 0 && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">Discount</Typography>
                    <Typography variant="body2" color="error.main">
                      -{formatCurrency(order.totalDiscountAmount, order.currency)}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary">
                    {formatCurrency(order.currentAmount, order.currency)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          {order.paymentTerms && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Payment Terms
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {order.paymentTerms.depositRequired && (
                    <Typography variant="body2">
                      Deposit: {order.paymentTerms.depositPercent}% ({formatCurrency(order.paymentTerms.depositAmount ?? 0, order.currency)})
                    </Typography>
                  )}
                  <Typography variant="body2">
                    Payment due: {order.paymentTerms.paymentDueDays} days from invoice
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Acceptance */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Accept Quote
              </Typography>
              <TextField
                label="Your Full Name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                fullWidth
                size="small"
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
                    I confirm the above scope and pricing, and agree to proceed with this order.
                  </Typography>
                }
              />
              <Button
                variant="contained"
                color="success"
                fullWidth
                size="large"
                startIcon={<CheckCircle size={18} />}
                disabled={!termsAccepted || !clientName.trim() || submitting}
                onClick={handleAccept}
                sx={{ mt: 2 }}
              >
                {submitting ? 'Processing...' : 'Accept Quote'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
