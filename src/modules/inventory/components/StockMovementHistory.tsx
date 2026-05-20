/**
 * StockMovementHistory Component
 * Displays audit trail of stock movements for an inventory item
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
} from '@mui/material';
import type { StockMovement, StockMovementType } from '../types/warehouse';
import { getStockMovements } from '../services/stockLevelService';

const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  receipt: 'Receipt',
  consumption: 'Consumption',
  reservation: 'Reservation',
  release: 'Release',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
  'item-transfer': 'Item Transfer',
  'opo-ingredient-commit': 'OPO Ingredient Commit',
  'opo-ingredient-consume': 'OPO Ingredient Consume',
  'opo-ingredient-release': 'OPO Ingredient Release',
  'opo-goods-receipt': 'OPO Goods Receipt',
};

const MOVEMENT_TYPE_COLORS: Record<StockMovementType, 'success' | 'error' | 'warning' | 'info' | 'default' | 'primary'> = {
  receipt: 'success',
  consumption: 'error',
  reservation: 'warning',
  release: 'info',
  transfer: 'primary',
  adjustment: 'default',
  'item-transfer': 'info',
  'opo-ingredient-commit': 'warning',
  'opo-ingredient-consume': 'error',
  'opo-ingredient-release': 'info',
  'opo-goods-receipt': 'success',
};

interface StockMovementHistoryProps {
  stockLevelId: string | null;
  title?: string;
}

export default function StockMovementHistory({ stockLevelId, title }: StockMovementHistoryProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stockLevelId) {
      setMovements([]);
      return;
    }

    setLoading(true);
    getStockMovements(stockLevelId, 100)
      .then(setMovements)
      .catch((err) => console.error('Failed to load movements:', err))
      .finally(() => setLoading(false));
  }, [stockLevelId]);

  if (!stockLevelId) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          Select a stock entry from the Stock Levels tab to view its movement history
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" sx={{ mb: 2 }}>{title}</Typography>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>By</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {movements.map((mv) => (
              <TableRow key={mv.id}>
                <TableCell>
                  {mv.performedAt && typeof mv.performedAt === 'object' && 'seconds' in mv.performedAt
                    ? new Date(mv.performedAt.seconds * 1000).toLocaleString()
                    : '—'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={MOVEMENT_TYPE_LABELS[mv.type]}
                    size="small"
                    color={MOVEMENT_TYPE_COLORS[mv.type]}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography
                    color={mv.quantity > 0 ? 'success.main' : 'error.main'}
                    fontWeight="medium"
                  >
                    {mv.quantity > 0 ? '+' : ''}{mv.quantity}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {mv.referenceType.toUpperCase()}: {mv.referenceId.slice(0, 8)}...
                  </Typography>
                </TableCell>
                <TableCell>{mv.notes || '—'}</TableCell>
                <TableCell>{mv.performedBy.slice(0, 8)}...</TableCell>
              </TableRow>
            ))}
            {movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No movements recorded</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
