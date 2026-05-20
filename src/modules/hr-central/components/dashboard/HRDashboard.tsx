/**
 * HR Dashboard Component - DawinOS v2.0
 * Main HR dashboard showing key metrics and quick access
 */

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  BeachAccess as LeaveIcon,
  ExitToApp as ExitIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';

import { useEmployeeStats, useExpiringProbations } from '../../hooks/useEmployee';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down';
  };
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  onClick,
}) => {
  const TrendIcon = trend?.direction === 'up' ? TrendingUpIcon : TrendingDownIcon;
  const trendColor =
    trend?.direction === 'up' ? 'var(--rag-green)' : 'var(--rag-red)';

  const inner = (
    <div
      className="flex flex-col gap-1 rounded-[10px] border bg-[var(--bg-surface)] overflow-hidden"
      style={{
        padding: 'var(--pad-card)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          {title}
        </span>
        <span
          className="p-1.5 rounded-md grid place-items-center shrink-0"
          style={{ backgroundColor: 'var(--accent-soft)', color: color || 'var(--accent)' }}
        >
          {icon}
        </span>
      </div>
      <div
        className="text-[26px] font-semibold tabular-nums mt-1"
        style={{ color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--fg-secondary)' }}>
          {subtitle}
        </div>
      )}
      {trend && (
        <div
          className="inline-flex items-center gap-1 mt-1 text-[12px] font-medium tabular-nums"
          style={{ color: trendColor }}
        >
          <TrendIcon className="h-3 w-3" />
          {trend.value}% {trend.label}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left w-full">
        {inner}
      </button>
    );
  }
  return inner;
};

export const HRDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { stats, loading: statsLoading, error: statsError } = useEmployeeStats();
  const { employees: expiringProbations, loading: probationsLoading } = useExpiringProbations(30);

  // Loading state
  if (statsLoading) {
    return (
      <Box>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i} {...({} as any)}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={300} />
      </Box>
    );
  }

  // Error state
  if (statsError) {
    return (
      <Alert severity="error">
        Error loading dashboard: {statsError.message}
      </Alert>
    );
  }

  const onLeaveCount = stats?.byStatus?.on_leave || 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        HR Dashboard
      </Typography>

      {/* Stat cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3} {...({} as any)}>
          <StatCard
            title="Total Employees"
            value={stats?.totalEmployees || 0}
            subtitle={`${stats?.byStatus?.active || 0} active`}
            icon={<PeopleIcon />}
            color="#1976d2"
            onClick={() => navigate('/hr/employees')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} {...({} as any)}>
          <StatCard
            title="New Hires"
            value={stats?.newHiresCount || 0}
            subtitle="Last 30 days"
            icon={<PersonAddIcon />}
            color="#4caf50"
            onClick={() => navigate('/hr/employees?filter=new')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} {...({} as any)}>
          <StatCard
            title="On Leave"
            value={onLeaveCount}
            subtitle="Currently away"
            icon={<LeaveIcon />}
            color="#ff9800"
            onClick={() => navigate('/hr/employees?status=on_leave')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} {...({} as any)}>
          <StatCard
            title="Exits"
            value={stats?.exitCount || 0}
            subtitle="Last 30 days"
            icon={<ExitIcon />}
            color="#f44336"
            trend={
              stats?.turnoverRate
                ? {
                    value: Math.round(stats.turnoverRate * 100) / 100,
                    label: 'turnover rate',
                    direction: stats.turnoverRate > 5 ? 'down' : 'up',
                  }
                : undefined
            }
          />
        </Grid>
      </Grid>

      {/* Probations ending soon */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6">
              Probations Ending Soon
            </Typography>
            <Chip
              label={expiringProbations.length}
              size="small"
              color="warning"
            />
          </Box>

          {probationsLoading ? (
            <Box>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} height={60} sx={{ mb: 1 }} />
              ))}
            </Box>
          ) : expiringProbations.length === 0 ? (
            <Typography color="text.secondary">
              No probations ending in the next 30 days
            </Typography>
          ) : (
            <List>
              {expiringProbations.slice(0, 5).map(employee => {
                const daysLeft = employee.employmentDates?.probationEndDate
                  ? differenceInDays(employee.employmentDates.probationEndDate.toDate(), new Date())
                  : null;

                return (
                  <ListItem
                    key={employee.id}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/hr/employees/${employee.id}`)}
                  >
                    <ListItemAvatar>
                      <Avatar src={employee.photoUrl || undefined}>
                        {employee.firstName?.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${employee.firstName} ${employee.lastName}`}
                      secondary={employee.position?.title}
                    />
                    <Chip
                      label={
                        daysLeft !== null
                          ? daysLeft <= 0
                            ? 'Overdue'
                            : `${daysLeft} days left`
                          : 'Unknown'
                      }
                      size="small"
                      color={daysLeft !== null && daysLeft <= 7 ? 'error' : 'warning'}
                    />
                  </ListItem>
                );
              })}
            </List>
          )}

          {expiringProbations.length > 5 && (
            <Typography
              variant="body2"
              color="primary"
              sx={{ cursor: 'pointer', mt: 2 }}
              onClick={() => navigate('/hr/employees?status=probation')}
            >
              View all {expiringProbations.length} probations
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default HRDashboard;
