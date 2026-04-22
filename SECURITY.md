# Security Policy

## Supported versions

Security fixes are shipped against the latest release only. Older versions don't get backports — the app auto-updates on launch, so the latest signed build is the supported surface.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Email **gillarohith1@gmail.com** with:

- A description of the issue and its impact
- Steps to reproduce, ideally with a minimal proof of concept
- Any relevant logs, tokens (redacted), or request/response captures
- Your assessment of severity

You can expect:

- An acknowledgement within **3 business days**
- A follow-up with initial triage within **7 business days**
- A fix or clear mitigation plan within **30 days** for confirmed vulnerabilities, faster for criticals

If you don't hear back within the acknowledgement window, please follow up — email can be unreliable.

## What's in scope

- The Tauri desktop app (`app/`) and its Rust backend
- The Cloudflare Workers API (`backend/`)
- OAuth flows, token storage, device-token handling
- The auto-updater pipeline
- The landing site (`landing/`) insofar as it affects users

## What's out of scope

- Social engineering of project maintainers
- Spam, rate-limit exhaustion, and other DoS-class noise without a novel bypass
- Issues that require physical access to an unlocked user device
- Vulnerabilities in Cloudflare, GitHub, Linear, Atlassian, or Bitbucket themselves — please report those to the respective vendor

## Credit

If you'd like public credit for a reported issue, I'm happy to add you to a "Thanks" section in the release notes once the fix ships and users have had time to update. Let me know in your report.
