-- Migration 023: Expande o ENUM de status em incoming_webhook_events
-- para suportar a arquitetura Catch-All (estilo n8n).
-- Fase intermediária evita perda dos registros legados com status `success`.
ALTER TABLE incoming_webhook_events
  MODIFY COLUMN status
    ENUM('received', 'processed', 'success', 'parse_error', 'error')
    NOT NULL DEFAULT 'received';

UPDATE incoming_webhook_events SET status = 'processed' WHERE status = 'success';

ALTER TABLE incoming_webhook_events
  MODIFY COLUMN status
    ENUM('received', 'processed', 'parse_error', 'error')
    NOT NULL DEFAULT 'received';
