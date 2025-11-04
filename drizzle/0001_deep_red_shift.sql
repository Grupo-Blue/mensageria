CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`platform` enum('whatsapp','telegram') NOT NULL,
	`connection_id` int NOT NULL,
	`recipient` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`media_url` text,
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`error_message` text,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`google_api_key` varchar(255),
	`resume_group_id` varchar(100),
	`resume_group_id_to_send` varchar(100),
	`resume_hour_of_day` int DEFAULT 22,
	`enable_group_resume` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`bot_token` varchar(255) NOT NULL,
	`bot_username` varchar(100),
	`status` enum('connected','disconnected','error') NOT NULL DEFAULT 'disconnected',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`last_connected_at` timestamp,
	CONSTRAINT `telegram_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`identification` varchar(100) NOT NULL,
	`status` enum('connected','disconnected','qr_code','connecting') NOT NULL DEFAULT 'disconnected',
	`qr_code` text,
	`phone_number` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`last_connected_at` timestamp,
	CONSTRAINT `whatsapp_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_connections_identification_unique` UNIQUE(`identification`)
);
