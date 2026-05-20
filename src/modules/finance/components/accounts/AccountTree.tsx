// ============================================================================
// AccountTree COMPONENT
// DawinOS v2.0 - Financial Management Module
// Hierarchical tree view of Chart of Accounts
// ============================================================================

import React, { useCallback } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Typography,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ChevronRight as CollapseIcon,
  AccountBalance as AssetIcon,
  CreditCard as LiabilityIcon,
  Business as EquityIcon,
  TrendingUp as RevenueIcon,
  TrendingDown as ExpenseIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { AccountTreeNode } from '../../types/account.types';
import {
  AccountType,
  ACCOUNT_TYPE_COLORS,
  ACCOUNT_STATUS,
} from '../../constants/account.constants';
import { formatCurrency } from '../../constants/currency.constants';

interface AccountTreeProps {
  nodes: AccountTreeNode[];
  expandedIds: Set<string>;
  onToggle: (nodeId: string) => void;
  onSelect?: (node: AccountTreeNode) => void;
  selectedId?: string;
  showBalances?: boolean;
  loading?: boolean;
}

const getAccountIcon = (type: AccountType, isHeader: boolean, isExpanded: boolean) => {
  if (isHeader) {
    return isExpanded ? <FolderOpenIcon /> : <FolderIcon />;
  }
  
  switch (type) {
    case 'asset':
      return <AssetIcon />;
    case 'liability':
      return <LiabilityIcon />;
    case 'equity':
      return <EquityIcon />;
    case 'revenue':
      return <RevenueIcon />;
    case 'expense':
      return <ExpenseIcon />;
    default:
      return <FolderIcon />;
  }
};

interface TreeNodeProps {
  node: AccountTreeNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (nodeId: string) => void;
  onSelect?: (node: AccountTreeNode) => void;
  selectedId?: string;
  showBalances?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  expandedIds,
  onToggle,
  onSelect,
  selectedId,
  showBalances = true,
}) => {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const color = ACCOUNT_TYPE_COLORS[node.type];

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  }, [node.id, onToggle]);

  const handleSelect = useCallback(() => {
    onSelect?.(node);
  }, [node, onSelect]);

  return (
    <>
      <ListItem
        disablePadding
        sx={{ display: 'block' }}
      >
        <ListItemButton
          onClick={handleSelect}
          selected={isSelected}
          sx={{
            pl: 2 + depth * 2,
            py: 0.75,
            '&.Mui-selected': {
              backgroundColor: `${color}15`,
              borderRight: `3px solid ${color}`,
            },
            '&:hover': {
              backgroundColor: `${color}08`,
            },
          }}
        >
          {/* Expand/Collapse Icon */}
          <Box sx={{ width: 28, flexShrink: 0 }}>
            {hasChildren ? (
              <IconButton size="small" onClick={handleToggle} sx={{ p: 0.25 }}>
                {isExpanded ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
              </IconButton>
            ) : null}
          </Box>

          {/* Account Icon */}
          <ListItemIcon sx={{ minWidth: 36, color }}>
            {getAccountIcon(node.type, node.isHeader, isExpanded)}
          </ListItemIcon>

          {/* Account Info */}
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body2"
                  component="span"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 'medium',
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                  }}
                >
                  {node.code}
                </Typography>
                <Typography
                  variant="body2"
                  component="span"
                  sx={{
                    fontWeight: node.isHeader ? 'bold' : 'normal',
                    color: node.status === ACCOUNT_STATUS.INACTIVE ? 'text.disabled' : 'text.primary',
                  }}
                >
                  {node.name}
                </Typography>
                {node.isHeader && (
                  <Chip
                    label="Header"
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
            }
          />

          {/* Balance */}
          {showBalances && node.isPostable && (
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 'medium',
                color: node.balance >= 0 ? 'success.main' : 'error.main',
                minWidth: 100,
                textAlign: 'right',
              }}
            >
              {formatCurrency(node.balance, node.currency)}
            </Typography>
          )}
        </ListItemButton>
      </ListItem>

      {/* Children */}
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedId={selectedId}
                showBalances={showBalances}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export const AccountTree: React.FC<AccountTreeProps> = ({
  nodes,
  expandedIds,
  onToggle,
  onSelect,
  selectedId,
  showBalances = true,
  loading = false,
}) => {
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="text" width={80} />
            <Skeleton variant="text" width={150} sx={{ flex: 1 }} />
            <Skeleton variant="text" width={80} />
          </Box>
        ))}
      </Box>
    );
  }

  if (nodes.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No accounts found
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onSelect={onSelect}
          selectedId={selectedId}
          showBalances={showBalances}
        />
      ))}
    </List>
  );
};

export default AccountTree;
