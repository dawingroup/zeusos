# Meta (Facebook + Instagram) Social Publishing

DawinOS Marketing publishes to Facebook Pages and Instagram Business accounts
via Meta's Graph API. This doc walks the maintainer through every Meta App
config field that must be filled in before App Review will grant Advanced
Access to `pages_manage_posts` and `instagram_content_publish`.

## Architecture

```
Browser → metaOAuthStart (Callable)  → Facebook Login URL
                                       (user authorizes)
                  Meta → metaOAuthCallback (HTTPS) → encrypt + store tokens
                                                     at integrations/social/{accountId}
Scheduler → socialPublisher (cron 5m)  → posts to Page/IG using stored tokens
Browser → metaDisconnect (Callable)    → deletes the token doc

Meta (deletion notice) → metaDataDeletionCallback (HTTPS, signed_request)
                       → deletes tokens, writes deletion ticket, returns URL+code
```

## Configure the Meta App

### 1. Create the app
- Type: Business
- Use cases: Page management + Instagram management
- Add products: Facebook Login for Business, Instagram Graph API

### 2. Set the OAuth redirect URI
- Facebook Login for Business → Settings → Valid OAuth Redirect URIs
- Add: `https://dawinos.web.app/marketing/accounts/oauth/meta/callback`

### 3. Configure OAuth permissions
Request these scopes (Advanced Access required after App Review):
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `instagram_basic`
- `instagram_content_publish`
- `business_management`

Privacy Policy URL: **`https://dawinos.web.app/privacy`**
(Do NOT use the Shopify storefront policy at `dawinfinishes.com/policies/privacy-policy` — Meta App Review will reject it because it doesn't mention Meta-specific data we collect.)

Terms of Service URL: `https://dawinos.web.app/terms` *(optional — not yet implemented)*

### 4. Store secrets in Google Secret Manager
```bash
firebase functions:secrets:set META_APP_ID
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set META_OAUTH_STATE_SECRET
firebase functions:secrets:set SOCIAL_TOKEN_ENCRYPTION_KEY  # 64-hex-char (32-byte) key
```

⚠️ **Never rotate `SOCIAL_TOKEN_ENCRYPTION_KEY` in place** — it would invalidate every connected token in production. Decrypt + re-encrypt during a migration window if rotation is ever needed.

### 5. Deploy the Cloud Functions
```bash
firebase deploy --only functions:metaOAuthStart,functions:metaOAuthCallback,functions:metaDisconnect,functions:metaDataDeletionCallback,functions:socialPublisher,functions:generateSocialCopy
```

### 6. Add the redirect URI's domain to App Domains
- App Settings → Basic → App Domains: `dawinos.web.app`

### 7. Test with a development Page
- Add yourself as an admin of a test Page
- Connect via DawinOS Marketing → Social Accounts → Connect
- Verify a draft post publishes when scheduled

### 8. Submit for App Review

For each Advanced Access permission, provide:
- A 60-90 second screen recording showing the end-to-end use inside DawinOS Marketing
- A test admin login (use a non-personal Facebook account)
- A written description of how the permission is used

**Required URLs to paste into the App Dashboard:**

| Field | URL |
| --- | --- |
| App Settings → Basic → **Privacy Policy URL** | `https://dawinos.web.app/privacy` |
| App Settings → Basic → **User Data Deletion** → Data Deletion Instructions URL | `https://dawinos.web.app/privacy#data-deletion` |
| App Settings → Basic → **User Data Deletion** → Data Deletion Callback URL | `https://us-central1-dawinos.cloudfunctions.net/metaDataDeletionCallback` |

Before submitting, verify the callback returns the right shape by hitting it with a fake signed_request:

```bash
APP_SECRET=$(gcloud secrets versions access latest --secret=META_APP_SECRET)
PAYLOAD=$(echo -n '{"user_id":"1234567890","algorithm":"HMAC-SHA256","issued_at":1700000000}' | base64 | tr '/+' '_-' | tr -d '=')
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$APP_SECRET" -binary | base64 | tr '/+' '_-' | tr -d '=')
curl -X POST "https://us-central1-dawinos.cloudfunctions.net/metaDataDeletionCallback" \
  -d "signed_request=$SIG.$PAYLOAD"
```

Expected response shape:
```json
{ "url": "https://dawinos.web.app/privacy/data-deletion?ticket=<hex>", "confirmation_code": "DAWINOS-<hex>" }
```

## Data deletion semantics

When Meta posts a deletion notice for `user_id=X`:

1. We verify the signed_request with `META_APP_SECRET` (HMAC-SHA256).
2. We query `socialMediaAccounts` where `connectedByMetaUserId == X`.
3. For each match we delete `integrations/social/accounts/{id}` (token doc) and mark `socialMediaAccounts/{id}` as `status: tracking`, `oauthEnabled: false`.
4. We write an audit doc at `dataDeletionRequests/{ticketId}` (server-only) and a redacted public copy at `publicDataDeletionTickets/{ticketId}` so the confirmation URL renders without auth.
5. We respond with `{ url, confirmation_code }` so Meta can display the deletion record to the user.

The `connectedByMetaUserId` field is recorded at connect time by an extra
`GET /me?fields=id` against the long-lived token. If that call ever failed
silently in production, the deletion callback would not be able to find the
account — check the `metaOAuthCallback` logs for the `could not fetch meta
user_id` warning.

## Token model

Token docs live at `integrations/social/{accountId}` and are AES-256-GCM
encrypted with `SOCIAL_TOKEN_ENCRYPTION_KEY`. Both the long-lived user token
and the per-Page page token are stored. Decryption helpers live in
`functions/src/integrations/social/meta/auth.js`.

Long-lived user tokens expire after ~60 days. Page tokens issued from a
long-lived user token do not expire as long as the user token is valid and
the user has not revoked the app.

## Related code

- `functions/src/integrations/social/meta/auth.js` — OAuth flow + token storage
- `functions/src/integrations/social/meta/publish.js` — Graph API post creation
- `functions/src/integrations/social/meta/dataDeletionCallback.js` — Meta deletion endpoint
- `functions/src/scheduled/socialPublisher.js` — cron that fires queued posts
- `src/pages/legal/PrivacyPolicyPage.tsx` — public `/privacy` + `/privacy/data-deletion` route
