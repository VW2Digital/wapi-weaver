-- ==============================================================================
-- BLIV CRM / WAPI WEAVER - MIGRATION 005: LEGACY CONTACT CUSTOM FIELDS FIX
-- ==============================================================================
-- NOTA: Arquivo em SQL puro, sem comandos DELIMITER ou procedimentos armazenados.
-- Garantir que contact_custom_fields possui chave primaria 'id' de forma segura.
-- ==============================================================================

SET @has_id = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'contact_custom_fields'
    AND COLUMN_NAME = 'id'
);

SET @sql_add_id = IF(@has_id = 0,
  'ALTER TABLE contact_custom_fields ADD COLUMN id VARCHAR(36) NULL FIRST',
  'SELECT 1'
);
PREPARE stmt_add_id FROM @sql_add_id;
EXECUTE stmt_add_id;
DEALLOCATE PREPARE stmt_add_id;

UPDATE contact_custom_fields SET id = (SELECT UUID()) WHERE id IS NULL OR id = '';

SET @has_pk = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'contact_custom_fields'
    AND CONSTRAINT_TYPE = 'PRIMARY KEY'
);

SET @sql_drop_pk = IF(@has_pk > 0 AND @has_id = 0,
  'ALTER TABLE contact_custom_fields DROP PRIMARY KEY',
  'SELECT 1'
);
PREPARE stmt_drop_pk FROM @sql_drop_pk;
EXECUTE stmt_drop_pk;
DEALLOCATE PREPARE stmt_drop_pk;

SET @sql_set_pk = IF(@has_id = 0,
  'ALTER TABLE contact_custom_fields MODIFY COLUMN id VARCHAR(36) NOT NULL, ADD PRIMARY KEY (id)',
  'SELECT 1'
);
PREPARE stmt_set_pk FROM @sql_set_pk;
EXECUTE stmt_set_pk;
DEALLOCATE PREPARE stmt_set_pk;

SET @has_fk = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'contact_custom_field_values'
    AND CONSTRAINT_NAME = 'contact_custom_field_values_ibfk_3'
);

SET @sql_add_fk = IF(@has_fk = 0,
  'ALTER TABLE contact_custom_field_values ADD CONSTRAINT contact_custom_field_values_ibfk_3 FOREIGN KEY (custom_field_id) REFERENCES contact_custom_fields(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_add_fk FROM @sql_add_fk;
EXECUTE stmt_add_fk;
DEALLOCATE PREPARE stmt_add_fk;
