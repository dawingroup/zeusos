# QuickBooks OAuth Credentials Setup Guide

## 🎯 Overview

To connect DawinOS to QuickBooks Online, you need to:
1. Create a QuickBooks OAuth app
2. Configure Firebase with credentials
3. Set up encryption secrets
4. Deploy functions
5. Test connection

---

## 📋 Prerequisites

- Intuit Developer account
- Firebase CLI installed (`npm install -g firebase-tools`)
- Access to Google Cloud Console
- `openssl` installed (comes with macOS/Linux)

---

## 🚀 Quick Setup (Automated)

Run the setup script:

```bash
cd /Users/danielonzimai/CascadeProjects/dawinos
./setup-qb-secrets.sh
```

This will:
- Prompt for your QuickBooks credentials
- Generate encryption keys
- Configure Firebase
- Save secrets to `.env.local`
- Provide next steps

**Then skip to Step 4 below.**

---

## 🔧 Manual Setup (Step-by-Step)

### **Step 1: Create QuickBooks OAuth App**

1. **Sign in to Intuit Developer Portal**
   - Go to: https://developer.intuit.com/
   - Click "Sign In" (top right)
   - Use your Intuit/QuickBooks credentials

2. **Create New App**
   - Click "My Apps" → "Create an app"
   - Select "QuickBooks Online and Payments"
   - App name: `DawinOS Finance Integration`
   - Click "Create app"

3. **Get Credentials**
   - Go to "Keys & OAuth" tab
   - Under "Production Keys" section, you'll see:
     - **Client ID**: `ABxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - **Client Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Copy both and save them securely**

4. **Configure Redirect URI**
   - In the same "Keys & OAuth" tab
   - Under "Redirect URIs" section
   - Click "Add URI"
   - Enter: `https://us-central1-dawinos.cloudfunctions.net/qbCallback`
   - Click "Save"

5. **Set Scopes**
   - Ensure "Accounting" scope is selected
   - This grants access to: `com.intuit.quickbooks.accounting`

---

### **Step 2: Configure Firebase Functions**

Set your QuickBooks credentials using Firebase CLI:

```bash
cd /Users/danielonzimai/CascadeProjects/dawinos

# Set credentials (replace with your actual values)
firebase functions:config:set \
  quickbooks.client_id="YOUR_CLIENT_ID_HERE" \
  quickbooks.client_secret="YOUR_CLIENT_SECRET_HERE" \
  quickbooks.redirect_uri="https://us-central1-dawinos.cloudfunctions.net/qbCallback"
```

**Verify configuration:**

```bash
firebase functions:config:get
```

You should see:
```json
{
  "quickbooks": {
    "client_id": "ABxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "client_secret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "redirect_uri": "https://us-central1-dawinos.cloudfunctions.net/qbCallback"
  }
}
```

---

### **Step 3: Set Up Encryption Secrets**

Your Cloud Functions use two secrets for encrypting tokens and securing OAuth state.

#### **3a. Generate Secure Keys**

```bash
# Generate 32-byte hex keys
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
OAUTH_STATE_SECRET=$(openssl rand -hex 32)

# Display keys (save these securely!)
echo "QBO_TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
echo "QBO_OAUTH_STATE_SECRET=$OAUTH_STATE_SECRET"
```

**⚠️ IMPORTANT: Save these keys! You'll need them for the next step.**

#### **3b. Create Secrets in Google Cloud**

1. **Go to Google Cloud Secret Manager**
   - URL: https://console.cloud.google.com/security/secret-manager?project=dawinos
   - Or: GCP Console → Security → Secret Manager

2. **Create First Secret**
   - Click "CREATE SECRET"
   - Name: `QBO_TOKEN_ENCRYPTION_KEY`
   - Secret value: (paste the token encryption key from above)
   - Click "CREATE SECRET"

3. **Create Second Secret**
   - Click "CREATE SECRET"
   - Name: `QBO_OAUTH_STATE_SECRET`
   - Secret value: (paste the OAuth state secret from above)
   - Click "CREATE SECRET"

4. **Grant Access to Functions**
   - For each secret, click on it
   - Go to "PERMISSIONS" tab
   - Click "GRANT ACCESS"
   - Add principal: `dawinos@appspot.gserviceaccount.com`
   - Role: "Secret Manager Secret Accessor"
   - Click "SAVE"

---

### **Step 4: Deploy Functions**

Deploy your Cloud Functions with the new configuration:

```bash
cd /Users/danielonzimai/CascadeProjects/dawinos

# Deploy all functions (or just QuickBooks functions)
firebase deploy --only functions

# Or deploy specific QuickBooks functions only:
firebase deploy --only functions:qbGetAuthUrl,functions:qbCallback,functions:qbCheckConnection
```

Wait for deployment to complete (usually 2-5 minutes).

---

### **Step 5: Verify Setup**

#### **5a. Check Function Deployment**

```bash
# List deployed functions
firebase functions:list
```

You should see:
- `qbGetAuthUrl`
- `qbCallback`
- `qbCheckConnection`

#### **5b. Check Function URL**

```bash
# Get callback URL
firebase functions:config:get quickbooks.redirect_uri
```

Should return:
```
https://us-central1-dawinos.cloudfunctions.net/qbCallback
```

#### **5c. Test in QuickBooks Developer Portal**

1. Go back to your app in Intuit Developer Portal
2. Under "Keys & OAuth" tab
3. Verify your redirect URI is listed and matches exactly:
   ```
   https://us-central1-dawinos.cloudfunctions.net/qbCallback
   ```

---

## 🧪 Testing the Connection

### **Option 1: Use Sandbox (Recommended)**

1. **Create Sandbox Company**
   - In Intuit Developer Portal → Dashboard
   - Click "Create sandbox company"
   - Fill in dummy company details
   - Note the Company ID

2. **Get Sandbox Credentials**
   - Go to "Keys & OAuth" tab
   - Under "Development Keys" (not Production Keys!)
   - Copy the **Development** Client ID and Secret

3. **Configure for Sandbox Testing**
   ```bash
   # Temporarily use development keys
   firebase functions:config:set \
     quickbooks.client_id="YOUR_DEV_CLIENT_ID" \
     quickbooks.client_secret="YOUR_DEV_CLIENT_SECRET"

   # Redeploy
   firebase deploy --only functions
   ```

4. **Connect from DawinOS**
   - Go to Finance → Integrations
   - Click "Connect QuickBooks"
   - Sign in with your Intuit Developer account
   - Select the **Sandbox** company
   - Authorize

### **Option 2: Use Production Immediately**

⚠️ **Not recommended for initial testing!**

1. Go to Finance → Integrations
2. Click "Connect QuickBooks"
3. Sign in with your production QuickBooks account
4. Select your actual company
5. Authorize

---

## 🔍 Troubleshooting

### **Error: "QuickBooks credentials not configured"**

**Solution:**
```bash
# Check if config is set
firebase functions:config:get

# If empty, set it again
firebase functions:config:set \
  quickbooks.client_id="YOUR_CLIENT_ID" \
  quickbooks.client_secret="YOUR_CLIENT_SECRET"

# Deploy functions
firebase deploy --only functions
```

### **Error: "Redirect URI mismatch"**

**Cause:** The redirect URI in QuickBooks app doesn't match your function URL.

**Solution:**
1. Check your function URL: `firebase functions:config:get quickbooks.redirect_uri`
2. Go to Intuit Developer Portal → Your App → Keys & OAuth
3. Ensure redirect URI matches exactly (including `https://`, no trailing slash)
4. Save and try again

### **Error: "Invalid client credentials"**

**Cause:** Client ID or Secret is incorrect.

**Solution:**
1. Go to Intuit Developer Portal → Your App → Keys & OAuth
2. Copy Client ID and Secret again (make sure no extra spaces)
3. Re-set in Firebase:
   ```bash
   firebase functions:config:set \
     quickbooks.client_id="CORRECT_CLIENT_ID" \
     quickbooks.client_secret="CORRECT_CLIENT_SECRET"
   ```
4. Redeploy: `firebase deploy --only functions`

### **Error: "Secret not found: QBO_TOKEN_ENCRYPTION_KEY"**

**Cause:** Secrets not created in Google Cloud Secret Manager.

**Solution:**
1. Go to: https://console.cloud.google.com/security/secret-manager?project=dawinos
2. Verify both secrets exist:
   - `QBO_TOKEN_ENCRYPTION_KEY`
   - `QBO_OAUTH_STATE_SECRET`
3. If missing, create them (see Step 3b above)
4. Verify service account has access to both secrets

### **Error: "Access denied to secret"**

**Cause:** Function service account doesn't have permission to access secrets.

**Solution:**
1. Go to each secret in Secret Manager
2. Click "PERMISSIONS" tab
3. Add principal: `dawinos@appspot.gserviceaccount.com`
4. Role: "Secret Manager Secret Accessor"
5. Save

---

## 📚 Reference

### **QuickBooks OAuth Endpoints**

- **Authorization URL:** `https://appcenter.intuit.com/connect/oauth2`
- **Token URL:** `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
- **API Base URL:** `https://quickbooks.api.intuit.com/v3/company/{realmId}`

### **Required OAuth Scope**

```
com.intuit.quickbooks.accounting
```

This grants access to:
- Chart of Accounts (read)
- Customers, Vendors (read/write)
- Invoices, Bills, Sales Orders (read/write)
- Journal Entries (write)
- Bank Transactions (read)
- Reports (Profit & Loss, Balance Sheet)

### **Token Expiration**

- **Access Token:** 1 hour
- **Refresh Token:** 100 days
- **Auto-refresh:** DawinOS automatically refreshes tokens before expiration

### **Security Measures**

- Tokens encrypted with AES-256-GCM before storage
- OAuth state signed with HMAC-SHA256
- Secrets stored in Google Cloud Secret Manager
- No tokens logged or exposed in responses

---

## ✅ Final Checklist

Before attempting to connect:

- [ ] QuickBooks OAuth app created in Intuit Developer Portal
- [ ] Client ID and Client Secret obtained
- [ ] Redirect URI configured: `https://us-central1-dawinos.cloudfunctions.net/qbCallback`
- [ ] Firebase Functions config set with credentials
- [ ] Encryption secrets created in Google Cloud Secret Manager
- [ ] Service account granted access to secrets
- [ ] Cloud Functions deployed successfully
- [ ] Functions `qbGetAuthUrl`, `qbCallback`, `qbCheckConnection` are live

---

## 🆘 Still Having Issues?

**Check Firebase Functions Logs:**

```bash
# View recent logs
firebase functions:log

# View specific function logs
firebase functions:log --only qbGetAuthUrl
firebase functions:log --only qbCallback
```

**Check deployed configuration:**

```bash
# View all config
firebase functions:config:get

# View specific config
firebase functions:config:get quickbooks
```

**Test function directly:**

```bash
# Test getAuthUrl (requires auth)
# This should return an error since you're not authenticated, but it confirms the function exists
curl https://us-central1-dawinos.cloudfunctions.net/qbGetAuthUrl
```

If you see `{"error":{"message":"Unauthenticated","status":"UNAUTHENTICATED"}}`, that's good! It means the function is deployed and working.

---

**Need help?** Check the Firebase Functions logs for detailed error messages.
