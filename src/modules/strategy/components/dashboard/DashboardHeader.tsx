// ============================================================================
// DashboardHeader COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Header component with entity selector and period controls
// ============================================================================

import React from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  ButtonGroup,
  Chip,
  SelectChangeEvent,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Share as ShareIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { AggregationLevel, AGGREGATION_LEVEL_LABELS } from '../../constants/aggregation.constants';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  entityId: string;
  entityName: string;
  level: AggregationLevel;
  fiscalYear: number;
  quarter?: number;
  onEntityChange?: (entityId: string) => void;
  onPeriodChange?: (year: number, quarter?: number) => void;
  entities?: Array<{ id: string; name: string; level: AggregationLevel }>;
  showExportActions?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  entityId,
  entityName: _entityName,
  level,
  fiscalYear,
  quarter,
  onEntityChange,
  onPeriodChange,
  entities = [],
  showExportActions = true,
}) => {
  const currentYear = new Date().getMonth() >= 6 
    ? new Date().getFullYear() + 1 
    : new Date().getFullYear();
  
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const quarters = [1, 2, 3, 4];
  
  const handleYearChange = (event: SelectChangeEvent<number>) => {
    onPeriodChange?.(event.target.value as number, quarter);
  };
  
  const handleQuarterChange = (event: SelectChangeEvent<number | string>) => {
    const value = event.target.value;
    onPeriodChange?.(fiscalYear, value === 'full' ? undefined : (value as number));
  };
  
  const handleEntityChange = (event: SelectChangeEvent<string>) => {
    onEntityChange?.(event.target.value);
  };
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', md: 'center' },
        gap: 2,
        mb: 3,
      }}
    >
      {/* Title Section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="h4" fontWeight="bold">
            {title}
          </Typography>
          <Chip
            label={AGGREGATION_LEVEL_LABELS[level]}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
        {subtitle && (
          <Typography variant="body1" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      
      {/* Controls Section */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
        }}
      >
        {/* Entity Selector */}
        {entities.length > 0 && onEntityChange && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Entity</InputLabel>
            <Select
              value={entityId}
              onChange={handleEntityChange}
              label="Entity"
            >
              {entities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        
        {/* Period Selectors */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={fiscalYear}
              onChange={handleYearChange}
              label="Year"
            >
              {years.map((year) => (
                <MenuItem key={year} value={year}>
                  FY{year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={quarter || 'full'}
              onChange={handleQuarterChange}
              label="Period"
            >
              <MenuItem value="full">Full Year</MenuItem>
              {quarters.map((q) => (
                <MenuItem key={q} value={q}>
                  Q{q}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        
        {/* Export Actions */}
        {showExportActions && (
          <ButtonGroup variant="outlined" size="small">
            <Button startIcon={<DownloadIcon />}>Export</Button>
            <Button startIcon={<ShareIcon />}>Share</Button>
            <Button startIcon={<PrintIcon />}>Print</Button>
          </ButtonGroup>
        )}
      </Box>
    </Box>
  );
};

export default DashboardHeader;
