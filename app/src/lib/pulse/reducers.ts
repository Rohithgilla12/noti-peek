import type { Notification, Provider } from '../types';

export interface PulseFilter {
  source?: Provider;
  type?: string;
  actor?: string;
  repo?: string;
  hour?: number;
}

export interface SourceSlice {
  source: Provider;
  count: number;
  pct: number;
}

export interface TypeSlice {
  type: string;
  count: number;
  pct: number;
}

export interface ActorSlice {
  name: string;
  avatar?: string;
  count: number;
}

export interface RepoSlice {
  repo: string;
  count: number;
}

export interface DayBucket {
  date: string;
  count: number;
}

export interface DaySourceBucket {
  date: string;
  total: number;
  counts: Record<Provider, number>;
}

export interface StreakStats {
  longestStreak: number;
  currentStreak: number;
  busiestDay: { date: string; count: number } | null;
  quietDays: number;
}

export interface WeeklyDelta {
  thisWeek: number;
  lastWeek: number;
  deltaPct: number;
}

export interface PeakBurst {
  startsAt: string;
  count: number;
  hourLabel: string;
}

type RowWithFirstSeen = Notification & { firstSeenAt: string };

const DAY_MS = 86_400_000;

function startOfDay(t: number | Date): number {
  const d = t instanceof Date ? t : new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function volumeStats(
  rows: RowWithFirstSeen[],
  now: Date,
): { volumeToday: number; volumeAvg30: number } {
  const startOfToday = startOfDay(now);
  const startOfTomorrow = startOfToday + DAY_MS;
  const thirtyDaysAgo = now.getTime() - 30 * DAY_MS;

  let today = 0;
  let last30 = 0;
  for (const r of rows) {
    const t = new Date(r.firstSeenAt).getTime();
    if (t >= startOfToday && t < startOfTomorrow) today += 1;
    if (t >= thirtyDaysAgo) last30 += 1;
  }
  return { volumeToday: today, volumeAvg30: Math.round(last30 / 30) };
}

export function hourBuckets(rows: RowWithFirstSeen[]): number[] {
  const b = new Array(24).fill(0);
  for (const r of rows) {
    const h = new Date(r.firstSeenAt).getHours();
    b[h] += 1;
  }
  return b;
}

export function mostActiveHour(buckets: number[]): number | null {
  if (buckets.every((b) => b === 0)) return null;
  let max = 0;
  let maxHour = 0;
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] > max) {
      max = buckets[i];
      maxHour = i;
    }
  }
  return maxHour;
}

export function sourceBreakdown(rows: RowWithFirstSeen[]): SourceSlice[] {
  if (rows.length === 0) return [];
  const counts = new Map<Provider, number>();
  for (const r of rows) counts.set(r.source, (counts.get(r.source) ?? 0) + 1);
  const total = rows.length;
  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

export function typeBreakdown(rows: RowWithFirstSeen[]): TypeSlice[] {
  if (rows.length === 0) return [];
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  const total = rows.length;
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export function topActors(rows: RowWithFirstSeen[], limit: number): ActorSlice[] {
  const m = new Map<string, ActorSlice>();
  for (const r of rows) {
    const name = r.author?.name;
    if (!name) continue;
    const cur = m.get(name);
    if (cur) cur.count += 1;
    else m.set(name, { name, avatar: r.author?.avatar, count: 1 });
  }
  return Array.from(m.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function topRepos(rows: RowWithFirstSeen[], limit: number): RepoSlice[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const label = r.repo ?? r.project;
    if (!label) continue;
    m.set(label, (m.get(label) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count || a.repo.localeCompare(b.repo))
    .slice(0, limit);
}

export function dailyBuckets(
  rows: RowWithFirstSeen[],
  days: number,
  now: Date,
): DayBucket[] {
  const todayStart = startOfDay(now);
  const out: DayBucket[] = [];
  const index = new Map<number, number>();
  for (let i = days - 1; i >= 0; i--) {
    const ms = todayStart - i * DAY_MS;
    index.set(ms, out.length);
    out.push({ date: fmtDate(ms), count: 0 });
  }
  for (const r of rows) {
    const ms = startOfDay(new Date(r.firstSeenAt));
    const idx = index.get(ms);
    if (idx === undefined) continue;
    out[idx].count += 1;
  }
  return out;
}

export function dailyBySource(
  rows: RowWithFirstSeen[],
  days: number,
  now: Date,
): DaySourceBucket[] {
  const todayStart = startOfDay(now);
  const out: DaySourceBucket[] = [];
  const index = new Map<number, number>();
  for (let i = days - 1; i >= 0; i--) {
    const ms = todayStart - i * DAY_MS;
    index.set(ms, out.length);
    out.push({
      date: fmtDate(ms),
      total: 0,
      counts: { github: 0, linear: 0, jira: 0, bitbucket: 0 },
    });
  }
  for (const r of rows) {
    const ms = startOfDay(new Date(r.firstSeenAt));
    const idx = index.get(ms);
    if (idx === undefined) continue;
    out[idx].counts[r.source] += 1;
    out[idx].total += 1;
  }
  return out;
}

export function weekHourMatrix(rows: RowWithFirstSeen[]): number[][] {
  const m: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const r of rows) {
    const d = new Date(r.firstSeenAt);
    const dow = (d.getDay() + 6) % 7;
    m[dow][d.getHours()] += 1;
  }
  return m;
}

export function actorSparklines(
  rows: RowWithFirstSeen[],
  names: string[],
  days: number,
  now: Date,
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  if (names.length === 0) return result;
  const todayStart = startOfDay(now);
  const wanted = new Set(names);
  for (const name of names) result[name] = new Array(days).fill(0);
  for (const r of rows) {
    const name = r.author?.name;
    if (!name || !wanted.has(name)) continue;
    const ms = startOfDay(new Date(r.firstSeenAt));
    const offset = Math.floor((todayStart - ms) / DAY_MS);
    if (offset < 0 || offset >= days) continue;
    result[name][days - 1 - offset] += 1;
  }
  return result;
}

export function repoSparklines(
  rows: RowWithFirstSeen[],
  repos: string[],
  days: number,
  now: Date,
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  if (repos.length === 0) return result;
  const todayStart = startOfDay(now);
  const wanted = new Set(repos);
  for (const repo of repos) result[repo] = new Array(days).fill(0);
  for (const r of rows) {
    const label = r.repo ?? r.project;
    if (!label || !wanted.has(label)) continue;
    const ms = startOfDay(new Date(r.firstSeenAt));
    const offset = Math.floor((todayStart - ms) / DAY_MS);
    if (offset < 0 || offset >= days) continue;
    result[label][days - 1 - offset] += 1;
  }
  return result;
}

export function streakStats(buckets: DayBucket[]): StreakStats {
  if (buckets.length === 0) {
    return { longestStreak: 0, currentStreak: 0, busiestDay: null, quietDays: 0 };
  }
  let longest = 0;
  let run = 0;
  let busiest: { date: string; count: number } | null = null;
  let quiet = 0;
  for (const b of buckets) {
    if (b.count === 0) {
      quiet += 1;
      run = 0;
    } else {
      run += 1;
      if (run > longest) longest = run;
    }
    if (!busiest || b.count > busiest.count) {
      busiest = { date: b.date, count: b.count };
    }
  }
  let current = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i].count > 0) current += 1;
    else break;
  }
  if (busiest && busiest.count === 0) busiest = null;
  return { longestStreak: longest, currentStreak: current, busiestDay: busiest, quietDays: quiet };
}

export function weeklyDelta(rows: RowWithFirstSeen[], now: Date): WeeklyDelta {
  const todayStart = startOfDay(now);
  const startOfThisWeek = todayStart - 6 * DAY_MS;
  const startOfLastWeek = todayStart - 13 * DAY_MS;
  let thisWeek = 0;
  let lastWeek = 0;
  for (const r of rows) {
    const ms = new Date(r.firstSeenAt).getTime();
    if (ms >= startOfThisWeek && ms < todayStart + DAY_MS) thisWeek += 1;
    else if (ms >= startOfLastWeek && ms < startOfThisWeek) lastWeek += 1;
  }
  const deltaPct =
    lastWeek === 0
      ? thisWeek === 0
        ? 0
        : 100
      : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  return { thisWeek, lastWeek, deltaPct };
}

export function peakBurst(rows: RowWithFirstSeen[]): PeakBurst | null {
  if (rows.length === 0) return null;
  const buckets = new Map<number, number>();
  for (const r of rows) {
    const d = new Date(r.firstSeenAt);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  let bestKey = 0;
  let bestCount = 0;
  for (const [k, c] of buckets.entries()) {
    if (c > bestCount) {
      bestCount = c;
      bestKey = k;
    }
  }
  if (bestCount === 0) return null;
  const d = new Date(bestKey);
  const hourLabel = `${String(d.getHours()).padStart(2, '0')}:00`;
  return { startsAt: d.toISOString(), count: bestCount, hourLabel };
}
