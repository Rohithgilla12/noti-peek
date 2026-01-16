import { useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAppStore } from '../store';
import { api } from '../lib/api';
import { ThemeSwitcher } from './ThemeSwitcher';

interface SettingsProps {
  onClose: () => void;
}

function GitHubIcon() {
  return (
    <svg className="w-5 h-5" style={{ color: 'var(--github)' }} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function LinearIcon() {
  return (
    <svg className="w-5 h-5" style={{ color: 'var(--linear)' }} fill="currentColor" viewBox="0 0 100 100">
      <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.00567075.5765.07145765.877l5.11115015 21.8135c.222.9485.90744 1.5459 1.59634.857l23.0566-23.0566c.2467-.2467.2467-.6466 0-.8934L12.0753 28.7255c-.2467-.2467-.6466-.2467-.8934 0L.304014 39.6033C.105431 39.8019.000881 40.0696.00189 40.3483l-.00000135 6.5765v-.0357ZM.00000135 34.3891v.0357c-.0106912-.3399.084019-.6705.277611-.9561l-.277611.9204ZM12.6217 23.0306 24.3696 11.2827c.2378-.2378.6244-.2418.8666-.0085 9.5019 9.1573 14.6017 21.8633 13.5329 35.4343-.1108 1.407-1.7272 2.0379-2.7302 1.0349L12.6217 24.327c-.2467-.2467-.2467-.6467 0-.8934l-.0001-.0001.0001-.403ZM19.2727 4.34818c.4088-.6282 1.2853-.68276 1.7595-.15803C34.0423 19.0282 47.9748 32.6396 61.8341 47.4296c.6244.6666.0705 1.7632-.8507 1.6822l-.0072-.0006c-11.7847-1.0398-22.3946-6.3061-29.8783-14.5124l-.0005-.0006C22.6222 25.4629 17.3569 14.86 19.2727 4.34818Z"/>
    </svg>
  );
}

export function Settings({ onClose }: SettingsProps) {
  const connections = useAppStore((state) => state.connections);
  const fetchConnections = useAppStore((state) => state.fetchConnections);
  const refreshInterval = useAppStore((state) => state.refreshInterval);
  const setRefreshInterval = useAppStore((state) => state.setRefreshInterval);

  const [showGitHubToken, setShowGitHubToken] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGitHubConnected = connections.some((c) => c.provider === 'github');
  const isLinearConnected = connections.some((c) => c.provider === 'linear');

  const handleConnectGitHub = async () => {
    await openUrl(api.getGitHubAuthUrl());
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
    await openUrl(api.getLinearAuthUrl());
  };

  const handleDisconnectGitHub = async () => {
    await api.disconnectGitHub();
    await fetchConnections();
  };

  const handleDisconnectLinear = async () => {
    await api.disconnectLinear();
    await fetchConnections();
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
              Theme
            </h3>
            <ThemeSwitcher />
          </section>

          <section>
            <h3 className="text-[length:var(--text-sm)] font-medium text-[var(--text-primary)] mb-3">
              Connected Accounts
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-muted)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitHubIcon />
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
                    {error && (
                      <p className="text-[length:var(--text-xs)] text-[var(--error)]">{error}</p>
                    )}
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
                  <LinearIcon />
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
