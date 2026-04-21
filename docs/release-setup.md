# Release Setup — Code Signing, Notarization, Auto-Update

> One-time setup to get `.github/workflows/release.yml` producing signed, notarized, auto-updating macOS builds.
> Assumes you already have an active Apple Developer Program membership.

---

## 1. Install frontend updater deps

```bash
cd app
bun add @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

The Rust side (`Cargo.toml`) and capabilities (`src-tauri/capabilities/default.json`) are already updated. `src-tauri/src/lib.rs` registers both plugins.

---

## 2. Generate Tauri updater signing keys

These are separate from your Apple certs — Tauri uses them to verify that update payloads actually came from you.

```bash
cd app
bun x @tauri-apps/cli signer generate -w ~/.tauri/noti-peek.key
```

- **Public key**: paste into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey` (replace the `REPLACE_WITH_...` placeholder).
- **Private key**: put the full contents of `~/.tauri/noti-peek.key` into GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`. If you set a password when generating, put it in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

**Back up the private key.** If you lose it, every existing install is stranded — you cannot rotate the key without re-signing from a fresh install.

---

## 3. Export your Developer ID certificate

You want the **Developer ID Application** cert (not "Apple Development" or "Mac App Store" — those are for different distribution paths).

1. Open Keychain Access → login keychain → My Certificates.
2. Find `Developer ID Application: Rohith Gilla (<TEAMID>)`. Right-click → Export → save as `.p12`, set a strong password.
3. Base64-encode it for GitHub Secrets:

   ```bash
   base64 -i DeveloperID.p12 | pbcopy
   ```

4. Paste into GitHub Secret `APPLE_CERTIFICATE`. The password goes in `APPLE_CERTIFICATE_PASSWORD`.

If you don't see a `Developer ID Application` cert: Apple Developer portal → Certificates, IDs & Profiles → Certificates → `+` → Developer ID Application → follow the CSR flow → download → double-click to install in Keychain.

---

## 4. Find your Team ID and signing identity

```bash
# Team ID
security find-identity -v -p codesigning | grep "Developer ID Application"
# Example output:
# 1) ABC123DEF4 "Developer ID Application: Rohith Gilla (TEAMID1234)"
```

- `APPLE_SIGNING_IDENTITY` = the full quoted string, e.g. `Developer ID Application: Rohith Gilla (TEAMID1234)`
- `APPLE_TEAM_ID` = the 10-character ID in parens, e.g. `TEAMID1234`

You can also find Team ID at developer.apple.com → Membership.

---

## 5. Create an app-specific password for notarization

Apple notarization uses your Apple ID + an app-specific password (not your real password).

1. Go to https://appleid.apple.com → Sign-in & Security → App-Specific Passwords → Generate.
2. Label it `noti-peek-notarization` or similar. Save the password immediately — you can't view it again.
3. Put into GitHub Secrets:
   - `APPLE_ID` = your Apple ID email
   - `APPLE_PASSWORD` = the app-specific password (format: `xxxx-xxxx-xxxx-xxxx`)

---

## 6. Final GitHub Secrets checklist

Set these under `Repo → Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Source | Purpose |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Step 2 (contents of `~/.tauri/noti-peek.key`) | Sign updater payloads |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Step 2 (the password you set) | Decrypt the key at build time |
| `APPLE_CERTIFICATE` | Step 3 (base64 of `.p12`) | Import cert into ephemeral keychain |
| `APPLE_CERTIFICATE_PASSWORD` | Step 3 (your export password) | Unlock the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Step 4 (full `"Developer ID Application: ..."` string) | Pick which cert to sign with |
| `APPLE_ID` | Step 5 | Notarization |
| `APPLE_PASSWORD` | Step 5 (app-specific password) | Notarization |
| `APPLE_TEAM_ID` | Step 4 (10-char ID) | Notarization |

That's 8 secrets. If one is missing the workflow will either fail to sign or fail to notarize — check `Build` logs first.

---

## 7. Commit the config changes and push

At this point the repo should already have:
- `app/src-tauri/tauri.conf.json` with the updater plugin block and real `pubkey`
- `app/src-tauri/Cargo.toml` with `tauri-plugin-updater` + `tauri-plugin-process`
- `app/src-tauri/src/lib.rs` with both plugins registered
- `app/src-tauri/capabilities/default.json` with `updater:default` and `process:default`
- `app/src/hooks/useUpdater.ts` — the React hook
- `.github/workflows/release.yml`

Commit everything and push to `main`. CI (`ci.yml`) runs on push and should pass.

---

## 8. First release — dry run

```bash
git tag v0.1.1
git push origin v0.1.1
```

This triggers `release.yml`. Expect the workflow to take 15–30 minutes on the first run (Rust cold build on both macOS runners). Watch for these log signals:

- **Sign step**: `signing with identity "Developer ID Application: ..."` — confirms `APPLE_SIGNING_IDENTITY` resolved.
- **Notarization**: `Notarizing ...` then `Accepted` — if it says `Invalid`, check notarization logs via:

  ```bash
  xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"
  ```

- **Updater artifacts**: look for `noti-peek_0.1.1_aarch64.app.tar.gz` + `.tar.gz.sig` in the release draft. No `.sig` file means `TAURI_SIGNING_PRIVATE_KEY` is missing.
- **`latest.json`**: the updater manifest. Must have a `platforms.darwin-aarch64.signature` that's not empty.

Once both matrix jobs green, the `publish` job flips the draft to published.

---

## 9. Settings UI integration

Add the "Check for updates" affordance to `app/src/components/Settings.tsx`. Minimal version:

```tsx
import { useUpdater } from '../hooks/useUpdater';

// inside your Settings component:
const { status, checkNow, installNow } = useUpdater();

// in the JSX, somewhere near the bottom:
<div className="py-3 border-t" style={{ borderColor: 'var(--bg-highlight)' }}>
  <div className="flex items-center justify-between">
    <div>
      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Updates</div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {status.kind === 'idle' && 'Click to check for updates.'}
        {status.kind === 'checking' && 'Checking...'}
        {status.kind === 'no-update' && "You're on the latest version."}
        {status.kind === 'available' && `v${status.update.version} available.`}
        {status.kind === 'downloading' && `Downloading ${status.percent ?? '?'}%...`}
        {status.kind === 'ready' && 'Restarting...'}
        {status.kind === 'error' && `Error: ${status.message}`}
      </div>
    </div>
    {status.kind === 'available' ? (
      <button onClick={installNow} className="px-3 py-1.5 text-xs rounded"
              style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}>
        Install & Restart
      </button>
    ) : (
      <button onClick={checkNow} disabled={status.kind === 'checking'}
              className="px-3 py-1.5 text-xs rounded"
              style={{ background: 'var(--bg-highlight)', color: 'var(--text-primary)' }}>
        Check for updates
      </button>
    )}
  </div>
</div>
```

For the background auto-check on app launch, pass `{ checkOnMount: true }` to `useUpdater` inside `App.tsx`. Keep the Settings version without `checkOnMount` so it's purely user-initiated.

---

## 10. End-to-end smoke test

1. Install `v0.1.0` (your current existing build — or build once locally and install it).
2. Tag and push `v0.1.1` → wait for the workflow.
3. Open the installed `v0.1.0`. It should detect the new version (if `checkOnMount` is on) or you click "Check for updates" in Settings.
4. Click "Install & Restart" → app downloads → quits → relaunches as `v0.1.1`.

If this works, you have a real release pipeline. Everything after this is iteration: tag, push, wait, done.

---

## Troubleshooting

**"Errors during signing: code signing failed with CSSM_ERR ..."**
Cert not in the ephemeral keychain, or wrong password. Re-check `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD`. Run `security find-identity -v -p codesigning` inside the workflow (temporarily) to confirm the identity is present.

**"Notarization failed: Invalid"**
Run `xcrun notarytool log` with the submission ID from the logs. Common causes: app isn't hardened runtime (Tauri v2 sets this, but double-check), or entitlements reference something not signed.

**"Signature verification failed" on auto-update**
`TAURI_SIGNING_PRIVATE_KEY` doesn't match the `pubkey` in `tauri.conf.json`. Regenerate keys, update both places, rebuild.

**User on v0.1.0 never gets the update prompt**
Check the `endpoints` URL in `tauri.conf.json` resolves in a browser. The updater hits it at every `check()` call. If the URL 404s, nothing happens silently.

**Workflow passes but no `.sig` files on the release**
`createUpdaterArtifacts: true` is missing from `tauri.conf.json` `bundle` section. Or the workflow is passing `includeUpdaterJson: false` — confirm the workflow YAML.
