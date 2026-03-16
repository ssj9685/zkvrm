BEGIN;

ALTER TABLE memos ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled note';
ALTER TABLE memos ADD COLUMN tone TEXT NOT NULL DEFAULT 'neutral';
ALTER TABLE memos ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memos ADD COLUMN updated_at INTEGER;
ALTER TABLE memos ADD COLUMN archived_at INTEGER;

UPDATE memos
SET created_at = created_at * 1000
WHERE created_at IS NOT NULL
  AND created_at > 0
  AND created_at < 100000000000;

UPDATE memos
SET created_at = (strftime('%s', 'now') * 1000)
WHERE created_at IS NULL OR created_at <= 0;

UPDATE memos
SET updated_at = created_at
WHERE updated_at IS NULL OR updated_at <= 0;

CREATE INDEX IF NOT EXISTS idx_memos_user_updated_at
ON memos(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memos_user_pinned_updated_at
ON memos(user_id, is_pinned, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memos_user_tone_updated_at
ON memos(user_id, tone, updated_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, name),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS memo_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  memo_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, memo_id, tag_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(memo_id) REFERENCES memos(id),
  FOREIGN KEY(tag_id) REFERENCES tags(id)
);

CREATE INDEX IF NOT EXISTS idx_memo_tags_user_memo
ON memo_tags(user_id, memo_id);

CREATE INDEX IF NOT EXISTS idx_memo_tags_user_tag
ON memo_tags(user_id, tag_id);

CREATE TABLE IF NOT EXISTS memo_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_memo_id INTEGER NOT NULL,
  target_memo_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, source_memo_id, target_memo_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(source_memo_id) REFERENCES memos(id),
  FOREIGN KEY(target_memo_id) REFERENCES memos(id)
);

CREATE INDEX IF NOT EXISTS idx_memo_links_user_target
ON memo_links(user_id, target_memo_id);

CREATE INDEX IF NOT EXISTS idx_memo_links_user_source
ON memo_links(user_id, source_memo_id);

COMMIT;
