# Cutlist Processor v1.1 Setup Guide

This guide will help you set up the enhanced Cutlist Processor with Firebase Authentication, Google Drive integration, and Notion database connectivity.

## Prerequisites

- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Google Cloud Project with APIs enabled
- Notion workspace with databases set up
- Firebase project created

## 1. Firebase Setup

### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Enable Authentication with Google provider
4. Enable Hosting and Functions

### Configure Authentication
1. In Firebase Console → Authentication → Sign-in method
2. Enable Google provider
3. Add your domain to authorized domains
4. Note down the configuration values

### Set up Firebase Functions
1. In Firebase Console → Functions
2. Upgrade to Blaze plan (required for external API calls)
3. Set environment variables:
   ```bash
   firebase functions:config:set notion.api_key="your_notion_api_key"
   ```

## 2. Google Cloud Setup

### Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Google Drive API
   - Google Picker API
   - Google Identity API

### Create OAuth Credentials
1. Go to APIs & Credentials → Credentials
2. Create OAuth 2.0 Client ID
3. Add authorized JavaScript origins:
   - `http://localhost:5173` (for development)
   - Your production domain
4. Add authorized redirect URIs:
   - `http://localhost:5173/__/auth/handler` (for development)
   - `https://your-project.firebaseapp.com/__/auth/handler`

### Create API Key
1. Create a new API Key
2. Restrict it to Google Drive API and Google Picker API
3. Add HTTP referrer restrictions for security

## 3. Notion Setup

### Create Notion Integration
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create new internal integration
3. Copy the Internal Integration Token
4. Give it read/write permissions

### Set up Databases
You need two databases with these exact structures:

#### Clients Database
- **Name** (Title) - Client display name
- **Projects** (Relation to Business Projects) - Links to projects
- **Email** (Email) - Contact information
- **Status** (Status) - Client status (Active, Archived, etc.)

#### Business Projects Database  
- **Name** (Title) - Project name
- **Project Code** (Formula) - Auto-generated code (e.g., DF-2025-001)
- **Client** (Relation to Clients) - Link to client
- **📁 Google Drive Folder** (URL) - Project folder location
- **Status** (Status) - Project status (Active, In Progress, Completed, etc.)

### Share Databases with Integration
1. Open each database in Notion
2. Click "Share" → "Invite"
3. Add your integration by name
4. Grant "Edit" permissions

### Get Database IDs
1. Open each database in Notion
2. Copy the database ID from the URL:
   `https://notion.so/workspace/DATABASE_ID?v=...`
3. Update the IDs in `/functions/index.js`:
   ```javascript
   const CLIENTS_DATABASE_ID = 'your_clients_database_id';
   const PROJECTS_DATABASE_ID = 'your_projects_database_id';
   ```

## 4. Environment Configuration

### Frontend Environment (.env)
Copy `.env.example` to `.env` and fill in your values:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Google APIs
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

### Firebase Functions Environment
Set the Notion API key:
```bash
firebase functions:config:set notion.api_key="your_notion_internal_integration_token"
```

## 5. Installation & Deployment

### Install Dependencies
```bash
# Install main app dependencies
npm install

# Install functions dependencies
cd functions
npm install
cd ..
```

### Deploy to Firebase
```bash
# Login to Firebase
firebase login

# Deploy functions and hosting
npm run deploy
```

### Local Development
```bash
# Start development server
npm run dev

# In another terminal, start functions emulator
firebase emulators:start --only functions
```

## 6. Usage Workflow

1. **Sign In**: Users sign in with Google account
2. **Select Project**: Choose customer and project from Notion databases
3. **Upload CSV**: Upload cutlist data (local file or from Google Drive)
4. **Process Data**: Use the existing cutlist optimization tools
5. **Auto-Save**: Generated outputs automatically save to project's Google Drive folder

## 7. File Naming Convention

Output files are automatically named using this pattern:
- `[ProjectCode]-PGBison-[Date]-[Time].csv`
- `[ProjectCode]-CutlistOpt-[Date]-[Time].csv`
- `[ProjectCode]-KatanaBOM-[Date]-[Time].csv`

## 8. Troubleshooting

### Authentication Issues
- Check OAuth client configuration
- Verify authorized domains
- Ensure Firebase Auth is properly configured

### Notion API Issues
- Verify integration has access to databases
- Check database IDs are correct
- Ensure proper permissions are granted

### Google Drive Issues
- Check API key restrictions
- Verify OAuth scopes include Drive access
- Ensure folder URLs in Notion are correct

### Functions Deployment Issues
- Ensure Blaze plan is active
- Check environment variables are set
- Verify Node.js version compatibility

## 9. Security Notes

- Never commit `.env` files to version control
- Use environment variables for all sensitive data
- Restrict API keys to specific domains/IPs
- Regularly rotate API keys and tokens
- Monitor Firebase usage and costs

## Support

For issues or questions, contact the development team or refer to the technical proposal documentation.
