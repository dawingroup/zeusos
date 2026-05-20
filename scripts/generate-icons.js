/**
 * Icon Generation Script
 * Generates PNG icons from SVG sources for PWA and favicon support
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = join(__dirname, '../public/favicon.svg');
const iconsDir = join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

console.log('🎨 Generating icons from SVG...\n');

async function generateIcons() {
  // Generate standard PWA icons
  for (const size of sizes) {
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(join(iconsDir, `icon-${size}x${size}.png`));
      console.log(`✓ Generated icon-${size}x${size}.png`);
    } catch (err) {
      console.error(`✗ Error generating ${size}x${size}:`, err.message);
    }
  }

  // Generate Apple Touch Icons
  const appleSizes = [152, 167, 180];
  for (const size of appleSizes) {
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(join(iconsDir, `apple-touch-icon-${size}x${size}.png`));
      console.log(`✓ Generated apple-touch-icon-${size}x${size}.png`);
    } catch (err) {
      console.error(`✗ Error generating apple icon ${size}x${size}:`, err.message);
    }
  }

  // Generate small badge icon
  try {
    await sharp(svgPath)
      .resize(72, 72)
      .png()
      .toFile(join(iconsDir, 'badge-72x72.png'));
    console.log(`✓ Generated badge-72x72.png`);
  } catch (err) {
    console.error(`✗ Error generating badge:`, err.message);
  }

  // Generate favicon.ico (32x32 is standard)
  try {
    await sharp(svgPath)
      .resize(32, 32)
      .png()
      .toFile(join(__dirname, '../public/favicon-32x32.png'));
    console.log(`✓ Generated favicon-32x32.png`);
  } catch (err) {
    console.error(`✗ Error generating favicon PNG:`, err.message);
  }

  console.log('\n✨ Icon generation complete!');
  console.log('\nNote: For .ico format, use an online converter or ImageMagick:');
  console.log('  convert public/favicon-32x32.png public/favicon.ico');
}

generateIcons().catch(console.error);
