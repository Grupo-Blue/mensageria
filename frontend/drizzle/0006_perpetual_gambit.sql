ALTER TABLE `webhook_logs` ADD `from_number` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `webhook_logs` DROP COLUMN `from`;