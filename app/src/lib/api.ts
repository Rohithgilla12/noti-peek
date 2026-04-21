import { fetch } from '@tauri-apps/plugin-http';
import type { Notification, Connection } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

type ReauthHandler = () => Promise<string | null>;

// Paths that must never trigger the re-auth callback — they're part of the
// auth flow itself, so retrying would either loop or hide a real failure.
const REAUTH_SKIP_PATHS = new Set(['/auth/register', '/auth/verify']);

class ApiClient {
  private deviceToken: string | null = null;
  private onUnauthorized: ReauthHandler | null = null;
  private reauthInFlight: Promise<string | null> | null = null;

  setDeviceToken(token: string | null) {
    this.deviceToken = token;
  }

  setOnUnauthorized(handler: ReauthHandler | null) {
    this.onUnauthorized = handler;
  }

  private async runReauth(): Promise<string | null> {
    if (!this.onUnauthorized) return null;
    if (!this.reauthInFlight) {
      const handler = this.onUnauthorized;
      this.reauthInFlight = handler().finally(() => {
        this.reauthInFlight = null;
      });
    }
    return this.reauthInFlight;
  }

  private async request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.deviceToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.deviceToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && !retried && !REAUTH_SKIP_PATHS.has(path)) {
      const newToken = await this.runReauth();
      if (newToken) {
        return this.request<T>(path, options, true);
      }
      throw new UnauthorizedError();
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      const message = (error as { error?: string }).error || 'Request failed';
      if (response.status === 401) {
        throw new UnauthorizedError(message);
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  async register(): Promise<{ id: string; deviceToken: string }> {
    return this.request('/auth/register', { method: 'POST' });
  }

  async verify(): Promise<{ valid: boolean; userId: string }> {
    return this.request('/auth/verify', { method: 'POST' });
  }

  private async startOAuth(provider: 'github' | 'linear' | 'jira' | 'bitbucket'): Promise<string> {
    const response = await this.request<{ url: string; expiresAt: string }>(`/auth/${provider}/start`, {
      method: 'POST',
    });
    return response.url;
  }

  async getGitHubAuthUrl(): Promise<string> {
    return this.startOAuth('github');
  }

  async getLinearAuthUrl(): Promise<string> {
    return this.startOAuth('linear');
  }

  async getJiraAuthUrl(): Promise<string> {
    return this.startOAuth('jira');
  }

  async getBitbucketAuthUrl(): Promise<string> {
    return this.startOAuth('bitbucket');
  }

  async connectGitHubWithToken(token: string): Promise<{ success: boolean; accountName: string; accountAvatar: string }> {
    return this.request('/auth/github/token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async disconnectGitHub(): Promise<void> {
    await this.request('/auth/github', { method: 'DELETE' });
  }

  async disconnectLinear(): Promise<void> {
    await this.request('/auth/linear', { method: 'DELETE' });
  }

  async disconnectJira(): Promise<void> {
    await this.request('/auth/jira', { method: 'DELETE' });
  }

  async disconnectBitbucket(): Promise<void> {
    await this.request('/auth/bitbucket', { method: 'DELETE' });
  }

  async getConnections(): Promise<{ connections: Connection[] }> {
    return this.request('/connections');
  }

  async getNotifications(): Promise<{ notifications: Notification[]; errors?: Array<{ provider: string; error: string }> }> {
    return this.request('/notifications');
  }

  async getGitHubNotifications(): Promise<{ notifications: Notification[] }> {
    return this.request('/notifications/github');
  }

  async getLinearNotifications(): Promise<{ notifications: Notification[] }> {
    return this.request('/notifications/linear');
  }

  async getJiraNotifications(): Promise<{ notifications: Notification[] }> {
    return this.request('/notifications/jira');
  }

  async getBitbucketNotifications(): Promise<{ notifications: Notification[] }> {
    return this.request('/notifications/bitbucket');
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
  }

  async markAllAsRead(source?: string): Promise<void> {
    await this.request('/notifications/read-all', {
      method: 'POST',
      body: source ? JSON.stringify({ source }) : undefined,
    });
  }

  async deleteAccount(): Promise<void> {
    await this.request('/users/me', { method: 'DELETE' });
  }
}

export const api = new ApiClient();
