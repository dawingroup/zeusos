/**
 * Material Consumption Dialog
 * Record material consumption against BOM entries during manufacturing.
 * Shows planned (BOM) vs actual (consumed) quantities with variance tracking.
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import type { ManufacturingOrder, BOMEntry } from '../../types';
import { MO_STAGE_LABELS } from '../../types';
import type { Warehouse } from '@/modules/inventory/types/warehouse';

interface Props {
  open: boolean;
  onClose: () => void;
  order: ManufacturingOrder;
  warehouses: Warehouse[];
  onConsume: (items: Array<{
    bomEntryId: string;
    inventoryItemId: string;
    warehouseId: string;
    quantity: number;
    notes?: string;
  }>) => Promise<void>;
}

interface BOMConsumptionSummary {
  entry: BOMEntry;
  totalConsumed: number;
  remaining: number;
  percentConsumed: number;
  status: 'not-started' | 'partial' | 'complete' | 'over-consumed';
  variance: number; // positive = over, negative = under
}

export function MaterialConsumptionDialog({ open, onClose, order, warehouses, onConsume }: Props) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    order.bom.forEach((entry) => {
      init[entry.id] = '';
    });
    return init;
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute per-BOM-entry consumption summary
  const getSummary = (entry: BOMEntry): BOMConsumptionSummary => {
    const totalConsumed = order.materialConsumptions
      .filter((c) => c.bomEntryId === entry.id || (!c.bomEntryId && c.inventoryItemId === entry.inventoryItemId))
      .reduce((sum, c) => sum + c.quantityConsumed, 0);

    const remaining = entry.quantityRequired - totalConsumed;
    const percentConsumed = entry.quantityRequired > 0
      ? Math.round((totalConsumed / entry.quantityRequired) * 100)
      : 0;
    const variance = totalConsumed - entry.quantityRequired;

    let status: BOMConsumptionSummary['status'];
    if (totalConsumed === 0) status = 'not-started';
    else if (totalConsumed >= entry.quantityRequired) status = totalConsumed > entry.quantityRequired ? 'over-consumed' : 'complete';
    else status = 'partial';

    return { entry, totalConsumed, remaining, percentConsumed, status, variance };
  };

  const summaries = order.bom.map(getSummary);

  // Check if any line will go over planned
  const hasOverConsumption = summaries.some((s) => {
    const qty = parseFloat(quantities[s.entry.id] || '0');
    return qty > 0 && (s.totalConsumed + qty) > s.entry.quantityRequired;
  });

  const handleSubmit = async () => {
    setError(null);

    const items: Array<{
      bomEntryId: string;
      inventoryItemId: string;
      warehouseId: string;
      quantity: number;
      notes?: string;
    }> = [];

    for (const entry of order.bom) {
      const qty = parseFloat(quantities[entry.id] || '0');
      if (qty <= 0) continue;

      const item: typeof items[number] = {
        bomEntryId: entry.id,
        inventoryItemId: entry.inventoryItemId,
        warehouseId: entry.warehouseId || warehouseId,
        quantity: qty,
      };

      // Require notes for over-consumption
      const summary = getSummary(entry);
      if ((summary.totalConsumed + qty) > entry.quantityRequired) {
        const lineNote = notes[entry.id];
        if (!lineNote?.trim()) {
          setError(`"${entry.itemName}" exceeds planned quantity — please add a note explaining the variance`);
          return;
        }
        item.notes = lineNote.trim();
      } else if (notes[entry.id]?.trim()) {
        item.notes = notes[entry.id].trim();
      }

      items.push(item);
    }

    if (items.length === 0) {
      setError('Enter at least one quantity to consume');
      return;
    }

    if (!warehouseId) {
      setError('Please select a warehouse');
      return;
    }

    setSaving(true);
    try {
      await onConsume(items);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: BOMConsumptionSummary['status']) => {
    switch (status) {
      case 'not-started': return 'default';
      case 'partial': return 'warning';
      case 'complete': return 'success';
      case 'over-consumed': return 'error';
    }
  };

  const getStatusLabel = (status: BOMConsumptionSummary['status']) => {
    switch (status) {
      case 'not-started': return 'Not Started';
      case 'partial': return 'Partial';
      case 'complete': return 'Complete';
      case 'over-consumed': return 'Over';
    }
  };

  const getProgressColor = (pct: number): 'success' | 'warning' | 'error' | 'primary' => {
    if (pct > 100) return 'error';
    if (pct >= 100) return 'success';
    if (pct >= 50) return 'primary';
    return 'warning';
  };

  // Overall summary
  const totalPlanned = summaries.reduce((s, e) => s + e.entry.quantityRequired * e.entry.unitCost, 0);
  const totalActual = summaries.reduce((s, e) => s + e.totalConsumed * e.entry.unitCost, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            Record Material Consumption — {order.moNumber}
            <Typography variant="body2" color="text.secondary">
              Current Stage: {MO_STAGE_LABELS[order.currentStage]}
            </Typography>
          </div>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary">
              Planned: {totalPlanned.toLocaleString()} {order.costSummary.currency}
            </Typography>
            <Typography variant="body2" color={totalActual > totalPlanned ? 'error.main' : 'success.main'} fontWeight="medium">
              Actual: {totalActual.toLocaleString()} {order.costSummary.currency}
              {totalPlanned > 0 && (
                <span style={{ marginLeft: 8 }}>
                  ({totalActual > totalPlanned ? '+' : ''}{((totalActual - totalPlanned) / totalPlanned * 100).toFixed(0)}%)
                </span>
              )}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {hasOverConsumption && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Some lines exceed the planned quantity. Notes are required for over-consumption to track variance.
          </Alert>
        )}

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Consume from Warehouse</InputLabel>
          <Select
            value={warehouseId}
            label="Consume from Warehouse"
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Material</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Planned</TableCell>
                <TableCell align="center" sx={{ minWidth: 140 }}>Consumed</TableCell>
                <TableCell align="right">Remaining</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Consume Now</TableCell>
                <TableCell sx={{ width: 160 }}>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summaries.map((summary) => {
                const { entry, totalConsumed, remaining, percentConsumed, status } = summary;
                const inputQty = parseFloat(quantities[entry.id] || '0');
                const willExceed = inputQty > 0 && (totalConsumed + inputQty) > entry.quantityRequired;

                return (
                  <TableRow key={entry.id} sx={willExceed ? { bgcolor: 'warning.50' } : undefined}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">{entry.itemName}</Typography>
                      {entry.sku && (
                        <Typography variant="caption" color="text.secondary">{entry.sku}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{entry.category}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{entry.quantityRequired} {entry.unit}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 60 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(percentConsumed, 100)}
                            color={getProgressColor(percentConsumed)}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                        <Tooltip title={`${totalConsumed} of ${entry.quantityRequired} ${entry.unit}`}>
                          <Typography variant="caption" fontWeight="medium" sx={{ minWidth: 32, textAlign: 'right' }}>
                            {percentConsumed}%
                          </Typography>
                        </Tooltip>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {totalConsumed} / {entry.quantityRequired} {entry.unit}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={remaining <= 0 ? 'text.disabled' : 'text.primary'}
                      >
                        {remaining > 0 ? remaining : 0} {entry.unit}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(status)}
                        color={getStatusColor(status)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={quantities[entry.id] || ''}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [entry.id]: e.target.value }))
                        }
                        inputProps={{ min: 0, step: 1 }}
                        sx={{ width: 90 }}
                        error={willExceed}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder={willExceed ? 'Required *' : 'Optional'}
                        value={notes[entry.id] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))
                        }
                        sx={{ width: 150 }}
                        error={willExceed && !notes[entry.id]?.trim()}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Consumption History Summary */}
        {order.materialConsumptions.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Previous Consumption Records ({order.materialConsumptions.length})
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Material</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Cost</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.materialConsumptions.map((c) => {
                    const bomEntry = order.bom.find((b) => b.id === c.bomEntryId) ||
                      order.bom.find((b) => b.inventoryItemId === c.inventoryItemId);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Typography variant="body2">{bomEntry?.itemName ?? c.inventoryItemId}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={MO_STAGE_LABELS[c.moStage]} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{c.quantityConsumed}</TableCell>
                        <TableCell align="right">
                          {c.totalCost > 0 ? c.totalCost.toLocaleString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {c.notes || '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
          color={hasOverConsumption ? 'warning' : 'primary'}
        >
          {hasOverConsumption ? 'Record (Over-Consumption)' : 'Record Consumption'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
