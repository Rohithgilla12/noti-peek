# Telemetry setup

Opt-in crash reporting for the noti-peek desktop app. Mirrors the privacy
contract in `landing/privacy.html` §4: crashes only, no notification content,
no identifiers.

## Install deps

```bash
cd app
bun add @sentry/browser
```

(`@tauri-apps/plugin-store` is already in `package.json`.)

## Build-time env

Set in `app/.env.production` (or the release workflow):

```
VITE_SENTRY_DSN=https://<public-key>@<org>.ingest.sentry.io/<project>
VITE_APP_VERSION=0.1.0
VITE_NOTIPEEK_CHANNEL=stable   # or "beta" to default-on
```

- `VITE_SENTRY_DSN` is missing → `telemetry.ts` silently no-ops. Safe default
  for local dev.
- `VITE_NOTIPEEK_CHANNEL=beta` → default-on for beta builds, still honoring
  user opt-out.

## Wire into app boot

In `app/src/main.tsx` (or wherever the root mounts):

```ts
import { initTelemetry } from './lib/telemetry';

void initTelemetry(); // fire-and-forget, safe when disabled
```

## Settings UI snippet

Drop into `Settings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getTelemetryPreference, setTelemetryPreference, TelemetryChannel } from '../lib/telemetry';

export function DiagnosticsSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void getTelemetryPreference().then(setEnabled);
  }, []);

  if (enabled === null) return null;

  return (
    <section className="settings-section">
      <h3>Diagnostics</h3>
      <label className="row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={async (e) => {
            const next = e.target.checked;
            await setTelemetryPreference(next);
            setEnabled(next);
          }}
        />
        <div>
          <div>Send anonymous crash reports</div>
          <div className="hint">
            Stack traces + app version only. Never notification content, URLs,
            or account info. See the privacy statement for details.
          </div>
        </div>
      </label>
      <p className="channel-note">
        Channel: <code>{TelemetryChannel}</code>
        {TelemetryChannel === 'beta' && ' — default-on for beta builds'}
      </p>
    </section>
  );
}
```

## What's captured vs scrubbed

Captured:
- Exception name + message + stack trace
- App version, channel (`stable` / `beta`), platform
- Breadcrumbs excluding `ui.click` / `ui.input`

Scrubbed before send:
- `user` object — deleted entirely
- Query strings on request URLs
- `Authorization` / `Cookie` headers
- Bearer tokens, URLs, email addresses in any string field (regex replacement)

## Runtime contract

Calling `setTelemetryPreference(false)` both persists the choice and calls
`Sentry.close(2000)` — the SDK flushes in-flight events and shuts down. No
further events will be sent until the user re-opts in.

## Verifying it works

Local dev (with a real DSN in `.env.local`):

```bash
bun run tauri dev
# In the app: Settings → Diagnostics → enable
# Then trigger a test error, e.g. from the devtools console:
#   window.dispatchEvent(new ErrorEvent('error', { error: new Error('test-crash') }))
# Confirm it lands in Sentry within a minute.
```

Prove the scrubber works by grepping the stored event for anything sensitive:

```bash
# In Sentry UI → Issues → click issue → raw JSON.
# Confirm: no Authorization headers, no bearer tokens, no notification titles,
# no URLs beyond the app's own routes.
```

## Incident: telemetry misfiring

If telemetry starts capturing something it shouldn't (reported by a user
or via manual audit):

1. Flip `VITE_SENTRY_DSN` to empty and cut a release — silences telemetry
   globally for all users on next auto-update.
2. Fix the scrubber in `telemetry.ts`, add a regression test if possible.
3. Delete the offending event(s) in Sentry.
4. Write up what leaked in `docs/notes.md` so future-you doesn't regress it.
