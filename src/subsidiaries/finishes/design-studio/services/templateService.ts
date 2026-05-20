/**
 * Template Service — CRUD for the furnitureTemplates Firestore collection
 *
 * Manages the parametric furniture template library with categories,
 * parameters, BOM templates, and CadQuery script references.
 */

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { FurnitureTemplate } from '../types/generation.types';

const COLLECTION = 'furnitureTemplates';

/**
 * List all templates, optionally filtered by category.
 */
export async function listTemplates(
  category?: string,
): Promise<FurnitureTemplate[]> {
  const constraints = [];
  if (category) constraints.push(where('category', '==', category));
  constraints.push(orderBy('name'));

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FurnitureTemplate));
}

/**
 * Get a single template by ID.
 */
export async function getTemplate(templateId: string): Promise<FurnitureTemplate | null> {
  const snap = await getDoc(doc(db, COLLECTION, templateId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FurnitureTemplate;
}

/**
 * Create a new furniture template.
 */
export async function createTemplate(
  data: Omit<FurnitureTemplate, 'id'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing template (partial update).
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<FurnitureTemplate, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, templateId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a template.
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, templateId));
}

/**
 * Seed default furniture templates (called once during setup).
 */
export async function seedDefaultTemplates(): Promise<number> {
  const existing = await getDocs(collection(db, COLLECTION));
  if (!existing.empty) return 0; // Don't seed if templates already exist

  const defaults: Omit<FurnitureTemplate, 'id'>[] = [
    {
      name: '3-Seat Sofa',
      category: 'seating',
      description: 'Modern 3-seat sofa with configurable arm style, leg type, and cushion count',
      thumbnailUrl: '',
      parameters: [
        { key: 'overall_width', label: 'Overall Width', type: 'number', default: 2400, min: 1800, max: 3200, step: 50, unit: 'mm', affectsBom: true },
        { key: 'seat_depth', label: 'Seat Depth', type: 'number', default: 900, min: 700, max: 1100, step: 50, unit: 'mm', affectsBom: true },
        { key: 'seat_height', label: 'Seat Height', type: 'number', default: 450, min: 350, max: 550, step: 10, unit: 'mm' },
        { key: 'back_height', label: 'Back Height', type: 'number', default: 850, min: 700, max: 1000, step: 10, unit: 'mm' },
        { key: 'seat_count', label: 'Seat Count', type: 'select', default: '3', options: [{ label: '2 Seat', value: '2' }, { label: '3 Seat', value: '3' }, { label: '4 Seat', value: '4' }], affectsBom: true },
        { key: 'arm_style', label: 'Arm Style', type: 'select', default: 'rounded', options: [{ label: 'Rounded', value: 'rounded' }, { label: 'Square', value: 'square' }, { label: 'Track', value: 'track' }] },
        { key: 'leg_type', label: 'Leg Type', type: 'select', default: 'tapered', options: [{ label: 'Tapered Wood', value: 'tapered' }, { label: 'Metal Hairpin', value: 'hairpin' }, { label: 'Block', value: 'block' }] },
      ],
      scriptStoragePath: 'templates/scripts/sofa_3seat.py',
      defaultFinishMappings: { frame: '', cushion: '', legs: '' },
      bomTemplate: [
        { materialCategory: 'timber', quantityExpression: 'frame_volume', unit: 'm3', isVariantDriven: false },
        { materialCategory: 'fabric', quantityExpression: 'seat_count * 1.8', unit: 'm2', isVariantDriven: true, finishAttributeKey: 'cushion' },
        { materialCategory: 'foam', quantityExpression: 'seat_count * 0.15', unit: 'm3', isVariantDriven: true },
      ],
      classification: 'upholstered-seating',
    },
    {
      name: 'Kitchen Cabinet',
      category: 'casegoods',
      description: 'Standard base or wall cabinet with configurable width, depth, and door count',
      thumbnailUrl: '',
      parameters: [
        { key: 'width', label: 'Width', type: 'number', default: 600, min: 300, max: 1200, step: 50, unit: 'mm', affectsBom: true },
        { key: 'height', label: 'Height', type: 'number', default: 720, min: 600, max: 900, step: 10, unit: 'mm', affectsBom: true },
        { key: 'depth', label: 'Depth', type: 'number', default: 560, min: 300, max: 600, step: 10, unit: 'mm', affectsBom: true },
        { key: 'door_count', label: 'Doors', type: 'select', default: '1', options: [{ label: '1 Door', value: '1' }, { label: '2 Doors', value: '2' }], affectsBom: true },
        { key: 'shelf_count', label: 'Shelves', type: 'number', default: 1, min: 0, max: 4, step: 1, affectsBom: true },
        { key: 'has_drawer', label: 'Include Top Drawer', type: 'boolean', default: false, affectsBom: true },
      ],
      scriptStoragePath: 'templates/scripts/kitchen_cabinet.py',
      defaultFinishMappings: { carcase: '', door: '', shelf: '' },
      bomTemplate: [
        { materialCategory: 'board', quantityExpression: 'carcase_area', unit: 'm2', isVariantDriven: false, finishAttributeKey: 'carcase' },
        { materialCategory: 'board', quantityExpression: 'door_area', unit: 'm2', isVariantDriven: true, finishAttributeKey: 'door' },
        { materialCategory: 'hardware', quantityExpression: 'door_count * 2', unit: 'pcs', isVariantDriven: true },
      ],
      classification: 'cabinet',
    },
    {
      name: 'Wardrobe',
      category: 'casegoods',
      description: 'Freestanding wardrobe with hanging rail, shelves, and optional drawers',
      thumbnailUrl: '',
      parameters: [
        { key: 'width', label: 'Width', type: 'number', default: 1200, min: 600, max: 2400, step: 50, unit: 'mm', affectsBom: true },
        { key: 'height', label: 'Height', type: 'number', default: 2100, min: 1800, max: 2400, step: 50, unit: 'mm', affectsBom: true },
        { key: 'depth', label: 'Depth', type: 'number', default: 600, min: 500, max: 700, step: 10, unit: 'mm', affectsBom: true },
        { key: 'door_style', label: 'Door Style', type: 'select', default: 'hinged', options: [{ label: 'Hinged', value: 'hinged' }, { label: 'Sliding', value: 'sliding' }] },
        { key: 'internal_layout', label: 'Internal Layout', type: 'select', default: 'mixed', options: [{ label: 'Full Hanging', value: 'hanging' }, { label: 'Shelves Only', value: 'shelves' }, { label: 'Mixed', value: 'mixed' }] },
        { key: 'drawer_count', label: 'Bottom Drawers', type: 'number', default: 2, min: 0, max: 4, step: 1, affectsBom: true },
      ],
      scriptStoragePath: 'templates/scripts/wardrobe.py',
      defaultFinishMappings: { carcase: '', door: '', drawer_front: '' },
      bomTemplate: [
        { materialCategory: 'board', quantityExpression: 'carcase_area', unit: 'm2', isVariantDriven: false },
        { materialCategory: 'board', quantityExpression: 'door_area', unit: 'm2', isVariantDriven: true },
        { materialCategory: 'hardware', quantityExpression: 'drawer_count * 2 + 4', unit: 'pcs', isVariantDriven: true },
      ],
      classification: 'wardrobe',
    },
    {
      name: 'Office Desk',
      category: 'tables',
      description: 'Rectangular office desk with cable management and optional drawers',
      thumbnailUrl: '',
      parameters: [
        { key: 'width', label: 'Width', type: 'number', default: 1400, min: 1000, max: 2000, step: 50, unit: 'mm', affectsBom: true },
        { key: 'depth', label: 'Depth', type: 'number', default: 700, min: 500, max: 900, step: 50, unit: 'mm', affectsBom: true },
        { key: 'height', label: 'Height', type: 'number', default: 750, min: 700, max: 800, step: 10, unit: 'mm' },
        { key: 'leg_style', label: 'Leg Style', type: 'select', default: 'straight', options: [{ label: 'Straight', value: 'straight' }, { label: 'A-Frame', value: 'aframe' }, { label: 'Trestle', value: 'trestle' }] },
        { key: 'has_pedestal', label: 'Include Drawer Pedestal', type: 'boolean', default: false, affectsBom: true },
        { key: 'cable_management', label: 'Cable Management', type: 'boolean', default: true },
      ],
      scriptStoragePath: 'templates/scripts/office_desk.py',
      defaultFinishMappings: { top: '', frame: '', pedestal: '' },
      bomTemplate: [
        { materialCategory: 'board', quantityExpression: 'top_area', unit: 'm2', isVariantDriven: false, finishAttributeKey: 'top' },
        { materialCategory: 'timber', quantityExpression: 'frame_volume', unit: 'm3', isVariantDriven: false },
      ],
      classification: 'desk',
    },
  ];

  let count = 0;
  for (const tmpl of defaults) {
    await addDoc(collection(db, COLLECTION), {
      ...tmpl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
  }

  return count;
}
