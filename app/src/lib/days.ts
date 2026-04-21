export function startOfDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayLabel(ts: number): { label: string; sub: string } {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.round((todayStart - ts) / 86_400_000);
  const d = new Date(ts);
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();

  if (diffDays === 0) return { label: 'Today', sub: `${weekday} · ${date}` };
  if (diffDays === 1) return { label: 'Yesterday', sub: `${weekday} · ${date}` };
  if (diffDays < 7) return { label: weekday, sub: date };
  return { label: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }), sub: date };
}

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (d.getTime() >= todayStart.getTime()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const y = todayStart.getTime() - 86_400_000;
  if (d.getTime() >= y) return 'yd';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
}
