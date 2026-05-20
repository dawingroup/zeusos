#!/usr/bin/env node

/**
 * Call the Cloud Function using Firebase CLI authentication
 * This uses the already-authenticated Firebase CLI session
 */

const https = require('https');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function getAccessToken() {
  try {
    // Get access token from Firebase CLI
    const token = execSync('firebase apps:sdkconfig --project dawinos -o json 2>/dev/null || firebase login:ci --no-localhost 2>&1', { encoding: 'utf-8' });

    // Try to extract token from various formats
    if (token.includes('{')) {
      const config = JSON.parse(token);
      return config.token || config.access_token;
    }

    return token.trim();
  } catch (error) {
    console.error('Failed to get Firebase token:', error.message);
    return null;
  }
}

async function callFunction(dryRun) {
  console.log('🚀 Calling generateDesignManagerEvents Cloud Function...\n');
  console.log(`Dry Run: ${dryRun}\n`);

  const data = JSON.stringify({
    data: { dryRun }
  });

  const options = {
    hostname: 'us-central1-dawinos.cloudfunctions.net',
    port: 443,
    path: '/generateDesignManagerEvents',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(responseData);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${responseData}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    const result = await callFunction(dryRun);

    // Display results
    console.log('='.repeat(60));
    console.log('📈 RESULTS');
    console.log('='.repeat(60));
    console.log(`Message: ${result.result.message}`);
    console.log('');
    console.log('Statistics:');
    console.log(`  Total Projects:     ${result.result.stats.total}`);
    console.log(`  Events Created:     ${result.result.stats.processed}`);
    console.log(`  Skipped (existing): ${result.result.stats.skipped}`);
    console.log(`  Errors:             ${result.result.stats.errors}`);
    console.log('');

    if (result.result.stats.byEventType && Object.keys(result.result.stats.byEventType).length > 0) {
      console.log('Events by Type:');
      Object.entries(result.result.stats.byEventType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type.padEnd(30)} ${count}`);
        });
      console.log('');
    }

    if (result.result.stats.byStage && Object.keys(result.result.stats.byStage).length > 0) {
      console.log('Projects by Stage:');
      Object.entries(result.result.stats.byStage)
        .sort((a, b) => b[1] - a[1])
        .forEach(([stage, count]) => {
          console.log(`  ${stage.padEnd(30)} ${count}`);
        });
      console.log('');
    }

    if (result.result.events && result.result.events.length > 0) {
      console.log(`Sample Events (showing ${Math.min(result.result.events.length, 10)} of ${result.result.totalEvents}):`);
      result.result.events.slice(0, 10).forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.projectName || event.projectId}`);
        console.log(`     Event: ${event.eventType} | Stage: ${event.stage}`);
        if (!event.dryRun) {
          console.log(`     Event ID: ${event.eventId}`);
        }
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
    console.error('\nThe function may require authentication or have restricted access.');
    console.error('This is likely due to IAM permissions on the Cloud Function.');
    process.exit(1);
  }
}

main();
