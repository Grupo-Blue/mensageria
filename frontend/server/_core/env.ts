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
  // Webhook de disparo para sistema de chat
  chatWebhookUrl: process.env.CHAT_WEBHOOK_URL ?? "",
  chatWebhookSecret: process.env.CHAT_WEBHOOK_SECRET ?? "",
};
