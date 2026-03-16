BEGIN;

ALTER TABLE memos ADD COLUMN brain_x REAL;
ALTER TABLE memos ADD COLUMN brain_y REAL;

CREATE INDEX IF NOT EXISTS idx_memos_user_brain_position
ON memos(user_id, brain_x, brain_y);

COMMIT;
