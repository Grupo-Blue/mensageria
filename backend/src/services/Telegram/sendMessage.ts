import { Telegraf } from 'telegraf'

const { TELEGRAM_BOT_TOKEN } = process.env

interface PropsInterface {
  telegramUserId: string
  message: string
}

export const sendMessage = async ({
  telegramUserId, message
}: PropsInterface) => {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.trim() === '') {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN não configurado. Mensagem não enviada.');
    return
  }

  try {
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN.trim())
    await bot.telegram.sendMessage(telegramUserId, message, {
      parse_mode: 'Markdown',
    })
  } catch (error: any) {
    console.error('[Telegram] Erro ao enviar mensagem:', error.message);
    
    if (error.response?.statusCode === 404 || error.message?.includes('404')) {
      console.error('[Telegram] Token inválido ou bot não encontrado.');
    } else if (error.response?.statusCode === 400) {
      console.error('[Telegram] ID de usuário inválido ou usuário não encontrado.');
    } else {
      console.error('[Telegram] Erro ao enviar mensagem:', error);
    }
    throw error;
  }
}
