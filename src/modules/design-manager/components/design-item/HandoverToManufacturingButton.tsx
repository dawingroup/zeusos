/**
 * HandoverToManufacturingButton
 * Shown on design item detail when item is CUSTOM_FURNITURE_MILLWORK at production-ready stage.
 * Validates readiness and creates a Manufacturing Order via the handover service.
 */

import { useState, useMemo } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Chip,
  Typography,
  Box,
  Tooltip,
} from '@mui/material';
import FactoryIcon from '@mui/icons-material/Factory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import type { DesignItem } from '../../types';
import {
  validateHandoverReadiness,
  initiateHandover,
} from '@/modules/manufacturing/services/handoverService';
import { useNavigate } from 'react-router-dom';

interface HandoverToManufacturingButtonProps {
  designItem: DesignItem;
  projectId: string;
  userId: string;
}

export function HandoverToManufacturingButton({
  designItem,
  projectId,
  userId,
}: HandoverToManufacturingButtonProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show for manufactured/millwork sourcing types
  const isManufacturedType =
    designItem.sourcingType === 'CUSTOM_FURNITURE_MILLWORK' ||
    designItem.sourcingType === 'MANUFACTURED';

  const isProductionReady = designItem.currentStage === 'production-ready';

  // All hooks must be called before any early returns (React rules of hooks)
  const validation = useMemo(
    () => validateHandoverReadiness(designItem),
    [designItem],
  );

  // Hide entirely for non-manufactured sourcing types
  if (!isManufacturedType) return null;

  // Already handed over — show link instead
  if (designItem.manufacturingOrderId) return null;

  const handleHandover = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await initiateHandover(projectId, designItem.id, userId, notes);

      if (!result.validation.isReady) {
        setError(result.validation.issues.join('; '));
        setLoading(false);
        return;
      }

      setOpen(false);
      // Navigate to the new manufacturing order
      navigate(`/manufacturing/orders/${result.moId}`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  // Not at production-ready — show disabled button with explanation
  if (!isProductionReady) {
    return (
      <Tooltip title={`Advance to "Production Ready" stage to enable handover`} arrow>
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FactoryIcon />}
            disabled
            sx={{ opacity: 0.6 }}
          >
            Handover to Mfg
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<FactoryIcon />}
        onClick={() => setOpen(true)}
        disabled={!validation.isReady}
      >
        Handover to Mfg
      </Button>

      {!validation.isReady && validation.issues.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {validation.issues.map((issue, i) => (
            <Chip
              key={i}
              label={issue}
              color="error"
              size="small"
              variant="outlined"
              sx={{ mr: 0.5, mb: 0.5 }}
            />
          ))}
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Handover to Manufacturing</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will create a Manufacturing Order with a Bill of Materials
            auto-generated from the design item's parts and costing data.
          </Typography>

          {/* Validation Status */}
          <List dense>
            {validation.isReady && (
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText primary="All readiness checks passed" />
              </ListItem>
            )}
            {validation.issues.map((issue, i) => (
              <ListItem key={`issue-${i}`}>
                <ListItemIcon>
                  <ErrorIcon color="error" />
                </ListItemIcon>
                <ListItemText primary={issue} />
              </ListItem>
            ))}
            {validation.warnings.map((warning, i) => (
              <ListItem key={`warn-${i}`}>
                <ListItemIcon>
                  <WarningIcon color="warning" />
                </ListItemIcon>
                <ListItemText primary={warning} />
              </ListItem>
            ))}
          </List>

          <TextField
            label="Handover Notes"
            multiline
            rows={3}
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special instructions for manufacturing..."
            sx={{ mt: 2 }}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleHandover}
            disabled={loading || !validation.isReady}
            startIcon={loading ? <CircularProgress size={16} /> : <FactoryIcon />}
          >
            {loading ? 'Creating MO...' : 'Create Manufacturing Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
