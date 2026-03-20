# Production Checklist

## 1) Local and CI Gates

Run these before every release:

```bash
# Backend
cd backend
bun install
bun run build
bun run test

# Desktop app frontend
cd ../app
bun install
bun run build

# Tauri Rust
cd src-tauri
cargo check
```

## 2) Environment Setup

Set production values in `backend/wrangler.toml`:

- `env.production.vars.APP_URL`
- `env.production.d1_databases[0].database_id`

Set required OAuth secrets in Cloudflare:

```bash
cd backend
wrangler secret put GITHUB_CLIENT_ID --env production
wrangler secret put GITHUB_CLIENT_SECRET --env production
wrangler secret put LINEAR_CLIENT_ID --env production
wrangler secret put LINEAR_CLIENT_SECRET --env production
wrangler secret put JIRA_CLIENT_ID --env production
wrangler secret put JIRA_CLIENT_SECRET --env production
wrangler secret put BITBUCKET_CLIENT_ID --env production
wrangler secret put BITBUCKET_CLIENT_SECRET --env production
```

## 3) Database Migration

Apply migrations before deploy:

```bash
cd backend
wrangler d1 execute noti-peek-db-production --remote --env production --file=./migrations/0001_initial.sql
wrangler d1 execute noti-peek-db-production --remote --env production --file=./migrations/0002_oauth_states.sql
```

The release expects:

- `0001_initial.sql`
- `0002_oauth_states.sql`

## 4) Deployment

Deploy Worker:

```bash
cd backend
bun run deploy --env production
```

Build/package desktop app:

```bash
cd app
bun run tauri build
```

## 5) Smoke Tests

- `GET /health` returns HTTP 200
- Device registration + verify succeeds
- GitHub and Linear connect flow works with `POST /auth/{provider}/start`
- Notification fetch works for connected providers
- Mark-as-read (single and bulk) works

## 6) Current Production Defaults

- Jira and Bitbucket are disabled by default (`ENABLE_EXPERIMENTAL_PROVIDERS=false`)
- Existing Jira/Bitbucket connections can still be disconnected from Settings
- OAuth flow uses server-issued one-time state (no device token in query params)
