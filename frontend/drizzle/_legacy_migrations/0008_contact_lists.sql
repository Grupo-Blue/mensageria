-- Migration: Add contact lists tables for managing campaign recipients

-- Contact Lists table
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

-- Contact List Items table
CREATE TABLE IF NOT EXISTS `contact_list_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `list_id` int NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `name` varchar(255),
  `email` varchar(320),
  `custom_fields` text,
  `status` enum('active','invalid','opted_out','spam_reported') NOT NULL DEFAULT 'active',
  `opted_out_at` timestamp,
  `opted_out_reason` varchar(50),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `contact_list_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `contact_list_items_list_id_phone_number_unique` UNIQUE(`list_id`, `phone_number`)
);

-- Add indexes for better query performance
CREATE INDEX `idx_contact_lists_user_id` ON `contact_lists` (`user_id`);
CREATE INDEX `idx_contact_list_items_list_id` ON `contact_list_items` (`list_id`);
CREATE INDEX `idx_contact_list_items_status` ON `contact_list_items` (`status`);
CREATE INDEX `idx_contact_list_items_phone` ON `contact_list_items` (`phone_number`);
