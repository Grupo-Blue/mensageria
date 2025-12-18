-- Migration: Add multi-tenant fields
-- Date: 2025-12-12
-- Description: Adds api_key to users and whatsapp_connections tables for multi-tenant support

-- Add api_key to users table
ALTER TABLE users
ADD COLUMN api_key VARCHAR(64) UNIQUE NULL AFTER role;

-- Add api_key, webhook_url, webhook_secret to whatsapp_connections table
ALTER TABLE whatsapp_connections
ADD COLUMN api_key VARCHAR(64) UNIQUE NULL AFTER identification,
ADD COLUMN webhook_url VARCHAR(500) NULL AFTER api_key,
ADD COLUMN webhook_secret VARCHAR(255) NULL AFTER webhook_url;

-- Generate API keys for existing connections (optional - can be done manually)
-- UPDATE whatsapp_connections SET api_key = CONCAT('conn_', id, '_', MD5(RAND())) WHERE api_key IS NULL;

-- Create index for faster api_key lookups
CREATE INDEX idx_whatsapp_connections_api_key ON whatsapp_connections(api_key);
CREATE INDEX idx_users_api_key ON users(api_key);
