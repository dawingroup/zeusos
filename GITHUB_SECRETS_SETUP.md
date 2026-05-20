# GitHub Secrets Setup for Firebase Auto-Deploy

## Overview

For automatic deployment to work, you need to add two secrets to your GitHub repository. This allows GitHub Actions to authenticate with Firebase.

---

## Step 1: Get Your Firebase Project ID

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create one if you haven't)
3. Click the **gear icon** → **Project settings**
4. Copy the **Project ID** (e.g., `dawinos`)

---

## Step 2: Generate Firebase Service Account Key

1. In Firebase Console → **Project settings** → **Service accounts** tab
2. Make sure "Firebase Admin SDK" is selected
3. Click **"Generate new private key"**
4. Click **"Generate key"** in the confirmation dialog
5. A JSON file will download - **keep this secure!**

---

## Step 3: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** (tab at the top)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **"New repository secret"**

### Add First Secret: FIREBASE_PROJECT_ID

- **Name:** `FIREBASE_PROJECT_ID`
- **Value:** Your project ID (e.g., `dawinos`)
- Click **"Add secret"**

### Add Second Secret: FIREBASE_SERVICE_ACCOUNT

- **Name:** `FIREBASE_SERVICE_ACCOUNT`
- **Value:** Open the downloaded JSON file, copy the ENTIRE contents, and paste it
- Click **"Add secret"**

---

## Step 4: Update .firebaserc

In your local repo, edit `.firebaserc` to match your project:

```json
{
  "projects": {
    "default": "dawinos"
  }
}
```

Replace `dawinos` with your actual Firebase Project ID if different.

---

## Step 5: Push and Watch It Deploy!

```bash
git add .
git commit -m "Configure Firebase auto-deploy"
git push origin main
```

### Check Deployment Status

1. Go to your GitHub repo
2. Click **Actions** tab
3. You should see "Deploy to Firebase Hosting" running
4. Once complete (green checkmark), your site is live!

---

## Your Site URLs

After successful deployment:

- **Production:** `https://YOUR-PROJECT-ID.web.app`
- **Alternative:** `https://YOUR-PROJECT-ID.firebaseapp.com`

---

## Troubleshooting

### "Resource not accessible by integration"
- Make sure `GITHUB_TOKEN` permissions are set correctly
- Go to repo Settings → Actions → General → Workflow permissions
- Select "Read and write permissions"

### "Project not found"
- Verify `FIREBASE_PROJECT_ID` matches exactly
- Check that the service account has access to the project

### "Permission denied"
- Regenerate the service account key
- Make sure you copied the entire JSON content

---

## Preview Deployments (Pull Requests)

When you create a Pull Request:
1. GitHub Actions automatically deploys a preview
2. A comment is added to the PR with the preview URL
3. Preview URLs look like: `https://YOUR-PROJECT--pr123-abc456.web.app`
4. Great for testing changes before merging!
