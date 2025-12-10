import 'dotenv/config';
import app from './app';
import socket from './libs/socket';
import connect from './services/Baileys';
import { getPort, getEnv } from './config/env';

const port = getPort();
const env = getEnv();

const server = app.listen(port, () => {
  console.log(`🚀 Server started on port ${port}!`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`📚 Docs available at http://localhost:${port}/docs`);
  console.log(`💚 Health check at http://localhost:${port}/health`);
});

socket.init(server);
connect();

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }

    console.log('Server closed. Exiting...');
    process.exit(0);
  });

  // Força encerramento após 10 segundos
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
