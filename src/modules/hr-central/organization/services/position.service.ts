// ============================================================================
// POSITION SERVICE - DawinOS HR Central
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
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';
import {
  Position,
  PositionIncumbent,
  CreatePositionInput,
  UpdatePositionInput,
  PositionFilters,
  OrganizationChange,
  EmployeeReference,
} from '../types/organization.types';
import {
  ORG_COLLECTIONS,
  POSITION_STATUS,
  ORG_CHANGE_TYPE,
  REPORTING_TYPE,
  JOB_GRADE_DETAILS,
  PositionStatus,
} from '../constants/organization.constants';
import { generatePositionCode } from '../utils/organization.utils';
import { departmentService } from './department.service';

class PositionService {
  private getCollectionRef(companyId: string) {
    return collection(db, 'companies', companyId, ORG_COLLECTIONS.POSITIONS);
  }

  // --------------------------------------------------------------------------
  // Create Position
  // --------------------------------------------------------------------------
  async createPosition(
    companyId: string,
    input: CreatePositionInput,
    userId: string
  ): Promise<Position> {
    const colRef = this.getCollectionRef(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    // Get department
    const department = await departmentService.getDepartment(companyId, input.departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    // Generate code if not provided
    const code = input.code || await this.generateNextCode(companyId, department.code, input.title);

    // Check for duplicate code
    const existingByCode = await this.getPositionByCode(companyId, code);
    if (existingByCode) {
      throw new Error(`Position with code "${code}" already exists`);
    }

    // Get grade details for salary defaults
    const gradeDetails = JOB_GRADE_DETAILS[input.jobGrade];
    const salaryMin = input.salaryGradeMin ?? gradeDetails.salaryMin;
    const salaryMax = input.salaryGradeMax ?? gradeDetails.salaryMax;
    const salaryMidpoint = (salaryMin + salaryMax) / 2;

    // Get reports to position info
    let reportsToPositionTitle: string | undefined;
    let reportsToEmployeeId: string | undefined;
    let reportsToEmployeeName: string | undefined;

    if (input.reportsToPositionId) {
      const reportsToPosition = await this.getPosition(companyId, input.reportsToPositionId);
      if (reportsToPosition) {
        reportsToPositionTitle = reportsToPosition.title;
        // Get primary incumbent
        const primaryIncumbent = reportsToPosition.incumbents.find(i => i.isPrimary && !i.endDate);
        if (primaryIncumbent) {
          reportsToEmployeeId = primaryIncumbent.employeeId;
          reportsToEmployeeName = primaryIncumbent.employeeName;
        }
      }
    }

    const headcount = input.headcount || 1;

    const position: Position = {
      id: docRef.id,
      companyId,
      departmentId: input.departmentId,
      departmentName: department.name,
      code,
      title: input.title,
      shortTitle: input.shortTitle,
      description: input.description,
      type: input.type,
      status: POSITION_STATUS.VACANT,
      jobGrade: input.jobGrade,
      jobFamilyId: input.jobFamilyId,
      reportsToPositionId: input.reportsToPositionId,
      reportsToPositionTitle,
      reportsToEmployeeId,
      reportsToEmployeeName,
      reportingType: input.reportingType || REPORTING_TYPE.DIRECT,
      headcount,
      filledCount: 0,
      salaryGradeMin: salaryMin,
      salaryGradeMax: salaryMax,
      salaryMidpoint,
      allowances: input.allowances,
      minEducation: input.minEducation,
      minExperience: input.minExperience,
      requiredSkills: input.requiredSkills,
      preferredSkills: input.preferredSkills,
      certifications: input.certifications,
      workLocation: input.workLocation,
      travelRequired: input.travelRequired,
      workingHours: input.workingHours,
      incumbents: [],
      establishedDate: now,
      effectiveFrom: input.effectiveFrom ? Timestamp.fromDate(input.effectiveFrom) : now,
      showInOrgChart: input.showInOrgChart ?? true,
      sortOrder: 0,
      tags: input.tags,
      notes: input.notes,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await setDoc(docRef, position);

    // Update department headcount
    await departmentService.updateHeadcount(
      companyId,
      input.departmentId,
      { approved: headcount, vacant: headcount },
      userId
    );

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.POSITION_CREATED,
      entityType: 'position',
      entityId: position.id,
      entityName: position.title,
      newValues: {
        code,
        title: input.title,
        grade: input.jobGrade,
        departmentId: input.departmentId,
      },
      description: `Position "${position.title}" created in ${department.name}`,
      effectiveDate: position.effectiveFrom,
      createdBy: userId,
    });

    return position;
  }

  // --------------------------------------------------------------------------
  // Update Position
  // --------------------------------------------------------------------------
  async updatePosition(
    companyId: string,
    positionId: string,
    input: UpdatePositionInput,
    userId: string
  ): Promise<Position> {
    const position = await this.getPosition(companyId, positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    const now = Timestamp.now();
    const updates: Partial<Position> = {
      updatedAt: now,
      updatedBy: userId,
    };

    // Copy simple fields
    if (input.title !== undefined) updates.title = input.title;
    if (input.shortTitle !== undefined) updates.shortTitle = input.shortTitle;
    if (input.description !== undefined) updates.description = input.description;
    if (input.type !== undefined) updates.type = input.type;
    if (input.jobFamilyId !== undefined) updates.jobFamilyId = input.jobFamilyId;
    if (input.reportingType !== undefined) updates.reportingType = input.reportingType;
    if (input.allowances !== undefined) updates.allowances = input.allowances;
    if (input.minEducation !== undefined) updates.minEducation = input.minEducation;
    if (input.minExperience !== undefined) updates.minExperience = input.minExperience;
    if (input.requiredSkills !== undefined) updates.requiredSkills = input.requiredSkills;
    if (input.preferredSkills !== undefined) updates.preferredSkills = input.preferredSkills;
    if (input.certifications !== undefined) updates.certifications = input.certifications;
    if (input.workLocation !== undefined) updates.workLocation = input.workLocation;
    if (input.travelRequired !== undefined) updates.travelRequired = input.travelRequired;
    if (input.workingHours !== undefined) updates.workingHours = input.workingHours;
    if (input.showInOrgChart !== undefined) updates.showInOrgChart = input.showInOrgChart;
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.notes !== undefined) updates.notes = input.notes;

    // Handle grade change
    if (input.jobGrade && input.jobGrade !== position.jobGrade) {
      updates.jobGrade = input.jobGrade;
      const gradeDetails = JOB_GRADE_DETAILS[input.jobGrade];
      if (input.salaryGradeMin === undefined) {
        updates.salaryGradeMin = gradeDetails.salaryMin;
      }
      if (input.salaryGradeMax === undefined) {
        updates.salaryGradeMax = gradeDetails.salaryMax;
      }
    }

    // Handle salary updates
    if (input.salaryGradeMin !== undefined) updates.salaryGradeMin = input.salaryGradeMin;
    if (input.salaryGradeMax !== undefined) updates.salaryGradeMax = input.salaryGradeMax;
    
    // Recalculate midpoint
    const newMin = updates.salaryGradeMin ?? position.salaryGradeMin;
    const newMax = updates.salaryGradeMax ?? position.salaryGradeMax;
    updates.salaryMidpoint = (newMin + newMax) / 2;

    // Handle department change
    if (input.departmentId && input.departmentId !== position.departmentId) {
      const newDept = await departmentService.getDepartment(companyId, input.departmentId);
      if (!newDept) {
        throw new Error('New department not found');
      }

      updates.departmentId = input.departmentId;
      updates.departmentName = newDept.name;

      // Update old department headcount
      await departmentService.updateHeadcount(
        companyId,
        position.departmentId,
        {
          approved: -position.headcount,
          current: -position.filledCount,
          vacant: -(position.headcount - position.filledCount),
        },
        userId
      );

      // Update new department headcount
      await departmentService.updateHeadcount(
        companyId,
        input.departmentId,
        {
          approved: position.headcount,
          current: position.filledCount,
          vacant: position.headcount - position.filledCount,
        },
        userId
      );
    }

    // Handle headcount change
    if (input.headcount !== undefined && input.headcount !== position.headcount) {
      const delta = input.headcount - position.headcount;
      updates.headcount = input.headcount;
      
      await departmentService.updateHeadcount(
        companyId,
        input.departmentId || position.departmentId,
        { approved: delta, vacant: delta },
        userId
      );
    }

    // Handle reports to change
    if (input.reportsToPositionId !== undefined) {
      updates.reportsToPositionId = input.reportsToPositionId;
      if (input.reportsToPositionId) {
        const reportsTo = await this.getPosition(companyId, input.reportsToPositionId);
        if (reportsTo) {
          updates.reportsToPositionTitle = reportsTo.title;
          const primaryIncumbent = reportsTo.incumbents.find(i => i.isPrimary && !i.endDate);
          if (primaryIncumbent) {
            updates.reportsToEmployeeId = primaryIncumbent.employeeId;
            updates.reportsToEmployeeName = primaryIncumbent.employeeName;
          }
        }
      } else {
        updates.reportsToPositionTitle = undefined;
        updates.reportsToEmployeeId = undefined;
        updates.reportsToEmployeeName = undefined;
      }
    }

    // Handle dates
    if (input.effectiveFrom) {
      updates.effectiveFrom = Timestamp.fromDate(input.effectiveFrom);
    }
    if (input.effectiveUntil) {
      updates.effectiveUntil = Timestamp.fromDate(input.effectiveUntil);
    }
    if (input.frozenUntil) {
      updates.frozenUntil = Timestamp.fromDate(input.frozenUntil);
    }

    const docRef = doc(this.getCollectionRef(companyId), positionId);
    await updateDoc(docRef, updates);

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.POSITION_UPDATED,
      entityType: 'position',
      entityId: positionId,
      entityName: position.title,
      previousValues: {
        title: position.title,
        grade: position.jobGrade,
        departmentId: position.departmentId,
      },
      newValues: {
        title: input.title,
        grade: input.jobGrade,
        departmentId: input.departmentId,
      },
      description: `Position "${position.title}" updated`,
      effectiveDate: now,
      createdBy: userId,
    });

    return { ...position, ...updates } as Position;
  }

  // --------------------------------------------------------------------------
  // Freeze Position
  // --------------------------------------------------------------------------
  async freezePosition(
    companyId: string,
    positionId: string,
    options: { frozenUntil?: Date; reason: string },
    userId: string
  ): Promise<Position> {
    const position = await this.getPosition(companyId, positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    const now = Timestamp.now();
    const updates: Partial<Position> = {
      status: POSITION_STATUS.FROZEN,
      statusChangedAt: now,
      statusChangedBy: userId,
      statusReason: options.reason,
      frozenUntil: options.frozenUntil ? Timestamp.fromDate(options.frozenUntil) : undefined,
      updatedAt: now,
      updatedBy: userId,
    };

    const docRef = doc(this.getCollectionRef(companyId), positionId);
    await updateDoc(docRef, updates);

    // Update department headcount if position is vacant
    if (position.filledCount === 0) {
      await departmentService.updateHeadcount(
        companyId,
        position.departmentId,
        { frozen: 1, vacant: -1 },
        userId
      );
    }

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.POSITION_FROZEN,
      entityType: 'position',
      entityId: positionId,
      entityName: position.title,
      newValues: {
        reason: options.reason,
        frozenUntil: options.frozenUntil,
      },
      description: `Position "${position.title}" frozen: ${options.reason}`,
      effectiveDate: now,
      createdBy: userId,
    });

    return { ...position, ...updates } as Position;
  }

  // --------------------------------------------------------------------------
  // Unfreeze Position
  // --------------------------------------------------------------------------
  async unfreezePosition(
    companyId: string,
    positionId: string,
    userId: string
  ): Promise<Position> {
    const position = await this.getPosition(companyId, positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    if (position.status !== POSITION_STATUS.FROZEN) {
      throw new Error('Position is not frozen');
    }

    const now = Timestamp.now();
    const newStatus = position.filledCount > 0 ? POSITION_STATUS.ACTIVE : POSITION_STATUS.VACANT;
    
    const updates: Partial<Position> = {
      status: newStatus,
      statusChangedAt: now,
      statusChangedBy: userId,
      statusReason: 'Unfrozen',
      frozenUntil: undefined,
      updatedAt: now,
      updatedBy: userId,
    };

    const docRef = doc(this.getCollectionRef(companyId), positionId);
    await updateDoc(docRef, updates);

    // Update department headcount
    if (position.filledCount === 0) {
      await departmentService.updateHeadcount(
        companyId,
        position.departmentId,
        { frozen: -1, vacant: 1 },
        userId
      );
    }

    return { ...position, ...updates } as Position;
  }

  // --------------------------------------------------------------------------
  // Discontinue Position
  // --------------------------------------------------------------------------
  async discontinuePosition(
    companyId: string,
    positionId: string,
    reason: string,
    userId: string
  ): Promise<Position> {
    const position = await this.getPosition(companyId, positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    if (position.filledCount > 0) {
      throw new Error('Cannot discontinue position with active incumbents');
    }

    const now = Timestamp.now();
    const updates: Partial<Position> = {
      status: POSITION_STATUS.DISCONTINUED,
      statusChangedAt: now,
      statusChangedBy: userId,
      statusReason: reason,
      effectiveUntil: now,
      updatedAt: now,
      updatedBy: userId,
    };

    const docRef = doc(this.getCollectionRef(companyId), positionId);
    await updateDoc(docRef, updates);

    // Update department headcount
    await departmentService.updateHeadcount(
      companyId,
      position.departmentId,
      { approved: -position.headcount, vacant: -position.headcount },
      userId
    );

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.POSITION_DISCONTINUED,
      entityType: 'position',
      entityId: positionId,
      entityName: position.title,
      newValues: { reason },
      description: `Position "${position.title}" discontinued: ${reason}`,
      effectiveDate: now,
      createdBy: userId,
    });

    return { ...position, ...updates } as Position;
  }

  // --------------------------------------------------------------------------
  // Assign Employee
  // --------------------------------------------------------------------------
  async assignEmployee(
    companyId: string,
    positionId: string,
    input: { employeeId: string; isPrimary?: boolean; fte?: number; assignedDate?: Date },
    userId: string
  ): Promise<Position> {
    const position = await this.getPosition(companyId, positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    if (position.filledCount >= position.headcount) {
      throw new Error('Position is fully staffed');
    }

    if (position.status === POSITION_STATUS.FROZEN) {
      throw new Error('Cannot assign to frozen position');
    }

    if (position.status === POSITION_STATUS.DISCONTINUED) {
      throw new Error('Cannot assign to discontinued position');
    }

    // Check if employee already assigned
    const existingAssignment = position.incumbents.find(
      i => i.employeeId === input.employeeId && !i.endDate
    );
    if (existingAssignment) {
      throw new Error('Employee already assigned to this position');
    }

    // Get employee details
    const employee = await this.getEmployeeReference(companyId, input.employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const now = Timestamp.now();
    const incumbent: PositionIncumbent = {
      employeeId: input.employeeId,
      employeeName: employee.name,
      employeeNumber: employee.employeeNumber,
      assignedDate: input.assignedDate ? Timestamp.fromDate(input.assignedDate) : now,
      assignedBy: userId,
      isPrimary: input.isPrimary ?? true,
      fte: input.fte ?? 1,
    };

    const newFilledCount = position.filledCount + 1;
    const newStatus = newFilledCount >= position.headcount 
      ? POSITION_STATUS.ACTIVE 
      : POSITION_STATUS.ACTIVE;

    const docRef = doc(this.getCollectionRef(companyId), positionId);
    await updateDoc(docRef, {
      incumbents: arrayUnion(incumbent),
      filledCount: increment(1),
      status: newStatus,
      updatedAt: now,
      updatedBy: userId,
    });

    // Update department headcount
    await departmentService.updateHeadcount(
      companyId,
      position.departmentId,
      { current: 1, vacant: -1 },
      userId
    );

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.POSITION_ASSIGNED,
      entityType: 'position',
      entityId: positionId,
      entityName: position.title,
      relatedEntityType: 'employee',
      relatedEntityId: input.employeeId,
      relatedEntityName: employee.name,
      description: `${employee.name} assigned to "${position.title}"`,
      effectiveDate: incumbent.assignedDate,
      createdBy: userId,
    });

    return {
      ...position,
      incumbents: [...position.incumbents, incumbent],
      filledCount: newFilledCount,
      status: newStatus,
    };
  }

  // --------------------------------------------------------------------------
  // Remove Employee
  // --------------------------------------------------------------------------
  async removeEmployee(
    companyId: string,
    positionId: string,
    employeeId: string,
    options: { endDate?: Date; reason?: string },
    userId: string
  ): Promise<Position> {
    const position = await this.getPosition(companyId, positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    const incumbentIndex = position.incumbents.findIndex(
      i => i.employeeId === employeeId && !i.endDate
    );
    if (incumbentIndex === -1) {
      throw new Error('Employee not assigned to this position');
    }

    const incumbent = position.incumbents[incumbentIndex];
    const now = Timestamp.now();
    const endDate = options.endDate ? Timestamp.fromDate(options.endDate) : now;

    // Update incumbent with end date
    const updatedIncumbent: PositionIncumbent = {
      ...incumbent,
      endDate,
      endReason: options.reason,
    };

    const updatedIncumbents = position.incumbents.map((inc, idx) =>
      idx === incumbentIndex ? updatedIncumbent : inc
    );

    const newFilledCount = position.filledCount - 1;
    const newStatus = newFilledCount === 0 ? POSITION_STATUS.VACANT : POSITION_STATUS.ACTIVE;

    const docRef = doc(this.getCollectionRef(companyId), positionId);
    await updateDoc(docRef, {
      incumbents: updatedIncumbents,
      filledCount: newFilledCount,
      status: newStatus,
      updatedAt: now,
      updatedBy: userId,
    });

    // Update department headcount
    await departmentService.updateHeadcount(
      companyId,
      position.departmentId,
      { current: -1, vacant: 1 },
      userId
    );

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.POSITION_VACATED,
      entityType: 'position',
      entityId: positionId,
      entityName: position.title,
      relatedEntityType: 'employee',
      relatedEntityId: employeeId,
      relatedEntityName: incumbent.employeeName,
      newValues: { reason: options.reason },
      description: `${incumbent.employeeName} removed from "${position.title}"`,
      effectiveDate: endDate,
      createdBy: userId,
    });

    return {
      ...position,
      incumbents: updatedIncumbents,
      filledCount: newFilledCount,
      status: newStatus,
    };
  }

  // --------------------------------------------------------------------------
  // Get Position
  // --------------------------------------------------------------------------
  async getPosition(companyId: string, positionId: string): Promise<Position | null> {
    const docRef = doc(this.getCollectionRef(companyId), positionId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? (snapshot.data() as Position) : null;
  }

  // --------------------------------------------------------------------------
  // Get Position by Code
  // --------------------------------------------------------------------------
  async getPositionByCode(companyId: string, code: string): Promise<Position | null> {
    const q = query(
      this.getCollectionRef(companyId),
      where('code', '==', code)
    );
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : (snapshot.docs[0].data() as Position);
  }

  // --------------------------------------------------------------------------
  // Get Positions with Filters
  // --------------------------------------------------------------------------
  async getPositions(filters: PositionFilters): Promise<Position[]> {
    let q = query(this.getCollectionRef(filters.companyId));

    // Apply department filter
    if (filters.departmentId) {
      q = query(q, where('departmentId', '==', filters.departmentId));
    }

    // Apply status filter
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      q = query(q, where('status', 'in', statuses));
    } else if (!filters.includeDiscontinued) {
      q = query(q, where('status', '!=', POSITION_STATUS.DISCONTINUED));
    }

    // Apply type filter
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      q = query(q, where('type', 'in', types));
    }

    // Apply grade filter
    if (filters.jobGrade) {
      const grades = Array.isArray(filters.jobGrade) ? filters.jobGrade : [filters.jobGrade];
      q = query(q, where('jobGrade', 'in', grades));
    }

    // Apply reports to filter
    if (filters.reportsToPositionId) {
      q = query(q, where('reportsToPositionId', '==', filters.reportsToPositionId));
    }

    // Apply org chart visibility filter
    if (filters.showInOrgChart !== undefined) {
      q = query(q, where('showInOrgChart', '==', filters.showInOrgChart));
    }

    q = query(q, orderBy('sortOrder'), orderBy('title'));

    const snapshot = await getDocs(q);
    let positions = snapshot.docs.map(doc => doc.data() as Position);

    // Apply vacancy filter (client-side)
    if (filters.hasVacancies) {
      positions = positions.filter(p => p.filledCount < p.headcount);
    }

    // Apply text search (client-side)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      positions = positions.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.code.toLowerCase().includes(searchLower) ||
        p.shortTitle?.toLowerCase().includes(searchLower)
      );
    }

    return positions;
  }

  // --------------------------------------------------------------------------
  // Get Vacant Positions
  // --------------------------------------------------------------------------
  async getVacantPositions(companyId: string, departmentId?: string): Promise<Position[]> {
    return this.getPositions({
      companyId,
      departmentId,
      hasVacancies: true,
      status: [POSITION_STATUS.VACANT, POSITION_STATUS.ACTIVE],
    });
  }

  // --------------------------------------------------------------------------
  // Get Direct Report Positions
  // --------------------------------------------------------------------------
  async getDirectReportPositions(companyId: string, positionId: string): Promise<Position[]> {
    return this.getPositions({
      companyId,
      reportsToPositionId: positionId,
    });
  }

  // --------------------------------------------------------------------------
  // Get Positions by Department
  // --------------------------------------------------------------------------
  async getPositionsByDepartment(companyId: string, departmentId: string): Promise<Position[]> {
    return this.getPositions({
      companyId,
      departmentId,
    });
  }

  // --------------------------------------------------------------------------
  // Change Position Status
  // --------------------------------------------------------------------------
  async changePositionStatus(
    companyId: string,
    positionId: string,
    status: PositionStatus,
    reason: string,
    userId: string
  ): Promise<Position> {
    const position = await this.getPosition(companyId, positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    const now = Timestamp.now();
    const updates: Partial<Position> = {
      status,
      statusChangedAt: now,
      statusChangedBy: userId,
      statusReason: reason,
      updatedAt: now,
      updatedBy: userId,
    };

    const docRef = doc(this.getCollectionRef(companyId), positionId);
    await updateDoc(docRef, updates);

    return { ...position, ...updates } as Position;
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------
  private async generateNextCode(
    companyId: string,
    departmentCode: string,
    title: string
  ): Promise<string> {
    const positions = await this.getPositions({
      companyId,
      includeDiscontinued: true,
    });
    const deptPositions = positions.filter(p => p.code.startsWith(departmentCode));
    return generatePositionCode(departmentCode, title, deptPositions.length + 1);
  }

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

export const positionService = new PositionService();
