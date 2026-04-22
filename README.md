<div align="center">
  <img src=".github/assets/logo.svg" alt="noti-peek" width="72" height="72" />
  <h1>noti-peek</h1>
  <p><strong>One menubar. Every dev notification.</strong><br/>
  A fast macOS desktop app that unifies GitHub, Linear, Jira and Bitbucket notifications — intelligently bundled so you don't drown.</p>

  <p>
    <a href="https://github.com/Rohithgilla12/noti-peek/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Rohithgilla12/noti-peek/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://github.com/Rohithgilla12/noti-peek-releases/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Rohithgilla12/noti-peek-releases?label=release&color=1c1813"></a>
    <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-1c1813"></a>
    <img alt="macOS" src="https://img.shields.io/badge/macOS-10.15%2B-1c1813">
    <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-1c1813">
  </p>
</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/hero-light.svg">
  <img alt="noti-peek inbox view" src=".github/assets/hero-dark.svg">
</picture>

---

## Why

Developers spend the day triaging notifications scattered across GitHub, Linear, Jira and Bitbucket. Each tool has its own badge, its own inbox, its own cadence. You context-switch a dozen times before you've done a single unit of work.

noti-peek collapses those inboxes into a single, quiet surface that is designed to be opened, glanced at, and closed in under fifteen seconds. Anything that needs more attention than that opens in the tool it came from.

## What it does

- **Unified inbox.** GitHub, Linear, Jira and Bitbucket in one stream, grouped by day.
- **Pulse view.** A rolling 14-day snapshot of what you reviewed, merged, and responded to — answers *"is this actually noisier than last week, or does it just feel that way."*
- **Smart bundling.** Noisy threads (15 comments on one PR) collapse into a single line. Open to expand.
- **Keyboard-first.** `↵` open, `c` comment, `m` merge, `esc` dismiss. `r` refresh. `1` / `2` switch views. `⌘,` preferences.
- **Native menu + tray.** System tray, native app menu, desktop notifications on new activity.
- **Auto-updater.** Signed updates via [noti-peek-releases](https://github.com/Rohithgilla12/noti-peek-releases).
- **Local cache.** SQLite cache means the window opens instantly, then fetches in the background.

<details>
<summary><strong>Pulse view — what actually happened this week</strong></summary>

<br/>

![Pulse view](.github/assets/pulse-dark.svg)

</details>

## Architecture

```
 ┌─────────────────────┐             ┌───────────────────────────┐
 │                     │             │  Cloudflare Workers (Hono) │
 │   Tauri App         │ ─── REST ──▶│  OAuth · token refresh ·   │
 │   React · TypeScript│ ◀── JSON ───│  provider fan-out          │
 │   SQLite · Zustand  │             └──────────────┬─────────────┘
 └─────────────────────┘                            │
                                                    ▼
                                         ┌───────────────────────┐
                                         │  Cloudflare D1        │
                                         │  (edge SQLite)        │
                                         └──────────┬────────────┘
                                                    │
                             ┌──────────────────────┼──────────────────────┐
                             ▼             ▼                     ▼          ▼
                          GitHub        Linear                 Jira      Bitbucket
```

The desktop app never talks to provider APIs directly. All OAuth is handled by the backend, tokens live only on the edge, and the app exchanges a device token for a short-lived session. This keeps credentials out of local storage on every laptop the app runs on.

## Tech stack

| Layer                | Choice                                   |
| -------------------- | ---------------------------------------- |
| Desktop runtime      | Tauri v2 (Rust)                          |
| Frontend             | React 19 · TypeScript · Vite             |
| Styling              | Tailwind CSS v4                          |
| Client state         | Zustand                                  |
| Local cache          | SQLite via `tauri-plugin-sql`            |
| Secure storage       | `tauri-plugin-store` (keyring-backed)    |
| Backend runtime      | Cloudflare Workers                       |
| Backend framework    | Hono                                     |
| Database             | Cloudflare D1 (SQLite at the edge)       |
| Package manager      | Bun                                      |
| Tests                | Vitest (app + backend)                   |
| CI                   | GitHub Actions                           |
| Releases             | Signed DMG + updater manifest via GH Actions |

## Getting started

### Install (end user)

Grab the latest signed DMG from [noti-peek-releases](https://github.com/Rohithgilla12/noti-peek-releases/releases/latest). The app auto-updates once installed.

### Run from source

**Prerequisites**

- [Bun](https://bun.sh) ≥ 1.1
- [Rust](https://rustup.rs) (stable toolchain)
- Xcode command-line tools (for Tauri on macOS)
- A local [wrangler](https://developers.cloudflare.com/workers/wrangler/) install if you want to run the backend

**1. Clone**

```bash
git clone https://github.com/Rohithgilla12/noti-peek.git
cd noti-peek
```

**2. Backend (Cloudflare Workers)**

```bash
cd backend
bun install
cp .dev.vars.example .dev.vars   # paste in your own OAuth client IDs/secrets
bun run db:migrate                # applies migrations to local D1
bun run dev                       # http://localhost:8787
```

You'll need OAuth apps created on each provider you want to test. See each provider's developer console:

- GitHub → Settings → Developer settings → OAuth Apps
- Linear → Settings → API → OAuth applications
- Atlassian (Jira) → Developer console → OAuth 2.0 (3LO)
- Bitbucket → Workspace settings → OAuth consumers

Callback URL for all of them during local dev: `http://localhost:8787/oauth/<provider>/callback`.

**3. Desktop app**

```bash
cd app
bun install
cp .env.example .env.local        # point VITE_API_URL at your local backend
bun run tauri dev
```

The first run registers a device token against the backend automatically; no sign-in step.

### Self-hosting the backend

The backend is a single Cloudflare Worker + D1 database. A production deploy is:

```bash
cd backend
wrangler d1 create noti-peek-db-production
# copy the returned database_id into wrangler.toml under [env.production]
bun run db:migrate:remote
wrangler secret put GITHUB_CLIENT_ID --env production
wrangler secret put GITHUB_CLIENT_SECRET --env production
# …repeat for each provider
bun run deploy
```

Then update `VITE_API_URL` in `app/.env.production` to point at your worker URL and rebuild the app.

## Project layout

```
noti-peek/
├── app/             Tauri v2 desktop app (Rust + React)
│   ├── src/         React frontend
│   └── src-tauri/   Rust backend (tray, menu, updater, notifications)
├── backend/         Cloudflare Workers API (Hono)
│   ├── src/         Routes, services, OAuth handlers
│   └── migrations/  D1 SQL migrations
├── landing/         Static marketing site (notipeek.dev)
└── .github/         CI workflows, issue templates, README assets
```

## Keyboard shortcuts

| Key       | Action                                  |
| --------- | --------------------------------------- |
| `↵`       | Open selected item in browser           |
| `c`       | Comment on selected item                |
| `m`       | Merge (if applicable)                   |
| `r`       | Refresh                                 |
| `1` / `2` | Switch Inbox / Pulse                    |
| `⌘ W`     | Hide window (stays in tray)             |
| `⌘ ,`     | Preferences                             |
| `esc`     | Dismiss detail / close settings         |

## Roadmap

- [ ] Windows + Linux builds
- [ ] Slack mentions
- [ ] Custom bundling rules (per-repo, per-project)
- [ ] Snooze and scheduled reminders
- [ ] Quick actions: close PR, transition Jira status, reassign issue
- [ ] Local LLM-based noise scoring

Track the full set in [Issues](https://github.com/Rohithgilla12/noti-peek/issues).

## Contributing

Pull requests are welcome. If you're planning anything non-trivial please open an issue first so we can align on direction. See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, test commands, and PR conventions.

## Security

Please do not file public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the disclosure process.

## License

[MIT](LICENSE) © Rohith Gilla
