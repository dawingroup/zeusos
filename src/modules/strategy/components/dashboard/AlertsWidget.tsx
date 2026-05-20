// ============================================================================
// AlertsWidget COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Widget showing performance alerts and notifications
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
  IconButton,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  MoreVert as MoreVertIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';

type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: Date;
  entityType?: string;
  entityId?: string;
}

interface AlertsWidgetProps {
  alerts: Alert[];
  onAlertClick?: (alert: Alert) => void;
  onViewAll?: () => void;
  maxItems?: number;
}

export const AlertsWidget: React.FC<AlertsWidgetProps> = ({
  alerts,
  onAlertClick,
  onViewAll,
  maxItems = 5,
}) => {
  const getAlertIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'success':
        return <SuccessIcon />;
      default:
        return <InfoIcon />;
    }
  };
  
  const getAlertColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'error.main';
      case 'warning':
        return 'warning.main';
      case 'success':
        return 'success.main';
      default:
        return 'info.main';
    }
  };
  
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };
  
  const displayedAlerts = alerts.slice(0, maxItems);
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  
  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              Alerts
            </Typography>
            {criticalCount > 0 && (
              <Chip label={criticalCount} size="small" color="error" />
            )}
            {warningCount > 0 && (
              <Chip label={warningCount} size="small" color="warning" />
            )}
          </Box>
        }
        action={
          <IconButton size="small" onClick={onViewAll}>
            <MoreVertIcon />
          </IconButton>
        }
        sx={{ pb: 0 }}
      />
      <CardContent>
        <List disablePadding>
          {displayedAlerts.map((alert, index) => (
            <ListItem
              key={alert.id}
              disablePadding
              sx={{
                py: 1.5,
                borderBottom: index < displayedAlerts.length - 1 ? 1 : 0,
                borderColor: 'divider',
                cursor: onAlertClick ? 'pointer' : 'default',
                '&:hover': onAlertClick ? { bgcolor: 'action.hover' } : {},
              }}
              onClick={() => onAlertClick?.(alert)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: `${getAlertColor(alert.severity)}20`,
                    color: getAlertColor(alert.severity),
                  }}
                >
                  {getAlertIcon(alert.severity)}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight="medium">
                    {alert.title}
                  </Typography>
                }
                secondary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                      {alert.description}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                      {formatTime(alert.timestamp)}
                    </Typography>
                  </Box>
                }
              />
              {onAlertClick && <ArrowIcon fontSize="small" color="action" />}
            </ListItem>
          ))}
        </List>
        
        {alerts.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <SuccessIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No active alerts
            </Typography>
          </Box>
        )}
        
        {alerts.length > maxItems && (
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Typography 
              variant="body2" 
              color="primary" 
              sx={{ cursor: 'pointer' }}
              onClick={onViewAll}
            >
              View all {alerts.length} alerts
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AlertsWidget;
