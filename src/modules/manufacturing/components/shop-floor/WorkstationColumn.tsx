/**
 * WorkstationColumn — Single workstation card for the workstation view
 */

import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import { Activity } from 'lucide-react';
import type { Workstation, ManufacturingOrderMES } from '../../types';
import { WORKSTATION_TYPE_LABELS } from '../../types';
import { OrderKanbanCard } from './OrderKanbanCard';
import type { MOProjectSalesOrderGroup } from '../../utils/moGrouping';

interface WorkstationColumnProps {
  workstation: Workstation;
  orders: ManufacturingOrderMES[];
  groupedOrders: MOProjectSalesOrderGroup<ManufacturingOrderMES>[];
  onOrderClick: (order: ManufacturingOrderMES) => void;
}

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  operational: 'success',
  setup: 'warning',
  maintenance: 'error',
  offline: 'default',
};

export const WorkstationColumn: React.FC<WorkstationColumnProps> = ({
  workstation,
  orders,
  groupedOrders,
  onOrderClick,
}) => {
  const utilization = workstation.maxConcurrentJobs > 0
    ? Math.round((workstation.currentActiveJobs / workstation.maxConcurrentJobs) * 100)
    : 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        minWidth: 260,
        maxWidth: 300,
        flex: '0 0 280px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {workstation.name}
          </Typography>
          <Chip
            label={workstation.status}
            size="small"
            color={STATUS_COLORS[workstation.status]}
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {WORKSTATION_TYPE_LABELS[workstation.type]} — {workstation.code}
        </Typography>

        {/* Capacity bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Activity size={14} />
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={utilization}
              color={utilization >= 90 ? 'error' : utilization >= 70 ? 'warning' : 'primary'}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
          <Typography variant="caption">
            {workstation.currentActiveJobs}/{workstation.maxConcurrentJobs}
          </Typography>
        </Box>
      </Box>

      {/* Orders */}
      <Box
        sx={{
          flex: 1,
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 350px)',
        }}
      >
        {orders.length === 0 ? (
          <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
            No active orders
          </Typography>
        ) : (
          groupedOrders.map((group) => (
            <Box key={group.key}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, px: 0.5 }}>
                {group.projectCode || group.projectName} / {group.salesOrderId ?? 'No SO'}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.orders.map((order) => (
                  <OrderKanbanCard
                    key={order.id}
                    order={order}
                    onClick={onOrderClick}
                  />
                ))}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
};
