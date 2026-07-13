-- Seed/Update plans with GTM pricing from brief-gtm-cf674c2a.md
-- BlueMsg plans: Free, Starter, Profissional, Enterprise
-- Uses INSERT ON DUPLICATE KEY UPDATE to safely handle existing data

INSERT INTO `plans` (
  `name`, `slug`, `description`,
  `price_monthly`, `price_yearly`, `currency`,
  `max_whatsapp_connections`, `max_business_accounts`, `max_campaigns_per_month`,
  `max_contacts_per_list`, `max_messages_per_month`, `max_template_messages_per_month`,
  `has_webhooks`, `has_api_access`, `has_ai_features`, `has_priority_support`, `has_custom_branding`,
  `is_active`, `is_enterprise`, `sort_order`
) VALUES
-- Free Plan — trial sem cartão, 1 conta Meta, 200 msgs marketing
(
  'Free', 'free', 'Trial gratuito. Ideal para testar a plataforma e enviar seus primeiros disparos oficiais.',
  0.00, NULL, 'BRL',
  1, 1, 2,
  200, 200, 200,
  FALSE, FALSE, FALSE, FALSE, FALSE,
  TRUE, FALSE, 0
),
-- Starter — entrada PME, 1 conta Meta, 2000 msgs
(
  'Starter', 'starter', 'Perfeito para pequenos negócios que estão começando com WhatsApp oficial.',
  97.00, 970.00, 'BRL',
  2, 1, 10,
  2000, 2000, 2000,
  TRUE, TRUE, FALSE, FALSE, FALSE,
  TRUE, FALSE, 1
),
-- Profissional — 5 contas Meta, 25000 msgs, volume real
(
  'Profissional', 'pro', 'Para quem dispara de verdade. Volume, velocidade e múltiplas contas.',
  297.00, 2970.00, 'BRL',
  5, 5, 999999,
  10000, 25000, 25000,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  TRUE, FALSE, 2
),
-- Enterprise — grandes volumes, 500k msgs/mês
(
  'Enterprise', 'enterprise', 'Solução para grandes volumes com recursos avançados.',
  797.00, 7970.00, 'BRL',
  999999, 10, 999999,
  999999, 500000, 500000,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  TRUE, FALSE, 3
)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `price_monthly` = VALUES(`price_monthly`),
  `price_yearly` = VALUES(`price_yearly`),
  `max_whatsapp_connections` = VALUES(`max_whatsapp_connections`),
  `max_business_accounts` = VALUES(`max_business_accounts`),
  `max_campaigns_per_month` = VALUES(`max_campaigns_per_month`),
  `max_contacts_per_list` = VALUES(`max_contacts_per_list`),
  `max_messages_per_month` = VALUES(`max_messages_per_month`),
  `max_template_messages_per_month` = VALUES(`max_template_messages_per_month`),
  `has_webhooks` = VALUES(`has_webhooks`),
  `has_api_access` = VALUES(`has_api_access`),
  `has_ai_features` = VALUES(`has_ai_features`),
  `has_priority_support` = VALUES(`has_priority_support`),
  `has_custom_branding` = VALUES(`has_custom_branding`),
  `is_active` = VALUES(`is_active`),
  `is_enterprise` = VALUES(`is_enterprise`),
  `currency` = VALUES(`currency`),
  `sort_order` = VALUES(`sort_order`),
  `updated_at` = CURRENT_TIMESTAMP;
