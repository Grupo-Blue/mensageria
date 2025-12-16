/**
 * Token Cache Service
 * Caches valid API tokens for multi-tenant authentication
 * Syncs with frontend database periodically
 */

interface CachedConnection {
  id: number;
  identification: string;
  apiKey: string;
  userId: number;
  webhookUrl: string | null;
  webhookSecret: string | null;
  status: string;
}

interface TokenCache {
  connections: Map<string, CachedConnection>; // apiKey -> connection
  connectionsByIdentification: Map<string, CachedConnection>; // identification -> connection
  lastSync: number;
}

const SYNC_INTERVAL_MS = 60000; // Sync every 60 seconds

class TokenCacheService {
  private cache: TokenCache = {
    connections: new Map(),
    connectionsByIdentification: new Map(),
    lastSync: 0,
  };

  private syncInProgress = false;

  /**
   * Initialize the cache by syncing with frontend
   */
  async initialize(): Promise<void> {
    await this.syncFromFrontend();

    // Setup periodic sync
    setInterval(() => {
      this.syncFromFrontend().catch(err => {
        console.error('[TokenCache] Periodic sync failed:', err.message);
      });
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Sync tokens from frontend database
   */
  async syncFromFrontend(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Read env vars at runtime, not module load time
      const frontendUrl = process.env.FRONTEND_API_URL || 'http://localhost:3000';
      const internalToken = process.env.INTERNAL_SYNC_TOKEN || process.env.X_AUTH_API;

      console.log('[TokenCache] Config:', { 
        frontendUrl, 
        hasToken: !!internalToken,
        tokenPrefix: internalToken?.substring(0, 8) 
      });

      if (!internalToken) {
        console.warn('[TokenCache] No sync token configured, using local cache only');
        return;
      }

      const response = await fetch(`${frontendUrl}/api/internal/connections`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalToken,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { connections: CachedConnection[] };

      // Clear and rebuild cache
      this.cache.connections.clear();
      this.cache.connectionsByIdentification.clear();

      for (const conn of data.connections) {
        if (conn.apiKey) {
          this.cache.connections.set(conn.apiKey, conn);
        }
        this.cache.connectionsByIdentification.set(conn.identification, conn);
      }

      this.cache.lastSync = Date.now();
      console.log(`[TokenCache] Synced ${data.connections.length} connections from frontend`);
    } catch (error: any) {
      console.error('[TokenCache] Sync from frontend failed:', error.message);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Validate an API key and return the associated connection
   */
  validateApiKey(apiKey: string): CachedConnection | null {
    return this.cache.connections.get(apiKey) || null;
  }

  /**
   * Get connection by identification (name)
   */
  getConnectionByIdentification(identification: string): CachedConnection | null {
    return this.cache.connectionsByIdentification.get(identification) || null;
  }

  /**
   * Add or update a connection in the cache (for real-time updates)
   */
  upsertConnection(connection: CachedConnection): void {
    if (connection.apiKey) {
      this.cache.connections.set(connection.apiKey, connection);
    }
    this.cache.connectionsByIdentification.set(connection.identification, connection);
  }

  /**
   * Remove a connection from the cache
   */
  removeConnection(identification: string): void {
    const conn = this.cache.connectionsByIdentification.get(identification);
    if (conn) {
      if (conn.apiKey) {
        this.cache.connections.delete(conn.apiKey);
      }
      this.cache.connectionsByIdentification.delete(identification);
    }
  }

  /**
   * Get all cached connections
   */
  getAllConnections(): CachedConnection[] {
    return Array.from(this.cache.connectionsByIdentification.values());
  }

  /**
   * Get webhook config for a connection
   */
  getWebhookConfig(identification: string): { url: string | null; secret: string | null } | null {
    const conn = this.cache.connectionsByIdentification.get(identification);
    if (!conn) {
      return null;
    }
    return {
      url: conn.webhookUrl,
      secret: conn.webhookSecret,
    };
  }

  /**
   * Check if cache needs refresh
   */
  needsRefresh(): boolean {
    return Date.now() - this.cache.lastSync > SYNC_INTERVAL_MS;
  }

  /**
   * Force cache refresh
   */
  async forceRefresh(): Promise<void> {
    await this.syncFromFrontend();
  }
}

const tokenCache = new TokenCacheService();

export default tokenCache;


