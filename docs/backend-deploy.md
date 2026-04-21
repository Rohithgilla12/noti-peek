# Backend Deploy — api.notipeek.dev

> Ship the Hono Worker + D1 to production. Run once to bootstrap, then `bun run deploy --env production` on every subsequent change.
> Your production D1 database is already provisioned (see `backend/wrangler.toml` — id `386fa500-...`).

---

## Prereqs

- Cloudflare account on the same email as your Wrangler auth.
- `wrangler` authed: `cd backend && bun x wrangler whoami`. If not logged in: `bun x wrangler login`.
- `notipeek.dev` domain — ideally on Cloudflare DNS. If it's at another registrar, either transfer to Cloudflare or add the Cloudflare nameservers.

---

## 1. DNS for `api.notipeek.dev`

If the domain is on Cloudflare DNS, there's nothing to do manually — the Workers custom-domain setup in step 3 creates the record for you.

If the domain is registered elsewhere:
1. Cloudflare dashboard → Add a Site → enter `notipeek.dev` → follow the nameserver-change instructions at your registrar.
2. Wait for Cloudflare to see the nameserver change (minutes to hours).
3. Proceed to step 3.

---

## 2. Run migrations against production D1

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

You should see `users`, `connections`, `notifications_cache`, `oauth_states` (exact names depend on the migrations).

---

## 3. Set OAuth secrets

From `docs/production-checklist.md` — set all six. You'll need OAuth apps registered with each provider; for the experimental ones (Jira, Bitbucket) the placeholder values are fine for now since the feature flag is off.

```bash
cd backend

bun x wrangler secret put GITHUB_CLIENT_ID --env production
bun x wrangler secret put GITHUB_CLIENT_SECRET --env production
bun x wrangler secret put LINEAR_CLIENT_ID --env production
bun x wrangler secret put LINEAR_CLIENT_SECRET --env production

# Only needed when you flip ENABLE_EXPERIMENTAL_PROVIDERS to "true":
bun x wrangler secret put JIRA_CLIENT_ID --env production
bun x wrangler secret put JIRA_CLIENT_SECRET --env production
bun x wrangler secret put BITBUCKET_CLIENT_ID --env production
bun x wrangler secret put BITBUCKET_CLIENT_SECRET --env production
```

Each `secret put` prompts you to paste the value.

**OAuth callback URLs to configure in each provider's console:**

- GitHub: `https://api.notipeek.dev/auth/github/callback`
- Linear: `https://api.notipeek.dev/auth/linear/callback`
- Jira: `https://api.notipeek.dev/auth/jira/callback`
- Bitbucket: `https://api.notipeek.dev/auth/bitbucket/callback`

---

## 4. Deploy the Worker

```bash
cd backend
bun run deploy --env production
```

This runs `wrangler deploy --env production`. Expect output like:

```
Deployed noti-peek-api triggers (x.xx sec)
  https://noti-peek-api-production.<subdomain>.workers.dev
```

At this point the API works but only at the `.workers.dev` URL.

---

## 5. Attach the custom domain

Easiest path — Cloudflare dashboard:

1. Workers & Pages → select `noti-peek-api` → Settings → Triggers → Custom Domains → Add Custom Domain.
2. Enter `api.notipeek.dev`. Cloudflare provisions the DNS record + TLS cert.

Or via Wrangler — add this to `wrangler.toml` under `[env.production]` and redeploy:

```toml
routes = [
  { pattern = "api.notipeek.dev", custom_domain = true }
]
```

Either way, give it 1–3 minutes for the cert. Then:

```bash
curl -i https://api.notipeek.dev/health
```

Expect `HTTP/2 200` and `{"status":"ok"}` or similar.

---

## 6. Smoke test — device registration + OAuth start

```bash
# 1. Register a device, capture the token
TOKEN=$(curl -s -X POST https://api.notipeek.dev/auth/register | jq -r .device_token)
echo "$TOKEN"

# 2. Verify the token round-trips
curl -s -X POST https://api.notipeek.dev/auth/verify \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Start GitHub OAuth (server-issued state)
curl -s -X POST https://api.notipeek.dev/auth/github/start \
  -H "Authorization: Bearer $TOKEN" | jq
# Expect { "url": "https://github.com/login/oauth/authorize?..." }
```

If all three succeed, the backend is production-ready. Open the `url` from step 3 in a browser to complete the OAuth dance manually as a full end-to-end check.

---

## 7. Desktop app points here already

The CSP in `app/src-tauri/tauri.conf.json` already whitelists `https://api.notipeek.dev`. The Tauri HTTP capability (`app/src-tauri/capabilities/default.json`) already allows it. So as soon as your app's API base URL (in `app/src/lib/api.ts`) resolves to `https://api.notipeek.dev`, you're done.

Double-check:

```bash
grep -n "baseURL\|BASE_URL\|notipeek.dev\|workers.dev" app/src/lib/api.ts
```

If it's reading from an env var, set `VITE_API_URL=https://api.notipeek.dev` in production builds.

---

## 8. Ongoing deploys

Every subsequent change:

```bash
cd backend
bun run build   # typecheck
bun run test    # route + service tests
bun run deploy --env production
```

Consider adding a `deploy.yml` workflow that runs on push to `main` with a manual approval gate. Not blocking Phase 0, but worth doing once beta users depend on the API.

---

## Observability

Free-tier signals to lean on until you need more:

- **Cloudflare dashboard** → Workers → `noti-peek-api` → Metrics. Request count, errors, CPU time, p50/p95.
- **Tail logs live** during debugging:

  ```bash
  cd backend
  bun x wrangler tail --env production
  ```

- When you want structured logs across invocations, push to Logflare or Axiom via a fetch in a middleware. Cheap, non-blocking, adds searchable context.

---

## Rollback

```bash
cd backend
bun x wrangler rollback --env production
```

Or deploy a specific earlier version from `bun x wrangler deployments list --env production`.

D1 migrations are forward-only by convention — do not write destructive migrations without a paired revert script. For Phase 0 this is not a real risk since the schema is stable.

---

## Common failure modes

**`Error: D1 database not found`** — the `database_id` in `wrangler.toml` doesn't match what's in your Cloudflare account. Run `bun x wrangler d1 list` and compare.

**`Error: could not resolve secret GITHUB_CLIENT_SECRET`** — a secret wasn't set, or was set in the wrong env (default vs production). `bun x wrangler secret list --env production` to check.

**Custom domain returns `522` / `523` for a while after provisioning** — Cloudflare is still warming up. Usually 1–3 minutes. If it persists, check that the Worker is actually deployed to the production env (the `.workers.dev` URL responds).

**OAuth callback hits `api.notipeek.dev` but app never continues** — desktop app needs deep-link handling for the OAuth callback. Tauri v2 can do this via `tauri-plugin-deep-link`. Not required if you're using the poll-for-completion pattern on the app side; check `app/src/lib/api.ts` for how the current flow hands off post-callback.
