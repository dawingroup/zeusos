/**
 * Feature Library Service
 * CRUD and search operations for manufacturing features
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ManufacturingFeature,
  ManufacturingFeatureFilters,
  ManufacturingCategory,
} from '../types';

// Collection name - uses existing 'features' collection where user data is stored
const FEATURES_COLLECTION = 'features';

// ============================================
// CRUD Operations
// ============================================

/**
 * Get all features with optional filters
 */
export async function getFeatures(
  filters?: ManufacturingFeatureFilters
): Promise<ManufacturingFeature[]> {
  let q = query(collection(db, FEATURES_COLLECTION), orderBy('name', 'asc'));

  // Apply filters
  if (filters?.category) {
    q = query(q, where('category', '==', filters.category));
  }
  if (filters?.skillLevel) {
    q = query(q, where('skillLevel', '==', filters.skillLevel));
  }
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }

  const snapshot = await getDocs(q);
  let features = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ManufacturingFeature[];

  // Client-side filters for complex queries
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    features = features.filter(f =>
      f.name.toLowerCase().includes(searchLower) ||
      f.description.toLowerCase().includes(searchLower)
    );
  }

  if (filters?.materialType) {
    features = features.filter(f =>
      f.materialConstraints.some(c => c.materialType === filters.materialType)
    );
  }

  if (filters?.maxTime) {
    features = features.filter(f => {
      const maxMinutes = f.estimatedTime.unit === 'hours' 
        ? f.estimatedTime.max * 60 
        : f.estimatedTime.max;
      return maxMinutes <= (filters.maxTime || Infinity);
    });
  }

  return features;
}

/**
 * Get a single feature by ID
 */
export async function getFeatureById(id: string): Promise<ManufacturingFeature | null> {
  const docRef = doc(db, FEATURES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as ManufacturingFeature;
}

/**
 * Search features by text query
 */
export async function searchFeatures(queryText: string): Promise<ManufacturingFeature[]> {
  const features = await getFeatures({ status: 'active' });
  const searchLower = queryText.toLowerCase();

  return features.filter(f =>
    f.name.toLowerCase().includes(searchLower) ||
    f.description.toLowerCase().includes(searchLower) ||
    f.category.toLowerCase().includes(searchLower) ||
    f.processSteps.some(s => s.name.toLowerCase().includes(searchLower)) ||
    f.requiredEquipment.some(e => e.name.toLowerCase().includes(searchLower))
  );
}

/**
 * Get features compatible with a specific material type
 */
export async function getCompatibleFeatures(
  materialType: string
): Promise<ManufacturingFeature[]> {
  const features = await getFeatures({ status: 'active' });

  return features.filter(f =>
    f.materialConstraints.length === 0 || // No constraints = compatible with all
    f.materialConstraints.some(c => 
      c.materialType.toLowerCase() === materialType.toLowerCase() ||
      c.materialType === '*' // Wildcard for all materials
    )
  );
}

/**
 * Create a new feature
 */
export async function createFeature(
  feature: Omit<ManufacturingFeature, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, FEATURES_COLLECTION), {
    ...feature,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Update an existing feature
 */
export async function updateFeature(
  id: string,
  updates: Partial<Omit<ManufacturingFeature, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, FEATURES_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a feature
 */
export async function deleteFeature(id: string): Promise<void> {
  const docRef = doc(db, FEATURES_COLLECTION, id);
  await deleteDoc(docRef);
}

// ============================================
// AI Context Export
// ============================================

/**
 * Export features as formatted JSON for Gemini context caching
 * Keeps output under 100KB for efficient token usage
 */
export async function exportForAIContext(): Promise<string> {
  const features = await getFeatures({ status: 'active' });

  // Create compact representation for AI
  const aiContext = {
    featureCount: features.length,
    categories: [...new Set(features.map(f => f.category))],
    features: features.map(f => ({
      id: f.id,
      name: f.name,
      category: f.category,
      description: f.description,
      skillLevel: f.skillLevel,
      estimatedTime: `${f.estimatedTime.min}-${f.estimatedTime.max} ${f.estimatedTime.unit}`,
      equipment: f.requiredEquipment.map(e => e.name),
      materials: f.materialConstraints.map(c => ({
        type: c.materialType,
        thickness: c.minThickness && c.maxThickness 
          ? `${c.minThickness}-${c.maxThickness}mm` 
          : c.minThickness 
            ? `≥${c.minThickness}mm` 
            : c.maxThickness 
              ? `≤${c.maxThickness}mm` 
              : 'any',
        grain: c.grainRequired ? 'required' : 'optional',
      })),
      steps: f.processSteps.map(s => s.name),
      qualityChecks: f.qualityCheckpoints.filter(q => q.isCritical).map(q => q.name),
    })),
  };

  const jsonString = JSON.stringify(aiContext, null, 2);
  
  // Verify size is under 100KB
  const sizeKB = new Blob([jsonString]).size / 1024;
  console.log(`AI Context size: ${sizeKB.toFixed(2)}KB`);

  if (sizeKB > 100) {
    console.warn('AI Context exceeds 100KB, truncating...');
    // Truncate to first 50 features if too large
    aiContext.features = aiContext.features.slice(0, 50);
    return JSON.stringify(aiContext, null, 2);
  }

  return jsonString;
}

// ============================================
// Statistics
// ============================================

/**
 * Get feature statistics by category
 */
export async function getFeatureStats(): Promise<{
  total: number;
  byCategory: Record<ManufacturingCategory, number>;
  bySkillLevel: Record<string, number>;
  activeCount: number;
}> {
  const features = await getFeatures();

  const byCategory = features.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {} as Record<ManufacturingCategory, number>);

  const bySkillLevel = features.reduce((acc, f) => {
    acc[f.skillLevel] = (acc[f.skillLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total: features.length,
    byCategory,
    bySkillLevel,
    activeCount: features.filter(f => f.status === 'active').length,
  };
}

// ============================================
// Seed Data
// ============================================

/**
 * Seed the feature library with common millwork features
 */
export async function seedFeatureLibrary(): Promise<void> {
  const existingFeatures = await getFeatures();
  if (existingFeatures.length > 0) {
    console.log('Feature library already has data, skipping seed');
    return;
  }

  const seedFeatures: Omit<ManufacturingFeature, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'Mortise and Tenon Joinery',
      category: 'joinery',
      description: 'Traditional wood joint where a projecting tenon fits into a mortise hole. Extremely strong for frame construction.',
      processSteps: [
        { order: 1, name: 'Mark mortise location', description: 'Transfer measurements and mark mortise boundaries', duration: 5 },
        { order: 2, name: 'Cut mortise', description: 'Use mortiser or chisel to create mortise cavity', equipmentId: 'mortiser', duration: 10 },
        { order: 3, name: 'Mark tenon', description: 'Mark tenon dimensions on mating piece', duration: 3 },
        { order: 4, name: 'Cut tenon', description: 'Cut tenon shoulders and cheeks on table saw or bandsaw', equipmentId: 'tablesaw', duration: 8 },
        { order: 5, name: 'Test fit', description: 'Dry fit and adjust for snug fit', duration: 5 },
      ],
      requiredEquipment: [
        { id: 'mortiser', name: 'Mortising Machine', type: 'joinery', isRequired: false, alternativeIds: ['router', 'chisel'] },
        { id: 'tablesaw', name: 'Table Saw', type: 'cutting', isRequired: true },
      ],
      materialConstraints: [
        { materialType: 'solid-wood', minThickness: 18, grainRequired: true, notes: 'Best with hardwoods' },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Mortise depth check', description: 'Verify mortise depth matches tenon length', criteria: ['Depth within 1mm of target'], isCritical: true },
        { order: 2, name: 'Fit test', description: 'Joint should be snug without forcing', criteria: ['No gaps visible', 'Can be assembled by hand'], isCritical: true },
      ],
      pricingFactors: [
        { name: 'Complexity', type: 'complexity', multiplier: 1.5, notes: 'Traditional joinery requires skill' },
        { name: 'Setup time', type: 'time', multiplier: 1.2 },
      ],
      estimatedTime: { min: 25, max: 45, unit: 'minutes' },
      skillLevel: 'intermediate',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'Dovetail Joints',
      category: 'joinery',
      description: 'Interlocking joint with angled pins and tails. Excellent for drawer construction with mechanical strength.',
      processSteps: [
        { order: 1, name: 'Mark tails', description: 'Mark tail locations on tail board', duration: 5 },
        { order: 2, name: 'Cut tails', description: 'Cut tails using dovetail jig or by hand', equipmentId: 'router', duration: 15 },
        { order: 3, name: 'Transfer pins', description: 'Use tail board to mark pin locations', duration: 3 },
        { order: 4, name: 'Cut pins', description: 'Cut pins and remove waste', duration: 15 },
        { order: 5, name: 'Final fit', description: 'Test fit and pare for perfect fit', duration: 10 },
      ],
      requiredEquipment: [
        { id: 'router', name: 'Router with Dovetail Jig', type: 'joinery', isRequired: false, alternativeIds: ['handsaw'] },
        { id: 'dovetail-jig', name: 'Dovetail Jig', type: 'jig', isRequired: false },
      ],
      materialConstraints: [
        { materialType: 'solid-wood', minThickness: 12, maxThickness: 25, grainRequired: true },
        { materialType: 'plywood', minThickness: 12, notes: 'Use with Baltic birch only' },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Angle consistency', description: 'All dovetails at same angle', criteria: ['Uniform angle ±1°'], isCritical: true },
        { order: 2, name: 'Gap-free fit', description: 'No visible gaps when assembled', criteria: ['Tight fit on all surfaces'], isCritical: true },
      ],
      pricingFactors: [
        { name: 'Skill premium', type: 'complexity', multiplier: 1.8 },
        { name: 'Setup time', type: 'time', multiplier: 1.3 },
      ],
      estimatedTime: { min: 30, max: 60, unit: 'minutes' },
      skillLevel: 'advanced',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'Edge Banding Application',
      category: 'edge-treatment',
      description: 'Apply veneer or PVC edge banding to panel edges for a finished appearance and edge protection.',
      processSteps: [
        { order: 1, name: 'Prepare edge', description: 'Clean and sand panel edge', duration: 2 },
        { order: 2, name: 'Apply banding', description: 'Use edge bander or iron-on method', equipmentId: 'edge-bander', duration: 3 },
        { order: 3, name: 'Trim excess', description: 'Trim overhanging banding flush', duration: 2 },
        { order: 4, name: 'Sand edges', description: 'Sand corners and transitions smooth', duration: 3 },
      ],
      requiredEquipment: [
        { id: 'edge-bander', name: 'Edge Banding Machine', type: 'finishing', isRequired: false, alternativeIds: ['iron', 'heat-gun'] },
        { id: 'edge-trimmer', name: 'Edge Trimmer', type: 'trimming', isRequired: true },
      ],
      materialConstraints: [
        { materialType: 'panel', minThickness: 15, maxThickness: 25 },
        { materialType: 'MDF', minThickness: 16 },
        { materialType: 'plywood', minThickness: 12 },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Adhesion test', description: 'Banding firmly attached along full length', criteria: ['No lifting', 'No bubbles'], isCritical: true },
        { order: 2, name: 'Flush trim', description: 'Edge banding flush with panel faces', criteria: ['No overhang', 'Smooth transition'], isCritical: false },
      ],
      pricingFactors: [
        { name: 'Material cost', type: 'material', multiplier: 1.1 },
        { name: 'Linear meters', type: 'time', multiplier: 1.0 },
      ],
      estimatedTime: { min: 5, max: 15, unit: 'minutes' },
      skillLevel: 'basic',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'Face Frame Assembly',
      category: 'assembly',
      description: 'Construct face frame from rails and stiles for cabinet front. Provides structural rigidity and hinge mounting.',
      processSteps: [
        { order: 1, name: 'Cut frame members', description: 'Cut rails and stiles to length', equipmentId: 'tablesaw', duration: 10 },
        { order: 2, name: 'Mill pocket holes', description: 'Drill pocket holes for joinery', equipmentId: 'pocket-jig', duration: 8 },
        { order: 3, name: 'Dry assemble', description: 'Test fit all joints', duration: 5 },
        { order: 4, name: 'Glue and screw', description: 'Apply glue and drive pocket screws', duration: 10 },
        { order: 5, name: 'Square check', description: 'Verify frame is square while glue sets', duration: 5 },
      ],
      requiredEquipment: [
        { id: 'tablesaw', name: 'Table Saw', type: 'cutting', isRequired: true },
        { id: 'pocket-jig', name: 'Pocket Hole Jig', type: 'joinery', isRequired: true },
      ],
      materialConstraints: [
        { materialType: 'solid-wood', minThickness: 18, maxThickness: 22, grainRequired: true },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Square check', description: 'Frame diagonals equal', criteria: ['Diagonals within 1mm'], isCritical: true },
        { order: 2, name: 'Joint tightness', description: 'No gaps at joints', criteria: ['Joints tight', 'No squeeze-out visible'], isCritical: true },
      ],
      pricingFactors: [
        { name: 'Frame complexity', type: 'complexity', multiplier: 1.2 },
      ],
      estimatedTime: { min: 30, max: 45, unit: 'minutes' },
      skillLevel: 'intermediate',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'Drawer Box Construction',
      category: 'assembly',
      description: 'Build drawer box with sides, front, back, and bottom. Includes slide mounting preparation.',
      processSteps: [
        { order: 1, name: 'Cut drawer parts', description: 'Cut sides, front, back to size', equipmentId: 'tablesaw', duration: 15 },
        { order: 2, name: 'Mill bottom groove', description: 'Cut groove for drawer bottom', equipmentId: 'tablesaw', duration: 8 },
        { order: 3, name: 'Cut joinery', description: 'Cut dovetails or dado joints', duration: 20 },
        { order: 4, name: 'Assemble box', description: 'Glue and clamp drawer box', duration: 15 },
        { order: 5, name: 'Install bottom', description: 'Slide in and secure bottom panel', duration: 5 },
        { order: 6, name: 'Mount slides', description: 'Install drawer slide hardware', duration: 10 },
      ],
      requiredEquipment: [
        { id: 'tablesaw', name: 'Table Saw', type: 'cutting', isRequired: true },
        { id: 'router', name: 'Router', type: 'milling', isRequired: false },
      ],
      materialConstraints: [
        { materialType: 'plywood', minThickness: 12, maxThickness: 18, notes: 'Baltic birch preferred' },
        { materialType: 'solid-wood', minThickness: 12, maxThickness: 15 },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Square check', description: 'Box is square on all axes', criteria: ['Diagonals equal', 'Corners 90°'], isCritical: true },
        { order: 2, name: 'Slide operation', description: 'Drawer operates smoothly', criteria: ['Smooth travel', 'No binding'], isCritical: true },
      ],
      pricingFactors: [
        { name: 'Joinery type', type: 'complexity', multiplier: 1.3 },
        { name: 'Hardware', type: 'material', multiplier: 1.2 },
      ],
      estimatedTime: { min: 45, max: 90, unit: 'minutes' },
      skillLevel: 'intermediate',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'Door Overlay Calculation',
      category: 'hardware',
      description: 'Calculate and set door overlay for cabinet doors based on hinge type and desired gap.',
      processSteps: [
        { order: 1, name: 'Measure opening', description: 'Measure cabinet opening dimensions', duration: 3 },
        { order: 2, name: 'Calculate overlay', description: 'Determine overlay based on hinge type', duration: 2 },
        { order: 3, name: 'Mark hinge positions', description: 'Mark cup hole locations on door', duration: 3 },
        { order: 4, name: 'Drill cup holes', description: 'Bore 35mm hinge cups', equipmentId: 'hinge-boring', duration: 5 },
        { order: 5, name: 'Install hinges', description: 'Mount hinges to door', duration: 5 },
        { order: 6, name: 'Adjust overlay', description: 'Fine-tune using hinge adjustments', duration: 5 },
      ],
      requiredEquipment: [
        { id: 'hinge-boring', name: 'Hinge Boring Machine', type: 'drilling', isRequired: false, alternativeIds: ['forstner-bit'] },
      ],
      materialConstraints: [
        { materialType: 'panel', minThickness: 16, maxThickness: 22 },
        { materialType: 'solid-wood', minThickness: 18, maxThickness: 22 },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Gap uniformity', description: 'Consistent gap around door', criteria: ['Gap 2-3mm all around'], isCritical: true },
        { order: 2, name: 'Door alignment', description: 'Doors align with adjacent doors/drawers', criteria: ['Aligned within 1mm'], isCritical: true },
      ],
      pricingFactors: [
        { name: 'Per door', type: 'time', multiplier: 1.0 },
      ],
      estimatedTime: { min: 15, max: 25, unit: 'minutes' },
      skillLevel: 'basic',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'Soft-Close Hinge Installation',
      category: 'hardware',
      description: 'Install soft-close concealed hinges for cabinet doors with proper alignment and adjustment.',
      processSteps: [
        { order: 1, name: 'Mark hinge positions', description: 'Mark locations 80-100mm from edges', duration: 3 },
        { order: 2, name: 'Bore cup holes', description: 'Drill 35mm cup holes at marked positions', equipmentId: 'hinge-boring', duration: 5 },
        { order: 3, name: 'Mount door hinges', description: 'Screw hinge cups into door', duration: 5 },
        { order: 4, name: 'Attach mounting plates', description: 'Install plates inside cabinet', duration: 5 },
        { order: 5, name: 'Hang door', description: 'Click hinges onto plates', duration: 2 },
        { order: 6, name: 'Adjust alignment', description: 'Use 3-way adjustment for perfect fit', duration: 8 },
      ],
      requiredEquipment: [
        { id: 'hinge-boring', name: 'Hinge Boring Machine', type: 'drilling', isRequired: false, alternativeIds: ['drill-press'] },
        { id: 'screwdriver', name: 'Screwdriver', type: 'hand-tool', isRequired: true },
      ],
      materialConstraints: [
        { materialType: 'panel', minThickness: 16, maxThickness: 22 },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Soft-close function', description: 'Door closes softly from 15° angle', criteria: ['No slamming', 'Consistent speed'], isCritical: true },
        { order: 2, name: 'Door alignment', description: 'Door flush with cabinet face', criteria: ['Even reveal', 'No rubbing'], isCritical: true },
      ],
      pricingFactors: [
        { name: 'Hardware cost', type: 'material', multiplier: 1.3 },
      ],
      estimatedTime: { min: 20, max: 30, unit: 'minutes' },
      skillLevel: 'basic',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'Lacquer Finishing',
      category: 'finishing',
      description: 'Apply lacquer finish using spray equipment for a professional, durable surface.',
      processSteps: [
        { order: 1, name: 'Surface prep', description: 'Sand to 180-220 grit, remove dust', duration: 15 },
        { order: 2, name: 'Apply sealer', description: 'Spray lacquer sealer coat', equipmentId: 'spray-booth', duration: 10 },
        { order: 3, name: 'Sand sealer', description: 'Light sand with 320 grit', duration: 10 },
        { order: 4, name: 'Apply topcoats', description: 'Spray 2-3 lacquer topcoats', duration: 30 },
        { order: 5, name: 'Final sand', description: 'Wet sand with 400+ grit if needed', duration: 15 },
        { order: 6, name: 'Buff', description: 'Buff to desired sheen', duration: 10 },
      ],
      requiredEquipment: [
        { id: 'spray-booth', name: 'Spray Booth', type: 'finishing', isRequired: true },
        { id: 'hvlp-gun', name: 'HVLP Spray Gun', type: 'finishing', isRequired: true },
      ],
      materialConstraints: [
        { materialType: 'solid-wood', grainRequired: false },
        { materialType: 'MDF', notes: 'Requires extra sealer' },
        { materialType: 'veneer', notes: 'Light coats to prevent bleed-through' },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Surface smoothness', description: 'No orange peel or runs', criteria: ['Smooth to touch', 'Even sheen'], isCritical: true },
        { order: 2, name: 'Coverage', description: 'Full coverage with no thin spots', criteria: ['Uniform color', 'No bare spots'], isCritical: true },
        { order: 3, name: 'Cure time', description: 'Allow proper cure before handling', criteria: ['24 hours minimum'], isCritical: false },
      ],
      pricingFactors: [
        { name: 'Material cost', type: 'material', multiplier: 1.4 },
        { name: 'Booth time', type: 'equipment', multiplier: 1.5 },
        { name: 'Skill requirement', type: 'complexity', multiplier: 1.3 },
      ],
      estimatedTime: { min: 1, max: 2, unit: 'hours' },
      skillLevel: 'advanced',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'Veneer Pressing',
      category: 'finishing',
      description: 'Apply veneer to substrate using vacuum or mechanical press for decorative surfaces.',
      processSteps: [
        { order: 1, name: 'Prepare substrate', description: 'Sand and clean substrate surface', duration: 10 },
        { order: 2, name: 'Cut veneer', description: 'Cut veneer slightly oversize', duration: 5 },
        { order: 3, name: 'Apply adhesive', description: 'Spread PVA or contact adhesive', duration: 10 },
        { order: 4, name: 'Position veneer', description: 'Carefully align veneer on substrate', duration: 5 },
        { order: 5, name: 'Press', description: 'Apply pressure using vacuum bag or press', equipmentId: 'vacuum-press', duration: 60 },
        { order: 6, name: 'Trim edges', description: 'Trim excess veneer flush', duration: 10 },
      ],
      requiredEquipment: [
        { id: 'vacuum-press', name: 'Vacuum Press', type: 'pressing', isRequired: false, alternativeIds: ['veneer-press'] },
        { id: 'veneer-saw', name: 'Veneer Saw', type: 'cutting', isRequired: true },
      ],
      materialConstraints: [
        { materialType: 'MDF', minThickness: 16, notes: 'Ideal substrate' },
        { materialType: 'plywood', minThickness: 12 },
        { materialType: 'particle-board', minThickness: 16 },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Adhesion', description: 'Veneer fully bonded with no bubbles', criteria: ['No delamination', 'No bubbles'], isCritical: true },
        { order: 2, name: 'Grain alignment', description: 'Grain runs in specified direction', criteria: ['Consistent grain direction'], isCritical: false },
      ],
      pricingFactors: [
        { name: 'Veneer cost', type: 'material', multiplier: 1.6 },
        { name: 'Press time', type: 'equipment', multiplier: 1.2 },
      ],
      estimatedTime: { min: 1, max: 2, unit: 'hours' },
      skillLevel: 'advanced',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
    {
      name: 'CNC Pocket Routing',
      category: 'joinery',
      description: 'Use CNC router to create precise pockets, dados, and recesses for hardware or joinery.',
      processSteps: [
        { order: 1, name: 'Create toolpath', description: 'Program pocket dimensions in CAM software', duration: 15 },
        { order: 2, name: 'Setup material', description: 'Secure workpiece on CNC bed', duration: 5 },
        { order: 3, name: 'Set origin', description: 'Zero XYZ coordinates', duration: 3 },
        { order: 4, name: 'Run program', description: 'Execute CNC cutting program', equipmentId: 'cnc-router', duration: 10 },
        { order: 5, name: 'Verify dimensions', description: 'Check pocket dimensions', duration: 5 },
      ],
      requiredEquipment: [
        { id: 'cnc-router', name: 'CNC Router', type: 'cnc', isRequired: true },
        { id: 'cam-software', name: 'CAM Software', type: 'software', isRequired: true },
      ],
      materialConstraints: [
        { materialType: 'panel', minThickness: 12, maxThickness: 50 },
        { materialType: 'solid-wood', minThickness: 18 },
        { materialType: 'MDF', minThickness: 12 },
      ],
      qualityCheckpoints: [
        { order: 1, name: 'Dimension accuracy', description: 'Pocket matches specification', criteria: ['Within ±0.1mm'], isCritical: true },
        { order: 2, name: 'Surface finish', description: 'Clean cut with no tear-out', criteria: ['No burning', 'Clean edges'], isCritical: true },
      ],
      pricingFactors: [
        { name: 'Programming time', type: 'time', multiplier: 1.4 },
        { name: 'Machine time', type: 'equipment', multiplier: 1.5 },
      ],
      estimatedTime: { min: 20, max: 40, unit: 'minutes' },
      skillLevel: 'specialist',
      images: [],
      relatedFeatures: [],
      status: 'active',
    },
  ];

  // Insert seed data
  for (const feature of seedFeatures) {
    await createFeature(feature);
  }

  console.log(`Seeded ${seedFeatures.length} features`);
}
