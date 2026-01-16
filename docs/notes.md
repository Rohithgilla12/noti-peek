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

## Phase 2: Desktop App Setup (2025-01-16)

### Decisions Made

1. **Tauri v2**: Using latest Tauri v2 with React + TypeScript frontend
2. **Plugins Used**:
   - `tauri-plugin-opener` - Opening URLs in system browser
   - `tauri-plugin-http` - Making HTTP requests to backend
   - `tauri-plugin-store` - Secure storage for device token
3. **State Management**: Zustand for global state with derived selectors for filtered notifications
4. **Styling**: Tailwind CSS v4 with dark mode support via `dark:` classes
5. **App Window**: 400x600 default size, resizable with min 350x400

### Components Created

- `App.tsx` - Main app with initialization, keyboard shortcuts, auto-refresh
- `Header.tsx` - Filter tabs (All/GitHub/Linear), unread toggle, refresh/mark-all buttons
- `NotificationList.tsx` - Notification list with loading/empty/error states
- `NotificationItem.tsx` - Single notification with source/type icons, relative time
- `Settings.tsx` - Modal with connected accounts management and refresh interval

### Keyboard Shortcuts

- `R` - Refresh notifications
- `⌘,` - Open settings
- `Escape` - Close settings

### Next Steps

1. Set up OAuth apps on GitHub and Linear
2. Deploy backend to Cloudflare Workers
3. Create D1 database
4. Test full OAuth flow
5. Add system tray badge updates
6. Add OAuth deep link handling
