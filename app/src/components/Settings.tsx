import { useState, useEffect } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { load } from '@tauri-apps/plugin-store';
import { useAppStore, isTheme } from '../store';
import { api } from '../lib/api';
import { SourceIcon } from './shared/SourceIcon';

interface SettingsProps {
  onClose: () => void;
}

const AUTH_STORE_FILE = 'config.json';
const AUTH_STORE_KEY = 'auth';

export function Settings({ onClose }: SettingsProps) {
  const enableExperimentalProviders = import.meta.env.VITE_ENABLE_EXPERIMENTAL_PROVIDERS === 'true';
  const connections = useAppStore((state) => state.connections);
  const fetchConnections = useAppStore((state) => state.fetchConnections);
  const refreshInterval = useAppStore((state) => state.refreshInterval);
  const setRefreshInterval = useAppStore((state) => state.setRefreshInterval);
  const clearCache = useAppStore((state) => state.clearCache);
  const setAuth = useAppStore((state) => state.setAuth);
  const clearAuth = useAppStore((state) => state.clearAuth);

  const [showGitHubToken, setShowGitHubToken] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [crossProviderEnabled, setCrossProviderEnabled] = useState(true);
  const [suggestNewLinksEnabled, setSuggestNewLinksEnabled] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const clearDismissed = useAppStore((s) => s.clearDismissedSuggestions);
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    (async () => {
      const store = await load('config.json');
      const cpb = await store.get<boolean>('crossProviderBundling');
      const snl = await store.get<boolean>('suggestNewLinks');
      if (typeof cpb === 'boolean') setCrossProviderEnabled(cpb);
      if (typeof snl === 'boolean') setSuggestNewLinksEnabled(snl);
    })();
  }, []);

  const onToggleCross = async (checked: boolean) => {
    const previous = crossProviderEnabled;
    setCrossProviderEnabled(checked);
    setSettingsError(null);
    try {
      const store = await load('config.json');
      await store.set('crossProviderBundling', checked);
      await store.save();
      await fetchNotifications();
    } catch (err) {
      setCrossProviderEnabled(previous);
      setSettingsError(err instanceof Error ? err.message : 'Failed to update bundling preference');
    }
  };

  const onToggleSuggest = async (checked: boolean) => {
    const previous = suggestNewLinksEnabled;
    setSuggestNewLinksEnabled(checked);
    setSettingsError(null);
    try {
      const store = await load('config.json');
      await store.set('suggestNewLinks', checked);
      await store.save();
      await fetchNotifications();
    } catch (err) {
      setSuggestNewLinksEnabled(previous);
      setSettingsError(err instanceof Error ? err.message : 'Failed to update suggestion preference');
    }
  };

  const isGitHubConnected = connections.some((c) => c.provider === 'github');
  const isLinearConnected = connections.some((c) => c.provider === 'linear');
  const isJiraConnected = connections.some((c) => c.provider === 'jira');
  const isBitbucketConnected = connections.some((c) => c.provider === 'bitbucket');

  const startOAuthFlow = async (getAuthUrl: () => Promise<string>) => {
    setError(null);
    try {
      const authUrl = await getAuthUrl();
      await openUrl(authUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth flow');
    }
  };

  const handleConnectGitHub = async () => {
    await startOAuthFlow(() => api.getGitHubAuthUrl());
  };

  const handleConnectGitHubWithToken = async () => {
    if (!githubToken.trim()) return;

    setIsConnecting(true);
    setError(null);

    try {
      await api.connectGitHubWithToken(githubToken.trim());
      await fetchConnections();
      setShowGitHubToken(false);
      setGithubToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectLinear = async () => {
    await startOAuthFlow(() => api.getLinearAuthUrl());
  };

  const handleDisconnectGitHub = async () => {
    await api.disconnectGitHub();
    await fetchConnections();
  };

  const handleDisconnectLinear = async () => {
    await api.disconnectLinear();
    await fetchConnections();
  };

  const handleConnectJira = async () => {
    await startOAuthFlow(() => api.getJiraAuthUrl());
  };

  const handleDisconnectJira = async () => {
    await api.disconnectJira();
    await fetchConnections();
  };

  const handleConnectBitbucket = async () => {
    await startOAuthFlow(() => api.getBitbucketAuthUrl());
  };

  const handleDisconnectBitbucket = async () => {
    await api.disconnectBitbucket();
    await fetchConnections();
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.deleteAccount();

      await clearCache();
      clearAuth();

      const store = await load(AUTH_STORE_FILE);
      await store.delete(AUTH_STORE_KEY);

      const { id, deviceToken } = await api.register();
      api.setDeviceToken(deviceToken);
      setAuth(deviceToken, id);
      await store.set(AUTH_STORE_KEY, { deviceToken, userId: id });
      await store.save();

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const intervals = [
    { value: 60000, label: '1 minute' },
    { value: 300000, label: '5 minutes' },
    { value: 900000, label: '15 minutes' },
    { value: 1800000, label: '30 minutes' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-base)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border border-[var(--border-default)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-muted)]">
          <h2 className="text-[length:var(--text-lg)] font-semibold text-[var(--text-primary)]">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)] mb-3">
              Appearance
            </h3>
            <label className="flex items-center justify-between gap-3 p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-muted)]">
              <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
                Theme
              </span>
              <select
                value={theme}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isTheme(v)) setTheme(v);
                }}
                className="p-2 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[length:var(--text-sm)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
          </section>

          <section>
            <h3 className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)] mb-3">
              Connected Accounts
            </h3>
            {error && (
              <p className="mb-3 text-[length:var(--text-xs)] text-[var(--error)]">{error}</p>
            )}
            <div className="space-y-3">
              <div className="p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-muted)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--github)' }}>
                      <SourceIcon provider="github" size={20} />
                    </span>
                    <div>
                      <p className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
                        GitHub
                      </p>
                      {isGitHubConnected && (
                        <p className="text-[length:var(--text-xs)] text-[var(--text-secondary)]">
                          {connections.find((c) => c.provider === 'github')?.accountName}
                        </p>
                      )}
                    </div>
                  </div>
                  {isGitHubConnected ? (
                    <button
                      onClick={handleDisconnectGitHub}
                      className="px-3 py-1 text-[length:var(--text-xs)] text-[var(--error)] hover:bg-[var(--error)]/10 rounded-[var(--radius-sm)] transition-colors duration-150"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleConnectGitHub}
                        className="px-3 py-1 text-[length:var(--text-xs)] bg-[var(--accent)] text-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] transition-colors duration-150"
                      >
                        OAuth
                      </button>
                      <button
                        onClick={() => setShowGitHubToken(!showGitHubToken)}
                        className="px-3 py-1 text-[length:var(--text-xs)] bg-[var(--bg-overlay)] text-[var(--text-secondary)] rounded-[var(--radius-sm)] hover:bg-[var(--bg-highlight)] transition-colors duration-150"
                      >
                        Token
                      </button>
                    </div>
                  )}
                </div>

                {showGitHubToken && !isGitHubConnected && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[length:var(--text-xs)] text-[var(--text-secondary)]">
                      Use a Personal Access Token for private/org repos.{' '}
                      <button
                        onClick={() =>
                          openUrl(
                            'https://github.com/settings/tokens/new?scopes=notifications,read:user&description=noti-peek'
                          )
                        }
                        className="text-[var(--accent)] hover:underline"
                      >
                        Create one here
                      </button>
                    </p>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="w-full p-2 text-[length:var(--text-sm)] bg-[var(--bg-base)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      onClick={handleConnectGitHubWithToken}
                      disabled={isConnecting || !githubToken.trim()}
                      className="w-full px-3 py-2 text-[length:var(--text-xs)] bg-[var(--accent)] text-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors duration-150"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect with Token'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-muted)]">
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--linear)' }}>
                    <SourceIcon provider="linear" size={20} />
                  </span>
                  <div>
                    <p className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
                      Linear
                    </p>
                    {isLinearConnected && (
                      <p className="text-[length:var(--text-xs)] text-[var(--text-secondary)]">
                        {connections.find((c) => c.provider === 'linear')?.accountName}
                      </p>
                    )}
                  </div>
                </div>
                {isLinearConnected ? (
                  <button
                    onClick={handleDisconnectLinear}
                    className="px-3 py-1 text-[length:var(--text-xs)] text-[var(--error)] hover:bg-[var(--error)]/10 rounded-[var(--radius-sm)] transition-colors duration-150"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectLinear}
                    className="px-3 py-1 text-[length:var(--text-xs)] bg-[var(--accent)] text-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] transition-colors duration-150"
                  >
                    Connect
                  </button>
                )}
              </div>

              {(enableExperimentalProviders || isJiraConnected) && (
                <div className="flex items-center justify-between p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-muted)]">
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--jira)' }}>
                      <SourceIcon provider="jira" size={20} />
                    </span>
                    <div>
                      <p className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
                        Jira
                      </p>
                      {isJiraConnected && (
                        <p className="text-[length:var(--text-xs)] text-[var(--text-secondary)]">
                          {connections.find((c) => c.provider === 'jira')?.accountName}
                        </p>
                      )}
                    </div>
                  </div>
                  {isJiraConnected && (
                    <button
                      onClick={handleDisconnectJira}
                      className="px-3 py-1 text-[length:var(--text-xs)] text-[var(--error)] hover:bg-[var(--error)]/10 rounded-[var(--radius-sm)] transition-colors duration-150"
                    >
                      Disconnect
                    </button>
                  )}
                  {!isJiraConnected && enableExperimentalProviders && (
                    <button
                      onClick={handleConnectJira}
                      className="px-3 py-1 text-[length:var(--text-xs)] bg-[var(--accent)] text-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] transition-colors duration-150"
                    >
                      Connect
                    </button>
                  )}
                </div>
              )}

              {(enableExperimentalProviders || isBitbucketConnected) && (
                <div className="flex items-center justify-between p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-muted)]">
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--bitbucket)' }}>
                      <SourceIcon provider="bitbucket" size={20} />
                    </span>
                    <div>
                      <p className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
                        Bitbucket
                      </p>
                      {isBitbucketConnected && (
                        <p className="text-[length:var(--text-xs)] text-[var(--text-secondary)]">
                          {connections.find((c) => c.provider === 'bitbucket')?.accountName}
                        </p>
                      )}
                    </div>
                  </div>
                  {isBitbucketConnected && (
                    <button
                      onClick={handleDisconnectBitbucket}
                      className="px-3 py-1 text-[length:var(--text-xs)] text-[var(--error)] hover:bg-[var(--error)]/10 rounded-[var(--radius-sm)] transition-colors duration-150"
                    >
                      Disconnect
                    </button>
                  )}
                  {!isBitbucketConnected && enableExperimentalProviders && (
                    <button
                      onClick={handleConnectBitbucket}
                      className="px-3 py-1 text-[length:var(--text-xs)] bg-[var(--accent)] text-[var(--bg-base)] rounded-[var(--radius-sm)] hover:bg-[var(--accent-hover)] transition-colors duration-150"
                    >
                      Connect
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)] mb-3">
              Refresh Interval
            </h3>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="w-full p-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[length:var(--text-sm)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              {intervals.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h3 className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)] mb-3">
              Bundling
            </h3>
            {settingsError && (
              <p className="mb-3 text-[length:var(--text-xs)] text-[var(--error)]">{settingsError}</p>
            )}
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={crossProviderEnabled}
                  onChange={(e) => void onToggleCross(e.target.checked)}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div>
                  <div className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
                    Cross-provider bundling
                  </div>
                  <div className="text-[length:var(--text-xs)] text-[var(--text-secondary)] mt-0.5">
                    Collapse linked Linear/Jira tickets and their GitHub/Bitbucket PRs into one row.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={suggestNewLinksEnabled}
                  onChange={(e) => void onToggleSuggest(e.target.checked)}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <div>
                  <div className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
                    Suggest new links
                  </div>
                  <div className="text-[length:var(--text-xs)] text-[var(--text-secondary)] mt-0.5">
                    Surface likely-related tickets and PRs in the Suggested Links view.
                  </div>
                </div>
              </label>
              <button
                type="button"
                onClick={() => void clearDismissed()}
                className="w-full px-3 py-2 text-[length:var(--text-xs)] text-[var(--text-secondary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] hover:bg-[var(--bg-overlay)] transition-colors duration-150"
              >
                Clear dismissed suggestions
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-[length:var(--text-sm)] font-medium text-[var(--error)] mb-3">
              Danger Zone
            </h3>
            <div className="p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--error)]/30 space-y-3">
              <div>
                <p className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]">
                  Delete account
                </p>
                <p className="text-[length:var(--text-xs)] text-[var(--text-secondary)] mt-1">
                  Permanently removes your account, connected providers, and all cached notifications from our servers. This cannot be undone.
                </p>
              </div>
              {confirmingDelete ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="flex-1 px-3 py-2 text-[length:var(--text-xs)] font-medium bg-[var(--error)] text-white rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50 transition-opacity duration-150"
                  >
                    {isDeleting ? 'Deleting…' : 'Yes, delete my account'}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={isDeleting}
                    className="px-3 py-2 text-[length:var(--text-xs)] bg-[var(--bg-overlay)] text-[var(--text-secondary)] rounded-[var(--radius-sm)] hover:bg-[var(--bg-highlight)] disabled:opacity-50 transition-colors duration-150"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full px-3 py-2 text-[length:var(--text-xs)] font-medium text-[var(--error)] border border-[var(--error)]/40 rounded-[var(--radius-sm)] hover:bg-[var(--error)]/10 transition-colors duration-150"
                >
                  Delete account
                </button>
              )}
            </div>
          </section>

          <section className="pt-4 border-t border-[var(--border-muted)]">
            <p className="text-[length:var(--text-xs)] text-[var(--text-tertiary)] text-center">
              noti-peek v0.1.0
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
