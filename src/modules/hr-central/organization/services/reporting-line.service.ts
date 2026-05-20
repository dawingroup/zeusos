// ============================================================================
// REPORTING LINE SERVICE - DawinOS HR Central
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';
import {
  ReportingLine,
  ReportingLineFilters,
  OrganizationChange,
  TeamSummary,
  DirectReport,
  EmployeeReference,
  DepartmentBreakdown,
} from '../types/organization.types';
import {
  ORG_COLLECTIONS,
  REPORTING_TYPE,
  ORG_CHANGE_TYPE,
  SPAN_OF_CONTROL_GUIDELINES,
  JobGrade,
  ReportingType,
} from '../constants/organization.constants';
import { canSupervise, getJobGradeDetails } from '../utils/organization.utils';

class ReportingLineService {
  private getCollectionRef(companyId: string) {
    return collection(db, 'companies', companyId, ORG_COLLECTIONS.REPORTING_LINES);
  }

  // --------------------------------------------------------------------------
  // Create Reporting Line
  // --------------------------------------------------------------------------
  async createReportingLine(
    companyId: string,
    input: {
      employeeId: string;
      managerId: string;
      reportingType: ReportingType;
      isPrimary?: boolean;
      effectiveFrom?: Date;
      effectiveUntil?: Date;
      projectId?: string;
      reason?: string;
      notes?: string;
    },
    userId: string
  ): Promise<ReportingLine> {
    const colRef = this.getCollectionRef(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    // Validate employee and manager exist
    const employee = await this.getEmployeeReference(companyId, input.employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const manager = await this.getEmployeeReference(companyId, input.managerId);
    if (!manager) {
      throw new Error('Manager not found');
    }

    // Self-reporting check
    if (input.employeeId === input.managerId) {
      throw new Error('Employee cannot report to themselves');
    }

    // Grade supervision check
    if (employee.jobGrade && manager.jobGrade) {
      if (!canSupervise(manager.jobGrade, employee.jobGrade)) {
        console.warn(
          `Grade ${manager.jobGrade} typically does not supervise grade ${employee.jobGrade}`
        );
      }
    }

    // Check for existing primary reporting line
    const isPrimary = input.isPrimary ?? (input.reportingType === REPORTING_TYPE.DIRECT);
    if (isPrimary || input.reportingType === REPORTING_TYPE.DIRECT) {
      const existingPrimary = await this.getPrimaryReportingLine(companyId, input.employeeId);
      if (existingPrimary) {
        throw new Error('Employee already has a primary reporting line. End the existing one first.');
      }
    }

    const reportingLine: ReportingLine = {
      id: docRef.id,
      companyId,
      employeeId: input.employeeId,
      employeeName: employee.name,
      employeeNumber: employee.employeeNumber,
      employeePositionId: employee.positionId,
      employeePositionTitle: employee.positionTitle,
      managerId: input.managerId,
      managerName: manager.name,
      managerNumber: manager.employeeNumber,
      managerPositionId: manager.positionId,
      managerPositionTitle: manager.positionTitle,
      reportingType: input.reportingType,
      isPrimary,
      effectiveFrom: input.effectiveFrom ? Timestamp.fromDate(input.effectiveFrom) : now,
      effectiveUntil: input.effectiveUntil ? Timestamp.fromDate(input.effectiveUntil) : undefined,
      projectId: input.projectId,
      reason: input.reason,
      notes: input.notes,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await setDoc(docRef, reportingLine);

    // Update employee's manager reference if this is the primary line
    if (reportingLine.isPrimary) {
      await this.updateEmployeeManager(companyId, input.employeeId, input.managerId, manager.name, userId);
    }

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.REPORTING_CHANGED,
      entityType: 'reporting_line',
      entityId: reportingLine.id,
      entityName: `${employee.name} → ${manager.name}`,
      relatedEntityType: 'employee',
      relatedEntityId: input.employeeId,
      relatedEntityName: employee.name,
      newValues: {
        managerId: input.managerId,
        managerName: manager.name,
        reportingType: input.reportingType,
      },
      description: `${employee.name} now reports to ${manager.name} (${input.reportingType})`,
      effectiveDate: reportingLine.effectiveFrom,
      createdBy: userId,
    });

    return reportingLine;
  }

  // --------------------------------------------------------------------------
  // End Reporting Line
  // --------------------------------------------------------------------------
  async endReportingLine(
    companyId: string,
    reportingLineId: string,
    options: { effectiveUntil?: Date; reason?: string },
    userId: string
  ): Promise<ReportingLine> {
    const reportingLine = await this.getReportingLine(companyId, reportingLineId);
    if (!reportingLine) {
      throw new Error('Reporting line not found');
    }

    const now = Timestamp.now();
    const effectiveUntil = options.effectiveUntil 
      ? Timestamp.fromDate(options.effectiveUntil) 
      : now;

    const updates: Partial<ReportingLine> = {
      effectiveUntil,
      reason: options.reason || reportingLine.reason,
      updatedAt: now,
      updatedBy: userId,
    };

    const docRef = doc(this.getCollectionRef(companyId), reportingLineId);
    await updateDoc(docRef, updates);

    // Clear employee's manager reference if this was the primary line
    if (reportingLine.isPrimary) {
      await this.updateEmployeeManager(companyId, reportingLine.employeeId, null, null, userId);
    }

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.REPORTING_CHANGED,
      entityType: 'reporting_line',
      entityId: reportingLineId,
      entityName: `${reportingLine.employeeName} → ${reportingLine.managerName}`,
      newValues: {
        ended: true,
        reason: options.reason,
      },
      description: `Reporting ended: ${reportingLine.employeeName} no longer reports to ${reportingLine.managerName}`,
      effectiveDate: effectiveUntil,
      createdBy: userId,
    });

    return { ...reportingLine, ...updates } as ReportingLine;
  }

  // --------------------------------------------------------------------------
  // Change Reporting (End old, create new)
  // --------------------------------------------------------------------------
  async changeReporting(
    companyId: string,
    input: {
      employeeId: string;
      newManagerId: string;
      reportingType: ReportingType;
      effectiveDate: Date;
      reason?: string;
      endPreviousReporting?: boolean;
      projectId?: string;
    },
    userId: string
  ): Promise<ReportingLine> {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    const effectiveTimestamp = Timestamp.fromDate(input.effectiveDate);

    // End previous primary reporting line if requested
    if (input.endPreviousReporting !== false) {
      const existingPrimary = await this.getPrimaryReportingLine(companyId, input.employeeId);
      if (existingPrimary) {
        const existingRef = doc(this.getCollectionRef(companyId), existingPrimary.id);
        batch.update(existingRef, {
          effectiveUntil: effectiveTimestamp,
          reason: input.reason || 'Manager changed',
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    await batch.commit();

    // Create new reporting line
    return this.createReportingLine(
      companyId,
      {
        employeeId: input.employeeId,
        managerId: input.newManagerId,
        reportingType: input.reportingType,
        isPrimary: input.reportingType === REPORTING_TYPE.DIRECT,
        effectiveFrom: input.effectiveDate,
        reason: input.reason,
        projectId: input.projectId,
      },
      userId
    );
  }

  // --------------------------------------------------------------------------
  // Get Reporting Line
  // --------------------------------------------------------------------------
  async getReportingLine(companyId: string, reportingLineId: string): Promise<ReportingLine | null> {
    const docRef = doc(this.getCollectionRef(companyId), reportingLineId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? (snapshot.data() as ReportingLine) : null;
  }

  // --------------------------------------------------------------------------
  // Get Primary Reporting Line
  // --------------------------------------------------------------------------
  async getPrimaryReportingLine(companyId: string, employeeId: string): Promise<ReportingLine | null> {
    const q = query(
      this.getCollectionRef(companyId),
      where('employeeId', '==', employeeId),
      where('isPrimary', '==', true)
    );
    const snapshot = await getDocs(q);
    
    // Find active (not ended) primary line
    const activeLine = snapshot.docs
      .map(d => d.data() as ReportingLine)
      .find(r => !r.effectiveUntil);
    
    return activeLine || null;
  }

  // --------------------------------------------------------------------------
  // Get Reporting Lines with Filters
  // --------------------------------------------------------------------------
  async getReportingLines(filters: ReportingLineFilters): Promise<ReportingLine[]> {
    let q = query(this.getCollectionRef(filters.companyId));

    if (filters.employeeId) {
      q = query(q, where('employeeId', '==', filters.employeeId));
    }

    if (filters.managerId) {
      q = query(q, where('managerId', '==', filters.managerId));
    }

    if (filters.reportingType) {
      const types = Array.isArray(filters.reportingType) 
        ? filters.reportingType 
        : [filters.reportingType];
      q = query(q, where('reportingType', 'in', types));
    }

    if (filters.isPrimary !== undefined) {
      q = query(q, where('isPrimary', '==', filters.isPrimary));
    }

    if (filters.projectId) {
      q = query(q, where('projectId', '==', filters.projectId));
    }

    q = query(q, orderBy('effectiveFrom', 'desc'));

    const snapshot = await getDocs(q);
    let lines = snapshot.docs.map(doc => doc.data() as ReportingLine);

    // Filter by active status (client-side)
    if (filters.isActive !== undefined) {
      const now = Timestamp.now();
      lines = lines.filter(line => {
        const isActive = !line.effectiveUntil || line.effectiveUntil.toMillis() > now.toMillis();
        return filters.isActive ? isActive : !isActive;
      });
    }

    return lines;
  }

  // --------------------------------------------------------------------------
  // Get Reporting Chain (up to CEO)
  // --------------------------------------------------------------------------
  async getReportingChain(companyId: string, employeeId: string): Promise<ReportingLine[]> {
    const chain: ReportingLine[] = [];
    const visited = new Set<string>();
    let currentEmployeeId = employeeId;

    while (currentEmployeeId && !visited.has(currentEmployeeId)) {
      visited.add(currentEmployeeId);
      const primaryLine = await this.getPrimaryReportingLine(companyId, currentEmployeeId);
      
      if (primaryLine) {
        chain.push(primaryLine);
        currentEmployeeId = primaryLine.managerId;
      } else {
        break;
      }
    }

    return chain;
  }

  // --------------------------------------------------------------------------
  // Get Direct Reports
  // --------------------------------------------------------------------------
  async getDirectReports(
    companyId: string,
    managerId: string,
    includeAllTypes = false
  ): Promise<ReportingLine[]> {
    const filters: ReportingLineFilters = {
      companyId,
      managerId,
      isActive: true,
    };

    if (!includeAllTypes) {
      filters.reportingType = REPORTING_TYPE.DIRECT;
      filters.isPrimary = true;
    }

    return this.getReportingLines(filters);
  }

  // --------------------------------------------------------------------------
  // Get All Reports (Direct + Indirect)
  // --------------------------------------------------------------------------
  async getAllReports(companyId: string, managerId: string): Promise<string[]> {
    const allReportIds: string[] = [];
    const queue = [managerId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentManagerId = queue.shift()!;
      if (visited.has(currentManagerId)) continue;
      visited.add(currentManagerId);

      const directReports = await this.getDirectReports(companyId, currentManagerId);
      
      for (const report of directReports) {
        if (!visited.has(report.employeeId)) {
          allReportIds.push(report.employeeId);
          queue.push(report.employeeId);
        }
      }
    }

    return allReportIds;
  }

  // --------------------------------------------------------------------------
  // Get Team Summary
  // --------------------------------------------------------------------------
  async getTeamSummary(companyId: string, managerId: string): Promise<TeamSummary> {
    const manager = await this.getEmployeeReference(companyId, managerId);
    if (!manager) {
      throw new Error('Manager not found');
    }

    // Get all direct report lines (including dotted)
    const directReportLines = await this.getDirectReports(companyId, managerId, true);
    const allReportIds = await this.getAllReports(companyId, managerId);

    const directReports: DirectReport[] = [];
    const departmentCounts = new Map<string, DepartmentBreakdown>();
    const gradeCounts = new Map<JobGrade, number>();

    for (const line of directReportLines) {
      const employee = await this.getEmployeeReference(companyId, line.employeeId);
      if (!employee) continue;

      // Count subordinates for this employee
      const subordinateLines = await this.getDirectReports(companyId, line.employeeId);

      directReports.push({
        employeeId: line.employeeId,
        employeeName: line.employeeName,
        employeeNumber: line.employeeNumber,
        positionId: employee.positionId,
        positionTitle: employee.positionTitle,
        departmentId: employee.departmentId,
        departmentName: employee.departmentName,
        jobGrade: employee.jobGrade,
        reportingType: line.reportingType,
        startDate: line.effectiveFrom,
        photoUrl: employee.photoUrl,
        directReportsCount: subordinateLines.length,
      });

      // Department breakdown
      if (employee.departmentId && employee.departmentName) {
        const existing = departmentCounts.get(employee.departmentId);
        if (existing) {
          existing.count++;
        } else {
          departmentCounts.set(employee.departmentId, {
            departmentId: employee.departmentId,
            departmentName: employee.departmentName,
            count: 1,
          });
        }
      }

      // Grade breakdown
      if (employee.jobGrade) {
        gradeCounts.set(
          employee.jobGrade,
          (gradeCounts.get(employee.jobGrade) || 0) + 1
        );
      }
    }

    // Calculate span of control (only primary direct reports)
    const primaryDirectReports = directReports.filter(
      dr => dr.reportingType === REPORTING_TYPE.DIRECT
    );
    const spanOfControl = primaryDirectReports.length;

    // Get span guidelines based on manager's grade
    const managerGradeDetails = manager.jobGrade 
      ? getJobGradeDetails(manager.jobGrade) 
      : null;
    const managerLevel = managerGradeDetails?.level || 'management';
    const spanGuideline = SPAN_OF_CONTROL_GUIDELINES[managerLevel];
    const isHealthySpan = spanOfControl >= spanGuideline.min && spanOfControl <= spanGuideline.max;

    return {
      managerId,
      managerName: manager.name,
      managerPosition: manager.positionTitle,
      managerGrade: manager.jobGrade,
      directReports,
      totalDirectReports: directReports.length,
      totalIndirectReports: allReportIds.length - directReports.length,
      departmentBreakdown: Array.from(departmentCounts.values()),
      gradeBreakdown: Array.from(gradeCounts.entries()).map(([grade, count]) => ({
        grade,
        count,
      })),
      spanOfControl,
      isHealthySpan,
      spanGuideline,
    };
  }

  // --------------------------------------------------------------------------
  // Get Employee's Manager
  // --------------------------------------------------------------------------
  async getEmployeeManager(companyId: string, employeeId: string): Promise<EmployeeReference | null> {
    const primaryLine = await this.getPrimaryReportingLine(companyId, employeeId);
    if (!primaryLine) return null;
    
    return this.getEmployeeReference(companyId, primaryLine.managerId);
  }

  // --------------------------------------------------------------------------
  // Check if User is Manager of Employee
  // --------------------------------------------------------------------------
  async isManagerOf(
    companyId: string,
    potentialManagerId: string,
    employeeId: string,
    includeIndirect = false
  ): Promise<boolean> {
    if (includeIndirect) {
      const allReports = await this.getAllReports(companyId, potentialManagerId);
      return allReports.includes(employeeId);
    }

    const directReports = await this.getDirectReports(companyId, potentialManagerId);
    return directReports.some(r => r.employeeId === employeeId);
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------
  private async getEmployeeReference(
    companyId: string,
    employeeId: string
  ): Promise<EmployeeReference | null> {
    const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
    const snapshot = await getDoc(employeeRef);
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      id: employeeId,
      employeeNumber: data.employeeNumber,
      name: `${data.firstName} ${data.lastName}`,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      positionId: data.positionId,
      positionTitle: data.positionTitle,
      departmentId: data.departmentId,
      departmentName: data.departmentName,
      jobGrade: data.jobGrade,
      managerId: data.managerId,
      managerName: data.managerName,
      photoUrl: data.photoUrl,
      status: data.status,
    };
  }

  private async updateEmployeeManager(
    companyId: string,
    employeeId: string,
    managerId: string | null,
    managerName: string | null,
    userId: string
  ): Promise<void> {
    const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
    
    await updateDoc(employeeRef, {
      managerId: managerId || null,
      managerName: managerName || null,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  private async recordChange(
    companyId: string,
    change: Omit<OrganizationChange, 'id' | 'companyId' | 'createdAt' | 'approvalRequired'>
  ): Promise<void> {
    const changesRef = collection(db, 'companies', companyId, ORG_COLLECTIONS.ORG_CHANGES);
    const docRef = doc(changesRef);

    const record: OrganizationChange = {
      id: docRef.id,
      companyId,
      ...change,
      approvalRequired: false,
      createdAt: Timestamp.now(),
    };

    await setDoc(docRef, record);
  }
}

export const reportingLineService = new ReportingLineService();
