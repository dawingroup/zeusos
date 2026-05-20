/**
 * Generate PWA Icons from SVG
 * Run with: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Icon sizes required for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Badge size for notifications
const BADGE_SIZE = 72;

// Source SVG content (MatFlow logo)
const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="102" fill="#872E5C"/>
  <path d="M128 179 L230 179 L230 128 L333 256 L230 384 L230 333 L128 333 Z" fill="white"/>
  <path d="M282 179 L384 179 L384 333 L282 333 L282 282 L333 282 L333 230 L282 230 Z" fill="white"/>
</svg>`;

// Badge SVG (simpler design for small sizes)
const BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <rect width="72" height="72" rx="14" fill="#872E5C"/>
  <path d="M18 25 L32 25 L32 18 L47 36 L32 54 L32 47 L18 47 Z" fill="white"/>
  <path d="M39 25 L54 25 L54 47 L39 47 L39 39 L47 39 L47 33 L39 33 Z" fill="white"/>
</svg>`;

// Shortcut icons
const SHORTCUT_DELIVERY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="19" fill="#872E5C"/>
  <path d="M20 55 L20 35 L35 35 L35 30 L50 30 L50 35 L65 35 L65 55 L76 55 L76 70 L20 70 Z" fill="white" stroke="white" stroke-width="2"/>
  <circle cx="32" cy="70" r="6" fill="#872E5C"/>
  <circle cx="58" cy="70" r="6" fill="#872E5C"/>
</svg>`;

const SHORTCUT_BOQ_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="19" fill="#872E5C"/>
  <rect x="24" y="20" width="48" height="56" rx="4" fill="white"/>
  <rect x="32" y="32" width="20" height="4" fill="#872E5C"/>
  <rect x="32" y="42" width="32" height="4" fill="#872E5C"/>
  <rect x="32" y="52" width="28" height="4" fill="#872E5C"/>
  <rect x="32" y="62" width="24" height="4" fill="#872E5C"/>
</svg>`;

async function generateIcon(svgContent, size, outputPath) {
  try {
    const buffer = Buffer.from(svgContent);
    await sharp(buffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ Generated: ${path.basename(outputPath)} (${size}x${size})`);
  } catch (error) {
    console.error(`✗ Failed to generate ${outputPath}:`, error.message);
  }
}

async function main() {
  const iconsDir = path.join(rootDir, 'public', 'icons');
  const splashDir = path.join(rootDir, 'public', 'splash');
  const screenshotsDir = path.join(rootDir, 'public', 'screenshots');

  // Ensure directories exist
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(splashDir, { recursive: true });
  fs.mkdirSync(screenshotsDir, { recursive: true });

  console.log('Generating PWA icons...\n');

  // Generate main app icons
  for (const size of ICON_SIZES) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    await generateIcon(SVG_CONTENT, size, outputPath);
  }

  // Generate notification badge
  const badgePath = path.join(iconsDir, `badge-${BADGE_SIZE}x${BADGE_SIZE}.png`);
  await generateIcon(BADGE_SVG, BADGE_SIZE, badgePath);

  // Generate shortcut icons
  const shortcutDeliveryPath = path.join(iconsDir, 'shortcut-delivery.png');
  await generateIcon(SHORTCUT_DELIVERY_SVG, 96, shortcutDeliveryPath);

  const shortcutBoqPath = path.join(iconsDir, 'shortcut-boq.png');
  await generateIcon(SHORTCUT_BOQ_SVG, 96, shortcutBoqPath);

  // Generate Apple touch icons (same as main icons)
  console.log('\nGenerating Apple touch icons...');
  const appleSizes = [152, 167, 180];
  for (const size of appleSizes) {
    const outputPath = path.join(iconsDir, `apple-touch-icon-${size}x${size}.png`);
    await generateIcon(SVG_CONTENT, size, outputPath);
  }

  // Generate splash screens (simple branded screens)
  console.log('\nGenerating splash screens...');
  const splashSizes = [
    { width: 640, height: 1136, name: 'splash-640x1136.png' },
    { width: 750, height: 1334, name: 'splash-750x1334.png' },
    { width: 1242, height: 2208, name: 'splash-1242x2208.png' },
    { width: 1125, height: 2436, name: 'splash-1125x2436.png' },
  ];

  for (const { width, height, name } of splashSizes) {
    const splashPath = path.join(splashDir, name);
    await generateSplash(width, height, splashPath);
  }

  console.log('\n✅ Icon generation complete!');
  console.log(`   Icons saved to: ${iconsDir}`);
  console.log(`   Splash screens saved to: ${splashDir}`);
}

async function generateSplash(width, height, outputPath) {
  // Create a splash screen with centered logo
  const logoSize = Math.min(width, height) * 0.3;
  const logoX = (width - logoSize) / 2;
  const logoY = (height - logoSize) / 2 - height * 0.1;

  const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#872E5C"/>
    <g transform="translate(${logoX}, ${logoY})">
      <svg viewBox="0 0 512 512" width="${logoSize}" height="${logoSize}">
        <path d="M128 179 L230 179 L230 128 L333 256 L230 384 L230 333 L128 333 Z" fill="white"/>
        <path d="M282 179 L384 179 L384 333 L282 333 L282 282 L333 282 L333 230 L282 230 Z" fill="white"/>
      </svg>
    </g>
    <text x="${width / 2}" y="${logoY + logoSize + 60}" 
          font-family="system-ui, -apple-system, sans-serif" 
          font-size="${Math.min(width, height) * 0.06}" 
          font-weight="600"
          fill="white" 
          text-anchor="middle">MatFlow</text>
    <text x="${width / 2}" y="${logoY + logoSize + 100}" 
          font-family="system-ui, -apple-system, sans-serif" 
          font-size="${Math.min(width, height) * 0.03}" 
          fill="rgba(255,255,255,0.7)" 
          text-anchor="middle">Material Flow Management</text>
  </svg>`;

  try {
    const buffer = Buffer.from(splashSvg);
    await sharp(buffer)
      .resize(width, height)
      .png()
      .toFile(outputPath);
    console.log(`✓ Generated: ${path.basename(outputPath)} (${width}x${height})`);
  } catch (error) {
    console.error(`✗ Failed to generate ${outputPath}:`, error.message);
  }
}

main().catch(console.error);
