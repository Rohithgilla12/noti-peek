# noti-peek — Next Level Plan

> From "MVP working for me" to indie product.
> Drafted 2026-04-20. Opinionated. Sequenced so a solo dev can actually ship it.

## Referenced artifacts (live in this repo)

Companion docs and code produced alongside this plan. Update them as you execute.

### Ship & release

- `.github/workflows/release.yml` — signed + notarized macOS release pipeline (arm64 + x64), publishes to GitHub Releases with updater manifest.
- `docs/release-setup.md` — one-time setup for Apple signing, notarization, and the Tauri updater. GitHub Secrets checklist lives here.
- `docs/backend-deploy.md` — deploy the Hono Worker + D1 to `api.notipeek.dev`, including OAuth callback URLs and smoke tests.
- `app/src/hooks/useUpdater.ts` — React hook for the "Check for updates" Settings flow.
- `app/src-tauri/tauri.conf.json` — updater plugin block added (pubkey placeholder still to fill in).
- `app/src-tauri/Cargo.toml` — `tauri-plugin-updater` and `tauri-plugin-process` added.
- `app/src-tauri/src/lib.rs` — both plugins registered in the builder.
- `app/src-tauri/capabilities/default.json` — `updater:default` and `process:default` permissions granted.

### Product: bundling (headline differentiator)

- `docs/smart-bundling.md` — design doc for the heuristic, data model, UI, success metrics, kill criteria.
- `backend/src/services/bundling.ts` — pure implementation (`bundleNotifications`, `extractThreadKey`, windowed splitting). Bundle IDs are deterministic and include a version.
- `backend/src/services/bundling.test.ts` — 21 passing tests covering recency/span windows, never-bundle types, cross-source isolation, actor dedup + cap, type summary, and stable ordering.
- `backend/src/routes/notifications.ts` — GET `/notifications` now returns `rows: NotificationRow[]` + `bundling_version: 1` in the envelope. Flat `notifications` retained for back-compat. Clients can opt out with `?bundle=false`.

### Launch surfaces

- `landing/index.html` — single-file static landing page (Catppuccin Mocha to match the app). Cloudflare Pages–ready, no build step.
- `landing/privacy.html` — plain-English privacy statement covering OAuth tokens in D1, device token semantics, optional telemetry, deletion flow.

### Foundations

- `docs/phase-0-reliability.md` — the *actual* remaining reliability gaps (PRD checklist was stale). Ordered by blast radius.
- `app/src/lib/telemetry.ts` — opt-in Sentry wrapper with PII scrubber. Default-off in stable, default-on in beta. Dynamic import so the SDK isn't in the bundle when disabled.
- `docs/telemetry-setup.md` — install deps, build-time env, wire into app boot, Settings UI snippet, what's captured vs scrubbed, rollback procedure.

---

## The two strategic calls that decide everything else

Before any of the tactical work below matters, you have to pick sides on two questions. Both answers change the roadmap.

### 1. What is the sharp differentiator?

"One place for all your dev notifications" is a category, not a product. GitHub has a notifications page. Linear has one. Raycast has extensions for both. Slack aggregates. Arc does Little Arc. If someone asks "why noti-peek and not just a tab group?", aggregation alone is not an answer.

The three credible differentiators for a dev-notification tool in 2026:

- **Smart bundling** — 5 comment notifications on PR #423 become one row. Instant, visible value. Provable in a 30-second demo.
- **Actionable** — approve the PR, transition the ticket, acknowledge the alert without switching apps. Requires per-provider quick-action work but turns the app from a viewer into a tool.
- **Focus + prioritization** — "during deep work, only show blocker-grade notifications." Either rules-based (cheap, explainable) or LLM-scored (expensive, feels like magic when it works, annoying when it hallucinates priority).

Pick **one** as the headline and build it to obviously-better-than-the-native-experience quality. The other two can be "coming soon." Without a headline, the app reads as a nicer UI on top of GitHub's `/notifications` page — and that's not a sale.

My bet, if you want a straight answer: **smart bundling as the hero, actionable as the ongoing moat.** Bundling is demonstrable in the screenshot on the landing page; actionable is the reason people stay.

### 2. Backend forever, or local-only?

Right now you have a Cloudflare Workers backend holding OAuth tokens in D1. That has costs:

- Ongoing infra cost (tiny, but non-zero, and you're the only one accountable).
- Security liability: a vault of developer OAuth tokens is a juicy target. If you get popped, you send a disclosure email to every user.
- Compliance/legal surface grows with paying customers (DPA, privacy policy, SOC-flavored questions).

The local-only alternative: OAuth happens in the app via Tauri's deep-link plugin, tokens live only in Tauri's Keychain integration, polling happens from the client. You lose server-side push/webhooks and any shared state, but an indie solo app rarely needs those in year one. Raycast does this. Many menubar apps do this.

There's also a hybrid: keep the backend as a thin OAuth proxy (needed because Linear/Jira's client secrets can't ship in a desktop app), but don't store user tokens server-side — hand them back to the app after the exchange and forget them.

My recommendation: **hybrid (OAuth proxy only, no token storage)** if you're reasonably confident you can refactor in 1–2 weekends. Otherwise keep what you have and lock it down. But make the call now; the longer you wait, the harder the migration.

---

## Current state (from reading the repo)

What's solid: Tauri v2 menubar app with tray badge, React 19 + Tailwind 4 + Zustand, 13 IDE themes via CSS variables, Hono backend on Workers + D1, server-issued one-time OAuth state (CSRF-safe), device-token auth, GitHub OAuth + PAT fallback, Linear OAuth, Jira + Bitbucket behind `ENABLE_EXPERIMENTAL_PROVIDERS`, mark-as-read single and bulk, tests on routes and Jira/Bitbucket services.

What's missing for "indie product" (not "feature"):

| Gap | Blocker level |
|---|---|
| Code signing (Apple Developer cert) + notarization | Ships → blocks distribution |
| Tauri updater plugin + signed update endpoint | Ships → v0.1.0 users are stranded on v0.1.0 |
| Release workflow in CI (current `ci.yml` is 48 lines, no release step) | Ships → manual cuts don't scale past 2 releases |
| Landing page + `notipeek.dev` pointed at it | Marketing → no URL to share |
| Backend deployed to `api.notipeek.dev` | CSP already references it; app won't work for external users until it exists |
| Rate limiting, pagination, token refresh (from PRD V1 gaps) | Reliability → works for you, breaks under real notification volume |
| Telemetry (Plausible + Sentry, privacy-respecting) | Learning → you have no idea what's happening in production |
| Windows/Linux builds — or the explicit call not to ship them | Scope → one decision either way |

What I'd explicitly not touch yet: V3 integrations (Slack, Notion, Figma, Vercel, Sentry, PagerDuty). Each integration is ongoing maintenance cost. Add them after V1 is rock-solid for 50 users.

---

## Phase 0 — Ship-ready (2 weeks)

Goal: someone other than you can download a signed, auto-updating build, connect their GitHub, and use it without manual intervention.

**Distribution basics.** This is the work that doesn't feel like progress but blocks everything. Apple Developer Program is already enrolled — skip that step.
- Export the Developer ID Application cert as `.p12` from Keychain; grab your Team ID; create an app-specific password at appleid.apple.com. See `docs/release-setup.md`.
- Generate Tauri updater signing keys (`bun x @tauri-apps/cli signer generate`); put pubkey in `tauri.conf.json`, private key in GitHub Secrets.
- Add `tauri-plugin-updater` dependency + register in `src-tauri/src/lib.rs`; expose a "Check for updates" action in Settings.
- Cut a release tag; the workflow at `.github/workflows/release.yml` builds arm64 + x64, signs, notarizes, publishes to GitHub Releases, and emits `latest.json` for the updater.
- Cloudflare: deploy Worker to `api.notipeek.dev`, run the two migrations against production D1, set all six OAuth secrets. See `docs/backend-deploy.md`.

**V1 reliability gaps.** Close the checkboxes that matter under real load.
- Pagination for GitHub (`Link` header) and Linear (cursor-based). Currently you fetch the first page and stop — fine for you, wrong for anyone with >30 unread.
- Rate limiting: respect GitHub's `X-RateLimit-*` headers; back off with jitter.
- Token refresh for Linear (rotates) and the Atlassian pair (expires). Currently you handle creation but not renewal — users will silently disconnect in ~a month.
- Per-device rate limit on the backend (Cloudflare's D1 counter or Durable Objects, whichever you prefer).

**Telemetry that won't get you flamed on HN.**
- Plausible or Umami on the landing page (no cookies, GDPR-fine).
- Sentry in the Tauri app with `sendDefaultPii: false` and an explicit opt-in toggle in Settings (default on for beta, with a visible banner).
- Backend: minimal structured logs to Cloudflare Logpush or Logflare; count requests per provider, error rates, p95 latency.

**Exit criteria for Phase 0:** you can DM a `.dmg` link to a friend, they install it, connect GitHub, see real notifications, and you get a Sentry event if something breaks.

---

## Phase 1 — Beta-ready (3 weeks)

Goal: a URL you can post in a small dev Slack and not be embarrassed.

**Landing page** at `notipeek.dev`. One page, one screenshot-hero, three feature blocks (your picked differentiator + the other two teased as coming soon), a download button, a changelog/roadmap link, a privacy statement. Tauri lets you ship this as a separate Astro or Next static site; keep it out of the Tauri repo or put it in a `landing/` directory.

**Onboarding pass.** First launch right now probably works but isn't delightful. Script the flow: welcome → connect GitHub (explain PAT vs OAuth trade-off in-app, since you've already hit this problem) → "here's what you'll see" empty state → auto-refresh starts. Measure time-to-first-notification; target is <30s from install, which matches your PRD.

**The headline differentiator, first pass.** If you picked smart bundling: detect "same thread, same actor sequence, <N minutes apart" and collapse. Show collapsed view by default, let users expand. This should be demo-able as a GIF on the landing page.

**Keyboard polish.** You already have R/M/Enter and `⌘,`. Add a command palette (`⌘K`) with a `cmdk`-style library. For dev tool menubar apps this is table stakes now.

**Demo video.** 45 seconds, no voiceover, captioned. Install → connect → bundled notifications collapse → quick-action → done. This is the single highest-leverage marketing artifact you'll make all year.

**Exit criteria for Phase 1:** 10 beta users not related to you, installing from the landing page, staying installed after 1 week. Watch crash reports and product analytics; fix the top 3 issues.

---

## Phase 2 — Monetization + launch (4 weeks)

Goal: first paying customer.

**Pricing.** The honest indie default for a menubar app: free for 2 sources, paid (≈$6/mo or $60/yr) for unlimited sources + the headline differentiator + focus mode. Don't gate core usability behind a paywall — gate leverage. "Free with GitHub + Linear, paid with more + smart bundling + focus" is a legible story.

**Billing.** Stripe if you want the safest default. Polar.sh or Lemon Squeezy if you want merchant-of-record so they eat VAT/tax compliance. For a solo founder selling globally, **merchant-of-record wins by a lot** — pick Polar or Lemon. Ship a license-key flow the Tauri app validates; don't build account sessions yet unless you need them.

**Entitlements in the app.** Simplest: license key → backend validates → sets a `tier` on the user → app hides/disables paid features. Keep it optimistic (cache tier locally, revalidate weekly).

**Launch surfaces, in order of fit:**
1. Hacker News (Show HN). Post Tuesday 8–10am PT. Title: "Show HN: noti-peek – [headline differentiator] for your dev notifications."
2. `/r/macapps` and `/r/webdev`. Same week.
3. Indie Hackers product page. Same week.
4. Product Hunt. Plan a Thursday. Have a hunter lined up (optional but helps).
5. Twitter/X: short thread, demo video, pinned. Ask specific accounts in the dev-tools space to RT.

**Don't** launch all of these on the same day. Space them over 2–3 weeks so you can respond to feedback and fix bugs between waves.

**Exit criteria for Phase 2:** $100 MRR or 20 paying users, whichever comes first. If neither happens in 6 weeks post-launch, the issue is the differentiator, not the marketing — go back to Phase 1's headline.

---

## Phase 3 — Sustain (ongoing)

This is where most indie apps die from "feature request" churn. Two rules.

**Rule 1: integrations are a treadmill.** Adding Slack gets you a bigger TAM and 2–4 hours of bug maintenance per month, forever. Evaluate each new integration as "does it pull 10+ paying users?" — if unclear, don't add it. Your PRD V3 list is a wishlist, not a roadmap.

**Rule 2: the headline differentiator needs compounding.** Whatever you picked (bundling, actionable, focus), invest in it every quarter. If you picked bundling: smarter heuristics, ML-assisted grouping, per-provider tuning. If actionable: more quick actions, reply-from-app for comments, PR review from keyboard. If focus: a real work-session model, calendar integration, team-wide "I'm heads-down" signals.

Other things to do in this phase, ordered by leverage:

- Windows + Linux builds. Tauri makes this relatively cheap. Do it when a non-trivial fraction of waitlist signups ask.
- A second headline differentiator — not before Phase 3.
- AI features, *if* they ship an obviously-better experience. "LLM priority scoring that's vaguely right 70% of the time" will churn users faster than it acquires them. Only ship when the quality bar is met.
- An open-core play: MIT-license the core Tauri app, keep the backend + paid features closed. Gets you OSS goodwill and potential contributors. Be careful — open-sourcing an indie product is a one-way door.

---

## The next 7 days

If you want a Monday-to-Sunday plan, start here. This is all Phase 0.

**Mon.** Follow `docs/release-setup.md`: export Developer ID cert → `.p12` → base64, grab Team ID, create app-specific password, generate Tauri updater keys. Populate all the GitHub Secrets listed in that doc.

**Tue.** Deploy backend to `api.notipeek.dev` following `docs/backend-deploy.md`. Run both migrations against production D1, set the six OAuth secrets, confirm `GET /health` returns 200, smoke-test device registration + GitHub OAuth start.

**Wed.** Apply the `tauri.conf.json` updater patch (pubkey + endpoint), add `tauri-plugin-updater` to `Cargo.toml`, register it in `lib.rs`, and add a "Check for updates" button in `Settings.tsx`. Push a commit to `main`, watch CI still pass.

**Thu.** Work through `docs/phase-0-reliability.md` — pagination for GitHub + Linear, rate-limit-respect for GitHub, token refresh for Linear. These are the three bugs that will bite your first 10 beta users hardest.

**Fri.** Add Sentry in the Tauri app (opt-in with default-on during beta, visible Settings toggle) + Plausible on the landing page once it exists. Draft a one-page privacy statement in plain English.

**Sat.** Tag `v0.1.1`, watch `.github/workflows/release.yml` run — signed + notarized build should land on GitHub Releases with a `latest.json` beside it.

**Sun.** Install v0.1.0 on a second Mac (or a fresh VM). Confirm auto-update fires and installs v0.1.1 cleanly. If it works, you're ready for Phase 1 and you can start the landing page.

---

## Things I'd cut, defer, or say no to

- **Mobile app.** Your PRD lists this under V4. Keep it there forever unless paying customers ask in numbers.
- **Team/collaboration features.** Same as above. "Shared filters/rules" in the PRD V3 list is a whole separate product; do not accidentally build it.
- **Real-time push via webhooks.** Polling is fine. Webhooks mean public endpoints, signature verification, replay handling, and a new class of bugs. Add it only when polling hits a clear wall.
- **More than 2 integrations in Phase 0.** Jira + Bitbucket are already feature-flagged off — keep them off until GitHub + Linear are rock-solid for external users.
- **Any custom auth UI in the app.** Device token + OAuth is enough. Do not add email/password.

---

## Open questions to resolve with yourself

1. Which differentiator are you picking as the headline? (See top of doc.)
2. Local-only, backend-forever, or hybrid OAuth proxy?
3. macOS-only v1, or cross-platform from launch?
4. Pricing: freemium-by-sources, time-limited trial, or free-forever OSS with paid cloud?
5. Open source the app, or keep closed? (Affects community + contributions + copycats.)

Answering these before Phase 1 will save a week of rework in Phase 2.
