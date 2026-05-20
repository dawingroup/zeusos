// ============================================================================
// ORGANIZATION UTILITIES - DawinOS HR Central
// ============================================================================

import {
  JobGrade,
  JOB_GRADE_DETAILS,
  JOB_GRADES_SORTED,
  SPAN_OF_CONTROL_GUIDELINES,
  MAX_HIERARCHY_DEPTH,
  JobGradeDetails,
  JobLevel,
} from '../constants/organization.constants';
import {
  Department,
  Position,
  OrgChartNode,
  OrgChartConfig,
  HeadcountSummary,
} from '../types/organization.types';

// ----------------------------------------------------------------------------
// Code Generation
// ----------------------------------------------------------------------------
export function generateDepartmentCode(name: string, parentCode?: string): string {
  const words = name.split(/\s+/).filter(w => w.length > 0);
  let code: string;
  
  if (words.length === 1) {
    code = words[0].substring(0, 3).toUpperCase();
  } else {
    code = words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
  }
  
  return parentCode ? `${parentCode}-${code}` : code;
}

export function generatePositionCode(
  departmentCode: string,
  title: string,
  sequence: number
): string {
  const titleWords = title.split(/\s+/);
  const titleCode = titleWords.length > 1
    ? titleWords.slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : title.substring(0, 3).toUpperCase();
  
  return `${departmentCode}-${titleCode}-${sequence.toString().padStart(3, '0')}`;
}

export function generateCostCenterCode(departmentCode: string, fiscalYear: number): string {
  return `CC-${departmentCode}-${fiscalYear}`;
}

// ----------------------------------------------------------------------------
// Job Grade Utilities
// ----------------------------------------------------------------------------
export function getJobGradeDetails(grade: JobGrade): JobGradeDetails {
  return JOB_GRADE_DETAILS[grade];
}

export function compareJobGrades(gradeA: JobGrade, gradeB: JobGrade): number {
  return JOB_GRADE_DETAILS[gradeA].levelOrder - JOB_GRADE_DETAILS[gradeB].levelOrder;
}

export function isGradeSenior(gradeA: JobGrade, gradeB: JobGrade): boolean {
  return compareJobGrades(gradeA, gradeB) < 0;
}

export function isGradeEqual(gradeA: JobGrade, gradeB: JobGrade): boolean {
  return compareJobGrades(gradeA, gradeB) === 0;
}

export function canSupervise(managerGrade: JobGrade, employeeGrade: JobGrade): boolean {
  return JOB_GRADE_DETAILS[managerGrade].canSupervise.includes(employeeGrade);
}

export function getSalaryMidpoint(grade: JobGrade): number {
  return JOB_GRADE_DETAILS[grade].salaryMidpoint;
}

export function getSalaryRange(grade: JobGrade): { min: number; max: number; midpoint: number } {
  const details = JOB_GRADE_DETAILS[grade];
  return {
    min: details.salaryMin,
    max: details.salaryMax,
    midpoint: details.salaryMidpoint,
  };
}

export function getGradesByLevel(level: JobLevel): JobGrade[] {
  return JOB_GRADES_SORTED.filter(g => JOB_GRADE_DETAILS[g].level === level);
}

export function getNextGrade(currentGrade: JobGrade): JobGrade | null {
  const currentIndex = JOB_GRADES_SORTED.indexOf(currentGrade);
  return currentIndex <= 0 ? null : JOB_GRADES_SORTED[currentIndex - 1];
}

export function getPreviousGrade(currentGrade: JobGrade): JobGrade | null {
  const currentIndex = JOB_GRADES_SORTED.indexOf(currentGrade);
  return currentIndex >= JOB_GRADES_SORTED.length - 1 ? null : JOB_GRADES_SORTED[currentIndex + 1];
}

export function getGradeLevel(grade: JobGrade): JobLevel {
  return JOB_GRADE_DETAILS[grade].level;
}

export function getGradeLevelOrder(grade: JobGrade): number {
  return JOB_GRADE_DETAILS[grade].levelOrder;
}

export function formatSalaryRange(min: number, max: number, currency = 'UGX'): string {
  const formatter = new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatter.format(min)} - ${formatter.format(max)}`;
}

export function formatSalary(amount: number, currency = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ----------------------------------------------------------------------------
// Hierarchy Utilities
// ----------------------------------------------------------------------------
export function buildDepartmentPath(
  parentPath: string[] | undefined,
  parentId: string | undefined
): string[] {
  if (!parentId) return [];
  return [...(parentPath || []), parentId];
}

export function buildDepartmentPathNames(
  parentPathNames: string[] | undefined,
  parentName: string | undefined
): string[] {
  if (!parentName) return [];
  return [...(parentPathNames || []), parentName];
}

export function validateHierarchyDepth(path: string[]): boolean {
  return path.length < MAX_HIERARCHY_DEPTH;
}

export function getHierarchyLevel(path: string[]): number {
  return path.length;
}

export function hasCircularDependency(
  departmentId: string,
  newParentId: string,
  departmentsMap: Map<string, Department>
): boolean {
  let currentId: string | null = newParentId;
  const visited = new Set<string>();
  
  while (currentId) {
    if (currentId === departmentId || visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);
    const dept = departmentsMap.get(currentId);
    currentId = dept?.parentId || null;
  }
  
  return false;
}

export function getDescendantDepartments(
  departmentId: string,
  allDepartments: Department[]
): string[] {
  const descendants: string[] = [];
  const queue = [departmentId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allDepartments.filter(d => d.parentId === currentId);
    
    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }
  
  return descendants;
}

export function getAncestorDepartments(
  departmentId: string,
  allDepartments: Department[]
): Department[] {
  const ancestors: Department[] = [];
  const deptMap = new Map(allDepartments.map(d => [d.id, d]));
  
  let currentDept = deptMap.get(departmentId);
  while (currentDept?.parentId) {
    const parent = deptMap.get(currentDept.parentId);
    if (parent) {
      ancestors.unshift(parent);
      currentDept = parent;
    } else {
      break;
    }
  }
  
  return ancestors;
}

export interface DepartmentWithChildren extends Department {
  children: DepartmentWithChildren[];
}

export function buildDepartmentTree(departments: Department[]): DepartmentWithChildren[] {
  const map = new Map<string, DepartmentWithChildren>();
  const roots: DepartmentWithChildren[] = [];
  
  // Create nodes with children array
  departments.forEach(dept => {
    map.set(dept.id, { ...dept, children: [] });
  });
  
  // Build tree structure
  departments.forEach(dept => {
    const node = map.get(dept.id)!;
    if (dept.parentId && map.has(dept.parentId)) {
      map.get(dept.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  
  // Sort children by sortOrder
  const sortChildren = (nodes: DepartmentWithChildren[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach(node => sortChildren(node.children));
  };
  sortChildren(roots);
  
  return roots;
}

export function flattenDepartmentTree(
  tree: DepartmentWithChildren[],
  level = 0
): Array<Department & { level: number }> {
  const result: Array<Department & { level: number }> = [];
  
  for (const node of tree) {
    const { children, ...dept } = node;
    result.push({ ...dept, level });
    result.push(...flattenDepartmentTree(children, level + 1));
  }
  
  return result;
}

// ----------------------------------------------------------------------------
// Org Chart Utilities
// ----------------------------------------------------------------------------
export function buildOrgChartFromDepartments(
  departments: Department[],
  config: OrgChartConfig
): OrgChartNode[] {
  const filteredDepts = departments.filter(dept => dept.showInOrgChart);
  
  const nodes: OrgChartNode[] = filteredDepts.map(dept => ({
    id: dept.id,
    type: 'department' as const,
    name: dept.name,
    subtitle: dept.type,
    departmentId: dept.id,
    parentId: dept.parentId,
    children: [],
    level: dept.level,
    directReports: dept.currentHeadcount,
    vacancies: dept.vacantPositions,
    isExpanded: dept.expandedByDefault,
    color: dept.color,
    title: config.showHeadcount 
      ? `${dept.currentHeadcount}/${dept.approvedHeadcount}` 
      : undefined,
  }));
  
  return buildNodeTree(nodes, config.maxDepth);
}

export function buildOrgChartFromPositions(
  positions: Position[],
  config: OrgChartConfig
): OrgChartNode[] {
  const filteredPositions = positions.filter(pos => pos.showInOrgChart);
  
  const nodes: OrgChartNode[] = filteredPositions.map(pos => ({
    id: pos.id,
    type: 'position' as const,
    name: pos.title,
    subtitle: pos.jobGrade,
    positionId: pos.id,
    departmentId: pos.departmentId,
    parentId: pos.reportsToPositionId || null,
    children: [],
    level: 0,
    directReports: pos.filledCount,
    vacancies: pos.headcount - pos.filledCount,
    isExpanded: true,
    title: config.showHeadcount 
      ? `${pos.filledCount}/${pos.headcount}` 
      : undefined,
  }));
  
  return buildNodeTree(nodes, config.maxDepth);
}

export function buildOrgChartFromEmployees(
  employees: Array<{
    id: string;
    name: string;
    positionTitle?: string;
    departmentId?: string;
    managerId?: string;
    photoUrl?: string;
  }>,
  config: OrgChartConfig
): OrgChartNode[] {
  const nodes: OrgChartNode[] = employees.map(emp => ({
    id: emp.id,
    type: 'employee' as const,
    name: emp.name,
    title: emp.positionTitle,
    avatarUrl: emp.photoUrl,
    departmentId: emp.departmentId,
    employeeId: emp.id,
    parentId: emp.managerId || null,
    children: [],
    level: 0,
    isExpanded: true,
  }));
  
  return buildNodeTree(nodes, config.maxDepth);
}

function buildNodeTree(nodes: OrgChartNode[], maxDepth?: number): OrgChartNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const roots: OrgChartNode[] = [];
  
  // Build parent-child relationships
  nodes.forEach(node => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  
  // Calculate levels and apply max depth
  const setLevels = (nodes: OrgChartNode[], level: number) => {
    nodes.forEach(node => {
      node.level = level;
      if (!maxDepth || level < maxDepth) {
        setLevels(node.children, level + 1);
      } else {
        node.children = [];
      }
    });
  };
  setLevels(roots, 0);
  
  // Calculate total reports
  const calculateTotalReports = (node: OrgChartNode): number => {
    const directCount = node.children.length;
    const indirectCount = node.children.reduce(
      (sum, child) => sum + calculateTotalReports(child),
      0
    );
    node.totalReports = directCount + indirectCount;
    return node.totalReports;
  };
  roots.forEach(calculateTotalReports);
  
  return roots;
}

export function findNodeById(nodes: OrgChartNode[], id: string): OrgChartNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

export function searchOrgChartNodes(
  nodes: OrgChartNode[],
  query: string
): OrgChartNode[] {
  const results: OrgChartNode[] = [];
  const searchLower = query.toLowerCase();
  
  const search = (nodeList: OrgChartNode[]) => {
    for (const node of nodeList) {
      if (
        node.name.toLowerCase().includes(searchLower) ||
        node.title?.toLowerCase().includes(searchLower) ||
        node.subtitle?.toLowerCase().includes(searchLower)
      ) {
        results.push(node);
      }
      search(node.children);
    }
  };
  
  search(nodes);
  return results;
}

// ----------------------------------------------------------------------------
// Reporting Utilities
// ----------------------------------------------------------------------------
export function calculateSpanOfControl(directReportsCount: number): number {
  return directReportsCount;
}

export function isSpanOfControlHealthy(
  directReportsCount: number,
  managerLevel: JobLevel
): { isHealthy: boolean; message?: string } {
  const guidelines = SPAN_OF_CONTROL_GUIDELINES[managerLevel];
  
  if (directReportsCount < guidelines.min) {
    return {
      isHealthy: false,
      message: `Below minimum span (${guidelines.min}). Consider consolidating roles.`,
    };
  }
  
  if (directReportsCount > guidelines.max) {
    return {
      isHealthy: false,
      message: `Exceeds maximum span (${guidelines.max}). Consider adding management layer.`,
    };
  }
  
  if (directReportsCount === guidelines.ideal) {
    return { isHealthy: true, message: 'Optimal span of control' };
  }
  
  return { isHealthy: true };
}

export function getSpanOfControlGuideline(level: JobLevel): {
  min: number;
  max: number;
  ideal: number;
} {
  return SPAN_OF_CONTROL_GUIDELINES[level];
}

export function getReportingChain(
  employeeId: string,
  employeesMap: Map<string, { id: string; managerId?: string; name: string }>
): string[] {
  const chain: string[] = [];
  let currentId: string | undefined = employeeId;
  const visited = new Set<string>();
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const emp = employeesMap.get(currentId);
    if (emp?.managerId) {
      chain.push(emp.managerId);
      currentId = emp.managerId;
    } else {
      break;
    }
  }
  
  return chain;
}

export function getAllReports(
  managerId: string,
  employeesMap: Map<string, { id: string; managerId?: string }>
): string[] {
  const reports: string[] = [];
  const queue = [managerId];
  const visited = new Set<string>([managerId]);
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const directReports = Array.from(employeesMap.values())
      .filter(e => e.managerId === currentId);
    
    for (const report of directReports) {
      if (!visited.has(report.id)) {
        reports.push(report.id);
        queue.push(report.id);
        visited.add(report.id);
      }
    }
  }
  
  return reports;
}

export function getDirectReportsCount(
  managerId: string,
  employeesMap: Map<string, { id: string; managerId?: string }>
): number {
  return Array.from(employeesMap.values())
    .filter(e => e.managerId === managerId)
    .length;
}

// ----------------------------------------------------------------------------
// Headcount Utilities
// ----------------------------------------------------------------------------
export function calculateHeadcountSummary(
  approvedHeadcount: number,
  currentHeadcount: number,
  frozenPositions: number
): HeadcountSummary {
  const effectiveApproved = approvedHeadcount - frozenPositions;
  const vacant = Math.max(0, effectiveApproved - currentHeadcount);
  const fillRate = effectiveApproved > 0 
    ? (currentHeadcount / effectiveApproved) * 100 
    : 0;
  const vacancyRate = effectiveApproved > 0 
    ? (vacant / effectiveApproved) * 100 
    : 0;
  
  return {
    approved: approvedHeadcount,
    filled: currentHeadcount,
    vacant,
    frozen: frozenPositions,
    fillRate: Math.round(fillRate * 10) / 10,
    vacancyRate: Math.round(vacancyRate * 10) / 10,
  };
}

export function aggregateHeadcount(departments: Department[]): HeadcountSummary {
  const totals = departments.reduce(
    (acc, dept) => ({
      approved: acc.approved + dept.approvedHeadcount,
      filled: acc.filled + dept.currentHeadcount,
      frozen: acc.frozen + dept.frozenPositions,
    }),
    { approved: 0, filled: 0, frozen: 0 }
  );
  
  return calculateHeadcountSummary(totals.approved, totals.filled, totals.frozen);
}

export function calculateVacancyRate(positions: Position[]): number {
  const totalHeadcount = positions.reduce((sum, p) => sum + p.headcount, 0);
  const filledCount = positions.reduce((sum, p) => sum + p.filledCount, 0);
  
  if (totalHeadcount === 0) return 0;
  return ((totalHeadcount - filledCount) / totalHeadcount) * 100;
}

// ----------------------------------------------------------------------------
// Formatting Utilities
// ----------------------------------------------------------------------------
export function formatDepartmentPath(pathNames: string[], separator = ' > '): string {
  return pathNames.join(separator);
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function formatPositionWithGrade(title: string, grade: JobGrade): string {
  return `${title} (${grade})`;
}

export function formatHeadcount(filled: number, approved: number): string {
  return `${filled}/${approved}`;
}

export function formatFillRate(fillRate: number): string {
  return `${fillRate.toFixed(1)}%`;
}

// ----------------------------------------------------------------------------
// Validation Utilities
// ----------------------------------------------------------------------------
export function canDeleteDepartment(
  department: Department,
  childCount: number
): { canDelete: boolean; reason?: string } {
  if (childCount > 0) {
    return { canDelete: false, reason: 'Has child departments' };
  }
  if (department.currentHeadcount > 0) {
    return { canDelete: false, reason: 'Has active employees' };
  }
  return { canDelete: true };
}

export function canDeletePosition(
  position: Position
): { canDelete: boolean; reason?: string } {
  if (position.filledCount > 0) {
    return { canDelete: false, reason: 'Has active incumbents' };
  }
  return { canDelete: true };
}

export function canMergeDepartments(
  sourceDepartments: Department[],
  targetDepartment: Department
): { canMerge: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check if target is one of the sources
  if (sourceDepartments.some(d => d.id === targetDepartment.id)) {
    return { canMerge: false, warnings: ['Target department cannot be a source department'] };
  }
  
  // Check for type mismatches
  const typeMismatch = sourceDepartments.some(d => d.type !== targetDepartment.type);
  if (typeMismatch) {
    warnings.push('Some departments have different types');
  }
  
  // Check for budget consolidation
  const totalBudget = sourceDepartments.reduce((sum, d) => sum + (d.annualBudget || 0), 0);
  if (totalBudget > 0) {
    warnings.push(`Total budget of ${formatSalary(totalBudget)} will be consolidated`);
  }
  
  return { canMerge: true, warnings };
}

export function validateManagerAssignment(
  employeeGrade: JobGrade,
  managerGrade: JobGrade
): { valid: boolean; warning?: string } {
  if (!canSupervise(managerGrade, employeeGrade)) {
    return {
      valid: false,
      warning: `Grade ${managerGrade} typically does not supervise grade ${employeeGrade}`,
    };
  }
  
  if (isGradeEqual(employeeGrade, managerGrade)) {
    return {
      valid: true,
      warning: 'Manager and employee have the same grade - unusual reporting structure',
    };
  }
  
  return { valid: true };
}

export function validatePositionHeadcount(
  currentFilled: number,
  newHeadcount: number
): { valid: boolean; warning?: string } {
  if (newHeadcount < currentFilled) {
    return {
      valid: false,
      warning: `Cannot reduce headcount below current filled count (${currentFilled})`,
    };
  }
  return { valid: true };
}

// ----------------------------------------------------------------------------
// Sorting Utilities
// ----------------------------------------------------------------------------
export function sortDepartmentsByHierarchy(departments: Department[]): Department[] {
  return [...departments].sort((a, b) => {
    // First by level
    if (a.level !== b.level) return a.level - b.level;
    // Then by sort order
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    // Finally by name
    return a.name.localeCompare(b.name);
  });
}

export function sortPositionsByGrade(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => {
    const gradeCompare = compareJobGrades(a.jobGrade, b.jobGrade);
    if (gradeCompare !== 0) return gradeCompare;
    return a.title.localeCompare(b.title);
  });
}

// ----------------------------------------------------------------------------
// Statistics Utilities
// ----------------------------------------------------------------------------
export function calculateGradeDistribution(
  positions: Position[]
): Map<JobGrade, { count: number; filled: number; vacant: number }> {
  const distribution = new Map<JobGrade, { count: number; filled: number; vacant: number }>();
  
  for (const position of positions) {
    const existing = distribution.get(position.jobGrade) || { count: 0, filled: 0, vacant: 0 };
    distribution.set(position.jobGrade, {
      count: existing.count + position.headcount,
      filled: existing.filled + position.filledCount,
      vacant: existing.vacant + (position.headcount - position.filledCount),
    });
  }
  
  return distribution;
}

export function calculateDepartmentTypeDistribution(
  departments: Department[]
): Map<string, number> {
  const distribution = new Map<string, number>();
  
  for (const dept of departments) {
    distribution.set(dept.type, (distribution.get(dept.type) || 0) + 1);
  }
  
  return distribution;
}
