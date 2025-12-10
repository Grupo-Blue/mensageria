import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeminiConfig {
  apiKey: string;
}

interface Message {
  timestamp: Date;
  sender: string;
  message: string;
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  initialize(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API Key do Google Gemini não configurada');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    console.log('[GeminiService] Inicializado com sucesso');
  }

  async generateSummary(messages: Message[]): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini não foi inicializado. Configure a API Key primeiro.');
    }

    if (messages.length === 0) {
      return 'Nenhuma mensagem foi enviada hoje neste grupo.';
    }

    // Formatar mensagens para o prompt
    const formattedMessages = messages
      .map(msg => {
        const time = msg.timestamp.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return `[${time}] ${msg.sender}: ${msg.message}`;
      })
      .join('\n');

    const prompt = `Você é um assistente que cria resumos de conversas de grupos do WhatsApp.

Analise as seguintes mensagens do grupo de hoje e crie um resumo estruturado e informativo:

${formattedMessages}

Crie um resumo seguindo estas diretrizes:
1. Use um tom profissional mas amigável
2. Organize por tópicos principais discutidos
3. Destaque decisões importantes tomadas
4. Mencione perguntas que ficaram sem resposta
5. Liste tarefas ou ações mencionadas
6. Use emojis relevantes para tornar mais visual
7. Seja conciso mas completo

Formato do resumo:
📊 *RESUMO DO DIA - ${new Date().toLocaleDateString('pt-BR')}*

[Seu resumo aqui]

Total de mensagens: ${messages.length}`;

    try {
      console.log('[GeminiService] Gerando resumo...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();
      
      console.log('[GeminiService] Resumo gerado com sucesso');
      return summary;
    } catch (error: any) {
      console.error('[GeminiService] Erro ao gerar resumo:', error);
      throw new Error(`Erro ao gerar resumo: ${error.message}`);
    }
  }

  isInitialized(): boolean {
    return this.model !== null;
  }
}

export const geminiService = new GeminiService();
