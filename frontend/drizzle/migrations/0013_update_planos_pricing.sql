UPDATE `plans` SET
  `description` = 'Para quem dispara de verdade. Volume, velocidade e múltiplas contas.',
  `price_monthly` = 297.00,
  `price_yearly` = 2970.00,
  `max_whatsapp_connections` = 5,
  `max_business_accounts` = 5,
  `max_campaigns_per_month` = 999999,
  `max_contacts_per_list` = 10000,
  `max_messages_per_month` = 25000,
  `max_template_messages_per_month` = 25000,
  `has_webhooks` = TRUE,
  `has_api_access` = TRUE,
  `has_ai_features` = TRUE,
  `has_priority_support` = TRUE,
  `has_custom_branding` = TRUE,
  `sort_order` = 2,
  `updated_at` = CURRENT_TIMESTAMP
WHERE `slug` = 'pro';--> statement-breakpoint
UPDATE `plans` SET
  `description` = 'Solução para grandes volumes com recursos avançados.',
  `price_monthly` = 797.00,
  `price_yearly` = 7970.00,
  `max_messages_per_month` = 500000,
  `max_template_messages_per_month` = 500000,
  `is_enterprise` = FALSE,
  `sort_order` = 3,
  `updated_at` = CURRENT_TIMESTAMP
WHERE `slug` = 'enterprise';--> statement-breakpoint
UPDATE `subscriptions` s
INNER JOIN `plans` p_old ON s.plan_id = p_old.id AND p_old.slug = 'escala'
INNER JOIN `plans` p_new ON p_new.slug = 'pro'
SET s.plan_id = p_new.id,
    s.updated_at = CURRENT_TIMESTAMP
WHERE s.status IN ('active', 'trialing');--> statement-breakpoint
UPDATE `plans` SET
  `is_active` = FALSE,
  `updated_at` = CURRENT_TIMESTAMP
WHERE `slug` = 'escala';
