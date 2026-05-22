CREATE TABLE IF NOT EXISTS `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inviter_id` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(64) NOT NULL,
	`role` enum('viewer') NOT NULL DEFAULT 'viewer',
	`status` enum('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `account_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`member_id` int NOT NULL,
	`role` enum('viewer') NOT NULL DEFAULT 'viewer',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_members_owner_id_member_id_unique` UNIQUE(`owner_id`,`member_id`)
);
