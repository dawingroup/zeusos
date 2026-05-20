import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  onSnapshot,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'workInstances';

/**
 * Create work instance schema with defaults
 * @param {Object} data - Instance data
 * @param {Object} user - Current user
 * @returns {Object} Formatted instance schema
 */
const createInstanceSchema = (data, user) => ({
  // Project Info
  projectId: data.projectId || null,
  projectCode: data.projectCode || '',
  projectName: data.projectName || '',
  customerId: data.customerId || null,
  customerName: data.customerName || '',
  
  // Work Data
  panelData: data.panelData || [],
  rawData: data.rawData || [],
  
  // Configuration
  configuration: {
    bladeKerf: data.configuration?.bladeKerf || 5,
    stockSheets: data.configuration?.stockSheets || [],
    materialMapping: data.configuration?.materialMapping || {},
    millingConfig: data.configuration?.millingConfig || {},
    edgeBanding: data.configuration?.edgeBanding || {},
    offcuts: data.configuration?.offcuts || [],
  },
  
  // Generated Outputs
  outputs: {
    pgBison: data.outputs?.pgBison || null,
    cutlistOpt: data.outputs?.cutlistOpt || null,
    katanaBOM: data.outputs?.katanaBOM || null,
    timberBOM: data.outputs?.timberBOM || null,
  },
  
  // Optimization Results
  optimization: {
    sheets: data.optimization?.sheets || [],
    statistics: data.optimization?.statistics || {},
    generated: data.optimization?.generated || false,
  },
  
  // Drive Export Links
  driveFiles: data.driveFiles || [],
  
  // Metadata
  status: data.status || 'draft', // draft | exported | completed
  createdBy: user?.email || 'unknown',
  createdAt: serverTimestamp(),
  updatedBy: user?.email || 'unknown',
  updatedAt: serverTimestamp(),
});

/**
 * Create new work instance
 * @param {Object} data - Instance data
 * @param {Object} user - Current user
 * @returns {Promise<Object>} Created instance with ID
 */
export const createWorkInstance = async (data, user) => {
  try {
    const instanceData = createInstanceSchema(data, user);
    const docRef = await addDoc(collection(db, COLLECTION), instanceData);
    return { id: docRef.id, ...instanceData };
  } catch (error) {
    console.error('Error creating work instance:', error);
    throw error;
  }
};

/**
 * Update existing work instance
 * @param {string} instanceId - Instance ID
 * @param {Object} updates - Updates to apply
 * @param {Object} user - Current user
 * @returns {Promise<boolean>} Success status
 */
export const updateWorkInstance = async (instanceId, updates, user) => {
  try {
    const docRef = doc(db, COLLECTION, instanceId);
    await updateDoc(docRef, {
      ...updates,
      updatedBy: user?.email || 'unknown',
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error updating work instance:', error);
    throw error;
  }
};

/**
 * Get work instance by ID
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object|null>} Instance data or null
 */
export const getWorkInstance = async (instanceId) => {
  try {
    const docRef = doc(db, COLLECTION, instanceId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting work instance:', error);
    throw error;
  }
};

/**
 * Get all work instances for a project
 * @param {string} projectId - Notion project page ID
 * @returns {Promise<Array>} Array of instances
 */
export const getProjectInstances = async (projectId) => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('projectId', '==', projectId),
      orderBy('updatedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting project instances:', error);
    throw error;
  }
};

/**
 * Get recent work instances for current user
 * @param {string} userEmail - User email
 * @param {number} limitCount - Max results
 * @returns {Promise<Array>} Array of instances
 */
export const getRecentInstances = async (userEmail, limitCount = 10) => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('updatedBy', '==', userEmail),
      orderBy('updatedAt', 'desc'),
      firestoreLimit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting recent instances:', error);
    throw error;
  }
};

/**
 * Get all recent instances (for team view)
 * @param {number} limitCount - Max results
 * @returns {Promise<Array>} Array of instances
 */
export const getAllRecentInstances = async (limitCount = 20) => {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy('updatedAt', 'desc'),
      firestoreLimit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all instances:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time updates for an instance
 * @param {string} instanceId - Instance ID
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export const subscribeToInstance = (instanceId, callback) => {
  const docRef = doc(db, COLLECTION, instanceId);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    }
  });
};

/**
 * Update instance status
 * @param {string} instanceId - Instance ID
 * @param {string} status - New status
 * @param {Object} user - Current user
 * @returns {Promise<boolean>} Success status
 */
export const updateInstanceStatus = async (instanceId, status, user) => {
  return updateWorkInstance(instanceId, { status }, user);
};

/**
 * Add drive file link to instance
 * @param {string} instanceId - Instance ID
 * @param {Object} fileInfo - File information
 * @param {Object} user - Current user
 * @returns {Promise<boolean>} Success status
 */
export const addDriveFileLink = async (instanceId, fileInfo, user) => {
  try {
    const instance = await getWorkInstance(instanceId);
    const driveFiles = [...(instance.driveFiles || []), {
      ...fileInfo,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.email,
    }];
    return updateWorkInstance(instanceId, { driveFiles }, user);
  } catch (error) {
    console.error('Error adding drive file link:', error);
    throw error;
  }
};

/**
 * Delete a work instance
 * @param {string} instanceId - Instance ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteWorkInstance = async (instanceId) => {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    const docRef = doc(db, COLLECTION, instanceId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting work instance:', error);
    throw error;
  }
};

export default {
  createWorkInstance,
  updateWorkInstance,
  getWorkInstance,
  getProjectInstances,
  getRecentInstances,
  getAllRecentInstances,
  subscribeToInstance,
  updateInstanceStatus,
  addDriveFileLink,
  deleteWorkInstance,
};
