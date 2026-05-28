import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  makeWASocket,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import socket from '../../libs/socket.js';
import messageStore from './messageStore.js';
import { saveGroupInfo } from './saveGroupInfo.js';
import settingsStore from '../settingsStore.js';
import tokenCache from '../tokenCache.js';

/**
 * Configuração de proxy estático (Webshare) por conexão WhatsApp.
 * Quando presente, o socket Baileys sai pelo IP do proxy — fundamental para
 * manter IP estável e reduzir risco de ban.
 */
export interface BaileysProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

/**
 * Mapa em memória `connectionId → proxy` para preservar atribuição entre
 * reconexões automáticas. O frontend manda o proxy no POST /connect e em
 * todo handshake; aqui memorizamos para que `addConnection` reentrante (do
 * próprio handler de `connection.close`) reaplique o mesmo proxy.
 */
const connectionProxies = new Map<string, BaileysProxyConfig>();

export function setConnectionProxy(id: string, proxy: BaileysProxyConfig | undefined): void {
  if (proxy) connectionProxies.set(id, proxy);
  else connectionProxies.delete(id);
}

export function getConnectionProxy(id: string): BaileysProxyConfig | undefined {
  return connectionProxies.get(id);
}

interface ConnectionInterface {
  id: string;
  connection: WASocket;
  connected: boolean;
}


/**
 * Generate HMAC signature for webhook payload
 */
const generateWebhookSignature = (payload: string, secret: string): string => {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

/**
 * Converte JID do Baileys (ex.: 5561998317422@s.whatsapp.net) para E.164 (+5561998317422)
 */
const jidToE164 = (jid: string): string => {
  const raw = jid.replace(/@s\.whatsapp\.net$/, '');
  return raw.startsWith('+') ? raw : `+${raw}`;
};

/**
 * Registra o resultado do webhook no banco via API interna do frontend.
 * Fire-and-forget: não bloqueia o fluxo principal.
 */
const logWebhookResult = (connectionName: string, fromNumber: string, messageId: string, text: string, status: 'success' | 'error', response?: string, errorMessage?: string) => {
  const frontendUrl = process.env.FRONTEND_API_URL || 'http://localhost:3000';
  const internalToken = process.env.INTERNAL_SYNC_TOKEN || process.env.X_AUTH_API;
  if (!internalToken) return;

  fetch(`${frontendUrl}/api/internal/webhook-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
    body: JSON.stringify({ connectionName, fromNumber, messageId, text, status, response, errorMessage }),
    signal: AbortSignal.timeout(5000),
  }).catch(err => console.warn('[Webhook Log] Falha ao gravar log:', err.message));
};

const forwardToWebhook = async (connectionName: string, fromJid: string, messageId: string, text: string) => {
  const from = jidToE164(fromJid);
  try {
    let webhookUrl: string | null = null;
    let webhookSecret: string | null = null;

    let webhookConfig = tokenCache.getWebhookConfig(connectionName);
    if (!webhookConfig?.url) {
      console.log('[Webhook] Webhook não encontrado no cache para conexão:', connectionName, '- forçando sync com o frontend');
      await tokenCache.forceRefresh();
      webhookConfig = tokenCache.getWebhookConfig(connectionName);
    }
    if (webhookConfig?.url) {
      webhookUrl = webhookConfig.url;
      webhookSecret = webhookConfig.secret;
      console.log('[Webhook] Usando webhook específico da conexão:', connectionName);
    } else {
      const settings = await settingsStore.getSettings();
      webhookUrl = settings.webhook_url;
      console.log('[Webhook] Usando webhook global (legacy)');
    }

    if (!webhookUrl) {
      console.log('[Webhook] URL não configurada para conexão:', connectionName);
      console.log('[Webhook] Dica: Verifique INTERNAL_SYNC_TOKEN e FRONTEND_API_URL no backend e se a URL/secret estão salvos na conexão no painel.');
      return;
    }

    const payload = {
      connection_name: connectionName,
      from,
      message_id: messageId,
      timestamp: new Date().toISOString(),
      text
    };

    const payloadString = JSON.stringify(payload);

    console.log('[Webhook] Enviando para:', { webhookUrl, connectionName, from, messageId, textLength: text.length });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Connection-Name': connectionName,
    };

    if (webhookSecret) {
      headers['x-webhook-secret'] = webhookSecret;
      headers['X-Webhook-Signature'] = generateWebhookSignature(payloadString, webhookSecret);
    }

    // Retry com backoff exponencial (delays antes da 2ª e 3ª tentativas).
    // 4xx não é retentado (erro do cliente); 5xx e falhas de rede sim.
    const retryDelaysMs = [1000, 3000];
    const maxAttempts = 1 + retryDelaysMs.length;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const tag = attempt > 1 ? ` (após ${attempt} tentativas)` : '';
          console.log(`[Webhook] Mensagem encaminhada com sucesso${tag}:`, from);
          logWebhookResult(connectionName, from, messageId, text, 'success',
            attempt > 1 ? JSON.stringify({ attempts: attempt }) : undefined);
          return;
        }

        const errorText = await response.text();
        // 4xx: erro do cliente — não retentar
        if (response.status >= 400 && response.status < 500) {
          console.log(`[Webhook] Erro HTTP ${response.status} (não-retentável)`, errorText);
          logWebhookResult(connectionName, from, messageId, text, 'error', undefined,
            `HTTP ${response.status}: ${errorText.substring(0, 500)} (tentativa ${attempt}/${maxAttempts})`);
          return;
        }
        lastError = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
      } catch (error: any) {
        lastError = error.message || String(error);
      }

      // Aguarda antes da próxima tentativa, se houver
      if (attempt < maxAttempts) {
        const baseDelay = retryDelaysMs[attempt - 1] ?? 5000;
        const jitter = Math.floor(Math.random() * 250);
        const delay = baseDelay + jitter;
        console.warn(`[Webhook] Tentativa ${attempt}/${maxAttempts} falhou (${lastError}). Reenviando em ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    console.error(`[Webhook] Falha final após ${maxAttempts} tentativas:`, lastError);
    logWebhookResult(connectionName, from, messageId, text, 'error', undefined,
      `${lastError} (esgotadas ${maxAttempts} tentativas)`);
  } catch (error: any) {
    console.error('[Webhook] Erro ao encaminhar:', error.message);
    logWebhookResult(connectionName, from, messageId, text, 'error', undefined, error.message);
  }
};

const connections: ConnectionInterface[] = [];

// Rastrear tentativas consecutivas de Connection Failure por conexão
const connectionFailureCounts = new Map<string, number>();

const updateConnectionStatus = (id: string, status: boolean): void => {
  const target = connections.find(connectionItem => connectionItem.id === id);
  if (target) {
    target.connected = status;
  }
};
const groupNameCache = new Map<string, string>();

const closeBaileysConnection = (connection: any): void => {
  if (!connection) {
    return;
  }

  try {
    connection?.end?.();
  } catch (error) {
    console.error('Erro ao encerrar conexão Baileys com end():', error);
  }

  try {
    connection?.ws?.close?.();
  } catch (error) {
    console.error('Erro ao encerrar WebSocket do Baileys:', error);
  }
};

export const removeConnection = (id: string): void => {
  const index = connections.findIndex(c => c.id === id);
  if (index !== -1) {
    closeBaileysConnection(connections[index].connection);
    connections.splice(index, 1);
  }
  // Resetar contador de falhas quando a conexão é removida
  connectionFailureCounts.delete(id);
};

/**
 * Remove conexão e apaga arquivos de sessão (força novo QR code)
 */
export const logoutConnection = (id: string): void => {
  console.log('[Baileys] 🔄 Iniciando logout completo para:', id);
  removeConnection(id);
  console.log('[Baileys] ✅ Conexão removida da lista');
  
  // Remove arquivos de sessão para forçar novo QR code
  const authDir = path.resolve(process.cwd(), 'auth_info_baileys', id);
  console.log('[Baileys] Verificando diretório de sessão:', authDir);
  
  try {
    if (fs.existsSync(authDir)) {
      const filesBefore = fs.readdirSync(authDir);
      console.log('[Baileys] Arquivos encontrados antes da remoção:', filesBefore);
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('[Baileys] ✅ Arquivos de sessão removidos:', authDir);
      
      // Verificar se realmente foi removido
      if (fs.existsSync(authDir)) {
        console.error('[Baileys] ⚠️ ATENÇÃO: Diretório ainda existe após remoção!');
      } else {
        console.log('[Baileys] ✅ Diretório confirmado como removido');
      }
    } else {
      console.log('[Baileys] ℹ️ Diretório de sessão não existe (já estava limpo)');
    }
  } catch (error: any) {
    console.error('[Baileys] ❌ Erro ao remover arquivos de sessão:', error.message);
    console.error('[Baileys] Stack trace:', error.stack);
  }
};

export const addConnection = async (id: string, options?: { proxy?: BaileysProxyConfig }): Promise<void> => {
  console.log(`[addConnection] ========== INICIANDO CONEXÃO PARA: ${id} ==========`);
  const io = socket.getIO();

  // Persistir proxy em memória para sobreviver a reconexões. Se `proxy` foi
  // passado explicitamente, usa-o; caso contrário, recupera o último conhecido
  // (caminho do auto-reconnect, onde o caller só passa o id).
  if (options?.proxy !== undefined) {
    setConnectionProxy(id, options.proxy);
  }
  const activeProxy = getConnectionProxy(id);
  
  // Remove conexão anterior
  removeConnection(id);
  console.log(`[addConnection] Conexão anterior removida`);
  
  const dir = path.resolve(
    process.cwd(),
    'auth_info_baileys',
    id,
  );
  console.log(`[addConnection] Diretório de autenticação: ${dir}`);

  // CRÍTICO: Carregar estado primeiro para verificar se há sessão válida
  // Se não houver 'me', limpar tudo para forçar QR code (evita "registration" loop)
  console.log(`[addConnection] Carregando estado de autenticação para verificação...`);
  let tempState = await useMultiFileAuthState(dir);
  const tempHasValidAuth = tempState.state.creds && tempState.state.creds.me;
  const tempHasCredsButNoMe = tempState.state.creds && !tempState.state.creds.me;
  
  console.log(`[addConnection] Verificação inicial:`, {
    hasCreds: !!tempState.state.creds,
    hasMe: !!tempHasValidAuth,
    hasRegistered: !!(tempState.state.creds?.registered),
    credsKeys: tempState.state.creds ? Object.keys(tempState.state.creds) : []
  });
  
  // Se há credenciais mas SEM 'me', limpar completamente para forçar QR code
  // Isso evita que o Baileys tente "registration" ao invés de gerar QR
  if (tempHasCredsButNoMe) {
    console.log(`[addConnection] ⚠️ CREDENCIAIS PARCIAIS DETECTADAS (sem 'me')!`);
    console.log(`[addConnection] Isso pode fazer o Baileys tentar 'registration' ao invés de gerar QR code`);
    console.log(`[addConnection] Limpando diretório completamente para forçar geração de QR code...`);
    
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`[addConnection] ✅ Diretório removido completamente`);
        
        // Aguardar para garantir remoção completa
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Recriar diretório vazio
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[addConnection] ✅ Diretório recriado (limpo)`);
      }
    } catch (error: any) {
      console.error(`[addConnection] ❌ Erro ao limpar diretório:`, error.message);
    }
  }
  
  // Verificar se já existem credenciais salvas (após possível limpeza)
  const hasExistingAuth = fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  console.log(`[addConnection] Credenciais existentes após verificação: ${hasExistingAuth ? 'sim' : 'não'}`);
  
  if (hasExistingAuth) {
    const files = fs.readdirSync(dir);
    console.log(`[addConnection] Arquivos de sessão encontrados (${files.length} arquivos):`, files.slice(0, 10), files.length > 10 ? '...' : '');
  } else {
    console.log(`[addConnection] ✅ Diretório limpo - QR code será gerado`);
    // Garantir que o diretório existe (mas vazio) para o useMultiFileAuthState
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[addConnection] Diretório criado: ${dir}`);
    }
  }

  // Carregar estado final (limpo ou existente válido)
  console.log(`[addConnection] Carregando estado de autenticação final...`);
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  console.log(`[addConnection] Estado carregado`);
  
  // CRÍTICO: Se não há 'me', garantir que 'registered' seja false
  // Isso evita que o Baileys tente "registration" ao invés de gerar QR code
  if (state.creds && !state.creds.me) {
    console.log(`[addConnection] ⚠️ Forçando registered=false para evitar tentativa de 'registration'`);
    state.creds.registered = false;
    // Salvar imediatamente para garantir que a mudança persista
    await saveCreds();
    console.log(`[addConnection] ✅ registered=false aplicado e salvo`);
  }
  
  // Log detalhado do estado final
  console.log(`[addConnection] Estado detalhado:`, {
    hasCreds: !!state.creds,
    hasMe: !!(state.creds && state.creds.me),
    hasRegistered: !!(state.creds?.registered),
    registeredValue: state.creds?.registered,
    credsKeys: state.creds ? Object.keys(state.creds) : []
  });
  
  // Verificar se o state tem credenciais válidas (sessão autenticada)
  const hasValidAuth = state.creds && state.creds.me;
  
  console.log(`[addConnection] State tem credenciais válidas (sessão autenticada): ${hasValidAuth ? 'sim' : 'não'}`);
  if (hasValidAuth) {
    console.log(`[addConnection] ⚠️ ATENÇÃO: Sessão autenticada encontrada! Baileys vai reconectar sem QR code.`);
    console.log(`[addConnection] Me (usuário):`, state.creds.me);
  } else {
    console.log(`[addConnection] ✅ Sem sessão autenticada - Baileys DEVE gerar QR code`);
    if (state.creds) {
      console.log(`[addConnection] ℹ️ hasCreds=true é normal - são as chaves criptográficas para o handshake`);
      console.log(`[addConnection] ℹ️ registered=${state.creds.registered} - Baileys vai gerar QR code`);
    } else {
      console.log(`[addConnection] ℹ️ Estado completamente limpo - Baileys vai gerar novas chaves e QR code`);
    }
  }

  console.log(`[addConnection] Buscando versão mais recente do Baileys (WhatsApp Web)...`);
  let waVersion: [number, number, number] | undefined;
  try {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    waVersion = version;
    console.log(`[addConnection] ✅ Versão WA Web: ${version.join('.')}, isLatest=${isLatest}`);
  } catch (error: any) {
    console.error(`[addConnection] ❌ Erro ao buscar versão WA Web:`, error.message);
    console.error(`[addConnection] Stack:`, error.stack);
  }

  console.log(`[addConnection] Criando socket Baileys...`);
  let proxyAgent: HttpsProxyAgent<string> | undefined;
  if (activeProxy) {
    const proxyUrl = `http://${encodeURIComponent(activeProxy.username)}:${encodeURIComponent(activeProxy.password)}@${activeProxy.host}:${activeProxy.port}`;
    proxyAgent = new HttpsProxyAgent(proxyUrl);
    console.log(`[addConnection] 🌐 Usando proxy estático ${activeProxy.host}:${activeProxy.port} para conexão ${id}`);
  }
  let sock;
  try {
    sock = makeWASocket({
      ...(waVersion ? { version: waVersion } : {}),
      ...(proxyAgent ? { agent: proxyAgent, fetchAgent: proxyAgent } : {}),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false, // Deprecated, vamos usar apenas o evento connection.update
      auth: state,
      getMessage: async () => {
        return undefined;
      },
    });
    console.log(`[addConnection] ✅ Socket Baileys criado com sucesso`);
  } catch (error: any) {
    console.error(`[addConnection] ❌ ERRO ao criar socket Baileys:`, error.message);
    console.error(`[addConnection] Stack:`, error.stack);
    throw error;
  }

  // store?.bind(sock.ev);
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('presence.update', (data: { id: string; presences: Record<string, { lastKnownPresence: string; lastSeen?: number }> }) => console.log('presence.update', data));
  
  // Adicionar handler de erros do socket
  sock.ev.on('connection.update', (update: { isNewLogin?: boolean; qr?: string; connection?: string; lastDisconnect?: { error?: Error } }) => {
    if (update.lastDisconnect?.error) {
      const error = update.lastDisconnect.error;
      console.error(`[Baileys Error] ❌ Erro no socket para conexão ${id}:`, error);
      console.error(`[Baileys Error] Stack:`, error.stack);
    }
  });

  console.log(`[addConnection] Registrando handler connection.update...`);
  // Armazenar hasValidAuth no escopo para uso no handler
  const connectionHasValidAuth = hasValidAuth;
  
  // Timeout para verificar se o QR code foi gerado
  let qrTimeout: NodeJS.Timeout | null = null;
  if (!connectionHasValidAuth) {
    console.log(`[addConnection] ⏰ Configurando timeout de 15s para verificar se QR foi gerado...`);
    qrTimeout = setTimeout(() => {
      console.log(`[addConnection] ⚠️ TIMEOUT: QR code não foi gerado em 15 segundos`);
      console.log(`[addConnection] Isso pode indicar um problema com a conexão do Baileys`);
      console.log(`[addConnection] Verificando estado atual da conexão...`);
      
      // Verificar se a conexão ainda está ativa
      const currentConnection = connections.find(c => c.id === id);
      if (currentConnection) {
        console.log(`[addConnection] Conexão ainda existe na lista`);
      } else {
        console.log(`[addConnection] ⚠️ Conexão não encontrada na lista - pode ter sido removida`);
      }
    }, 15000);
  }
  
  sock.ev.on('connection.update', async (update: { connection?: string; lastDisconnect?: { error?: Error }; qr?: string }) => {
    const { connection, lastDisconnect, qr } = update;
    
    console.log(`[Connection Update] 🔔 Evento recebido para conexão ${id}`);
    console.log(`[Connection Update] Conexão ${id} - connection: ${connection}, qr: ${qr ? 'presente' : 'ausente'}`);
    console.log(`[Connection Update] Update completo:`, JSON.stringify({
      connection,
      qr: qr ? `presente (${qr.length} chars)` : 'ausente',
      lastDisconnect: lastDisconnect ? 'presente' : 'ausente'
    }, null, 2));
    
    // Emitir QR code quando disponível
    if (qr) {
      // Limpar timeout se QR foi gerado
      if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
        console.log(`[QR Code] ✅ Timeout cancelado - QR code gerado`);
      }
      
      // Resetar contador de falhas quando QR é gerado
      connectionFailureCounts.delete(id);
      
      console.log(`[QR Code] ✅ QR Code gerado para conexão: ${id}`);
      console.log(`[QR Code] Tamanho do QR: ${qr.length} caracteres`);
      console.log(`[QR Code] Primeiros 50 caracteres: ${qr.substring(0, 50)}...`);
      
      const qrData = {
        id,
        qrcode: qr,
        connected: false,
      };
      
      const connectedClients = io.sockets.sockets.size;
      console.log(`[QR Code] Emitindo evento 'qrcode' para ${connectedClients} cliente(s) conectado(s)`);
      console.log(`[QR Code] Socket.IO disponível:`, !!io);
      console.log(`[QR Code] Dados a emitir:`, JSON.stringify({ id, hasQr: !!qr, connected: false }));
      
      try {
        io.emit('qrcode', qrData);
        console.log(`[QR Code] ✅ Evento 'qrcode' emitido com sucesso para conexão: ${id}`);
      } catch (error: any) {
        console.error(`[QR Code] ❌ Erro ao emitir QR code:`, error.message);
        console.error(`[QR Code] Stack:`, error.stack);
      }
    } else if (connection === 'open') {
      // Limpar timeout se conexão foi aberta
      if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
      }
      console.log(`[Connection Update] ⚠️ Conexão ${id} está 'open' mas não há QR - pode já estar autenticada`);
    } else if (connection === 'connecting') {
      console.log(`[Connection Update] 🔄 Conexão ${id} está 'connecting' - aguardando QR...`);
      // Se está connecting e não há QR ainda, pode ser que o Baileys esteja tentando usar credenciais antigas
      // Vamos aguardar um pouco e verificar se o QR aparece
      
      // Se não há credenciais válidas e está connecting sem QR, pode ser um problema
      if (!connectionHasValidAuth && !qr) {
        console.log(`[Connection Update] ⚠️ ATENÇÃO: Conexão está 'connecting' sem QR e sem credenciais válidas`);
        console.log(`[Connection Update] Isso pode indicar que o Baileys está tentando reconectar mas falhando`);
        console.log(`[Connection Update] Aguardando mais alguns segundos para ver se o QR aparece...`);
      }
    } else if (connection === 'close') {
      console.log(`[Connection Update] 🔴 Conexão ${id} fechada`);
      
      // Verificar o motivo da desconexão
      if (lastDisconnect?.error) {
        const error = lastDisconnect.error as Boom;
        const statusCode = error?.output?.statusCode;
        console.log(`[Connection Update] Motivo da desconexão - statusCode: ${statusCode}`);
        console.log(`[Connection Update] Erro:`, error.message);
        
        // Contar falhas de conexão para evitar loop infinito
        if (error.message?.includes('Connection Failure') || statusCode === 408) {
          const failureCount = (connectionFailureCounts.get(id) || 0) + 1;
          connectionFailureCounts.set(id, failureCount);
          console.log(`[Connection Update] ⚠️ Connection Failure detectado (tentativa ${failureCount}/5)`);
        } else {
          // Resetar contador se não for Connection Failure
          connectionFailureCounts.delete(id);
        }
      }
    } else {
      console.log(`[Connection Update] ℹ️ Conexão ${id} - estado: ${connection}, sem QR code ainda`);
    }
    
    // Tratar mudanças de estado de conexão
    if (connection === 'close') {
      updateConnectionStatus(id, false);
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      
      // Verificar se foi Connection Failure
      const wasConnectionFailure = lastDisconnect?.error && 
        (lastDisconnect.error as Boom).message?.includes('Connection Failure');
      const failureCount = connectionFailureCounts.get(id) || 0;
      
      // Limite máximo de tentativas de reconexão
      const MAX_RETRIES = 5;
      
      if (failureCount >= MAX_RETRIES) {
        console.log(`[Connection Update] ❌ Limite de ${MAX_RETRIES} tentativas atingido para conexão ${id}`);
        console.log(`[Connection Update] ❌ Parando tentativas de reconexão. Verifique a conexão de rede ou tente novamente mais tarde.`);
        removeConnection(id);
        connectionFailureCounts.delete(id);
        // Emitir evento de erro para o frontend
        io.emit('qrcode', {
          id,
          qrcode: null,
          connected: false,
          error: 'Falha na conexão após múltiplas tentativas. Verifique sua conexão de rede.',
        });
      } else if (wasConnectionFailure) {
        // Delay progressivo baseado no número de falhas
        const delay = Math.min(3000 + (failureCount * 2000), 10000); // 3s, 5s, 7s, 9s, 10s (máx)
        console.log(`[Connection Update] ⚠️ Connection Failure - aguardando ${delay}ms antes de reconectar (tentativa ${failureCount + 1}/${MAX_RETRIES})`);
        
        removeConnection(id);
        setTimeout(() => {
          addConnection(id).catch(err => {
            console.error(`[Connection Update] ❌ Erro ao reconectar:`, err.message);
          });
        }, delay);
      } else if (shouldReconnect) {
        console.log(`[Connection Update] Tentando reconectar...`);
        removeConnection(id);
        // Aguardar um pouco antes de reconectar
        setTimeout(() => {
          addConnection(id).catch(err => {
            console.error(`[Connection Update] ❌ Erro ao reconectar:`, err.message);
          });
        }, 2000);
      } else {
        // LoggedOut - limpar sessão e não reconectar automaticamente
        console.log(`[Connection Update] 🔒 Usuário deslogado - limpando sessão`);
        const authDir = path.resolve(
          process.cwd(),
          'auth_info_baileys',
          id,
        );
        fs.rm(authDir, { recursive: true, force: true }, err => {
          if (err) {
            console.log(err);
          }
          console.log(`${authDir} is deleted!`);
        });
        removeConnection(id);
        io.emit('qrcode', {
          id,
          qrcode: null,
          connected: false,
          error: 'Sessão encerrada. Escaneie o QR code novamente para reconectar.',
        });
      }
    } else if (connection === 'open') {
      console.log('Conexão aberta para o usuário', id);
      updateConnectionStatus(id, true);
      // Resetar contador de falhas quando conexão é aberta com sucesso
      connectionFailureCounts.delete(id);
      io.emit('qrcode', {
        id,
        qrcode: null,
        connected: true,
      });
    } else if (connection === 'connecting') {
      console.log(`[Connection] Conexão ${id} está conectando...`);
    }
  });
  sock.ev.on('messages.upsert', async (m: { type: string; messages: any[] }) => {
    console.log(
      'messages.upsert>>>>>>>>',
      new Date().toISOString(),
      JSON.stringify(m, undefined, 2),
    );

    try {
      if (m.type !== 'notify' || !m.messages?.length) {
        return;
      }

      for (const msg of m.messages) {
        const remoteJid = msg.key?.remoteJid;
        
        // Processar mensagens individuais (não-grupo) RECEBIDAS para webhook
        if (remoteJid && remoteJid.endsWith('@s.whatsapp.net')) {
          // Ignorar mensagens enviadas por nós (fromMe = true)
          if (msg.key?.fromMe) {
            continue;
          }

          const from = remoteJid;
          const messageId = msg.key?.id || 'unknown';
          const messageText =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            '';
          
          if (messageText && messageText.trim()) {
            console.log('[Webhook] Mensagem individual RECEBIDA:', {
              from,
              messageId,
              messageTextLength: messageText.length,
              connectionId: id,
              fromMe: msg.key?.fromMe,
              timestamp: new Date().toISOString(),
            });
            await forwardToWebhook(id, from, messageId, messageText);
          } else {
            console.log('[Webhook] Mensagem individual sem texto (mídia), ignorando:', {
              from,
              messageId,
              connectionId: id,
              hasConversation: !!msg.message?.conversation,
              hasExtendedText: !!msg.message?.extendedTextMessage,
              hasImage: !!msg.message?.imageMessage,
              hasVideo: !!msg.message?.videoMessage,
              messageKeys: msg.message ? Object.keys(msg.message) : [],
            });
          }
          
          continue;
        }
        
if (!remoteJid || !remoteJid.endsWith('@g.us')) {
          continue;
        }

        const groupId = remoteJid!;
        const sender = msg.pushName || msg.key?.participant || 'Desconhecido';

        let groupName = groupNameCache.get(groupId);
        if (!groupName) {
          try {
            const groupMetadata = await sock.groupMetadata(groupId);
            groupName = groupMetadata?.subject || 'Grupo sem nome';
            groupNameCache.set(groupId, groupName);
          } catch (error) {
            console.log(
              `Não foi possível obter metadata do grupo ${groupId}:`,
              error,
            );
            groupName = 'Grupo sem nome';
          }
        }

        groupName = groupName ?? 'Grupo sem nome';

        const messageTimestamp = msg.messageTimestamp
          ? Number(msg.messageTimestamp) * 1000
          : Date.now();

        try {
          await saveGroupInfo({
            sessionId: id,
            groupId,
            groupName,
            lastMessageAt: new Date(messageTimestamp),
          });
        } catch (error) {
          console.error(
            `Falha ao salvar informações do grupo ${groupId}:`,
            error,
          );
        }

        console.log(
          '🔔 [GRUPO DETECTADO] ID:',
          groupId,
          '| Nome:',
          groupName,
          '| Remetente:',
          sender,
        );

        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          '[Mídia ou mensagem especial]';

        messageStore.addMessage(groupId, sender, messageText, messageTimestamp);
      }
    } catch (error) {
      console.error('[ERRO] Falha ao processar mensagem:', error);
    }
  });
  connections.push({
    id,
    connection: sock,
    connected: false,
  });
  
  console.log(`[addConnection] ✅ Conexão ${id} adicionada à lista. Total de conexões: ${connections.length}`);
  console.log(`[addConnection] ⏳ Aguardando eventos do Baileys (connection.update, qr, etc)...`);
  console.log(`[addConnection] ========== FIM DA INICIALIZAÇÃO ==========`);
};

const connect = async (): Promise<void> => {
    await addConnection(process.env.IDENTIFICATION ?? 'mensageria');
};

export const getConnection = (id: string): any => {
  const connection = connections.find(c => c.id === id);
  if (!connection) {
    throw new Error('connection not found');
  }
  return connection.connection;
};

export const listConnections = (): Array<{ id: string; connected: boolean }> =>
  connections.map(({ id: connectionId, connected }) => ({
    id: connectionId,
    connected,
  }));

interface SendMessageParamsInterface {
  toPhone: string;
  message: string;
  identification?: string;
  /** URL pública da mídia (Baileys faz fetch). Opcional. */
  mediaUrl?: string;
  /** Tipo da mídia. Quando definido junto com mediaUrl, sobrescreve o envio de texto. */
  mediaType?: 'image' | 'document' | 'audio';
  /** Nome do arquivo exibido (usado em document). Default: "arquivo". */
  mediaFileName?: string;
  /** Mimetype da mídia (usado em document/audio). Defaults razoáveis aplicados. */
  mediaMimeType?: string;
}
interface TemplateButtonInterface {
  index: number;
  urlButton?: {
    displayText: string;
    url: string;
  };
  callButton?: {
    displayText: string;
    phoneNumber: string;
  };
  quickReplyButton?: {
    displayText: string;
    id: 'id-like-buttons-message';
  };
}

interface ButtonInterface {
  buttonId: string;
  buttonText: {
    displayText: string;
    phoneNumber?: string;
    url?: string;
  };
  type: number;
}
export interface ButtonMessageInterface {
  text: string;
  footer?: string;
  buttons: ButtonInterface[];
  headerType: number;
  image?: {
    url: string;
  };
}

export interface TemplateMessageInterface {
  text: string;
  footer?: string;
  templateButtons?: TemplateButtonInterface[];
  buttonMessage?: TemplateButtonInterface[];
  image?: {
    url: string;
  };
  viewOnce?: boolean;
}

export const sendMessage = async ({
  toPhone,
  message,
  identification,
  mediaUrl,
  mediaType,
  mediaFileName,
  mediaMimeType,
}: SendMessageParamsInterface): Promise<void> => {
  // Validação rigorosa do destinatário
  if (!toPhone || typeof toPhone !== 'string' || toPhone.trim() === '') {
    console.error('[sendMessage] Erro: toPhone inválido:', toPhone);
    throw new Error('Destinatário (toPhone) é obrigatório e deve ser uma string não vazia');
  }
  
  const trimmedPhone = toPhone.trim();
  
  console.log('[sendMessage] Iniciando envio:', { 
    toPhone: trimmedPhone,
    toPhoneOriginal: toPhone,
    toPhoneLength: trimmedPhone.length,
    identification,
    timestamp: new Date().toISOString(),
  });
  
  const connectionId = identification || process.env.IDENTIFICATION || 'mensageria';
  const connection = getConnection(connectionId)
  
  if (!connection) {
    console.error('[sendMessage] Conexão não encontrada:', connectionId);
    throw new Error('Conexão não encontrada para envio de mensagem!');
  }
  
  console.log('[sendMessage] Conexão encontrada:', connectionId);
  
  // Usar o telefone já validado e trimado
  let phoneNumber = trimmedPhone.replace(/[^0-9]+/g, '');
  
  if (!phoneNumber || phoneNumber.length === 0) {
    console.error('[sendMessage] Erro: phoneNumber vazio após limpeza:', { toPhone, trimmedPhone });
    throw new Error('Número de telefone inválido após formatação');
  }
  if (phoneNumber.length === 11) {
    phoneNumber = `55${phoneNumber.slice(0, 2)}${phoneNumber.slice(3, 11)}`;
  } else if (phoneNumber.length === 13) {
    phoneNumber = `${phoneNumber.slice(0, 4)}${phoneNumber.slice(5, 13)}`;
  }
  
  console.log('[sendMessage] Número formatado:', phoneNumber);

  // Tentar verificar se o número está no WhatsApp com timeout
  try {
    console.log('[sendMessage] Verificando se número está no WhatsApp...');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT_CHECK')), 10000);
    });
    
    const [isWhatsapp] = await Promise.race([
      connection.onWhatsApp(phoneNumber),
      timeoutPromise
    ]);
    
    console.log('[sendMessage] Resultado verificação:', isWhatsapp);
    
    if (isWhatsapp?.exists) {
      phoneNumber = isWhatsapp.jid
      console.log('[sendMessage] Número válido, JID:', phoneNumber);
    } else {
      console.error('[sendMessage] Número não cadastrado:', phoneNumber);
      throw new Error('Este número não está cadastrado no Whatsapp')
    }
  } catch (error: any) {
    if (error.message === 'TIMEOUT_CHECK') {
      // Se timeout na verificação, tenta enviar mesmo assim com formato padrão
      console.warn('[sendMessage] Timeout na verificação, tentando enviar sem validação...');
      phoneNumber = `${phoneNumber}@s.whatsapp.net`;
    } else {
      throw error;
    }
  }

  // Enviar mensagem com timeout
  try {
    console.log('[sendMessage] Enviando mensagem para:', {
      phoneNumber,
      phoneNumberLength: phoneNumber.length,
      messageLength: message.length,
      connectionId,
      timestamp: new Date().toISOString(),
    });
    
    const sendTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout ao enviar mensagem')), 15000);
    });
    
    // Validar novamente antes de enviar
    if (!phoneNumber || phoneNumber.length === 0) {
      throw new Error('Número de telefone inválido: está vazio');
    }
    
    // Monta o conteúdo Baileys conforme houver (ou não) mídia anexada.
    // Para image/document a `message` vira legenda; audio ignora texto.
    let content: any;
    if (mediaUrl && mediaType === 'image') {
      content = { image: { url: mediaUrl }, caption: message || undefined };
    } else if (mediaUrl && mediaType === 'document') {
      content = {
        document: { url: mediaUrl },
        mimetype: mediaMimeType || 'application/pdf',
        fileName: mediaFileName || 'arquivo',
        caption: message || undefined,
      };
    } else if (mediaUrl && mediaType === 'audio') {
      content = { audio: { url: mediaUrl }, mimetype: mediaMimeType || 'audio/mp4' };
    } else {
      content = { text: message };
    }

    const sended = await Promise.race([
      connection.sendMessage(phoneNumber, content),
      sendTimeoutPromise
    ]);
    
    console.log('[sendMessage] Mensagem enviada com sucesso:', {
      phoneNumber,
      messageId: sended?.key?.id,
      timestamp: new Date().toISOString(),
    });
    return sended;
    
  } catch (error: any) {
    console.error('[sendMessage] Erro ao enviar:', {
      error: error.message,
      phoneNumber,
      connectionId,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

export default connect;
