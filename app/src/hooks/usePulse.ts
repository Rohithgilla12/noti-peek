import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import {
  getArchive,
  getPulseMetrics,
  type ArchivePage,
  type PulseMetrics,
  type PulseFilter,
} from '../lib/pulse';

const PAGE_SIZE = 100;

export interface UsePulseResult {
  metrics: PulseMetrics | null;
  archive: ArchivePage | null;
  loading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
}

export function usePulse(filter: PulseFilter): UsePulseResult {
  const lastSyncTime = useAppStore((s) => s.lastSyncTime);
  const activeTab = useAppStore((s) => s.view.tab);

  const [metrics, setMetrics] = useState<PulseMetrics | null>(null);
  const [archive, setArchive] = useState<ArchivePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqId = useRef(0);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const [m, a] = await Promise.all([
        getPulseMetrics(filter),
        getArchive(filter, { limit: PAGE_SIZE, offset: 0 }),
      ]);
      if (reqId.current !== my) return;
      setMetrics(m);
      setArchive(a);
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

  const loadMore = useCallback(async () => {
    if (!archive?.hasMore) return;
    const page = await getArchive(filter, {
      limit: PAGE_SIZE,
      offset: archive.rows.length,
    });
    setArchive({ rows: [...archive.rows, ...page.rows], hasMore: page.hasMore });
  }, [archive, filter]);

  return { metrics, archive, loading, error, loadMore };
}
