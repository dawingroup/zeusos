/**
 * RoutingTemplatesPage — CRUD for manufacturing routing templates
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  List,
  ListItem,
} from '@mui/material';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useGlobalState } from '@/integration/store/GlobalContext';
import type { RoutingTemplate, RoutingTemplateStep } from '../types';
import { WORKSTATION_TYPE_LABELS } from '../types';

const TEMPLATES_COLLECTION = 'routing_templates';

const RoutingTemplatesPage: React.FC = () => {
  const { state } = useGlobalState();
  const orgId = state.currentOrganizationId ?? '';
  const subId = state.currentSubsidiaryId ?? 'dawin-finishes';
  const userId = state.auth?.user?.id ?? '';

  const [templates, setTemplates] = useState<RoutingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoutingTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(
      query(
        collection(db, TEMPLATES_COLLECTION),
        where('organizationId', '==', orgId),
        where('subsidiaryId', '==', subId),
        orderBy('name', 'asc'),
      ),
    );
    setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }) as RoutingTemplate));
    setLoading(false);
  }, [orgId, subId]);

  useEffect(() => {
    if (orgId) loadTemplates();
  }, [orgId, loadTemplates]);

  const handleSave = async (name: string, productType: string, isDefault: boolean, steps: RoutingTemplateStep[]) => {
    const now = serverTimestamp();
    const totalMinutes = steps.reduce((s, st) => s + st.estimatedDurationMinutes, 0);

    if (editing) {
      await updateDoc(doc(db, TEMPLATES_COLLECTION, editing.id), {
        name,
        productType,
        isDefault,
        steps,
        estimatedTotalMinutes: totalMinutes,
        updatedAt: now,
        updatedBy: userId,
      });
    } else {
      await addDoc(collection(db, TEMPLATES_COLLECTION), {
        name,
        productType,
        isDefault,
        steps,
        estimatedTotalMinutes: totalMinutes,
        version: 1,
        isActive: true,
        organizationId: orgId,
        subsidiaryId: subId,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });
    }

    setDialogOpen(false);
    setEditing(null);
    await loadTemplates();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Routing Templates</Typography>
        <Button
          startIcon={<Plus size={16} />}
          variant="contained"
          onClick={() => { setEditing(null); setDialogOpen(true); }}
        >
          New Template
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell>Name</TableCell>
              <TableCell>Product Type</TableCell>
              <TableCell align="center">Steps</TableCell>
              <TableCell align="center">Est. Time</TableCell>
              <TableCell>Default</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>Loading...</TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No templates. Create one to define manufacturing workflows.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell><Typography fontWeight={600}>{t.name}</Typography></TableCell>
                  <TableCell>{t.productType}</TableCell>
                  <TableCell align="center">{t.steps.length}</TableCell>
                  <TableCell align="center">{t.estimatedTotalMinutes} min</TableCell>
                  <TableCell>
                    {t.isDefault && <Chip label="Default" size="small" color="primary" />}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                      <Edit2 size={14} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TemplateDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing}
      />
    </Box>
  );
};

// ============================================
// Template Builder Dialog
// ============================================

interface TemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, productType: string, isDefault: boolean, steps: RoutingTemplateStep[]) => Promise<void>;
  initial: RoutingTemplate | null;
}

const TemplateDialog: React.FC<TemplateDialogProps> = ({ open, onClose, onSave, initial }) => {
  const [name, setName] = useState('');
  const [productType, setProductType] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [steps, setSteps] = useState<RoutingTemplateStep[]>([]);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setProductType(initial?.productType ?? '');
      setIsDefault(initial?.isDefault ?? false);
      setSteps(initial?.steps ?? []);
    }
  }, [open, initial]);

  const addStep = () => {
    setSteps([...steps, {
      stepIndex: steps.length,
      name: '',
      workstationType: 'cutting_panel_saw',
      estimatedDurationMinutes: 30,
      qcRequired: false,
      dependsOnStepIndices: steps.length > 0 ? [steps.length - 1] : [],
      isOptional: false,
    }]);
  };

  const updateStep = (idx: number, updates: Partial<RoutingTemplateStep>) => {
    setSteps(steps.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepIndex: i })));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !productType.trim() || steps.length === 0) return;
    await onSave(name, productType, isDefault, steps);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initial ? 'Edit Template' : 'New Routing Template'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="Name" value={name} onChange={e => setName(e.target.value)} sx={{ flex: 2 }} />
            <TextField label="Product Type" value={productType} onChange={e => setProductType(e.target.value)} sx={{ flex: 1 }} />
            <FormControlLabel
              control={<Switch checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />}
              label="Default"
            />
          </Stack>

          <Typography variant="subtitle2" fontWeight={600}>Steps</Typography>

          <List>
            {steps.map((step, idx) => (
              <ListItem key={idx} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1, display: 'block' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <GripVertical size={16} />
                  <Typography variant="caption" fontWeight={700}>Step {idx + 1}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    label="Name"
                    value={step.name}
                    onChange={e => updateStep(idx, { name: e.target.value })}
                    sx={{ flex: 2 }}
                  />
                  <FormControl size="small" sx={{ flex: 1.5 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={step.workstationType}
                      label="Type"
                      onChange={e => updateStep(idx, { workstationType: e.target.value as RoutingTemplateStep['workstationType'] })}
                    >
                      {Object.entries(WORKSTATION_TYPE_LABELS).map(([k, v]) => (
                        <MenuItem key={k} value={k}>{v}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Est. min"
                    type="number"
                    value={step.estimatedDurationMinutes}
                    onChange={e => updateStep(idx, { estimatedDurationMinutes: Number(e.target.value) })}
                    sx={{ width: 90 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={step.qcRequired}
                        onChange={e => updateStep(idx, { qcRequired: e.target.checked })}
                      />
                    }
                    label="QC"
                  />
                  <IconButton size="small" color="error" onClick={() => removeStep(idx)}>
                    <Trash2 size={14} />
                  </IconButton>
                </Stack>
              </ListItem>
            ))}
          </List>

          <Button startIcon={<Plus size={14} />} onClick={addStep} variant="outlined" size="small">
            Add Step
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim() || !productType.trim() || steps.length === 0}
        >
          {initial ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoutingTemplatesPage;
