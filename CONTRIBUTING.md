# Contributing

Thanks for your interest in noti-peek. This guide covers local dev setup, conventions, and what to expect from the review process.

## Ground rules

- **Open an issue first for anything non-trivial.** A quick alignment on direction saves everyone a rewrite. Small fixes (typos, obvious bugs) can go straight to a PR.
- **One logical change per PR.** Don't bundle refactors with feature work.
- **Add tests for behavioural changes.** The backend has `vitest`; the app has `vitest` + Testing Library. If a test framework feels wrong for your change, say so in the PR — don't skip silently.
- **Keep diffs small.** If it has to be big, add a note in the PR describing the sequence a reviewer should read the files in.

## Repository layout

```
app/        Tauri v2 desktop app (Rust + React + TypeScript)
backend/    Cloudflare Workers API (Hono)
landing/    Static marketing site
.github/    CI workflows, templates, README assets
```

The app and backend are independent projects with their own `package.json`. Install each separately.

## Prerequisites

| Tool                                                 | Version                 |
| ---------------------------------------------------- | ----------------------- |
| [Bun](https://bun.sh)                                | ≥ 1.1                   |
| [Rust](https://rustup.rs)                            | stable                  |
| Xcode command-line tools                             | for macOS Tauri builds  |
| [wrangler](https://developers.cloudflare.com/workers/wrangler/) | for the backend |

## Setting up the backend

```bash
cd backend
bun install
cp .dev.vars.example .dev.vars
# paste OAuth client IDs/secrets into .dev.vars
bun run db:migrate      # apply migrations to local D1
bun run dev             # http://localhost:8787
```

Tests:

```bash
bun run test            # one-shot
bun run test:watch      # watch mode
bun run build           # typecheck (tsc --noEmit)
```

## Setting up the app

```bash
cd app
bun install
cp .env.example .env.local
# point VITE_API_URL at your local backend
bun run tauri dev
```

Tests:

```bash
bun run test            # vitest (jsdom)
bun run test:watch
bun run build           # vite build + tsc
```

Rust-side check (runs in CI):

```bash
cd app/src-tauri
cargo check
```

## Provider OAuth apps for local dev

You'll need your own OAuth apps on each provider. Local callback URL is `http://localhost:8787/oauth/<provider>/callback`.

- **GitHub** — Settings → Developer settings → OAuth Apps
- **Linear** — Settings → API → OAuth applications
- **Atlassian (Jira)** — [developer.atlassian.com](https://developer.atlassian.com) → OAuth 2.0 (3LO)
- **Bitbucket** — Workspace settings → OAuth consumers

You only need the providers you're actually touching in your PR.

## Commit style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(app):    add pulse view empty state
fix(backend): handle Jira 401 during reconnect
test(backend): cover actions route envelope
chore(release): v0.4.1
```

Common scopes: `app`, `backend`, `tauri`, `pulse`, `detail`, `landing`, `ci`, `release`.

## Before opening a PR

- `bun run build` passes in both `app/` and `backend/`
- `bun run test` passes in both `app/` and `backend/`
- `cargo check` passes in `app/src-tauri/`
- New behaviour is covered by tests
- No secrets, API keys, or personal identifiers in the diff

CI will run the same three commands (`ci.yml`) on every PR, so it's faster to catch things locally.

## PR review

I try to review within a few days. If I push back on something, it's about the approach, not you — feel free to push back on my push-back. If we can't agree, the original maintainer call wins, but that almost never actually happens.

## Reporting bugs / asking for features

- **Bug:** open an issue with steps to reproduce, what you expected, and what actually happened. Screenshots or screen recordings help.
- **Feature:** open an issue describing the problem first, then the proposed solution. "This would be a cool feature" without a problem statement usually gets closed.
- **Security vulnerability:** see [SECURITY.md](SECURITY.md). Don't use public issues.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
