/**
 * Set Custom Claims - DawinOS v2.0
 * Cloud Functions to set user claims based on employee record
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

/**
 * Map job level to security role
 */
function mapJobLevelToRole(jobLevel) {
  const roleMap = {
    'executive': 'executive',
    'director': 'director',
    'manager': 'manager',
    'lead': 'team_lead',
    'senior': 'staff',
    'mid': 'staff',
    'junior': 'staff',
    'intern': 'intern',
  };
  
  return roleMap[jobLevel] || 'staff';
}

/**
 * Sync employee data to Auth custom claims
 * Triggered when employee record is created or updated
 */
const syncEmployeeClaims = onDocumentWritten(
  'hr/employees/{employeeId}',
  async (event) => {
    const employeeId = event.params.employeeId;
    const employee = event.data?.after?.data();
    
    if (!employee || !employee.userId) {
      // Employee deleted or no linked user
      logger.info(`No employee data or userId for ${employeeId}`);
      return null;
    }
    
    const claims = {
      role: mapJobLevelToRole(employee.employment?.jobLevel || 'staff'),
      subsidiaryId: employee.employment?.subsidiaryId || '',
      departmentId: employee.employment?.departmentId || '',
      employeeId: employeeId,
      jobLevel: employee.employment?.jobLevel || 'staff',
    };
    
    // Add managed employees if manager
    if (employee.employment?.directReports?.length > 0) {
      claims.managedEmployees = employee.employment.directReports;
    }
    
    try {
      await admin.auth().setCustomUserClaims(employee.userId, claims);
      
      // Update employee record with sync timestamp
      await event.data.after.ref.update({
        claimsSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      logger.info(`Claims synced for employee ${employeeId}`);
    } catch (error) {
      logger.error(`Error syncing claims for ${employeeId}:`, error);
      throw error;
    }
    
    return null;
  }
);

/**
 * Manually set admin claims
 * Callable function for platform setup
 */
const setAdminClaims = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  // Only existing admins can create new admins
  if (!request.auth?.token?.role || request.auth.token.role !== 'platform_admin') {
    throw new HttpsError(
      'permission-denied',
      'Only platform admins can set admin claims'
    );
  }
  
  const { userId, role } = request.data;
  
  if (!userId || !role) {
    throw new HttpsError(
      'invalid-argument',
      'userId and role are required'
    );
  }
  
  const validRoles = ['platform_admin', 'hr_admin', 'finance_admin'];
  if (!validRoles.includes(role)) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid role. Must be one of: ${validRoles.join(', ')}`
    );
  }
  
  try {
    await admin.auth().setCustomUserClaims(userId, { role });
    return { success: true, message: `Admin claims set for user ${userId}` };
  } catch (error) {
    logger.error('Error setting admin claims:', error);
    throw new HttpsError('internal', 'Failed to set claims');
  }
});

/**
 * Initialize first admin user
 * This should only be called once during initial setup
 */
const initializeFirstAdmin = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  // Check if any admin exists
  const existingAdmins = await admin.auth().listUsers(1);
  const hasAdmin = existingAdmins.users.some(
    user => user.customClaims?.role === 'platform_admin'
  );
  
  if (hasAdmin) {
    throw new HttpsError(
      'already-exists',
      'Admin user already exists'
    );
  }
  
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Must be authenticated to initialize admin'
    );
  }
  
  // Set the current user as platform admin
  await admin.auth().setCustomUserClaims(request.auth.uid, {
    role: 'platform_admin',
  });
  
  logger.info(`First admin initialized: ${request.auth.uid}`);
  
  return { success: true, message: 'First admin initialized' };
});

/**
 * Get current user's claims
 * Callable function for debugging and UI
 */
const getCurrentClaims = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Must be authenticated'
    );
  }
  
  try {
    const user = await admin.auth().getUser(request.auth.uid);
    return {
      uid: user.uid,
      email: user.email,
      claims: user.customClaims || {},
    };
  } catch (error) {
    logger.error('Error getting claims:', error);
    throw new HttpsError('internal', 'Failed to get claims');
  }
});

/**
 * Update user claims from DawinUser profile
 * Syncs globalRole, modules, and subsidiaries to Firebase Auth custom claims
 * Only callable by admins/owners
 */
const updateUserClaims = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Verify caller is admin or owner
  const callerSnap = await admin.firestore()
    .collection('organizations/default/users')
    .where('uid', '==', request.auth.uid)
    .limit(1)
    .get();

  if (callerSnap.empty) {
    throw new HttpsError('permission-denied', 'Caller not found');
  }

  const callerRole = callerSnap.docs[0].data().globalRole;
  if (!['admin', 'owner'].includes(callerRole)) {
    throw new HttpsError('permission-denied', 'Only admins can update user claims');
  }

  const { targetUid } = request.data;
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'targetUid is required');
  }

  // Read target user's DawinUser doc
  const userSnap = await admin.firestore()
    .collection('organizations/default/users')
    .where('uid', '==', targetUid)
    .limit(1)
    .get();

  if (userSnap.empty) {
    throw new HttpsError('not-found', 'Target user not found');
  }

  const userData = userSnap.docs[0].data();
  const moduleIds = (userData.subsidiaryAccess || [])
    .flatMap(sa => (sa.modules || []).filter(m => m.hasAccess).map(m => m.moduleId));
  const subsidiaryIds = (userData.subsidiaryAccess || [])
    .filter(sa => sa.hasAccess)
    .map(sa => sa.subsidiaryId);

  try {
    await admin.auth().setCustomUserClaims(targetUid, {
      globalRole: userData.globalRole,
      modules: moduleIds,
      subsidiaries: subsidiaryIds,
      isActive: userData.isActive,
    });

    logger.info(`Claims updated for user ${targetUid}`, {
      globalRole: userData.globalRole,
      modules: moduleIds,
      subsidiaries: subsidiaryIds,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error updating user claims:', error);
    throw new HttpsError('internal', 'Failed to update claims');
  }
});

module.exports = {
  syncEmployeeClaims,
  setAdminClaims,
  initializeFirstAdmin,
  getCurrentClaims,
  updateUserClaims,
};
