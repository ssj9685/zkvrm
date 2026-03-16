BEGIN;

ALTER TABLE memos ADD COLUMN pin_color TEXT NOT NULL DEFAULT 'neutral';
ALTER TABLE memo_links ADD COLUMN yarn_color TEXT NOT NULL DEFAULT 'neutral';

UPDATE memos
SET pin_color = tone
WHERE pin_color IS NULL OR trim(pin_color) = '';

UPDATE memo_links
SET yarn_color = 'neutral'
WHERE yarn_color IS NULL OR trim(yarn_color) = '';

CREATE INDEX IF NOT EXISTS idx_memos_user_pin_color
ON memos(user_id, pin_color, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memo_links_user_yarn_color
ON memo_links(user_id, yarn_color);

COMMIT;
