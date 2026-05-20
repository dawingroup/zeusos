/**
 * ClientDesignReviewPage — Public page for clients to review and approve/reject design documents.
 * Accessed via /client-portal/:token/design-review/:signoffId
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  TextField,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { CheckCircle, XCircle, FileText, Download, AlertTriangle, Image } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { signInAnonymouslyForPortal } from '@/core/services/firebase/auth';
import {
  getSignOffByToken,
  recordDesignApproval,
  recordDesignRejection,
} from '../../services/designSignOffService';
import type { DesignSignOff, ClientApprovalRecord } from '../../types';
import { Timestamp } from 'firebase/firestore';

const REJECTION_REASONS = [
  'Design does not match brief',
  'Material selection needs changes',
  'Layout/spatial issues',
  'Budget concerns',
  'Need more detail/specification',
  'Other',
];

const DOC_TYPE_ICONS: Record<string, React.ReactNode> = {
  floor_plan: <FileText size={18} />,
  elevation: <FileText size={18} />,
  '3d_render': <Image size={18} />,
  material_board: <Image size={18} />,
  specification_sheet: <FileText size={18} />,
  quote_breakdown: <FileText size={18} />,
  scope_document: <FileText size={18} />,
};

export default function ClientDesignReviewPage() {
  const { token } = useParams<{ token: string; signoffId: string }>();
  const [signOff, setSignOff] = useState<DesignSignOff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'approved' | 'rejected'>('view');
  const [submitting, setSubmitting] = useState(false);

  // Approval fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [notes, setNotes] = useState('');

  // Rejection fields
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [rejectionNotes, setRejectionNotes] = useState('');

  useEffect(() => {
    if (!token) return;

    async function loadData() {
      try {
        await signInAnonymouslyForPortal();

        const dso = await getSignOffByToken(token!);
        if (!dso) {
          setError('Invalid or expired link. Please contact your project manager.');
          return;
        }

        if (dso.status === 'approved') {
          setMode('approved');
        } else if (dso.status === 'rejected') {
          setMode('rejected');
        } else if (dso.status === 'expired' || dso.status === 'superseded') {
          setError('This design review request is no longer valid. A newer version may be available.');
          return;
        }

        if (dso.expiresAt && dso.expiresAt.toMillis() < Date.now()) {
          setError('This design review link has expired. Please request a new one.');
          return;
        }

        setSignOff(dso);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  const handleApprove = useCallback(async () => {
    if (!signOff || !termsAccepted || !clientName.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const approval: ClientApprovalRecord = {
        approvalMethod: 'portal_acceptance',
        approvedByName: clientName,
        approvedByEmail: clientEmail || undefined,
        notes: notes || undefined,
        timestamp: Timestamp.now(),
      };

      await recordDesignApproval(signOff.id, approval);
      setMode('approved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [signOff, termsAccepted, clientName, clientEmail, notes]);

  const handleReject = useCallback(async () => {
    if (!signOff || selectedReasons.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      await recordDesignRejection(signOff.id, selectedReasons, rejectionNotes || undefined);
      setMode('rejected');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [signOff, selectedReasons, rejectionNotes]);

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason],
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !signOff) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 4 }}>
        <Alert severity="error" icon={<AlertTriangle size={20} />}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!signOff) return null;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <FileText size={40} style={{ margin: '0 auto 12px' }} />
        <Typography variant="h4" fontWeight={700}>
          Design Review
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {signOff.signOffNumber} — {signOff.title}
        </Typography>
      </Box>

      {mode === 'approved' ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircle size={48} color="#16A34A" style={{ margin: '0 auto 16px' }} />
            <Typography variant="h5" fontWeight={700} color="success.main">
              Design Approved
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Thank you for approving the design. Your project team will proceed with the next steps.
            </Typography>
          </CardContent>
        </Card>
      ) : mode === 'rejected' ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <XCircle size={48} color="#DC2626" style={{ margin: '0 auto 16px' }} />
            <Typography variant="h5" fontWeight={700} color="error.main">
              Revisions Requested
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Your feedback has been submitted. The design team will review and get back to you.
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

          {/* Description */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                About This Design
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {signOff.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip label={`Design v${signOff.designVersion}`} size="small" variant="outlined" />
                <Chip label={`Scope v${signOff.scopeVersion}`} size="small" variant="outlined" />
              </Box>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Design Documents
              </Typography>
              <List dense disablePadding>
                {signOff.designDocuments.map((doc) => (
                  <ListItem key={doc.id}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {DOC_TYPE_ICONS[doc.type] || <FileText size={18} />}
                    </ListItemIcon>
                    <ListItemText
                      primary={doc.fileName}
                      secondary={doc.description}
                    />
                    {doc.storagePath && (
                      <Chip
                        icon={<Download size={14} />}
                        label="View"
                        size="small"
                        variant="outlined"
                        clickable
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Terms & Disclaimer
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {signOff.disclaimerText}
              </Typography>
            </CardContent>
          </Card>

          {showRejectForm ? (
            /* Rejection Form */
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Request Revisions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Please select the reasons for requesting changes:
                </Typography>
                {REJECTION_REASONS.map((reason) => (
                  <FormControlLabel
                    key={reason}
                    control={
                      <Checkbox
                        checked={selectedReasons.includes(reason)}
                        onChange={() => toggleReason(reason)}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{reason}</Typography>}
                    sx={{ display: 'block' }}
                  />
                ))}
                <TextField
                  label="Additional Notes"
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  size="small"
                  sx={{ mt: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setShowRejectForm(false)}
                    fullWidth
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    disabled={selectedReasons.length === 0 || submitting}
                    onClick={handleReject}
                  >
                    {submitting ? 'Submitting...' : 'Submit Revision Request'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : (
            /* Approval Form */
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Your Response
                </Typography>
                <TextField
                  label="Your Full Name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Your Email (optional)"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  fullWidth
                  size="small"
                  type="email"
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  multiline
                  rows={2}
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
                      I have reviewed the design documents and approve the design to proceed.
                    </Typography>
                  }
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    onClick={() => setShowRejectForm(true)}
                  >
                    Request Changes
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    startIcon={<CheckCircle size={18} />}
                    disabled={!termsAccepted || !clientName.trim() || submitting}
                    onClick={handleApprove}
                  >
                    {submitting ? 'Processing...' : 'Approve Design'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
