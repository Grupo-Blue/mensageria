CREATE TABLE `baileys_campaign_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`connection_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `baileys_campaign_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_campaign_connection` UNIQUE(`campaign_id`,`connection_id`)
);
--> statement-breakpoint
CREATE TABLE `webshare_proxies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webshare_proxy_id` varchar(64) NOT NULL,
	`host` varchar(100) NOT NULL,
	`port` int NOT NULL,
	`username` varchar(100) NOT NULL,
	`password` varchar(200) NOT NULL,
	`country_code` varchar(2) NOT NULL,
	`status` enum('available','assigned','dead') NOT NULL DEFAULT 'available',
	`last_verified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webshare_proxies_id` PRIMARY KEY(`id`),
	CONSTRAINT `webshare_proxies_webshare_proxy_id_unique` UNIQUE(`webshare_proxy_id`)
);
--> statement-breakpoint
ALTER TABLE `baileys_campaigns` MODIFY COLUMN `connection_id` int;--> statement-breakpoint
ALTER TABLE `baileys_campaign_recipients` ADD `sent_from_connection_id` int;--> statement-breakpoint
ALTER TABLE `whatsapp_connections` ADD `proxy_id` int;--> statement-breakpoint
-- Backfill: campanhas legadas single-conn migram para a junction N:N para que
-- o scheduler novo (multi-conexão) leia a fonte correta de verdade. Idempotente
-- via ON DUPLICATE KEY (UNIQUE em (campaign_id, connection_id)).
INSERT INTO `baileys_campaign_connections` (`campaign_id`, `connection_id`)
SELECT `id`, `connection_id` FROM `baileys_campaigns` WHERE `connection_id` IS NOT NULL
ON DUPLICATE KEY UPDATE `campaign_id` = `baileys_campaign_connections`.`campaign_id`;