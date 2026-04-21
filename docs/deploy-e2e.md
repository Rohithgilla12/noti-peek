# End-to-end deploy runbook

> The single sequence that takes noti-peek from local to publicly-installable.
> Tailored to your starting state as of 2026-04-21:
> - Domain: shipping on `.workers.dev` for now (no custom domain).
> - OAuth apps: GitHub ✅, Jira ✅, Bitbucket ✅, Linear ⚠️ (not yet).
> - Apple: Developer ID cert in Keychain, Team ID, app-specific password all ready.

Reads top-to-bottom. Do each section in order — later steps depend on earlier ones.

---

## Stage 0 — a deploy map (5 min read)

Three things get deployed, in this order, because each depends on the previous:

1. **Backend Worker → Cloudflare** (`*.workers.dev`). Must be live before the app can sign in against it.
2. **Desktop app → GitHub Releases** (signed + notarized + updater manifest). The app is built *pointing at* the Worker URL from step 1.
3. **Landing page → Cloudflare Pages** (`notipeek.dev` or a stopgap). Download buttons link to the Release from step 2.

Each stage has a "did it work?" smoke test. Don't move forward until it passes.

---

## Stage 1 — Backend to Cloudflare Workers

### 1.1 Auth + sanity

```bash
cd backend
bun install
bun x wrangler whoami            # must show your Cloudflare account
# If not logged in:
bun x wrangler login
```

### 1.2 Run production migrations against D1

```bash
cd backend

bun x wrangler d1 execute noti-peek-db-production \
  --remote --env production \
  --file=./migrations/0001_initial.sql

bun x wrangler d1 execute noti-peek-db-production \
  --remote --env production \
  --file=./migrations/0002_oauth_states.sql
```

Verify:

```bash
bun x wrangler d1 execute noti-peek-db-production \
  --remote --env production \
  --command="SELECT name FROM sqlite_master WHERE type='table';"
```

Expect `users`, `connections`, `oauth_states` (plus whatever the 0001 migration creates).

### 1.3 Set OAuth secrets

Linear isn't ready → skip. Jira/Bitbucket are behind `ENABLE_EXPERIMENTAL_PROVIDERS` which defaults off — you can set them now so they're ready to flip, or later.

```bash
cd backend

bun x wrangler secret put GITHUB_CLIENT_ID --env production
bun x wrangler secret put GITHUB_CLIENT_SECRET --env production

# Since you already have these OAuth apps, may as well set them now:
bun x wrangler secret put JIRA_CLIENT_ID --env production
bun x wrangler secret put JIRA_CLIENT_SECRET --env production
bun x wrangler secret put BITBUCKET_CLIENT_ID --env production
bun x wrangler secret put BITBUCKET_CLIENT_SECRET --env production

# Linear — when you register the app later:
# bun x wrangler secret put LINEAR_CLIENT_ID --env production
# bun x wrangler secret put LINEAR_CLIENT_SECRET --env production
```

**Do NOT flip `ENABLE_EXPERIMENTAL_PROVIDERS=true` for the first beta.** Keep
the surface small until the GitHub path is proven in real use.

### 1.4 Deploy

```bash
cd backend
bun run test                     # gate: must pass
bun run build                    # gate: tsc clean
bun run deploy --env production
```

Wrangler will print the deployed URL:

```
https://noti-peek-api-production.<your-subdomain>.workers.dev
```

**Copy that URL.** You'll paste it in the OAuth app config and the app build env.

### 1.5 Register OAuth callback URLs

Go to each provider's dashboard and set the callback. The URL pattern is:

```
<worker-url>/auth/<provider>/callback
```

With your Worker at `https://noti-peek-api-production.<sub>.workers.dev`:

- GitHub (https://github.com/settings/developers → your OAuth App → Authorization callback URL):
  - `https://noti-peek-api-production.<sub>.workers.dev/auth/github/callback`
- Jira (https://developer.atlassian.com/console → app → Authorization):
  - `https://noti-peek-api-production.<sub>.workers.dev/auth/jira/callback`
- Bitbucket (workspace settings → OAuth consumers → your consumer):
  - `https://noti-peek-api-production.<sub>.workers.dev/auth/bitbucket/callback`

### 1.6 Smoke test

```bash
WORKER=https://noti-peek-api-production.<sub>.workers.dev   # replace <sub>

# 1. Register
TOKEN=$(curl -s -X POST "$WORKER/auth/register" | jq -r .device_token)
echo "$TOKEN"

# 2. Verify round-trip
curl -s -X POST "$WORKER/auth/verify" -H "Authorization: Bearer $TOKEN" | jq

# 3. Start GitHub OAuth
curl -s -X POST "$WORKER/auth/github/start" -H "Authorization: Bearer $TOKEN" | jq
# Expect { "url": "https://github.com/login/oauth/authorize?..." }

# 4. Follow that URL in a browser, authorize, watch Wrangler tail:
bun x wrangler tail --env production
# You should see the /auth/github/callback request land, and then a 302.
```

If all 4 work, backend is live. Move on.

---

## Stage 2 — Desktop app, signed + notarized + released

### 2.1 Point the app at the Worker

Open `app/.env.production` (create if missing):

```
VITE_API_URL=https://noti-peek-api-production.<sub>.workers.dev
VITE_APP_VERSION=0.1.0
```

Don't commit a `.env.local` with the same values — this is production-only.

CSP in `app/src-tauri/tauri.conf.json` already whitelists `https://*.workers.dev/**`, so no tauri config change needed.

### 2.2 Generate the Tauri updater keypair (one-time)

```bash
cd app
bun add @tauri-apps/plugin-updater @tauri-apps/plugin-process
bun x tauri signer generate -w ~/.tauri/noti-peek.key
```

Save:
- `~/.tauri/noti-peek.key` → stays on your machine. Back it up (1Password).
- `~/.tauri/noti-peek.key.pub` → contents go into `tauri.conf.json` as the `pubkey`.

Edit `app/src-tauri/tauri.conf.json`:

```json
"updater": {
  "active": true,
  "dialog": false,
  "endpoints": [
    "https://github.com/Rohithgilla12/noti-peek/releases/latest/download/latest.json"
  ],
  "pubkey": "<paste the contents of noti-peek.key.pub here>"
}
```

### 2.3 Install Sentry (optional) or skip telemetry for v0.1.0

If you want telemetry on in beta:

```bash
cd app
bun add @sentry/browser
```

Then set `VITE_SENTRY_DSN` in `.env.production`. If not, leave it empty — the telemetry module silently no-ops.

### 2.4 Build once locally (proves the pipeline)

```bash
cd app
bun x tauri build
```

Expect artifacts in `app/src-tauri/target/release/bundle/`:
- `macos/noti-peek.app`
- `dmg/noti-peek_0.1.0_aarch64.dmg`
- `macos/noti-peek.app.tar.gz` (updater bundle)
- `macos/noti-peek.app.tar.gz.sig` (signature)

Note: this local build uses ad-hoc signing (`"signingIdentity": "-"` in
tauri.conf.json). For a notarized public release, the GitHub Actions workflow
overrides the signing identity via the `APPLE_SIGNING_IDENTITY` env.

### 2.5 Apple secrets — prepare the .p12 export

In Keychain Access on the Mac with your Developer ID cert:

1. Expand the cert to reveal its private key → right-click → **Export "Developer ID Application: …"** → save as `noti-peek.p12` with a strong password.
2. Base64 encode it:

```bash
base64 -i noti-peek.p12 | pbcopy
```

That's `APPLE_CERTIFICATE`. The password from step 1 is `APPLE_CERTIFICATE_PASSWORD`.

Find your signing identity string:

```bash
security find-identity -v -p codesigning
# Look for "Developer ID Application: Your Name (XXXXXXXXXX)"
# The full quoted string is APPLE_SIGNING_IDENTITY.
```

### 2.6 Set the 8 GitHub Secrets

At `https://github.com/Rohithgilla12/noti-peek/settings/secrets/actions` → New repository secret for each:

| Name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | contents of `~/.tauri/noti-peek.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the password you chose when generating, or empty string if none |
| `APPLE_CERTIFICATE` | base64 of `noti-peek.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | the .p12 export password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (XXXXXXXXXX)` |
| `APPLE_ID` | your Apple ID email |
| `APPLE_PASSWORD` | app-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-char team ID |

Also useful to set `VITE_API_URL` as a secret if you don't want to bake it into the repo's `.env.production`. The workflow can pipe it to the build.

### 2.7 Cut the first release

```bash
cd /path/to/noti-peek

# Make sure everything is committed
git status
git add .
git commit -m "chore: release 0.1.0-beta.1"
git push

# Tag
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

Watch the release workflow at `https://github.com/Rohithgilla12/noti-peek/actions`. It runs two matrix jobs (`macos-14` for Apple Silicon, `macos-13` for Intel), then a `publish` job that flips the draft release to published.

Expected duration: 8–15 min.

### 2.8 Smoke test the release

After the draft becomes published:

1. Download the `.dmg` from https://github.com/Rohithgilla12/noti-peek/releases/latest
2. Open it on a different Mac user account (not your dev user — tests Gatekeeper).
3. Drag noti-peek.app to Applications → open it.
4. **Gatekeeper should accept it silently.** If you get "unknown developer" prompts, notarization failed — check the workflow logs.
5. Inside the app: connect GitHub → verify notifications flow through from `api.notipeek.dev` (or your workers.dev URL).
6. Verify auto-update: in `tauri.conf.json` bump the version to `0.1.1-beta.1`, push the tag, wait for release. Launch the installed `0.1.0-beta.1` — it should offer the update within ~1 minute.

---

## Stage 3 — Landing page on Cloudflare Pages

### 3.1 Decision: domain or no domain?

You said `.workers.dev` for the API. For the landing page, you have three options:

- **A. Cloudflare Pages with pages.dev subdomain** — free, instant, ugly URL. Fine for beta.
- **B. Cloudflare Pages + notipeek.dev** — buy the domain ($10–12/yr), add to Cloudflare, point Pages at it. 30 min. Worth it when you share the link.
- **C. GitHub Pages** — also free, `rohithgilla12.github.io/noti-peek`. Works, but mixed messaging with api.notipeek.dev branding.

**Recommendation: A now, B within a week of shipping beta.** You can update the domain without rebuilding the app.

### 3.2 Ship landing to Cloudflare Pages

```bash
cd landing

# One-time: create a Cloudflare Pages project via Wrangler
bun x wrangler pages project create noti-peek-landing

# Deploy the static files
bun x wrangler pages deploy . --project-name noti-peek-landing
```

Output:

```
✨ Deployment complete! Take a peek over at https://<hash>.noti-peek-landing.pages.dev
```

The `https://noti-peek-landing.pages.dev` apex is your permanent URL.

### 3.3 Fix the download link

`landing/index.html` currently points to `https://github.com/Rohithgilla12/noti-peek/releases/latest` — that's a page, not a direct download. For a one-click UX, replace it with the direct DMG asset URL. GitHub Releases supports the convenience URL:

```
https://github.com/Rohithgilla12/noti-peek/releases/latest/download/noti-peek_0.1.0_aarch64.dmg
```

But that's version-locked. Better approach: keep the "/releases/latest" page link as the primary CTA, because the release page auto-lists both arm64 and x64 assets and handles future versions without you editing HTML. So: leave as-is.

### 3.4 Custom domain for landing (when ready)

In Cloudflare Pages → your project → Custom domains → Add `notipeek.dev`. Cloudflare provisions DNS + TLS automatically if the domain is on Cloudflare DNS.

---

## Stage 4 — post-ship checklist

### The first 24 hours

- [ ] Watch `bun x wrangler tail --env production` while you install the DMG on a clean Mac and click through OAuth. Any 5xx or unexpected logs are bugs to fix before wider sharing.
- [ ] Confirm `latest.json` at `https://github.com/Rohithgilla12/noti-peek/releases/latest/download/latest.json` is valid JSON with a `url`, `signature`, and `version`. The updater won't work otherwise.
- [ ] Star/bookmark your Sentry project (if you enabled telemetry) — crashes are the truth of how beta users are doing.

### Ongoing every release

1. Make changes, commit to `main`.
2. Update `app/src-tauri/tauri.conf.json` version + `app/package.json` version (if they're wired).
3. Tag: `git tag v0.1.x` and push.
4. Workflow auto-signs, notarizes, publishes, generates updater manifest.

### Ongoing every backend change

```bash
cd backend
bun run test && bun run build && bun run deploy --env production
```

A minute of your time. Consider wiring a GitHub Actions workflow for this later so you don't forget the test gate.

---

## Rollback cheat sheet

| Problem | Fix |
|---|---|
| Backend broke on latest deploy | `cd backend && bun x wrangler rollback --env production` |
| Release workflow failed mid-way | Delete the draft release on GitHub, fix the issue, re-tag (or move the tag with `git tag -f v0.1.x && git push -f origin v0.1.x` — only safe if no one downloaded the draft yet) |
| Bad release went public | Mark the GitHub release as pre-release or delete it, publish a fixed `0.1.x+1` tag. The updater will pick up the newer one on next check. Never silently reupload binaries to a published tag — updater signatures + user mistrust both break. |

---

## What this runbook does *not* cover

- Linear OAuth — register an app at https://linear.app/settings/api/applications once you want the second provider live, then set the secrets, then flip `ENABLE_EXPERIMENTAL_PROVIDERS` if you also want Jira/Bitbucket in the app UI.
- Custom `api.notipeek.dev` domain — see `docs/backend-deploy.md` §5. Do this when you're ready to commit to the brand / don't want OAuth callback URL churn.
- Paid tier / auth beyond device tokens.
- Windows + Linux builds.
