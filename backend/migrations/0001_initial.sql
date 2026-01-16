-- Users (device-based auth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  device_token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Connected accounts (OAuth tokens)
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at DATETIME,
  account_id TEXT,
  account_name TEXT,
  account_avatar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, provider)
);

-- Notification cache
CREATE TABLE IF NOT EXISTS notifications_cache (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  data TEXT NOT NULL,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_provider ON connections(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_notifications_cache_user_id ON notifications_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_cache_provider ON notifications_cache(user_id, provider);
