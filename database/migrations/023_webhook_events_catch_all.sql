ALTER TABLE incoming_webhook_events
  MODIFY COLUMN status
    ENUM('received', 'processing', 'processed', 'success', 'failed', 'parse_error', 'error')
    NOT NULL DEFAULT 'received';

UPDATE incoming_webhook_events SET status = 'processed' WHERE status = 'success';
UPDATE incoming_webhook_events SET status = 'received' WHERE status = 'processing';
UPDATE incoming_webhook_events SET status = 'error' WHERE status = 'failed';

ALTER TABLE incoming_webhook_events
  MODIFY COLUMN status
    ENUM('received', 'processed', 'parse_error', 'error')
    NOT NULL DEFAULT 'received';
