import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { addConnection } from '../services/Baileys';

let io: Server;

export default {
  init: (httpServer: HttpServer): void => {
    io = new Server(httpServer, { cors: { origin: '*' } });
    io.on('connection', (socket: Socket) => {
      console.log('WebSocket conectado!');
      
      // Handler para requestQRCode - cria/inicia conexão Baileys
      socket.on('requestQRCode', async (data: { identification: string }) => {
        try {
          console.log('[Socket.IO] requestQRCode recebido para:', data.identification);
          if (!data.identification) {
            console.error('[Socket.IO] Identification não fornecida');
            return;
          }
          
          // Chama addConnection que vai gerar o QR Code
          await addConnection(data.identification);
          console.log('[Socket.IO] addConnection chamado para:', data.identification);
        } catch (error: any) {
          console.error('[Socket.IO] Erro ao processar requestQRCode:', error.message);
        }
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
