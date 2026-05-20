/**
 * Status Change Dialog Component - DawinOS v2.0
 * Dialog for changing employee status
 */

import React, { useState, useMemo, ChangeEvent } from 'react';
import { SelectChangeEvent } from '@mui/material/Select';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import {
  EmploymentStatus,
  TerminationReason,
} from '../../types/employee.types';
import {
  EMPLOYMENT_STATUS_LABELS,
  TERMINATION_REASON_LABELS,
  VALID_STATUS_TRANSITIONS,
} from '../../config/employee.constants';
import { useEmployeeActions } from '../../hooks/useEmployee';

export interface StatusChangeEmployee {
  id: string;
  employeeNumber: string;
  fullName: string;
  employmentStatus: EmploymentStatus;
}

interface StatusChangeDialogProps {
  open: boolean;
  employee: StatusChangeEmployee;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StatusChangeDialog: React.FC<StatusChangeDialogProps> = ({
  open,
  employee,
  onClose,
  onSuccess,
}) => {
  const { changeStatus, loading, error } = useEmployeeActions('system');

  const [newStatus, setNewStatus] = useState<EmploymentStatus | ''>('');
  const [reason, setReason] = useState('');
  const [terminationReason, setTerminationReason] = useState<TerminationReason | ''>('');
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(new Date());
  const [lastWorkingDay, setLastWorkingDay] = useState<Date | null>(null);

  // Get valid transitions for current status
  const validTransitions = useMemo(() => {
    return VALID_STATUS_TRANSITIONS[employee.employmentStatus] || [];
  }, [employee.employmentStatus]);

  // Check if termination details are needed
  const needsTerminationDetails = newStatus === 'terminated' || newStatus === 'resigned';

  // Handle submit
  const handleSubmit = async () => {
    if (!newStatus || !effectiveDate) return;

    try {
      await changeStatus({
        employeeId: employee.id,
        newStatus,
        reason,
        effectiveDate: effectiveDate.toISOString(),
        terminationReason: needsTerminationDetails && terminationReason ? terminationReason : undefined,
        lastWorkingDate: needsTerminationDetails && lastWorkingDay ? lastWorkingDay.toISOString() : undefined,
      });

      onSuccess?.();
      handleClose();
    } catch (err) {
      // Error handled by hook
    }
  };

  // Reset form and close
  const handleClose = () => {
    setNewStatus('');
    setReason('');
    setTerminationReason('');
    setEffectiveDate(new Date());
    setLastWorkingDay(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Change Employee Status</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Current status */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Changing status for <strong>{employee.fullName}</strong> ({employee.employeeNumber})
            <br />
            Current status: <strong>{EMPLOYMENT_STATUS_LABELS[employee.employmentStatus]}</strong>
          </Typography>

          {/* Error alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error.message}
            </Alert>
          )}

          {/* No valid transitions */}
          {validTransitions.length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No status transitions available from current status.
            </Alert>
          )}

          {/* New status */}
          <FormControl fullWidth sx={{ mb: 3 }} disabled={validTransitions.length === 0}>
            <InputLabel>New Status *</InputLabel>
            <Select
              value={newStatus}
              onChange={(e: SelectChangeEvent) => setNewStatus(e.target.value as EmploymentStatus)}
              label="New Status *"
            >
              {validTransitions.map(status => (
                <MenuItem key={status} value={status}>
                  {EMPLOYMENT_STATUS_LABELS[status]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Effective date */}
          <DatePicker
            label="Effective Date *"
            value={effectiveDate}
            onChange={setEffectiveDate}
            slotProps={{
              textField: { fullWidth: true, sx: { mb: 3 } },
            }}
          />

          {/* Termination details */}
          {needsTerminationDetails && (
            <>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Termination Reason</InputLabel>
                <Select
                  value={terminationReason}
                  onChange={(e: SelectChangeEvent) => setTerminationReason(e.target.value as TerminationReason)}
                  label="Termination Reason"
                >
                  {Object.entries(TERMINATION_REASON_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <DatePicker
                label="Last Working Day"
                value={lastWorkingDay}
                onChange={setLastWorkingDay}
                slotProps={{
                  textField: { fullWidth: true, sx: { mb: 3 } },
                }}
              />
            </>
          )}

          {/* Reason */}
          <TextField
            label="Reason / Notes *"
            value={reason}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
            fullWidth
            multiline
            rows={3}
            required
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !newStatus || !effectiveDate || !reason || validTransitions.length === 0}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          Change Status
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusChangeDialog;
