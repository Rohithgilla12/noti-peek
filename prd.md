# noti-peek

> A unified notification hub for developers. One place. All your notifications.

---

## Product Vision

Developers are drowning in notifications scattered across GitHub, Linear, Jira, Slack, and more. Context switching between apps kills productivity. **noti-peek** brings all notifications into a single, beautiful desktop app — letting developers stay focused while staying informed.

---

## Architecture

```
┌─────────────────┐              ┌─────────────────────────┐
│                 │              │   Cloudflare Workers    │
│   Tauri App     │◄────────────►│   (Hono backend)        │
│   (Desktop)     │    REST      │                         │
│                 │              └───────────┬─────────────┘
└─────────────────┘                          │
                                             │
                                  ┌──────────┴──────────┐
                                  │   Cloudflare D1     │
                                  │   (SQLite edge)     │
                                  └──────────┬──────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                       GitHub             Linear              Jira
```

---

## Tech Stack

### Desktop App (Tauri)

| Layer          | Technology         |
| -------------- | ------------------ |
| Framework      | Tauri v2           |
| Frontend       | React + TypeScript |
| Styling        | Tailwind CSS       |
| State          | Zustand            |
| Local Storage  | SQLite (cache)     |
| Secure Storage | Tauri Keyring      |

### Backend (Cloudflare)

| Layer     | Technology                |
| --------- | ------------------------- |
| Runtime   | Cloudflare Workers        |
| Framework | Hono                      |
| Database  | Cloudflare D1 (SQLite)    |
| Auth      | Device tokens + OAuth 2.0 |
| Secrets   | Cloudflare Secrets        |

---

## V1 — Core MVP (Travel Sprint)

**Goal:** GitHub + Linear notifications in a usable desktop app with backend

### Features

- [ ] Desktop app with system tray
- [ ] Backend API on Cloudflare Workers
- [ ] GitHub notifications (all types)
- [ ] Linear notifications (assigned, mentioned, comments)
- [ ] Unified notification list
- [ ] Mark as read (single & bulk)
- [ ] Click to open in browser
- [ ] Filter by source (GitHub / Linear)
- [ ] Filter by type (PR, Issue, Comment, etc.)
- [ ] Unread count badge
- [ ] Auto-refresh (configurable interval)
- [ ] Manual refresh

---

### V1 Tasks

#### Backend — Project Setup

- [x] Initialize Hono project with Cloudflare Workers
- [x] Set up Wrangler config
- [ ] Set up D1 database
- [x] Create database schema (see below)
- [ ] Set up environment variables / secrets
- [ ] Deploy to Cloudflare (dev environment)
- [ ] Set up custom domain (api.notipeek.dev or similar)

#### Backend — Database Schema

- [x] Design and create tables:

  ```sql
  -- Users (device-based auth)
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    device_token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Connected accounts (OAuth tokens)
  CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,  -- 'github' | 'linear' | 'jira' | 'bitbucket'
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at DATETIME,
    account_id TEXT,         -- external user ID
    account_name TEXT,       -- display name
    account_avatar TEXT,     -- avatar URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, provider)
  );

  -- Notification cache (optional, for faster loads)
  CREATE TABLE notifications_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    data TEXT NOT NULL,      -- JSON blob
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  ```

#### Backend — Auth & Device Registration

- [x] `POST /auth/register` — Generate device token, create user
- [x] `POST /auth/verify` — Verify device token (middleware)
- [x] Auth middleware for protected routes
- [ ] Rate limiting per device token

#### Backend — GitHub OAuth

- [ ] Register GitHub OAuth App (get client ID & secret)
- [x] `GET /auth/github` — Redirect to GitHub OAuth
- [x] `GET /auth/github/callback` — Handle callback, exchange code for token
- [x] Store tokens in D1 (encrypted or via secrets pattern)
- [x] `DELETE /auth/github` — Disconnect GitHub account
- [ ] Token refresh handling (GitHub tokens don't expire, but handle revocation)

#### Backend — Linear OAuth

- [ ] Register Linear OAuth App
- [x] `GET /auth/linear` — Redirect to Linear OAuth
- [x] `GET /auth/linear/callback` — Handle callback, exchange code for token
- [x] Store tokens in D1
- [x] `DELETE /auth/linear` — Disconnect Linear account
- [ ] Token refresh handling

#### Backend — Notifications API

- [x] `GET /connections` — List connected accounts for user
- [x] `GET /notifications` — Fetch all notifications (aggregated)
- [x] `GET /notifications/github` — Fetch GitHub notifications only
- [x] `GET /notifications/linear` — Fetch Linear notifications only
- [x] `POST /notifications/:id/read` — Mark single notification as read
- [x] `POST /notifications/read-all` — Mark all as read (optionally filter by source)
- [x] Unified notification response schema:

  ```typescript
  interface NotificationResponse {
    id: string;
    source: "github" | "linear" | "jira" | "bitbucket";
    type: string;
    title: string;
    body?: string;
    url: string;
    repo?: string;
    project?: string;
    author: {
      name: string;
      avatar?: string;
    };
    unread: boolean;
    createdAt: string;
    updatedAt: string;
  }
  ```

#### Backend — GitHub Integration Logic

- [x] Fetch notifications from GitHub API (`/notifications`)
- [x] Parse notification types (PullRequest, Issue, Release, Discussion, etc.)
- [x] Map to unified notification schema
- [ ] Handle pagination
- [ ] Handle rate limiting (respect `X-RateLimit-*` headers)
- [x] Mark as read via GitHub API

#### Backend — Linear Integration Logic

- [x] Fetch notifications via Linear GraphQL API
- [x] GraphQL query for notifications
- [x] Parse notification types (IssueAssigned, IssueMentioned, Comment, etc.)
- [x] Map to unified notification schema
- [ ] Handle pagination (cursor-based)
- [x] Mark as read via Linear API

---

#### Desktop App — Project Setup

- [x] Initialize Tauri v2 project with React + TypeScript
- [x] Set up Tailwind CSS
- [x] Set up Zustand store
- [x] Create basic app shell with sidebar navigation
- [x] Implement system tray with unread badge
- [ ] Set up SQLite for local cache (optional)
- [x] Configure Tauri secure storage for device token

#### Desktop App — Auth Flow

- [x] On first launch: call `POST /auth/register`, store device token
- [x] On subsequent launches: verify device token
- [x] Handle token invalidation (re-register if needed)

#### Desktop App — OAuth Flows

- [x] "Connect GitHub" button → open system browser to `/auth/github`
- [ ] Handle OAuth callback (deep link or poll for completion)
- [x] "Connect Linear" button → open system browser to `/auth/linear`
- [ ] Handle OAuth callback
- [x] Show connected accounts in settings
- [x] "Disconnect" functionality

#### Desktop App — Notifications UI

- [x] Create NotificationList component
- [x] Create NotificationItem component
- [ ] Create NotificationDetail panel (optional for V1)
- [x] Implement source filter tabs (All / GitHub / Linear)
- [ ] Implement type filter dropdown
- [x] Implement unread/all toggle
- [x] Add empty state UI
- [x] Add loading state UI
- [x] Add error state UI

#### Desktop App — Core Functionality

- [x] Fetch notifications from backend on launch
- [x] Auto-refresh on interval (configurable)
- [x] Manual refresh (pull or button)
- [x] Mark as read (single) → call backend → update UI
- [x] Mark all as read → call backend → update UI
- [x] Click notification → open URL in browser
- [ ] Update system tray badge with unread count

#### Desktop App — Settings & Preferences

- [x] Settings page UI
- [x] Manage connected accounts (connect/disconnect)
- [x] Configure refresh interval (1min, 5min, 15min, 30min)
- [ ] Configure notification types to show/hide per source
- [ ] Launch at startup toggle
- [ ] Show in menubar toggle

#### Desktop App — Polish

- [x] Keyboard shortcuts (R = refresh, M = mark read, Enter = open)
- [x] Relative timestamps ("2 min ago")
- [x] Source icons (GitHub octocat, Linear icon)
- [x] Type-specific icons (PR, Issue, Comment)
- [ ] Smooth animations (list updates)
- [x] Dark mode (match system)

---

## V2 — Enterprise Expansion

**Goal:** Add Jira and Bitbucket for enterprise teams

### Features

- [ ] Jira notifications
- [ ] Bitbucket notifications
- [ ] Notification grouping by project/repo
- [ ] Quick actions (approve PR, close issue) — if API allows
- [ ] Search/filter by text
- [ ] Notification snooze

---

### V2 Tasks

#### Backend — Jira Integration

- [ ] Register Jira OAuth App (Atlassian Developer Console)
- [ ] `GET /auth/jira` — Redirect to Atlassian OAuth
- [ ] `GET /auth/jira/callback` — Handle callback
- [ ] Store tokens (handle refresh tokens — Atlassian tokens expire)
- [ ] `DELETE /auth/jira` — Disconnect
- [ ] `GET /notifications/jira` — Fetch Jira notifications
- [ ] Fetch via Jira REST API (`/rest/api/3/myself` + notifications)
- [ ] Parse notification types (Assigned, Mentioned, Commented, StatusChanged)
- [ ] Map to unified schema
- [ ] Mark as read via Jira API
- [ ] Handle Jira Cloud vs Server differences (if needed)

#### Backend — Bitbucket Integration

- [ ] Register Bitbucket OAuth App (Atlassian)
- [ ] `GET /auth/bitbucket` — Redirect to Bitbucket OAuth
- [ ] `GET /auth/bitbucket/callback` — Handle callback
- [ ] Store tokens
- [ ] `DELETE /auth/bitbucket` — Disconnect
- [ ] `GET /notifications/bitbucket` — Fetch Bitbucket notifications
- [ ] Fetch via Bitbucket API (PRs, comments, approvals)
- [ ] Parse notification types
- [ ] Map to unified schema
- [ ] Mark as read

#### Desktop App — V2 Updates

- [ ] Add Jira to source filter
- [ ] Add Bitbucket to source filter
- [ ] Jira-specific icons
- [ ] Bitbucket-specific icons
- [ ] Group notifications by repo/project
- [ ] Collapsible groups
- [ ] Search bar with text filtering
- [ ] Snooze notification (hide for X hours)

#### Quick Actions (Stretch)

- [ ] Backend endpoints for actions:
  - [ ] `POST /actions/github/approve-pr`
  - [ ] `POST /actions/github/merge-pr`
  - [ ] `POST /actions/linear/change-status`
  - [ ] `POST /actions/jira/transition`
  - [ ] `POST /actions/bitbucket/approve-pr`
- [ ] Quick actions panel in desktop app
- [ ] GitHub: Approve PR, Request changes, Merge
- [ ] Linear: Change status, Assign
- [ ] Jira: Transition issue
- [ ] Bitbucket: Approve PR

---

## V3 — Power User & Team Features

**Goal:** Become indispensable for power users and teams

### Suggested Integrations

| Integration         | Type          | Why                                        |
| ------------------- | ------------- | ------------------------------------------ |
| **Slack**           | Communication | Mentions, DMs, channel keywords            |
| **GitLab**          | Code          | Many teams use GitLab, same pain as GitHub |
| **Notion**          | Docs          | Comments, mentions, page updates           |
| **Figma**           | Design        | Comments on designs (dev handoff)          |
| **Vercel**          | Deployment    | Build failures, deployment status          |
| **Sentry**          | Monitoring    | Error alerts, new issues                   |
| **PagerDuty**       | Incidents     | On-call alerts                             |
| **Discord**         | Community     | Server mentions, DMs                       |
| **Google Calendar** | Time          | Meeting reminders (optional)               |

### Features

- [ ] Slack integration
- [ ] GitLab integration
- [ ] Notion integration
- [ ] Figma integration
- [ ] Vercel/Netlify deployment notifications
- [ ] Sentry error alerts
- [ ] Custom notification rules (if X then Y)
- [ ] Focus mode (pause all for X minutes)
- [ ] Daily digest summary
- [ ] Notification analytics (where do you spend attention?)
- [ ] Team sharing (shared filters/rules)
- [ ] Webhook support (custom sources)

---

## V4+ — Future Ideas

- [ ] Mobile app (React Native or native)
- [ ] Web app version
- [ ] Browser extension (quick peek)
- [ ] AI-powered priority scoring ("this PR is blocking 3 people")
- [ ] Smart bundling ("5 comments on your PR" instead of 5 notifications)
- [ ] Integration marketplace (community plugins)
- [ ] Calendar integration (snooze until after meeting)
- [ ] "Reply" directly from noti-peek (for comments)

---

## API Reference (V1)

### Auth Endpoints

| Method | Endpoint                | Description                |
| ------ | ----------------------- | -------------------------- |
| POST   | `/auth/register`        | Register device, get token |
| POST   | `/auth/verify`          | Verify device token        |
| GET    | `/auth/github`          | Start GitHub OAuth         |
| GET    | `/auth/github/callback` | GitHub OAuth callback      |
| DELETE | `/auth/github`          | Disconnect GitHub          |
| GET    | `/auth/linear`          | Start Linear OAuth         |
| GET    | `/auth/linear/callback` | Linear OAuth callback      |
| DELETE | `/auth/linear`          | Disconnect Linear          |

### Data Endpoints

| Method | Endpoint                  | Description              |
| ------ | ------------------------- | ------------------------ |
| GET    | `/connections`            | List connected accounts  |
| GET    | `/notifications`          | Get all notifications    |
| GET    | `/notifications/github`   | Get GitHub notifications |
| GET    | `/notifications/linear`   | Get Linear notifications |
| POST   | `/notifications/:id/read` | Mark as read             |
| POST   | `/notifications/read-all` | Mark all as read         |

---

## Success Metrics

| Metric                     | Target                                        |
| -------------------------- | --------------------------------------------- |
| Daily Active Usage         | You use it every day instead of GitHub/Linear |
| Time to First Notification | < 30 seconds after launch                     |
| Notifications Processed    | > 50/day marked read or opened                |
| Context Switches Saved     | Subjective feeling of "calm"                  |

---

## Non-Goals (for now)

- ❌ Mobile app (desktop first)
- ❌ Team/collaboration features (single user first)
- ❌ Email notifications (too noisy, different beast)
- ❌ Browser-only version (native desktop is the differentiator)
- ❌ Real-time push via webhooks (polling is fine for V1)

---

## Risks & Mitigations

| Risk                    | Mitigation                                                  |
| ----------------------- | ----------------------------------------------------------- |
| API rate limits         | Respect limits, cache aggressively, smart polling           |
| OAuth complexity        | Use proven patterns, test thoroughly                        |
| Integration maintenance | Start with stable APIs (GitHub, Linear are solid)           |
| "Just another app"      | Make it so good you can't NOT use it                        |
| Token security          | Encrypt in D1, use Cloudflare Secrets for OAuth credentials |

---

## Timeline

| Phase | Duration                   | Focus                              |
| ----- | -------------------------- | ---------------------------------- |
| V1    | 2-day sprint + polish week | Backend + GitHub + Linear, core UX |
| V2    | 2 weeks                    | Jira + Bitbucket                   |
| V3    | Ongoing                    | Based on user feedback             |

---

## Notes

- Keep it minimal like data-peek. No feature bloat.
- Ship ugly, iterate pretty.
- Eat your own dogfood from day 1.
- If it doesn't spark joy, delete it.
- Backend-first: get APIs working before polishing UI.

---

_Last updated: January 2025_
