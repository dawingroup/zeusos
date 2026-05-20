/**
 * Seed Test Clips
 * Creates sample design clips in Firestore for testing
 * 
 * Run: node scripts/seed-test-clips.mjs <userId>
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCVgMvkUsiDHDczPsrWT9YeL4n7i58bsb0",
  authDomain: "dawin-cutlist-processor.firebaseapp.com",
  projectId: "dawin-cutlist-processor",
  storageBucket: "dawin-cutlist-processor.firebasestorage.app",
  messagingSenderId: "834402569566",
  appId: "1:834402569566:web:418c09472582d7bea553cf",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample test clips
const testClips = [
  {
    title: 'Modern Walnut Sideboard',
    sourceUrl: 'https://example.com/sideboard-1',
    imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
    description: 'Sleek mid-century modern sideboard with walnut veneer',
    brand: 'West Elm',
    price: { amount: 1299, currency: 'USD', formatted: '$1,299' },
    materials: ['Walnut', 'Brass'],
    colors: ['#5D4037', '#D4AF37'],
    tags: ['sideboard', 'mid-century', 'walnut', 'storage'],
    syncStatus: 'synced',
  },
  {
    title: 'Scandinavian Oak Dining Table',
    sourceUrl: 'https://example.com/table-1',
    imageUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=400',
    description: 'Minimalist dining table with solid oak construction',
    brand: 'HAY',
    price: { amount: 2499, currency: 'USD', formatted: '$2,499' },
    materials: ['White Oak'],
    colors: ['#DEB887', '#F5F5DC'],
    tags: ['dining table', 'scandinavian', 'oak', 'minimalist'],
    syncStatus: 'synced',
  },
  {
    title: 'Industrial Steel Bookshelf',
    sourceUrl: 'https://example.com/shelf-1',
    imageUrl: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=400',
    description: 'Open metal frame bookshelf with reclaimed wood shelves',
    brand: 'Restoration Hardware',
    price: { amount: 1899, currency: 'USD', formatted: '$1,899' },
    materials: ['Steel', 'Reclaimed Wood'],
    colors: ['#2F4F4F', '#8B4513'],
    tags: ['bookshelf', 'industrial', 'steel', 'storage'],
    syncStatus: 'synced',
  },
  {
    title: 'Upholstered Accent Chair',
    sourceUrl: 'https://example.com/chair-1',
    imageUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400',
    description: 'Velvet upholstered accent chair with brass legs',
    brand: 'CB2',
    price: { amount: 799, currency: 'USD', formatted: '$799' },
    materials: ['Velvet', 'Brass', 'Foam'],
    colors: ['#228B22', '#D4AF37'],
    tags: ['chair', 'accent', 'velvet', 'seating'],
    syncStatus: 'synced',
  },
  {
    title: 'Custom Built-in Wardrobe',
    sourceUrl: 'https://example.com/wardrobe-1',
    imageUrl: 'https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=400',
    description: 'Floor-to-ceiling built-in wardrobe with LED lighting',
    brand: 'Custom',
    materials: ['MDF', 'Melamine', 'LED'],
    colors: ['#FFFFFF', '#F5F5F5'],
    tags: ['wardrobe', 'built-in', 'custom', 'storage', 'bedroom'],
    syncStatus: 'synced',
    aiAnalysis: {
      analyzedAt: new Date().toISOString(),
      confidence: 0.85,
      productType: 'Wardrobe',
      style: 'Modern',
      primaryMaterials: ['MDF', 'Melamine'],
      colors: ['#FFFFFF', '#F5F5F5'],
      suggestedTags: ['wardrobe', 'built-in', 'custom'],
      millworkAssessment: {
        isCustomCandidate: true,
        complexity: 'complex',
        keyFeatures: ['Built-in design', 'LED integration', 'Soft-close hinges'],
        estimatedHours: 40,
        considerations: ['Site measurement critical', 'Electrical for LED'],
      },
    },
  },
];

async function seedClips(userId) {
  console.log(`Seeding ${testClips.length} test clips for user: ${userId}`);
  
  const clipsRef = collection(db, 'designClips');
  
  for (const clip of testClips) {
    const docRef = await addDoc(clipsRef, {
      ...clip,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`  ✓ ${clip.title} (${docRef.id})`);
  }
  
  console.log('\n✅ Test clips seeded successfully!');
  console.log(`\nView at: http://localhost:3001/clipper`);
  process.exit(0);
}

// Get user ID from command line
const userId = process.argv[2];
if (!userId) {
  console.log('Usage: node scripts/seed-test-clips.mjs <userId>');
  console.log('\nTo get your userId:');
  console.log('1. Open the app and sign in');
  console.log('2. Open browser console');
  console.log('3. Run: firebase.auth().currentUser.uid');
  process.exit(1);
}

seedClips(userId).catch(console.error);
