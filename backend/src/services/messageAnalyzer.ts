import { geminiService } from './geminiService.js';
import { messageStore } from './messageStore.js';

export async function analyzeMessages(groupId: string, question: string, geminiApiKey: string): Promise<string> {
  // Inicializa Gemini se necessário
  if (!geminiService.isInitialized()) {
    geminiService.initialize(geminiApiKey);
  }

  // Busca mensagens do grupo
  const messages = messageStore.getMessages(groupId);

  if (messages.length === 0) {
    return 'Não há mensagens disponíveis para análise neste grupo.';
  }

  // Formata mensagens para o contexto
  const formattedMessages = messages
    .map(msg => {
      const time = msg.timestamp.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return `[${time}] ${msg.sender}: ${msg.message}`;
    })
    .join('\n');

  const prompt = `Você é um assistente que analisa conversas de grupos do WhatsApp.

Contexto - Mensagens do grupo hoje:
${formattedMessages}

Pergunta do usuário: ${question}

Analise as mensagens acima e responda à pergunta de forma clara e objetiva. Se a pergunta não puder ser respondida com base nas mensagens, informe isso educadamente.`;

  try {
    const response = await geminiService.generateSummary([{
      timestamp: new Date(),
      sender: 'System',
      message: prompt
    }]);
    
    return response;
  } catch (error: any) {
    throw new Error(`Erro ao analisar mensagens: ${error.message}`);
  }
}
