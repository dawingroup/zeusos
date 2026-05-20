// ============================================================================
// BUDGET LIST COMPONENT
// DawinOS v2.0 - Financial Management Module
// Component for displaying and managing budgets
// ============================================================================

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
  Grid,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { Budget, BudgetFilters } from '../../types/budget.types';
import {
  BUDGET_TYPE_LABELS,
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_COLORS,
  BudgetType,
  BudgetStatus,
} from '../../constants/budget.constants';
import { formatCurrency } from '../../utils/formatters';

interface BudgetListProps {
  budgets: Budget[];
  loading?: boolean;
  filters: BudgetFilters;
  onFilterChange: (filters: BudgetFilters) => void;
  onView: (budget: Budget) => void;
  onEdit: (budget: Budget) => void;
  onApprove?: (budget: Budget) => void;
  onReject?: (budget: Budget) => void;
  totalBudget: number;
  totalActual: number;
}

export const BudgetList: React.FC<BudgetListProps> = ({
  budgets,
  loading = false,
  filters,
  onFilterChange,
  onView,
  onEdit,
  onApprove,
  onReject,
  totalBudget,
  totalActual,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, budget: Budget) => {
    setAnchorEl(event.currentTarget);
    setSelectedBudget(budget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedBudget(null);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, searchTerm: event.target.value });
  };

  const handleTypeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    onFilterChange({ ...filters, type: value ? (value as BudgetType) : undefined });
  };

  const handleStatusChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    onFilterChange({ ...filters, status: value ? (value as BudgetStatus) : undefined });
  };

  const totalVariance = totalBudget - totalActual;
  const variancePercent = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;
  const utilizationPercent = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid {...{item: true, xs: 12, sm: 6, md: 3} as any}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Budget
              </Typography>
              <Typography variant="h5">
                {formatCurrency(totalBudget, 'UGX')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid {...{item: true, xs: 12, sm: 6, md: 3} as any}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Actual
              </Typography>
              <Typography variant="h5">
                {formatCurrency(totalActual, 'UGX')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid {...{item: true, xs: 12, sm: 6, md: 3} as any}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Variance
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="h5" color={totalVariance >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(Math.abs(totalVariance), 'UGX')}
                </Typography>
                {totalVariance >= 0 ? (
                  <TrendingUpIcon color="success" sx={{ ml: 1 }} />
                ) : (
                  <TrendingDownIcon color="error" sx={{ ml: 1 }} />
                )}
              </Box>
              <Typography variant="caption" color="textSecondary">
                {variancePercent.toFixed(1)}% {totalVariance >= 0 ? 'under' : 'over'} budget
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid {...{item: true, xs: 12, sm: 6, md: 3} as any}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Utilization
              </Typography>
              <Typography variant="h5">
                {utilizationPercent.toFixed(1)}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(utilizationPercent, 100)}
                color={utilizationPercent > 100 ? 'error' : 'primary'}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid {...{item: true, xs: 12, sm: 4} as any}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search budgets..."
              value={filters.searchTerm || ''}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid {...{item: true, xs: 6, sm: 3} as any}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.type || ''}
                onChange={handleTypeChange as any}
                label="Type"
              >
                <MenuItem value="">All Types</MenuItem>
                {Object.entries(BUDGET_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid {...{item: true, xs: 6, sm: 3} as any}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status || ''}
                onChange={handleStatusChange as any}
                label="Status"
              >
                <MenuItem value="">All Statuses</MenuItem>
                {Object.entries(BUDGET_STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Budget Table */}
      <TableContainer component={Paper}>
        {loading && <LinearProgress />}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Budget</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Fiscal Year</TableCell>
              <TableCell align="right">Budget Amount</TableCell>
              <TableCell align="right">Actual</TableCell>
              <TableCell align="right">Variance</TableCell>
              <TableCell>Utilization</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {budgets.map((budget) => {
              const variance = budget.totalBudget - budget.totalActual;
              const utilizationPct = budget.totalBudget > 0
                ? (budget.totalActual / budget.totalBudget) * 100
                : 0;

              return (
                <TableRow
                  key={budget.id}
                  hover
                  onClick={() => onView(budget)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {budget.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {budget.code}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={BUDGET_TYPE_LABELS[budget.type] || budget.type}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>FY{budget.fiscalYear}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(budget.totalBudget, budget.currency)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(budget.totalActual, budget.currency)}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      color={variance >= 0 ? 'success.main' : 'error.main'}
                    >
                      {formatCurrency(Math.abs(variance), budget.currency)}
                      {variance < 0 && ' over'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(utilizationPct, 100)}
                        color={utilizationPct > 100 ? 'error' : utilizationPct > 90 ? 'warning' : 'primary'}
                        sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption" sx={{ minWidth: 40 }}>
                        {utilizationPct.toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={BUDGET_STATUS_LABELS[budget.status] || budget.status}
                      size="small"
                      sx={{
                        backgroundColor: BUDGET_STATUS_COLORS[budget.status],
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuOpen(e, budget);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {budgets.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="textSecondary" sx={{ py: 4 }}>
                    No budgets found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (selectedBudget) onView(selectedBudget);
            handleMenuClose();
          }}
        >
          <ViewIcon fontSize="small" sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedBudget) onEdit(selectedBudget);
            handleMenuClose();
          }}
          disabled={selectedBudget?.isLocked}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        {selectedBudget?.status === 'pending_approval' && onApprove && (
          <MenuItem
            onClick={() => {
              if (selectedBudget) onApprove(selectedBudget);
              handleMenuClose();
            }}
          >
            <CheckIcon fontSize="small" sx={{ mr: 1 }} color="success" />
            Approve
          </MenuItem>
        )}
        {selectedBudget?.status === 'pending_approval' && onReject && (
          <MenuItem
            onClick={() => {
              if (selectedBudget) onReject(selectedBudget);
              handleMenuClose();
            }}
          >
            <CloseIcon fontSize="small" sx={{ mr: 1 }} color="error" />
            Reject
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default BudgetList;
