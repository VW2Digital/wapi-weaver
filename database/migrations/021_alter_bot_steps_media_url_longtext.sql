-- Migration: 021_alter_bot_steps_media_url_longtext.sql
-- Description: Modify bot_steps.media_url to LONGTEXT to allow storing base64 media data URLs in bot flow steps without data truncation errors.

ALTER TABLE `bot_steps` MODIFY COLUMN `media_url` LONGTEXT NULL;
