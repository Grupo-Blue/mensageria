ALTER TABLE `baileys_campaigns` ADD `media_url` varchar(1000);--> statement-breakpoint
ALTER TABLE `baileys_campaigns` ADD `media_type` enum('image','document','audio');--> statement-breakpoint
ALTER TABLE `baileys_campaigns` ADD `media_file_name` varchar(255);--> statement-breakpoint
ALTER TABLE `baileys_campaigns` ADD `media_mime_type` varchar(100);--> statement-breakpoint
ALTER TABLE `whatsapp_connections` ADD `warmup_daily_limit` int;