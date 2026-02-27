// Load environment variables FIRST, before any other imports
import 'dotenv/config';

// Fix SSL certificate issues in development
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import app from './app.js';
import socket from './libs/socket.js';
import connect from './services/Baileys/index.js';
import tokenCache from './services/tokenCache.js';

const port = process.env.PORT || process.env.LOCAL_PORT || 3333;
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(Number(port), host, () => {
  console.log(`🚀 Server started on ${host}:${port}!`);
});
socket.init(server);

// Initialize token cache for multi-tenant support
tokenCache.initialize().then(() => {
  console.log('🔐 Token cache initialized');
}).catch(err => {
  console.warn('⚠️ Token cache initialization failed (will retry periodically):', err.message);
});

// Start WhatsApp connection
connect();
