ALTER TABLE webchat_widgets
  ADD COLUMN avatar_url VARCHAR(512) NULL
  AFTER prechat_enabled;
