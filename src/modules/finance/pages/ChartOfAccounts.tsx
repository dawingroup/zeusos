// ============================================================================
// ChartOfAccounts PAGE
// ZeusOS v2.0 - Financial Management Module
// Main page for managing Chart of Accounts
// ============================================================================

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  Alert,
  Tooltip,
  Divider,
  Grid,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAuth } from '@/shared/hooks/useAuth';
import { AccountTree } from '../components/accounts/AccountTree';
import { AccountCard } from '../components/accounts/AccountCard';
import { AccountForm } from '../components/accounts/AccountForm';
import { useAccountTree, useAccounts } from '../hooks/useAccounts';
import { Account, AccountCreateInput, AccountUpdateInput, AccountTreeNode } from '../types/account.types';
import {
  AccountType,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_COLORS,
} from '../constants/account.constants';

type ViewMode = 'tree' | 'list';
type TabValue = 'all' | AccountType;

export const ChartOfAccounts: React.FC = () => {
  useAuth();
  const companyId = 'dawinos'; // In production, from context

  // View state
  const [_viewMode, _setViewMode] = useState<ViewMode>('tree');
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Data hooks
  const {
    tree,
    loading: treeLoading,
    error: treeError,
    refresh: refreshTree,
    expandedIds,
    toggleNode,
    expandNode,
    collapseNode,
  } = useAccountTree({ companyId, autoFetch: !!companyId });

  const {
    accounts,
    loading: accountsLoading,
    error: accountsError,
    refresh: refreshAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
  } = useAccounts({
    companyId,
    filter: activeTab !== 'all' ? { types: [activeTab] } : undefined,
    autoFetch: !!companyId,
  });

  const loading = treeLoading || accountsLoading;
  const error = treeError || accountsError;

  // Filter tree by type
  const filteredTree = activeTab === 'all'
    ? tree
    : tree.filter((node) => node.type === activeTab);

  // Filter by search
  const searchFilteredTree = searchQuery
    ? filteredTree.filter((node) => {
        const searchLower = searchQuery.toLowerCase();
        const matchesNode = (n: AccountTreeNode): boolean =>
          n.code.toLowerCase().includes(searchLower) ||
          n.name.toLowerCase().includes(searchLower) ||
          n.children.some(matchesNode);
        return matchesNode(node);
      })
    : filteredTree;

  // Handlers
  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue);
  };

  const handleNodeSelect = useCallback((node: AccountTreeNode) => {
    const account = accounts.find((a) => a.id === node.id);
    setSelectedAccount(account || null);
  }, [accounts]);

  const handleCreateSubmit = useCallback(async (data: AccountCreateInput | AccountUpdateInput) => {
    setFormLoading(true);
    setFormError(null);
    try {
      await createAccount(data as AccountCreateInput);
      setCreateDialogOpen(false);
      refreshTree();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setFormLoading(false);
    }
  }, [createAccount, refreshTree]);

  const handleEditSubmit = useCallback(async (data: AccountCreateInput | AccountUpdateInput) => {
    if (!selectedAccount) return;
    setFormLoading(true);
    setFormError(null);
    try {
      await updateAccount(selectedAccount.id, data as AccountUpdateInput);
      setEditDialogOpen(false);
      setSelectedAccount(null);
      refreshTree();
      refreshAccounts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setFormLoading(false);
    }
  }, [selectedAccount, updateAccount, refreshTree, refreshAccounts]);

  const handleExpandAll = useCallback(() => {
    const getAllIds = (nodes: AccountTreeNode[]): string[] => {
      return nodes.flatMap((n) => [n.id, ...getAllIds(n.children)]);
    };
    getAllIds(tree).forEach(expandNode);
  }, [tree, expandNode]);

  const handleCollapseAll = useCallback(() => {
    const getAllIds = (nodes: AccountTreeNode[]): string[] => {
      return nodes.flatMap((n) => [n.id, ...getAllIds(n.children)]);
    };
    getAllIds(tree).forEach(collapseNode);
  }, [tree, collapseNode]);

  const handleRefresh = useCallback(() => {
    refreshTree();
    refreshAccounts();
  }, [refreshTree, refreshAccounts]);

  // Calculate summary stats
  const totalAccounts = accounts.length;
  const headerAccounts = accounts.filter((a) => a.isHeader).length;
  const postableAccounts = accounts.filter((a) => a.isPostable).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Chart of Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your organization&apos;s account structure and hierarchy
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Account
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid {...{item: true, xs: 6, sm: 3} as any}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {loading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : totalAccounts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Accounts
            </Typography>
          </Paper>
        </Grid>
        <Grid {...{item: true, xs: 6, sm: 3} as any}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" color="secondary">
              {loading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : headerAccounts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Header Accounts
            </Typography>
          </Paper>
        </Grid>
        <Grid {...{item: true, xs: 6, sm: 3} as any}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" color="success.main">
              {loading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : postableAccounts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Postable Accounts
            </Typography>
          </Paper>
        </Grid>
        <Grid {...{item: true, xs: 6, sm: 3} as any}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              {loading ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : 5}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Account Types
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error.message}
        </Alert>
      )}

      {/* Main Content */}
      <Paper>
        {/* Toolbar */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <TextField
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ flex: 1 }} />

            {/* View Controls */}
            <Tooltip title="Expand All">
              <IconButton onClick={handleExpandAll} size="small">
                <ExpandAllIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Collapse All">
              <IconButton onClick={handleCollapseAll} size="small">
                <CollapseAllIcon />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="Filter">
              <IconButton
                onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                size="small"
              >
                <FilterIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export">
              <IconButton size="small">
                <ExportIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Import">
              <IconButton size="small">
                <ImportIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton size="small">
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  All Accounts
                  <Chip label={accounts.length} size="small" />
                </Box>
              }
              value="all"
            />
            {Object.entries(ACCOUNT_TYPES).map(([key, value]) => (
              <Tab
                key={key}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: ACCOUNT_TYPE_COLORS[value],
                      }}
                    />
                    {ACCOUNT_TYPE_LABELS[value]}
                    <Chip
                      label={accounts.filter((a) => a.type === value).length}
                      size="small"
                    />
                  </Box>
                }
                value={value}
              />
            ))}
          </Tabs>
        </Box>

        {/* Account Tree */}
        <Box sx={{ minHeight: 400 }}>
          <AccountTree
            nodes={searchFilteredTree}
            expandedIds={expandedIds}
            onToggle={toggleNode}
            onSelect={handleNodeSelect}
            selectedId={selectedAccount?.id}
            showBalances
            loading={loading}
          />
        </Box>
      </Paper>

      {/* Selected Account Card */}
      {selectedAccount && (
        <Paper sx={{ mt: 3, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="h6">Selected Account</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setEditDialogOpen(true)}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to archive this account?')) {
                    await deleteAccount(selectedAccount.id);
                    setSelectedAccount(null);
                    refreshTree();
                  }
                }}
              >
                Archive
              </Button>
            </Box>
          </Box>
          <AccountCard account={selectedAccount} showBalance />
        </Paper>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuItem onClick={() => setFilterMenuAnchor(null)}>
          Show All
        </MenuItem>
        <MenuItem onClick={() => setFilterMenuAnchor(null)}>
          Headers Only
        </MenuItem>
        <MenuItem onClick={() => setFilterMenuAnchor(null)}>
          Postable Only
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => setFilterMenuAnchor(null)}>
          Active Only
        </MenuItem>
        <MenuItem onClick={() => setFilterMenuAnchor(null)}>
          With Balance
        </MenuItem>
      </Menu>

      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Account</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <AccountForm
              mode="create"
              accounts={accounts}
              onSubmit={handleCreateSubmit}
              onCancel={() => setCreateDialogOpen(false)}
              loading={formLoading}
              error={formError}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Account</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {selectedAccount && (
              <AccountForm
                mode="edit"
                account={selectedAccount}
                accounts={accounts}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditDialogOpen(false)}
                loading={formLoading}
                error={formError}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ChartOfAccounts;
