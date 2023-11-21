import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

let io: Server;

export default {
  init: (httpServer: HttpServer): void => {
    io = new Server(httpServer, { cors: { origin: '*' } });
    io.on('connection', () => {
      console.log('WebSocket conectado!');
    });
  },
  getIO: (): Server => {
    if (!io) {
      throw new Error('Socket IO não inicializado');
    }
    return io;
  },
};
