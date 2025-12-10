import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { getAllowedOrigins, getEnv } from '../config/env';

let io: Server;

export default {
  init: (httpServer: HttpServer): void => {
    const env = getEnv();
    const allowedOrigins = getAllowedOrigins();

    io = new Server(httpServer, {
      cors: {
        origin: env.NODE_ENV === 'production' && allowedOrigins.length > 0
          ? allowedOrigins
          : true, // Em desenvolvimento, permite todas as origens
        credentials: true,
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log('WebSocket conectado:', socket.id);

      socket.on('disconnect', (reason) => {
        console.log('WebSocket desconectado:', socket.id, reason);
      });

      socket.on('error', (error) => {
        console.error('Erro no WebSocket:', socket.id, error);
      });
    });
  },
  getIO: (): Server => {
    if (!io) {
      throw new Error('Socket IO não inicializado');
    }
    return io;
  },
};
