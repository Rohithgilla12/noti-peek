# Phase 0 Reliability — What Actually Still Needs Work

> The PRD's V1 checkbox list is partially stale. Pagination, token refresh, and rate-limit parsing already exist for all four providers.
> This doc lists the *actual* reliability gaps that'll bite the first ~10 beta users, ordered by blast radius.

---

## What's already solid (don't rewrite)

- **GitHub**: `Link` header pagination, `X-RateLimit-*` parsing, 403 → `RateLimitError`, 401 → clear error. `per_page=50 × maxPages=5 = 250` ceiling.
- **Linear**: cursor pagination, 5-minute expiry buffer, automatic refresh on expiry, GraphQL error classification (auth vs other).
- **Jira + Bitbucket**: same expiry-buffer + refresh flow as Linear, with `refresh_token` rotation persisted back to D1.
- **Routes**: each provider fetch is individually `.catch()`ed so one failing provider doesn't tank the aggregate response.

---

## The real gaps, ordered by blast radius

### 1. `RateLimitError` is thrown but never surfaces to the user

`backend/src/routes/notifications.ts:49` catches `RateLimitError` on GitHub and stores the rate-limit info, but the desktop app doesn't tell the user "GitHub rate-limited you, next refresh at 14:32." Without that, users see "no new notifications" and assume the app is broken.

**Fix.** Plumb `rateLimitInfo` through the response envelope (it's already in the service return), then render a subtle status-bar line when `remaining < 100` or when `RateLimitError` fires. The `StatusBar.tsx` component is the natural home — keep it unobtrusive.

**Exit:** paste an expired token to test; confirm status bar flips to "GitHub rate limit hit — next refresh 14:32" instead of empty list.

---

### 2. No backend-side rate limiting per device token

PRD flagged this explicitly as unchecked. Without it, a buggy desktop build can hammer `/notifications`, burn the user's GitHub rate limit, and possibly burn your Worker subrequest quota. Also: a malicious actor with a stolen device token could DoS your backend until Cloudflare throttles at the edge.

**Fix.** Cheapest: a middleware that increments a counter in D1 keyed by `(user_id, minute_bucket)`. Reject if > ~30 requests/minute/device. For Phase 0 this is fine — swap to a Durable Object if it ever becomes a real bottleneck.

Alternative: Cloudflare's own [Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) at the zone level. Zero backend code but less granular.

**Exit:** `hey -n 200 -c 20 https://api.notipeek.dev/notifications -H "Authorization: Bearer $TOKEN"` — expect 429s after 30 or so.

---

### 3. Aggregate-level response caching

If the user has the app open on two Macs (office + laptop), each auto-refresh triggers 2× upstream calls to GitHub/Linear/etc. Nobody needs two refreshes within 30 seconds. Cache the aggregated `/notifications` response in D1 or KV for ~30–60s per user, bypassable via an explicit `?fresh=1` query param on manual refresh.

**Fix.** Before fetching, check `notifications_cache` row for this user where `fetched_at > NOW() - 30s` — if hit, return cached `data` blob. On miss, fetch upstream and write back.

Side benefit: during brief upstream outages, stale cache is better than nothing. Flag staleness in the response so the UI can show "last refreshed 2min ago."

**Exit:** two curl calls within 5s — second one < 50ms and returns cached payload.

---

### 4. Linear "mark as read" actually archives

`linear.ts:252` uses the `notificationArchive` mutation. Linear's model is "read = archived" but users may not expect "mark all read" to remove them from their Linear UI entirely.

**Fix.** Confirm this is intentional. If not, switch to `notificationMarkRead` (if it exists in the current Linear schema; check at https://studio.apollographql.com/public/Linear-API/variant/current/schema). Document the trade-off in `integrations-setup.md` either way — this is the kind of surprise that'll generate GitHub issues.

**Exit:** a note in `docs/integrations-setup.md` explicitly stating current behavior.

---

### 5. GitHub `maxPages=5 × per_page=50 = 250` silent ceiling

For most devs, 250 unread is plenty. For an engineer returning from a 2-week vacation on a busy repo, it's not. They'll see only the newest 250 and silently miss older items.

**Fix options, cheapest first:**
- Raise `per_page` to 100 (GitHub's max). 100 × 5 = 500 — handles the vast majority of cases.
- Make `maxPages` per-user settable via a Settings slider, default 5, max 20. Heavy users opt in.
- Add a `since` parameter to the GitHub API call and only fetch since the last sync — requires tracking `last_sync_at` in `connections`, which you already do roughly via `cached_at`.

My suggestion: raise to `per_page=100`, ship option 3 in Phase 1 once you have a real user with >500 unread and can confirm it's needed.

**Exit:** unit test that confirms `per_page=100` is hitting the URL.

---

### 6. Errored providers show as generic message in the aggregate response

Each provider's `.catch()` at the route level produces `{ provider, error: err.message }`. The message might be `"Jira token expired or revoked"` which is actionable — or `"fetch failed"` which is not. The desktop UI probably shows none of this today.

**Fix.** Two UI treatments:
- If one provider fails but others succeed: subtle banner "Jira connection needs re-auth" with a link to Settings.
- If `TokenExpiredError` fires and refresh fails: clear the `access_token` in D1, surface "Reconnect Jira" as the required user action.

**Exit:** revoke a Linear token manually in Linear Settings, refresh in-app, confirm the UI tells you to reconnect rather than silently showing an empty list.

---

### 7. No structured observability — you won't know what broke in prod

Currently if something fails in production, you find out because a user DMs you. No error tracking, no latency histogram, no error-rate alerting.

**Fix (Phase 0 minimum):**
- Backend: log errors as JSON (`console.error(JSON.stringify({ level, provider, error, user_id }))`) — tail with `wrangler tail --env production` during incidents. Phase 1 can push to Axiom/Logflare.
- Desktop app: Sentry (opt-in, default-on in beta, Settings toggle). Initialize with `sendDefaultPii: false`.
- Landing page: Plausible — cookie-less, GDPR-safe.

Don't build a dashboard yet. Just capture the data.

**Exit:** throw a deliberate error in a test endpoint, see it in Cloudflare Tail; throw in the app, see it in Sentry.

---

### 8. Notification URL construction is fragile for Discussions + Releases

`github.ts:45` `getHtmlUrl` does a string-replace to convert API URLs to HTML URLs. Works for PRs and Issues. For Discussions and Releases the API URL format is different and the replace rules won't match — users will click and land on a 404.

**Fix.** Special-case per subject type:

```ts
switch (notification.subject.type) {
  case 'PullRequest':
  case 'Issue':
    return apiUrl.replace('api.github.com/repos', 'github.com').replace('/pulls/', '/pull/');
  case 'Discussion':
    // fetch the thread, extract the HTML URL from the payload
    // or construct from repo + discussion number if available
  case 'Release':
    return `https://github.com/${notification.repository.full_name}/releases`;
  case 'Commit':
    return apiUrl.replace('api.github.com/repos', 'github.com').replace('/commits/', '/commit/');
  default:
    return `https://github.com/${notification.repository.full_name}`;
}
```

Cover it with a unit test per type so regressions are obvious.

**Exit:** 5 click-throughs, one per type, all land on the correct page.

---

### 9. First-launch OAuth state errors aren't user-friendly

If the one-time OAuth state record expires between click-out and callback (slow network, user went to make coffee), the error surfaces as a 400 in the backend and an unlabeled failure in the app. Users will assume your app is broken.

**Fix.** On the OAuth callback, if state lookup fails, render a tiny inline HTML page from the Worker: "This OAuth link expired. Open noti-peek and click 'Connect GitHub' again." Stops the user from staring at `{"error":"invalid_state"}`.

**Exit:** manually invalidate a state row in D1, complete the OAuth flow, see the friendly HTML page.

---

### 10. No release sanity test

Nothing runs against production after a backend deploy to confirm the basic flows still work. If a migration forgot a column, you find out from a user.

**Fix.** A GitHub Actions job that runs after backend deploy: register a throwaway device, verify the token, start a GitHub OAuth, parse the URL response. Tear down the device at the end. Runs in < 30s, catches schema/env drift.

**Exit:** a new `.github/workflows/backend-smoke.yml` that runs on push to `main` against production (or a dedicated staging env if you set one up later).

---

## Priority order for this Thursday (from the Monday-to-Sunday plan)

If you have one day: **#1 (rate-limit surfacing) + #2 (backend rate limiting) + #7 (Sentry + Tail)**. Those three together mean (a) users see why things are slow, (b) you can't be DoS'd into bankruptcy, and (c) you actually find out when things break.

Everything else can slip to Phase 1 without blocking beta users.

---

## Explicit non-goals for Phase 0

- **No queueing / Durable Objects / worker-side polling.** Polling stays in the desktop app. This is a complexity magnet; don't bite.
- **No webhooks.** Providers that support them (GitHub, Linear) mean public endpoints, signature validation, replay handling. Wait until polling-at-30s-intervals is obviously the bottleneck, which it won't be at 10 users.
- **No shared-tenant features.** No `teams` table. Keep the data model flat and user-scoped — makes Phase 2 migration cheap if it happens, and keeps data-export for GDPR simple.
- **No custom notification rules DSL.** Users will ask. Say no until Phase 3. The wrong time to build config-language features is before you know what matters.
