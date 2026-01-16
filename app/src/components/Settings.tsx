import { openUrl } from '@tauri-apps/plugin-opener';
import { useAppStore } from '../store';
import { api } from '../lib/api';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const connections = useAppStore((state) => state.connections);
  const fetchConnections = useAppStore((state) => state.fetchConnections);
  const refreshInterval = useAppStore((state) => state.refreshInterval);
  const setRefreshInterval = useAppStore((state) => state.setRefreshInterval);

  const isGitHubConnected = connections.some((c) => c.provider === 'github');
  const isLinearConnected = connections.some((c) => c.provider === 'linear');

  const handleConnectGitHub = async () => {
    await openUrl(api.getGitHubAuthUrl());
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Connected Accounts</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🐙</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">GitHub</p>
                    {isGitHubConnected && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {connections.find((c) => c.provider === 'github')?.accountName}
                      </p>
                    )}
                  </div>
                </div>
                {isGitHubConnected ? (
                  <button
                    onClick={handleDisconnectGitHub}
                    className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGitHub}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Connect
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📐</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Linear</p>
                    {isLinearConnected && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {connections.find((c) => c.provider === 'linear')?.accountName}
                      </p>
                    )}
                  </div>
                </div>
                {isLinearConnected ? (
                  <button
                    onClick={handleDisconnectLinear}
                    className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectLinear}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Refresh Interval</h3>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            >
              {intervals.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </section>
        </div>
      </div>
    </div>
  );
}
