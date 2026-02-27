import { Request, Response } from 'express';
import { addConnection } from '../../services/Baileys/index.js';

const createConnection = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { identification } = req.body;
    
    if (!identification) {
      throw new Error('Necessário enviar o campo identification');
    }
    
    // Adiciona nova conexão Baileys
    await addConnection(identification);
    
    return res.json({
      success: true,
      identification,
      message: 'Conexão criada com sucesso. Aguarde o QR Code via WebSocket.'
    });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({
      error: 'Erro no servidor'
    });
  }
};

export default createConnection;
