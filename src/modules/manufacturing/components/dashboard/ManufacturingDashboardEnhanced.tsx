/**
 * ManufacturingDashboardEnhanced — Widget-based dashboard for manufacturing overview
 */

import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import type { ManufacturingOrderMES, Workstation } from '../../types';
import { MO_STATUS_MAP } from '../../types';

interface ManufacturingDashboardEnhancedProps {
  orders: ManufacturingOrderMES[];
  workstations: Workstation[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#9e9e9e',
  planned: '#1976d2',
  ready: '#2e7d32',
  in_progress: '#ed6c02',
  on_hold: '#d32f2f',
  quality_review: '#9c27b0',
  completed: '#388e3c',
  cancelled: '#757575',
};

export const ManufacturingDashboardEnhanced: React.FC<ManufacturingDashboardEnhancedProps> = ({
  orders,
  workstations,
}) => {
  // KPI calculations
  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.mesStatus ?? o.status));
  const completedOrders = orders.filter(o => (o.mesStatus ?? o.status) === 'completed');
  const overdueOrders = orders.filter(o => {
    if (!o.dueDate || (o.mesStatus ?? o.status) === 'completed') return false;
    const due = typeof o.dueDate === 'object' && 'toDate' in o.dueDate
      ? (o.dueDate as { toDate: () => Date }).toDate()
      : null;
    return due ? due < new Date() : false;
  });

  const totalDefects = orders.reduce((sum, o) => sum + (o.defectCount ?? 0), 0);

  // Orders by status for pie chart
  const statusCounts = Object.entries(MO_STATUS_MAP).map(([key, label]) => ({
    name: label,
    value: orders.filter(o => (o.mesStatus ?? o.status) === key).length,
    color: STATUS_COLORS[key] ?? '#9e9e9e',
  })).filter(d => d.value > 0);

  // Workstation utilization data
  const wsData = workstations.map(ws => ({
    name: ws.code,
    utilization: ws.maxConcurrentJobs > 0
      ? Math.round((ws.currentActiveJobs / ws.maxConcurrentJobs) * 100)
      : 0,
    queued: ws.queuedStepCount,
  }));

  return (
    <Grid container spacing={3}>
      {/* KPI Cards Row */}
      <Grid size={{ xs: 12 }}>
        <KPIGrid cols={4}>
          <KPICard label="Active Orders" value={activeOrders.length} />
          <KPICard label="Completed" value={completedOrders.length} trend="up" />
          <KPICard
            label="At Risk"
            value={overdueOrders.length}
            trend={overdueOrders.length > 0 ? 'down' : 'flat'}
          />
          <KPICard
            label="Total Defects"
            value={totalDefects}
            trend={totalDefects > 0 ? 'down' : 'flat'}
          />
        </KPIGrid>
      </Grid>

      {/* Orders by Status Pie Chart */}
      <Grid size={{ xs: 12, md: 5 }}>
        <Paper variant="outlined" sx={{ p: 2, height: 320 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Orders by Status
          </Typography>
          {statusCounts.length > 0 ? (
            <SafeResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusCounts}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusCounts.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </SafeResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
              <Typography color="text.secondary">No orders</Typography>
            </Box>
          )}
        </Paper>
      </Grid>

      {/* Workstation Utilization */}
      <Grid size={{ xs: 12, md: 7 }}>
        <Paper variant="outlined" sx={{ p: 2, height: 320 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Workstation Utilization
          </Typography>
          {wsData.length > 0 ? (
            <SafeResponsiveContainer width="100%" height={260}>
              <BarChart data={wsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip />
                <Bar dataKey="utilization" fill="#1976d2" name="Utilization %" />
              </BarChart>
            </SafeResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
              <Typography color="text.secondary">No workstations configured</Typography>
            </Box>
          )}
        </Paper>
      </Grid>

      {/* At Risk Orders Table */}
      <Grid size={{ xs: 12 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            At-Risk & On-Hold Orders
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell>MO #</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Due Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...overdueOrders, ...orders.filter(o => (o.mesStatus ?? o.status) === 'on_hold')]
                  .slice(0, 10)
                  .map((o) => {
                    const dueDate = o.dueDate && typeof o.dueDate === 'object' && 'toDate' in o.dueDate
                      ? (o.dueDate as { toDate: () => Date }).toDate()
                      : null;
                    return (
                      <TableRow key={o.id} hover>
                        <TableCell><strong>{o.moNumber}</strong></TableCell>
                        <TableCell>{o.designItemName}</TableCell>
                        <TableCell>
                          <Chip
                            label={MO_STATUS_MAP[(o.mesStatus ?? o.status) as keyof typeof MO_STATUS_MAP]}
                            size="small"
                            sx={{ bgcolor: STATUS_COLORS[o.mesStatus ?? o.status], color: 'white', fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={o.priority}
                            size="small"
                            color={o.priority === 'urgent' ? 'error' : o.priority === 'high' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{o.completedSteps}/{o.totalSteps}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color={dueDate && dueDate < new Date() ? 'error.main' : 'text.primary'}
                          >
                            {dueDate?.toLocaleDateString() ?? '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {overdueOrders.length === 0 && orders.filter(o => (o.mesStatus ?? o.status) === 'on_hold').length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">No at-risk or on-hold orders</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>
    </Grid>
  );
};

