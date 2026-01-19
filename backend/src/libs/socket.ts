import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { addConnection, logoutConnection } from '../services/Baileys';

let io: Server;

export default {
  init: (httpServer: HttpServer): void => {
    io = new Server(httpServer, { 
      cors: { origin: '*' },
      path: '/socket.io',
      transports: ['polling', 'websocket']
    });
    
    console.log('[Socket.IO] Servidor Socket.IO inicializado no path: /socket.io');
    
    io.on('connection', (socket: Socket) => {
      console.log('[Socket.IO] ✅ Cliente conectado! Socket ID:', socket.id);
      
      // Handler para requestQRCode - cria/inicia conexão Baileys
      socket.on('requestQRCode', async (data: { identification: string; forceNew?: boolean }) => {
        try {
          console.log('[Socket.IO] 📥 requestQRCode recebido para:', data.identification);
          console.log('[Socket.IO] Socket ID:', socket.id);
          console.log('[Socket.IO] forceNew:', data.forceNew || false);
          
          if (!data.identification) {
            console.error('[Socket.IO] ❌ Identification não fornecida');
            socket.emit('qrcode', { connected: false, qrcode: null, error: 'Identification não fornecida' });
            return;
          }
          
          // Se forceNew ou se não especificado, fazer logout primeiro para garantir novo QR
          if (data.forceNew !== false) {
            console.log('[Socket.IO] 🔄 Fazendo logout para forçar novo QR Code...');
            logoutConnection(data.identification);
            // Aguarda um pouco para garantir que os arquivos foram removidos
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          console.log('[Socket.IO] 🔄 Chamando addConnection para:', data.identification);
          // Chama addConnection que vai gerar o QR Code
          await addConnection(data.identification);
          console.log('[Socket.IO] ✅ addConnection concluído para:', data.identification);
          console.log('[Socket.IO] ⏳ Aguardando evento connection.update com QR code...');
        } catch (error: any) {
          console.error('[Socket.IO] ❌ Erro ao processar requestQRCode:', error.message);
          console.error('[Socket.IO] Stack trace:', error.stack);
          socket.emit('qrcode', { connected: false, qrcode: null, error: error.message });
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
