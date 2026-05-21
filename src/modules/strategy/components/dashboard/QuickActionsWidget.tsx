// ============================================================================
// QuickActionsWidget COMPONENT
// ZeusOS v2.0 - CEO Strategy Command Module
// Widget with quick action buttons for common tasks
// ============================================================================

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Button,
  IconButton,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  Event as MeetingIcon,
  Flag as GoalIcon,
  Speed as KPIIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

interface QuickActionsWidgetProps {
  actions?: QuickAction[];
  onCreateOKR?: () => void;
  onCreateKPI?: () => void;
  onGenerateReport?: () => void;
  onScheduleReview?: () => void;
}

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({
  actions,
  onCreateOKR,
  onCreateKPI,
  onGenerateReport,
  onScheduleReview,
}) => {
  const defaultActions: QuickAction[] = [
    {
      id: 'create-okr',
      label: 'New OKR',
      icon: <GoalIcon />,
      onClick: onCreateOKR || (() => {}),
      color: 'primary',
    },
    {
      id: 'create-kpi',
      label: 'New KPI',
      icon: <KPIIcon />,
      onClick: onCreateKPI || (() => {}),
      color: 'secondary',
    },
    {
      id: 'generate-report',
      label: 'Report',
      icon: <ReportIcon />,
      onClick: onGenerateReport || (() => {}),
      color: 'info',
    },
    {
      id: 'schedule-review',
      label: 'Review',
      icon: <MeetingIcon />,
      onClick: onScheduleReview || (() => {}),
      color: 'success',
    },
  ];
  
  const displayActions = actions || defaultActions;
  
  return (
    <Card>
      <CardHeader
        title={
          <Typography variant="h6" fontWeight="bold">
            Quick Actions
          </Typography>
        }
        action={
          <IconButton size="small">
            <MoreVertIcon />
          </IconButton>
        }
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Grid container spacing={1}>
          {displayActions.map((action) => (
            <Grid {...{ item: true, xs: 6 } as any} key={action.id}>
              <Button
                variant="outlined"
                color={action.color || 'primary'}
                startIcon={action.icon}
                onClick={action.onClick}
                fullWidth
                sx={{
                  py: 1.5,
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                }}
              >
                {action.label}
              </Button>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default QuickActionsWidget;
