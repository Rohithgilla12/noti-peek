-- Cross-provider link graph. One row per confirmed pairing (either strict-
-- inferred by the backend or user-confirmed from a fuzzy suggestion).
CREATE TABLE work_links (
  user_id        TEXT NOT NULL,
  pair           TEXT NOT NULL CHECK (pair IN ('linear-github','jira-bitbucket')),
  primary_key    TEXT NOT NULL,
  linked_ref     TEXT NOT NULL,
  signal         TEXT NOT NULL CHECK (signal IN ('strict','confirmed-fuzzy')),
  strict_source  TEXT,
  confirmed_at   TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, pair, primary_key, linked_ref)
);

CREATE INDEX work_links_user_pair_idx ON work_links(user_id, pair);

-- User decisions on fuzzy suggestions. `confirmed` rows mirror the work_links
-- insert so we can measure acceptance rate without joining the full link store.
CREATE TABLE suggestion_decisions (
  user_id       TEXT NOT NULL,
  pair          TEXT NOT NULL,
  primary_key   TEXT NOT NULL,
  linked_ref    TEXT NOT NULL,
  decision      TEXT NOT NULL CHECK (decision IN ('dismissed','confirmed')),
  decided_at    TEXT NOT NULL,
  PRIMARY KEY (user_id, pair, primary_key, linked_ref)
);
