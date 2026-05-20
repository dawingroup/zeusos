/**
 * CostHistoryChart Component
 * Displays unit cost changes over time for an inventory item
 * Uses a simple table/timeline view (no external chart library dependency)
 */

// no React import needed with modern JSX transform
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
  Alert,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useCostHistory } from '../hooks/useCostHistory';
import type { CostChangeSource } from '../types/warehouse';

const SOURCE_LABELS: Record<CostChangeSource, string> = {
  po_receipt: 'PO Receipt',
  manual_adjustment: 'Manual Adjustment',
  receipt_correction: 'Receipt Correction',
};

const SOURCE_COLORS: Record<CostChangeSource, 'primary' | 'default'> = {
  po_receipt: 'primary',
  manual_adjustment: 'default',
  receipt_correction: 'default',
};

interface CostHistoryChartProps {
  inventoryItemId: string | null;
}

export default function CostHistoryChart({ inventoryItemId }: CostHistoryChartProps) {
  const { entries, loading } = useCostHistory(inventoryItemId);

  if (!inventoryItemId) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          Select an inventory item to view its cost history
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

  if (entries.length === 0) {
    return (
      <Alert severity="info" sx={{ m: 1 }}>
        No cost changes recorded for this item yet. Cost history is updated when goods are received from purchase orders.
      </Alert>
    );
  }

  // Cost change summary
  const latestCost = entries[0]?.newCost ?? 0;
  const oldestCost = entries[entries.length - 1]?.previousCost ?? latestCost;
  const totalChange = latestCost - oldestCost;
  const percentChange = oldestCost > 0 ? ((totalChange / oldestCost) * 100) : 0;

  return (
    <Box>
      {/* Summary */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
          <Typography variant="h5">
            {latestCost.toLocaleString()} {entries[0]?.currency || 'UGX'}
          </Typography>
          <Typography variant="body2" color="text.secondary">Current Unit Cost</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            {totalChange >= 0 ? (
              <TrendingUpIcon color="error" fontSize="small" />
            ) : (
              <TrendingDownIcon color="success" fontSize="small" />
            )}
            <Typography variant="h5" color={totalChange >= 0 ? 'error.main' : 'success.main'}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Overall Change</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
          <Typography variant="h5">{entries.length}</Typography>
          <Typography variant="body2" color="text.secondary">Price Updates</Typography>
        </Paper>
      </Box>

      {/* Simple visual bar showing cost trajectory */}
      {entries.length >= 2 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Cost Trend</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 80 }}>
            {[...entries].reverse().map((entry) => {
              const maxCost = Math.max(...entries.map(e => e.newCost));
              const height = maxCost > 0 ? (entry.newCost / maxCost) * 100 : 50;
              return (
                <Box
                  key={entry.id}
                  sx={{
                    flex: 1,
                    height: `${height}%`,
                    bgcolor: entry.newCost > entry.previousCost ? 'error.light' : 'success.light',
                    borderRadius: '4px 4px 0 0',
                    minHeight: 4,
                    transition: 'height 0.3s',
                  }}
                  title={`${entry.newCost.toLocaleString()} ${entry.currency}`}
                />
              );
            })}
          </Box>
        </Paper>
      )}

      {/* Cost change table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Previous Cost</TableCell>
              <TableCell align="right">New Cost</TableCell>
              <TableCell align="right">Change</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Reference</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => {
              const diff = entry.newCost - entry.previousCost;
              const pct = entry.previousCost > 0 ? ((diff / entry.previousCost) * 100) : 0;
              return (
                <TableRow key={entry.id}>
                  <TableCell>
                    {entry.recordedAt && typeof entry.recordedAt === 'object' && 'seconds' in entry.recordedAt
                      ? new Date(entry.recordedAt.seconds * 1000).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {entry.previousCost.toLocaleString()} {entry.currency}
                  </TableCell>
                  <TableCell align="right">
                    {entry.newCost.toLocaleString()} {entry.currency}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      color={diff >= 0 ? 'error.main' : 'success.main'}
                      variant="body2"
                      fontWeight="medium"
                    >
                      {diff >= 0 ? '+' : ''}{diff.toLocaleString()} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={SOURCE_LABELS[entry.source]}
                      size="small"
                      color={SOURCE_COLORS[entry.source]}
                    />
                  </TableCell>
                  <TableCell>
                    {entry.poNumber || entry.referenceId?.slice(0, 8) || '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
