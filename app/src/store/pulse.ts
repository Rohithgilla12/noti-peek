import { create } from 'zustand';
import type { PulseFilter } from '../lib/pulse';

interface PulseState {
  filter: PulseFilter;
  selectedArchiveId: string | null;
  expandedArchiveId: string | null;

  setFilter: (patch: PulseFilter) => void;
  clearFilter: () => void;
  selectArchive: (id: string | null) => void;
  toggleExpand: (id: string) => void;
  collapseExpand: () => void;
}

const EMPTY: PulseFilter = {};

export const usePulseStore = create<PulseState>((set, get) => ({
  filter: EMPTY,
  selectedArchiveId: null,
  expandedArchiveId: null,

  setFilter: (patch) => set({ filter: { ...get().filter, ...patch } }),
  clearFilter: () => set({ filter: EMPTY }),
  selectArchive: (id) => set({ selectedArchiveId: id }),
  toggleExpand: (id) =>
    set((s) => ({ expandedArchiveId: s.expandedArchiveId === id ? null : id })),
  collapseExpand: () => set({ expandedArchiveId: null }),
}));

export function isFilterActive(f: PulseFilter): boolean {
  return !!(f.source || f.actor || f.repo || typeof f.hour === 'number');
}

export function describeFilter(f: PulseFilter): string {
  if (f.source) return f.source;
  if (f.actor) return `@${f.actor}`;
  if (f.repo) return f.repo;
  if (typeof f.hour === 'number') return `${String(f.hour).padStart(2, '0')}:00`;
  return '';
}
