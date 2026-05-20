/**
 * StepExecutionPanel — Operator execution UI for manufacturing steps
 * Touch-friendly with large buttons, timer, material checklist, and QC section
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  Divider,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import {
  Play,
  Pause,
  CheckCircle2,
  SkipForward,
  ChevronLeft,
  Wrench,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepTimerDisplay } from './StepTimerDisplay';
import type { ManufacturingStep, StepMaterialConsumption, BOMLine } from '../../types';
import { qualityEventSchema, type QualityEventInput } from '../../schemas';
import { WORKSTATION_TYPE_LABELS, DEFECT_TYPE_LABELS } from '../../types';

interface StepExecutionPanelProps {
  step: ManufacturingStep;
  orderId: string;
  moNumber: string;
  bomLines: BOMLine[];
  onStart: (stepId: string, operatorId: string, operatorName: string) => Promise<void>;
  onPause: (stepId: string, operatorId: string, reason?: string) => Promise<void>;
  onResume: (stepId: string, operatorId: string, operatorName: string) => Promise<void>;
  onComplete: (stepId: string, operatorId: string, operatorName: string, materials?: StepMaterialConsumption[]) => Promise<void>;
  onSkip: (stepId: string, userId: string, reason: string) => Promise<void>;
  onQCResult: (
    stepId: string,
    result: 'pass' | 'fail' | 'conditional',
    inspectorId: string,
    inspectorName: string,
    notes?: string,
    defectDetails?: {
      defectType: string;
      defectSeverity: string;
      defectDescription?: string;
      affectedQuantity?: number;
      resolution?: string;
      photos?: string[];
    },
  ) => Promise<string | undefined>;
  currentUserId: string;
  currentUserName: string;
  onBack?: () => void;
  previousStep?: ManufacturingStep | null;
}

export const StepExecutionPanel: React.FC<StepExecutionPanelProps> = ({
  step,
  orderId: _orderId,
  moNumber,
  bomLines,
  onStart,
  onPause,
  onResume,
  onComplete,
  onSkip,
  onQCResult,
  currentUserId,
  currentUserName,
  onBack,
  previousStep,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [operatorNotes, setOperatorNotes] = useState(step.operatorNotes ?? '');
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [showQCDialog, setShowQCDialog] = useState(false);
  const [consumedMaterials, setConsumedMaterials] = useState<Record<string, number>>({});

  const isRunning = step.status === 'in_progress';
  const isPaused = step.status === 'paused';
  const isQCPending = step.status === 'qc_pending';
  const canStart = step.status === 'queued' || step.status === 'ready';
  const canComplete = step.status === 'in_progress';

  const handleAction = async (action: () => Promise<void>) => {
    setIsProcessing(true);
    try {
      await action();
    } catch (err) {
      console.error('Step action failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStart = () => handleAction(
    () => onStart(step.id, currentUserId, currentUserName),
  );

  const handlePause = () => handleAction(
    () => onPause(step.id, currentUserId, operatorNotes || undefined),
  );

  const handleResume = () => handleAction(
    () => onResume(step.id, currentUserId, currentUserName),
  );

  const handleComplete = () => {
    const materials: StepMaterialConsumption[] = Object.entries(consumedMaterials)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const bom = bomLines.find(b => b.inventoryItemId === itemId);
        return {
          inventoryItemId: itemId,
          materialName: bom?.materialName ?? 'Unknown',
          quantityConsumed: qty,
          unit: bom?.unit ?? 'pcs',
        };
      });

    handleAction(() => onComplete(step.id, currentUserId, currentUserName, materials.length > 0 ? materials : undefined));
  };

  const handleSkip = () => {
    if (!skipReason.trim()) return;
    setShowSkipDialog(false);
    handleAction(() => onSkip(step.id, currentUserId, skipReason));
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {onBack && (
          <IconButton onClick={onBack} size="large">
            <ChevronLeft />
          </IconButton>
        )}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>
            {step.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {moNumber} — Step {step.stepIndex + 1}
          </Typography>
        </Box>
        <Chip
          label={WORKSTATION_TYPE_LABELS[step.workstationType] ?? step.workstationType}
          icon={<Wrench size={14} />}
          size="small"
          variant="outlined"
        />
      </Box>

      {/* Previous step info */}
      {previousStep && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Previous: <strong>{previousStep.name}</strong>
          {previousStep.assignedOperatorName && ` by ${previousStep.assignedOperatorName}`}
          {previousStep.actualDurationMinutes != null && ` (${previousStep.actualDurationMinutes} min)`}
        </Alert>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Timer */}
      <Box sx={{ mb: 3 }}>
        <StepTimerDisplay
          timeEntries={step.timeEntries}
          isRunning={isRunning}
        />
        {step.estimatedDurationMinutes > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Estimated: {step.estimatedDurationMinutes} minutes
          </Typography>
        )}
      </Box>

      {/* Action Buttons — Large, touch-friendly */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {canStart && (
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<Play />}
            onClick={handleStart}
            disabled={isProcessing}
            sx={{ flex: 1, py: 2, fontSize: '1.1rem' }}
          >
            Start
          </Button>
        )}

        {isRunning && (
          <>
            <Button
              variant="contained"
              color="warning"
              size="large"
              startIcon={<Pause />}
              onClick={handlePause}
              disabled={isProcessing}
              sx={{ flex: 1, py: 2, fontSize: '1.1rem' }}
            >
              Pause
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<CheckCircle2 />}
              onClick={handleComplete}
              disabled={isProcessing}
              sx={{ flex: 1, py: 2, fontSize: '1.1rem' }}
            >
              Complete
            </Button>
          </>
        )}

        {isPaused && (
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<Play />}
            onClick={handleResume}
            disabled={isProcessing}
            sx={{ flex: 1, py: 2, fontSize: '1.1rem' }}
          >
            Resume
          </Button>
        )}

        {isQCPending && (
          <Button
            variant="contained"
            color="info"
            size="large"
            startIcon={<CheckCircle2 />}
            onClick={() => setShowQCDialog(true)}
            disabled={isProcessing}
            sx={{ flex: 1, py: 2, fontSize: '1.1rem' }}
          >
            Record QC
          </Button>
        )}

        {(canStart || isPaused) && (
          <Button
            variant="outlined"
            color="inherit"
            size="large"
            startIcon={<SkipForward />}
            onClick={() => setShowSkipDialog(true)}
            disabled={isProcessing}
            sx={{ py: 2 }}
          >
            Skip
          </Button>
        )}
      </Stack>

      {/* Material Consumption Checklist */}
      {bomLines.length > 0 && (isRunning || canComplete) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Materials for this step
          </Typography>
          <List dense>
            {bomLines
              .filter(b => b.category !== 'labor')
              .slice(0, 10) // Show first 10 materials
              .map((bom) => (
                <ListItem key={bom.id} sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      checked={(consumedMaterials[bom.inventoryItemId ?? bom.id] ?? 0) > 0}
                      onChange={(e) => {
                        const key = bom.inventoryItemId ?? bom.id;
                        setConsumedMaterials(prev => ({
                          ...prev,
                          [key]: e.target.checked ? bom.requiredQuantity : 0,
                        }));
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={bom.materialName}
                    secondary={`${bom.requiredQuantity} ${bom.unit}`}
                  />
                  <TextField
                    type="number"
                    size="small"
                    label="Qty"
                    sx={{ width: 80 }}
                    value={consumedMaterials[bom.inventoryItemId ?? bom.id] ?? ''}
                    onChange={(e) => {
                      const key = bom.inventoryItemId ?? bom.id;
                      setConsumedMaterials(prev => ({
                        ...prev,
                        [key]: Number(e.target.value) || 0,
                      }));
                    }}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </ListItem>
              ))}
          </List>
        </Box>
      )}

      {/* Operator Notes */}
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Operator Notes"
          multiline
          rows={2}
          fullWidth
          value={operatorNotes}
          onChange={(e) => setOperatorNotes(e.target.value)}
          placeholder="Any notes about this step..."
        />
      </Box>

      {/* Skip Dialog */}
      <Dialog open={showSkipDialog} onClose={() => setShowSkipDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Skip Step</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Provide a reason for skipping "{step.name}":
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Reason for skipping..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSkipDialog(false)}>Cancel</Button>
          <Button onClick={handleSkip} variant="contained" disabled={!skipReason.trim()}>
            Skip Step
          </Button>
        </DialogActions>
      </Dialog>

      {/* QC Dialog */}
      <QCInspectionDialog
        open={showQCDialog}
        onClose={() => setShowQCDialog(false)}
        stepId={step.id}
        stepName={step.name}
        onSubmit={async (data) => {
          setShowQCDialog(false);
          await onQCResult(
            step.id,
            data.result!,
            currentUserId,
            currentUserName,
            data.notes,
            data.result === 'fail' ? {
              defectType: data.defectType!,
              defectSeverity: data.defectSeverity!,
              defectDescription: data.defectDescription,
              affectedQuantity: data.affectedQuantity,
              resolution: data.resolution,
              photos: data.photos,
            } : undefined,
          );
        }}
      />
    </Paper>
  );
};

// ============================================
// QC Inspection Dialog (inline)
// ============================================

interface QCInspectionDialogProps {
  open: boolean;
  onClose: () => void;
  stepId: string;
  stepName: string;
  onSubmit: (data: QualityEventInput) => Promise<void>;
}

const QCInspectionDialog: React.FC<QCInspectionDialogProps> = ({
  open,
  onClose,
  stepName,
  onSubmit,
}) => {
  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<QualityEventInput>({
    resolver: zodResolver(qualityEventSchema) as any,
    defaultValues: {
      type: 'inspection',
      result: undefined,
      photos: [],
    },
  } as any);

  const result = watch('result');

  const onFormSubmit = async (data: QualityEventInput) => {
    await onSubmit(data);
    reset();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Quality Inspection — {stepName}</DialogTitle>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogContent>
          <Stack spacing={2}>
            {/* Result */}
            <Controller
              name="result"
              control={control}
              render={({ field }) => (
                <Stack direction="row" spacing={1}>
                  {(['pass', 'fail', 'conditional'] as const).map((opt) => (
                    <Button
                      key={opt}
                      variant={field.value === opt ? 'contained' : 'outlined'}
                      color={opt === 'pass' ? 'success' : opt === 'fail' ? 'error' : 'warning'}
                      onClick={() => field.onChange(opt)}
                      sx={{ flex: 1, py: 1.5 }}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Button>
                  ))}
                </Stack>
              )}
            />

            {/* Defect details (on fail) */}
            {result === 'fail' && (
              <>
                <Controller
                  name="defectType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.defectType}>
                      <InputLabel>Defect Type</InputLabel>
                      <Select {...field} label="Defect Type" value={field.value ?? ''}>
                        {Object.entries(DEFECT_TYPE_LABELS).map(([key, label]) => (
                          <MenuItem key={key} value={key}>{label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="defectSeverity"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.defectSeverity}>
                      <InputLabel>Severity</InputLabel>
                      <Select {...field} label="Severity" value={field.value ?? ''}>
                        <MenuItem value="minor">Minor</MenuItem>
                        <MenuItem value="major">Major</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="defectDescription"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Description" multiline rows={2} fullWidth value={field.value ?? ''} />
                  )}
                />

                <Controller
                  name="resolution"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Resolution</InputLabel>
                      <Select {...field} label="Resolution" value={field.value ?? ''}>
                        <MenuItem value="rework">Rework</MenuItem>
                        <MenuItem value="scrap">Scrap</MenuItem>
                        <MenuItem value="use_as_is">Use As Is</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </>
            )}

            {/* Notes */}
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Notes" multiline rows={2} fullWidth value={field.value ?? ''} />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!result}>
            Submit Inspection
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
