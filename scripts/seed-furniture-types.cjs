/**
 * Seed Furniture Types — Knowledge Base
 *
 * Seeds the `furniture_types` Firestore collection with initial
 * furniture type definitions for AI part recognition.
 *
 * Usage: node scripts/seed-furniture-types.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const COLLECTION = 'furniture_types';

const furnitureTypes = [
  {
    id: 'kitchen_base',
    name: 'Kitchen Base Cabinet',
    category: 'cabinet',
    icon: 'CookingPot',
    description: 'Standard base cabinet with door(s) and optional drawer',
    constructionMethod: 'frameless_euro',
    sortOrder: 1,
    expectedParts: [
      { role: 'side', nameTemplate: 'Side Panel', quantity: 2, typicalThickness: 18 },
      { role: 'top_bottom', nameTemplate: 'Bottom Panel', quantity: 1, typicalThickness: 18 },
      { role: 'back', nameTemplate: 'Back Panel', quantity: 1, typicalThickness: 3, notes: 'Thin HDF or plywood' },
      { role: 'shelf', nameTemplate: 'Shelf', quantity: 'varies', typicalThickness: 18 },
      { role: 'door', nameTemplate: 'Door', quantity: 'varies', typicalThickness: 18 },
      { role: 'plinth', nameTemplate: 'Plinth', quantity: 1, typicalThickness: 18 },
    ],
    assemblyGroups: [
      { name: 'Carcase', category: 'carcase', description: 'Main box structure', roles: ['side', 'top_bottom', 'back', 'vertical_division'], purchaseCategory: 'board_material' },
      { name: 'Doors', category: 'door', description: 'Door panels and hinges', roles: ['door'], purchaseCategory: 'board_material' },
      { name: 'Shelves', category: 'fixed_shelves', description: 'Internal shelving', roles: ['shelf', 'mobile_shelf'], purchaseCategory: 'board_material' },
      { name: 'Plinth & Trim', category: 'other', description: 'Base and trim pieces', roles: ['plinth', 'cover'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { side: 'Side Panel', top_bottom: 'Bottom Panel', back: 'Back Panel', shelf: 'Shelf', door: 'Door', plinth: 'Plinth' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'kitchen_wall',
    name: 'Kitchen Wall Cabinet',
    category: 'cabinet',
    icon: 'LayoutGrid',
    description: 'Wall-mounted cabinet with doors and shelves',
    constructionMethod: 'frameless_euro',
    sortOrder: 2,
    expectedParts: [
      { role: 'side', nameTemplate: 'Side Panel', quantity: 2, typicalThickness: 18 },
      { role: 'top_bottom', nameTemplate: 'Top/Bottom Panel', quantity: 2, typicalThickness: 18 },
      { role: 'back', nameTemplate: 'Back Panel', quantity: 1, typicalThickness: 3 },
      { role: 'shelf', nameTemplate: 'Shelf', quantity: 'varies', typicalThickness: 18 },
      { role: 'door', nameTemplate: 'Door', quantity: 'varies', typicalThickness: 18 },
    ],
    assemblyGroups: [
      { name: 'Carcase', category: 'carcase', description: 'Main box', roles: ['side', 'top_bottom', 'back'], purchaseCategory: 'board_material' },
      { name: 'Doors', category: 'door', description: 'Door panels', roles: ['door'], purchaseCategory: 'board_material' },
      { name: 'Shelves', category: 'fixed_shelves', description: 'Internal shelves', roles: ['shelf'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { side: 'Side Panel', top_bottom: 'Panel', back: 'Back Panel', shelf: 'Shelf', door: 'Door' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'wardrobe',
    name: 'Wardrobe',
    category: 'storage',
    icon: 'Shirt',
    description: 'Freestanding wardrobe with hanging space, shelves, and doors',
    constructionMethod: 'frameless_euro',
    sortOrder: 10,
    expectedParts: [
      { role: 'side', nameTemplate: 'Side Panel', quantity: 2, typicalThickness: 18 },
      { role: 'top_bottom', nameTemplate: 'Top/Bottom Panel', quantity: 2, typicalThickness: 18 },
      { role: 'back', nameTemplate: 'Back Panel', quantity: 1, typicalThickness: 3 },
      { role: 'shelf', nameTemplate: 'Shelf', quantity: 'varies', typicalThickness: 18 },
      { role: 'bar', nameTemplate: 'Hanging Rail', quantity: 1, notes: 'Round bar or oval tube' },
      { role: 'door', nameTemplate: 'Door', quantity: 'varies', typicalThickness: 18 },
      { role: 'vertical_division', nameTemplate: 'Vertical Division', quantity: 'varies', typicalThickness: 18 },
      { role: 'drawer', nameTemplate: 'Drawer Front', quantity: 'varies', typicalThickness: 18 },
    ],
    assemblyGroups: [
      { name: 'Carcase', category: 'carcase', description: 'Main structure', roles: ['side', 'top_bottom', 'back', 'vertical_division'], purchaseCategory: 'board_material' },
      { name: 'Doors', category: 'door', description: 'Wardrobe doors', roles: ['door'], purchaseCategory: 'board_material' },
      { name: 'Internal Fittings', category: 'fixed_shelves', description: 'Shelves and rails', roles: ['shelf', 'bar', 'mobile_shelf'], purchaseCategory: 'board_material' },
      { name: 'Drawers', category: 'drawer_box', description: 'Internal drawers', roles: ['drawer', 'drawer_component'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { side: 'Side Panel', bar: 'Hanging Rail', door: 'Door', vertical_division: 'Division' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    category: 'storage',
    icon: 'BookOpen',
    description: 'Open shelving unit, may have back panel',
    constructionMethod: 'frameless_euro',
    sortOrder: 11,
    expectedParts: [
      { role: 'side', nameTemplate: 'Side Panel', quantity: 2, typicalThickness: 18 },
      { role: 'top_bottom', nameTemplate: 'Top/Bottom Panel', quantity: 2, typicalThickness: 18 },
      { role: 'back', nameTemplate: 'Back Panel', quantity: 1, typicalThickness: 3 },
      { role: 'shelf', nameTemplate: 'Shelf', quantity: 'varies', typicalThickness: 18 },
    ],
    assemblyGroups: [
      { name: 'Carcase', category: 'carcase', description: 'Frame', roles: ['side', 'top_bottom', 'back'], purchaseCategory: 'board_material' },
      { name: 'Shelves', category: 'fixed_shelves', description: 'All shelves', roles: ['shelf', 'mobile_shelf'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { side: 'Side Panel', shelf: 'Shelf' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'single_bed',
    name: 'Single Bed',
    category: 'bed',
    icon: 'Bed',
    description: 'Single bed frame with headboard and footboard',
    constructionMethod: 'post_and_rail',
    sortOrder: 20,
    expectedParts: [
      { role: 'panel', nameTemplate: 'Headboard', quantity: 1, typicalThickness: 18, notes: 'Tallest vertical panel at one end' },
      { role: 'panel', nameTemplate: 'Footboard', quantity: 1, typicalThickness: 18, notes: 'Shorter vertical panel at opposite end' },
      { role: 'rail', nameTemplate: 'Side Rail', quantity: 2, notes: 'Long horizontal members connecting head to foot' },
      { role: 'bar', nameTemplate: 'Slat', quantity: 'varies', notes: 'Cross members supporting mattress' },
      { role: 'rail', nameTemplate: 'Center Support Beam', quantity: 1, notes: 'Longitudinal support under slats' },
    ],
    assemblyGroups: [
      { name: 'Frame', category: 'carcase', description: 'Headboard, footboard, and rails', roles: ['panel', 'rail'], purchaseCategory: 'board_material' },
      { name: 'Slat System', category: 'other', description: 'Mattress support slats', roles: ['bar'], purchaseCategory: 'timber' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { panel: 'Board', rail: 'Rail', bar: 'Slat' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'double_bed',
    name: 'Double Bed',
    category: 'bed',
    icon: 'BedDouble',
    description: 'Double/queen bed frame with headboard, footboard, and center support',
    constructionMethod: 'post_and_rail',
    sortOrder: 21,
    expectedParts: [
      { role: 'panel', nameTemplate: 'Headboard', quantity: 1, typicalThickness: 18 },
      { role: 'panel', nameTemplate: 'Footboard', quantity: 1, typicalThickness: 18 },
      { role: 'rail', nameTemplate: 'Side Rail', quantity: 2 },
      { role: 'rail', nameTemplate: 'Center Support', quantity: 1 },
      { role: 'bar', nameTemplate: 'Slat', quantity: 'varies' },
      { role: 'bar', nameTemplate: 'Support Leg', quantity: 'varies', notes: 'Legs under center support' },
    ],
    assemblyGroups: [
      { name: 'Frame', category: 'carcase', description: 'Main bed frame', roles: ['panel', 'rail'], purchaseCategory: 'board_material' },
      { name: 'Slat System', category: 'other', description: 'Mattress support', roles: ['bar'], purchaseCategory: 'timber' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { panel: 'Board', rail: 'Rail', bar: 'Slat' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'bunk_bed',
    name: 'Bunk Bed',
    category: 'bed',
    icon: 'Layers',
    description: 'Stacked bunk bed with ladder and guard rail',
    constructionMethod: 'post_and_rail',
    sortOrder: 22,
    expectedParts: [
      { role: 'stile', nameTemplate: 'Post', quantity: 4, notes: 'Vertical corner posts' },
      { role: 'rail', nameTemplate: 'Upper Side Rail', quantity: 2 },
      { role: 'rail', nameTemplate: 'Lower Side Rail', quantity: 2 },
      { role: 'rail', nameTemplate: 'Upper End Rail', quantity: 2 },
      { role: 'rail', nameTemplate: 'Lower End Rail', quantity: 2 },
      { role: 'rail', nameTemplate: 'Guard Rail', quantity: 1 },
      { role: 'bar', nameTemplate: 'Ladder Rung', quantity: 'varies' },
      { role: 'stile', nameTemplate: 'Ladder Side', quantity: 2 },
      { role: 'bar', nameTemplate: 'Slat', quantity: 'varies' },
    ],
    assemblyGroups: [
      { name: 'Frame - Upper', category: 'carcase', description: 'Upper bunk frame', roles: ['stile', 'rail'], purchaseCategory: 'timber' },
      { name: 'Frame - Lower', category: 'carcase', description: 'Lower bunk frame', roles: ['stile', 'rail'], purchaseCategory: 'timber' },
      { name: 'Ladder', category: 'other', description: 'Access ladder', roles: ['bar', 'stile'], purchaseCategory: 'timber' },
      { name: 'Slats', category: 'other', description: 'Mattress support', roles: ['bar'], purchaseCategory: 'timber' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { stile: 'Post', rail: 'Rail', bar: 'Slat' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'desk',
    name: 'Desk',
    category: 'desk',
    icon: 'Monitor',
    description: 'Desk with top surface, legs or pedestal, optional drawers',
    constructionMethod: 'frameless_euro',
    sortOrder: 30,
    expectedParts: [
      { role: 'top_bottom', nameTemplate: 'Desktop', quantity: 1, typicalThickness: 25 },
      { role: 'side', nameTemplate: 'Side Panel', quantity: 2, typicalThickness: 18 },
      { role: 'back', nameTemplate: 'Back Panel', quantity: 1, typicalThickness: 3 },
      { role: 'drawer', nameTemplate: 'Drawer Front', quantity: 'varies', typicalThickness: 18 },
      { role: 'drawer_component', nameTemplate: 'Drawer Box', quantity: 'varies' },
    ],
    assemblyGroups: [
      { name: 'Top Assembly', category: 'carcase', description: 'Desktop surface', roles: ['top_bottom'], purchaseCategory: 'board_material' },
      { name: 'Pedestal', category: 'carcase', description: 'Support structure', roles: ['side', 'back'], purchaseCategory: 'board_material' },
      { name: 'Drawers', category: 'drawer_box', description: 'Drawer units', roles: ['drawer', 'drawer_component'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { top_bottom: 'Desktop', side: 'Side Panel', drawer: 'Drawer Front' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'shoe_rack',
    name: 'Shoe Rack',
    category: 'storage',
    icon: 'Footprints',
    description: 'Open or enclosed shoe storage with angled or flat shelves',
    constructionMethod: 'frameless_euro',
    sortOrder: 12,
    expectedParts: [
      { role: 'side', nameTemplate: 'Side Panel', quantity: 2, typicalThickness: 18 },
      { role: 'top_bottom', nameTemplate: 'Top/Bottom Panel', quantity: 2, typicalThickness: 18 },
      { role: 'back', nameTemplate: 'Back Panel', quantity: 1, typicalThickness: 3 },
      { role: 'shelf', nameTemplate: 'Shoe Shelf', quantity: 'varies', typicalThickness: 18, notes: 'May be angled' },
      { role: 'door', nameTemplate: 'Door', quantity: 'varies', typicalThickness: 18 },
    ],
    assemblyGroups: [
      { name: 'Carcase', category: 'carcase', description: 'Main structure', roles: ['side', 'top_bottom', 'back'], purchaseCategory: 'board_material' },
      { name: 'Shelves', category: 'fixed_shelves', description: 'Shoe shelves', roles: ['shelf'], purchaseCategory: 'board_material' },
      { name: 'Doors', category: 'door', description: 'Front doors', roles: ['door'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { shelf: 'Shoe Shelf', door: 'Door' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'kitchen_island',
    name: 'Kitchen Island',
    category: 'cabinet',
    icon: 'ChefHat',
    description: 'Freestanding kitchen island with countertop, storage, and optional seating',
    constructionMethod: 'frameless_euro',
    sortOrder: 3,
    expectedParts: [
      { role: 'top_bottom', nameTemplate: 'Countertop', quantity: 1, typicalThickness: 30 },
      { role: 'side', nameTemplate: 'End Panel', quantity: 2, typicalThickness: 18 },
      { role: 'panel', nameTemplate: 'Front/Back Panel', quantity: 2, typicalThickness: 18 },
      { role: 'shelf', nameTemplate: 'Shelf', quantity: 'varies', typicalThickness: 18 },
      { role: 'drawer', nameTemplate: 'Drawer Front', quantity: 'varies' },
      { role: 'door', nameTemplate: 'Door', quantity: 'varies' },
      { role: 'plinth', nameTemplate: 'Plinth', quantity: 1 },
    ],
    assemblyGroups: [
      { name: 'Base Frame', category: 'carcase', description: 'Island structure', roles: ['side', 'panel', 'top_bottom', 'plinth'], purchaseCategory: 'board_material' },
      { name: 'Doors & Drawers', category: 'door', description: 'Access panels', roles: ['door', 'drawer', 'drawer_component'], purchaseCategory: 'board_material' },
      { name: 'Shelves', category: 'fixed_shelves', description: 'Internal storage', roles: ['shelf'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { top_bottom: 'Countertop', side: 'End Panel', panel: 'Panel' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'vanity',
    name: 'Bathroom Vanity',
    category: 'cabinet',
    icon: 'Bath',
    description: 'Bathroom vanity unit with countertop cutout for sink',
    constructionMethod: 'frameless_euro',
    sortOrder: 4,
    expectedParts: [
      { role: 'side', nameTemplate: 'Side Panel', quantity: 2, typicalThickness: 18 },
      { role: 'top_bottom', nameTemplate: 'Bottom Panel', quantity: 1, typicalThickness: 18 },
      { role: 'back', nameTemplate: 'Back Panel', quantity: 1, typicalThickness: 3 },
      { role: 'door', nameTemplate: 'Door', quantity: 'varies', typicalThickness: 18 },
      { role: 'drawer', nameTemplate: 'Drawer Front', quantity: 'varies' },
    ],
    assemblyGroups: [
      { name: 'Carcase', category: 'carcase', description: 'Vanity box', roles: ['side', 'top_bottom', 'back'], purchaseCategory: 'board_material' },
      { name: 'Doors & Drawers', category: 'door', description: 'Front access', roles: ['door', 'drawer'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { side: 'Side Panel', door: 'Door', drawer: 'Drawer Front' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'dining_table',
    name: 'Dining Table',
    category: 'table',
    icon: 'UtensilsCrossed',
    description: 'Dining table with top, legs, and optional apron rails',
    constructionMethod: 'post_and_rail',
    sortOrder: 40,
    expectedParts: [
      { role: 'top_bottom', nameTemplate: 'Table Top', quantity: 1, typicalThickness: 25 },
      { role: 'stile', nameTemplate: 'Leg', quantity: 4 },
      { role: 'rail', nameTemplate: 'Apron Rail', quantity: 4, notes: 'Horizontal rails connecting legs' },
    ],
    assemblyGroups: [
      { name: 'Top', category: 'carcase', description: 'Table surface', roles: ['top_bottom'], purchaseCategory: 'board_material' },
      { name: 'Base Frame', category: 'other', description: 'Legs and rails', roles: ['stile', 'rail'], purchaseCategory: 'timber' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { top_bottom: 'Table Top', stile: 'Leg', rail: 'Apron Rail' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'chair',
    name: 'Chair',
    category: 'chair',
    icon: 'Armchair',
    description: 'Dining or side chair with seat, backrest, and legs',
    constructionMethod: 'post_and_rail',
    sortOrder: 41,
    expectedParts: [
      { role: 'panel', nameTemplate: 'Seat', quantity: 1 },
      { role: 'panel', nameTemplate: 'Backrest', quantity: 1 },
      { role: 'stile', nameTemplate: 'Front Leg', quantity: 2 },
      { role: 'stile', nameTemplate: 'Rear Leg', quantity: 2 },
      { role: 'rail', nameTemplate: 'Stretcher', quantity: 'varies' },
    ],
    assemblyGroups: [
      { name: 'Seat Assembly', category: 'carcase', description: 'Seat and backrest', roles: ['panel'], purchaseCategory: 'board_material' },
      { name: 'Frame', category: 'other', description: 'Legs and stretchers', roles: ['stile', 'rail'], purchaseCategory: 'timber' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { panel: '', stile: 'Leg', rail: 'Stretcher' }, includePosition: true, includeNumber: true },
  },
  {
    id: 'tv_unit',
    name: 'TV Unit',
    category: 'storage',
    icon: 'Tv',
    description: 'Low TV stand with shelves, drawers, and/or doors',
    constructionMethod: 'frameless_euro',
    sortOrder: 13,
    expectedParts: [
      { role: 'side', nameTemplate: 'Side Panel', quantity: 2, typicalThickness: 18 },
      { role: 'top_bottom', nameTemplate: 'Top/Bottom Panel', quantity: 2, typicalThickness: 18 },
      { role: 'back', nameTemplate: 'Back Panel', quantity: 1, typicalThickness: 3 },
      { role: 'shelf', nameTemplate: 'Shelf', quantity: 'varies' },
      { role: 'vertical_division', nameTemplate: 'Vertical Division', quantity: 'varies' },
      { role: 'door', nameTemplate: 'Door', quantity: 'varies' },
      { role: 'drawer', nameTemplate: 'Drawer Front', quantity: 'varies' },
    ],
    assemblyGroups: [
      { name: 'Carcase', category: 'carcase', description: 'Main structure', roles: ['side', 'top_bottom', 'back', 'vertical_division'], purchaseCategory: 'board_material' },
      { name: 'Doors & Drawers', category: 'door', description: 'Front access', roles: ['door', 'drawer'], purchaseCategory: 'board_material' },
      { name: 'Shelves', category: 'fixed_shelves', description: 'Internal shelves', roles: ['shelf'], purchaseCategory: 'board_material' },
    ],
    namingPatterns: { convention: 'descriptive', prefixes: { side: 'Side Panel', vertical_division: 'Division', door: 'Door', drawer: 'Drawer Front' }, includePosition: true, includeNumber: true },
  },
];

async function seed() {
  console.log(`Seeding ${furnitureTypes.length} furniture types...`);
  const batch = db.batch();

  for (const type of furnitureTypes) {
    const ref = db.collection(COLLECTION).doc(type.id);
    batch.set(ref, {
      ...type,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'seed-script',
    });
  }

  await batch.commit();
  console.log('Done! Seeded furniture types:', furnitureTypes.map(t => t.id).join(', '));
}

seed().catch(console.error);
