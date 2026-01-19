# Integration Setup Guide

This guide explains how to set up OAuth apps for Jira and Bitbucket integrations.

---

## Jira (Atlassian Cloud)

### Step 1: Create an Atlassian Developer Account

1. Go to [developer.atlassian.com](https://developer.atlassian.com/)
2. Sign in with your Atlassian account (or create one)

### Step 2: Create an OAuth 2.0 App

1. Navigate to **Developer Console** → **My Apps**
2. Click **Create** → **OAuth 2.0 integration**
3. Fill in the details:
   - **Name**: `noti-peek` (or your preferred name)
   - **Description**: Unified notification hub for developers

### Step 3: Configure OAuth 2.0

1. In your app settings, go to **Authorization** → **OAuth 2.0 (3LO)**
2. Add callback URL:
   ```
   https://your-api-url.com/auth/jira/callback
   ```
   For local development:
   ```
   http://localhost:8787/auth/jira/callback
   ```

### Step 4: Configure Scopes

Add these required scopes under **Permissions**:

| Scope | Purpose |
|-------|---------|
| `read:jira-work` | Read Jira issues, projects, and boards |
| `read:jira-user` | Read user profile information |
| `offline_access` | Get refresh tokens for long-lived access |

### Step 5: Get Credentials

1. Go to **Settings** in your app
2. Copy:
   - **Client ID**
   - **Client Secret** (you may need to create one)

### Step 6: Add to Environment

Add to your `wrangler.toml` or environment:

```toml
[vars]
JIRA_CLIENT_ID = "your-client-id"
JIRA_CLIENT_SECRET = "your-client-secret"
```

Or for secrets:
```bash
wrangler secret put JIRA_CLIENT_ID
wrangler secret put JIRA_CLIENT_SECRET
```

---

## Bitbucket (Atlassian)

### Step 1: Access Bitbucket Settings

1. Go to [bitbucket.org](https://bitbucket.org/)
2. Click your avatar → **All workspaces** → Select your workspace
3. Go to **Settings** → **OAuth consumers** (under Apps and features)

### Step 2: Create OAuth Consumer

1. Click **Add consumer**
2. Fill in the details:
   - **Name**: `noti-peek`
   - **Description**: Unified notification hub for developers
   - **Callback URL**:
     ```
     https://your-api-url.com/auth/bitbucket/callback
     ```
     For local development:
     ```
     http://localhost:8787/auth/bitbucket/callback
     ```

### Step 3: Configure Permissions

Select these permissions:

| Permission | Access Level | Purpose |
|------------|--------------|---------|
| **Account** | Read | Read user profile |
| **Repositories** | Read | List repositories |
| **Pull requests** | Read | Read pull request details |

### Step 4: Save and Get Credentials

1. Click **Save**
2. Your consumer will be created with:
   - **Key** (this is your Client ID)
   - **Secret** (click to reveal)

### Step 5: Add to Environment

Add to your `wrangler.toml` or environment:

```toml
[vars]
BITBUCKET_CLIENT_ID = "your-consumer-key"
BITBUCKET_CLIENT_SECRET = "your-consumer-secret"
```

Or for secrets:
```bash
wrangler secret put BITBUCKET_CLIENT_ID
wrangler secret put BITBUCKET_CLIENT_SECRET
```

---

## Complete Environment Configuration

Your full environment should include:

```toml
# wrangler.toml
[vars]
APP_URL = "https://your-api-url.com"

# GitHub
GITHUB_CLIENT_ID = "..."
GITHUB_CLIENT_SECRET = "..."

# Linear
LINEAR_CLIENT_ID = "..."
LINEAR_CLIENT_SECRET = "..."

# Jira
JIRA_CLIENT_ID = "..."
JIRA_CLIENT_SECRET = "..."

# Bitbucket
BITBUCKET_CLIENT_ID = "..."
BITBUCKET_CLIENT_SECRET = "..."
```

---

## Testing the Integrations

### Run the Tests

```bash
cd backend
npm install
npm test
```

### Manual Testing

1. Start the backend:
   ```bash
   npm run dev
   ```

2. Register a device:
   ```bash
   curl -X POST http://localhost:8787/auth/register
   ```

3. Test OAuth flow by visiting:
   - Jira: `http://localhost:8787/auth/jira?token=YOUR_DEVICE_TOKEN`
   - Bitbucket: `http://localhost:8787/auth/bitbucket?token=YOUR_DEVICE_TOKEN`

---

## Troubleshooting

### Jira: "No Jira cloud resources available"
- Ensure your Atlassian account has access to at least one Jira Cloud instance
- The user must have logged into the Jira site at least once

### Bitbucket: "Failed to get Bitbucket user"
- Verify your OAuth consumer has the `account:read` permission
- Check that the callback URL matches exactly (including http vs https)

### Token Refresh Failures
- For Jira: Ensure `offline_access` scope is enabled
- For Bitbucket: Refresh tokens are automatic, ensure the secret is correct

### Rate Limiting
- Jira: 100 requests per minute per user
- Bitbucket: 1000 requests per hour per user

---

## API Reference

### Jira Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /oauth/token/accessible-resources` | Get Jira Cloud instances |
| `GET /ex/jira/{cloudId}/rest/api/3/search` | Search issues (JQL) |
| `GET /me` | Get current user |

### Bitbucket Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /2.0/user` | Get current user |
| `GET /2.0/pullrequests/{uuid}` | Get PRs for user |
| `GET /2.0/repositories` | List repositories |
| `GET /2.0/repositories/{workspace}/{repo}/pullrequests` | Get repo PRs |

---

## Security Notes

1. **Never commit secrets** to version control
2. Use `wrangler secret put` for production secrets
3. Rotate credentials if compromised
4. Use environment-specific OAuth apps for dev/staging/prod
