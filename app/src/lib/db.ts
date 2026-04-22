import Database from '@tauri-apps/plugin-sql';
import type { Notification, Connection, Provider } from './types';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  db = await Database.load('sqlite:noti-peek.db');
  return db;
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

interface NotificationRow {
  id: string;
  source: string;
  type: string;
  title: string;
  body: string | null;
  url: string;
  repo: string | null;
  project: string | null;
  author_name: string;
  author_avatar: string | null;
  unread: number;
  created_at: string;
  updated_at: string;
  first_seen_at: string | null;
}

interface ConnectionRow {
  provider: string;
  account_id: string | null;
  account_name: string | null;
  account_avatar: string | null;
  connected_at: string;
}

interface SyncMetadataRow {
  key: string;
  value: string;
  updated_at: string;
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    source: row.source as Provider,
    type: row.type,
    title: row.title,
    body: row.body ?? undefined,
    url: row.url,
    repo: row.repo ?? undefined,
    project: row.project ?? undefined,
    author: {
      name: row.author_name,
      avatar: row.author_avatar ?? undefined,
    },
    unread: row.unread === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstSeenAt: row.first_seen_at ?? undefined,
  };
}

function rowToConnection(row: ConnectionRow): Connection {
  return {
    provider: row.provider as Provider,
    accountId: row.account_id,
    accountName: row.account_name,
    accountAvatar: row.account_avatar,
    connectedAt: row.connected_at,
  };
}

export async function getCachedNotifications(): Promise<Notification[]> {
  const database = await getDatabase();
  const rows = await database.select<NotificationRow[]>(
    'SELECT * FROM notifications ORDER BY created_at DESC'
  );
  return rows.map(rowToNotification);
}

export async function cacheNotifications(notifications: Notification[]): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  for (const n of notifications) {
    await database.execute(
      `INSERT INTO notifications
         (id, source, type, title, body, url, repo, project,
          author_name, author_avatar, unread,
          created_at, updated_at, cached_at, first_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT(id) DO UPDATE SET
         unread     = excluded.unread,
         updated_at = excluded.updated_at,
         cached_at  = excluded.cached_at,
         title      = excluded.title,
         body       = excluded.body`,
      [
        n.id,
        n.source,
        n.type,
        n.title,
        n.body ?? null,
        n.url,
        n.repo ?? null,
        n.project ?? null,
        n.author.name,
        n.author.avatar ?? null,
        n.unread ? 1 : 0,
        n.createdAt,
        n.updatedAt,
        now,
        now,
      ],
    );
  }

  await setSyncMetadata('lastNotificationSync', now);
}

export async function updateNotificationReadStatus(id: string, unread: boolean): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    'UPDATE notifications SET unread = $1 WHERE id = $2',
    [unread ? 1 : 0, id]
  );
}

export async function markAllNotificationsRead(source?: Provider): Promise<void> {
  const database = await getDatabase();
  if (source) {
    await database.execute(
      'UPDATE notifications SET unread = 0 WHERE source = $1',
      [source]
    );
  } else {
    await database.execute('UPDATE notifications SET unread = 0');
  }
}

export async function getCachedConnections(): Promise<Connection[]> {
  const database = await getDatabase();
  const rows = await database.select<ConnectionRow[]>('SELECT * FROM connections');
  return rows.map(rowToConnection);
}

export async function cacheConnections(connections: Connection[]): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.execute('DELETE FROM connections');

  for (const c of connections) {
    await database.execute(
      `INSERT OR REPLACE INTO connections
       (provider, account_id, account_name, account_avatar, connected_at, cached_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        c.provider,
        c.accountId,
        c.accountName,
        c.accountAvatar,
        c.connectedAt,
        now,
      ]
    );
  }

  await setSyncMetadata('lastConnectionSync', now);
}

export async function getSyncMetadata(key: string): Promise<string | null> {
  const database = await getDatabase();
  const rows = await database.select<SyncMetadataRow[]>(
    'SELECT * FROM sync_metadata WHERE key = $1',
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSyncMetadata(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.execute(
    `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
     VALUES ($1, $2, $3)`,
    [key, value, now]
  );
}

export async function getLastSyncTime(): Promise<Date | null> {
  const value = await getSyncMetadata('lastNotificationSync');
  return value ? new Date(value) : null;
}

export async function clearAllCache(): Promise<void> {
  const database = await getDatabase();
  await database.execute('DELETE FROM notifications');
  await database.execute('DELETE FROM connections');
  await database.execute('DELETE FROM sync_metadata');
}

export interface ArchiveQuery {
  since?: string;
  source?: Provider;
  type?: string;
  actor?: string;
  repo?: string;
  hour?: number;
  limit?: number;
  offset?: number;
}

export async function fetchArchiveWindow(q: ArchiveQuery): Promise<Notification[]> {
  const database = await getDatabase();
  const wheres: string[] = [];
  const params: unknown[] = [];
  if (q.since) {
    wheres.push(`first_seen_at >= $${params.length + 1}`);
    params.push(q.since);
  }
  if (q.source) {
    wheres.push(`source = $${params.length + 1}`);
    params.push(q.source);
  }
  if (q.type) {
    wheres.push(`type = $${params.length + 1}`);
    params.push(q.type);
  }
  if (q.actor) {
    wheres.push(`LOWER(author_name) = LOWER($${params.length + 1})`);
    params.push(q.actor);
  }
  if (q.repo) {
    wheres.push(`LOWER(COALESCE(repo, project, '')) = LOWER($${params.length + 1})`);
    params.push(q.repo);
  }
  if (typeof q.hour === 'number') {
    wheres.push(`strftime('%H', first_seen_at, 'localtime') = $${params.length + 1}`);
    params.push(q.hour.toString().padStart(2, '0'));
  }
  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const limit = q.limit ?? 200;
  const offset = q.offset ?? 0;
  const rows = await database.select<NotificationRow[]>(
    `SELECT * FROM notifications ${where}
     ORDER BY first_seen_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return rows.map(rowToNotification);
}

export async function countArchive(q: ArchiveQuery): Promise<number> {
  const database = await getDatabase();
  const wheres: string[] = [];
  const params: unknown[] = [];
  if (q.since) {
    wheres.push(`first_seen_at >= $${params.length + 1}`);
    params.push(q.since);
  }
  if (q.source) {
    wheres.push(`source = $${params.length + 1}`);
    params.push(q.source);
  }
  if (q.type) {
    wheres.push(`type = $${params.length + 1}`);
    params.push(q.type);
  }
  if (q.actor) {
    wheres.push(`LOWER(author_name) = LOWER($${params.length + 1})`);
    params.push(q.actor);
  }
  if (q.repo) {
    wheres.push(`LOWER(COALESCE(repo, project, '')) = LOWER($${params.length + 1})`);
    params.push(q.repo);
  }
  if (typeof q.hour === 'number') {
    wheres.push(`strftime('%H', first_seen_at, 'localtime') = $${params.length + 1}`);
    params.push(q.hour.toString().padStart(2, '0'));
  }
  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const rows = await database.select<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM notifications ${where}`,
    params,
  );
  return rows[0]?.n ?? 0;
}
