# Changelog

All notable changes to this project are documented here. The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from v1 onwards.

## [Unreleased]

## [0.5.0] — 2026-04-22

### Added

- **Pulse analytics dashboard.** Type-filter bars (`TypeBars`) and an active-hours ribbon give a richer rolling view of inbox activity.
- **Mark all as read** action + keyboard shortcuts from the footer.
- Connected-source filtering in the day stream — filter to just the providers you currently have connected.
- Pure reducer tests covering the new Pulse analytics paths.

### Changed

- Landing "Download" CTA now points at the public `noti-peek-releases` repo.
- Repo prepped for open source: MIT `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, issue/PR templates, and a README with dark/light screenshot mocks.
- Package/crate metadata (author, license, repository) set on both `app/package.json` and `app/src-tauri/Cargo.toml`.

### Fixed

- Primary "Open" button stays readable on hover in the detail pane.
- Window dragging works again — added the `core:window:default` capability.
- Empty space in the top nav is draggable on macOS (Tauri v2's `data-tauri-drag-region` does not propagate to children, so it's now applied to `.topnav-tabs` and `.topnav-actions` directly).

## [0.4.0] — 2026-04-21

### Added

- **Detail pane actions.** Open, comment, merge, transition from the detail pane without leaving the app.
- GitHub PR and issue detail fetchers with review + checks summary.
- Jira issue details, comment, transition, and assign actions.
- `POST /notifications/:id/actions/:action` and `GET /notifications/:id/details` backend routes.
- `c` and `m` keyboard shortcuts for comment and merge.
- DOMPurify-backed HTML sanitizer for provider-supplied description bodies.

### Changed

- Detail pane rewritten as an orchestrator with `StatusStrip`, `Comments`, and `Actions` subcomponents.
- GitHub and Jira OAuth scopes expanded to cover write actions.

### Fixed

- Error paths on reconnect: token refresh, in-flight dedup, and sanitize guards hardened.
- Structured scope-error propagation with a live reconnect CTA.

## [0.3.0] — 2026-04-02

### Added

- **Pulse view.** Rolling 14-day metrics: reviewed, merged, response time, bundling ratio.
- Pulse filter chip + archive list.
- `1` / `2` keyboard shortcuts for tab switching.
- Tab persistence across launches.
- Vitest + jsdom for app unit tests.
- Pure analytics reducers with test coverage.

### Changed

- Signature accent switched from amber to bone.
- Custom app icon + proper tray template.
- Landing page rebuilt against the brand system.
- Notification upsert now preserves `first_seen_at`.

## [0.2.3] — 2026-03-15

### Added

- macOS-native window chrome and behaviour (traffic lights overlay, hidden title).
- Window vibrancy, native menu, desktop notifications on new activity.

### Fixed

- Detail "Open" button uses `plugin-opener` correctly.
- Detail key-value fields render in a grid.

## [0.2.0] — 2026-03-01

### Added

- Full-window "Daybook" shell redesign.

### Fixed

- Jira and Bitbucket providers migrated to post-sunset APIs.
- Bitbucket OAuth token exchange now includes `redirect_uri`.

## [0.1.1] — 2026-02-14

### Fixed

- `@tauri-apps/api` and `@tauri-apps/cli` bumped to 2.10.1 to match the crate version.
- `tauri-plugin-updater` crate bumped to 2.10.1 to match the npm side.
- Updater wired through `useUpdater`; strips `v`-prefix from manifest.

## [0.1.0] — 2026-02-01

Initial beta.

### Added

- Tauri v2 desktop app with tray icon and system notifications.
- Cloudflare Workers + Hono backend, D1 storage.
- GitHub and Linear notification providers.
- Experimental Jira and Bitbucket providers (behind a flag).
- OAuth 2.0 flows handled entirely on the backend.
- Device-token registration with auto re-register on 401.
- Auto-updater via signed release manifest.
- SQLite local cache for instant window open.

[Unreleased]: https://github.com/Rohithgilla12/noti-peek/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Rohithgilla12/noti-peek/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Rohithgilla12/noti-peek/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/Rohithgilla12/noti-peek/compare/v0.2.0...v0.2.3
[0.2.0]: https://github.com/Rohithgilla12/noti-peek/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Rohithgilla12/noti-peek/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Rohithgilla12/noti-peek/releases/tag/v0.1.0
