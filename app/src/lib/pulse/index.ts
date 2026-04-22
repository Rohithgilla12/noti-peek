import type { Notification, Provider } from '../types';
import {
  hourBuckets,
  sourceBreakdown,
  typeBreakdown,
  mostActiveHour,
  topActors,
  topRepos,
  volumeStats,
  type PulseFilter,
  type SourceSlice,
  type TypeSlice,
  type ActorSlice,
  type RepoSlice,
} from './reducers';
import { fetch30DayWindow, fetchArchivePage } from './queries';

export type { PulseFilter } from './reducers';

export interface PulseMetrics {
  volumeToday: number;
  volumeAvg30: number;
  hourBuckets: number[];
  mostActiveHour: number | null;
  bySource: SourceSlice[];
  byType: TypeSlice[];
  byActor: ActorSlice[];
  byRepo: RepoSlice[];
}

export interface ArchivePage {
  rows: Notification[];
  hasMore: boolean;
}

export async function getPulseMetrics(filter: PulseFilter): Promise<PulseMetrics> {
  const { rows } = await fetch30DayWindow(filter);
  const now = new Date();
  const { volumeToday, volumeAvg30 } = volumeStats(rows, now);
  const buckets = hourBuckets(rows);
  return {
    volumeToday,
    volumeAvg30,
    hourBuckets: buckets,
    mostActiveHour: mostActiveHour(buckets),
    bySource: sourceBreakdown(rows),
    byType: typeBreakdown(rows),
    byActor: topActors(rows, 5),
    byRepo: topRepos(rows, 5),
  };
}

export async function getArchive(
  filter: PulseFilter,
  opts: { limit: number; offset: number },
): Promise<ArchivePage> {
  return fetchArchivePage(filter, opts);
}

export const PULSE_SOURCES: Provider[] = ['github', 'linear', 'jira', 'bitbucket'];
