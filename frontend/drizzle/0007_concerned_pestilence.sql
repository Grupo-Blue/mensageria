CREATE TABLE `campaign_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`phone_number` varchar(20) NOT NULL,
	`name` varchar(255),
	`variables` text,
	`status` enum('pending','sent','delivered','read','failed') NOT NULL DEFAULT 'pending',
	`whatsapp_message_id` varchar(255),
	`error_message` text,
	`retry_count` int NOT NULL DEFAULT 0,
	`last_retry_at` timestamp,
	`sent_at` timestamp,
	`delivered_at` timestamp,
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
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
	`max_retries` int NOT NULL DEFAULT 3,
	`retry_delay_minutes` int NOT NULL DEFAULT 30,
	`auto_retry_enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_business_accounts` (
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
--> statement-breakpoint
CREATE TABLE `whatsapp_templates` (
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
	CONSTRAINT `whatsapp_templates_business_account_id_template_id_unique` UNIQUE(`business_account_id`,`template_id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `api_key` varchar(64);--> statement-breakpoint
ALTER TABLE `whatsapp_connections` ADD `api_key` varchar(64);--> statement-breakpoint
ALTER TABLE `whatsapp_connections` ADD `webhook_url` varchar(500);--> statement-breakpoint
ALTER TABLE `whatsapp_connections` ADD `webhook_secret` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_api_key_unique` UNIQUE(`api_key`);--> statement-breakpoint
ALTER TABLE `whatsapp_connections` ADD CONSTRAINT `whatsapp_connections_api_key_unique` UNIQUE(`api_key`);
