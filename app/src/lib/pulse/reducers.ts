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

type RowWithFirstSeen = Notification & { firstSeenAt: string };

export function volumeStats(
  rows: RowWithFirstSeen[],
  now: Date,
): { volumeToday: number; volumeAvg30: number } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTomorrow = startOfToday + 86_400_000;
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;

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
