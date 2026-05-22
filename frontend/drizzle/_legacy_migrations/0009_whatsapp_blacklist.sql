-- WhatsApp Blacklist table for opt-out management
-- Contacts who respond with SAIR, CANCELAR, etc. are added here

CREATE TABLE IF NOT EXISTS `whatsapp_blacklist` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `business_account_id` int NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `reason` enum('sair', 'cancelar', 'spam_report', 'manual', 'bounce') NOT NULL,
  `original_message` text,
  `opted_out_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_account_phone` (`business_account_id`, `phone_number`),
  INDEX `idx_blacklist_phone` (`phone_number`),
  INDEX `idx_blacklist_account` (`business_account_id`)
);

-- Add index to contact_list_items for faster lookups
CREATE INDEX IF NOT EXISTS `idx_contact_items_phone` ON `contact_list_items` (`phone_number`);
