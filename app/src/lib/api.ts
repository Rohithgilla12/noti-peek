import { fetch } from '@tauri-apps/plugin-http';
import type { Notification, Connection } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

class ApiClient {
  private deviceToken: string | null = null;

  setDeviceToken(token: string | null) {
    this.deviceToken = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((error as { error?: string }).error || 'Request failed');
    }

    return response.json() as Promise<T>;
  }

  async register(): Promise<{ id: string; deviceToken: string }> {
    return this.request('/auth/register', { method: 'POST' });
  }

  async verify(): Promise<{ valid: boolean; userId: string }> {
    return this.request('/auth/verify', { method: 'POST' });
  }

  getGitHubAuthUrl(): string {
    if (!this.deviceToken) throw new Error('Not authenticated');
    return `${API_URL}/auth/github?token=${encodeURIComponent(this.deviceToken)}`;
  }

  getLinearAuthUrl(): string {
    if (!this.deviceToken) throw new Error('Not authenticated');
    return `${API_URL}/auth/linear?token=${encodeURIComponent(this.deviceToken)}`;
  }

  async disconnectGitHub(): Promise<void> {
    await this.request('/auth/github', { method: 'DELETE' });
  }

  async disconnectLinear(): Promise<void> {
    await this.request('/auth/linear', { method: 'DELETE' });
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

  async markAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
  }

  async markAllAsRead(source?: string): Promise<void> {
    await this.request('/notifications/read-all', {
      method: 'POST',
      body: source ? JSON.stringify({ source }) : undefined,
    });
  }
}

export const api = new ApiClient();
