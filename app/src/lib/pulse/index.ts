import type { Provider } from '../types';
import {
  actorSparklines,
  dailyBuckets,
  dailyBySource,
  hourBuckets,
  mostActiveHour,
  peakBurst,
  repoSparklines,
  sourceBreakdown,
  streakStats,
  topActors,
  topRepos,
  typeBreakdown,
  volumeStats,
  weekHourMatrix,
  weeklyDelta,
  type ActorSlice,
  type DayBucket,
  type DaySourceBucket,
  type PeakBurst,
  type PulseFilter,
  type RepoSlice,
  type SourceSlice,
  type StreakStats,
  type TypeSlice,
  type WeeklyDelta,
} from './reducers';
import { fetch30DayWindow } from './queries';

export type { PulseFilter } from './reducers';

export interface PulseMetrics {
  total30: number;
  volumeToday: number;
  volumeAvg30: number;
  hourBuckets: number[];
  mostActiveHour: number | null;
  bySource: SourceSlice[];
  byType: TypeSlice[];
  byActor: ActorSlice[];
  byRepo: RepoSlice[];
  daily: DayBucket[];
  dailyBySource: DaySourceBucket[];
  weekHour: number[][];
  actorSpark: Record<string, number[]>;
  repoSpark: Record<string, number[]>;
  streak: StreakStats;
  weekDelta: WeeklyDelta;
  peak: PeakBurst | null;
}

const ACTOR_LIMIT = 6;
const REPO_LIMIT = 6;
const SPARK_DAYS = 14;
const WINDOW_DAYS = 30;

export async function getPulseMetrics(filter: PulseFilter): Promise<PulseMetrics> {
  const { rows } = await fetch30DayWindow(filter);
  const now = new Date();
  const { volumeToday, volumeAvg30 } = volumeStats(rows, now);
  const buckets = hourBuckets(rows);
  const actors = topActors(rows, ACTOR_LIMIT);
  const repos = topRepos(rows, REPO_LIMIT);
  const daily = dailyBuckets(rows, WINDOW_DAYS, now);
  return {
    total30: rows.length,
    volumeToday,
    volumeAvg30,
    hourBuckets: buckets,
    mostActiveHour: mostActiveHour(buckets),
    bySource: sourceBreakdown(rows),
    byType: typeBreakdown(rows),
    byActor: actors,
    byRepo: repos,
    daily,
    dailyBySource: dailyBySource(rows, WINDOW_DAYS, now),
    weekHour: weekHourMatrix(rows),
    actorSpark: actorSparklines(rows, actors.map((a) => a.name), SPARK_DAYS, now),
    repoSpark: repoSparklines(rows, repos.map((r) => r.repo), SPARK_DAYS, now),
    streak: streakStats(daily),
    weekDelta: weeklyDelta(rows, now),
    peak: peakBurst(rows),
  };
}

export const PULSE_SOURCES: Provider[] = ['github', 'linear', 'jira', 'bitbucket'];
