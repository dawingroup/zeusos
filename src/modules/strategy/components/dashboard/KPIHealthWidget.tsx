// ============================================================================
// KPIHealthWidget COMPONENT
// ZeusOS v2.0 - CEO Strategy Command Module
// Widget showing KPI health summary
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  IconButton,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  Speed as KPIIcon,
  MoreVert as MoreVertIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  TrendingFlat as FlatIcon,
} from '@mui/icons-material';
import { KPIAggregation } from '../../types/aggregation.types';

interface KPIHealthWidgetProps {
  kpiData: KPIAggregation;
  onClick?: () => void;
}

export const KPIHealthWidget: React.FC<KPIHealthWidgetProps> = ({
  kpiData,
  onClick,
}) => {
  const totalKPIs = kpiData.exceedingCount + kpiData.onTargetCount + 
                    kpiData.belowTargetCount + kpiData.criticalCount + kpiData.noDataCount;
  
  const healthPercentage = totalKPIs > 0 
    ? ((kpiData.exceedingCount + kpiData.onTargetCount) / totalKPIs) * 100 
    : 0;
  
  const getHealthColor = () => {
    if (healthPercentage >= 80) return 'success.main';
    if (healthPercentage >= 60) return 'warning.main';
    return 'error.main';
  };
  
  return (
    <Card>
      <CardHeader
        avatar={<KPIIcon color="primary" />}
        title={
          <Typography variant="h6" fontWeight="bold">
            KPI Health
          </Typography>
        }
        subheader={`${totalKPIs} Active KPIs`}
        action={
          <IconButton size="small" onClick={onClick}>
            <MoreVertIcon />
          </IconButton>
        }
        sx={{ pb: 0 }}
      />
      <CardContent>
        {/* Health Score */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h2" fontWeight="bold" color={getHealthColor()}>
            {healthPercentage.toFixed(0)}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            KPIs Meeting Target
          </Typography>
        </Box>
        
        {/* Distribution */}
        <Grid container spacing={1} sx={{ textAlign: 'center', mb: 2 }}>
          <Grid {...{ item: true, xs: 2.4 } as any}>
            <Tooltip title="Exceeding Target">
              <Box>
                <Typography variant="h6" fontWeight="bold" color="success.dark">
                  {kpiData.exceedingCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Exceed
                </Typography>
              </Box>
            </Tooltip>
          </Grid>
          <Grid {...{ item: true, xs: 2.4 } as any}>
            <Tooltip title="On Target">
              <Box>
                <Typography variant="h6" fontWeight="bold" color="success.main">
                  {kpiData.onTargetCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  On Target
                </Typography>
              </Box>
            </Tooltip>
          </Grid>
          <Grid {...{ item: true, xs: 2.4 } as any}>
            <Tooltip title="Below Target">
              <Box>
                <Typography variant="h6" fontWeight="bold" color="warning.main">
                  {kpiData.belowTargetCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Below
                </Typography>
              </Box>
            </Tooltip>
          </Grid>
          <Grid {...{ item: true, xs: 2.4 } as any}>
            <Tooltip title="Critical">
              <Box>
                <Typography variant="h6" fontWeight="bold" color="error.main">
                  {kpiData.criticalCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Critical
                </Typography>
              </Box>
            </Tooltip>
          </Grid>
          <Grid {...{ item: true, xs: 2.4 } as any}>
            <Tooltip title="No Data">
              <Box>
                <Typography variant="h6" fontWeight="bold" color="text.disabled">
                  {kpiData.noDataCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  No Data
                </Typography>
              </Box>
            </Tooltip>
          </Grid>
        </Grid>
        
        {/* Trend Summary */}
        <Box sx={{ display: 'flex', justifyContent: 'space-around', pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <UpIcon color="success" fontSize="small" />
            <Typography variant="body2">
              {kpiData.improvingCount} Improving
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FlatIcon color="action" fontSize="small" />
            <Typography variant="body2">
              {kpiData.stableCount} Stable
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DownIcon color="error" fontSize="small" />
            <Typography variant="body2">
              {kpiData.decliningCount} Declining
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default KPIHealthWidget;
