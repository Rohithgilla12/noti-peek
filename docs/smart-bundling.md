# Smart Bundling — Design Doc

> The headline differentiator. Collapses multi-event streams into single actionable rows.
> Target: ships in Phase 1 as the feature the landing-page hero GIF demos.

---

## The problem, stated concretely

On a busy PR, five comments arrive in ~10 minutes. GitHub's native inbox shows them as five separate rows, each with nearly-identical text, all pointing to the same thread. The user scrolls past four of them to get to the last. This pattern repeats across Linear (issue comments), Jira (transitions + comments on the same ticket), and Bitbucket (PR approvals + comments).

Aggregation without bundling ≈ GitHub's inbox with extra steps. Bundling is what makes noti-peek feel meaningfully different in a 30-second demo.

---

## Scope — what's in, what's out

**In scope for Phase 1 (v0.2.0):**
- Bundle multiple events on the **same thread** by the **same or different actors** within a **time window**
- Single collapsed row with actor count + event count + latest activity summary
- Expand-to-see-all with keyboard (`Enter` on a bundled row expands; `Escape` collapses)
- "Latest N activity types" summary (e.g. "3 comments, 1 review, 1 status change")
- Bundle-aware mark-as-read: marking the bundle marks all children

**Out of scope for Phase 1:**
- Cross-thread bundling ("3 updates in repo X")
- ML / LLM classification
- User-configurable bundle rules
- Bundle-level quick actions ("approve all" etc.)

Keep it mechanical and explainable. The moment the heuristic surprises the user, the feature becomes anti-value.

---

## Heuristic — v1

A **bundle** is the set of notifications `N` such that:

1. **Same thread anchor** — same `(source, thread_key)` where `thread_key` is:
   - GitHub: `{repo}#{number}` for PRs/Issues; `{repo}/discussions/{id}` for Discussions; individual for Releases/Commits (never bundled with others).
   - Linear: `issue.id`
   - Jira: `issue.key`
   - Bitbucket: `{workspace}/{repo}/pull-requests/{id}`
2. **Time window** — most recent notification in the bundle is ≤ **4 hours** old AND the bundle spans ≤ **24 hours** from first to last event. (Two windows prevent a lurking old thread from capturing a fresh notification.)
3. **Unread anchor** — the bundle exists only if ≥ 1 child is unread. Once fully read, the bundle dissolves into its components in "all" view (or filters out entirely in "unread" view).

Notifications that fail #1 stay as singletons. Notifications that match #1 but fail #2 form a separate bundle (same thread, newer activity).

**Minimum bundle size:** 2. A singleton is always a singleton — no "bundle of 1" UI overhead.

---

## Why this heuristic and not a fancier one

I considered three alternatives and rejected each:

| Alternative | Why rejected |
|---|---|
| Bundle by repo ("3 updates in `noti-peek`") | Loses thread context; user still has to pick one. Pure volume reduction isn't value. |
| Bundle by actor ("@alice: 5 things") | Useful for @mentions but weird when one actor touches 5 unrelated threads. |
| LLM-scored "related activity" bundles | Non-deterministic = user can't trust. Fails badly in obvious-looking cases. Save for Phase 3 if ever. |

The thread+time heuristic is the one pattern where the user always agrees with the bundle — because two notifications on PR #423 in the same hour genuinely *are* the same topic, always.

---

## Data model changes

Bundling is a **derived view** over the existing notification stream — do **not** persist bundles as first-class rows in D1. That way:

- Bundle logic can change without migrations.
- Users can toggle bundling off without rewriting data.
- Cache invalidation stays simple (invalidate the user's raw notifications; bundles recompute on read).

Derivation happens in the backend `/notifications` response builder, after the per-provider fetches aggregate. Return shape changes:

```ts
type NotificationRow =
  | { kind: 'single'; notification: NotificationResponse }
  | { kind: 'bundle'; bundle: BundleResponse };

interface BundleResponse {
  id: string;                     // deterministic hash of source + thread_key + window
  source: Provider;
  thread_key: string;
  title: string;                  // the thread's title (PR/issue title)
  url: string;                    // canonical thread URL
  event_count: number;
  unread_count: number;
  actors: { name: string; avatar?: string }[];   // dedup'd, max 3 then "+N"
  type_summary: Record<string, number>;          // e.g. { comment: 3, review: 1 }
  latest_at: string;              // ISO8601
  earliest_at: string;
  children: NotificationResponse[];  // always the raw list — UI decides whether to render them
}
```

Clients that don't understand bundles (old app version) should treat `children[]` as the authoritative list. Include a `bundling_version` field in the response envelope (`1` for now); the app can pin to that version and fall back gracefully when we rev the heuristic.

---

## UI treatment

Based on your existing `NotificationItem` component and theme system, the minimal diff:

**Collapsed bundle row layout** (single row, same height as a normal notification):

```
┌──────────────────────────────────────────────────────────────────┐
│ ●  [GH] noti-peek#423 — Refactor auth middleware     2m ago      │
│        ↳ 5 updates: 3 comments, 1 review, 1 status               │
│        @alice · @bob · @carol                                    │
└──────────────────────────────────────────────────────────────────┘
```

- Source icon unchanged.
- Title = the thread's title, not per-event.
- Second line is the bundle summary in `var(--text-secondary)`.
- Third line is actor chips (truncate at 3 + "+N").
- Unread dot still present; color driven by `unread_count > 0`.
- `Enter` expands inline (children render as indented rows with slightly-smaller type); `Enter` again on any child opens the URL.
- `M` on a bundle marks all children read.

**Expanded state** — children render as indented rows beneath the header. Keep the bundle header visible so collapsing is one `Escape` away.

**Settings toggle**: "Smart bundling" on/off under a new `Appearance` section. Default on. Users who prefer one-row-per-event have an escape hatch.

---

## Rollout plan

**v0.1.x (current)** — raw aggregation, no bundling. Ship the updater first so the rollout lever works.

**v0.2.0-alpha (Phase 1 week 1)** — bundling behind `VITE_ENABLE_BUNDLING=true`. Local dogfood only.

**v0.2.0-beta (Phase 1 week 2)** — bundling on by default with the Settings toggle visible. Beta users get it. Instrument `bundle_expand` + `bundle_mark_read_all` + `bundle_collapse` in Sentry/Plausible (events only, no PII).

**v0.2.0 (Phase 1 week 3)** — bundling GA. Landing-page hero GIF uses the 5-comments-become-1-row demo.

Rollback plan: a single config flip in `tauri.conf.json` defaults disables the feature; users can also toggle in Settings. Because bundling is derived-not-persisted, there's no data to migrate.

---

## Success metrics

Instrument these from day one of beta. Each has a target and a kill-criterion.

| Metric | Target | Kill-criterion |
|---|---|---|
| % of users with bundling toggled on after 7 days | ≥ 85% | < 60% → the default is wrong |
| Median `expand-then-open` time | < 2s | > 5s → expand interaction is broken |
| Bundle-mark-read / per-event mark-read ratio | ≥ 2x | ≤ 1x → bundle action isn't surfacing |
| "Off" toggle usage after 7 days | ≤ 15% | > 30% → heuristic is miscategorizing |

If the kill-criterion hits, pull the feature to off-by-default in v0.3.0 and reconsider the heuristic. Do not leave a broken default in place because you built it.

---

## Open questions to resolve before coding

1. **Should `mark all read` on a bundle call the provider's per-item mark-read N times, or use the provider's bulk endpoint?** GitHub has a per-repo bulk endpoint that's cleaner but changes the semantic slightly. Pick per-provider.
2. **Do we render bundle children in their original order or collapsed by actor?** My vote: chronological, newest-first, matching the parent feed.
3. **If a bundle child is archived (Linear's "mark as read" behavior) while the bundle is open, does the UI animate it out or just let the next refresh reflow?** My vote: just reflow.
4. **Do we pre-compute bundles on the backend or in the Tauri app?** My vote: backend — keeps the UI thin, lets us change the heuristic without shipping a desktop release.

Answer these in a short follow-up before writing the first line of implementation code.

---

## What gets built, in order

1. `backend/src/services/bundling.ts` — pure function `bundleNotifications(notifications: NotificationResponse[]): NotificationRow[]`. Unit tests on edge cases: empty, all-singletons, two-bundle-same-thread-different-windows, all-read bundle dissolution.
2. Update `/notifications` route to call bundling, return the union type, bump `bundling_version: 1`.
3. App-side: extend the Zustand store's notification slice to handle `NotificationRow`. Rendering branches on `kind`.
4. New `BundleItem.tsx` component, sibling to `NotificationItem.tsx`. Shared styling via the existing CSS variables.
5. Keyboard handlers in `App.tsx` for expand/collapse.
6. Settings toggle + `bundlingEnabled` in store (default `true`, persisted via `plugin-store`).
7. Instrumentation events.
8. Demo GIF for the landing page.

Estimated scope: 3–5 focused days of work, not 3–5 weeks. The data model is small; most of the time is getting the UI right.
