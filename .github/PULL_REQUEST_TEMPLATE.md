<!--
  Thanks for the PR. Keep it focused — one logical change per PR.
  If this is big, add a note below describing the order to read the files in.
-->

## What

<!-- One-line summary of the change. -->

## Why

<!-- The problem this solves, or the behaviour this enables. Link the issue if there is one: `Closes #123`. -->

## How

<!-- Brief notes on the approach. Call out anything subtle a reviewer should know. -->

## Test plan

<!-- What you ran locally, what the reviewer should try, edge cases you explicitly thought about. -->

- [ ] `bun run build` passes in `app/` and `backend/`
- [ ] `bun run test` passes in `app/` and `backend/`
- [ ] `cargo check` passes in `app/src-tauri/` (if Rust changed)
- [ ] New behaviour is covered by tests
- [ ] No secrets, tokens, or personal identifiers in the diff
- [ ] Docs / README / CHANGELOG updated where relevant

## Screenshots

<!-- For UI changes, drop before/after screenshots or a short screen recording. -->
