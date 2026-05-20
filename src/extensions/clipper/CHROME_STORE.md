# Chrome Web Store Publishing Guide

## Extension Details

**Name:** Dawin Design Clipper  
**Version:** 1.0.0  
**Category:** Productivity

## Short Description (132 chars max)
Clip furniture, millwork & design inspiration images to your projects. One-click capture with price detection and cloud sync.

## Detailed Description
Dawin Design Clipper is a powerful tool for interior designers, architects, and millwork professionals to capture and organize design inspiration from anywhere on the web.

### Key Features

**One-Click Image Clipping**
- Hover over any image and click to clip
- Right-click context menu for quick capture
- Keyboard shortcut (Alt+C) for instant clipping

**Automatic Metadata Extraction**
- Detects product prices from major retailers
- Extracts brand, SKU, and dimensions when available
- Captures product descriptions automatically

**Smart Site Parsers**
Built-in support for popular design websites:
- Pinterest
- Houzz
- Wayfair
- West Elm
- And more...

**Cloud Sync**
- Clips sync automatically to DawinOS
- Access your clips from any device
- Organize clips by project and room

**Project Integration**
- Link clips directly to design projects
- Categorize as inspiration, reference, or procurement
- Add notes and tags for easy organization

### Perfect For
- Interior Designers
- Architects
- Millwork & Cabinetry Professionals
- Furniture Designers
- Design Enthusiasts

### Privacy
This extension only accesses web pages when you actively use the clipping feature. Your clips are stored securely in your DawinOS account and are never shared with third parties.

## Screenshots Needed

1. **Sign-in Screen** (1280x800)
   - Shows the branded sign-in page with feature highlights

2. **Main Gallery View** (1280x800)
   - Shows clipped images in grid view with search and filters

3. **Clipping Mode Active** (1280x800)
   - Shows the clipping overlay on a furniture website

4. **Clip Detail View** (1280x800)
   - Shows extracted metadata (price, brand, dimensions)

5. **Sync Status** (1280x800)
   - Shows the sync indicator and cloud connection

## Icon Requirements

- **16x16** - Tab and context menu icon
- **48x48** - Extensions page icon  
- **128x128** - Chrome Web Store icon

Current icons are at: `public/icons/`

## Privacy Policy URL
https://dawinos.web.app/privacy

## Support URL
https://dawinos.web.app/support

## Building for Submission

```bash
cd src/extensions/clipper
npm install
npm run build
```

The `dist/` folder contains the production build ready for upload.

## Submission Checklist

- [ ] Update version number in manifest.json
- [ ] Build production bundle
- [ ] Take 5 screenshots (1280x800 each)
- [ ] Verify all icons are included
- [ ] Test sign-in flow
- [ ] Test clipping on multiple sites
- [ ] Test sync to DawinOS
- [ ] Write privacy policy
- [ ] Create support page
- [ ] Pay Chrome Web Store developer fee ($5 one-time)

## OAuth Configuration

The extension uses Chrome Identity API with these scopes:
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

OAuth Client ID: `820903406446-d0nh72b76ep9qtv3t56pu8uuumo9ebc1.apps.googleusercontent.com`

Ensure the Chrome Web Store application ID is added to the OAuth client's authorized origins after initial upload.

## Post-Publish Steps

1. Add Chrome Web Store app ID to Firebase OAuth config
2. Update extension ID in DawinOS for deep linking
3. Monitor reviews and crash reports
4. Set up auto-update workflow
