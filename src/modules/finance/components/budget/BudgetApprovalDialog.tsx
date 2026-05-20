// ============================================================================
// BUDGET APPROVAL DIALOG COMPONENT
// DawinOS v2.0 - Financial Management Module
// Component for budget approval workflow
// ============================================================================

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid as MuiGrid,
  Divider,
  TextField,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
const Grid = MuiGrid as any;
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Budget, BudgetLineItem } from '../../types/budget.types';
import {
  BUDGET_TYPE_LABELS,
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_COLORS,
  BUDGET_APPROVAL_THRESHOLDS,
  APPROVAL_LEVEL_LABELS,
} from '../../constants/budget.constants';
import { formatCurrency } from '../../utils/formatters';
import { CurrencyCode } from '../../constants/currency.constants';

interface BudgetApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  budget: Budget;
  lines: BudgetLineItem[];
  currency: CurrencyCode;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (notes?: string) => Promise<void>;
  loading?: boolean;
}

export const BudgetApprovalDialog: React.FC<BudgetApprovalDialogProps> = ({
  open,
  onClose,
  budget,
  lines,
  currency,
  onApprove,
  onReject,
  loading = false,
}) => {
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    setAction('approve');
    await onApprove(notes || undefined);
    setNotes('');
    setAction(null);
  };

  const handleReject = async () => {
    setAction('reject');
    await onReject(notes || undefined);
    setNotes('');
    setAction(null);
  };

  // Determine required approval level based on amount
  const getRequiredApprovalLevel = (amount: number): string => {
    if (amount <= BUDGET_APPROVAL_THRESHOLDS.DEPARTMENT_HEAD) return 'department_head';
    if (amount <= BUDGET_APPROVAL_THRESHOLDS.FINANCE_MANAGER) return 'finance_manager';
    if (amount <= BUDGET_APPROVAL_THRESHOLDS.CFO) return 'cfo';
    if (amount <= BUDGET_APPROVAL_THRESHOLDS.CEO) return 'ceo';
    return 'board';
  };

  const requiredLevel = getRequiredApprovalLevel(budget.totalBudget);

  // Group lines by account type
  const linesByType = lines.reduce((acc, line) => {
    if (!acc[line.accountType]) {
      acc[line.accountType] = { count: 0, total: 0 };
    }
    acc[line.accountType].count++;
    acc[line.accountType].total += line.annualBudget;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  // Check for potential issues
  const issues: string[] = [];
  if (lines.length === 0) {
    issues.push('Budget has no line items');
  }
  if (budget.totalBudget === 0) {
    issues.push('Total budget amount is zero');
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Budget Approval</Typography>
          <Chip
            label={BUDGET_STATUS_LABELS[budget.status]}
            sx={{
              backgroundColor: BUDGET_STATUS_COLORS[budget.status],
              color: '#fff',
            }}
          />
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* Budget Summary */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            {budget.name}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {budget.code} | {BUDGET_TYPE_LABELS[budget.type]} | FY{budget.fiscalYear}
          </Typography>
          {budget.description && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {budget.description}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Financial Summary */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="textSecondary">
              Total Budget
            </Typography>
            <Typography variant="h6">
              {formatCurrency(budget.totalBudget, currency)}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="textSecondary">
              Line Items
            </Typography>
            <Typography variant="h6">{lines.length}</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="textSecondary">
              Required Approval
            </Typography>
            <Typography variant="h6">
              {APPROVAL_LEVEL_LABELS[requiredLevel]}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="body2" color="textSecondary">
              Version
            </Typography>
            <Typography variant="h6">{budget.version}</Typography>
          </Grid>
        </Grid>

        {/* Issues Alert */}
        {issues.length > 0 && (
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2">Potential Issues:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Breakdown by Account Type */}
        <Typography variant="subtitle2" gutterBottom>
          Breakdown by Account Type
        </Typography>
        <TableContainer sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account Type</TableCell>
                <TableCell align="center">Line Items</TableCell>
                <TableCell align="right">Total Amount</TableCell>
                <TableCell align="right">% of Budget</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(linesByType).map(([type, data]) => (
                <TableRow key={type}>
                  <TableCell>{type}</TableCell>
                  <TableCell align="center">{data.count}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(data.total, currency)}
                  </TableCell>
                  <TableCell align="right">
                    {budget.totalBudget > 0
                      ? ((data.total / budget.totalBudget) * 100).toFixed(1)
                      : 0}
                    %
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 2 }} />

        {/* Approval Notes */}
        <Typography variant="subtitle2" gutterBottom>
          Approval Notes (Optional)
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder="Add any notes or comments for this approval decision..."
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={action === 'reject' ? <CircularProgress size={16} /> : <CloseIcon />}
          onClick={handleReject}
          disabled={loading}
        >
          Reject
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={action === 'approve' ? <CircularProgress size={16} /> : <CheckIcon />}
          onClick={handleApprove}
          disabled={loading || issues.length > 0}
        >
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BudgetApprovalDialog;
