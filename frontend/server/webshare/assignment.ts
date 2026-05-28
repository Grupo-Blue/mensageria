import { ENV } from "../_core/env";
import * as db from "../db";
import { listAllProxies } from "./client";

/**
 * Lógica de atribuição de proxies Webshare a conexões WhatsApp Baileys.
 *
 * Política:
 *  - Atribuição automática na criação da conexão (cf. plano aprovado).
 *  - Pin estático: enquanto o proxy estiver saudável, a sessão Baileys sempre
 *    sobe pelo mesmo IP.
 *  - Fallback de proxy morto: substitui por outro proxy do MESMO país.
 *  - Sem `WEBSHARE_API_KEY`: vira no-op (loga warning, conexão fica sem proxy).
 */

export interface AssignedProxy {
  id: number;
  host: string;
  port: number;
  username: string;
  password: string;
  countryCode: string;
}

function toAssigned(p: { id: number; host: string; port: number; username: string; password: string; countryCode: string }): AssignedProxy {
  return {
    id: p.id,
    host: p.host,
    port: p.port,
    username: p.username,
    password: p.password,
    countryCode: p.countryCode,
  };
}

/**
 * Atribui o próximo proxy disponível a uma conexão WhatsApp.
 *
 * - Preferência: `WEBSHARE_DEFAULT_COUNTRY` (default "BR").
 * - Se não há proxy local disponível, tenta sincronizar do Webshare antes de desistir.
 * - Sem `WEBSHARE_API_KEY` configurada, retorna `null` (modo sem proxy).
 */
export async function assignProxyToConnection(connectionId: number): Promise<AssignedProxy | null> {
  if (!ENV.webshareApiKey) {
    console.warn(`[webshare] WEBSHARE_API_KEY não configurada — conexão ${connectionId} sem proxy`);
    return null;
  }

  let proxy = await db.pickAvailableWebshareProxy(ENV.webshareDefaultCountry);
  if (!proxy) {
    // Pool vazio: tenta puxar do Webshare antes de falhar.
    try {
      await syncFromWebshare();
    } catch (err) {
      console.error(`[webshare] sync falhou ao tentar atribuir proxy para ${connectionId}:`, err);
      return null;
    }
    proxy = await db.pickAvailableWebshareProxy(ENV.webshareDefaultCountry);
  }
  if (!proxy) {
    console.error(`[webshare] sem proxies disponíveis (país preferido: ${ENV.webshareDefaultCountry})`);
    return null;
  }

  await db.updateWebshareProxy(proxy.id, { status: "assigned" });
  await db.updateWhatsappConnection(connectionId, { proxyId: proxy.id });
  console.log(`[webshare] conexão ${connectionId} ← proxy ${proxy.host}:${proxy.port} (${proxy.countryCode})`);
  return toAssigned(proxy);
}

/**
 * Libera o proxy de uma conexão (devolve ao pool) — chamado ao deletar a
 * conexão. Idempotente.
 */
export async function releaseProxyFromConnection(connectionId: number): Promise<void> {
  const conn = await db.getWhatsappConnectionById(connectionId);
  if (!conn?.proxyId) return;
  await db.updateWhatsappConnection(connectionId, { proxyId: null });
  await db.updateWebshareProxy(conn.proxyId, { status: "available" });
}

/**
 * Marca o proxy atual como morto e tenta atribuir outro DO MESMO PAÍS.
 * Retorna o novo proxy ou `null` se não há substituto disponível no país.
 */
export async function replaceDeadProxy(connectionId: number): Promise<AssignedProxy | null> {
  const current = await db.getWebshareProxyForConnection(connectionId);
  if (!current) {
    // Conexão sem proxy: tenta atribuir um do default country.
    return await assignProxyToConnection(connectionId);
  }
  await db.updateWebshareProxy(current.id, { status: "dead" });
  await db.updateWhatsappConnection(connectionId, { proxyId: null });

  let replacement = await db.pickAvailableWebshareProxy(current.countryCode);
  if (!replacement) {
    // Pool local vazio para esse país. Tenta puxar atualizações do painel
    // Webshare antes de desistir — proxies podem ter sido adicionados/liberados.
    try {
      await syncFromWebshare();
      replacement = await db.pickAvailableWebshareProxy(current.countryCode);
    } catch (err) {
      console.error(`[webshare] sync falhou ao tentar substituir proxy para ${connectionId}:`, err);
    }
  }
  if (!replacement) {
    console.error(`[webshare] sem proxy substituto no país ${current.countryCode} para conexão ${connectionId}`);
    return null;
  }
  await db.updateWebshareProxy(replacement.id, { status: "assigned" });
  await db.updateWhatsappConnection(connectionId, { proxyId: replacement.id });
  console.log(`[webshare] conexão ${connectionId} re-atribuída: ${current.host} → ${replacement.host} (${replacement.countryCode})`);
  return toAssigned(replacement);
}

/**
 * Importa/atualiza a lista de proxies do Webshare. Proxies que sumiram da
 * conta remota são marcados como `dead` localmente. Não desfaz atribuições
 * existentes — só atualiza credenciais/host/porta dos proxies já conhecidos.
 */
export async function syncFromWebshare(): Promise<{ imported: number; total: number } | null> {
  if (!ENV.webshareApiKey) {
    console.warn("[webshare] syncFromWebshare: WEBSHARE_API_KEY não configurada — skip");
    return null;
  }
  const proxies = await listAllProxies();
  if (!proxies) return null;

  let imported = 0;
  const keepIds: string[] = [];
  for (const p of proxies) {
    if (!p.valid) continue; // ignora proxies marcados inválidos no painel
    keepIds.push(p.id);
    const saved = await db.upsertWebshareProxy({
      webshareProxyId: p.id,
      host: p.proxy_address,
      port: p.port,
      username: p.username,
      password: p.password,
      countryCode: p.country_code.toUpperCase(),
      status: "available",
    });
    if (saved) imported++;
  }
  await db.markMissingWebshareProxiesDead(keepIds);
  return { imported, total: proxies.length };
}

/** Carrega o proxy ativo de uma conexão, no formato consumido pelo backend. */
export async function getProxyForConnection(connectionId: number): Promise<AssignedProxy | null> {
  const p = await db.getWebshareProxyForConnection(connectionId);
  if (!p || p.status === "dead") return null;
  return toAssigned(p);
}
