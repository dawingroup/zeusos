/**
 * QC Inspection Dialog
 * Record quality check results for a manufacturing order
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Chip,
  Box,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import type { ManufacturingOrder, QualityCheck } from '../../types';
import type { Timestamp } from '@/shared/types';

interface Props {
  open: boolean;
  onClose: () => void;
  order: ManufacturingOrder;
  userId: string;
  onRecordQC: (qc: QualityCheck) => Promise<void>;
}

export function QCInspectionDialog({ open, onClose, order, userId, onRecordQC }: Props) {
  const [passed, setPassed] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [defects, setDefects] = useState<string[]>([]);
  const [newDefect, setNewDefect] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDefect = () => {
    const trimmed = newDefect.trim();
    if (trimmed && !defects.includes(trimmed)) {
      setDefects((prev) => [...prev, trimmed]);
      setNewDefect('');
    }
  };

  const removeDefect = (defect: string) => {
    setDefects((prev) => prev.filter((d) => d !== defect));
  };

  const handleSubmit = async () => {
    setError(null);

    if (passed === null) {
      setError('Please select Pass or Fail');
      return;
    }

    if (!notes.trim()) {
      setError('Please add inspection notes');
      return;
    }

    if (!passed && defects.length === 0) {
      setError('Please list at least one defect when failing inspection');
      return;
    }

    setSaving(true);
    try {
      const qc: QualityCheck = {
        inspectedBy: userId,
        inspectedAt: new Date() as unknown as Timestamp,
        passed,
        notes: notes.trim(),
        defects: defects.length > 0 ? defects : undefined,
      };
      await onRecordQC(qc);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>QC Inspection — {order.moNumber}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {order.qualityCheck && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Previous inspection: {order.qualityCheck.passed ? 'Passed' : 'Failed'}
            {' — '}{order.qualityCheck.notes}
          </Alert>
        )}

        <FormControl sx={{ mb: 2 }}>
          <FormLabel>Inspection Result</FormLabel>
          <RadioGroup
            row
            value={passed === null ? '' : passed ? 'pass' : 'fail'}
            onChange={(e) => setPassed(e.target.value === 'pass')}
          >
            <FormControlLabel value="pass" control={<Radio color="success" />} label="Pass" />
            <FormControlLabel value="fail" control={<Radio color="error" />} label="Fail" />
          </RadioGroup>
        </FormControl>

        <TextField
          label="Inspection Notes"
          fullWidth
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          sx={{ mb: 2 }}
          required
        />

        {passed === false && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Defects</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small"
                placeholder="Describe defect..."
                value={newDefect}
                onChange={(e) => setNewDefect(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDefect();
                  }
                }}
                sx={{ flex: 1 }}
              />
              <IconButton onClick={addDefect} disabled={!newDefect.trim()}>
                <AddIcon />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {defects.map((defect) => (
                <Chip
                  key={defect}
                  label={defect}
                  onDelete={() => removeDefect(defect)}
                  deleteIcon={<CloseIcon />}
                  color="error"
                  variant="outlined"
                  size="small"
                />
              ))}
              {defects.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No defects added yet — add at least one defect for a failed inspection
                </Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          color={passed === false ? 'error' : 'success'}
          onClick={handleSubmit}
          disabled={saving || passed === null}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {passed === false ? 'Record Failure' : 'Record Pass'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
