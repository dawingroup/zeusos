/**
 * WarehouseManager Component
 * CRUD interface for managing warehouse locations
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useWarehouses } from '../hooks/useWarehouses';
import { createWarehouse, updateWarehouse } from '../services/warehouseService';
import type { Warehouse, WarehouseType } from '../types/warehouse';
import { WAREHOUSE_TYPE_LABELS } from '../types/warehouse';

export default function WarehouseManager() {
  const { currentSubsidiary } = useSubsidiary();
  const subsidiaryId = currentSubsidiary?.id || '';
  const { warehouses, loading } = useWarehouses(subsidiaryId || null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<WarehouseType>('warehouse');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setName('');
    setCode('');
    setType('warehouse');
    setAddress('');
    setIsActive(true);
    setEditingWarehouse(null);
    setError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setName(wh.name);
    setCode(wh.code);
    setType(wh.type);
    setAddress(wh.address || '');
    setIsActive(wh.isActive);
    setError(null);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) {
      setError('Name and code are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          type,
          address: address.trim() || undefined,
          isActive,
        });
      } else {
        await createWarehouse({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          type,
          address: address.trim() || undefined,
          isActive: true,
          subsidiaryId,
        });
      }
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Warehouses & Locations</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          size="small"
        >
          Add Location
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {warehouses.map((wh) => (
              <TableRow key={wh.id}>
                <TableCell>
                  <Typography fontWeight="medium">{wh.code}</Typography>
                </TableCell>
                <TableCell>{wh.name}</TableCell>
                <TableCell>
                  <Chip label={WAREHOUSE_TYPE_LABELS[wh.type]} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{wh.address || '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={wh.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={wh.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenEdit(wh)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {warehouses.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No warehouses configured. Add your first location to start tracking stock.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            label="Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            required
          />
          <TextField
            label="Code"
            fullWidth
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            sx={{ mb: 2 }}
            required
            helperText="Short identifier e.g. MAIN-WH, SHOP-FL"
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={(e) => setType(e.target.value as WarehouseType)}
            >
              {Object.entries(WAREHOUSE_TYPE_LABELS).map(([val, label]) => (
                <MenuItem key={val} value={val}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Address (optional)"
            fullWidth
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            sx={{ mb: 2 }}
            multiline
            rows={2}
          />
          {editingWarehouse && (
            <FormControlLabel
              control={
                <Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              }
              label="Active"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : editingWarehouse ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
