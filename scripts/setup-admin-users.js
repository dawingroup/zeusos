/**
 * Setup Admin Users Script
 * Creates DawinUser profiles for admin users in Firestore
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCfSYtxRoHxp9bEUkVbCFTnMmq58QzUsg8",
  authDomain: "dawinos.firebaseapp.com",
  projectId: "dawinos",
  storageBucket: "dawinos.firebasestorage.app",
  messagingSenderId: "820903406446",
  appId: "1:820903406446:web:94a874a2b7625932f5ef7f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Admin users to setup
const adminUsers = [
  {
    email: 'onzimai@dawin.group',
    displayName: 'Onzimai David',
    globalRole: 'owner',
    jobTitle: 'System Administrator',
    department: 'IT'
  }
  // Add more admin users here
];

async function setupAdminUsers() {
  console.log('Setting up admin users...');
  
  for (const adminUser of adminUsers) {
    try {
      // Create a document ID based on email
      const userId = adminUser.email.replace(/[@.]/g, '_');
      
      const dawinUser = {
        id: userId,
        uid: userId, // This should match the Firebase Auth UID
        email: adminUser.email,
        displayName: adminUser.displayName,
        jobTitle: adminUser.jobTitle,
        department: adminUser.department,
        globalRole: adminUser.globalRole,
        isActive: true,
        subsidiaryAccess: [
          {
            subsidiaryId: 'dawin-finishes',
            hasAccess: true,
            modules: [
              { moduleId: 'design-manager', hasAccess: true },
              { moduleId: 'cutlist-processor', hasAccess: true },
              { moduleId: 'customer-hub', hasAccess: true },
              { moduleId: 'launch-pipeline', hasAccess: true },
              { moduleId: 'assets', hasAccess: true },
              { moduleId: 'inventory', hasAccess: true },
              { moduleId: 'clipper', hasAccess: true }
            ]
          },
          {
            subsidiaryId: 'dawin-advisory',
            hasAccess: true,
            modules: [
              { moduleId: 'investment-advisory', hasAccess: true },
              { moduleId: 'matflow', hasAccess: true },
              { moduleId: 'delivery', hasAccess: true }
            ]
          }
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', userId), dawinUser);
      console.log(`✓ Created user profile for ${adminUser.email}`);
      
    } catch (error) {
      console.error(`✗ Failed to create user profile for ${adminUser.email}:`, error);
    }
  }
  
  console.log('Admin users setup complete!');
}

// Run the setup
setupAdminUsers().catch(console.error);
