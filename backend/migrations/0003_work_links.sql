-- Cross-provider link graph. One row per confirmed pairing (either strict-
-- inferred by the backend or user-confirmed from a fuzzy suggestion).
CREATE TABLE IF NOT EXISTS work_links (
  user_id        TEXT NOT NULL,
  pair           TEXT NOT NULL CHECK (pair IN ('linear-github','jira-bitbucket')),
  primary_key    TEXT NOT NULL,
  linked_ref     TEXT NOT NULL,
  signal         TEXT NOT NULL CHECK (signal IN ('strict','confirmed-fuzzy')),
  strict_source  TEXT,
  confirmed_at   DATETIME NOT NULL,
  last_seen_at   DATETIME NOT NULL,
  PRIMARY KEY (user_id, pair, primary_key, linked_ref),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_links_user_pair ON work_links(user_id, pair);

-- User decisions on fuzzy suggestions. `confirmed` rows mirror the work_links
-- insert so we can measure acceptance rate without joining the full link store.
CREATE TABLE IF NOT EXISTS suggestion_decisions (
  user_id       TEXT NOT NULL,
  pair          TEXT NOT NULL CHECK (pair IN ('linear-github','jira-bitbucket')),
  primary_key   TEXT NOT NULL,
  linked_ref    TEXT NOT NULL,
  decision      TEXT NOT NULL CHECK (decision IN ('dismissed','confirmed')),
  decided_at    DATETIME NOT NULL,
  PRIMARY KEY (user_id, pair, primary_key, linked_ref),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
