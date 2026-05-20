/**
 * Firestore Security Rules Tests - DawinOS v2.0
 * Run with: firebase emulators:exec 'npm test'
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'dawinos-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ============================================
// HR Employee Rules
// ============================================

describe('HR Employee Rules', () => {
  test('HR can read all employees', async () => {
    const hrUser = testEnv.authenticatedContext('hr-user', {
      role: 'hr_admin',
      subsidiaryId: 'finishes',
    });
    
    // Create test employee
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'hr/employees/emp-001'), {
        personalInfo: { firstName: 'John', lastName: 'Doe' },
        employment: { subsidiaryId: 'finishes' },
        status: 'active',
        userId: 'other-user',
      });
    });
    
    const db = hrUser.firestore();
    await assertSucceeds(getDoc(doc(db, 'hr/employees/emp-001')));
  });
  
  test('Employee can read own record', async () => {
    const empUser = testEnv.authenticatedContext('emp-user', {
      role: 'staff',
      subsidiaryId: 'finishes',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'hr/employees/emp-001'), {
        personalInfo: { firstName: 'John', lastName: 'Doe' },
        employment: { subsidiaryId: 'finishes' },
        status: 'active',
        userId: 'emp-user',
      });
    });
    
    const db = empUser.firestore();
    await assertSucceeds(getDoc(doc(db, 'hr/employees/emp-001')));
  });
  
  test('Employee cannot read other employee records', async () => {
    const empUser = testEnv.authenticatedContext('emp-user', {
      role: 'staff',
      subsidiaryId: 'finishes',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'hr/employees/emp-002'), {
        personalInfo: { firstName: 'Jane', lastName: 'Doe' },
        employment: { subsidiaryId: 'finishes' },
        status: 'active',
        userId: 'other-user',
      });
    });
    
    const db = empUser.firestore();
    await assertFails(getDoc(doc(db, 'hr/employees/emp-002')));
  });
  
  test('Regular employee cannot create employee records', async () => {
    const empUser = testEnv.authenticatedContext('emp-user', {
      role: 'staff',
      subsidiaryId: 'finishes',
    });
    
    const db = empUser.firestore();
    await assertFails(setDoc(doc(db, 'hr/employees/new-emp'), {
      personalInfo: { firstName: 'New', lastName: 'Employee' },
      employment: { subsidiaryId: 'finishes' },
      status: 'active',
    }));
  });
  
  test('HR can create employee records', async () => {
    const hrUser = testEnv.authenticatedContext('hr-user', {
      role: 'hr_admin',
      subsidiaryId: 'finishes',
    });
    
    const db = hrUser.firestore();
    await assertSucceeds(setDoc(doc(db, 'hr/employees/new-emp'), {
      personalInfo: { firstName: 'New', lastName: 'Employee' },
      employment: { subsidiaryId: 'finishes' },
      status: 'active',
    }));
  });
});

// ============================================
// Smart Task Rules
// ============================================

describe('Smart Task Rules', () => {
  test('User can read tasks assigned to them', async () => {
    const user = testEnv.authenticatedContext('task-user', {
      role: 'staff',
      subsidiaryId: 'advisory',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shared_ops/smart_tasks/task-001'), {
        title: 'Test Task',
        assignedTo: 'task-user',
        status: 'pending',
        createdBy: 'other-user',
        createdAt: new Date(),
      });
    });
    
    const db = user.firestore();
    await assertSucceeds(getDoc(doc(db, 'shared_ops/smart_tasks/task-001')));
  });
  
  test('User can read tasks they created', async () => {
    const user = testEnv.authenticatedContext('task-user', {
      role: 'staff',
      subsidiaryId: 'advisory',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shared_ops/smart_tasks/task-002'), {
        title: 'Test Task',
        assignedTo: 'other-user',
        status: 'pending',
        createdBy: 'task-user',
        createdAt: new Date(),
      });
    });
    
    const db = user.firestore();
    await assertSucceeds(getDoc(doc(db, 'shared_ops/smart_tasks/task-002')));
  });
  
  test('User cannot read unrelated tasks', async () => {
    const user = testEnv.authenticatedContext('task-user', {
      role: 'staff',
      subsidiaryId: 'advisory',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shared_ops/smart_tasks/task-003'), {
        title: 'Other Task',
        assignedTo: 'other-user',
        status: 'pending',
        createdBy: 'another-user',
        createdAt: new Date(),
      });
    });
    
    const db = user.firestore();
    await assertFails(getDoc(doc(db, 'shared_ops/smart_tasks/task-003')));
  });
  
  test('User can create tasks', async () => {
    const user = testEnv.authenticatedContext('task-user', {
      role: 'staff',
      subsidiaryId: 'advisory',
    });
    
    const db = user.firestore();
    await assertSucceeds(setDoc(doc(db, 'shared_ops/smart_tasks/new-task'), {
      title: 'New Task',
      assignedTo: 'task-user',
      status: 'pending',
      createdBy: 'task-user',
      createdAt: new Date(),
    }));
  });
});

// ============================================
// Executive Module Rules
// ============================================

describe('Executive Module Rules', () => {
  test('Executive can read strategy documents', async () => {
    const execUser = testEnv.authenticatedContext('exec-user', {
      role: 'executive',
      subsidiaryId: 'finishes',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'executive/strategy/documents/doc-001'), {
        title: 'Strategy Doc',
        content: 'Content here',
        createdBy: 'other-exec',
        createdAt: new Date(),
      });
    });
    
    const db = execUser.firestore();
    await assertSucceeds(getDoc(doc(db, 'executive/strategy/documents/doc-001')));
  });
  
  test('Non-executive cannot read strategy documents', async () => {
    const staffUser = testEnv.authenticatedContext('staff-user', {
      role: 'staff',
      subsidiaryId: 'finishes',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'executive/strategy/documents/doc-001'), {
        title: 'Strategy Doc',
        content: 'Confidential',
        createdBy: 'exec-user',
        createdAt: new Date(),
      });
    });
    
    const db = staffUser.firestore();
    await assertFails(getDoc(doc(db, 'executive/strategy/documents/doc-001')));
  });
  
  test('Executive can create strategy documents', async () => {
    const execUser = testEnv.authenticatedContext('exec-user', {
      role: 'executive',
      subsidiaryId: 'finishes',
    });
    
    const db = execUser.firestore();
    await assertSucceeds(setDoc(doc(db, 'executive/strategy/documents/new-doc'), {
      title: 'New Strategy',
      content: 'Content',
      createdBy: 'exec-user',
      createdAt: new Date(),
    }));
  });
});

// ============================================
// Payroll Rules
// ============================================

describe('Payroll Rules', () => {
  test('Payroll records can never be deleted', async () => {
    const adminUser = testEnv.authenticatedContext('admin-user', {
      role: 'platform_admin',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'hr/payroll_batches/batch-001'), {
        period: { month: 1, year: 2026 },
        status: 'completed',
      });
    });
    
    const db = adminUser.firestore();
    // Even admin cannot delete payroll records
    await assertFails(deleteDoc(doc(db, 'hr/payroll_batches/batch-001')));
  });
  
  test('HR can read payroll batches', async () => {
    const hrUser = testEnv.authenticatedContext('hr-user', {
      role: 'hr_admin',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'hr/payroll_batches/batch-001'), {
        period: { month: 1, year: 2026 },
        status: 'completed',
      });
    });
    
    const db = hrUser.firestore();
    await assertSucceeds(getDoc(doc(db, 'hr/payroll_batches/batch-001')));
  });
  
  test('Regular staff cannot read payroll batches', async () => {
    const staffUser = testEnv.authenticatedContext('staff-user', {
      role: 'staff',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'hr/payroll_batches/batch-001'), {
        period: { month: 1, year: 2026 },
        status: 'completed',
      });
    });
    
    const db = staffUser.firestore();
    await assertFails(getDoc(doc(db, 'hr/payroll_batches/batch-001')));
  });
});

// ============================================
// Audit Log Rules
// ============================================

describe('Audit Log Rules', () => {
  test('Audit logs cannot be updated', async () => {
    const adminUser = testEnv.authenticatedContext('admin-user', {
      role: 'platform_admin',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_logs/log-001'), {
        action: 'user_login',
        userId: 'user-123',
        timestamp: new Date(),
      });
    });
    
    const db = adminUser.firestore();
    await assertFails(setDoc(doc(db, 'audit_logs/log-001'), {
      action: 'modified',
      userId: 'user-123',
      timestamp: new Date(),
    }));
  });
  
  test('Audit logs cannot be deleted', async () => {
    const adminUser = testEnv.authenticatedContext('admin-user', {
      role: 'platform_admin',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_logs/log-001'), {
        action: 'user_login',
        userId: 'user-123',
        timestamp: new Date(),
      });
    });
    
    const db = adminUser.firestore();
    await assertFails(deleteDoc(doc(db, 'audit_logs/log-001')));
  });
  
  test('Authenticated users can create audit logs', async () => {
    const user = testEnv.authenticatedContext('any-user', {
      role: 'staff',
    });
    
    const db = user.firestore();
    await assertSucceeds(setDoc(doc(db, 'audit_logs/new-log'), {
      action: 'user_action',
      userId: 'any-user',
      timestamp: new Date(),
    }));
  });
});

// ============================================
// Leave Request Rules
// ============================================

describe('Leave Request Rules', () => {
  test('Employee can create their own leave request', async () => {
    const empUser = testEnv.authenticatedContext('emp-user', {
      role: 'staff',
    });
    
    const db = empUser.firestore();
    await assertSucceeds(setDoc(doc(db, 'hr/leave_requests/req-001'), {
      employeeId: 'emp-user',
      leaveType: 'annual',
      startDate: new Date(),
      endDate: new Date(),
      status: 'pending',
    }));
  });
  
  test('Employee cannot create leave request for others', async () => {
    const empUser = testEnv.authenticatedContext('emp-user', {
      role: 'staff',
    });
    
    const db = empUser.firestore();
    await assertFails(setDoc(doc(db, 'hr/leave_requests/req-002'), {
      employeeId: 'other-user',
      leaveType: 'annual',
      startDate: new Date(),
      endDate: new Date(),
      status: 'pending',
    }));
  });
  
  test('Employee can read their own leave requests', async () => {
    const empUser = testEnv.authenticatedContext('emp-user', {
      role: 'staff',
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'hr/leave_requests/req-001'), {
        employeeId: 'emp-user',
        leaveType: 'annual',
        startDate: new Date(),
        endDate: new Date(),
        status: 'pending',
      });
    });
    
    const db = empUser.firestore();
    await assertSucceeds(getDoc(doc(db, 'hr/leave_requests/req-001')));
  });
});

// ============================================
// projectFiles (Unified File Manager) Rules
// ============================================

describe('projectFiles — Unified File Manager Rules', () => {
  /**
   * Helper: seed a users/{uid} doc with a role (needed because the rules'
   * `hasRole()`/`isAdmin()` helpers query the Firestore `users` collection
   * rather than auth claims).
   */
  async function seedUser(uid: string, role: string) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${uid}`), {
        role,
        permissions: [],
      });
    });
  }

  async function seedProjectFile(
    fileId: string,
    data: Record<string, unknown>,
  ) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `projectFiles/${fileId}`), {
        name: 'DF-2025-001-DWG-kitchen-v01-20260419.dwg',
        fileName: 'kitchen.dwg',
        fileSize: 1024,
        mimeType: 'application/octet-stream',
        storagePath: 'project-files/p1/deliverable/t_s_kitchen.dwg',
        storageUrl: 'https://example.com/kitchen.dwg',
        projectId: 'p1',
        projectCode: 'DF-2025-001',
        module: 'design-manager',
        category: 'deliverable',
        version: 1,
        isLatest: true,
        isAutoGenerated: false,
        uploadedBy: 'owner-user',
        ...data,
      });
    });
  }

  test('any authenticated user can read a projectFile', async () => {
    await seedProjectFile('pf-read', {});
    const reader = testEnv.authenticatedContext('some-reader').firestore();
    await assertSucceeds(getDoc(doc(reader, 'projectFiles/pf-read')));
  });

  test('owner can update their own non-approved file', async () => {
    await seedProjectFile('pf-own-update', { uploadedBy: 'owner-user' });
    const owner = testEnv.authenticatedContext('owner-user').firestore();
    await assertSucceeds(updateDoc(doc(owner, 'projectFiles/pf-own-update'), { fileSize: 2048 }));
  });

  test('non-owner non-admin cannot update someone else\'s file', async () => {
    await seedProjectFile('pf-foreign', { uploadedBy: 'other-user' });
    const intruder = testEnv.authenticatedContext('intruder').firestore();
    await assertFails(updateDoc(doc(intruder, 'projectFiles/pf-foreign'), { fileSize: 2048 }));
  });

  test('approval lock: owner CANNOT update an approved file', async () => {
    await seedProjectFile('pf-approved', {
      uploadedBy: 'owner-user',
      status: 'approved',
    });
    const owner = testEnv.authenticatedContext('owner-user').firestore();
    await assertFails(updateDoc(doc(owner, 'projectFiles/pf-approved'), { fileSize: 2048 }));
  });

  test('approval lock: owner CANNOT delete an approved file', async () => {
    await seedProjectFile('pf-approved-del', {
      uploadedBy: 'owner-user',
      status: 'approved',
    });
    const owner = testEnv.authenticatedContext('owner-user').firestore();
    await assertFails(deleteDoc(doc(owner, 'projectFiles/pf-approved-del')));
  });

  test('approval lock override: admin CAN update an approved file', async () => {
    await seedUser('admin-user', 'admin');
    await seedProjectFile('pf-approved-admin', {
      uploadedBy: 'someone-else',
      status: 'approved',
    });
    const admin = testEnv.authenticatedContext('admin-user').firestore();
    await assertSucceeds(updateDoc(doc(admin, 'projectFiles/pf-approved-admin'), { fileSize: 2048 }));
  });

  test('approval lock override: admin CAN delete an approved file', async () => {
    await seedUser('admin-user2', 'admin');
    await seedProjectFile('pf-approved-admin-del', {
      uploadedBy: 'someone-else',
      status: 'approved',
    });
    const admin = testEnv.authenticatedContext('admin-user2').firestore();
    await assertSucceeds(deleteDoc(doc(admin, 'projectFiles/pf-approved-admin-del')));
  });

  test('non-owner admin can update any file (pre-approval-lock path)', async () => {
    await seedUser('admin-user3', 'admin');
    await seedProjectFile('pf-admin-override', { uploadedBy: 'someone-else', status: 'draft' });
    const admin = testEnv.authenticatedContext('admin-user3').firestore();
    await assertSucceeds(updateDoc(doc(admin, 'projectFiles/pf-admin-override'), { fileSize: 9999 }));
  });
});

// ============================================
// revisionRequests (Phase 3b F-D3) Rules
// ============================================

describe('revisionRequests — feedback loop rules', () => {
  async function seedRequest(id: string, data: Record<string, unknown> = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `revisionRequests/${id}`), {
        projectId: 'p1',
        itemId: 'i1',
        itemName: 'Kitchen',
        requestedBy: 'client-uid',
        requestedByName: 'Alice',
        message: 'please change',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      });
    });
  }

  test('any authenticated user can read a request', async () => {
    await seedRequest('req-read');
    const reader = testEnv.authenticatedContext('any-user').firestore();
    await assertSucceeds(getDoc(doc(reader, 'revisionRequests/req-read')));
  });

  test('any authenticated user can create a request (portal anon or staff)', async () => {
    const portalAnon = testEnv.authenticatedContext('anon-portal-uid').firestore();
    await assertSucceeds(
      setDoc(doc(portalAnon, 'revisionRequests/req-new'), {
        projectId: 'p1',
        itemId: 'i1',
        requestedBy: 'anon-portal-uid',
        message: 'please change',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  test('update is allowed when identity fields are preserved', async () => {
    await seedRequest('req-ok-update', {
      projectId: 'p1',
      itemId: 'i1',
      requestedBy: 'client-uid',
      createdAt: new Date('2026-01-01'),
    });
    const designer = testEnv.authenticatedContext('designer-uid').firestore();
    // The rule compares createdAt equality — so we must round-trip it.
    const snap = await testEnv.withSecurityRulesDisabled(async (ctx) =>
      getDoc(doc(ctx.firestore(), 'revisionRequests/req-ok-update')),
    );
    const createdAt = (snap.data() as { createdAt: unknown }).createdAt;
    await assertSucceeds(
      updateDoc(doc(designer, 'revisionRequests/req-ok-update'), {
        status: 'acknowledged',
        acknowledgedBy: 'designer-uid',
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
        projectId: 'p1',
        itemId: 'i1',
        requestedBy: 'client-uid',
        createdAt,
      }),
    );
  });

  test('update is REJECTED when projectId mutates', async () => {
    await seedRequest('req-mutate-project');
    const attacker = testEnv.authenticatedContext('intruder').firestore();
    await assertFails(
      updateDoc(doc(attacker, 'revisionRequests/req-mutate-project'), {
        projectId: 'different-project',
      }),
    );
  });

  test('update is REJECTED when requestedBy mutates', async () => {
    await seedRequest('req-mutate-who');
    const attacker = testEnv.authenticatedContext('intruder').firestore();
    await assertFails(
      updateDoc(doc(attacker, 'revisionRequests/req-mutate-who'), {
        requestedBy: 'someone-else',
      }),
    );
  });

  test('delete is admin-only', async () => {
    await seedRequest('req-del-staff');
    const staff = testEnv.authenticatedContext('regular-staff').firestore();
    await assertFails(deleteDoc(doc(staff, 'revisionRequests/req-del-staff')));

    await seedUser('admin-del', 'admin');
    const admin = testEnv.authenticatedContext('admin-del').firestore();
    await seedRequest('req-del-admin');
    await assertSucceeds(deleteDoc(doc(admin, 'revisionRequests/req-del-admin')));
  });
});

// ============================================
// Phase 4 archive-lifecycle rules
// (archived files still respect the approval-lock + ownership rules)
// ============================================

describe('projectFiles — archive lifecycle interaction with existing rules', () => {
  async function seedUser(uid: string, role: string) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${uid}`), { role, permissions: [] });
    });
  }
  async function seedPF(id: string, data: Record<string, unknown> = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `projectFiles/${id}`), {
        name: 'DF-2025-001-DWG-x-v01-20260419.pdf',
        fileName: 'x.pdf',
        fileSize: 1,
        mimeType: 'application/pdf',
        storagePath: 'project-files/p1/deliverable/x',
        storageUrl: 'https://s/x',
        projectId: 'p1',
        projectCode: 'DF-2025-001',
        module: 'design-manager',
        category: 'deliverable',
        version: 1,
        isLatest: true,
        isAutoGenerated: false,
        uploadedBy: 'owner-user',
        ...data,
      });
    });
  }

  test('owner can still update an archived NON-approved file', async () => {
    await seedPF('pf-arch-non-approved', {
      uploadedBy: 'owner-user',
      archived: true,
    });
    const owner = testEnv.authenticatedContext('owner-user').firestore();
    await assertSucceeds(
      updateDoc(doc(owner, 'projectFiles/pf-arch-non-approved'), { fileSize: 9999 }),
    );
  });

  test('archived + approved still blocks non-admin writes (approval lock dominates)', async () => {
    await seedPF('pf-arch-approved', {
      uploadedBy: 'owner-user',
      archived: true,
      status: 'approved',
    });
    const owner = testEnv.authenticatedContext('owner-user').firestore();
    await assertFails(
      updateDoc(doc(owner, 'projectFiles/pf-arch-approved'), { fileSize: 9999 }),
    );
  });

  test('admin can still write to archived + approved files', async () => {
    await seedUser('admin-arch', 'admin');
    await seedPF('pf-arch-admin', {
      uploadedBy: 'someone-else',
      archived: true,
      status: 'approved',
    });
    const admin = testEnv.authenticatedContext('admin-arch').firestore();
    await assertSucceeds(
      updateDoc(doc(admin, 'projectFiles/pf-arch-admin'), { fileSize: 9999 }),
    );
  });
});

// ============================================
// systemSettings — admin-only write, authenticated read
// ============================================

describe('systemSettings — Drive Folder Mapping rules', () => {
  async function seedUser(uid: string, role: string) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${uid}`), { role, permissions: [] });
    });
  }
  async function seedSettings(docId: string, data: Record<string, unknown> = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `systemSettings/${docId}`), {
        bindings: {},
        ...data,
      });
    });
  }

  test('any authenticated user can read (Cloud Functions + UI both need this)', async () => {
    await seedSettings('driveFolders', {
      bindings: { activeProjects: { folderId: 'fold-123' } },
    });
    const reader = testEnv.authenticatedContext('any-user').firestore();
    await assertSucceeds(getDoc(doc(reader, 'systemSettings/driveFolders')));
  });

  test('non-admin CANNOT write', async () => {
    await seedSettings('driveFolders');
    const staff = testEnv.authenticatedContext('regular-staff').firestore();
    await assertFails(
      setDoc(
        doc(staff, 'systemSettings/driveFolders'),
        { bindings: { activeProjects: { folderId: 'intruder-id' } } },
        { merge: true },
      ),
    );
  });

  test('admin CAN write', async () => {
    await seedUser('admin-write', 'admin');
    await seedSettings('driveFolders');
    const admin = testEnv.authenticatedContext('admin-write').firestore();
    await assertSucceeds(
      setDoc(
        doc(admin, 'systemSettings/driveFolders'),
        { bindings: { activeProjects: { folderId: 'admin-set' } } },
        { merge: true },
      ),
    );
  });
});
