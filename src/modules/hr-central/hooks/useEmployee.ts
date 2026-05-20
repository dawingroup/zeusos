/**
 * Employee Hooks - DawinOS v2.0
 * React hooks for employee data management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit as firestoreLimit,
  onSnapshot,
  query,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  Employee,
  EmployeeSummary,
  EmployeeId,
  EmployeeFilters,
  EmployeeSort,
  EmployeeStats,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ChangeEmployeeStatusInput,
  TransferEmployeeInput,
} from '../types/employee.types';
import { employeeService } from '../services/employee.service';
import { SubsidiaryId } from '../../intelligence/config/constants';

const EMPLOYEES_COLLECTION = 'employees';

// ============================================
// Single Employee Hook
// ============================================

interface UseEmployeeResult {
  employee: Employee | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for single employee with real-time updates
 */
export function useEmployee(employeeId: EmployeeId | null): UseEmployeeResult {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!employeeId) {
      setEmployee(null);
      setLoading(false);
      return;
    }

    const employeeRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    
    const unsubscribe = onSnapshot(
      employeeRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Employee;
          if (!data.isDeleted) {
            setEmployee(data);
          } else {
            setEmployee(null);
          }
        } else {
          setEmployee(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Employee subscription error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [employeeId]);

  return { employee, loading, error, refresh };
}

// ============================================
// Employee List Hook
// ============================================

interface UseEmployeeListResult {
  employees: EmployeeSummary[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => void;
  refresh: () => void;
  setFilters: (filters: EmployeeFilters) => void;
  setSort: (sort: EmployeeSort) => void;
  filters: EmployeeFilters;
  sort: EmployeeSort;
}

/**
 * Hook for employee list with filtering and pagination
 */
export function useEmployeeList(
  initialFilters: EmployeeFilters = {},
  initialSort: EmployeeSort = { field: 'fullName', direction: 'asc' },
  pageSize: number = 25
): UseEmployeeListResult {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [filters, setFilters] = useState<EmployeeFilters>(initialFilters);
  const [sort, setSort] = useState<EmployeeSort>(initialSort);

  const fetchEmployees = useCallback(async (page: number, append: boolean = false) => {
    setLoading(true);
    try {
      const result = await employeeService.listEmployees(filters, sort, pageSize, page);
      
      setEmployees(prev => append ? [...prev, ...result.employees] : result.employees);
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
      setError(null);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters, sort, pageSize]);

  useEffect(() => {
    setPageNumber(1);
    fetchEmployees(1, false);
  }, [filters, sort, fetchEmployees]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = pageNumber + 1;
      setPageNumber(nextPage);
      fetchEmployees(nextPage, true);
    }
  }, [loading, hasMore, pageNumber, fetchEmployees]);

  const refresh = useCallback(() => {
    setPageNumber(1);
    fetchEmployees(1, false);
  }, [fetchEmployees]);

  const handleSetFilters = useCallback((newFilters: EmployeeFilters) => {
    setFilters(newFilters);
  }, []);

  const handleSetSort = useCallback((newSort: EmployeeSort) => {
    setSort(newSort);
  }, []);

  return {
    employees,
    loading,
    error,
    hasMore,
    totalCount,
    loadMore,
    refresh,
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    filters,
    sort,
  };
}

// ============================================
// Employee Search Hook
// ============================================

interface UseEmployeeSearchResult {
  results: EmployeeSummary[];
  loading: boolean;
  error: Error | null;
  search: (query: string) => void;
  clear: () => void;
}

/**
 * Hook for employee search with debounce
 */
export function useEmployeeSearch(
  subsidiaryId?: SubsidiaryId,
  debounceMs: number = 300
): UseEmployeeSearchResult {
  const [results, setResults] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const searchResults = await employeeService.searchEmployees(
          searchQuery,
          subsidiaryId
        );
        setResults(searchResults);
        setError(null);
      } catch (err) {
        console.error('Search error:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, subsidiaryId, debounceMs]);

  const search = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clear = useCallback(() => {
    setSearchQuery('');
    setResults([]);
  }, []);

  return { results, loading, error, search, clear };
}

// ============================================
// Employee Actions Hook
// ============================================

interface UseEmployeeActionsResult {
  createEmployee: (input: CreateEmployeeInput) => Promise<Employee>;
  updateEmployee: (id: EmployeeId, input: UpdateEmployeeInput) => Promise<Employee>;
  changeStatus: (input: ChangeEmployeeStatusInput) => Promise<Employee>;
  transferEmployee: (input: TransferEmployeeInput) => Promise<Employee>;
  confirmEmployee: (id: EmployeeId, notes?: string) => Promise<Employee>;
  deleteEmployee: (id: EmployeeId, reason: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for employee mutations
 */
export function useEmployeeActions(currentUserId: string): UseEmployeeActionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const withLoading = useCallback(async <T>(action: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const result = await action();
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createEmployee = useCallback(
    (input: CreateEmployeeInput) =>
      withLoading(() => employeeService.createEmployee(input, currentUserId)),
    [currentUserId, withLoading]
  );

  const updateEmployee = useCallback(
    (id: EmployeeId, input: UpdateEmployeeInput) =>
      withLoading(() => employeeService.updateEmployee(id, input, currentUserId)),
    [currentUserId, withLoading]
  );

  const changeStatus = useCallback(
    (input: ChangeEmployeeStatusInput) =>
      withLoading(() => employeeService.changeEmployeeStatus(input, currentUserId)),
    [currentUserId, withLoading]
  );

  const transferEmployee = useCallback(
    (input: TransferEmployeeInput) =>
      withLoading(() => employeeService.transferEmployee(input, currentUserId)),
    [currentUserId, withLoading]
  );

  const confirmEmployee = useCallback(
    (id: EmployeeId, notes?: string) =>
      withLoading(() => employeeService.confirmEmployee(id, currentUserId, notes)),
    [currentUserId, withLoading]
  );

  const deleteEmployee = useCallback(
    (id: EmployeeId, reason: string) =>
      withLoading(() => employeeService.deleteEmployee(id, currentUserId, reason)),
    [currentUserId, withLoading]
  );

  return {
    createEmployee,
    updateEmployee,
    changeStatus,
    transferEmployee,
    confirmEmployee,
    deleteEmployee,
    loading,
    error,
  };
}

// ============================================
// Employee Stats Hook
// ============================================

interface UseEmployeeStatsResult {
  stats: EmployeeStats | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for employee statistics
 */
export function useEmployeeStats(subsidiaryId?: SubsidiaryId): UseEmployeeStatsResult {
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await employeeService.getEmployeeStats(subsidiaryId);
      setStats(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [subsidiaryId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}

// ============================================
// Direct Reports Hook
// ============================================

interface UseDirectReportsResult {
  reports: EmployeeSummary[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for manager's direct reports
 */
export function useDirectReports(managerId: EmployeeId | null): UseDirectReportsResult {
  const [reports, setReports] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReports = useCallback(async () => {
    if (!managerId) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await employeeService.getDirectReports(managerId);
      setReports(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching direct reports:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [managerId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return { reports, loading, error, refresh: fetchReports };
}

// ============================================
// Department Employees Hook
// ============================================

interface UseDepartmentEmployeesResult {
  employees: EmployeeSummary[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for department employees with real-time updates
 */
export function useDepartmentEmployees(
  departmentId: string | null,
  includeInactive: boolean = false
): UseDepartmentEmployeesResult {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!departmentId) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await employeeService.getEmployeesByDepartment(
        departmentId,
        includeInactive,
      );
      setEmployees(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching department employees:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [departmentId, includeInactive]);

  // Real-time subscription. The snapshot itself delivers initial state and
  // every change, so we map docs to EmployeeSummary inline instead of doing
  // a separate getDocs round-trip on every change.
  useEffect(() => {
    if (!departmentId) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [
      where('position.departmentId', '==', departmentId),
      where('isDeleted', '==', false),
    ];

    if (!includeInactive) {
      constraints.push(where('employmentStatus', 'in', ['active', 'probation', 'on_leave']));
    }

    const q = query(collection(db, EMPLOYEES_COLLECTION), ...constraints);

    setLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const result = snapshot.docs.map((d) =>
          employeeService.employeeToSummary(d.data() as Employee),
        );
        setEmployees(result);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error subscribing to department employees:', err);
        setError(err as Error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [departmentId, includeInactive]);

  return { employees, loading, error, refresh };
}

// ============================================
// Expiring Probations Hook
// ============================================

interface UseExpiringProbationsResult {
  employees: Employee[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for employees with expiring probation periods
 */
export function useExpiringProbations(
  daysAhead: number = 30
): UseExpiringProbationsResult {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await employeeService.getExpiringProbations(daysAhead);
      setEmployees(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching expiring probations:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [daysAhead]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return { employees, loading, error, refresh: fetchEmployees };
}

// ============================================
// Employee Picker Hook
// ============================================

interface UseEmployeePickerResult {
  options: EmployeeSummary[];
  loading: boolean;
  error: Error | null;
  search: (query: string) => void;
  searchQuery: string;
}

/**
 * Hook for employee picker/selector component
 */
export function useEmployeePicker(
  subsidiaryId?: SubsidiaryId,
  departmentId?: string
): UseEmployeePickerResult {
  const [options, setOptions] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      if (searchQuery.length < 2) {
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        const results = await employeeService.searchEmployees(
          searchQuery,
          subsidiaryId,
          20
        );
        
        // Filter by department if specified
        const filtered = departmentId
          ? results.filter(e => e.departmentId === departmentId)
          : results;
        
        setOptions(filtered);
        setError(null);
      } catch (err) {
        console.error('Error fetching employee options:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchOptions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, subsidiaryId, departmentId]);

  const search = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return { options, loading, error, search, searchQuery };
}

// ============================================
// Org Chart Hook
// ============================================

interface OrgChartNode {
  employee: EmployeeSummary;
  directReports: OrgChartNode[];
}

interface UseOrgChartResult {
  rootNode: OrgChartNode | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for organization chart data
 */
export function useOrgChart(
  rootEmployeeId: EmployeeId | null,
  maxDepth: number = 3
): UseOrgChartResult {
  const [rootNode, setRootNode] = useState<OrgChartNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const buildOrgChart = useCallback(async (
    employeeId: EmployeeId,
    currentDepth: number
  ): Promise<OrgChartNode | null> => {
    const employee = await employeeService.getEmployee(employeeId);
    if (!employee) return null;

    const summary: EmployeeSummary = {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      subsidiaryId: employee.subsidiaryId,
      fullName: `${employee.firstName} ${employee.lastName}`,
      photoUrl: employee.photoUrl,
      email: employee.email,
      phone: employee.phoneNumbers.find(p => p.isPrimary)?.number,
      title: employee.position.title,
      departmentId: employee.position.departmentId,
      reportingTo: employee.position.reportingTo,
      employmentStatus: employee.employmentStatus,
      employmentType: employee.employmentType,
      joiningDate: employee.employmentDates.joiningDate,
      yearsOfService: 0,
      directReports: employee.position.directReports || 0,
      activeTaskCount: 0,
      hasSystemAccess: employee.systemAccess?.isActive || false,
    };

    const node: OrgChartNode = {
      employee: summary,
      directReports: [],
    };

    if (currentDepth < maxDepth) {
      const reports = await employeeService.getDirectReports(employeeId);
      const childNodes = await Promise.all(
        reports.map(r => buildOrgChart(r.id, currentDepth + 1))
      );
      node.directReports = childNodes.filter((n): n is OrgChartNode => n !== null);
    }

    return node;
  }, [maxDepth]);

  const fetchOrgChart = useCallback(async () => {
    if (!rootEmployeeId) {
      setRootNode(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const chart = await buildOrgChart(rootEmployeeId, 0);
      setRootNode(chart);
      setError(null);
    } catch (err) {
      console.error('Error building org chart:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [rootEmployeeId, buildOrgChart]);

  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  return { rootNode, loading, error, refresh: fetchOrgChart };
}

// ============================================
// Employee by System User ID Hook
// ============================================

interface UseEmployeeByUserIdResult {
  employee: Employee | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to find the employee record linked to a Firebase Auth user ID
 * Queries employees collection where systemAccess.userId matches
 */
export function useEmployeeByUserId(userId: string | null): UseEmployeeByUserIdResult {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setEmployee(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, EMPLOYEES_COLLECTION),
      where('systemAccess.userId', '==', userId),
      where('isDeleted', '==', false),
      firestoreLimit(1)
    );

    getDocs(q)
      .then((snapshot) => {
        if (!snapshot.empty) {
          setEmployee(snapshot.docs[0].data() as Employee);
        } else {
          setEmployee(null);
        }
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching employee by userId:', err);
        setError(err as Error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  return { employee, loading, error };
}
