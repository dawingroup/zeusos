/**
 * StockLevelsByLocation Component
 * Multi-location stock view for inventory items, grouped by warehouse.
 * Includes inline stock adjustment and movement history.
 */

import { useState } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import TuneIcon from '@mui/icons-material/Tune';
import HistoryIcon from '@mui/icons-material/History';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useWarehouses } from '../hooks/useWarehouses';
import { useWarehouseStock } from '../hooks/useStockLevels';
import { StockAdjustmentDialog } from './StockAdjustmentDialog';
import StockMovementHistory from './StockMovementHistory';
import type { StockLevel } from '../types/warehouse';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface StockLevelsByLocationProps {
  onItemClick?: (stockLevel: StockLevel) => void;
}

export default function StockLevelsByLocation({ onItemClick }: StockLevelsByLocationProps) {
  const { currentSubsidiary } = useSubsidiary();
  const { warehouses, loading: whLoading } = useWarehouses(currentSubsidiary?.id || null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');

  const { stockLevels, loading: stockLoading } = useWarehouseStock(selectedWarehouse || null);

  // Adjustment dialog state
  const [adjustTarget, setAdjustTarget] = useState<StockLevel | null>(null);

  // Expanded row for movement history
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  if (whLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (warehouses.length === 0) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No warehouses configured. Create warehouses in the Warehouse Manager tab to track stock by location.
      </Alert>
    );
  }

  const handleToggleExpand = (stockLevelId: string) => {
    setExpandedRowId((prev) => (prev === stockLevelId ? null : stockLevelId));
  };

  return (
    <Box>
      {/* Warehouse selector */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <WarehouseIcon color="action" />
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel>Select Warehouse</InputLabel>
          <Select
            value={selectedWarehouse}
            label="Select Warehouse"
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setExpandedRowId(null);
            }}
          >
            {warehouses.map((wh) => (
              <MenuItem key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {!selectedWarehouse ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          Select a warehouse to view stock levels
        </Typography>
      ) : stockLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>SKU</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">On Hand</TableCell>
                <TableCell align="right">Reserved</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stockLevels.map((sl) => {
                const isLow = sl.reorderLevel && sl.quantityAvailable <= sl.reorderLevel;
                const isExpanded = expandedRowId === sl.id;
                return (
                  <>
                    <TableRow
                      key={sl.id}
                      hover
                      sx={{ cursor: onItemClick ? 'pointer' : 'default', '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                      onClick={() => onItemClick?.(sl)}
                    >
                      <TableCell padding="checkbox">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleExpand(sl.id);
                          }}
                        >
                          {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {sl.sku}
                        </Typography>
                      </TableCell>
                      <TableCell>{sl.itemName}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>{sl.quantityOnHand}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="warning.main">{sl.quantityReserved}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="success.main" fontWeight={600}>
                          {sl.quantityAvailable}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {isLow ? (
                          <Chip label="Low Stock" size="small" color="warning" />
                        ) : sl.quantityOnHand === 0 ? (
                          <Chip label="Out of Stock" size="small" color="error" />
                        ) : (
                          <Chip label="In Stock" size="small" color="success" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Adjust Stock">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdjustTarget(sl);
                            }}
                          >
                            <TuneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Movement History">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(sl.id);
                            }}
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>

                    {/* Expandable movement history */}
                    <TableRow key={`${sl.id}-history`}>
                      <TableCell colSpan={8} sx={{ py: 0, px: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
                            <StockMovementHistory
                              stockLevelId={sl.id}
                              title={`Movement History — ${sl.itemName}`}
                            />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                );
              })}
              {stockLevels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No stock at this location</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Summary cards */}
      {selectedWarehouse && stockLevels.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <KPIGrid cols={4}>
            <KPICard
              label="Total On Hand"
              value={stockLevels.reduce((sum, sl) => sum + sl.quantityOnHand, 0)}
            />
            <KPICard
              label="Total Reserved"
              value={stockLevels.reduce((sum, sl) => sum + sl.quantityReserved, 0)}
            />
            <KPICard
              label="Total Available"
              value={stockLevels.reduce((sum, sl) => sum + sl.quantityAvailable, 0)}
              trend="up"
            />
            <KPICard
              label="Low Stock Items"
              value={stockLevels.filter((sl) => sl.reorderLevel && sl.quantityAvailable <= sl.reorderLevel).length}
              trend={
                stockLevels.filter((sl) => sl.reorderLevel && sl.quantityAvailable <= sl.reorderLevel).length > 0
                  ? 'down'
                  : undefined
              }
            />
          </KPIGrid>
        </Box>
      )}

      {/* Stock Adjustment Dialog */}
      <StockAdjustmentDialog
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        stockLevel={adjustTarget}
        onSuccess={() => setAdjustTarget(null)}
      />
    </Box>
  );
}
