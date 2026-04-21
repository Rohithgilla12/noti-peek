import type { Notification, Provider } from '../types';
import {
  hourBuckets,
  sourceBreakdown,
  topActors,
  topRepos,
  volumeStats,
  type PulseFilter,
  type SourceSlice,
  type ActorSlice,
  type RepoSlice,
} from './reducers';
import { fetch30DayWindow, fetchArchivePage } from './queries';

export type { PulseFilter } from './reducers';

export interface PulseMetrics {
  volumeToday: number;
  volumeAvg30: number;
  hourBuckets: number[];
  bySource: SourceSlice[];
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
  return {
    volumeToday,
    volumeAvg30,
    hourBuckets: hourBuckets(rows),
    bySource: sourceBreakdown(rows),
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
