-- Add retry configuration to campaigns table
ALTER TABLE `campaigns`
ADD COLUMN `max_retries` INT NOT NULL DEFAULT 3,
ADD COLUMN `retry_delay_minutes` INT NOT NULL DEFAULT 30,
ADD COLUMN `auto_retry_enabled` BOOLEAN NOT NULL DEFAULT TRUE;

-- Add retry tracking to campaign_recipients table
ALTER TABLE `campaign_recipients`
ADD COLUMN `retry_count` INT NOT NULL DEFAULT 0,
ADD COLUMN `last_retry_at` TIMESTAMP NULL;
