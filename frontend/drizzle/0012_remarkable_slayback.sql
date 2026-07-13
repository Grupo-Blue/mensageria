CREATE INDEX `idx_baileys_recipients_campaign_status_sent_at` ON `baileys_campaign_recipients` (`campaign_id`,`status`,`sent_at`);--> statement-breakpoint
CREATE INDEX `idx_baileys_recipients_conn_status_sent_at` ON `baileys_campaign_recipients` (`sent_from_connection_id`,`status`,`sent_at`);--> statement-breakpoint
CREATE INDEX `idx_campaign_recipients_campaign_status_sent_at` ON `campaign_recipients` (`campaign_id`,`status`,`sent_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_user_sent_at` ON `messages` (`user_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `idx_whatsapp_connections_user` ON `whatsapp_connections` (`user_id`);