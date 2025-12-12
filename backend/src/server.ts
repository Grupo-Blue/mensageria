import 'dotenv/config';
import app from './app';
import socket from './libs/socket';
import connect from './services/Baileys';
import tokenCache from './services/tokenCache';

const port = process.env.PORT || process.env.LOCAL_PORT || 3333;
const server = app.listen(port, () => {
  console.log(`🚀 Server started on port ${port}!`);
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
