/**
 * BOMEditor — Editable Bill of Materials table with cost summary
 */

import React, { useState } from 'react';
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
  IconButton,
  Button,
  TextField,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BOMLine, BOMCategory, BOMCostSummary } from '../../types';
import { bomLineSchema, type BOMLineInput } from '../../schemas';

interface BOMEditorProps {
  bomLines: BOMLine[];
  costSummary: BOMCostSummary | null;
  readOnly?: boolean;
  onAddLine: (line: Omit<BOMLine, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  onUpdateLine: (lineId: string, updates: Partial<BOMLine>) => Promise<void>;
  onRemoveLine: (lineId: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<BOMCategory, string> = {
  sheet_material: 'Sheet Material',
  linear_material: 'Linear Material',
  hardware: 'Hardware',
  glass: 'Glass',
  finishing: 'Finishing',
  adhesive: 'Adhesive',
  consumable: 'Consumable',
  packaging: 'Packaging',
  subcontracted: 'Subcontracted',
  labor: 'Labor',
};

const AVAILABILITY_COLORS: Record<string, string> = {
  not_required: 'default',
  pending: 'warning',
  reserved: 'info',
  on_order: 'secondary',
  received: 'success',
  shortage: 'error',
};

export const BOMEditor: React.FC<BOMEditorProps> = ({
  bomLines,
  costSummary,
  readOnly = false,
  onAddLine,
  onUpdateLine,
  onRemoveLine,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editValues, setEditValues] = useState<Partial<BOMLine>>({});

  const startEdit = (line: BOMLine) => {
    setEditingId(line.id);
    setEditValues({
      requiredQuantity: line.requiredQuantity,
      unitCost: line.unitCost,
      materialName: line.materialName,
      specification: line.specification,
    });
  };

  const saveEdit = async (lineId: string) => {
    await onUpdateLine(lineId, editValues);
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-UG', { style: 'decimal', maximumFractionDigits: 0 }).format(value);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Bill of Materials ({bomLines.length} lines)
        </Typography>
        {!readOnly && (
          <Button
            startIcon={<Plus size={16} />}
            variant="outlined"
            size="small"
            onClick={() => setShowAddDialog(true)}
          >
            Add Line
          </Button>
        )}
      </Box>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell width={50}>#</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Material</TableCell>
              <TableCell>Spec</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right">Unit Cost</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell width={70} align="center">Priority</TableCell>
              <TableCell>Status</TableCell>
              {!readOnly && <TableCell width={80}>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {bomLines.map((line) => (
              <TableRow key={line.id} hover>
                <TableCell>{line.lineNumber}</TableCell>
                <TableCell>
                  <Chip
                    label={CATEGORY_LABELS[line.category] ?? line.category}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                </TableCell>
                <TableCell>
                  {editingId === line.id ? (
                    <TextField
                      size="small"
                      value={editValues.materialName ?? ''}
                      onChange={(e) => setEditValues(v => ({ ...v, materialName: e.target.value }))}
                      sx={{ width: 150 }}
                    />
                  ) : (
                    line.materialName
                  )}
                </TableCell>
                <TableCell>
                  {editingId === line.id ? (
                    <TextField
                      size="small"
                      value={editValues.specification ?? ''}
                      onChange={(e) => setEditValues(v => ({ ...v, specification: e.target.value }))}
                      sx={{ width: 120 }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
                      {line.specification ?? '—'}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  {editingId === line.id ? (
                    <TextField
                      size="small"
                      type="number"
                      value={editValues.requiredQuantity ?? ''}
                      onChange={(e) => setEditValues(v => ({ ...v, requiredQuantity: Number(e.target.value) }))}
                      sx={{ width: 80 }}
                      inputProps={{ min: 0, step: 0.1 }}
                    />
                  ) : (
                    line.requiredQuantity
                  )}
                </TableCell>
                <TableCell>{line.unit}</TableCell>
                <TableCell align="right">
                  {editingId === line.id ? (
                    <TextField
                      size="small"
                      type="number"
                      value={editValues.unitCost ?? ''}
                      onChange={(e) => setEditValues(v => ({ ...v, unitCost: Number(e.target.value) }))}
                      sx={{ width: 100 }}
                      inputProps={{ min: 0 }}
                    />
                  ) : (
                    formatCurrency(line.unitCost)
                  )}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatCurrency(line.totalEstimatedCost)}
                </TableCell>
                <TableCell align="center">
                  {line.purchasePriority != null ? (
                    <Chip
                      label={`#${line.purchasePriority + 1}`}
                      size="small"
                      color={line.prioritySource === 'manufacturing' ? 'secondary' : 'default'}
                      variant={line.prioritySource === 'manufacturing' ? 'filled' : 'outlined'}
                      sx={{ fontSize: '0.65rem', height: 20, minWidth: 36 }}
                      title={`Source: ${line.prioritySource ?? 'design'}${line.upstreamPurchasePriority != null ? ` (upstream: #${line.upstreamPurchasePriority + 1})` : ''}`}
                    />
                  ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={line.procurementStatus}
                    size="small"
                    color={AVAILABILITY_COLORS[line.procurementStatus] as 'default' ?? 'default'}
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    {editingId === line.id ? (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => saveEdit(line.id)} color="primary">
                          <Save size={14} />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEdit}>
                          <X size={14} />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => startEdit(line)}>
                          <Edit2 size={14} />
                        </IconButton>
                        <IconButton size="small" onClick={() => onRemoveLine(line.id)} color="error">
                          <Trash2 size={14} />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}

            {bomLines.length === 0 && (
              <TableRow>
                <TableCell colSpan={readOnly ? 9 : 10} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No BOM lines. Add materials to begin.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Cost Summary */}
      {costSummary && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Cost Summary
          </Typography>
          <Stack direction="row" spacing={4}>
            <Box>
              <Typography variant="caption" color="text.secondary">Est. Material</Typography>
              <Typography fontWeight={600}>{formatCurrency(costSummary.totalEstimatedMaterialCost)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Act. Material</Typography>
              <Typography fontWeight={600}>{formatCurrency(costSummary.totalActualMaterialCost)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Est. Labor</Typography>
              <Typography fontWeight={600}>{formatCurrency(costSummary.totalEstimatedLaborCost)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Scrap</Typography>
              <Typography fontWeight={600} color="error.main">{formatCurrency(costSummary.totalScrapCost)}</Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Add Line Dialog */}
      <AddBOMLineDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={async (data) => {
          await onAddLine({
            lineNumber: bomLines.length + 1,
            category: data.category,
            inventoryItemId: data.inventoryItemId,
            materialName: data.materialName,
            materialCode: data.materialCode,
            specification: data.specification,
            requiredQuantity: data.requiredQuantity,
            unit: data.unit,
            dimensions: data.dimensions,
            unitCost: data.unitCost,
            totalEstimatedCost: data.requiredQuantity * data.unitCost,
            totalActualCost: 0,
            reservedQuantity: 0,
            consumedQuantity: 0,
            wasteQuantity: 0,
            procurementStatus: 'pending',
            fromOptimization: data.fromOptimization,
          });
          setShowAddDialog(false);
        }}
        nextLineNumber={bomLines.length + 1}
      />
    </Box>
  );
};

// ============================================
// Add BOM Line Dialog
// ============================================

interface AddBOMLineDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: BOMLineInput) => Promise<void>;
  nextLineNumber: number;
}

const AddBOMLineDialog: React.FC<AddBOMLineDialogProps> = ({
  open,
  onClose,
  onAdd,
  nextLineNumber,
}) => {
  const { control, handleSubmit, reset, formState: { errors } } = useForm<BOMLineInput>({
    resolver: zodResolver(bomLineSchema) as any,
    defaultValues: {
      lineNumber: nextLineNumber,
      category: 'sheet_material',
      materialName: '',
      requiredQuantity: 1,
      unit: 'pcs',
      unitCost: 0,
      fromOptimization: false,
    },
  });

  const onFormSubmit = async (data: BOMLineInput) => {
    await onAdd(data);
    reset();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add BOM Line</DialogTitle>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogContent>
          <Stack spacing={2}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select {...field} label="Category">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="materialName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Material Name"
                  fullWidth
                  error={!!errors.materialName}
                  helperText={errors.materialName?.message}
                />
              )}
            />

            <Controller
              name="specification"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Specification" fullWidth value={field.value ?? ''} />
              )}
            />

            <Stack direction="row" spacing={2}>
              <Controller
                name="requiredQuantity"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Quantity"
                    type="number"
                    onChange={e => field.onChange(Number(e.target.value))}
                    error={!!errors.requiredQuantity}
                    helperText={errors.requiredQuantity?.message}
                    sx={{ flex: 1 }}
                  />
                )}
              />

              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Unit" sx={{ width: 100 }} />
                )}
              />

              <Controller
                name="unitCost"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Unit Cost"
                    type="number"
                    onChange={e => field.onChange(Number(e.target.value))}
                    sx={{ flex: 1 }}
                  />
                )}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Add</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
