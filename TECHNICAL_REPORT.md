# Cutlist Processor v1.1 - Technical Improvement Report

**Document Version:** 1.0  
**Date:** December 18, 2025  
**Project:** Dawin Cutlist Processor  
**Live URL:** https://dawinos.web.app  

---

## Executive Summary

This report documents the technical improvements and bug fixes implemented in the Cutlist Processor application during the December 2025 development cycle. The primary focus was on integrating Notion database connectivity, enabling Google Drive auto-save functionality, and adding manual panel entry capabilities.

---

## 1. Authentication System

### 1.1 Google OAuth 2.0 Implementation

**File:** `src/contexts/AuthContext.jsx`

**Changes Made:**
- Switched from `signInWithRedirect` to `signInWithPopup` for more reliable authentication flow
- Implemented proper Google OAuth access token extraction and storage
- Added comprehensive error handling for authentication edge cases

**Technical Details:**
```javascript
// OAuth scopes configured in src/firebase/config.js
googleProvider.addScope('https://www.googleapis.com/auth/drive');
```

**Key Features:**
- Popup-based authentication eliminates redirect issues
- Access token stored in `localStorage` for Google Drive API calls
- Automatic token refresh on auth state changes
- Error handling for:
  - `auth/popup-closed-by-user`
  - `auth/popup-blocked`
  - `auth/unauthorized-domain`
  - `auth/cancelled-popup-request`

### 1.2 Token Management

**Implementation:**
- `getGoogleAccessToken()` function retrieves stored OAuth token
- Token automatically cleared on sign-out
- Token passed to Drive API for authenticated requests

---

## 2. Notion Integration

### 2.1 Firebase Cloud Functions API Proxy

**File:** `functions/index.js`

**Architecture:**
```
Frontend (React) → Firebase Hosting → Cloud Functions → Notion API
```

**Endpoints Implemented:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/customers` | GET | Fetch all customers from Notion Clients database |
| `/api/projects` | GET | Fetch projects filtered by customer ID |
| `/api/log-activity` | POST | Log activity to project pages |

### 2.2 Database Configuration

**Notion Databases:**
- **Clients Database ID:** `128a6be2745681ce8294f4b8d3a2e069`
- **Projects Database ID:** `128a6be27456815993acf071233e4ed3`

**Property Mappings:**

| Notion Property | API Response Field | Type |
|-----------------|-------------------|------|
| `Name` (title) | `name` | string |
| `Status` (select/status) | `status` | string |
| `Project Code` (formula) | `projectCode` | string |
| `📁 Google Drive Folder` (url) | `driveFolderUrl` | string |
| `Client` (relation) | Used for filtering | relation |

### 2.3 Data Transformation

**Customer Response:**
```javascript
{
  customers: [
    { id: "page-id", name: "Customer Name", status: "Active" }
  ]
}
```

**Project Response:**
```javascript
{
  projects: [
    {
      id: "page-id",
      name: "Project Name",
      projectCode: "DT-2025-001",
      status: "Active",
      driveFolderUrl: "https://drive.google.com/drive/folders/..."
    }
  ]
}
```

### 2.4 Frontend Integration

**File:** `src/components/CustomerProjectSelector.jsx`

**Changes:**
- Updated API endpoint paths from `/api/notion/customers` to `/api/customers`
- Fixed response data structure handling (`data.customers` instead of `data.results`)
- Corrected property access patterns for simplified API response

---

## 3. Google Drive Integration

### 3.1 Drive Service Implementation

**File:** `src/services/driveService.js`

**Core Functions:**

| Function | Purpose |
|----------|---------|
| `initializeDriveAPI(accessToken)` | Initialize Google Drive API client |
| `extractFolderIdFromUrl(url)` | Parse folder ID from various URL formats |
| `generateFileName(projectCode, outputType)` | Create standardized filenames |
| `saveToProjectFolder(content, fileName, folderUrl, token)` | Upload file to Drive |

### 3.2 URL Pattern Support

**Supported Google Drive URL Formats:**
```javascript
const patterns = [
  /\/folders\/([a-zA-Z0-9-_]+)/,  // Standard folder URL
  /id=([a-zA-Z0-9-_]+)/,          // ID parameter format
  /^([a-zA-Z0-9-_]+)$/            // Direct folder ID
];
```

### 3.3 File Upload Implementation

**API Endpoint:** `https://www.googleapis.com/upload/drive/v3/files`

**Key Parameters:**
- `uploadType=multipart` - Multipart upload for metadata + content
- `supportsAllDrives=true` - **Critical for Shared Drive (Team Drive) support**
- `fields=id,name,webViewLink` - Response fields

**Upload Process:**
```javascript
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify({
  name: fileName,
  parents: [folderId]
})], { type: 'application/json' }));
form.append('file', new Blob([fileContent], { type: 'text/csv' }));
```

### 3.4 File Naming Convention

**Format:** `[ProjectCode]-[OutputType]-[Date]-[Time].csv`

**Example:** `DT-2025-001-PGBison-2025-12-18-14-30-45.csv`

**Output Types:**
- `PGBison` - PG Bison format output
- `CutlistOpt` - CutlistOpt format output
- `KatanaBOM` - Katana BOM format output

---

## 4. Manual Panel Entry Feature

### 4.1 DataInputPanel Component

**File:** `src/App.jsx` (lines 455-867)

**New Capabilities:**
- Add panels manually without CSV upload
- Edit existing panel data inline
- Delete individual panels
- Clear all data with confirmation

### 4.2 Panel Data Structure

```javascript
{
  cabinet: string,      // Cabinet/unit name
  label: string,        // Part label (required)
  material: string,     // Material type
  thickness: number,    // Thickness in mm
  quantity: number,     // Number of pieces
  length: number,       // Length in mm (required)
  width: number,        // Width in mm (required)
  grain: number,        // 0 = Horizontal, 1 = Vertical
  topEdge: string,      // Top edge banding
  rightEdge: string,    // Right edge banding
  bottomEdge: string,   // Bottom edge banding
  leftEdge: string      // Left edge banding
}
```

### 4.3 Material Presets

**Available Materials:**
- Generic 0180
- OSB3
- Generic 0031
- Blockboard
- Plywood
- MDF

### 4.4 UI Components

**EditableRow Component:**
- Inline editing with save/cancel actions
- Input validation for numeric fields
- Material dropdown selection
- Grain direction toggle

---

## 5. Bug Fixes

### 5.1 Customer Dropdown Issue

**Problem:** Only one customer visible in dropdown  
**Root Cause:** Mismatch between frontend expectation (`data.results`) and backend response (`data.customers`)  
**Solution:** Updated `CustomerProjectSelector.jsx` to use correct response structure

### 5.2 Save to Drive Permission Error

**Problem:** "Cannot access the specified Google Drive folder"  
**Root Cause:** 
1. OAuth scope `drive.file` only allows access to app-created files
2. Missing Shared Drive support

**Solution:**
1. Changed OAuth scope to full `drive` access
2. Added `supportsAllDrives=true` parameter to upload API

### 5.3 Project Data Access

**Problem:** `handleAutoSave` accessing undefined properties  
**Root Cause:** Code expected raw Notion properties structure instead of simplified API response  
**Solution:** Updated property access:
```javascript
// Before (incorrect)
const projectCode = selectedProject.properties['Project Code']?.formula?.string;
const folderUrl = selectedProject.properties['📁 Google Drive Folder']?.url;

// After (correct)
const projectCode = selectedProject.projectCode || 'UNKNOWN';
const folderUrl = selectedProject.driveFolderUrl;
```

### 5.4 Manual Entry Visibility

**Problem:** Manual entry form only visible after data loaded  
**Root Cause:** Conditional rendering based on `rawData.length > 0`  
**Solution:** Removed conditional, panel now always visible

---

## 6. Configuration Files

### 6.1 Environment Variables

**File:** `.env`

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyCVgMvkUsiDHDczPsrWT9YeL4n7i58bsb0
VITE_FIREBASE_AUTH_DOMAIN=dawinos.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dawinos
VITE_FIREBASE_STORAGE_BUCKET=dawinos.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=834402569566
VITE_FIREBASE_APP_ID=1:834402569566:web:418c09472582d7bea553cf

# Google Drive API
VITE_GOOGLE_CLIENT_ID=834402569566-12o45vrb1o5cof5ek3i46dhjql9fmj97.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIzaSyCofQfUeq53HJTEp6J5nM0q4bm5s6Bub-I

# Notion API (used in Firebase Functions)
NOTION_API_KEY=your_notion_api_key_here
NOTION_CLIENTS_DATABASE_ID=128a6be2745681ce8294f4b8d3a2e069
NOTION_PROJECTS_DATABASE_ID=128a6be27456815993acf071233e4ed3
```

### 6.2 Firebase Configuration

**File:** `firebase.json`

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20"
    }
  ],
  "hosting": {
    "public": "dist",
    "rewrites": [
      { "source": "/api/**", "function": "api" },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

### 6.3 Functions Dependencies

**File:** `functions/package.json`

```json
{
  "dependencies": {
    "@notionhq/client": "^2.2.14",
    "cors": "^2.8.5",
    "firebase-admin": "^11.11.0",
    "firebase-functions": "^4.5.0"
  },
  "engines": {
    "node": "20"
  }
}
```

---

## 7. Project Structure

```
dawinos/
├── src/
│   ├── App.jsx                    # Main application component
│   ├── firebase/
│   │   └── config.js              # Firebase & OAuth configuration
│   ├── contexts/
│   │   └── AuthContext.jsx        # Authentication state management
│   ├── components/
│   │   ├── AuthButton.jsx         # Sign-in/out UI
│   │   ├── CustomerProjectSelector.jsx  # Notion database selectors
│   │   └── FileUpload.jsx         # File upload with Drive picker
│   └── services/
│       └── driveService.js        # Google Drive API integration
├── functions/
│   ├── index.js                   # Firebase Cloud Functions
│   └── package.json               # Functions dependencies
├── .env                           # Environment variables
├── firebase.json                  # Firebase configuration
├── SETUP.md                       # Setup instructions
└── TECHNICAL_REPORT.md            # This document
```

---

## 8. Deployment

### 8.1 Build Process

```bash
npm run build        # Vite production build
firebase deploy      # Deploy hosting + functions
```

### 8.2 Hosting

- **Platform:** Firebase Hosting
- **URL:** https://dawinos.web.app
- **Project ID:** dawinos

### 8.3 Functions

- **Runtime:** Node.js 20
- **Region:** us-central1
- **Invoker:** Public (allUsers)

---

## 9. Security Considerations

### 9.1 API Keys

- Firebase API keys are safe to expose (restricted by domain)
- Notion API key is server-side only (in Cloud Functions)
- Google OAuth tokens stored in localStorage (session-based)

### 9.2 OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `https://www.googleapis.com/auth/drive` | Full Drive access for folder writes |

### 9.3 CORS Configuration

Cloud Functions configured with permissive CORS for Firebase Hosting domain.

---

## 10. Future Considerations

### 10.1 Potential Improvements

1. **Token Refresh:** Implement automatic OAuth token refresh for long sessions
2. **Offline Support:** Add service worker for offline panel entry
3. **Batch Operations:** Support bulk panel import/export
4. **Activity Logging:** Implement `/api/log-activity` endpoint usage
5. **Error Recovery:** Add retry logic for failed Drive uploads

### 10.2 Known Limitations

1. OAuth tokens expire after ~1 hour; user must re-authenticate
2. Large file uploads may timeout on slow connections
3. Notion API rate limits apply (3 requests/second)

---

## Appendix A: API Reference

### GET /api/customers

**Response:**
```json
{
  "customers": [
    { "id": "uuid", "name": "string", "status": "string" }
  ]
}
```

### GET /api/projects?customerId={id}

**Parameters:**
- `customerId` (required): Notion page ID of customer

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "string",
      "projectCode": "string",
      "status": "string",
      "driveFolderUrl": "string"
    }
  ]
}
```

---

## Appendix B: Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-17 | 1.1.0 | Initial Notion + Drive integration |
| 2025-12-18 | 1.1.1 | Fixed customer dropdown, Drive permissions |
| 2025-12-18 | 1.1.2 | Added Shared Drive support |
| 2025-12-18 | 1.1.3 | Added manual panel entry feature |
| 2025-12-18 | 1.1.4 | Fixed manual entry visibility |

---

*Document generated by Cascade AI Assistant*
