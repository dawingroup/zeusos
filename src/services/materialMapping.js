/**
 * Material Mapping Service
 * Two-stage import-then-map workflow with fuzzy matching
 */

import { 
  collection, doc, getDocs, addDoc, updateDoc, query, where,
  increment as firestoreIncrement, getDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import Fuse from 'fuse.js';

const MAPPINGS_COLLECTION = 'materialMappings';
const STOCK_COLLECTION = 'stockMaterials';

/**
 * Analyze imported materials and find matches
 * @param {Array} importedMaterials - Array of material names from import
 * @returns {Object} Analysis results with match status
 */
export const analyzeMaterials = async (importedMaterials) => {
  const uniqueMaterials = [...new Set(importedMaterials.filter(Boolean))];
  
  // Get existing mappings
  const mappingsSnapshot = await getDocs(collection(db, MAPPINGS_COLLECTION));
  const existingMappings = {};
  mappingsSnapshot.forEach(doc => {
    const data = doc.data();
    existingMappings[data.designNameNormalized] = { id: doc.id, ...data };
  });
  
  // Get stock materials for fuzzy matching
  const stockSnapshot = await getDocs(collection(db, STOCK_COLLECTION));
  const stockMaterials = [];
  stockSnapshot.forEach(doc => {
    stockMaterials.push({ id: doc.id, ...doc.data() });
  });
  
  // Setup fuzzy search
  const fuse = new Fuse(stockMaterials, {
    keys: ['displayName', 'internalCode'],
    threshold: 0.4,
    includeScore: true
  });
  
  const analysis = uniqueMaterials.map(materialName => {
    const normalized = materialName.toLowerCase().trim();
    
    // Check for exact mapping
    if (existingMappings[normalized]) {
      return {
        designName: materialName,
        status: 'matched',
        mapping: existingMappings[normalized],
        confidence: 1.0
      };
    }
    
    // Try fuzzy matching
    const fuzzyResults = fuse.search(materialName);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score < 0.3) {
      return {
        designName: materialName,
        status: 'fuzzy',
        suggestedStock: fuzzyResults[0].item,
        confidence: 1 - fuzzyResults[0].score,
        alternatives: fuzzyResults.slice(1, 4).map(r => r.item)
      };
    }
    
    return {
      designName: materialName,
      status: 'unmapped',
      suggestedStock: null,
      confidence: 0,
      alternatives: fuzzyResults.slice(0, 3).map(r => r.item)
    };
  });
  
  return {
    materials: analysis,
    stats: {
      total: analysis.length,
      matched: analysis.filter(m => m.status === 'matched').length,
      fuzzy: analysis.filter(m => m.status === 'fuzzy').length,
      unmapped: analysis.filter(m => m.status === 'unmapped').length
    }
  };
};

/**
 * Save a material mapping
 * @param {string} designName - The design/import name
 * @param {string} stockMaterialId - The stock material ID to map to
 * @param {string} userId - User creating the mapping
 * @returns {string} Mapping document ID
 */
export const saveMapping = async (designName, stockMaterialId, userId) => {
  // Get stock material details
  const stockRef = doc(db, STOCK_COLLECTION, stockMaterialId);
  const stockDoc = await getDoc(stockRef);
  
  if (!stockDoc.exists()) throw new Error('Stock material not found');
  
  const stockData = stockDoc.data();
  
  const mapping = {
    designName,
    designNameNormalized: designName.toLowerCase().trim(),
    stockMaterialId,
    supplierSKU: stockData.suppliers?.find(s => s.isPreferred)?.sku || '',
    category: stockData.category,
    hasGrain: stockData.hasGrain,
    thickness: stockData.thickness,
    sheetSize: stockData.defaultSheetSize,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: userId,
    usageCount: 0
  };
  
  // Check for existing mapping
  const existingQuery = query(
    collection(db, MAPPINGS_COLLECTION),
    where('designNameNormalized', '==', mapping.designNameNormalized)
  );
  const existing = await getDocs(existingQuery);
  
  if (!existing.empty) {
    // Update existing mapping
    await updateDoc(doc(db, MAPPINGS_COLLECTION, existing.docs[0].id), {
      ...mapping,
      updatedAt: new Date()
    });
    return existing.docs[0].id;
  }
  
  // Create new mapping
  const newDoc = await addDoc(collection(db, MAPPINGS_COLLECTION), mapping);
  return newDoc.id;
};

/**
 * Get all stock materials
 * @param {string} category - Optional category filter
 * @returns {Array} Stock materials
 */
export const getStockMaterials = async (category = null) => {
  let q = query(collection(db, STOCK_COLLECTION), where('active', '==', true));
  if (category) {
    q = query(q, where('category', '==', category));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Increment usage count for a mapping
 * @param {string} mappingId - Mapping document ID
 */
export const incrementMappingUsage = async (mappingId) => {
  const mappingRef = doc(db, MAPPINGS_COLLECTION, mappingId);
  await updateDoc(mappingRef, {
    usageCount: firestoreIncrement(1),
    updatedAt: new Date()
  });
};

/**
 * Get all mappings
 * @returns {Array} All material mappings
 */
export const getAllMappings = async () => {
  const snapshot = await getDocs(collection(db, MAPPINGS_COLLECTION));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Delete a mapping
 * @param {string} mappingId - Mapping document ID
 */
export const deleteMapping = async (mappingId) => {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, MAPPINGS_COLLECTION, mappingId));
};

export default {
  analyzeMaterials,
  saveMapping,
  getStockMaterials,
  incrementMappingUsage,
  getAllMappings,
  deleteMapping
};
