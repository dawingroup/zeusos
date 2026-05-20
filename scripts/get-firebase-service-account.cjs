/**
 * Download Firebase service account key using Firebase CLI
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '../service-account-key.json');

console.log('📥 Attempting to download service account key...\n');

// Check if file already exists
if (fs.existsSync(outputPath)) {
  console.log('✓ Service account key already exists at:', outputPath);
  console.log('💡 Delete it first if you want to download a new one');
  process.exit(0);
}

console.log('❌ Automatic download not supported in non-interactive mode\n');
console.log('Please download the service account key manually:\n');
console.log('1. Open: https://console.firebase.google.com/project/dawinos/settings/serviceaccounts/adminsdk');
console.log('2. Click "Generate new private key"');
console.log('3. Save the file as: service-account-key.json');
console.log('4. Move it to:', outputPath);
console.log('\nOr run this command after downloading:');
console.log(`   mv ~/Downloads/dawinos-*.json ${outputPath}`);

process.exit(1);
