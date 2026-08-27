-- Remove duplicate chat_sessions keeping the most recently started one per contact.
-- Then adds a UNIQUE constraint on contact_id to prevent future duplicates.

DELETE cs1 FROM chat_sessions cs1
JOIN chat_sessions cs2
  ON cs1.contact_id = cs2.contact_id
  AND (
    cs1.started_at < cs2.started_at
    OR (cs1.started_at = cs2.started_at AND cs1.id > cs2.id)
  );

ALTER TABLE chat_sessions
  ADD UNIQUE KEY `uq_chat_sessions_contact_id` (`contact_id`);
