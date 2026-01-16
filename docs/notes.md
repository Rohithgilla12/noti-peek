# Development Notes

## Phase 1: Backend Setup (2025-01-16)

### Decisions Made

1. **Project Structure**: Monorepo with `backend/` and later `app/` directories
2. **Package Manager**: Using bun with `--ignore-scripts` due to sharp dependency issues in wrangler
3. **Notification ID Format**: Using `{provider}:{id}` format (e.g., `github:123456`) to easily identify source
4. **OAuth State**: Using `{userId}:{randomUUID}` format to prevent CSRF and identify user on callback
5. **Token Storage**: Storing OAuth tokens directly in D1 (will use Cloudflare Secrets for client secrets)

### API Endpoints Implemented

- `POST /auth/register` - Device registration
- `POST /auth/verify` - Token verification
- `GET /auth/github` - GitHub OAuth flow start
- `GET /auth/github/callback` - GitHub OAuth callback
- `DELETE /auth/github` - Disconnect GitHub
- `GET /auth/linear` - Linear OAuth flow start
- `GET /auth/linear/callback` - Linear OAuth callback
- `DELETE /auth/linear` - Disconnect Linear
- `GET /connections` - List connected accounts
- `GET /notifications` - All notifications (aggregated)
- `GET /notifications/github` - GitHub notifications only
- `GET /notifications/linear` - Linear notifications only
- `POST /notifications/:id/read` - Mark single as read
- `POST /notifications/read-all` - Mark all as read

### Environment Variables Needed

```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
APP_URL=https://api.notipeek.dev
```

### Next Steps

1. Create D1 database via Wrangler CLI
2. Set up OAuth apps on GitHub and Linear
3. Deploy to Cloudflare (dev environment)
4. Start Tauri desktop app setup
