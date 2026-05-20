// ============================================================================
// PerformanceHierarchy COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Hierarchical tree view of organizational performance
// ============================================================================

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Collapse,
  IconButton,
  LinearProgress,
  Chip,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Business as BusinessIcon,
  AccountTree as AccountTreeIcon,
  Group as GroupIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  PerformanceHierarchy as PerformanceHierarchyType,
  PerformanceNode,
} from '../../types/aggregation.types';
import {
  AggregationLevel,
  AGGREGATION_LEVEL_LABELS,
  PERFORMANCE_RATING_COLORS,
  PERFORMANCE_RATING_LABELS,
  HEALTH_INDICATOR_COLORS,
} from '../../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface PerformanceHierarchyProps {
  hierarchy: PerformanceHierarchyType;
  onNodeClick?: (node: PerformanceNode) => void;
  expandedByDefault?: boolean;
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export const PerformanceHierarchy: React.FC<PerformanceHierarchyProps> = ({
  hierarchy,
  onNodeClick,
  expandedByDefault = true,
}) => {
  const getLevelIcon = (level: AggregationLevel) => {
    switch (level) {
      case 'group':
        return <BusinessIcon />;
      case 'subsidiary':
        return <AccountTreeIcon />;
      case 'department':
      case 'team':
        return <GroupIcon />;
      case 'individual':
        return <PersonIcon />;
      default:
        return <BusinessIcon />;
    }
  };

  const HierarchyNode: React.FC<{
    node: PerformanceNode;
    depth: number;
    defaultExpanded: boolean;
  }> = ({ node, depth, defaultExpanded }) => {
    const [expanded, setExpanded] = useState(defaultExpanded && depth < 2);
    const hasChildren = node.children.length > 0;

    return (
      <Box sx={{ ml: depth * 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 1,
            px: 1,
            borderRadius: 1,
            cursor: onNodeClick ? 'pointer' : 'default',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
          onClick={() => onNodeClick?.(node)}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <IconButton
              size="small"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 32 }} />
          )}

          {/* Level Icon */}
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: HEALTH_INDICATOR_COLORS[node.health],
              mr: 1.5,
            }}
          >
            {getLevelIcon(node.level)}
          </Avatar>

          {/* Name and Level */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" fontWeight={depth === 0 ? 'bold' : 'medium'} noWrap>
              {node.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {AGGREGATION_LEVEL_LABELS[node.level]}
              {hasChildren && ` • ${node.childCount} ${node.childCount === 1 ? 'unit' : 'units'}`}
            </Typography>
          </Box>

          {/* Score Bar */}
          <Box sx={{ width: 120, mx: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Score
              </Typography>
              <Typography variant="caption" fontWeight="bold">
                {node.combinedScore.toFixed(1)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={node.combinedScore}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  bgcolor: PERFORMANCE_RATING_COLORS[node.rating],
                },
              }}
            />
          </Box>

          {/* Rating Chip */}
          <Tooltip title={PERFORMANCE_RATING_LABELS[node.rating]}>
            <Chip
              label={node.combinedScore.toFixed(0)}
              size="small"
              sx={{
                minWidth: 48,
                bgcolor: PERFORMANCE_RATING_COLORS[node.rating],
                color: 'white',
                fontWeight: 'bold',
              }}
            />
          </Tooltip>
        </Box>

        {/* Children */}
        <Collapse in={expanded}>
          {node.children.map((child) => (
            <HierarchyNode
              key={child.id}
              node={child}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </Collapse>
      </Box>
    );
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            Organization Performance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hierarchy.totalNodes} units • {hierarchy.depth} levels
          </Typography>
        </Box>

        <HierarchyNode
          node={hierarchy.root}
          depth={0}
          defaultExpanded={expandedByDefault}
        />
      </CardContent>
    </Card>
  );
};

export default PerformanceHierarchy;
