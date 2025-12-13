ALTER TABLE `whatsapp_groups` DROP INDEX `whatsapp_groups_group_id_unique`;--> statement-breakpoint
ALTER TABLE `whatsapp_groups` ADD `session_id` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_groups` ADD CONSTRAINT `whatsapp_groups_session_id_group_id_unique` UNIQUE(`session_id`,`group_id`);--> statement-breakpoint
ALTER TABLE `whatsapp_groups` DROP COLUMN `connection_id`;