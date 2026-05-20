/**
 * Employee List Component - DawinOS v2.0
 * Displays employees in table (desktop) or card (mobile) view
 */

import React, { useState, useCallback, useMemo, ChangeEvent } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Chip,
  Avatar,
  Typography,
  Menu,
  MenuItem,
  Checkbox,
  Skeleton,
  Alert,
  Badge,
  useTheme,
  useMediaQuery,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

import {
  EmployeeSummary,
  EmployeeFilters,
  EmployeeSort,
  EmploymentStatus,
} from '../../types/employee.types';
import {
  EMPLOYMENT_STATUS_LABELS,
} from '../../config/employee.constants';
import { useEmployeeList, useEmployeeSearch } from '../../hooks/useEmployee';
import { EmployeeCard, EmployeeCardData } from './EmployeeCard';
import { EmployeeFilterDrawer } from './EmployeeFilterDrawer';
import { StatusChangeDialog, StatusChangeEmployee } from './StatusChangeDialog';

// Status color mapping
const STATUS_COLORS: Record<EmploymentStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  active: 'success',
  probation: 'info',
  suspended: 'error',
  notice_period: 'warning',
  on_leave: 'info',
  terminated: 'error',
  resigned: 'default',
  retired: 'default',
};

// Sortable columns configuration
type SortField = 'fullName' | 'employeeNumber' | 'title' | 'department' | 'status' | 'joiningDate';

const SORTABLE_COLUMNS: Array<{ field: SortField; label: string }> = [
  { field: 'fullName', label: 'Employee' },
  { field: 'employeeNumber', label: 'Employee ID' },
  { field: 'title', label: 'Position' },
  { field: 'department', label: 'Department' },
  { field: 'status', label: 'Status' },
  { field: 'joiningDate', label: 'Joined' },
];

interface EmployeeListProps {
  subsidiaryId?: string;
  departmentId?: string;
  initialFilters?: Partial<EmployeeFilters>;
  onEmployeeSelect?: (employee: EmployeeSummary) => void;
  showAddButton?: boolean;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  subsidiaryId,
  departmentId,
  initialFilters = {},
  onEmployeeSelect,
  showAddButton = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<EmployeeFilters>({
    subsidiaryIds: subsidiaryId ? [subsidiaryId] as any : initialFilters.subsidiaryIds,
    departmentIds: departmentId ? [departmentId] as any : initialFilters.departmentIds,
    ...initialFilters,
  });
  const [sort, setSort] = useState<EmployeeSort>({
    field: 'fullName',
    direction: 'asc',
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
  const [contextMenuEmployee, setContextMenuEmployee] = useState<EmployeeSummary | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogEmployee, setStatusDialogEmployee] = useState<StatusChangeEmployee | null>(null);

  // Hooks
  const {
    employees,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    totalCount,
  } = useEmployeeList(filters, sort);

  const {
    results: searchResults,
  } = useEmployeeSearch(subsidiaryId as any);

  // Display data: search results or list results
  const displayEmployees = useMemo(() => {
    if (searchQuery.length >= 2 && searchResults.length > 0) {
      return searchResults;
    }
    return employees;
  }, [searchQuery, searchResults, employees]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.subsidiaryIds?.length) count++;
    if (filters.departmentIds?.length) count++;
    if (filters.employmentStatuses?.length) count++;
    if (filters.employmentTypes?.length) count++;
    if (filters.isManagement !== undefined) count++;
    return count;
  }, [filters]);

  // Handlers
  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleSortChange = useCallback((field: SortField) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleFilterChange = useCallback((newFilters: EmployeeFilters) => {
    setFilters(newFilters);
    setFilterDrawerOpen(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      subsidiaryIds: subsidiaryId ? [subsidiaryId] as any : undefined,
      departmentIds: departmentId ? [departmentId] as any : undefined,
    });
  }, [subsidiaryId, departmentId]);

  const handleSelectAll = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedEmployees(new Set(displayEmployees.map(e => e.id)));
    } else {
      setSelectedEmployees(new Set());
    }
  }, [displayEmployees]);

  const handleSelectEmployee = useCallback((employeeId: string) => {
    setSelectedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  }, []);

  const handleContextMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, employee: EmployeeSummary) => {
    event.stopPropagation();
    setContextMenuAnchor(event.currentTarget);
    setContextMenuEmployee(employee);
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenuAnchor(null);
    setContextMenuEmployee(null);
  }, []);

  const handleViewEmployee = useCallback((employee: EmployeeSummary) => {
    if (onEmployeeSelect) {
      onEmployeeSelect(employee);
    } else {
      navigate(`/hr/employees/${employee.id}`);
    }
    handleContextMenuClose();
  }, [navigate, onEmployeeSelect, handleContextMenuClose]);

  const handleEditEmployee = useCallback((employee: EmployeeSummary) => {
    navigate(`/hr/employees/${employee.id}/edit`);
    handleContextMenuClose();
  }, [navigate, handleContextMenuClose]);

  const handleChangeStatus = useCallback((employee: EmployeeSummary) => {
    setStatusDialogEmployee({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      employmentStatus: employee.employmentStatus,
    });
    setStatusDialogOpen(true);
    handleContextMenuClose();
  }, [handleContextMenuClose]);

  const handleStatusDialogClose = useCallback(() => {
    setStatusDialogOpen(false);
    setStatusDialogEmployee(null);
  }, []);

  const handleAddEmployee = useCallback(() => {
    navigate('/hr/employees/new');
  }, [navigate]);

  // Convert EmployeeSummary to EmployeeCardData
  const toCardData = (emp: EmployeeSummary): EmployeeCardData => ({
    id: emp.id,
    employeeNumber: emp.employeeNumber,
    fullName: emp.fullName,
    email: emp.email,
    phone: emp.phone,
    photoUrl: emp.photoUrl || undefined,
    title: emp.title,
    departmentId: emp.departmentId,
    employmentStatus: emp.employmentStatus,
    joiningDate: emp.joiningDate,
    directReports: emp.directReports,
  });

  // Loading skeleton
  if (loading && employees.length === 0) {
    return (
      <Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Skeleton variant="rounded" width={300} height={40} />
          <Skeleton variant="rounded" width={100} height={40} />
        </Box>
        {isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} variant="rounded" height={120} />
            ))}
          </Box>
        ) : (
          <Skeleton variant="rounded" height={400} />
        )}
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with search, filters, and actions */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3,
          alignItems: { xs: 'stretch', sm: 'center' },
        }}
      >
        {/* Search */}
        <TextField
          placeholder="Search employees..."
          value={searchQuery}
          onChange={handleSearchChange}
          size="small"
          sx={{ flexGrow: 1, maxWidth: { sm: 400 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          helperText={searchQuery.length > 0 && searchQuery.length < 2 ? 'Enter at least 2 characters' : undefined}
        />

        {/* Filter button */}
        <Badge badgeContent={activeFilterCount} color="primary">
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setFilterDrawerOpen(true)}
          >
            Filters
          </Button>
        </Badge>

        {/* Refresh button */}
        <Tooltip title="Refresh list">
          <IconButton onClick={refresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        {/* Add button */}
        {showAddButton && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddEmployee}
          >
            Add Employee
          </Button>
        )}
      </Box>

      {/* Error alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      )}

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Active filters:
          </Typography>
          {filters.employmentStatuses?.map(status => (
            <Chip
              key={status}
              label={EMPLOYMENT_STATUS_LABELS[status]}
              size="small"
              onDelete={() => setFilters(prev => ({
                ...prev,
                employmentStatuses: prev.employmentStatuses?.filter(s => s !== status),
              }))}
            />
          ))}
          <Button size="small" onClick={handleClearFilters}>
            Clear all
          </Button>
        </Box>
      )}

      {/* Results count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {searchQuery.length >= 2
          ? `${displayEmployees.length} result${displayEmployees.length !== 1 ? 's' : ''} found`
          : `${totalCount} employee${totalCount !== 1 ? 's' : ''}`}
      </Typography>

      {/* Employee list - Mobile cards or Desktop table */}
      {isMobile ? (
        // Mobile card view
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {displayEmployees.map(employee => (
            <EmployeeCard
              key={employee.id}
              employee={toCardData(employee)}
              selected={selectedEmployees.has(employee.id)}
              onSelect={() => handleSelectEmployee(employee.id)}
              onClick={() => handleViewEmployee(employee)}
              onMenuClick={(e) => handleContextMenuOpen(e, employee)}
            />
          ))}
        </Box>
      ) : (
        // Desktop table view
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={
                      displayEmployees.length > 0 &&
                      selectedEmployees.size === displayEmployees.length
                    }
                    indeterminate={
                      selectedEmployees.size > 0 &&
                      selectedEmployees.size < displayEmployees.length
                    }
                    onChange={handleSelectAll}
                  />
                </TableCell>
                {SORTABLE_COLUMNS.map(column => (
                  <TableCell key={column.field}>
                    <TableSortLabel
                      active={sort.field === column.field}
                      direction={sort.field === column.field ? sort.direction : 'asc'}
                      onClick={() => handleSortChange(column.field)}
                    >
                      {column.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayEmployees.map(employee => (
                <TableRow
                  key={employee.id}
                  hover
                  selected={selectedEmployees.has(employee.id)}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleViewEmployee(employee)}
                >
                  <TableCell padding="checkbox" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedEmployees.has(employee.id)}
                      onChange={() => handleSelectEmployee(employee.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={employee.photoUrl || undefined}
                        alt={employee.fullName}
                        sx={{ width: 40, height: 40 }}
                      >
                        {employee.fullName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {employee.fullName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {employee.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {employee.employeeNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{employee.title}</TableCell>
                  <TableCell>{employee.departmentId}</TableCell>
                  <TableCell>
                    <Chip
                      label={EMPLOYMENT_STATUS_LABELS[employee.employmentStatus]}
                      color={STATUS_COLORS[employee.employmentStatus]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {format(employee.joiningDate.toDate(), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell align="right" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleContextMenuOpen(e, employee)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {displayEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">
                      No employees found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Load more button */}
      {hasMore && !searchQuery && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </Box>
      )}

      {/* Context menu */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
      >
        <MenuItem onClick={() => contextMenuEmployee && handleViewEmployee(contextMenuEmployee)}>
          <ViewIcon sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={() => contextMenuEmployee && handleEditEmployee(contextMenuEmployee)}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => contextMenuEmployee && handleChangeStatus(contextMenuEmployee)}>
          <SwapHorizIcon sx={{ mr: 1 }} fontSize="small" />
          Change Status
        </MenuItem>
      </Menu>

      {/* Filter drawer */}
      <EmployeeFilterDrawer
        open={filterDrawerOpen}
        filters={filters}
        onClose={() => setFilterDrawerOpen(false)}
        onApply={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* Status change dialog */}
      {statusDialogEmployee && (
        <StatusChangeDialog
          open={statusDialogOpen}
          employee={statusDialogEmployee}
          onClose={handleStatusDialogClose}
          onSuccess={() => {
            handleStatusDialogClose();
            refresh();
          }}
        />
      )}
    </Box>
  );
};

export default EmployeeList;
