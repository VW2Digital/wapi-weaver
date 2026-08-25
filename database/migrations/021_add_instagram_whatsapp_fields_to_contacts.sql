-- Add Instagram and WhatsApp specific fields to contacts table
-- Migration: 021_add_instagram_whatsapp_fields_to_contacts.sql
-- Description: Add instagram_id and whatsapp_number fields to support Instagram and WhatsApp contact creation

ALTER TABLE `contacts` 
ADD COLUMN `instagram_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Instagram user ID for Instagram contacts' AFTER `normalized_phone`,
ADD COLUMN `whatsapp_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'WhatsApp phone number for WhatsApp contacts' AFTER `instagram_id`,
ADD INDEX `idx_contacts_instagram_id` (`instagram_id`),
ADD INDEX `idx_contacts_whatsapp_number` (`whatsapp_number`);
