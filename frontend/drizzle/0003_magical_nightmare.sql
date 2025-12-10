CREATE TABLE `whatsapp_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connection_id` int NOT NULL,
	`group_id` varchar(100) NOT NULL,
	`group_name` varchar(255),
	`last_message_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_groups_group_id_unique` UNIQUE(`group_id`)
);
