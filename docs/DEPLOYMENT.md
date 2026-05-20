# DawinOS v2.0 - Deployment Guide

## Overview

This guide covers deploying DawinOS v2.0 to Firebase Hosting with Firestore, Authentication, and Storage.

## Prerequisites

- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Access to the `dawinos` Firebase project
- GitHub repository access for CI/CD

## Environments

| Environment | URL | Branch |
|-------------|-----|--------|
| Production | https://dawinos.web.app | `main` |
| Staging | https://dawinos--staging.web.app | `develop` |
| Preview | https://dawinos--pr-{n}.web.app | Pull Requests |

## Manual Deployment

### 1. Authenticate with Firebase

```bash
firebase login
# Or re-authenticate if needed
firebase login --reauth
```

### 2. Select Project

```bash
firebase use dawinos
```

### 3. Build Application

```bash
# Production build
VITE_APP_ENV=production npm run build

# Staging build
VITE_APP_ENV=staging npm run build
```

### 4. Deploy

```bash
# Full deployment (hosting + rules + indexes)
firebase deploy --project dawinos

# Hosting only
firebase deploy --only hosting --project dawinos

# Firestore rules only
firebase deploy --only firestore:rules --project dawinos

# Firestore indexes only
firebase deploy --only firestore:indexes --project dawinos

# Storage rules only
firebase deploy --only storage --project dawinos
```

### 5. Preview Channel Deployment

```bash
# Deploy to a preview channel
firebase hosting:channel:deploy preview --expires 7d --project dawinos
```

## Automated Deployment (CI/CD)

### GitHub Actions Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push/PR | Lint, test, build |
| `deploy-staging.yml` | Push to `develop` | Deploy to staging channel |
| `deploy-production.yml` | Push to `main` | Deploy to production |
| `security-scan.yml` | Weekly + Push | Security scanning |
| `test.yml` | Push/PR | Run test suite |

### Required Secrets

Configure these secrets in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `FIREBASE_TOKEN` | Firebase CI token (`firebase login:ci`) |
| `FIREBASE_API_KEY` | Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `FIREBASE_APP_ID` | Firebase app ID |

### Generate Firebase CI Token

```bash
firebase login:ci
# Copy the token and add to GitHub Secrets as FIREBASE_TOKEN
```

## Environment Configuration

### Production (.env.production)

```bash
VITE_APP_ENV=production
VITE_FIREBASE_PROJECT_ID=dawinos
VITE_ANALYTICS_ENABLED=true
VITE_PERFORMANCE_MONITORING=true
```

### Staging (.env.staging)

```bash
VITE_APP_ENV=staging
VITE_FIREBASE_PROJECT_ID=dawinos
VITE_ANALYTICS_ENABLED=false
```

## Firestore Rules Deployment

### Testing Rules Locally

```bash
# Start emulators
firebase emulators:start

# Run rules tests
npm run test:integration
```

### Deploying Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules --project dawinos

# Deploy with dry-run first
firebase deploy --only firestore:rules --project dawinos --dry-run
```

## Backup and Recovery

### Create Backup

```bash
# Using the backup script
./scripts/backup.sh backup

# Using gcloud directly
gcloud firestore export gs://dawinos-backups/backup_$(date +%Y%m%d)
```

### Restore from Backup

```bash
gcloud firestore import gs://dawinos-backups/backup_20260107
```

## Rollback

### Hosting Rollback

```bash
# List recent deploys
firebase hosting:channel:list --project dawinos

# Rollback to previous version
firebase hosting:clone dawinos:live dawinos:rollback --project dawinos
```

## Monitoring

### Firebase Console

- [Firebase Console](https://console.firebase.google.com/project/dawinos)
- [Hosting Releases](https://console.firebase.google.com/project/dawinos/hosting/sites)
- [Firestore Usage](https://console.firebase.google.com/project/dawinos/firestore/usage)

### Health Checks

```bash
# Check hosting status
curl -I https://dawinos.web.app

# Check response content
curl -s https://dawinos.web.app | grep -i dawinos
```

## Troubleshooting

### Common Issues

**Build Fails**
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Firebase Auth Issues**
```bash
firebase login --reauth
firebase use dawinos
```

**Rules Deployment Fails**
```bash
# Validate rules syntax
firebase firestore:rules validate firestore.rules
```

**Hosting Not Updating**
```bash
# Force cache invalidation
firebase hosting:disable --project dawinos
firebase deploy --only hosting --project dawinos
```

## Security Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Security rules reviewed
- [ ] No sensitive data in code
- [ ] Environment variables configured
- [ ] CSP headers configured
- [ ] HTTPS enforced
- [ ] Rate limiting enabled
