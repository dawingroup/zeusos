// ============================================================================
// PerformanceHeatmap COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Heatmap visualization of performance across entities and domains
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  PerformanceHeatmap as PerformanceHeatmapType,
  HeatmapCell,
} from '../../types/aggregation.types';
import {
  PERFORMANCE_RATING_COLORS,
  PERFORMANCE_RATING_LABELS,
} from '../../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface PerformanceHeatmapProps {
  heatmap: PerformanceHeatmapType;
  cellSize?: number;
  showLabels?: boolean;
  onCellClick?: (cell: HeatmapCell) => void;
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export const PerformanceHeatmap: React.FC<PerformanceHeatmapProps> = ({
  heatmap,
  cellSize = 60,
  showLabels = true,
  onCellClick,
}) => {
  const getCellColor = (value: number): string => {
    if (value >= 90) return PERFORMANCE_RATING_COLORS.exceptional;
    if (value >= 80) return PERFORMANCE_RATING_COLORS.strong;
    if (value >= 60) return PERFORMANCE_RATING_COLORS.on_track;
    if (value >= 40) return PERFORMANCE_RATING_COLORS.needs_attention;
    if (value >= 20) return PERFORMANCE_RATING_COLORS.at_risk;
    return PERFORMANCE_RATING_COLORS.critical;
  };

  const getCell = (rowId: string, colId: string): HeatmapCell | undefined => {
    return heatmap.cells.find(c => c.rowId === rowId && c.columnId === colId);
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Performance Heatmap
        </Typography>

        <Box sx={{ overflowX: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `150px repeat(${heatmap.columns.length}, ${cellSize}px)`,
              gap: 0.5,
            }}
          >
            {/* Header Row */}
            <Box /> {/* Empty corner cell */}
            {heatmap.columns.map((col) => (
              <Box
                key={col.id}
                sx={{
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                }}
              >
                <Typography variant="caption" fontWeight="bold" noWrap>
                  {col.label}
                </Typography>
              </Box>
            ))}

            {/* Data Rows */}
            {heatmap.rows.map((row) => (
              <React.Fragment key={row.id}>
                {/* Row Label */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" noWrap>
                    {row.label}
                  </Typography>
                </Box>

                {/* Data Cells */}
                {heatmap.columns.map((col) => {
                  const cell = getCell(row.id, col.id);
                  if (!cell) {
                    return (
                      <Box
                        key={`${row.id}-${col.id}`}
                        sx={{
                          height: cellSize,
                          bgcolor: 'grey.200',
                          borderRadius: 1,
                        }}
                      />
                    );
                  }

                  return (
                    <Tooltip
                      key={`${row.id}-${col.id}`}
                      title={
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {cell.tooltip || `${row.label} - ${col.label}`}
                          </Typography>
                          <Typography variant="caption">
                            Score: {cell.value.toFixed(1)} ({PERFORMANCE_RATING_LABELS[cell.rating]})
                          </Typography>
                        </Box>
                      }
                    >
                      <Box
                        sx={{
                          height: cellSize,
                          bgcolor: getCellColor(cell.value),
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: onCellClick ? 'pointer' : 'default',
                          transition: 'transform 0.2s',
                          '&:hover': {
                            transform: 'scale(1.05)',
                            zIndex: 1,
                          },
                        }}
                        onClick={() => onCellClick?.(cell)}
                      >
                        {showLabels && (
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{ color: 'white' }}
                          >
                            {cell.value.toFixed(0)}
                          </Typography>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </React.Fragment>
            ))}
          </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
          {Object.entries(PERFORMANCE_RATING_COLORS).map(([rating, color]) => (
            <Box key={rating} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  bgcolor: color,
                  borderRadius: 0.5,
                }}
              />
              <Typography variant="caption">
                {PERFORMANCE_RATING_LABELS[rating as keyof typeof PERFORMANCE_RATING_LABELS]}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default PerformanceHeatmap;
