# CI Firebase token rotation

The `FIREBASE_TOKEN` GitHub repository secret authenticates two workflows:

- [`.github/workflows/deploy-preview.yml`](../.github/workflows/deploy-preview.yml) — deploys every PR to a `pr-<number>` Hosting preview channel
- [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml) — deploys to live on push to `main` (hosting + functions + rules + indexes)

The token is generated via `firebase login:ci` and is long-lived but can be revoked at any time (sign-out, credential rotation, security policy). When that happens, both workflows will fail with `Process completed with exit code 2` at the `firebase` invocation step — the symptom looks like a hung run but is just an unauthenticated call.

## Symptoms

- Every PR shows a red **Deploy to preview channel** check.
- `gh secret list --repo dawingroup/zeusos` shows `FIREBASE_TOKEN` exists with a recent timestamp.
- The "Verify FIREBASE_TOKEN is set" step passes (token is non-empty) but the `firebase hosting:channel:deploy` step exits non-zero immediately.

Behaviour after this PR landed: instead of a red check, the `Validate Firebase auth` step actively calls `firebase projects:list` against the token. If it fails to authenticate, the remaining deploy steps are skipped and the job exits 0 with a `::warning::` annotation pointing back to this document. The workflow still surfaces the issue (warning annotation + skipped steps in the run UI) but does not block unrelated PR merges.

## Rotation procedure

1. **Locally**, on a machine signed in to a Google account that has at least the `Firebase Hosting Admin` + `Cloud Functions Admin` roles on the `zeusos` project:

   ```bash
   npx firebase login:ci
   ```

   Complete the OAuth flow in your browser. The CLI prints a token to stdout — copy it. Do not commit it anywhere.

2. **Update the GitHub repository secret** via the GitHub UI (no CLI write — `gh secret set` requires the SSH key to be loaded and we don't currently rotate via CLI):

   - Navigate to <https://github.com/dawingroup/zeusos/settings/secrets/actions>
   - Click `FIREBASE_TOKEN` → **Update**
   - Paste the new token → **Save**

3. **Re-run the failing checks** on an open PR (e.g. via `gh run rerun <run-id>`) to confirm the gate now passes and the preview deploy succeeds. The first successful run should comment a preview URL into the job summary.

4. **Verify production** by triggering the production workflow manually: `gh workflow run "Deploy to Production" --repo dawingroup/zeusos --ref main`. Confirm the verify-deployment job runs (it only runs when `deploy.outputs.deployed == 'true'`).

## Why not service-account JSON?

The Firebase team's recommended GitHub Action — [`FirebaseExtended/action-hosting-deploy`](https://github.com/FirebaseExtended/action-hosting-deploy) — uses a `FIREBASE_SERVICE_ACCOUNT_<PROJECT>` secret containing a JSON key for a service account, which is the durable alternative to a personal CI token.

We can't use it on this project: the GCP organization that hosts `zeusos` (project number `746031933844`) enforces `constraints/iam.disableServiceAccountKeyCreation`, which blocks key creation across all service accounts. See the comment block in `deploy-production.yml` (lines around the `Authenticate Firebase CLI` step) for the original removal note.

If the org policy is ever lifted, the migration is roughly:

1. Create a service account on `zeusos` with `Firebase Hosting Admin`, `Cloud Functions Admin`, `Firebase Rules Admin`, `Storage Admin`. Generate a JSON key.
2. Add the JSON as the `FIREBASE_SERVICE_ACCOUNT_ZEUSOS` repository secret.
3. Replace the `Install Firebase CLI` + `Validate Firebase auth` + `Deploy ...` steps with `FirebaseExtended/action-hosting-deploy@v0` (it handles auth, deploy, and PR comment in one step). Keep the validation pattern for the non-hosting steps (functions, rules, indexes) since the action only covers Hosting.
4. Remove `FIREBASE_TOKEN` from the repo secrets.

Until then, rotating `FIREBASE_TOKEN` per the procedure above is the supported path.
