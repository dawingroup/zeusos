# Custom domain setup — `os.zeustheagency.com`

ZeusOS is reachable at two URLs:

| URL | Purpose |
|---|---|
| `https://os.zeustheagency.com` | **Canonical production** — what Zeus staff bookmark |
| `https://zeusos.web.app` | Default Firebase URL — left alive as a fallback |

Firebase Hosting will serve the same `dist/` build from both URLs once DNS is configured. The custom domain takes three coordinated steps because Firebase, Google OAuth, and the DNS provider each own one slice of the chain.

## Step 1 — Add the custom domain in Firebase Console

The Firebase CLI does **not** automate this step. You have to do it in the console once.

1. Open https://console.firebase.google.com/project/zeusos/hosting/sites
2. Click the `zeusos` site → **Add custom domain**
3. Enter `os.zeustheagency.com` → **Continue**
4. Firebase shows you **two records** to add at your DNS provider for `zeustheagency.com`:
   - One `TXT` record (ownership verification, e.g. `_firebase-hosting.os` → `google-site-verification=...`)
   - Two `A` records pointing `os` at the Firebase Hosting load balancer IPs (typically `199.36.158.100` and `199.36.158.101`)
5. Copy those exact values — you'll paste them in step 2.
6. Leave the Firebase tab open. It'll keep polling for DNS until both records resolve.

## Step 2 — Add the DNS records at your registrar

Wherever `zeustheagency.com` is registered (most likely Truehost, Cloudflare, or Squarespace if it was bundled with the site), add the two records Firebase showed you:

```
Type  Name  Value                                       TTL
TXT   os    google-site-verification=<…long string…>    auto / 300
A     os    199.36.158.100                              auto / 300
A     os    199.36.158.101                              auto / 300
```

If the registrar requires fully-qualified names: `os.zeustheagency.com` instead of just `os`.

**Cloudflare warning:** if `zeustheagency.com` lives behind Cloudflare's proxy, set the new `A` records to **DNS-only (grey cloud)** — Cloudflare proxying breaks Firebase's SSL cert issuance.

Propagation usually takes 5–15 minutes. You can check with:

```bash
dig +short os.zeustheagency.com
dig +short TXT _firebase-hosting.os.zeustheagency.com
```

Once both resolve, Firebase Console will tick the verification step and start issuing the Let's Encrypt cert (usually < 1 hour).

## Step 3 — Authorise the domain for Google OAuth

This is the step that gets missed and breaks sign-in with `auth/unauthorized-domain`. Firebase Auth maintains a separate whitelist of allowed redirect domains.

1. Open https://console.firebase.google.com/project/zeusos/authentication/settings
2. Scroll to **Authorized domains**
3. Click **Add domain** → enter `os.zeustheagency.com` → **Add**
4. Confirm both `zeusos.firebaseapp.com` and `localhost` are still there (Firebase adds them by default — don't remove).

## Step 4 — Verify

After cert provisioning completes:

```bash
curl -sS -o /dev/null -w "%{http_code} %{ssl_verify_result} %{time_total}s\n" \
  https://os.zeustheagency.com/
# Expect: 200 0 ~1s
```

Then open `https://os.zeustheagency.com/auth/login` in a private browser tab and click **Continue with Google**. If it works, you're done. If it errors with `auth/unauthorized-domain`, step 3 wasn't applied — re-check the authorised-domains list.

## What's hard-coded in code

- `firebase.json` CORS `Access-Control-Allow-Origin: https://os.zeustheagency.com` for `/api/**` and `/adobe/**` rewrites. (Today those Cloud Functions aren't deployed, so the header doesn't matter yet — but it's set so future API calls work without another deploy.)
- `index.html` `<meta property="og:url">` is dynamic — react-helmet-async sets it per-page.

Nothing else in code references the URL — the Vite SDK config uses Firebase's auto-detected `authDomain: zeusos.firebaseapp.com` which works regardless of the front-door URL.
