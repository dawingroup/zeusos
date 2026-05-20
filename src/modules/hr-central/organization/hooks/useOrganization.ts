// ============================================================================
// ORGANIZATION HOOKS - DawinOS HR Central
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../../../shared/hooks/useAuth';
import { db } from '../../../../shared/services/firebase/firestore';
import {
  Department,
  Position,
  ReportingLine,
  DepartmentFilters,
  PositionFilters,
  OrgChartNode,
  OrgChartConfig,
  TeamSummary,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  CreatePositionInput,
  UpdatePositionInput,
} from '../types/organization.types';
import { departmentService } from '../services/department.service';
import { positionService } from '../services/position.service';
import { reportingLineService } from '../services/reporting-line.service';
import {
  buildOrgChartFromDepartments,
  buildDepartmentTree,
  DepartmentWithChildren,
} from '../utils/organization.utils';

// ============================================================================
// useDepartments Hook
// ============================================================================
export function useDepartments(options: {
  companyId: string;
  filters?: Partial<DepartmentFilters>;
  autoFetch?: boolean;
}) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const companyId = options.companyId;

  const fetchDepartments = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await departmentService.getDepartments({
        companyId,
        ...options.filters,
      });
      setDepartments(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch departments'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(options.filters)]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchDepartments();
    }
  }, [fetchDepartments, options.autoFetch]);

  const createDepartment = useCallback(async (input: CreateDepartmentInput): Promise<Department> => {
    if (!companyId || !user?.uid) {
      throw new Error('Company or user not available');
    }
    const dept = await departmentService.createDepartment(companyId, input, user.uid);
    setDepartments(prev => [...prev, dept]);
    return dept;
  }, [companyId, user?.uid]);

  const updateDepartment = useCallback(async (
    id: string,
    input: UpdateDepartmentInput
  ): Promise<Department> => {
    if (!companyId || !user?.uid) {
      throw new Error('Company or user not available');
    }
    const updated = await departmentService.updateDepartment(companyId, id, input, user.uid);
    setDepartments(prev => prev.map(d => d.id === id ? updated : d));
    return updated;
  }, [companyId, user?.uid]);

  const deleteDepartment = useCallback(async (id: string): Promise<void> => {
    if (!companyId || !user?.uid) {
      throw new Error('Company or user not available');
    }
    await departmentService.deleteDepartment(companyId, id, user.uid);
    setDepartments(prev => prev.filter(d => d.id !== id));
  }, [companyId, user?.uid]);

  const getDepartmentTree = useCallback((): DepartmentWithChildren[] => {
    return buildDepartmentTree(departments);
  }, [departments]);

  const rootDepartments = useMemo(() => {
    return departments.filter(d => !d.parentId);
  }, [departments]);

  return {
    departments,
    loading,
    error,
    refetch: fetchDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentTree,
    rootDepartments,
  };
}

// ============================================================================
// useDepartment Hook (Single)
// ============================================================================
export function useDepartment(companyId: string, departmentId: string | undefined) {
  const { user } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [children, setChildren] = useState<Department[]>([]);
  const [hierarchy, setHierarchy] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDepartment = useCallback(async () => {
    if (!companyId || !departmentId) {
      setDepartment(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [dept, childDepts, hierarchyDepts] = await Promise.all([
        departmentService.getDepartment(companyId, departmentId),
        departmentService.getChildDepartments(companyId, departmentId),
        departmentService.getDepartmentHierarchy(companyId, departmentId),
      ]);
      setDepartment(dept);
      setChildren(childDepts);
      setHierarchy(hierarchyDepts);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch department'));
    } finally {
      setLoading(false);
    }
  }, [companyId, departmentId]);

  useEffect(() => {
    fetchDepartment();
  }, [fetchDepartment]);

  const update = useCallback(async (input: UpdateDepartmentInput): Promise<Department> => {
    if (!companyId || !departmentId || !user?.uid) {
      throw new Error('Missing required data');
    }
    const updated = await departmentService.updateDepartment(companyId, departmentId, input, user.uid);
    setDepartment(updated);
    return updated;
  }, [companyId, departmentId, user?.uid]);

  return {
    department,
    loading,
    error,
    refetch: fetchDepartment,
    update,
    children,
    hierarchy,
  };
}

// ============================================================================
// usePositions Hook
// ============================================================================
export function usePositions(options: {
  companyId: string;
  filters?: Partial<PositionFilters>;
  autoFetch?: boolean;
}) {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const companyId = options.companyId;

  const fetchPositions = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await positionService.getPositions({
        companyId,
        ...options.filters,
      });
      setPositions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch positions'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(options.filters)]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchPositions();
    }
  }, [fetchPositions, options.autoFetch]);

  const createPosition = useCallback(async (input: CreatePositionInput): Promise<Position> => {
    if (!companyId || !user?.uid) {
      throw new Error('Company or user not available');
    }
    const pos = await positionService.createPosition(companyId, input, user.uid);
    setPositions(prev => [...prev, pos]);
    return pos;
  }, [companyId, user?.uid]);

  const updatePosition = useCallback(async (
    id: string,
    input: UpdatePositionInput
  ): Promise<Position> => {
    if (!companyId || !user?.uid) {
      throw new Error('Company or user not available');
    }
    const updated = await positionService.updatePosition(companyId, id, input, user.uid);
    setPositions(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }, [companyId, user?.uid]);

  const vacantPositions = useMemo(() => {
    return positions.filter(p => p.filledCount < p.headcount);
  }, [positions]);

  const positionsByDepartment = useMemo(() => {
    const grouped = new Map<string, Position[]>();
    for (const pos of positions) {
      const existing = grouped.get(pos.departmentId) || [];
      grouped.set(pos.departmentId, [...existing, pos]);
    }
    return grouped;
  }, [positions]);

  return {
    positions,
    loading,
    error,
    refetch: fetchPositions,
    createPosition,
    updatePosition,
    vacantPositions,
    positionsByDepartment,
  };
}

// ============================================================================
// usePosition Hook (Single)
// ============================================================================
export function usePosition(companyId: string, positionId: string | undefined) {
  const { user } = useAuth();
  const [position, setPosition] = useState<Position | null>(null);
  const [directReportPositions, setDirectReportPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPosition = useCallback(async () => {
    if (!companyId || !positionId) {
      setPosition(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [pos, directReports] = await Promise.all([
        positionService.getPosition(companyId, positionId),
        positionService.getDirectReportPositions(companyId, positionId),
      ]);
      setPosition(pos);
      setDirectReportPositions(directReports);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch position'));
    } finally {
      setLoading(false);
    }
  }, [companyId, positionId]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  const update = useCallback(async (input: UpdatePositionInput): Promise<Position> => {
    if (!companyId || !positionId || !user?.uid) {
      throw new Error('Missing required data');
    }
    const updated = await positionService.updatePosition(companyId, positionId, input, user.uid);
    setPosition(updated);
    return updated;
  }, [companyId, positionId, user?.uid]);

  const assignEmployee = useCallback(async (
    employeeId: string,
    options?: { isPrimary?: boolean; fte?: number }
  ): Promise<Position> => {
    if (!companyId || !positionId || !user?.uid) {
      throw new Error('Missing required data');
    }
    const updated = await positionService.assignEmployee(
      companyId,
      positionId,
      { employeeId, ...options },
      user.uid
    );
    setPosition(updated);
    return updated;
  }, [companyId, positionId, user?.uid]);

  const removeEmployee = useCallback(async (
    employeeId: string,
    reason?: string
  ): Promise<Position> => {
    if (!companyId || !positionId || !user?.uid) {
      throw new Error('Missing required data');
    }
    const updated = await positionService.removeEmployee(
      companyId,
      positionId,
      employeeId,
      { reason },
      user.uid
    );
    setPosition(updated);
    return updated;
  }, [companyId, positionId, user?.uid]);

  const freeze = useCallback(async (
    reason: string,
    frozenUntil?: Date
  ): Promise<Position> => {
    if (!companyId || !positionId || !user?.uid) {
      throw new Error('Missing required data');
    }
    const updated = await positionService.freezePosition(
      companyId,
      positionId,
      { reason, frozenUntil },
      user.uid
    );
    setPosition(updated);
    return updated;
  }, [companyId, positionId, user?.uid]);

  const unfreeze = useCallback(async (): Promise<Position> => {
    if (!companyId || !positionId || !user?.uid) {
      throw new Error('Missing required data');
    }
    const updated = await positionService.unfreezePosition(companyId, positionId, user.uid);
    setPosition(updated);
    return updated;
  }, [companyId, positionId, user?.uid]);

  return {
    position,
    loading,
    error,
    refetch: fetchPosition,
    update,
    assignEmployee,
    removeEmployee,
    freeze,
    unfreeze,
    directReportPositions,
  };
}

// ============================================================================
// useOrgChart Hook
// ============================================================================
export function useOrgChart(options: {
  companyId: string;
  config?: Partial<OrgChartConfig>;
  rootId?: string;
}) {
  const [nodes, setNodes] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const companyId = options.companyId;

  const config: OrgChartConfig = {
    viewMode: 'department',
    showVacant: true,
    showHeadcount: true,
    colorByDepartment: true,
    layout: 'vertical',
    ...options.config,
  };

  const fetchOrgChart = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      if (config.viewMode === 'department') {
        const departments = await departmentService.getDepartments({
          companyId,
          showInOrgChart: true,
        });
        const chartNodes = buildOrgChartFromDepartments(departments, config);
        setNodes(chartNodes);
      } else {
        // Position and employee views can be added later
        setNodes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to build org chart'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(config)]);

  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  const toggleNode = useCallback((nodeId: string) => {
    setNodes(prev => {
      const toggle = (nodeList: OrgChartNode[]): OrgChartNode[] =>
        nodeList.map(node =>
          node.id === nodeId
            ? { ...node, isExpanded: !node.isExpanded }
            : { ...node, children: toggle(node.children) }
        );
      return toggle(prev);
    });
  }, []);

  const expandAll = useCallback(() => {
    const setAllExpanded = (nodeList: OrgChartNode[], expanded: boolean): OrgChartNode[] =>
      nodeList.map(node => ({
        ...node,
        isExpanded: expanded,
        children: setAllExpanded(node.children, expanded),
      }));
    setNodes(prev => setAllExpanded(prev, true));
  }, []);

  const collapseAll = useCallback(() => {
    const setAllExpanded = (nodeList: OrgChartNode[], expanded: boolean): OrgChartNode[] =>
      nodeList.map(node => ({
        ...node,
        isExpanded: expanded,
        children: setAllExpanded(node.children, expanded),
      }));
    setNodes(prev => setAllExpanded(prev, false));
  }, []);

  const searchNodes = useCallback((query: string): OrgChartNode[] => {
    const searchLower = query.toLowerCase();
    const results: OrgChartNode[] = [];
    
    const search = (nodeList: OrgChartNode[]) => {
      for (const node of nodeList) {
        if (
          node.name.toLowerCase().includes(searchLower) ||
          node.title?.toLowerCase().includes(searchLower)
        ) {
          results.push(node);
        }
        search(node.children);
      }
    };
    
    search(nodes);
    return results;
  }, [nodes]);

  const highlightNode = useCallback((nodeId: string) => {
    setNodes(prev => {
      const highlight = (nodeList: OrgChartNode[]): OrgChartNode[] =>
        nodeList.map(node => ({
          ...node,
          isHighlighted: node.id === nodeId,
          children: highlight(node.children),
        }));
      return highlight(prev);
    });
  }, []);

  const clearHighlight = useCallback(() => {
    setNodes(prev => {
      const clear = (nodeList: OrgChartNode[]): OrgChartNode[] =>
        nodeList.map(node => ({
          ...node,
          isHighlighted: false,
          children: clear(node.children),
        }));
      return clear(prev);
    });
  }, []);

  return {
    nodes,
    loading,
    error,
    refetch: fetchOrgChart,
    toggleNode,
    expandAll,
    collapseAll,
    searchNodes,
    highlightNode,
    clearHighlight,
  };
}

// ============================================================================
// useTeamSummary Hook
// ============================================================================
export function useTeamSummary(companyId: string, managerId: string | undefined) {
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!companyId || !managerId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await reportingLineService.getTeamSummary(companyId, managerId);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch team summary'));
    } finally {
      setLoading(false);
    }
  }, [companyId, managerId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refetch: fetchSummary,
  };
}

// ============================================================================
// useReportingChain Hook
// ============================================================================
export function useReportingChain(companyId: string, employeeId: string | undefined) {
  const [chain, setChain] = useState<ReportingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChain = useCallback(async () => {
    if (!companyId || !employeeId) {
      setChain([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await reportingLineService.getReportingChain(companyId, employeeId);
      setChain(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch reporting chain'));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    fetchChain();
  }, [fetchChain]);

  return {
    chain,
    loading,
    error,
    refetch: fetchChain,
  };
}

// ============================================================================
// useDirectReports Hook
// ============================================================================
export function useDirectReports(companyId: string, managerId: string | undefined) {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReports = useCallback(async () => {
    if (!companyId || !managerId) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await reportingLineService.getDirectReports(companyId, managerId, true);
      setReports(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch direct reports'));
    } finally {
      setLoading(false);
    }
  }, [companyId, managerId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const changeReporting = useCallback(async (
    employeeId: string,
    newManagerId: string,
    options: { effectiveDate: Date; reason?: string }
  ): Promise<ReportingLine> => {
    if (!companyId || !user?.uid) {
      throw new Error('Missing required data');
    }
    const result = await reportingLineService.changeReporting(
      companyId,
      {
        employeeId,
        newManagerId,
        reportingType: 'direct',
        effectiveDate: options.effectiveDate,
        reason: options.reason,
      },
      user.uid
    );
    await fetchReports();
    return result;
  }, [companyId, user?.uid, fetchReports]);

  return {
    reports,
    loading,
    error,
    refetch: fetchReports,
    changeReporting,
  };
}

// ============================================================================
// useVacantPositions Hook
// ============================================================================
export function useVacantPositions(companyId: string, departmentId?: string) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await positionService.getVacantPositions(companyId, departmentId);
      setPositions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vacant positions'));
    } finally {
      setLoading(false);
    }
  }, [companyId, departmentId]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const totalVacancies = useMemo(() => {
    return positions.reduce((sum, p) => sum + (p.headcount - p.filledCount), 0);
  }, [positions]);

  return {
    positions,
    loading,
    error,
    refetch: fetchPositions,
    totalVacancies,
  };
}

// ============================================================================
// useMyTeam Hook (Current user's team)
// ============================================================================
export function useMyTeam(companyId: string) {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMyTeam = useCallback(async () => {
    if (!companyId || !user?.uid) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current user's employee record
      const employeeDocRef = doc(db, 'companies', companyId, 'employees', user.uid);
      const employeeRef = await getDoc(employeeDocRef);
      
      if (employeeRef.exists()) {
        const result = await reportingLineService.getDirectReports(companyId, user.uid, true);
        setReports(result);
      } else {
        setReports([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch team'));
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.uid]);

  useEffect(() => {
    fetchMyTeam();
  }, [fetchMyTeam]);

  return {
    reports,
    loading,
    error,
    refetch: fetchMyTeam,
    teamSize: reports.length,
  };
}
