import type { Notification, NotificationRow } from './types';

/**
 * Preserve the user's local "read" intent across syncs.
 *
 * Providers are eventually consistent — right after the app calls
 * mark-as-read, GET /notifications can still return `unread: true` for the
 * same threads. The sync used to clobber the local state. This helper merges
 * incoming notifications against the cached list: if a notification was read
 * locally AND `updatedAt` has not advanced, keep it read. Genuine new activity
 * (newer updatedAt) still flips it back to unread.
 *
 * Applies to both the flat `notifications` array AND the `rows[]` envelope —
 * otherwise the row-rendered UI shows everything as unread even though the
 * flat list is correct.
 */

export type ExistingByIdMap = Map<string, Notification>;

export function buildExistingById(existing: Notification[]): ExistingByIdMap {
  return new Map(existing.map((n) => [n.id, n]));
}

export function preserveOne(n: Notification, existingById: ExistingByIdMap): Notification {
  const prev = existingById.get(n.id);
  if (!prev || prev.unread) return n;
  const prevMs = new Date(prev.updatedAt).getTime();
  const incomingMs = new Date(n.updatedAt).getTime();
  if (incomingMs <= prevMs) return { ...n, unread: false };
  return n;
}

export function preserveMany(
  incoming: Notification[],
  existingById: ExistingByIdMap,
): Notification[] {
  return incoming.map((n) => preserveOne(n, existingById));
}

export function preserveRow(
  row: NotificationRow,
  existingById: ExistingByIdMap,
): NotificationRow {
  if (row.kind === 'single') {
    return { kind: 'single', notification: preserveOne(row.notification, existingById) };
  }
  const children = row.bundle.children.map((c) => preserveOne(c, existingById));
  const unread_count = children.filter((c) => c.unread).length;
  if (row.kind === 'bundle') {
    return { kind: 'bundle', bundle: { ...row.bundle, children, unread_count } };
  }
  return { kind: 'cross_bundle', bundle: { ...row.bundle, children, unread_count } };
}

export function preserveRows(
  rows: NotificationRow[],
  existingById: ExistingByIdMap,
): NotificationRow[] {
  return rows.map((r) => preserveRow(r, existingById));
}
