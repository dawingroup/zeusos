/**
 * WorkstationView — Grid of workstation columns showing active orders per station
 */

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import type { Workstation, ManufacturingOrderMES } from '../../types';
import { WorkstationColumn } from './WorkstationColumn';
import { OrderKanbanCard } from './OrderKanbanCard';
import type { MOProjectSalesOrderGroup } from '../../utils/moGrouping';

interface WorkstationViewProps {
  workstations: Workstation[];
  ordersByWorkstation: Record<string, ManufacturingOrderMES[]>;
  groupedByWorkstation: Record<string, MOProjectSalesOrderGroup<ManufacturingOrderMES>[]>;
  onOrderClick: (order: ManufacturingOrderMES) => void;
}

export const WorkstationView: React.FC<WorkstationViewProps> = ({
  workstations,
  ordersByWorkstation,
  groupedByWorkstation,
  onOrderClick,
}) => {
  const unassigned = ordersByWorkstation.unassigned ?? [];

  return (
    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, minHeight: 400 }}>
      {workstations.map((ws) => (
        <WorkstationColumn
          key={ws.id}
          workstation={ws}
          orders={ordersByWorkstation[ws.id] ?? []}
          groupedOrders={groupedByWorkstation[ws.id] ?? []}
          onOrderClick={onOrderClick}
        />
      ))}

      {/* Unassigned column */}
      {unassigned.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            minWidth: 260,
            maxWidth: 300,
            flex: '0 0 280px',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'grey.50',
          }}
        >
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Unassigned ({unassigned.length})
            </Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
            {(groupedByWorkstation.unassigned ?? []).map((group) => (
              <Box key={group.key}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, px: 0.5 }}>
                  {group.projectCode || group.projectName} / {group.salesOrderId ?? 'No SO'}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {group.orders.map((order) => (
                    <OrderKanbanCard key={order.id} order={order} onClick={onOrderClick} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
};
