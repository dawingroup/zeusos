// ============================================================================
// BUDGET VARIANCE TABLE COMPONENT
// ZeusOS v2.0 - Financial Management Module
// Component for displaying budget variance analysis
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  Chip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { BudgetVariance, LineVariance, VarianceStatus } from '../../types/budget.types';
import {
  VARIANCE_THRESHOLD_LABELS,
  VARIANCE_THRESHOLD_COLORS,
} from '../../constants/budget.constants';
import { ACCOUNT_TYPE_LABELS, AccountType } from '../../constants/account.constants';
import { formatCurrency } from '../../utils/formatters';
import { CurrencyCode } from '../../constants/currency.constants';

interface BudgetVarianceTableProps {
  variance: BudgetVariance;
  currency: CurrencyCode;
  loading?: boolean;
}

type SortField = 'accountCode' | 'budget' | 'actual' | 'variance' | 'variancePercent';
type SortDirection = 'asc' | 'desc';

export const BudgetVarianceTable: React.FC<BudgetVarianceTableProps> = ({
  variance,
  currency,
  loading = false,
}) => {
  const [sortField, setSortField] = useState<SortField>('variance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterAccountType, setFilterAccountType] = useState<AccountType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<VarianceStatus | 'all'>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedLines = useMemo(() => {
    let lines = [...variance.lineVariances];

    // Filter by account type
    if (filterAccountType !== 'all') {
      lines = lines.filter(l => l.accountType === filterAccountType);
    }

    // Filter by variance status
    if (filterStatus !== 'all') {
      lines = lines.filter(l => l.varianceStatus === filterStatus);
    }

    // Sort
    lines.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'accountCode':
          comparison = a.accountCode.localeCompare(b.accountCode);
          break;
        case 'budget':
          comparison = a.budget - b.budget;
          break;
        case 'actual':
          comparison = a.actual - b.actual;
          break;
        case 'variance':
          comparison = a.variance - b.variance;
          break;
        case 'variancePercent':
          comparison = a.variancePercent - b.variancePercent;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return lines;
  }, [variance.lineVariances, filterAccountType, filterStatus, sortField, sortDirection]);

  const getStatusChip = (status: VarianceStatus) => (
    <Chip
      size="small"
      label={VARIANCE_THRESHOLD_LABELS[status]}
      sx={{
        backgroundColor: VARIANCE_THRESHOLD_COLORS[status],
        color: '#fff',
      }}
    />
  );

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid {...{item: true, xs: 12, md: 2} as any}>
          <Paper sx={{ p: 2 }}>
            <Typography color="textSecondary" variant="body2">
              Total Budget
            </Typography>
            <Typography variant="h6">
              {formatCurrency(variance.totalBudget, currency)}
            </Typography>
          </Paper>
        </Grid>
        <Grid {...{item: true, xs: 12, md: 2} as any}>
          <Paper sx={{ p: 2 }}>
            <Typography color="textSecondary" variant="body2">
              Total Actual
            </Typography>
            <Typography variant="h6">
              {formatCurrency(variance.totalActual, currency)}
            </Typography>
          </Paper>
        </Grid>
        <Grid {...{item: true, xs: 12, md: 2} as any}>
          <Paper sx={{ p: 2 }}>
            <Typography color="textSecondary" variant="body2">
              Committed (POs)
            </Typography>
            <Typography variant="h6" color="warning.main">
              {formatCurrency(
                variance.lineVariances.reduce((sum, l) => sum + (l.committed || 0), 0),
                currency,
              )}
            </Typography>
          </Paper>
        </Grid>
        <Grid {...{item: true, xs: 12, md: 2} as any}>
          <Paper sx={{ p: 2 }}>
            <Typography color="textSecondary" variant="body2">
              Available
            </Typography>
            <Typography variant="h6" color="info.main">
              {formatCurrency(
                variance.lineVariances.reduce((sum, l) => sum + (l.available || 0), 0),
                currency,
              )}
            </Typography>
          </Paper>
        </Grid>
        <Grid {...{item: true, xs: 12, md: 2} as any}>
          <Paper sx={{ p: 2 }}>
            <Typography color="textSecondary" variant="body2">
              Variance Status
            </Typography>
            <Box sx={{ mt: 1 }}>
              {getStatusChip(variance.varianceStatus)}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Top Variances */}
      {(variance.topOverBudget.length > 0 || variance.topUnderBudget.length > 0) && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {variance.topOverBudget.length > 0 && (
            <Grid {...{item: true, xs: 12, md: 6} as any}>
              <Card>
                <CardHeader
                  title="Top Over Budget"
                  avatar={<WarningIcon color="error" />}
                  titleTypographyProps={{ variant: 'subtitle1' }}
                />
                <CardContent>
                  {variance.topOverBudget.slice(0, 5).map((line) => (
                    <Box
                      key={line.lineId}
                      sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
                    >
                      <Typography variant="body2">
                        {line.accountCode} - {line.accountName}
                      </Typography>
                      <Typography variant="body2" color="error.main">
                        {formatCurrency(Math.abs(line.variance), currency)} over
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          )}
          {variance.topUnderBudget.length > 0 && (
            <Grid {...{item: true, xs: 12, md: 6} as any}>
              <Card>
                <CardHeader
                  title="Top Under Budget"
                  avatar={<TrendingUpIcon color="success" />}
                  titleTypographyProps={{ variant: 'subtitle1' }}
                />
                <CardContent>
                  {variance.topUnderBudget.slice(0, 5).map((line) => (
                    <Box
                      key={line.lineId}
                      sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
                    >
                      <Typography variant="body2">
                        {line.accountCode} - {line.accountName}
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        {formatCurrency(line.variance, currency)} under
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid {...{item: true, xs: 12, sm: 6, md: 3} as any}>
            <FormControl fullWidth size="small">
              <InputLabel>Account Type</InputLabel>
              <Select
                value={filterAccountType}
                onChange={(e) => setFilterAccountType(e.target.value as AccountType | 'all')}
                label="Account Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid {...{item: true, xs: 12, sm: 6, md: 3} as any}>
            <FormControl fullWidth size="small">
              <InputLabel>Variance Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as VarianceStatus | 'all')}
                label="Variance Status"
              >
                <MenuItem value="all">All Statuses</MenuItem>
                {Object.entries(VARIANCE_THRESHOLD_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Variance Table */}
      <Card>
        <CardContent>
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 10, bgcolor: 'background.paper', boxShadow: '4px 0 4px -2px rgba(0,0,0,0.06)' }}>
                    <TableSortLabel
                      active={sortField === 'accountCode'}
                      direction={sortField === 'accountCode' ? sortDirection : 'asc'}
                      onClick={() => handleSort('accountCode')}
                    >
                      Account
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'budget'}
                      direction={sortField === 'budget' ? sortDirection : 'asc'}
                      onClick={() => handleSort('budget')}
                    >
                      Budget
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'actual'}
                      direction={sortField === 'actual' ? sortDirection : 'asc'}
                      onClick={() => handleSort('actual')}
                    >
                      Actual
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    Committed
                  </TableCell>
                  <TableCell align="right">
                    Available
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'variance'}
                      direction={sortField === 'variance' ? sortDirection : 'asc'}
                      onClick={() => handleSort('variance')}
                    >
                      Variance
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'variancePercent'}
                      direction={sortField === 'variancePercent' ? sortDirection : 'asc'}
                      onClick={() => handleSort('variancePercent')}
                    >
                      Variance %
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Utilization</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAndSortedLines.map((line: LineVariance) => {
                  const utilizationPercent = line.budget > 0
                    ? (line.actual / line.budget) * 100
                    : 0;

                  return (
                    <TableRow key={line.lineId} hover>
                      <TableCell sx={{ position: 'sticky', left: 0, zIndex: 10, bgcolor: 'background.paper', boxShadow: '4px 0 4px -2px rgba(0,0,0,0.06)' }}>
                        <Typography variant="body2" fontWeight="medium">
                          {line.accountCode}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {line.accountName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ACCOUNT_TYPE_LABELS[line.accountType]}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(line.budget, currency)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(line.actual, currency)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="warning.main">
                          {formatCurrency(line.committed || 0, currency)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="info.main">
                          {formatCurrency(line.available || 0, currency)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          color={line.variance >= 0 ? 'success.main' : 'error.main'}
                        >
                          {formatCurrency(Math.abs(line.variance), currency)}
                          {line.variance < 0 && ' over'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          color={line.variancePercent >= 0 ? 'success.main' : 'error.main'}
                        >
                          {Math.abs(line.variancePercent).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(utilizationPercent, 100)}
                            color={utilizationPercent > 100 ? 'error' : utilizationPercent > 90 ? 'warning' : 'primary'}
                            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" sx={{ minWidth: 35 }}>
                            {utilizationPercent.toFixed(0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {getStatusChip(line.varianceStatus)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAndSortedLines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography color="textSecondary" sx={{ py: 4 }}>
                        No matching line items
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BudgetVarianceTable;
