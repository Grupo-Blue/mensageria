CREATE TABLE `webhook_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`webhook_url` varchar(500) NOT NULL,
	`webhook_secret` varchar(255) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`connection_name` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhook_config_id` int NOT NULL,
	`from` varchar(50) NOT NULL,
	`message_id` varchar(255) NOT NULL,
	`text` text NOT NULL,
	`status` enum('success','error') NOT NULL,
	`response` text,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_logs_id` PRIMARY KEY(`id`)
);
