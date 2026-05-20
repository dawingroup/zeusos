/**
 * WorkstationsPage — Route target for /manufacturing/workstations
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
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Plus, Edit2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useGlobalState } from '@/integration/store/GlobalContext';
import { useWorkstations } from '../hooks/useWorkstations';
import { workstationSchema, type WorkstationInput } from '../schemas';
import { WORKSTATION_TYPE_LABELS, type Workstation, type WorkstationStatus } from '../types';

const STATUS_COLORS: Record<WorkstationStatus, 'success' | 'warning' | 'error' | 'default'> = {
  operational: 'success',
  setup: 'warning',
  maintenance: 'error',
  offline: 'default',
};

const WorkstationsPage: React.FC = () => {
  const { state } = useGlobalState();
  const userId = state.auth?.user?.id ?? '';
  const orgId = state.currentOrganizationId ?? '';
  const subId = state.currentSubsidiaryId ?? 'zeus-the-agency';

  const {
    workstations,
    isLoading,
    createWorkstation,
    updateWorkstation,
    setStatus,
  } = useWorkstations(orgId, subId, userId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<Workstation | null>(null);

  const openCreate = () => {
    setEditingWs(null);
    setDialogOpen(true);
  };

  const openEdit = (ws: Workstation) => {
    setEditingWs(ws);
    setDialogOpen(true);
  };

  const handleSave = async (data: WorkstationInput) => {
    if (editingWs) {
      await updateWorkstation(editingWs.id, data);
    } else {
      await createWorkstation({
        ...data,
        organizationId: orgId,
        subsidiaryId: subId,
        assignedOperatorIds: [],
      });
    }
    setDialogOpen(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Workstations
        </Typography>
        <Button startIcon={<Plus size={16} />} variant="contained" onClick={openCreate}>
          Add Workstation
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Capacity</TableCell>
              <TableCell align="center">Active Jobs</TableCell>
              <TableCell align="center">Queued</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>Loading...</TableCell>
              </TableRow>
            ) : workstations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No workstations configured</Typography>
                </TableCell>
              </TableRow>
            ) : (
              workstations.map((ws) => (
                <TableRow key={ws.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{ws.name}</Typography>
                    {ws.location && (
                      <Typography variant="caption" color="text.secondary">{ws.location}</Typography>
                    )}
                  </TableCell>
                  <TableCell>{ws.code}</TableCell>
                  <TableCell>{WORKSTATION_TYPE_LABELS[ws.type]}</TableCell>
                  <TableCell>
                    <Chip
                      label={ws.status}
                      size="small"
                      color={STATUS_COLORS[ws.status]}
                    />
                  </TableCell>
                  <TableCell align="center">{ws.maxConcurrentJobs}</TableCell>
                  <TableCell align="center">
                    <Typography
                      fontWeight={600}
                      color={ws.currentActiveJobs >= ws.maxConcurrentJobs ? 'error.main' : 'text.primary'}
                    >
                      {ws.currentActiveJobs}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{ws.queuedStepCount}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => openEdit(ws)}>
                        <Edit2 size={14} />
                      </IconButton>
                      {ws.status === 'operational' ? (
                        <Button size="small" color="warning" onClick={() => setStatus(ws.id, 'maintenance')}>
                          Maint.
                        </Button>
                      ) : (
                        <Button size="small" color="success" onClick={() => setStatus(ws.id, 'operational')}>
                          Online
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <WorkstationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={editingWs}
      />
    </Box>
  );
};

// ============================================
// Workstation Dialog
// ============================================

interface WorkstationDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: WorkstationInput) => Promise<void>;
  initial: Workstation | null;
}

const WorkstationDialog: React.FC<WorkstationDialogProps> = ({
  open,
  onClose,
  onSave,
  initial,
}) => {
  const { control, handleSubmit, reset, formState: { errors } } = useForm<WorkstationInput>({
    resolver: zodResolver(workstationSchema) as any,
    defaultValues: initial ? {
      name: initial.name,
      code: initial.code,
      type: initial.type,
      location: initial.location ?? '',
      maxConcurrentJobs: initial.maxConcurrentJobs,
      operatingHoursPerDay: initial.operatingHoursPerDay,
      status: initial.status,
      isActive: initial.isActive,
    } : {
      name: '',
      code: '',
      type: 'cutting_panel_saw',
      maxConcurrentJobs: 1,
      operatingHoursPerDay: 8,
      status: 'operational',
      isActive: true,
    },
  } as any);

  // Reset form when initial changes
  React.useEffect(() => {
    if (open) {
      reset(initial ? {
        name: initial.name,
        code: initial.code,
        type: initial.type,
        location: initial.location ?? '',
        maxConcurrentJobs: initial.maxConcurrentJobs,
        operatingHoursPerDay: initial.operatingHoursPerDay,
        status: initial.status,
        isActive: initial.isActive,
      } : {
        name: '',
        code: '',
        type: 'cutting_panel_saw',
        maxConcurrentJobs: 1,
        operatingHoursPerDay: 8,
        status: 'operational',
        isActive: true,
      });
    }
  }, [open, initial, reset]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Workstation' : 'Add Workstation'}</DialogTitle>
      <form onSubmit={handleSubmit(onSave)}>
        <DialogContent>
          <Stack spacing={2}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Name" fullWidth error={!!errors.name} helperText={errors.name?.message} />
              )}
            />
            <Controller
              name="code"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Code" fullWidth error={!!errors.code} helperText={errors.code?.message} />
              )}
            />
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select {...field} label="Type">
                    {Object.entries(WORKSTATION_TYPE_LABELS).map(([key, label]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Location" fullWidth value={field.value ?? ''} />
              )}
            />
            <Stack direction="row" spacing={2}>
              <Controller
                name="maxConcurrentJobs"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Max Concurrent Jobs"
                    type="number"
                    onChange={e => field.onChange(Number(e.target.value))}
                    sx={{ flex: 1 }}
                  />
                )}
              />
              <Controller
                name="operatingHoursPerDay"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Operating Hours/Day"
                    type="number"
                    onChange={e => field.onChange(Number(e.target.value))}
                    sx={{ flex: 1 }}
                  />
                )}
              />
            </Stack>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={field.onChange} />}
                  label="Active"
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">{initial ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default WorkstationsPage;
