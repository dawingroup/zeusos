// ============================================================================
// OKRProgressWidget COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Widget showing OKR progress summary
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  TrackChanges as OKRIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { OKRAggregation } from '../../types/aggregation.types';

interface OKRProgressWidgetProps {
  okrData: OKRAggregation;
  onClick?: () => void;
}

export const OKRProgressWidget: React.FC<OKRProgressWidgetProps> = ({
  okrData,
  onClick,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 70) return '#4CAF50';
    if (score >= 40) return '#FF9800';
    return '#F44336';
  };
  
  const CircularProgressWithLabel: React.FC<{ value: number; label: string; size?: number }> = ({
    value,
    label,
    size = 80,
  }) => (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={Math.min(100, value)}
        size={size}
        thickness={4}
        sx={{ color: getScoreColor(value) }}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {value.toFixed(0)}%
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Box>
  );
  
  return (
    <Card>
      <CardHeader
        avatar={<OKRIcon color="primary" />}
        title={
          <Typography variant="h6" fontWeight="bold">
            OKR Progress
          </Typography>
        }
        subheader={`${okrData.totalObjectives} Objectives • ${okrData.totalKeyResults} Key Results`}
        action={
          <IconButton size="small" onClick={onClick}>
            <MoreVertIcon />
          </IconButton>
        }
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <CircularProgressWithLabel
            value={okrData.averageObjectiveScore * 100}
            label="Avg Score"
            size={100}
          />
        </Box>
        
        <Grid container spacing={1} sx={{ textAlign: 'center' }}>
          <Grid {...{ item: true, xs: 3 } as any}>
            <Typography variant="h5" fontWeight="bold" color="success.main">
              {okrData.completedObjectives}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Completed
            </Typography>
          </Grid>
          <Grid {...{ item: true, xs: 3 } as any}>
            <Typography variant="h5" fontWeight="bold" color="primary.main">
              {okrData.onTrackObjectives}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              On Track
            </Typography>
          </Grid>
          <Grid {...{ item: true, xs: 3 } as any}>
            <Typography variant="h5" fontWeight="bold" color="warning.main">
              {okrData.atRiskObjectives}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              At Risk
            </Typography>
          </Grid>
          <Grid {...{ item: true, xs: 3 } as any}>
            <Typography variant="h5" fontWeight="bold" color="text.disabled">
              {okrData.notStartedObjectives}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Not Started
            </Typography>
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Key Results Progress
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {okrData.completedKeyResults}/{okrData.totalKeyResults}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 0.5, height: 8 }}>
          <Box sx={{ flex: okrData.completedKeyResults || 1, bgcolor: 'success.main', borderRadius: '4px 0 0 4px' }} />
          <Box sx={{ flex: okrData.onTrackKeyResults || 1, bgcolor: 'primary.main' }} />
          <Box sx={{ flex: okrData.atRiskKeyResults || 1, bgcolor: 'warning.main' }} />
          <Box sx={{ flex: Math.max(1, okrData.totalKeyResults - okrData.completedKeyResults - okrData.onTrackKeyResults - okrData.atRiskKeyResults), bgcolor: 'grey.300', borderRadius: '0 4px 4px 0' }} />
        </Box>
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Alignment Score
          </Typography>
          <Tooltip title="How well objectives cascade and align">
            <Typography variant="body2" fontWeight="bold" color="primary">
              {okrData.alignmentScore.toFixed(0)}%
            </Typography>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
};

export default OKRProgressWidget;
