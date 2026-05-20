// ============================================================================
// StrategicPrioritiesWidget COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Widget showing strategic pillars and priorities progress
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  Flag as FlagIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { PillarProgress } from '../../types/aggregation.types';

interface StrategicPrioritiesWidgetProps {
  pillars: PillarProgress[];
  onPillarClick?: (pillarId: string) => void;
  maxItems?: number;
}

export const StrategicPrioritiesWidget: React.FC<StrategicPrioritiesWidgetProps> = ({
  pillars,
  onPillarClick,
  maxItems = 5,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'on_track':
        return <FlagIcon color="primary" fontSize="small" />;
      case 'at_risk':
        return <WarningIcon color="warning" fontSize="small" />;
      case 'delayed':
        return <ErrorIcon color="error" fontSize="small" />;
      default:
        return <FlagIcon color="action" fontSize="small" />;
    }
  };
  
  const getProgressColor = (_progress: number, status: string): 'success' | 'primary' | 'warning' | 'error' | 'inherit' => {
    if (status === 'completed') return 'success';
    if (status === 'on_track') return 'primary';
    if (status === 'at_risk') return 'warning';
    if (status === 'delayed') return 'error';
    return 'inherit';
  };
  
  const displayedPillars = pillars.slice(0, maxItems);
  
  return (
    <Card>
      <CardHeader
        title={
          <Typography variant="h6" fontWeight="bold">
            Strategic Priorities
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
        <List disablePadding>
          {displayedPillars.map((pillar, index) => (
            <ListItem
              key={pillar.pillarId}
              disablePadding
              sx={{
                py: 1.5,
                borderBottom: index < displayedPillars.length - 1 ? 1 : 0,
                borderColor: 'divider',
                cursor: onPillarClick ? 'pointer' : 'default',
                '&:hover': onPillarClick ? { bgcolor: 'action.hover' } : {},
              }}
              onClick={() => onPillarClick?.(pillar.pillarId)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {getStatusIcon(pillar.status)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight="medium" noWrap sx={{ flex: 1 }}>
                      {pillar.pillarName}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" sx={{ ml: 1 }}>
                      {pillar.progress.toFixed(0)}%
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box>
                    <LinearProgress
                      variant="determinate"
                      value={pillar.progress}
                      color={getProgressColor(pillar.progress, pillar.status)}
                      sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {pillar.completedObjectives} of {pillar.objectivesCount} objectives complete
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
        
        {pillars.length > maxItems && (
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }}>
              View all {pillars.length} priorities
            </Typography>
          </Box>
        )}
        
        {pillars.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No strategic priorities defined
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default StrategicPrioritiesWidget;
