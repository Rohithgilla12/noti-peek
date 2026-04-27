import { create } from 'zustand';
import type { PulseFilter } from '../lib/pulse';

interface PulseState {
  filter: PulseFilter;
  setFilter: (patch: PulseFilter) => void;
  clearFilter: () => void;
}

const EMPTY: PulseFilter = {};

export const usePulseStore = create<PulseState>((set, get) => ({
  filter: EMPTY,
  setFilter: (patch) => set({ filter: { ...get().filter, ...patch } }),
  clearFilter: () => set({ filter: EMPTY }),
}));

export function isFilterActive(f: PulseFilter): boolean {
  return !!(f.source || f.type || f.actor || f.repo || typeof f.hour === 'number');
}

export function describeFilter(f: PulseFilter): string {
  if (f.source) return f.source;
  if (f.type) return f.type;
  if (f.actor) return `@${f.actor}`;
  if (f.repo) return f.repo;
  if (typeof f.hour === 'number') return `${String(f.hour).padStart(2, '0')}:00`;
  return '';
}
