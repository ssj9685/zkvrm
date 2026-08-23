BEGIN;

UPDATE memo_links
SET origin = 'manual'
WHERE origin = 'wiki';

COMMIT;
