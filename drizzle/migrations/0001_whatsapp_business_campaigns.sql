-- Migration: WhatsApp Business API and Marketing Campaigns
-- Created: 2024-12-16

-- WhatsApp Business API accounts table
CREATE TABLE IF NOT EXISTS `whatsapp_business_accounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone_number_id` varchar(100) NOT NULL,
  `business_account_id` varchar(100) NOT NULL,
  `access_token` text NOT NULL,
  `webhook_verify_token` varchar(255),
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `whatsapp_business_accounts_id` PRIMARY KEY(`id`)
);

-- Marketing campaigns table
CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `business_account_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `template_name` varchar(255) NOT NULL,
  `template_language` varchar(10) NOT NULL DEFAULT 'pt_BR',
  `template_variables` text,
  `header_media_url` text,
  `status` enum('draft','scheduled','running','paused','completed','failed') NOT NULL DEFAULT 'draft',
  `scheduled_at` timestamp,
  `started_at` timestamp,
  `completed_at` timestamp,
  `total_recipients` int NOT NULL DEFAULT 0,
  `sent_count` int NOT NULL DEFAULT 0,
  `delivered_count` int NOT NULL DEFAULT 0,
  `read_count` int NOT NULL DEFAULT 0,
  `failed_count` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);

-- Campaign recipients table
CREATE TABLE IF NOT EXISTS `campaign_recipients` (
  `id` int AUTO_INCREMENT NOT NULL,
  `campaign_id` int NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `name` varchar(255),
  `variables` text,
  `status` enum('pending','sent','delivered','read','failed') NOT NULL DEFAULT 'pending',
  `whatsapp_message_id` varchar(255),
  `error_message` text,
  `sent_at` timestamp,
  `delivered_at` timestamp,
  `read_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `campaign_recipients_id` PRIMARY KEY(`id`)
);

-- WhatsApp message templates cache table
CREATE TABLE IF NOT EXISTS `whatsapp_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `business_account_id` int NOT NULL,
  `template_id` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `language` varchar(10) NOT NULL,
  `category` varchar(50) NOT NULL,
  `status` varchar(50) NOT NULL,
  `components` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `whatsapp_templates_id` PRIMARY KEY(`id`),
  CONSTRAINT `whatsapp_templates_unique` UNIQUE(`business_account_id`, `template_id`)
);

-- Add indexes for better query performance
CREATE INDEX `idx_campaigns_user_id` ON `campaigns` (`user_id`);
CREATE INDEX `idx_campaigns_status` ON `campaigns` (`status`);
CREATE INDEX `idx_campaign_recipients_campaign_id` ON `campaign_recipients` (`campaign_id`);
CREATE INDEX `idx_campaign_recipients_status` ON `campaign_recipients` (`status`);
CREATE INDEX `idx_whatsapp_templates_business_account_id` ON `whatsapp_templates` (`business_account_id`);
CREATE INDEX `idx_whatsapp_business_accounts_user_id` ON `whatsapp_business_accounts` (`user_id`);
