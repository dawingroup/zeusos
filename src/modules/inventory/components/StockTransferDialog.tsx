/**
 * StockTransferDialog Component
 * Dialog for transferring stock between warehouse locations
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useWarehouses } from '../hooks/useWarehouses';
import { transferStock } from '../services/stockLevelService';

interface StockTransferDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-filled inventory item (optional) */
  inventoryItemId?: string;
  itemName?: string;
  /** Pre-filled source warehouse (optional) */
  fromWarehouseId?: string;
  /** Current user ID for audit */
  userId: string;
}

export default function StockTransferDialog({
  open,
  onClose,
  inventoryItemId: initialItemId,
  itemName,
  fromWarehouseId: initialFromId,
  userId,
}: StockTransferDialogProps) {
  const { currentSubsidiary } = useSubsidiary();
  const { warehouses } = useWarehouses(currentSubsidiary?.id || null);
  const [fromWarehouseId, setFromWarehouseId] = useState(initialFromId || '');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setFromWarehouseId(initialFromId || '');
      setToWarehouseId('');
      setQuantity(0);
      setNotes('');
      setError(null);
      setSuccess(false);
    }
  }, [open, initialFromId]);

  const handleTransfer = async () => {
    if (!initialItemId) {
      setError('No inventory item selected');
      return;
    }
    if (!fromWarehouseId || !toWarehouseId) {
      setError('Please select both source and destination warehouses');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setError('Source and destination must be different');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await transferStock(
        {
          inventoryItemId: initialItemId,
          fromWarehouseId,
          toWarehouseId,
          quantity,
          notes: notes.trim() || undefined,
        },
        userId,
      );
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Transfer failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SwapHorizIcon />
          Transfer Stock
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Transfer completed successfully
          </Alert>
        )}

        {itemName && (
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Item: <strong>{itemName}</strong>
          </Typography>
        )}

        <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
          <InputLabel>From Warehouse</InputLabel>
          <Select
            value={fromWarehouseId}
            label="From Warehouse"
            onChange={(e) => setFromWarehouseId(e.target.value)}
            disabled={success}
          >
            {warehouses
              .filter((wh) => wh.isActive)
              .map((wh) => (
                <MenuItem key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>To Warehouse</InputLabel>
          <Select
            value={toWarehouseId}
            label="To Warehouse"
            onChange={(e) => setToWarehouseId(e.target.value)}
            disabled={success}
          >
            {warehouses
              .filter((wh) => wh.isActive && wh.id !== fromWarehouseId)
              .map((wh) => (
                <MenuItem key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <TextField
          label="Quantity"
          type="number"
          fullWidth
          value={quantity || ''}
          onChange={(e) => setQuantity(Number(e.target.value))}
          sx={{ mb: 2 }}
          disabled={success}
          inputProps={{ min: 1 }}
        />

        <TextField
          label="Notes (optional)"
          fullWidth
          multiline
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={success}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{success ? 'Close' : 'Cancel'}</Button>
        {!success && (
          <Button
            variant="contained"
            onClick={handleTransfer}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SwapHorizIcon />}
          >
            Transfer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
