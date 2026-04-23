import { describe, it, expect } from 'vitest';
import type { Notification, NotificationRow, BundleResponse, CrossBundleResponse } from './types';
import {
  buildExistingById,
  preserveOne,
  preserveMany,
  preserveRow,
  preserveRows,
} from './preserve-read';

function notif(o: Partial<Notification> & Pick<Notification, 'id' | 'source' | 'url' | 'title' | 'unread' | 'updatedAt'>): Notification {
  return {
    type: 'pr',
    body: undefined,
    author: { name: 'alice' },
    createdAt: o.updatedAt,
    ...o,
  };
}

const T1 = '2026-04-22T10:00:00.000Z';
const T2 = '2026-04-22T11:00:00.000Z'; // newer than T1

describe('preserveOne', () => {
  it('keeps incoming when there is no prior cache entry', () => {
    const map = buildExistingById([]);
    const incoming = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 });
    expect(preserveOne(incoming, map).unread).toBe(true);
  });

  it('keeps incoming when local state was unread (nothing to preserve)', () => {
    const prev = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 });
    const incoming = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 });
    expect(preserveOne(incoming, buildExistingById([prev])).unread).toBe(true);
  });

  it('preserves read state when local was read and updatedAt has not advanced', () => {
    const prev = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: false, updatedAt: T1 });
    const incoming = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 });
    expect(preserveOne(incoming, buildExistingById([prev])).unread).toBe(false);
  });

  it('also preserves when incoming updatedAt is older than local', () => {
    const prev = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: false, updatedAt: T2 });
    const incoming = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 });
    expect(preserveOne(incoming, buildExistingById([prev])).unread).toBe(false);
  });

  it('flips back to unread when incoming updatedAt has advanced (genuine new activity)', () => {
    const prev = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: false, updatedAt: T1 });
    const incoming = notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T2 });
    expect(preserveOne(incoming, buildExistingById([prev])).unread).toBe(true);
  });
});

describe('preserveMany', () => {
  it('preserves each notification independently', () => {
    const prev = [
      notif({ id: 'a', source: 'github', url: 'u', title: 't', unread: false, updatedAt: T1 }),
      notif({ id: 'b', source: 'github', url: 'u', title: 't', unread: true,  updatedAt: T1 }),
    ];
    const incoming = [
      notif({ id: 'a', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 }),
      notif({ id: 'b', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 }),
    ];
    const out = preserveMany(incoming, buildExistingById(prev));
    expect(out.find((n) => n.id === 'a')?.unread).toBe(false); // preserved
    expect(out.find((n) => n.id === 'b')?.unread).toBe(true);  // untouched
  });
});

describe('preserveRow', () => {
  it('preserves a single-row notification', () => {
    const prev = [notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: false, updatedAt: T1 })];
    const row: NotificationRow = {
      kind: 'single',
      notification: notif({ id: 'n1', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 }),
    };
    const out = preserveRow(row, buildExistingById(prev));
    expect(out.kind).toBe('single');
    if (out.kind === 'single') {
      expect(out.notification.unread).toBe(false);
    }
  });

  it('preserves bundle children and recomputes unread_count', () => {
    const prev = [
      notif({ id: 'c1', source: 'github', url: 'u1', title: 't', unread: false, updatedAt: T1 }),
      notif({ id: 'c2', source: 'github', url: 'u2', title: 't', unread: true,  updatedAt: T1 }),
    ];
    const bundle: BundleResponse = {
      id: 'b', source: 'github', thread_key: 'x', title: 'x', url: 'x',
      event_count: 2, unread_count: 2,
      actors: [{ name: 'alice' }], extra_actor_count: 0,
      type_summary: { pr: 2 },
      latest_at: T1, earliest_at: T1,
      children: [
        notif({ id: 'c1', source: 'github', url: 'u1', title: 't', unread: true, updatedAt: T1 }),
        notif({ id: 'c2', source: 'github', url: 'u2', title: 't', unread: true, updatedAt: T1 }),
      ],
    };
    const out = preserveRow({ kind: 'bundle', bundle }, buildExistingById(prev));
    expect(out.kind).toBe('bundle');
    if (out.kind === 'bundle') {
      const c1 = out.bundle.children.find((c) => c.id === 'c1');
      const c2 = out.bundle.children.find((c) => c.id === 'c2');
      expect(c1?.unread).toBe(false);
      expect(c2?.unread).toBe(true);
      expect(out.bundle.unread_count).toBe(1);
    }
  });

  it('preserves cross-bundle children and recomputes unread_count', () => {
    const prev = [
      notif({ id: 'g1', source: 'github', url: 'u1', title: 't', unread: false, updatedAt: T1 }),
      notif({ id: 'l1', source: 'linear', url: 'u2', title: 't', unread: false, updatedAt: T1 }),
    ];
    const bundle: CrossBundleResponse = {
      id: 'xb', pair: 'linear-github',
      primary: { source: 'linear', key: 'LIN-1', title: 'x', url: 'u' },
      linked: [{ source: 'github', ref: 'o/r#1', url: 'u', signal: 'strict' }],
      event_count: 2, unread_count: 2,
      actors: [{ name: 'alice' }], extra_actor_count: 0,
      type_summary: { pr: 1, comment: 1 }, source_summary: { github: 1, linear: 1 },
      latest_at: T1, earliest_at: T1,
      children: [
        notif({ id: 'g1', source: 'github', url: 'u1', title: 't', unread: true, updatedAt: T1 }),
        notif({ id: 'l1', source: 'linear', url: 'u2', title: 't', unread: true, updatedAt: T1 }),
      ],
    };
    const out = preserveRow({ kind: 'cross_bundle', bundle }, buildExistingById(prev));
    expect(out.kind).toBe('cross_bundle');
    if (out.kind === 'cross_bundle') {
      expect(out.bundle.children.every((c) => !c.unread)).toBe(true);
      expect(out.bundle.unread_count).toBe(0);
    }
  });
});

describe('preserveRows', () => {
  it('maps across a mixed row list', () => {
    const prev = [
      notif({ id: 'a', source: 'github', url: 'u', title: 't', unread: false, updatedAt: T1 }),
    ];
    const rows: NotificationRow[] = [
      {
        kind: 'single',
        notification: notif({ id: 'a', source: 'github', url: 'u', title: 't', unread: true, updatedAt: T1 }),
      },
    ];
    const out = preserveRows(rows, buildExistingById(prev));
    expect(out[0].kind).toBe('single');
    if (out[0].kind === 'single') {
      expect(out[0].notification.unread).toBe(false);
    }
  });
});
