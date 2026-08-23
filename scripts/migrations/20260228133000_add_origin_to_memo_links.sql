BEGIN;

ALTER TABLE memo_links ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';

UPDATE memo_links
SET origin = 'manual'
WHERE origin IS NULL OR trim(origin) = '';

CREATE INDEX IF NOT EXISTS idx_memo_links_user_source_origin
ON memo_links(user_id, source_memo_id, origin);

COMMIT;
