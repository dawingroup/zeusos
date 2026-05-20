/**
 * OrderDetailPageEnhanced — Tabbed MO detail with Steps, BOM, Quality, Cost
 * Route: /manufacturing/orders/:orderId
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Chip,
  Stack,
  IconButton,
  LinearProgress,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { ArrowLeft, Play, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';
import { UnifiedFileManager } from '@/shared/components/file-manager';
import { useGlobalState } from '@/integration/store/GlobalContext';
import { useManufacturingOrder } from '../hooks/useManufacturingOrder';
import { useManufacturingSteps } from '../hooks/useManufacturingSteps';
import { useBOM } from '../hooks/useBOM';
import { StepExecutionPanel } from '../components/step-execution/StepExecutionPanel';
import { BOMEditor } from '../components/bom/BOMEditor';
import { BOMSubstitutionDialog } from '../components/mo/BOMSubstitutionDialog';
import type { SimilarInventoryItem } from '../services/inventoryIntegrationService';
import type { BOMEntry } from '../types';
import { MO_STATUS_MAP, WORKSTATION_TYPE_LABELS, type ManufacturingStep } from '../types';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { cleanArrayForFirestore } from '../services/manufacturingOrderService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ py: 2 }}>{children}</Box> : null;
}

const OrderDetailPageEnhanced: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { state } = useGlobalState();
  const userId = state.auth?.user?.id ?? '';
  const userName = state.auth?.user?.displayName ?? state.auth?.user?.email ?? 'Operator';

  const { order, loading: orderLoading, actions } = useManufacturingOrder(orderId ?? null, userId);
  const {
    steps, isLoading: stepsLoading,
    startStep, pauseStep, resumeStep, completeStep, skipStep, recordQCResult,
    activeStep: _activeStep, completedCount, totalCount, progressPercent,
  } = useManufacturingSteps(orderId ?? null);
  const { bomLines, costSummary, addLine, updateLine, removeLine } = useBOM(orderId ?? null);

  const [tabIndex, setTabIndex] = useState(0);
  const [selectedStep, setSelectedStep] = useState<ManufacturingStep | null>(null);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // BOM substitution state
  const [substitutionEntry, setSubstitutionEntry] = useState<BOMEntry | null>(null);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await actions.delete();
      navigate('/manufacturing/orders');
    } catch {
      // Error handled by hook
    }
    setDeleteLoading(false);
  };

  const handleSubstitute = async (bomEntryId: string, newItem: SimilarInventoryItem) => {
    if (!order) return;
    try {
      const updatedBom = order.bom.map((entry) => {
        if (entry.id !== bomEntryId) return entry;
        return {
          ...entry,
          inventoryItemId: newItem.id,
          sku: newItem.sku,
          itemName: newItem.displayName || newItem.name,
          category: newItem.category,
          unitCost: newItem.unitCost,
          totalCost: newItem.unitCost * entry.quantityRequired,
          notes: `Substituted from "${entry.itemName}" — ${newItem.matchReason}`,
        };
      });
      const materialCost = updatedBom.reduce((s, e) => s + e.totalCost, 0);
      await updateDoc(doc(db, 'manufacturingOrders', order.id), {
        bom: cleanArrayForFirestore(updatedBom),
        'costSummary.materialCost': materialCost,
        'costSummary.totalCost': materialCost,
        updatedAt: new Date(),
        updatedBy: userId,
      });
    } catch (e) {
      console.error('Substitution failed:', e);
    } finally {
      setSubstitutionEntry(null);
    }
  };

  if (orderLoading || !order) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{orderLoading ? 'Loading...' : 'Order not found'}</Typography>
      </Box>
    );
  }

  const mesStatus = (order as unknown as Record<string, unknown>).mesStatus as string | undefined;
  const effectiveStatus = mesStatus ?? order.status;
  const deletableStatuses = ['draft', 'cancelled'];
  const canDelete =
    (deletableStatuses.includes(order.status) || deletableStatuses.includes(mesStatus ?? '')) &&
    (!order.materialConsumptions || order.materialConsumptions.length === 0);
  const canSubstitute = ['draft', 'approved'].includes(effectiveStatus);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-UG', { style: 'decimal', maximumFractionDigits: 0 }).format(val);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/manufacturing/orders')}>
          <ArrowLeft />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>
            {order.moNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {order.designItemName ?? order.itemName}
            {order.projectCode ? ` — ${order.projectCode}` : ''}
            {order.sourceType === 'manual' && (
              <Chip label="Standalone" size="small" variant="outlined" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
            )}
          </Typography>
        </Box>
        <Chip label={MO_STATUS_MAP[mesStatus as keyof typeof MO_STATUS_MAP] ?? mesStatus} color="primary" />
        <Chip
          label={order.priority}
          color={order.priority === 'urgent' ? 'error' : order.priority === 'high' ? 'warning' : 'default'}
          variant="outlined"
        />
        {canDelete && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<Trash2 size={16} />}
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete
          </Button>
        )}
      </Box>

      {/* Progress */}
      {totalCount > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              Step Progress: {completedCount}/{totalCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">{progressPercent}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progressPercent} sx={{ height: 8, borderRadius: 4 }} />
        </Paper>
      )}

      {/* Tabs */}
      <Paper variant="outlined">
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Overview" />
          <Tab label={`Steps (${totalCount})`} />
          <Tab label={`BOM (${bomLines.length})`} />
          <Tab label="Quality" />
          <Tab label="Cost" />
          <Tab label="Files" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={tabIndex} index={0}>
          <Box sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={4}>
                <InfoField label="MO Number" value={order.moNumber} />
                <InfoField label="Status" value={MO_STATUS_MAP[mesStatus as keyof typeof MO_STATUS_MAP] ?? mesStatus} />
                <InfoField label="Priority" value={order.priority} />
                <InfoField label="Quantity" value={String(order.quantity)} />
              </Stack>
              <Divider />
              <Stack direction="row" spacing={4}>
                <InfoField label="Design Item" value={order.designItemName ?? order.itemName ?? '—'} />
                <InfoField label="Project" value={order.projectCode ?? '—'} />
                <InfoField label="Customer" value={(order as unknown as Record<string, unknown>).customerName as string ?? '—'} />
              </Stack>
              {order.instructions && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Instructions</Typography>
                    <Typography>{order.instructions}</Typography>
                  </Box>
                </>
              )}
              {/* Inline BOM with substitution */}
              {order.bom.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                      Bill of Materials ({order.bom.length})
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell>Item</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Qty</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell align="right">Unit Cost</TableCell>
                            <TableCell align="right">Total</TableCell>
                            {canSubstitute && <TableCell width={48} />}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {order.bom.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>
                                <Typography variant="body2">{entry.itemName}</Typography>
                                {entry.sku && (
                                  <Typography variant="caption" color="text.secondary">{entry.sku}</Typography>
                                )}
                              </TableCell>
                              <TableCell>{entry.category}</TableCell>
                              <TableCell align="right">{entry.quantityRequired}</TableCell>
                              <TableCell>{entry.unit}</TableCell>
                              <TableCell align="right">{formatCurrency(entry.unitCost)}</TableCell>
                              <TableCell align="right">{formatCurrency(entry.totalCost)}</TableCell>
                              {canSubstitute && (
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() => setSubstitutionEntry(entry)}
                                    title="Substitute with similar item"
                                    sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                  >
                                    <RefreshCw size={16} />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </>
              )}
            </Stack>
          </Box>
        </TabPanel>

        {/* Steps Tab */}
        <TabPanel value={tabIndex} index={1}>
          <Box sx={{ p: 2 }}>
            {selectedStep ? (
              <StepExecutionPanel
                step={selectedStep}
                orderId={orderId!}
                moNumber={order.moNumber}
                bomLines={bomLines}
                onStart={startStep}
                onPause={pauseStep}
                onResume={resumeStep}
                onComplete={completeStep}
                onSkip={skipStep}
                onQCResult={recordQCResult as React.ComponentProps<typeof StepExecutionPanel>['onQCResult']}
                currentUserId={userId}
                currentUserName={userName}
                onBack={() => setSelectedStep(null)}
                previousStep={steps.find(s => s.stepIndex === selectedStep.stepIndex - 1) ?? null}
              />
            ) : (
              <StepsList
                steps={steps}
                isLoading={stepsLoading}
                onSelectStep={setSelectedStep}
              />
            )}
          </Box>
        </TabPanel>

        {/* BOM Tab */}
        <TabPanel value={tabIndex} index={2}>
          <Box sx={{ p: 2 }}>
            <BOMEditor
              bomLines={bomLines}
              costSummary={costSummary}
              readOnly={mesStatus === 'completed' || mesStatus === 'cancelled'}
              onAddLine={addLine}
              onUpdateLine={updateLine}
              onRemoveLine={removeLine}
            />
          </Box>
        </TabPanel>

        {/* Quality Tab */}
        <TabPanel value={tabIndex} index={3}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Quality Events</Typography>
            {(order as unknown as Record<string, unknown>).defectCount ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {String((order as unknown as Record<string, unknown>).defectCount)} defect(s) recorded
              </Alert>
            ) : (
              <Alert severity="success" sx={{ mb: 2 }}>No defects recorded</Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              Quality events are recorded during step execution via QC inspections.
            </Typography>
          </Box>
        </TabPanel>

        {/* Cost Tab */}
        <TabPanel value={tabIndex} index={4}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Cost Breakdown</Typography>
            {costSummary && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Estimated</TableCell>
                      <TableCell align="right">Actual</TableCell>
                      <TableCell align="right">Variance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Materials</TableCell>
                      <TableCell align="right">{formatCurrency(costSummary.totalEstimatedMaterialCost)}</TableCell>
                      <TableCell align="right">{formatCurrency(costSummary.totalActualMaterialCost)}</TableCell>
                      <TableCell align="right">
                        <Typography
                          color={costSummary.totalActualMaterialCost > costSummary.totalEstimatedMaterialCost ? 'error.main' : 'success.main'}
                        >
                          {formatCurrency(costSummary.totalActualMaterialCost - costSummary.totalEstimatedMaterialCost)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {costSummary.totalEstimatedLaborCost > 0 && (
                      <TableRow>
                        <TableCell>Labor (legacy)</TableCell>
                        <TableCell align="right">{formatCurrency(costSummary.totalEstimatedLaborCost)}</TableCell>
                        <TableCell align="right">{formatCurrency(costSummary.totalActualLaborCost)}</TableCell>
                        <TableCell align="right">
                          <Typography
                            color={costSummary.totalActualLaborCost > costSummary.totalEstimatedLaborCost ? 'error.main' : 'success.main'}
                          >
                            {formatCurrency(costSummary.totalActualLaborCost - costSummary.totalEstimatedLaborCost)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell>Scrap/Waste</TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell align="right">{formatCurrency(costSummary.totalScrapCost)}</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell><strong>Total</strong></TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(costSummary.totalEstimatedMaterialCost)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(costSummary.totalActualMaterialCost + costSummary.totalScrapCost)}</strong>
                      </TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>

        {/* Files Tab */}
        <TabPanel value={tabIndex} index={5}>
          <Box sx={{ p: 2 }}>
            {order?.designProjectId ? (
              <UnifiedFileManager
                projectId={order.designProjectId}
                manufacturingOrderId={orderId}
                userId={userId}
                userName={userName}
                module="manufacturing"
                showBulkActions
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No linked design project. Files are available when a project is linked.
              </Typography>
            )}
          </Box>
        </TabPanel>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Delete Manufacturing Order</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete <strong>{order.moNumber}</strong>
            {' '}({order.designItemName ?? order.itemName})? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? undefined : <Trash2 size={16} />}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* BOM Substitution Dialog */}
      {substitutionEntry && (
        <BOMSubstitutionDialog
          open={!!substitutionEntry}
          onClose={() => setSubstitutionEntry(null)}
          bomEntry={substitutionEntry}
          onSubstitute={handleSubstitute}
        />
      )}
    </Box>
  );
};

// ============================================
// Helper Components
// ============================================

const InfoField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography fontWeight={600}>{value}</Typography>
  </Box>
);

const StepsList: React.FC<{
  steps: ManufacturingStep[];
  isLoading: boolean;
  onSelectStep: (step: ManufacturingStep) => void;
}> = ({ steps, isLoading, onSelectStep }) => {
  if (isLoading) return <Typography>Loading steps...</Typography>;
  if (steps.length === 0) return <Alert severity="info">No routing steps defined for this order.</Alert>;

  const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    completed: 'success',
    in_progress: 'warning',
    paused: 'warning',
    qc_pending: 'info',
    failed: 'error',
    skipped: 'default',
    queued: 'default',
    ready: 'info',
  };

  return (
    <List>
      {steps.map((step) => (
        <ListItem
          key={step.id}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            mb: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          onClick={() => onSelectStep(step)}
          secondaryAction={
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={step.status.replace('_', ' ')}
                size="small"
                color={STATUS_COLORS[step.status] ?? 'default'}
              />
              {(step.status === 'queued' || step.status === 'ready') && (
                <IconButton size="small" color="success">
                  <Play size={16} />
                </IconButton>
              )}
              {step.status === 'completed' && <CheckCircle2 size={16} color="#2e7d32" />}
            </Stack>
          }
        >
          <ListItemText
            primary={
              <Typography fontWeight={600}>
                {step.stepIndex + 1}. {step.name}
              </Typography>
            }
            secondary={
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Typography variant="caption">
                  {WORKSTATION_TYPE_LABELS[step.workstationType]}
                </Typography>
                <Typography variant="caption">
                  Est. {step.estimatedDurationMinutes} min
                </Typography>
                {step.actualDurationMinutes != null && (
                  <Typography variant="caption">
                    Act. {step.actualDurationMinutes} min
                  </Typography>
                )}
                {step.qcRequired && (
                  <Chip label="QC" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                )}
              </Stack>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

export default OrderDetailPageEnhanced;
