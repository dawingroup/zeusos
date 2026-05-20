/**
 * Employee Filter Drawer Component - DawinOS v2.0
 * Right-side drawer with filter options for employee list
 */

import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  Divider,
  TextField,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

import {
  EmployeeFilters,
  EmploymentStatus,
  EmploymentType,
} from '../../types/employee.types';
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from '../../config/employee.constants';

interface EmployeeFilterDrawerProps {
  open: boolean;
  filters: EmployeeFilters;
  onClose: () => void;
  onApply: (filters: EmployeeFilters) => void;
  onClear: () => void;
}

export const EmployeeFilterDrawer: React.FC<EmployeeFilterDrawerProps> = ({
  open,
  filters,
  onClose,
  onApply,
  onClear,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Local state for filters
  const [localFilters, setLocalFilters] = useState<EmployeeFilters>(filters);

  // Reset local filters when drawer opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Status options
  const statusOptions: EmploymentStatus[] = [
    'active',
    'probation',
    'on_leave',
    'suspended',
    'notice_period',
    'terminated',
    'resigned',
    'retired',
  ];

  // Type options
  const typeOptions: EmploymentType[] = [
    'permanent',
    'contract',
    'probation',
    'part_time',
    'casual',
    'intern',
    'consultant',
  ];

  // Handlers
  const handleStatusToggle = (status: EmploymentStatus) => {
    setLocalFilters(prev => {
      const currentStatuses = prev.employmentStatuses || [];
      const newStatuses = currentStatuses.includes(status)
        ? currentStatuses.filter(s => s !== status)
        : [...currentStatuses, status];
      return { ...prev, employmentStatuses: newStatuses.length > 0 ? newStatuses : undefined };
    });
  };

  const handleTypeToggle = (type: EmploymentType) => {
    setLocalFilters(prev => {
      const currentTypes = prev.employmentTypes || [];
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter(t => t !== type)
        : [...currentTypes, type];
      return { ...prev, employmentTypes: newTypes.length > 0 ? newTypes : undefined };
    });
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalFilters(prev => ({
      ...prev,
      searchQuery: e.target.value || undefined,
    }));
  };

  const handleApply = () => {
    onApply(localFilters);
  };

  const handleClear = () => {
    setLocalFilters({});
    onClear();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: isMobile ? '100%' : 400 },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6">Filter Employees</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Filter content */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {/* Search */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <FormLabel sx={{ mb: 1 }}>Search</FormLabel>
            <TextField
              placeholder="Name, email, employee number..."
              value={localFilters.searchQuery || ''}
              onChange={handleSearchChange}
              size="small"
              fullWidth
            />
          </FormControl>

          <Divider sx={{ my: 2 }} />

          {/* Employment Status */}
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ mb: 1 }}>Employment Status</FormLabel>
            <FormGroup>
              {statusOptions.map(status => (
                <FormControlLabel
                  key={status}
                  control={
                    <Checkbox
                      checked={localFilters.employmentStatuses?.includes(status) || false}
                      onChange={() => handleStatusToggle(status)}
                      size="small"
                    />
                  }
                  label={EMPLOYMENT_STATUS_LABELS[status]}
                />
              ))}
            </FormGroup>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          {/* Employment Type */}
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ mb: 1 }}>Employment Type</FormLabel>
            <FormGroup>
              {typeOptions.map(type => (
                <FormControlLabel
                  key={type}
                  control={
                    <Checkbox
                      checked={localFilters.employmentTypes?.includes(type) || false}
                      onChange={() => handleTypeToggle(type)}
                      size="small"
                    />
                  }
                  label={EMPLOYMENT_TYPE_LABELS[type]}
                />
              ))}
            </FormGroup>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          {/* Boolean toggles */}
          <FormControl component="fieldset">
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={localFilters.isManagement === true}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setLocalFilters(prev => ({
                        ...prev,
                        isManagement: e.target.checked ? true : undefined,
                      }));
                    }}
                  />
                }
                label="Management Only"
              />
            </FormGroup>
          </FormControl>
        </Box>

        {/* Footer with actions */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button variant="outlined" onClick={handleClear} sx={{ flexGrow: 1 }}>
            Clear All
          </Button>
          <Button variant="contained" onClick={handleApply} sx={{ flexGrow: 1 }}>
            Apply Filters
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};

export default EmployeeFilterDrawer;
