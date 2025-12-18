-- Fix contact_lists table if it exists with wrong structure

-- Check if table exists and fix it
-- If table doesn't exist, run 0008_contact_lists.sql first

-- Drop table if exists (WARNING: This will delete all data!)
-- DROP TABLE IF EXISTS `contact_list_items`;
-- DROP TABLE IF EXISTS `contact_lists`;

-- Recreate with correct structure
CREATE TABLE IF NOT EXISTS `contact_lists` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `company` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `total_contacts` int NOT NULL DEFAULT 0,
  `invalid_contacts` int NOT NULL DEFAULT 0,
  `opted_out_contacts` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `contact_lists_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `contact_list_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `list_id` int NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `custom_fields` text DEFAULT NULL,
  `status` enum('active','invalid','opted_out','spam_reported') NOT NULL DEFAULT 'active',
  `opted_out_at` timestamp NULL DEFAULT NULL,
  `opted_out_reason` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `contact_list_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `contact_list_items_list_id_phone_number_unique` UNIQUE(`list_id`, `phone_number`)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS `idx_contact_lists_user_id` ON `contact_lists` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_contact_list_items_list_id` ON `contact_list_items` (`list_id`);
CREATE INDEX IF NOT EXISTS `idx_contact_list_items_status` ON `contact_list_items` (`status`);
CREATE INDEX IF NOT EXISTS `idx_contact_list_items_phone` ON `contact_list_items` (`phone_number`);
