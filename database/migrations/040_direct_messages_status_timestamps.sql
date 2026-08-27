-- Adiciona timestamps de transição de status em direct_messages.
ALTER TABLE `direct_messages`
  ADD COLUMN `delivered_at` datetime DEFAULT NULL,
  ADD COLUMN `read_at` datetime DEFAULT NULL,
  ADD COLUMN `failed_at` datetime DEFAULT NULL;
