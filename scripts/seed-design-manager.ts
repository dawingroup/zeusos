/**
 * Seed Design Manager Test Data
 * 
 * Run with: npx ts-node scripts/seed-design-manager.ts
 * Or add to package.json: "seed:design": "ts-node scripts/seed-design-manager.ts"
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';

// Firebase config - uses environment variables or defaults
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abc123',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Types
type DesignStage = 'concept' | 'preliminary' | 'technical' | 'pre-production' | 'production-ready';
type DesignCategory = 'casework' | 'furniture' | 'millwork' | 'doors' | 'fixtures' | 'specialty';
type RAGStatusValue = 'red' | 'amber' | 'green' | 'not-applicable';

// Helper to create RAG value
function createRAGValue(status: RAGStatusValue, notes: string = '') {
  return {
    status,
    notes,
    updatedAt: Timestamp.now(),
    updatedBy: 'seed-script',
  };
}

// Helper to create RAG status based on stage
function createRAGStatusForStage(stage: DesignStage, hasBlockers: boolean = false) {
  const getStatus = (stageIndex: number, aspectIndex: number): RAGStatusValue => {
    const stages: DesignStage[] = ['concept', 'preliminary', 'technical', 'pre-production', 'production-ready'];
    const currentIndex = stages.indexOf(stage);
    
    if (hasBlockers && aspectIndex === 0) return 'red';
    if (aspectIndex <= currentIndex) return 'green';
    if (aspectIndex === currentIndex + 1) return 'amber';
    return 'red';
  };

  return {
    designCompleteness: {
      overallDimensions: createRAGValue(getStatus(0, 0)),
      model3D: createRAGValue(getStatus(0, 1)),
      productionDrawings: createRAGValue(getStatus(0, 2)),
      materialSpecs: createRAGValue(getStatus(0, 1)),
      hardwareSpecs: createRAGValue(getStatus(0, 2)),
      finishSpecs: createRAGValue(getStatus(0, 2)),
      joineryDetails: createRAGValue(getStatus(0, 3)),
      tolerances: createRAGValue(getStatus(0, 3)),
      assemblyInstructions: createRAGValue(getStatus(0, 4)),
    },
    manufacturingReadiness: {
      materialAvailability: createRAGValue(getStatus(1, 2)),
      hardwareAvailability: createRAGValue(getStatus(1, 2)),
      toolingReadiness: createRAGValue(getStatus(1, 3)),
      processDocumentation: createRAGValue(getStatus(1, 3)),
      qualityCriteria: createRAGValue(getStatus(1, 3)),
      costValidation: createRAGValue(getStatus(1, 2), hasBlockers ? 'Awaiting supplier quotes' : ''),
    },
    qualityGates: {
      internalDesignReview: createRAGValue(getStatus(2, 1)),
      manufacturingReview: createRAGValue(getStatus(2, 3)),
      clientApproval: createRAGValue(getStatus(2, 2), hasBlockers ? 'Pending client feedback' : ''),
      prototypeValidation: createRAGValue(getStatus(2, 4)),
    },
  };
}

// Calculate readiness from RAG status
function calculateReadiness(ragStatus: ReturnType<typeof createRAGStatusForStage>): number {
  const allValues = [
    ...Object.values(ragStatus.designCompleteness),
    ...Object.values(ragStatus.manufacturingReadiness),
    ...Object.values(ragStatus.qualityGates),
  ];
  
  const applicable = allValues.filter(v => v.status !== 'not-applicable');
  if (applicable.length === 0) return 0;
  
  const scores: number[] = applicable.map(v => {
    switch (v.status) {
      case 'green': return 100;
      case 'amber': return 50;
      case 'red': return 0;
      default: return 0;
    }
  });
  
  return Math.round(scores.reduce((a, b) => a + b, 0) / applicable.length);
}

// Test data — P5: customerId is required on designProjects. The seed IDs
// are stable placeholders; `seed-customers.ts` (or the CRM seed) should
// create matching customer docs before this seed runs, otherwise the
// created projects will pass the rule check but be "dangling" per the
// audit-design-projects-customer.cjs report.
const testProjects = [
  {
    code: 'DF-2025-001',
    name: 'Smith Kitchen Renovation',
    description: 'Complete kitchen cabinetry and island for the Smith residence',
    customerId: 'seed-customer-smith',
    customerName: 'Smith Family',
    status: 'active' as const,
  },
  {
    code: 'DF-2025-002',
    name: 'Downtown Office Fitout',
    description: 'Reception desk, boardroom table, and executive furniture',
    customerId: 'seed-customer-techcorp',
    customerName: 'TechCorp Inc.',
    status: 'active' as const,
  },
];

const testItems = [
  // Project 1 items
  { projectIndex: 0, name: 'Kitchen Island', category: 'casework' as DesignCategory, stage: 'technical' as DesignStage, priority: 'high' as const },
  { projectIndex: 0, name: 'Upper Wall Cabinets', category: 'casework' as DesignCategory, stage: 'preliminary' as DesignStage, priority: 'medium' as const },
  { projectIndex: 0, name: 'Base Cabinets', category: 'casework' as DesignCategory, stage: 'preliminary' as DesignStage, priority: 'medium' as const },
  { projectIndex: 0, name: 'Pantry Unit', category: 'casework' as DesignCategory, stage: 'concept' as DesignStage, priority: 'low' as const, hasBlockers: true },
  { projectIndex: 0, name: 'Range Hood Surround', category: 'millwork' as DesignCategory, stage: 'concept' as DesignStage, priority: 'medium' as const },
  
  // Project 2 items
  { projectIndex: 1, name: 'Reception Desk', category: 'furniture' as DesignCategory, stage: 'pre-production' as DesignStage, priority: 'urgent' as const },
  { projectIndex: 1, name: 'Boardroom Table', category: 'furniture' as DesignCategory, stage: 'technical' as DesignStage, priority: 'high' as const },
  { projectIndex: 1, name: 'Executive Desk', category: 'furniture' as DesignCategory, stage: 'preliminary' as DesignStage, priority: 'medium' as const },
  { projectIndex: 1, name: 'Credenza Units', category: 'furniture' as DesignCategory, stage: 'concept' as DesignStage, priority: 'low' as const },
  { projectIndex: 1, name: 'Feature Wall Panels', category: 'millwork' as DesignCategory, stage: 'technical' as DesignStage, priority: 'high' as const, hasBlockers: true },
];

async function seedData() {
  console.log('🌱 Seeding Design Manager test data...\n');
  
  const projectIds: string[] = [];
  
  // Create projects
  console.log('📁 Creating projects...');
  for (const project of testProjects) {
    const docRef = await addDoc(collection(db, 'designProjects'), {
      ...project,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
    });
    projectIds.push(docRef.id);
    console.log(`   ✓ ${project.name} (${project.code})`);
  }
  
  console.log('\n📦 Creating design items...');
  let itemCount = 0;
  
  for (const item of testItems) {
    const projectId = projectIds[item.projectIndex];
    const projectCode = testProjects[item.projectIndex].code;
    
    const ragStatus = createRAGStatusForStage(item.stage, item.hasBlockers);
    const readiness = calculateReadiness(ragStatus);
    
    itemCount++;
    const itemCode = `${projectCode}-${String(itemCount).padStart(3, '0')}`;
    
    await addDoc(collection(db, 'designProjects', projectId, 'designItems'), {
      itemCode,
      name: item.name,
      description: `${item.name} for ${testProjects[item.projectIndex].name}`,
      category: item.category,
      projectId,
      projectCode,
      currentStage: item.stage,
      ragStatus,
      overallReadiness: readiness,
      stageHistory: [],
      approvals: [],
      files: [],
      priority: item.priority,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
    });
    
    console.log(`   ✓ ${itemCode}: ${item.name} [${item.stage}] ${item.hasBlockers ? '⚠️ has blockers' : ''}`);
  }
  
  console.log('\n✅ Seeding complete!');
  console.log(`   Created ${projectIds.length} projects`);
  console.log(`   Created ${testItems.length} design items`);
  console.log('\n🔗 Access at: http://localhost:5173/design');
  
  process.exit(0);
}

// Run
seedData().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
