ALTER TABLE memos ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'));
