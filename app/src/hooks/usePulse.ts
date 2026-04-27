import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { getPulseMetrics, type PulseMetrics, type PulseFilter } from '../lib/pulse';

export interface UsePulseResult {
  metrics: PulseMetrics | null;
  loading: boolean;
  error: string | null;
}

export function usePulse(filter: PulseFilter): UsePulseResult {
  const lastSyncTime = useAppStore((s) => s.lastSyncTime);
  const activeTab = useAppStore((s) => s.view.tab);

  const [metrics, setMetrics] = useState<PulseMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqId = useRef(0);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const m = await getPulseMetrics(filter);
      if (reqId.current !== my) return;
      setMetrics(m);
    } catch (err) {
      if (reqId.current !== my) return;
      setError(err instanceof Error ? err.message : 'failed to load pulse');
    } finally {
      if (reqId.current === my) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (activeTab !== 'pulse') return;
    void load();
  }, [load, lastSyncTime, activeTab]);

  return { metrics, loading, error };
}
