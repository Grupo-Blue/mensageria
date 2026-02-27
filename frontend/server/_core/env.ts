export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  backendApiUrl: process.env.BACKEND_API_URL ?? "http://localhost:3000",
  // OIDC Configuration (Authentik - whitelabel)
  oidcAuthority: process.env.OIDC_AUTHORITY ?? "",
  oidcClientId: process.env.OIDC_CLIENT_ID ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  // Webhook de disparo para sistema de chat - suporta múltiplos targets
  chatWebhookTargets: parseChatWebhookTargets(),
};

export interface ChatWebhookTarget {
  url: string;
  secret: string;
}

function parseChatWebhookTargets(): ChatWebhookTarget[] {
  const raw = process.env.CHAT_WEBHOOK_TARGETS?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t): t is { url?: string; secret?: string } => t && typeof t === "object")
          .map((t) => ({
            url: String(t.url ?? "").trim(),
            secret: String(t.secret ?? "").trim(),
          }))
          .filter((t) => t.url.length > 0);
      }
    } catch {
      console.warn("[ENV] CHAT_WEBHOOK_TARGETS inválido, ignorando.");
    }
  }
  const legacyUrl = process.env.CHAT_WEBHOOK_URL?.trim();
  if (legacyUrl) {
    return [{ url: legacyUrl, secret: process.env.CHAT_WEBHOOK_SECRET?.trim() ?? "" }];
  }
  return [];
}
