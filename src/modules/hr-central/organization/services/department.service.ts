// ============================================================================
// DEPARTMENT SERVICE - DawinOS HR Central
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';
import {
  Department,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  DepartmentFilters,
  OrganizationChange,
  MergeDepartmentsInput,
  DissolveDepartmentInput,
  HeadcountUpdateInput,
} from '../types/organization.types';
import {
  ORG_COLLECTIONS,
  DEPARTMENT_STATUS,
  ORG_CHANGE_TYPE,
  DepartmentStatus,
} from '../constants/organization.constants';
import {
  generateDepartmentCode,
  buildDepartmentPath,
  buildDepartmentPathNames,
  validateHierarchyDepth,
  hasCircularDependency,
  getDescendantDepartments,
} from '../utils/organization.utils';

class DepartmentService {
  private getCollectionRef(companyId: string) {
    return collection(db, 'companies', companyId, ORG_COLLECTIONS.DEPARTMENTS);
  }

  // --------------------------------------------------------------------------
  // Create Department
  // --------------------------------------------------------------------------
  async createDepartment(
    companyId: string,
    input: CreateDepartmentInput,
    userId: string
  ): Promise<Department> {
    const colRef = this.getCollectionRef(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    // Get parent department if exists
    let parentDept: Department | null = null;
    if (input.parentId) {
      parentDept = await this.getDepartment(companyId, input.parentId);
      if (!parentDept) {
        throw new Error('Parent department not found');
      }
    }

    // Generate code if not provided
    const code = input.code || await this.generateNextCode(companyId, input.name, parentDept?.code);

    // Check for duplicate code
    const existingByCode = await this.getDepartmentByCode(companyId, code);
    if (existingByCode) {
      throw new Error(`Department with code "${code}" already exists`);
    }

    // Build path
    const path = buildDepartmentPath(parentDept?.path, input.parentId || undefined);
    const pathNames = buildDepartmentPathNames(parentDept?.pathNames, parentDept?.name);
    const level = path.length;

    // Validate hierarchy depth
    if (!validateHierarchyDepth(path)) {
      throw new Error(`Maximum hierarchy depth of 8 levels exceeded`);
    }

    // Get next sort order
    const sortOrder = await this.getNextSortOrder(companyId, input.parentId || null);

    // Get head name if headId provided
    let headName: string | undefined;
    if (input.headId) {
      const head = await this.getEmployeeReference(companyId, input.headId);
      headName = head?.name;
    }

    const department: Department = {
      id: docRef.id,
      companyId,
      code,
      name: input.name,
      shortName: input.shortName,
      description: input.description,
      type: input.type,
      status: DEPARTMENT_STATUS.ACTIVE,
      parentId: input.parentId || null,
      path,
      pathNames,
      level,
      sortOrder,
      headId: input.headId,
      headName,
      email: input.email,
      phone: input.phone,
      location: input.location,
      costCenterId: input.costCenterId,
      budgetCode: input.budgetCode,
      approvedHeadcount: input.approvedHeadcount || 0,
      currentHeadcount: 0,
      vacantPositions: 0,
      frozenPositions: 0,
      establishedDate: input.establishedDate 
        ? Timestamp.fromDate(input.establishedDate) 
        : now,
      effectiveFrom: input.effectiveFrom 
        ? Timestamp.fromDate(input.effectiveFrom) 
        : now,
      color: input.color,
      icon: input.icon,
      showInOrgChart: input.showInOrgChart ?? true,
      expandedByDefault: true,
      tags: input.tags,
      notes: input.notes,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await setDoc(docRef, department);

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.DEPARTMENT_CREATED,
      entityType: 'department',
      entityId: department.id,
      entityName: department.name,
      newValues: {
        code,
        name: input.name,
        type: input.type,
        parentId: input.parentId,
      },
      description: `Department "${department.name}" (${code}) created`,
      effectiveDate: department.effectiveFrom,
      createdBy: userId,
    });

    return department;
  }

  // --------------------------------------------------------------------------
  // Update Department
  // --------------------------------------------------------------------------
  async updateDepartment(
    companyId: string,
    departmentId: string,
    input: UpdateDepartmentInput,
    userId: string
  ): Promise<Department> {
    const department = await this.getDepartment(companyId, departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    const now = Timestamp.now();
    const updates: Partial<Department> = {
      updatedAt: now,
      updatedBy: userId,
    };

    // Copy simple fields
    if (input.name !== undefined) updates.name = input.name;
    if (input.shortName !== undefined) updates.shortName = input.shortName;
    if (input.description !== undefined) updates.description = input.description;
    if (input.type !== undefined) updates.type = input.type;
    if (input.email !== undefined) updates.email = input.email;
    if (input.phone !== undefined) updates.phone = input.phone;
    if (input.location !== undefined) updates.location = input.location;
    if (input.building !== undefined) updates.building = input.building;
    if (input.floor !== undefined) updates.floor = input.floor;
    if (input.costCenterId !== undefined) updates.costCenterId = input.costCenterId;
    if (input.budgetCode !== undefined) updates.budgetCode = input.budgetCode;
    if (input.annualBudget !== undefined) updates.annualBudget = input.annualBudget;
    if (input.approvedHeadcount !== undefined) updates.approvedHeadcount = input.approvedHeadcount;
    if (input.color !== undefined) updates.color = input.color;
    if (input.icon !== undefined) updates.icon = input.icon;
    if (input.showInOrgChart !== undefined) updates.showInOrgChart = input.showInOrgChart;
    if (input.expandedByDefault !== undefined) updates.expandedByDefault = input.expandedByDefault;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.notes !== undefined) updates.notes = input.notes;

    // Handle parent change
    if (input.parentId !== undefined && input.parentId !== department.parentId) {
      // Check for circular dependency
      if (input.parentId) {
        const allDepts = await this.getDepartments({ companyId });
        const deptMap = new Map(allDepts.map(d => [d.id, d]));
        
        if (hasCircularDependency(departmentId, input.parentId, deptMap)) {
          throw new Error('Circular hierarchy detected');
        }

        const newParent = deptMap.get(input.parentId);
        if (!newParent) {
          throw new Error('New parent department not found');
        }

        updates.path = buildDepartmentPath(newParent.path, input.parentId);
        updates.pathNames = buildDepartmentPathNames(newParent.pathNames, newParent.name);
        updates.level = updates.path.length;

        if (!validateHierarchyDepth(updates.path)) {
          throw new Error('Maximum hierarchy depth exceeded');
        }
      } else {
        updates.path = [];
        updates.pathNames = [];
        updates.level = 0;
      }

      // Update child department paths
      await this.updateChildPaths(companyId, departmentId, updates.path!, updates.pathNames!, userId);
    }

    // Update head name if headId changed
    if (input.headId !== undefined) {
      if (input.headId) {
        const head = await this.getEmployeeReference(companyId, input.headId);
        updates.headName = head?.name;
      } else {
        updates.headName = undefined;
      }
    }

    // Convert dates
    if (input.effectiveFrom) {
      updates.effectiveFrom = Timestamp.fromDate(input.effectiveFrom);
    }
    if (input.effectiveUntil) {
      updates.effectiveUntil = Timestamp.fromDate(input.effectiveUntil);
    }

    const docRef = doc(this.getCollectionRef(companyId), departmentId);
    await updateDoc(docRef, updates);

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.DEPARTMENT_UPDATED,
      entityType: 'department',
      entityId: departmentId,
      entityName: department.name,
      previousValues: {
        name: department.name,
        type: department.type,
        parentId: department.parentId,
      },
      newValues: {
        name: input.name,
        type: input.type,
        parentId: input.parentId,
      },
      description: `Department "${department.name}" updated`,
      effectiveDate: now,
      createdBy: userId,
    });

    return { ...department, ...updates } as Department;
  }

  // --------------------------------------------------------------------------
  // Change Department Status
  // --------------------------------------------------------------------------
  async changeDepartmentStatus(
    companyId: string,
    departmentId: string,
    status: DepartmentStatus,
    reason: string,
    userId: string
  ): Promise<Department> {
    const department = await this.getDepartment(companyId, departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    const now = Timestamp.now();
    const updates: Partial<Department> = {
      status,
      statusChangedAt: now,
      statusChangedBy: userId,
      statusReason: reason,
      updatedAt: now,
      updatedBy: userId,
    };

    const docRef = doc(this.getCollectionRef(companyId), departmentId);
    await updateDoc(docRef, updates);

    return { ...department, ...updates } as Department;
  }

  // --------------------------------------------------------------------------
  // Merge Departments
  // --------------------------------------------------------------------------
  async mergeDepartments(
    companyId: string,
    input: MergeDepartmentsInput,
    userId: string
  ): Promise<Department> {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    const effectiveDate = Timestamp.fromDate(input.effectiveDate);

    // Get target department
    const targetDept = await this.getDepartment(companyId, input.targetDepartmentId);
    if (!targetDept) {
      throw new Error('Target department not found');
    }

    // Get source departments
    const sourceDepts: Department[] = [];
    for (const sourceId of input.sourceDepartmentIds) {
      const dept = await this.getDepartment(companyId, sourceId);
      if (!dept) {
        throw new Error(`Source department ${sourceId} not found`);
      }
      if (dept.id === targetDept.id) {
        throw new Error('Target department cannot be a source department');
      }
      sourceDepts.push(dept);
    }

    // Update target department
    const targetRef = doc(this.getCollectionRef(companyId), input.targetDepartmentId);
    const totalHeadcount = sourceDepts.reduce((sum, d) => sum + d.currentHeadcount, 0);
    const totalApproved = sourceDepts.reduce((sum, d) => sum + d.approvedHeadcount, 0);

    batch.update(targetRef, {
      name: input.newName || targetDept.name,
      approvedHeadcount: increment(totalApproved),
      currentHeadcount: increment(totalHeadcount),
      mergedFromIds: [...(targetDept.mergedFromIds || []), ...input.sourceDepartmentIds],
      updatedAt: now,
      updatedBy: userId,
    });

    // Mark source departments as merged
    for (const sourceDept of sourceDepts) {
      const sourceRef = doc(this.getCollectionRef(companyId), sourceDept.id);
      batch.update(sourceRef, {
        status: DEPARTMENT_STATUS.MERGED,
        statusChangedAt: now,
        statusChangedBy: userId,
        statusReason: input.reason,
        mergedIntoId: input.targetDepartmentId,
        effectiveUntil: effectiveDate,
        updatedAt: now,
        updatedBy: userId,
      });
    }

    await batch.commit();

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.DEPARTMENT_MERGED,
      entityType: 'department',
      entityId: input.targetDepartmentId,
      entityName: targetDept.name,
      previousValues: {
        sourceDepartments: sourceDepts.map(d => ({ id: d.id, name: d.name })),
      },
      newValues: {
        newName: input.newName,
        reason: input.reason,
      },
      description: `Departments merged into "${input.newName || targetDept.name}": ${sourceDepts.map(d => d.name).join(', ')}`,
      effectiveDate,
      createdBy: userId,
    });

    return this.getDepartment(companyId, input.targetDepartmentId) as Promise<Department>;
  }

  // --------------------------------------------------------------------------
  // Dissolve Department
  // --------------------------------------------------------------------------
  async dissolveDepartment(
    companyId: string,
    input: DissolveDepartmentInput,
    userId: string
  ): Promise<void> {
    const department = await this.getDepartment(companyId, input.departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    // Check for child departments
    const children = await this.getChildDepartments(companyId, input.departmentId);
    if (children.length > 0) {
      throw new Error('Cannot dissolve department with child departments');
    }

    // Check for employees if no target department
    if (department.currentHeadcount > 0 && !input.targetDepartmentId && input.handleEmployees === 'transfer') {
      throw new Error('Must specify target department for employee transfer');
    }

    const now = Timestamp.now();
    const effectiveDate = Timestamp.fromDate(input.effectiveDate);

    const docRef = doc(this.getCollectionRef(companyId), input.departmentId);
    await updateDoc(docRef, {
      status: DEPARTMENT_STATUS.DISSOLVED,
      statusChangedAt: now,
      statusChangedBy: userId,
      statusReason: input.reason,
      dissolvedReason: input.reason,
      effectiveUntil: effectiveDate,
      updatedAt: now,
      updatedBy: userId,
    });

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.DEPARTMENT_DISSOLVED,
      entityType: 'department',
      entityId: input.departmentId,
      entityName: department.name,
      newValues: {
        reason: input.reason,
        targetDepartmentId: input.targetDepartmentId,
        handleEmployees: input.handleEmployees,
      },
      description: `Department "${department.name}" dissolved: ${input.reason}`,
      effectiveDate,
      createdBy: userId,
    });
  }

  // --------------------------------------------------------------------------
  // Update Headcount
  // --------------------------------------------------------------------------
  async updateHeadcount(
    companyId: string,
    departmentId: string,
    changes: HeadcountUpdateInput,
    userId: string
  ): Promise<void> {
    const docRef = doc(this.getCollectionRef(companyId), departmentId);
    const updates: Record<string, ReturnType<typeof increment>> = {};

    if (changes.approved !== undefined) {
      updates.approvedHeadcount = increment(changes.approved);
    }
    if (changes.current !== undefined) {
      updates.currentHeadcount = increment(changes.current);
    }
    if (changes.vacant !== undefined) {
      updates.vacantPositions = increment(changes.vacant);
    }
    if (changes.frozen !== undefined) {
      updates.frozenPositions = increment(changes.frozen);
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Get Department
  // --------------------------------------------------------------------------
  async getDepartment(companyId: string, departmentId: string): Promise<Department | null> {
    const docRef = doc(this.getCollectionRef(companyId), departmentId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? (snapshot.data() as Department) : null;
  }

  // --------------------------------------------------------------------------
  // Get Department by Code
  // --------------------------------------------------------------------------
  async getDepartmentByCode(companyId: string, code: string): Promise<Department | null> {
    const q = query(
      this.getCollectionRef(companyId),
      where('code', '==', code)
    );
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : (snapshot.docs[0].data() as Department);
  }

  // --------------------------------------------------------------------------
  // Get Departments with Filters
  // --------------------------------------------------------------------------
  async getDepartments(filters: DepartmentFilters): Promise<Department[]> {
    let q = query(this.getCollectionRef(filters.companyId));

    // Apply status filter
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      q = query(q, where('status', 'in', statuses));
    } else if (!filters.includeInactive) {
      q = query(q, where('status', '==', DEPARTMENT_STATUS.ACTIVE));
    }

    // Apply type filter
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      q = query(q, where('type', 'in', types));
    }

    // Apply parent filter
    if (filters.parentId !== undefined) {
      q = query(q, where('parentId', '==', filters.parentId));
    }

    // Apply head filter
    if (filters.headId) {
      q = query(q, where('headId', '==', filters.headId));
    }

    // Apply cost center filter
    if (filters.costCenterId) {
      q = query(q, where('costCenterId', '==', filters.costCenterId));
    }

    // Apply org chart visibility filter
    if (filters.showInOrgChart !== undefined) {
      q = query(q, where('showInOrgChart', '==', filters.showInOrgChart));
    }

    // Order by level and sort order
    q = query(q, orderBy('level'), orderBy('sortOrder'));

    const snapshot = await getDocs(q);
    let departments = snapshot.docs.map(doc => doc.data() as Department);

    // Apply text search (client-side)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      departments = departments.filter(dept =>
        dept.name.toLowerCase().includes(searchLower) ||
        dept.code.toLowerCase().includes(searchLower) ||
        dept.shortName?.toLowerCase().includes(searchLower)
      );
    }

    return departments;
  }

  // --------------------------------------------------------------------------
  // Get Child Departments
  // --------------------------------------------------------------------------
  async getChildDepartments(companyId: string, parentId: string): Promise<Department[]> {
    return this.getDepartments({
      companyId,
      parentId,
      includeInactive: false,
    });
  }

  // --------------------------------------------------------------------------
  // Get Root Departments
  // --------------------------------------------------------------------------
  async getRootDepartments(companyId: string): Promise<Department[]> {
    return this.getDepartments({
      companyId,
      parentId: null,
      includeInactive: false,
    });
  }

  // --------------------------------------------------------------------------
  // Get Department Hierarchy
  // --------------------------------------------------------------------------
  async getDepartmentHierarchy(companyId: string, departmentId: string): Promise<Department[]> {
    const department = await this.getDepartment(companyId, departmentId);
    if (!department) return [];

    const hierarchy: Department[] = [];
    
    // Get ancestors from path
    for (const ancestorId of department.path) {
      const ancestor = await this.getDepartment(companyId, ancestorId);
      if (ancestor) hierarchy.push(ancestor);
    }

    // Add current department
    hierarchy.push(department);

    return hierarchy;
  }

  // --------------------------------------------------------------------------
  // Get All Descendant Departments
  // --------------------------------------------------------------------------
  async getAllDescendants(companyId: string, departmentId: string): Promise<Department[]> {
    const allDepts = await this.getDepartments({ companyId, includeInactive: true });
    const descendantIds = getDescendantDepartments(departmentId, allDepts);
    return allDepts.filter(d => descendantIds.includes(d.id));
  }

  // --------------------------------------------------------------------------
  // Delete Department
  // --------------------------------------------------------------------------
  async deleteDepartment(companyId: string, departmentId: string, userId: string): Promise<void> {
    const department = await this.getDepartment(companyId, departmentId);
    if (!department) {
      throw new Error('Department not found');
    }

    // Check for child departments
    const children = await this.getChildDepartments(companyId, departmentId);
    if (children.length > 0) {
      throw new Error('Cannot delete department with child departments');
    }

    // Check for employees
    if (department.currentHeadcount > 0) {
      throw new Error('Cannot delete department with active employees');
    }

    const docRef = doc(this.getCollectionRef(companyId), departmentId);
    await deleteDoc(docRef);

    // Record change
    await this.recordChange(companyId, {
      changeType: ORG_CHANGE_TYPE.DEPARTMENT_DISSOLVED,
      entityType: 'department',
      entityId: departmentId,
      entityName: department.name,
      description: `Department "${department.name}" deleted`,
      effectiveDate: Timestamp.now(),
      createdBy: userId,
    });
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------
  private async generateNextCode(
    companyId: string,
    name: string,
    parentCode?: string
  ): Promise<string> {
    const baseCode = generateDepartmentCode(name, parentCode);
    
    // Check if code exists
    const existing = await this.getDepartmentByCode(companyId, baseCode);
    if (!existing) return baseCode;

    // Append number if exists
    let counter = 1;
    let newCode = `${baseCode}${counter}`;
    while (await this.getDepartmentByCode(companyId, newCode)) {
      counter++;
      newCode = `${baseCode}${counter}`;
    }
    return newCode;
  }

  private async getNextSortOrder(companyId: string, parentId: string | null): Promise<number> {
    const siblings = await this.getDepartments({
      companyId,
      parentId,
      includeInactive: true,
    });
    
    if (siblings.length === 0) return 0;
    return Math.max(...siblings.map(d => d.sortOrder)) + 1;
  }

  private async updateChildPaths(
    companyId: string,
    parentId: string,
    newParentPath: string[],
    newParentPathNames: string[],
    userId: string
  ): Promise<void> {
    const allDepts = await this.getDepartments({ companyId, includeInactive: true });
    const parent = allDepts.find(d => d.id === parentId);
    if (!parent) return;

    const descendantIds = getDescendantDepartments(parentId, allDepts);
    const batch = writeBatch(db);
    const now = Timestamp.now();

    for (const descendantId of descendantIds) {
      const descendant = allDepts.find(d => d.id === descendantId);
      if (!descendant) continue;

      // Find position in old path and rebuild
      const oldParentIndex = descendant.path.indexOf(parentId);
      const relativePath = descendant.path.slice(oldParentIndex);
      const relativePathNames = descendant.pathNames.slice(oldParentIndex);

      const newPath = [...newParentPath, parentId, ...relativePath.slice(1)];
      const newPathNames = [...newParentPathNames, parent.name, ...relativePathNames.slice(1)];

      const docRef = doc(this.getCollectionRef(companyId), descendantId);
      batch.update(docRef, {
        path: newPath,
        pathNames: newPathNames,
        level: newPath.length,
        updatedAt: now,
        updatedBy: userId,
      });
    }

    await batch.commit();
  }

  private async getEmployeeReference(
    companyId: string,
    employeeId: string
  ): Promise<{ id: string; name: string } | null> {
    const employeeRef = doc(db, 'companies', companyId, 'employees', employeeId);
    const snapshot = await getDoc(employeeRef);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
      id: employeeId,
      name: `${data.firstName} ${data.lastName}`,
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

export const departmentService = new DepartmentService();
