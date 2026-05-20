# Branding Guide

## Overview
This document describes the branding assets for the Dawin Group platform.

## Logo Component
The main logo component is located at:
- **Component**: `src/shared/components/branding/DawinGroupLogo.tsx`
- **Usage**: Import and use in React components
- **Props**:
  - `size`: Number (default: 40) - Logo size in pixels
  - `showText`: Boolean (default: false) - Display text alongside logo
  - `className`: String - Additional CSS classes

### Example Usage
```tsx
import { DawinGroupLogo } from '@/shared/components/branding/DawinGroupLogo';

// Simple logo
<DawinGroupLogo size={40} />

// Logo with text
<DawinGroupLogo size={48} showText={true} />
```

## Brand Colors
- **Primary Purple**: `#872E5C`
- **Secondary Orange**: `#E18425`
- **Gradient**: Linear gradient from purple to orange

## Favicon & Icons

### SVG Icons (Source)
The following SVG files are the source files for all icon sizes:
- `public/favicon.svg` - Main favicon
- `public/icons/icon-192x192.svg` - PWA icon (192x192)
- `public/icons/icon-512x512.svg` - PWA icon (512x512)

### PNG Icons (Generated)
PNG icons should be regenerated from SVG sources when branding changes.

**Icon Sizes Required**:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

**Apple Touch Icons**:
- 152x152, 167x167, 180x180

### Regenerating PNG Icons

To regenerate PNG icons from SVG sources, you can use one of these methods:

#### Method 1: Using Sharp (Node.js)
```bash
npm install -D sharp
```

Create a script at `scripts/generate-icons.js`:
```javascript
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = path.join(__dirname, '../public/favicon.svg');
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons
sizes.forEach(size => {
  sharp(svgPath)
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, `icon-${size}x${size}.png`))
    .then(() => console.log(`✓ Generated icon-${size}x${size}.png`))
    .catch(err => console.error(`✗ Error generating ${size}x${size}:`, err));
});

// Generate Apple Touch Icons
[152, 167, 180].forEach(size => {
  sharp(svgPath)
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, `apple-touch-icon-${size}x${size}.png`))
    .then(() => console.log(`✓ Generated apple-touch-icon-${size}x${size}.png`))
    .catch(err => console.error(`✗ Error generating apple icon ${size}x${size}:`, err));
});
```

Run with:
```bash
node scripts/generate-icons.js
```

#### Method 2: Online Tools
Use online SVG to PNG converters:
- [CloudConvert](https://cloudconvert.com/svg-to-png)
- [Convertio](https://convertio.co/svg-png/)

#### Method 3: Using Inkscape CLI
```bash
# Install Inkscape first
# macOS: brew install inkscape
# Then run for each size:
inkscape public/favicon.svg -w 192 -h 192 -o public/icons/icon-192x192.png
```

### Favicon.ico Generation
Modern browsers support SVG favicons, but for legacy browser support:

**Using ImageMagick**:
```bash
brew install imagemagick
convert public/favicon.svg -resize 32x32 public/favicon.ico
```

**Using online tools**:
- [Favicon.io](https://favicon.io/)
- [RealFaviconGenerator](https://realfavicongenerator.net/)

## Implementation Checklist
- [x] Create DawinGroupLogo component
- [x] Update Header component to use new logo
- [x] Create favicon.svg
- [x] Update icon SVG files (192x192, 512x512)
- [ ] Regenerate PNG icons from SVG sources
- [ ] Generate favicon.ico for legacy browser support
- [ ] Test on various devices and browsers

## Notes
- The logo uses a gradient from Dawin Group's purple (#872E5C) to orange (#E18425)
- The "DG" initials represent "Dawin Group"
- All icons should maintain consistent branding
- SVG files are preferred for web display due to scalability
- PNG files are required for PWA installation on various devices
