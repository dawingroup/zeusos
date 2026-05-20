# Firebase Authentication Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select existing project
3. Follow the setup wizard

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google** provider
3. Toggle **Enable**
4. Set support email (your email)
5. Click **Save**

## Step 3: Add Authorized Domains

1. In Authentication → Settings → Authorized domains
2. Add these domains:
   - `localhost` (for development)
   - Your production domain (when deploying)

## Step 4: Get Firebase Configuration

1. Go to **Project Settings** (gear icon) → **General**
2. Scroll down to "Your apps" section
3. Click "Add app" → Web app (</>) if no web app exists
4. Register app with a name (e.g., "Cutlist Processor")
5. Copy the `firebaseConfig` object

Example config:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 5: Update .env File

Replace the placeholder values in `.env`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Google Drive API (same as Firebase for OAuth)
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_API_KEY=your-google-api-key
```

## Step 6: Test Authentication

1. Save the `.env` file
2. Restart the development server: `npm run dev`
3. Open the app in browser
4. Click the "Sign In" button in the header
5. You should see Google OAuth popup

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Check that all environment variables are set correctly
- Restart the development server after updating .env

### "This app isn't verified"
- This is normal for development
- Click "Advanced" → "Go to [app name] (unsafe)"

### "redirect_uri_mismatch"
- Add `http://localhost:3000` to authorized domains in Firebase Console
- Check that the domain matches exactly

## Next Steps After Authentication Works

1. Set up Google Drive API credentials
2. Configure Notion integration
3. Test the complete workflow

## Quick Test

Once configured, you should be able to:
1. Click "Sign In with Google" 
2. See Google OAuth popup
3. After signing in, see your profile info in the header
4. Access Google Drive picker for file uploads
