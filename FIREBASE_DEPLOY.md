# Firebase Hosting Deployment Guide

## Dawin Cutlist Processor - Google Cloud Deployment

This guide walks you through deploying the Cutlist Processor to Firebase Hosting, Google's static site hosting service.

---

## Prerequisites

1. **Google Account** with access to Firebase (uses same Google Workspace credentials)
2. **Node.js 18+** installed locally
3. **Git** repository set up

---

## Step 1: Install Firebase CLI

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Verify installation
firebase --version
```

---

## Step 2: Login to Firebase

```bash
# Login with your Google account
firebase login

# This opens a browser window - sign in with your Dawin Google Workspace account
```

---

## Step 3: Create Firebase Project

### Option A: Via Firebase Console (Recommended for first time)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"** (or "Add project")
3. Enter project name: `dawinos` (or your preference)
4. Disable Google Analytics (not needed for this app) or enable if desired
5. Click **"Create project"**
6. Wait for project creation, then click **"Continue"**

### Option B: Via CLI

```bash
firebase projects:create dawinos --display-name "DawinOS"
```

---

## Step 4: Initialize Firebase in Your Project

```bash
# Navigate to your project directory
cd dawin-cutlist-app

# Initialize Firebase (if not already done)
firebase init hosting
```

When prompted:
- **Select project**: Choose your Firebase project
- **Public directory**: Enter `dist`
- **Single-page app**: Yes
- **Automatic builds with GitHub**: Choose based on preference (recommended: Yes)
- **Overwrite index.html**: No

---

## Step 5: Update .firebaserc

Edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with your actual project ID:

```json
{
  "projects": {
    "default": "dawinos"
  }
}
```

---

## Step 6: Build and Deploy

```bash
# Build the production version
npm run build

# Deploy to Firebase
firebase deploy

# Or use the combined command
npm run deploy
```

After deployment, you'll see output like:
```
✔ Deploy complete!

Hosting URL: https://dawinos.web.app
```

---

## Preview Deployments (For Testing)

Create temporary preview URLs for testing before production:

```bash
# Create a preview channel
npm run deploy:preview

# Or with custom channel name
firebase hosting:channel:deploy staging --expires 7d
```

This creates a URL like: `https://dawinos--preview-abc123.web.app`

---

## Custom Domain Setup

### Add Your Own Domain (e.g., cutlist.dawingroup.com)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Hosting** in the left sidebar
4. Click **"Add custom domain"**
5. Enter your domain: `cutlist.dawingroup.com`
6. Follow DNS verification steps:
   - Add TXT record to verify ownership
   - Add A records pointing to Firebase IPs
7. Wait for SSL certificate provisioning (usually 24-48 hours)

### DNS Records to Add (in Google Domains or your DNS provider)

```
Type    Name                Value
TXT     cutlist             firebase-verification-code-here
A       cutlist             151.101.1.195
A       cutlist             151.101.65.195
```

---

## GitHub Actions Auto-Deploy (CI/CD)

### Enable Automatic Deploys on Push

1. In Firebase Console → Hosting → Click **"Get started"** under GitHub integration
2. Authorize Firebase to access your GitHub
3. Select your repository
4. Configure:
   - Deploy on merge to `main` branch: ✅
   - Create preview for PRs: ✅ (optional but recommended)

### Manual GitHub Actions Setup

Create `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Firebase (Production)
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: dawinos
      
      - name: Deploy to Firebase (Preview)
        if: github.event_name == 'pull_request'
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: dawinos
```

### Generate Service Account Key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click **"Generate new private key"**
3. In GitHub repo → Settings → Secrets → Actions
4. Add new secret: `FIREBASE_SERVICE_ACCOUNT` with the JSON content

---

## Useful Commands Reference

```bash
# Login/Logout
firebase login
firebase logout

# Project management
firebase projects:list
firebase use <project-id>

# Deployment
firebase deploy                              # Full deploy
firebase deploy --only hosting               # Hosting only
firebase hosting:channel:deploy preview      # Preview deploy
firebase hosting:channel:delete preview      # Delete preview

# View deployment history
firebase hosting:sites:list
firebase hosting:releases:list

# Open project in browser
firebase open hosting
firebase open console
```

---

## Pricing / Free Tier Limits

Firebase Hosting free tier includes:
- **10 GB storage**
- **360 MB/day** data transfer (~10,800 MB/month)
- **Unlimited** preview channels
- **SSL certificates** included
- **Custom domains** supported

This is more than sufficient for internal team use. If you exceed limits, Blaze (pay-as-you-go) pricing is very affordable.

---

## Troubleshooting

### "Permission denied" error
```bash
firebase logout
firebase login
```

### Build fails
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm run build
```

### Domain not working
- Verify DNS records are correct
- Wait 24-48 hours for propagation
- Check Firebase Console for status

### Preview URLs not accessible
- Ensure your Google account has Firebase project access
- Check if preview channel has expired

---

## Integration with Google Workspace

Since you're using Google Workspace, you can:

1. **Restrict access** using Identity-Aware Proxy (IAP) - requires upgrade to Blaze plan
2. **Use Google Sign-In** for authentication (future enhancement)
3. **Connect to Google Sheets** for data import/export (future enhancement)

---

## Support

For Firebase-specific issues:
- [Firebase Documentation](https://firebase.google.com/docs/hosting)
- [Firebase Status](https://status.firebase.google.com)
- [Stack Overflow - Firebase](https://stackoverflow.com/questions/tagged/firebase-hosting)
