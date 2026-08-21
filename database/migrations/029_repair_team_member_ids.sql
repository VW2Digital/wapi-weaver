-- Migration 029: repair memberships written by legacy code without the required id.
-- INSERT IGNORE could coerce the first missing id to an empty string and silently
-- discard later memberships because id is the primary key.

UPDATE team_members
SET id = UUID()
WHERE id = '';
