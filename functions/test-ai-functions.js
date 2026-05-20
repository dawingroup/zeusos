/**
 * Test Script for New AI Functions
 * 
 * Run with: node test-ai-functions.js
 * 
 * Note: These functions require Firebase Auth. For testing without auth,
 * we'll use the Firebase Admin SDK to call them directly.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./service-account.json'); // You'll need this file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'dawin-cutlist-processor',
});

const db = admin.firestore();

// Import the AI functions directly for local testing
const { extractEntities, expandToDeliverables, ROOM_ONTOLOGY } = require('./src/ai/projectScoping');
const { runDfMValidation, inferSpecifications, findSuppliers } = require('./src/ai/designItemEnhancement');

// ============================================
// Test 1: Entity Extraction
// ============================================

console.log('\n=== TEST 1: Entity Extraction ===\n');

const testBriefs = [
  "Design a boutique hotel with 32 guest rooms, each with wardrobe, desk area, and bathroom vanity. Premium finish required.",
  "Restaurant project in Kampala: 150 seats with banquette seating, host station, and 20 dining tables.",
  "Residential project: 4 bedrooms, 2 bathrooms, open kitchen with island.",
];

for (const brief of testBriefs) {
  console.log(`Brief: "${brief.substring(0, 60)}..."`);
  const entities = extractEntities(brief);
  console.log('Extracted:', JSON.stringify(entities, null, 2));
  console.log('---');
}

// ============================================
// Test 2: Deliverable Expansion
// ============================================

console.log('\n=== TEST 2: Deliverable Expansion ===\n');

const hotelEntities = extractEntities("32 guest rooms, each with wardrobe, desk, bathroom vanity");
const deliverables = expandToDeliverables(hotelEntities);

console.log(`Expanded ${hotelEntities.roomGroups.length} room groups into ${deliverables.length} deliverable types`);
console.log('\nSample deliverables:');
deliverables.slice(0, 5).forEach(d => {
  console.log(`- ${d.name}: ${d.quantity} units (${d.category})`);
});

const totalUnits = deliverables.reduce((sum, d) => sum + d.quantity, 0);
console.log(`\nTotal units: ${totalUnits}`);

// ============================================
// Test 3: DfM Validation
// ============================================

console.log('\n=== TEST 3: DfM Validation ===\n');

const testSpecs = [
  {
    name: 'Wide thin panel',
    dimensions: { width: 800, height: 2400, depth: 600 },
    material: { type: 'mdf', thickness: 12, grainDirection: false },
  },
  {
    name: 'Oversized panel',
    dimensions: { width: 2600, height: 1200, depth: 18 },
    material: { type: 'plywood', thickness: 18 },
  },
  {
    name: 'Shallow drawer cabinet',
    dimensions: { width: 600, height: 800, depth: 300 },
    hardware: [{ type: 'drawer_slide' }],
  },
];

for (const spec of testSpecs) {
  console.log(`Testing: ${spec.name}`);
  const issues = runDfMValidation(spec);
  if (issues.length === 0) {
    console.log('  ✓ All DfM checks passed');
  } else {
    issues.forEach(issue => {
      console.log(`  ✗ [${issue.severity}] ${issue.description}`);
    });
  }
}

// ============================================
// Test 4: Specification Inference
// ============================================

console.log('\n=== TEST 4: Specification Inference ===\n');

const itemTypes = ['wardrobe', 'bathroom_vanity', 'desk_unit', 'reception_desk', 'nightstand'];

for (const itemType of itemTypes) {
  const specs = inferSpecifications(itemType, { projectType: 'hospitality', budgetTier: 'premium' });
  console.log(`${itemType}:`);
  console.log(`  Dimensions: ${specs.dimensions?.width}x${specs.dimensions?.height}x${specs.dimensions?.depth}mm`);
  console.log(`  Material: ${specs.material?.type}, ${specs.material?.thickness}mm`);
  console.log(`  Est. Hours: ${specs.estimatedHours}`);
}

// ============================================
// Test 5: Supplier Discovery
// ============================================

console.log('\n=== TEST 5: Supplier Discovery ===\n');

const procurementItems = ['quartz_countertop', 'hardware_hinges', 'drawer_slides', 'upholstery_fabric'];

for (const item of procurementItems) {
  const suppliers = findSuppliers(item, 50);
  console.log(`${item}: ${suppliers.length} suppliers found`);
  if (suppliers.length > 0) {
    const best = suppliers[0];
    console.log(`  Best: ${best.supplier} @ $${best.unitPriceUsd}/unit, ${best.totalLeadTime} days lead time`);
  }
}

// ============================================
// Test 6: Room Ontology
// ============================================

console.log('\n=== TEST 6: Room Ontology Coverage ===\n');

console.log('Available room types:');
for (const [key, room] of Object.entries(ROOM_ONTOLOGY)) {
  const manufactured = room.items.filter(i => i.category === 'MANUFACTURED').length;
  const procured = room.items.filter(i => i.category === 'PROCURED').length;
  console.log(`  ${room.name}: ${manufactured} manufactured, ${procured} procured items`);
}

console.log('\n=== ALL TESTS COMPLETE ===\n');
