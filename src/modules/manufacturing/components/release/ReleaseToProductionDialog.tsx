/**
 * ReleaseToProductionDialog — 5-step wizard for releasing design items to production
 * Steps: Sales Order → Select Items → Routing & Batch → Schedule → Confirm
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Chip,
  Stack,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { CheckCircle2, AlertTriangle, XCircle, Package, Wrench, ShoppingBag, Info } from 'lucide-react';
import { useReleaseToProduction } from '../../hooks/useReleaseToProduction';
import type { ReleaseToProductionOptions } from '../../types';

interface DesignItemSummary {
  id: string;
  name: string;
  category: string;
  status: string;
  sourcingType?: string;
  requiredQuantity?: number;
}

interface ReleaseToProductionDialogProps {
  open: boolean;
  onClose: () => void;
  designProjectId: string;
  designItems: DesignItemSummary[];
  userId: string;
  onSuccess?: (moIds: string[]) => void;
}

const STEPS = [
  'Sales Order',
  'Select Items',
  'Routing & Batch',
  'Schedule',
  'Confirm',
];

/** Sourcing types released as production orders */
const MANUFACTURED_TYPES = ['CUSTOM_FURNITURE_MILLWORK', 'MANUFACTURED', 'CONSTRUCTION'];
/** Sourcing types considered as procured */
const PROCURED_TYPES = ['PROCURED'];
/** Stages at which production-order items are release-ready */
const MANUFACTURED_READY_STAGES = [
  'production-ready',
  // Construction/service delivery flow can be released to production tracking
  // once execution is underway or beyond.
  'const-in-progress',
  'const-inspection',
  'const-complete',
];
/** Stages at which procured items are ready for MO attachment */
const PROCURED_READY_STAGES = ['procure-received'];

function getSourcingChipColor(type?: string): 'primary' | 'secondary' | 'default' | 'success' | 'warning' {
  if (!type) return 'default';
  if (MANUFACTURED_TYPES.includes(type)) return 'primary';
  if (PROCURED_TYPES.includes(type)) return 'secondary';
  return 'default';
}

export const ReleaseToProductionDialog: React.FC<ReleaseToProductionDialogProps> = ({
  open,
  onClose,
  designProjectId,
  designItems,
  userId,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedManufacturedIds, setSelectedManufacturedIds] = useState<string[]>([]);
  const [selectedProcuredIds, setSelectedProcuredIds] = useState<string[]>([]);
  const [includeProcuredItems, setIncludeProcuredItems] = useState(true);
  const [routingTemplateId, setRoutingTemplateId] = useState('');
  const [batchSize, setBatchSize] = useState('');
  const [projectPhase, setProjectPhase] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const {
    releaseItems,
    isReleasing,
    releaseResult,
    error,
    reset,
    salesOrder,
    isFetchingSO,
    soError,
    fetchSalesOrder,
  } = useReleaseToProduction(userId);

  // Fetch SO when dialog opens
  useEffect(() => {
    if (open && designProjectId) {
      fetchSalesOrder(designProjectId);
    }
  }, [open, designProjectId, fetchSalesOrder]);

  // Categorize items
  const { manufacturedItems, procuredItems, otherItems } = useMemo(() => {
    const manufactured: DesignItemSummary[] = [];
    const procured: DesignItemSummary[] = [];
    const other: DesignItemSummary[] = [];

    for (const item of designItems) {
      const type = item.sourcingType ?? '';
      if (MANUFACTURED_TYPES.includes(type)) {
        manufactured.push(item);
      } else if (PROCURED_TYPES.includes(type)) {
        procured.push(item);
      } else {
        other.push(item);
      }
    }

    return { manufacturedItems: manufactured, procuredItems: procured, otherItems: other };
  }, [designItems]);

  // Batch preview
  const batchPreview = useMemo(() => {
    const size = parseInt(batchSize, 10);
    if (!size || size <= 0) return [];

    return selectedManufacturedIds
      .map(id => {
        const item = manufacturedItems.find(i => i.id === id);
        if (!item) return null;
        const qty = item.requiredQuantity ?? 1;
        if (qty <= size) return null;
        const batchCount = Math.ceil(qty / size);
        return { name: item.name, qty, batchCount, batchSize: size };
      })
      .filter(Boolean) as Array<{ name: string; qty: number; batchCount: number; batchSize: number }>;
  }, [selectedManufacturedIds, batchSize, manufacturedItems]);

  const handleClose = () => {
    setActiveStep(0);
    setSelectedManufacturedIds([]);
    setSelectedProcuredIds([]);
    setIncludeProcuredItems(true);
    setRoutingTemplateId('');
    setBatchSize('');
    setProjectPhase('');
    setPriority('medium');
    setDueDate('');
    setNotes('');
    reset();
    onClose();
  };

  const toggleManufacturedItem = (id: string) => {
    setSelectedManufacturedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  };

  const toggleProcuredItem = (id: string) => {
    setSelectedProcuredIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  };

  const handleRelease = async () => {
    const batchSizeNum = parseInt(batchSize, 10);
    const options: ReleaseToProductionOptions = {
      designProjectId,
      designItemIds: selectedManufacturedIds,
      routingTemplateId: routingTemplateId || undefined,
      priority,
      dueDate: dueDate ? new Date(dueDate) as unknown as ReleaseToProductionOptions['dueDate'] : undefined,
      batchMode: batchSizeNum > 0,
      autoReserveMaterials: true,
      notes: notes || undefined,
      salesOrderId: salesOrder?.id,
      batchSize: batchSizeNum > 0 ? batchSizeNum : undefined,
      projectPhase: projectPhase || undefined,
      includeProcuredItems: includeProcuredItems && selectedProcuredIds.length > 0,
    };

    const result = await releaseItems(options);
    if (result.success && onSuccess) {
      onSuccess(result.manufacturingOrderIds);
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: return !!salesOrder && !soError; // SO must exist
      case 1: return selectedManufacturedIds.length > 0; // At least one manufactured item
      case 2: return true; // routing/batch is optional
      case 3: return true; // schedule is optional
      case 4: return !isReleasing;
      default: return false;
    }
  };

  // Calculate total MOs that will be created
  const estimatedMOCount = useMemo(() => {
    const size = parseInt(batchSize, 10);
    let count = 0;
    for (const id of selectedManufacturedIds) {
      const item = manufacturedItems.find(i => i.id === id);
      const qty = item?.requiredQuantity ?? 1;
      if (size > 0 && qty > size) {
        count += Math.ceil(qty / size);
      } else {
        count += 1;
      }
    }
    return count;
  }, [selectedManufacturedIds, batchSize, manufacturedItems]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Release to Production</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 0: Sales Order Validation */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              A confirmed Sales Order is required before releasing to production.
            </Typography>

            {isFetchingSO ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography>Checking Sales Order...</Typography>
              </Box>
            ) : salesOrder ? (
              <Alert severity="success" icon={<CheckCircle2 size={20} />} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {salesOrder.orderNumber}
                </Typography>
                <Typography variant="body2">
                  Status: {salesOrder.status.replace(/_/g, ' ')} &bull; Customer: {salesOrder.customerName ?? 'N/A'}
                </Typography>
              </Alert>
            ) : (
              <Alert severity="error" icon={<XCircle size={20} />} sx={{ mb: 2 }}>
                {soError || 'No Sales Order found for this project. Create and confirm a Sales Order first.'}
              </Alert>
            )}
          </Box>
        )}

        {/* Step 1: Select Items (grouped by sourcing type) */}
        {activeStep === 1 && (
          <Box>
            {/* Manufacturing Items */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Wrench size={18} />
                <Typography variant="subtitle2" fontWeight={600}>
                  Manufacturing Items ({manufacturedItems.length})
                </Typography>
              </Stack>
              {manufacturedItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
                  No manufactured items in this project.
                </Typography>
              ) : (
                <List dense>
                  {manufacturedItems.map((item) => {
                    const isReady = MANUFACTURED_READY_STAGES.includes(item.status);
                    return (
                      <ListItem
                        key={item.id}
                        sx={{
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 0.5,
                          cursor: isReady ? 'pointer' : 'default',
                          opacity: isReady ? 1 : 0.5,
                        }}
                        onClick={() => isReady && toggleManufacturedItem(item.id)}
                      >
                        <ListItemIcon>
                          <Checkbox
                            checked={selectedManufacturedIds.includes(item.id)}
                            disabled={!isReady}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.name}
                          secondary={`${item.category} — Qty: ${item.requiredQuantity ?? 1}`}
                        />
                        <Stack direction="row" spacing={0.5}>
                          <Chip
                            label={item.sourcingType?.replace(/_/g, ' ') ?? 'Unknown'}
                            size="small"
                            color={getSourcingChipColor(item.sourcingType)}
                            variant="outlined"
                          />
                          <Chip
                            label={item.status}
                            size="small"
                            color={isReady ? 'success' : 'default'}
                          />
                        </Stack>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Procurement Items */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ShoppingBag size={18} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Procurement Items ({procuredItems.length})
                  </Typography>
                </Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeProcuredItems}
                      onChange={(e) => setIncludeProcuredItems(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Include as MO line items"
                />
              </Stack>
              {procuredItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
                  No procured items in this project.
                </Typography>
              ) : (
                <List dense>
                  {procuredItems.map((item) => {
                    const isReady = PROCURED_READY_STAGES.includes(item.status);
                    return (
                      <ListItem
                        key={item.id}
                        sx={{
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 0.5,
                          cursor: isReady && includeProcuredItems ? 'pointer' : 'default',
                          opacity: isReady && includeProcuredItems ? 1 : 0.5,
                        }}
                        onClick={() => isReady && includeProcuredItems && toggleProcuredItem(item.id)}
                      >
                        <ListItemIcon>
                          <Checkbox
                            checked={selectedProcuredIds.includes(item.id)}
                            disabled={!isReady || !includeProcuredItems}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.name}
                          secondary={`${item.category} — Qty: ${item.requiredQuantity ?? 1}`}
                        />
                        <Stack direction="row" spacing={0.5}>
                          <Chip label="PROCURED" size="small" color="secondary" variant="outlined" />
                          <Chip
                            label={item.status}
                            size="small"
                            color={isReady ? 'success' : 'default'}
                          />
                        </Stack>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>

            {/* Other Items (not ready) */}
            {otherItems.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Info size={18} />
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                      Other Items ({otherItems.length}) — not eligible
                    </Typography>
                  </Stack>
                  <List dense>
                    {otherItems.map((item) => (
                      <ListItem
                        key={item.id}
                        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 0.5, opacity: 0.4 }}
                      >
                        <ListItemIcon>
                          <Checkbox disabled />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.name}
                          secondary={`${item.category} — ${item.sourcingType ?? 'Unknown type'}`}
                        />
                        <Chip label={item.status} size="small" />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {selectedManufacturedIds.length} manufactured item(s) selected
              {includeProcuredItems && selectedProcuredIds.length > 0 &&
                ` + ${selectedProcuredIds.length} procured item(s)`}
            </Typography>
          </Box>
        )}

        {/* Step 2: Routing & Batch */}
        {activeStep === 2 && (
          <Stack spacing={3}>
            <TextField
              label="Routing Template ID (optional)"
              fullWidth
              value={routingTemplateId}
              onChange={e => setRoutingTemplateId(e.target.value)}
              helperText="Leave blank to auto-detect based on item type"
            />

            <TextField
              label="Batch Size"
              type="number"
              fullWidth
              value={batchSize}
              onChange={e => setBatchSize(e.target.value)}
              helperText="Leave empty for single MO per item. Set a number to split large quantities into batches."
              inputProps={{ min: 1 }}
            />

            <TextField
              label="Project Phase"
              fullWidth
              value={projectPhase}
              onChange={e => setProjectPhase(e.target.value)}
              placeholder="e.g. Room A Cabinets, Reception Desk"
              helperText="Optional label for grouping MOs by phase within the project"
            />

            {/* Batch Preview */}
            {batchPreview.length > 0 && (
              <Alert severity="info" icon={<Package size={20} />}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                  Batch Preview
                </Typography>
                {batchPreview.map((bp, i) => (
                  <Typography key={i} variant="body2">
                    {bp.name} (qty {bp.qty}) → {bp.batchCount} MOs of {bp.batchSize}
                    {bp.qty % bp.batchSize !== 0 &&
                      ` (last batch: ${bp.qty - (bp.batchCount - 1) * bp.batchSize})`}
                  </Typography>
                ))}
              </Alert>
            )}
          </Stack>
        )}

        {/* Step 3: Schedule */}
        {activeStep === 3 && (
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select value={priority} label="Priority" onChange={e => setPriority(e.target.value as typeof priority)}>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Due Date"
              type="date"
              fullWidth
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Notes"
              multiline
              rows={3}
              fullWidth
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Stack>
        )}

        {/* Step 4: Confirm + Result */}
        {activeStep === 4 && (
          <Box>
            {isReleasing ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography>Creating manufacturing orders...</Typography>
              </Box>
            ) : releaseResult ? (
              <Stack spacing={2}>
                {releaseResult.success ? (
                  <Alert severity="success" icon={<CheckCircle2 size={20} />}>
                    Created {releaseResult.totalMOsCreated ?? releaseResult.manufacturingOrderIds.length} manufacturing order(s)
                    {releaseResult.batchId && ` (Batch: ${releaseResult.batchId.substring(0, 8)}...)`}
                    {releaseResult.procuredItemCount
                      ? ` with ${releaseResult.procuredItemCount} procured item(s) attached`
                      : ''}
                  </Alert>
                ) : (
                  <Alert severity="error" icon={<XCircle size={20} />}>
                    Release completed with errors
                  </Alert>
                )}

                {releaseResult.errors.map((err, i) => (
                  <Alert key={i} severity="error">{err.error}</Alert>
                ))}

                {releaseResult.warnings.map((warn, i) => (
                  <Alert key={i} severity="warning" icon={<AlertTriangle size={20} />}>
                    {warn}
                  </Alert>
                ))}

                {releaseResult.availabilityReport && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                      Material Availability
                    </Typography>
                    <Chip
                      label={releaseResult.availabilityReport.overallStatus.replace('_', ' ')}
                      color={releaseResult.availabilityReport.overallStatus === 'all_available' ? 'success' : 'warning'}
                      sx={{ mb: 1 }}
                    />
                  </Box>
                )}
              </Stack>
            ) : (
              <Box>
                <Typography variant="body2" sx={{ mb: 2 }} fontWeight={600}>
                  Review and confirm release to production:
                </Typography>

                <Stack spacing={1.5} sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Sales Order:</strong> {salesOrder?.orderNumber ?? 'N/A'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Manufactured Items:</strong> {selectedManufacturedIds.length} → {estimatedMOCount} MO(s)
                  </Typography>
                  {parseInt(batchSize, 10) > 0 && (
                    <Typography variant="body2">
                      <strong>Batch Size:</strong> {batchSize} units per MO
                    </Typography>
                  )}
                  {includeProcuredItems && selectedProcuredIds.length > 0 && (
                    <Typography variant="body2">
                      <strong>Procured Items:</strong> {selectedProcuredIds.length} attached as MO line items
                    </Typography>
                  )}
                  {projectPhase && (
                    <Typography variant="body2">
                      <strong>Phase:</strong> {projectPhase}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    <strong>Priority:</strong> {priority}
                  </Typography>
                  {dueDate && (
                    <Typography variant="body2">
                      <strong>Due:</strong> {dueDate}
                    </Typography>
                  )}
                  {notes && (
                    <Typography variant="body2">
                      <strong>Notes:</strong> {notes}
                    </Typography>
                  )}
                </Stack>

                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleRelease}
                  sx={{ mt: 1 }}
                  fullWidth
                  size="large"
                >
                  Release to Production ({estimatedMOCount} MO{estimatedMOCount !== 1 ? 's' : ''})
                </Button>
              </Box>
            )}
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {releaseResult ? 'Close' : 'Cancel'}
        </Button>
        {activeStep > 0 && activeStep < 4 && !releaseResult && (
          <Button onClick={() => setActiveStep(s => s - 1)}>Back</Button>
        )}
        {activeStep < 4 && (
          <Button
            variant="contained"
            onClick={() => setActiveStep(s => s + 1)}
            disabled={!canProceed()}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
