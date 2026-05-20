#!/usr/bin/env node

/**
 * Post-build script to inject build timestamp into service worker
 */

const fs = require('fs');
const path = require('path');

const swPath = path.resolve(__dirname, '../dist/sw.js');

if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  const buildTimestamp = Date.now();
  swContent = swContent.replace(/__BUILD_TIMESTAMP__/g, buildTimestamp.toString());
  fs.writeFileSync(swPath, swContent);
  console.log(`\n✓ Service worker cache version updated to: ${buildTimestamp}\n`);
} else {
  console.error(`\n✗ Service worker not found at: ${swPath}\n`);
  process.exit(1);
}
