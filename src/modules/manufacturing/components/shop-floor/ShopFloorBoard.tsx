/**
 * ShopFloorBoard — Main shop floor view with Kanban/Workstation toggle
 */

import React from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
} from '@mui/material';
import { LayoutGrid, Factory, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ManufacturingOrderMES } from '../../types';
import { useShopFloor } from '../../hooks/useShopFloor';
import { OrderKanbanView } from './OrderKanbanView';
import { WorkstationView } from './WorkstationView';

interface ShopFloorBoardProps {
  subsidiaryId: string;
  organizationId: string;
}

export const ShopFloorBoard: React.FC<ShopFloorBoardProps> = ({
  subsidiaryId,
  organizationId,
}) => {
  const navigate = useNavigate();
  const {
    orders,
    workstations,
    isLoading,
    viewMode,
    setViewMode,
    activeFilters,
    setFilters,
    ordersByStatus,
    ordersByWorkstation,
    groupedByStatus,
    groupedByWorkstation,
  } = useShopFloor(subsidiaryId, organizationId);

  const handleOrderClick = (order: ManufacturingOrderMES) => {
    navigate(`/manufacturing/orders/${order.id}`);
  };

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          Shop Floor
        </Typography>

        {/* View mode toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="kanban">
            <LayoutGrid size={16} />
            <Box component="span" sx={{ ml: 0.5 }}>Kanban</Box>
          </ToggleButton>
          <ToggleButton value="workstation">
            <Factory size={16} />
            <Box component="span" sx={{ ml: 0.5 }}>Stations</Box>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Search */}
        <TextField
          size="small"
          placeholder="Search orders..."
          value={activeFilters.search ?? ''}
          onChange={(e) => setFilters({ ...activeFilters, search: e.target.value || undefined })}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} />
              </InputAdornment>
            ),
          }}
          sx={{ width: 220 }}
        />

        {/* Priority filter */}
        <FormControl size="small" sx={{ width: 130 }}>
          <InputLabel>Priority</InputLabel>
          <Select
            value={activeFilters.priority ?? ''}
            label="Priority"
            onChange={(e) => setFilters({
              ...activeFilters,
              priority: e.target.value as ManufacturingOrderMES['priority'] || undefined,
            })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="urgent">Urgent</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="low">Low</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip label={`${orders.length} orders`} size="small" />
        <Chip label={`${workstations.length} stations`} size="small" variant="outlined" />
        {activeFilters.priority && (
          <Chip
            label={`Priority: ${activeFilters.priority}`}
            size="small"
            onDelete={() => setFilters({ ...activeFilters, priority: undefined })}
          />
        )}
        {activeFilters.search && (
          <Chip
            label={`Search: "${activeFilters.search}"`}
            size="small"
            onDelete={() => setFilters({ ...activeFilters, search: undefined })}
          />
        )}
      </Stack>

      {/* Board */}
      {isLoading ? (
        <Typography color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
          Loading shop floor data...
        </Typography>
      ) : orders.length === 0 && workstations.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Factory size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Shop floor not set up yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Start by creating workstations, then manufacturing orders will appear here.
          </Typography>
          <Box
            component="button"
            onClick={() => navigate('/manufacturing/workstations')}
            sx={{
              px: 3, py: 1.5,
              bgcolor: 'primary.main', color: 'white',
              border: 'none', borderRadius: 2,
              cursor: 'pointer', fontWeight: 600, fontSize: 14,
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            Set Up Workstations
          </Box>
        </Box>
      ) : viewMode === 'kanban' ? (
        <OrderKanbanView
          ordersByStatus={ordersByStatus}
          groupedByStatus={groupedByStatus}
          onOrderClick={handleOrderClick}
        />
      ) : (
        <WorkstationView
          workstations={workstations}
          ordersByWorkstation={ordersByWorkstation}
          groupedByWorkstation={groupedByWorkstation}
          onOrderClick={handleOrderClick}
        />
      )}
    </Box>
  );
};
