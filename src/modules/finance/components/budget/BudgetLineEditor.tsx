// ============================================================================
// BUDGET LINE EDITOR COMPONENT
// DawinOS v2.0 - Financial Management Module
// Component for managing budget line items with period breakdown
// ============================================================================

import React, { useState } from 'react';
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
  TextField,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Collapse,
  LinearProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { BudgetLineItem, BudgetLineInput, BudgetPeriodAmount } from '../../types/budget.types';
import {
  ALLOCATION_METHODS,
  ALLOCATION_METHOD_LABELS,
  FISCAL_MONTHS,
  AllocationMethod,
} from '../../constants/budget.constants';
import { formatCurrency } from '../../utils/formatters';
import { CurrencyCode } from '../../constants/currency.constants';

interface BudgetLineEditorProps {
  lines: BudgetLineItem[];
  currency: CurrencyCode;
  loading?: boolean;
  onAddLine: (input: BudgetLineInput) => Promise<void>;
  onUpdateLine: (lineId: string, annualBudget: number, method: AllocationMethod) => Promise<void>;
  onDeleteLine: (lineId: string) => Promise<void>;
  accounts: Array<{ id: string; code: string; name: string; type: string }>;
  readOnly?: boolean;
}

interface EditingLine {
  lineId: string;
  annualBudget: number;
  allocationMethod: AllocationMethod;
}

export const BudgetLineEditor: React.FC<BudgetLineEditorProps> = ({
  lines,
  currency,
  loading = false,
  onAddLine,
  onUpdateLine,
  onDeleteLine,
  accounts,
  readOnly = false,
}) => {
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [editingLine, setEditingLine] = useState<EditingLine | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newLine, setNewLine] = useState<Partial<BudgetLineInput>>({
    accountId: '',
    annualBudget: 0,
    allocationMethod: 'equal',
  });

  const toggleExpand = (lineId: string) => {
    setExpandedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const startEditing = (line: BudgetLineItem) => {
    setEditingLine({
      lineId: line.id,
      annualBudget: line.annualBudget,
      allocationMethod: line.allocationMethod,
    });
  };

  const cancelEditing = () => {
    setEditingLine(null);
  };

  const saveEditing = async () => {
    if (editingLine) {
      await onUpdateLine(editingLine.lineId, editingLine.annualBudget, editingLine.allocationMethod);
      setEditingLine(null);
    }
  };

  const handleAddLine = async () => {
    if (newLine.accountId && newLine.annualBudget !== undefined) {
      await onAddLine(newLine as BudgetLineInput);
      setAddDialogOpen(false);
      setNewLine({ accountId: '', annualBudget: 0, allocationMethod: 'equal' });
    }
  };

  const totalBudget = lines.reduce((sum, line) => sum + line.annualBudget, 0);
  const totalActual = lines.reduce((sum, line) => sum + line.annualActual, 0);

  return (
    <Card>
      <CardHeader
        title="Budget Line Items"
        subheader={`${lines.length} items | Total: ${formatCurrency(totalBudget, currency)}`}
        action={
          !readOnly && (
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              disabled={loading}
            >
              Add Line
            </Button>
          )
        }
      />
      <CardContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Account</TableCell>
                <TableCell>Allocation</TableCell>
                <TableCell align="right">Budget</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Variance</TableCell>
                <TableCell>Utilization</TableCell>
                {!readOnly && <TableCell align="center">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => {
                const isExpanded = expandedLines.has(line.id);
                const isEditing = editingLine?.lineId === line.id;
                const utilizationPercent = line.annualBudget > 0
                  ? (line.annualActual / line.annualBudget) * 100
                  : 0;

                return (
                  <React.Fragment key={line.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleExpand(line.id)}>
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {line.accountCode}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {line.accountName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={editingLine.allocationMethod}
                              onChange={(e) => setEditingLine({
                                ...editingLine,
                                allocationMethod: e.target.value as AllocationMethod,
                              })}
                            >
                              {Object.entries(ALLOCATION_METHODS).map(([_, value]) => (
                                <MenuItem key={value} value={value}>
                                  {ALLOCATION_METHOD_LABELS[value]}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          ALLOCATION_METHOD_LABELS[line.allocationMethod]
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {isEditing ? (
                          <TextField
                            size="small"
                            type="number"
                            value={editingLine.annualBudget}
                            onChange={(e) => setEditingLine({
                              ...editingLine,
                              annualBudget: parseFloat(e.target.value) || 0,
                            })}
                            sx={{ width: 120 }}
                          />
                        ) : (
                          formatCurrency(line.annualBudget, currency)
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(line.annualActual, currency)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          color={line.annualVariance >= 0 ? 'success.main' : 'error.main'}
                        >
                          {formatCurrency(Math.abs(line.annualVariance), currency)}
                          {line.annualVariance < 0 && ' over'}
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
                      {!readOnly && (
                        <TableCell align="center">
                          {isEditing ? (
                            <>
                              <Tooltip title="Save">
                                <IconButton size="small" onClick={saveEditing} color="primary">
                                  <SaveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Cancel">
                                <IconButton size="small" onClick={cancelEditing}>
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => startEditing(line)}
                                  disabled={line.isLocked}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => onDeleteLine(line.id)}
                                  disabled={line.isLocked || line.annualActual > 0}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    
                    {/* Period Breakdown */}
                    <TableRow>
                      <TableCell colSpan={readOnly ? 7 : 8} sx={{ py: 0 }}>
                        <Collapse in={isExpanded}>
                          <Box sx={{ py: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Period Breakdown
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  {FISCAL_MONTHS.map((fm) => (
                                    <TableCell key={fm.month} align="center" sx={{ minWidth: 80 }}>
                                      {fm.name.slice(0, 3)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                <TableRow>
                                  {line.periodAmounts.map((period: BudgetPeriodAmount, idx: number) => (
                                    <TableCell key={idx} align="center">
                                      <Typography variant="caption" display="block">
                                        {formatCurrency(period.budgetAmount, currency)}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        display="block"
                                        color={period.variance >= 0 ? 'success.main' : 'error.main'}
                                      >
                                        {formatCurrency(period.actualAmount, currency)}
                                      </Typography>
                                    </TableCell>
                                  ))}
                                </TableRow>
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
              
              {/* Totals Row */}
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell colSpan={3}>
                  <Typography fontWeight="bold">Total</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold">
                    {formatCurrency(totalBudget, currency)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold">
                    {formatCurrency(totalActual, currency)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    fontWeight="bold"
                    color={(totalBudget - totalActual) >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(Math.abs(totalBudget - totalActual), currency)}
                  </Typography>
                </TableCell>
                <TableCell colSpan={readOnly ? 1 : 2} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      {/* Add Line Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Budget Line</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Account</InputLabel>
              <Select
                value={newLine.accountId || ''}
                onChange={(e) => setNewLine({ ...newLine, accountId: e.target.value })}
                label="Account"
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="number"
              label="Annual Budget"
              value={newLine.annualBudget || ''}
              onChange={(e) => setNewLine({ ...newLine, annualBudget: parseFloat(e.target.value) || 0 })}
            />
            <FormControl fullWidth>
              <InputLabel>Allocation Method</InputLabel>
              <Select
                value={newLine.allocationMethod || 'equal'}
                onChange={(e) => setNewLine({ ...newLine, allocationMethod: e.target.value as AllocationMethod })}
                label="Allocation Method"
              >
                {Object.entries(ALLOCATION_METHODS).map(([_, value]) => (
                  <MenuItem key={value} value={value}>
                    {ALLOCATION_METHOD_LABELS[value]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddLine} variant="contained" disabled={!newLine.accountId}>
            Add Line
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default BudgetLineEditor;
