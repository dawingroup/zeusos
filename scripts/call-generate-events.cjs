/**
 * Call the Cloud Function to generate Design Manager events
 * This bypasses the need for service account keys
 */

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const email = process.env.FIREBASE_USER_EMAIL || args.find(arg => arg.includes('@'));
const password = process.env.FIREBASE_USER_PASSWORD;

async function main() {
  try {
    console.log('🔐 Authenticating with Firebase...\n');

    if (!email || !password) {
      console.error('❌ Missing authentication credentials');
      console.log('\nPlease set environment variables:');
      console.log('  FIREBASE_USER_EMAIL=your-email@example.com');
      console.log('  FIREBASE_USER_PASSWORD=your-password');
      console.log('\nOr provide email as argument:');
      console.log('  node call-generate-events.cjs --dry-run your-email@example.com');
      process.exit(1);
    }

    // Sign in
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✓ Authenticated successfully\n');

    // Call the cloud function
    console.log(`🚀 Calling generateDesignManagerEvents function (dryRun: ${dryRun})...\n`);

    const generateEvents = httpsCallable(functions, 'generateDesignManagerEvents');
    const result = await generateEvents({ dryRun });

    // Display results
    console.log('='.repeat(60));
    console.log('📈 RESULTS');
    console.log('='.repeat(60));
    console.log(`Message: ${result.data.message}`);
    console.log('');
    console.log('Statistics:');
    console.log(`  Total Projects:     ${result.data.stats.total}`);
    console.log(`  Events Created:     ${result.data.stats.processed}`);
    console.log(`  Skipped (existing): ${result.data.stats.skipped}`);
    console.log(`  Errors:             ${result.data.stats.errors}`);
    console.log('');

    if (result.data.stats.byEventType && Object.keys(result.data.stats.byEventType).length > 0) {
      console.log('Events by Type:');
      Object.entries(result.data.stats.byEventType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type.padEnd(30)} ${count}`);
        });
      console.log('');
    }

    if (result.data.stats.byStage && Object.keys(result.data.stats.byStage).length > 0) {
      console.log('Projects by Stage:');
      Object.entries(result.data.stats.byStage)
        .sort((a, b) => b[1] - a[1])
        .forEach(([stage, count]) => {
          console.log(`  ${stage.padEnd(30)} ${count}`);
        });
      console.log('');
    }

    if (result.data.events && result.data.events.length > 0) {
      console.log(`Sample Events (showing ${Math.min(result.data.events.length, 10)} of ${result.data.totalEvents}):`);
      result.data.events.slice(0, 10).forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.projectName || event.projectId}`);
        console.log(`     Event: ${event.eventType} | Stage: ${event.stage}`);
        if (!event.dryRun) {
          console.log(`     Event ID: ${event.eventId}`);
        }
      });
      console.log('');
    }

    if (result.data.errors && result.data.errors.length > 0) {
      console.log('Errors:');
      result.data.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. Project ${error.projectId}: ${error.error}`);
      });
      console.log('');
    }

    if (dryRun) {
      console.log('💡 This was a dry run. Run without --dry-run to actually create events.');
    } else {
      console.log('✅ Business events created successfully!');
      console.log('💡 The Intelligence Layer will now process these events and generate tasks.');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('Code:', error.code);
    }
    if (error.details) {
      console.error('Details:', error.details);
    }
    process.exit(1);
  }
}

main();
