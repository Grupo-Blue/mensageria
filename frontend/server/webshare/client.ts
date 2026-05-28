import { ENV } from "../_core/env";

/**
 * Cliente HTTP da API Webshare v2 (https://proxy.webshare.io/api/v2/).
 *
 * Autenticação: header `Authorization: Token <WEBSHARE_API_KEY>`.
 * Retorna `null` quando a chave não está configurada — o caller deve tratar
 * isso como "modo sem proxy" sem quebrar.
 */

export interface WebshareProxyDTO {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  country_code: string;
  valid: boolean;
}

const BASE_URL = "https://proxy.webshare.io/api/v2";

function headers(): Record<string, string> | null {
  const key = ENV.webshareApiKey;
  if (!key) return null;
  return {
    Authorization: `Token ${key}`,
    "Content-Type": "application/json",
  };
}

/**
 * Lista todos os proxies da conta (paginação automática). Retorna `null` se
 * a chave da API não está configurada.
 */
export async function listAllProxies(): Promise<WebshareProxyDTO[] | null> {
  const h = headers();
  if (!h) return null;

  const results: WebshareProxyDTO[] = [];
  let url: string | null = `${BASE_URL}/proxy/list/?mode=direct&page_size=100`;
  while (url) {
    // Timeout por página para evitar pendurar o scheduler quando a API trava.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res: Response = await fetch(url, { headers: h, signal: controller.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Webshare listProxies falhou (${res.status}): ${body.slice(0, 200)}`);
      }
      const json = await res.json() as { results?: WebshareProxyDTO[]; next?: string | null };
      if (Array.isArray(json.results)) results.push(...json.results);
      url = json.next ?? null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return results;
}
