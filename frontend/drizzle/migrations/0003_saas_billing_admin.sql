-- SaaS Billing & Admin Tables Migration
-- Creates tables for plans, subscriptions, usage tracking, payments, and admin functionality

-- ==========================================
-- BILLING TABLES
-- ==========================================

-- Plans table
CREATE TABLE IF NOT EXISTS `plans` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT,

  -- Pricing
  `price_monthly` DECIMAL(10, 2) NOT NULL,
  `price_yearly` DECIMAL(10, 2),
  `currency` VARCHAR(3) NOT NULL DEFAULT 'BRL',

  -- Limits
  `max_whatsapp_connections` INT NOT NULL,
  `max_business_accounts` INT NOT NULL,
  `max_campaigns_per_month` INT NOT NULL,
  `max_contacts_per_list` INT NOT NULL,
  `max_messages_per_month` INT NOT NULL,
  `max_template_messages_per_month` INT NOT NULL,

  -- Features
  `has_webhooks` BOOLEAN NOT NULL DEFAULT FALSE,
  `has_api_access` BOOLEAN NOT NULL DEFAULT FALSE,
  `has_ai_features` BOOLEAN NOT NULL DEFAULT FALSE,
  `has_priority_support` BOOLEAN NOT NULL DEFAULT FALSE,
  `has_custom_branding` BOOLEAN NOT NULL DEFAULT FALSE,

  -- Stripe
  `stripe_price_id_monthly` VARCHAR(255),
  `stripe_price_id_yearly` VARCHAR(255),

  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `is_enterprise` BOOLEAN NOT NULL DEFAULT FALSE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `plan_id` INT NOT NULL,

  -- Status
  `status` ENUM('active', 'canceled', 'past_due', 'trialing', 'paused', 'incomplete') NOT NULL DEFAULT 'active',

  -- Billing cycle
  `billing_cycle` ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly',

  -- Dates
  `current_period_start` TIMESTAMP NOT NULL,
  `current_period_end` TIMESTAMP NOT NULL,
  `canceled_at` TIMESTAMP NULL,
  `cancel_reason` TEXT,
  `trial_ends_at` TIMESTAMP NULL,
  `paused_at` TIMESTAMP NULL,

  -- Stripe
  `stripe_customer_id` VARCHAR(255),
  `stripe_subscription_id` VARCHAR(255),

  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_subscriptions_user_id` (`user_id`),
  INDEX `idx_subscriptions_plan_id` (`plan_id`),
  INDEX `idx_subscriptions_status` (`status`),
  INDEX `idx_subscriptions_stripe_customer` (`stripe_customer_id`),
  INDEX `idx_subscriptions_stripe_subscription` (`stripe_subscription_id`)
);

-- Usage Records table
CREATE TABLE IF NOT EXISTS `usage_records` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,

  -- Period
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,

  -- Counters
  `whatsapp_connections_count` INT NOT NULL DEFAULT 0,
  `business_accounts_count` INT NOT NULL DEFAULT 0,
  `campaigns_created` INT NOT NULL DEFAULT 0,
  `messages_via_api` INT NOT NULL DEFAULT 0,
  `messages_via_template` INT NOT NULL DEFAULT 0,
  `contacts_created` INT NOT NULL DEFAULT 0,

  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY `unique_user_period` (`user_id`, `period_start`),
  INDEX `idx_usage_user_id` (`user_id`),
  INDEX `idx_usage_period` (`period_start`, `period_end`)
);

-- Payments table
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `subscription_id` INT,

  `amount` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'BRL',
  `status` ENUM('pending', 'succeeded', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `description` TEXT,

  -- Stripe
  `stripe_payment_intent_id` VARCHAR(255),
  `stripe_invoice_id` VARCHAR(255),
  `stripe_charge_id` VARCHAR(255),

  `paid_at` TIMESTAMP NULL,
  `refunded_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_payments_user_id` (`user_id`),
  INDEX `idx_payments_subscription_id` (`subscription_id`),
  INDEX `idx_payments_status` (`status`),
  INDEX `idx_payments_stripe_payment` (`stripe_payment_intent_id`),
  INDEX `idx_payments_stripe_invoice` (`stripe_invoice_id`)
);

-- ==========================================
-- ADMIN TABLES
-- ==========================================

-- Admin Logs table
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `admin_user_id` INT NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50),
  `target_id` INT,
  `previous_value` TEXT,
  `new_value` TEXT,
  `details` TEXT,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_admin_logs_admin_user` (`admin_user_id`),
  INDEX `idx_admin_logs_action` (`action`),
  INDEX `idx_admin_logs_target` (`target_type`, `target_id`),
  INDEX `idx_admin_logs_created` (`created_at`)
);

-- Error Logs table
CREATE TABLE IF NOT EXISTS `error_logs` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `error_type` VARCHAR(50) NOT NULL,
  `error_code` VARCHAR(50),
  `message` TEXT NOT NULL,
  `stack_trace` TEXT,
  `context` TEXT,
  `resolved` BOOLEAN NOT NULL DEFAULT FALSE,
  `resolved_at` TIMESTAMP NULL,
  `resolved_by` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_error_logs_user_id` (`user_id`),
  INDEX `idx_error_logs_type` (`error_type`),
  INDEX `idx_error_logs_resolved` (`resolved`),
  INDEX `idx_error_logs_created` (`created_at`)
);

-- System Settings table
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE,
  `value` TEXT,
  `type` VARCHAR(20) NOT NULL DEFAULT 'string',
  `description` TEXT,
  `is_public` BOOLEAN NOT NULL DEFAULT FALSE,
  `updated_by` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_system_settings_key` (`key`),
  INDEX `idx_system_settings_public` (`is_public`)
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `resource_type` VARCHAR(50),
  `resource_id` VARCHAR(100),
  `metadata` TEXT,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_audit_logs_user_id` (`user_id`),
  INDEX `idx_audit_logs_action` (`action`),
  INDEX `idx_audit_logs_resource` (`resource_type`, `resource_id`),
  INDEX `idx_audit_logs_created` (`created_at`)
);

-- ==========================================
-- SEED DEFAULT PLANS
-- ==========================================

INSERT INTO `plans` (
  `name`, `slug`, `description`,
  `price_monthly`, `price_yearly`, `currency`,
  `max_whatsapp_connections`, `max_business_accounts`, `max_campaigns_per_month`,
  `max_contacts_per_list`, `max_messages_per_month`, `max_template_messages_per_month`,
  `has_webhooks`, `has_api_access`, `has_ai_features`, `has_priority_support`, `has_custom_branding`,
  `is_active`, `is_enterprise`, `sort_order`
) VALUES
-- Free Plan
(
  'Free', 'free', 'Plano gratuito para testar a plataforma',
  0.00, NULL, 'BRL',
  1, 0, 1,
  100, 100, 0,
  FALSE, FALSE, FALSE, FALSE, FALSE,
  TRUE, FALSE, 0
),
-- Starter Plan
(
  'Starter', 'starter', 'Ideal para pequenos negócios e profissionais autônomos',
  57.00, 570.00, 'BRL',
  3, 1, 10,
  1000, 5000, 5000,
  TRUE, TRUE, FALSE, FALSE, FALSE,
  TRUE, FALSE, 1
),
-- Pro Plan
(
  'Pro', 'pro', 'Para empresas em crescimento com necessidades avançadas',
  297.00, 2970.00, 'BRL',
  10, 3, 50,
  5000, 25000, 25000,
  TRUE, TRUE, TRUE, TRUE, FALSE,
  TRUE, FALSE, 2
),
-- Enterprise Plan
(
  'Enterprise', 'enterprise', 'Solução personalizada para grandes empresas',
  0.00, NULL, 'BRL',
  999999, 10, 999999,
  999999, 100000, 100000,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, 3
);

-- ==========================================
-- DEFAULT SYSTEM SETTINGS
-- ==========================================

INSERT INTO `system_settings` (`key`, `value`, `type`, `description`, `is_public`) VALUES
('maintenance_mode', 'false', 'boolean', 'Ativa/desativa o modo de manutenção do sistema', FALSE),
('app_name', 'Sistema de Mensageria', 'string', 'Nome da aplicação', TRUE),
('support_email', 'suporte@exemplo.com', 'string', 'Email de suporte', TRUE),
('enterprise_contact_email', 'comercial@exemplo.com', 'string', 'Email para contato Enterprise', TRUE),
('trial_days', '7', 'number', 'Dias de trial para novos usuários', FALSE),
('max_login_attempts', '5', 'number', 'Máximo de tentativas de login antes de bloqueio', FALSE),
('session_timeout_minutes', '1440', 'number', 'Tempo de expiração da sessão em minutos', FALSE);
