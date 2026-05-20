/**
 * Stock Materials Service
 * Manages persistent stock materials list in Firestore
 */

import { 
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION = 'stockMaterials';

// Default stock materials to seed if collection is empty
const DEFAULT_STOCK_MATERIALS = [
  { displayName: 'Blockboard Light Brown', thickness: 18, sheetLength: 2440, sheetWidth: 1220, category: 'Board', active: true },
  { displayName: 'Blockboard Ordinary', thickness: 18, sheetLength: 2440, sheetWidth: 1220, category: 'Board', active: true },
  { displayName: 'PG Bison White', thickness: 18, sheetLength: 2750, sheetWidth: 1830, category: 'Melamine', active: true },
  { displayName: 'PG Bison Backer', thickness: 3, sheetLength: 2750, sheetWidth: 1830, category: 'Backer', active: true },
  { displayName: 'Plywood', thickness: 18, sheetLength: 2440, sheetWidth: 1220, category: 'Board', active: true },
  { displayName: 'MDF', thickness: 18, sheetLength: 2440, sheetWidth: 1220, category: 'Board', active: true },
  { displayName: 'Chipboard', thickness: 16, sheetLength: 2750, sheetWidth: 1830, category: 'Board', active: true },
  { displayName: 'OSB', thickness: 18, sheetLength: 2440, sheetWidth: 1220, category: 'Board', active: true },
  { displayName: 'Melamine White', thickness: 18, sheetLength: 2750, sheetWidth: 1830, category: 'Melamine', active: true },
  { displayName: 'Melamine Black', thickness: 18, sheetLength: 2750, sheetWidth: 1830, category: 'Melamine', active: true },
  { displayName: 'Supawood', thickness: 16, sheetLength: 2750, sheetWidth: 1830, category: 'Board', active: true },
  { displayName: 'Hardboard', thickness: 3, sheetLength: 2440, sheetWidth: 1220, category: 'Backer', active: true },
];

/**
 * Get all stock materials
 */
export const getStockMaterials = async () => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('displayName'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      // Seed default materials if collection is empty
      console.log('Seeding default stock materials...');
      await seedDefaultMaterials();
      return DEFAULT_STOCK_MATERIALS.map((m, i) => ({ id: `default-${i}`, ...m }));
    }
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching stock materials:', error);
    // Return defaults as fallback
    return DEFAULT_STOCK_MATERIALS.map((m, i) => ({ id: `default-${i}`, ...m }));
  }
};

/**
 * Seed default stock materials
 */
export const seedDefaultMaterials = async () => {
  try {
    const batch = [];
    for (const material of DEFAULT_STOCK_MATERIALS) {
      batch.push(addDoc(collection(db, COLLECTION), {
        ...material,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    }
    await Promise.all(batch);
    console.log('Default stock materials seeded successfully');
  } catch (error) {
    console.error('Error seeding stock materials:', error);
  }
};

/**
 * Add a new stock material
 */
export const addStockMaterial = async (material) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...material,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { id: docRef.id, ...material };
  } catch (error) {
    console.error('Error adding stock material:', error);
    throw error;
  }
};

/**
 * Update a stock material
 */
export const updateStockMaterial = async (id, updates) => {
  try {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating stock material:', error);
    throw error;
  }
};

/**
 * Delete a stock material
 */
export const deleteStockMaterial = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
  } catch (error) {
    console.error('Error deleting stock material:', error);
    throw error;
  }
};

export default {
  getStockMaterials,
  addStockMaterial,
  updateStockMaterial,
  deleteStockMaterial,
  seedDefaultMaterials
};
