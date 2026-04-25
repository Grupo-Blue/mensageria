-- Seed/Update plans with GTM pricing from brief-gtm-cf674c2a.md
-- BlueMsg plans: Free, Starter, Profissional, Escala, Enterprise
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
-- Profissional — 2 contas Meta, 8000 msgs, campanhas ilimitadas
(
  'Profissional', 'profissional', 'Para negócios que precisam de múltiplas contas e campanhas ilimitadas.',
  247.00, 2470.00, 'BRL',
  3, 2, 999999,
  5000, 8000, 8000,
  TRUE, TRUE, TRUE, TRUE, FALSE,
  TRUE, FALSE, 2
),
-- Escala — 5 contas Meta, 25000 msgs, volume real
(
  'Escala', 'escala', 'Para quem dispara de verdade. Volume, velocidade e múltiplas contas.',
  497.00, 4970.00, 'BRL',
  5, 5, 999999,
  10000, 25000, 25000,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  TRUE, FALSE, 3
),
-- Enterprise — sob consulta
(
  'Enterprise', 'enterprise', 'Solução personalizada para grandes volumes. Preço sob consulta.',
  0.00, NULL, 'BRL',
  999999, 10, 999999,
  999999, 999999, 999999,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, 4
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
  `is_enterprise` = VALUES(`is_enterprise`),
  `sort_order` = VALUES(`sort_order`),
  `updated_at` = CURRENT_TIMESTAMP;
