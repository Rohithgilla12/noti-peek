import { fetchArchiveWindow, countArchive, type ArchiveQuery } from '../db';
import type { Notification } from '../types';
import type { PulseFilter } from './reducers';

export interface RowsWindow {
  rows: Array<Notification & { firstSeenAt: string }>;
}

function sinceDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function buildQuery(filter: PulseFilter): ArchiveQuery {
  return {
    since: sinceDaysAgo(30),
    source: filter.source,
    type: filter.type,
    actor: filter.actor,
    repo: filter.repo,
    hour: filter.hour,
  };
}

export async function fetch30DayWindow(filter: PulseFilter): Promise<RowsWindow> {
  const rows = await fetchArchiveWindow({ ...buildQuery(filter), limit: 10_000 });
  return {
    rows: rows.filter(
      (r): r is Notification & { firstSeenAt: string } => typeof r.firstSeenAt === 'string',
    ),
  };
}

export async function fetchArchivePage(
  filter: PulseFilter,
  opts: { limit: number; offset: number },
): Promise<{ rows: Notification[]; hasMore: boolean }> {
  const q: ArchiveQuery = {
    source: filter.source,
    type: filter.type,
    actor: filter.actor,
    repo: filter.repo,
    hour: filter.hour,
    limit: opts.limit,
    offset: opts.offset,
  };
  const [rows, total] = await Promise.all([fetchArchiveWindow(q), countArchive(q)]);
  return { rows, hasMore: opts.offset + rows.length < total };
}
