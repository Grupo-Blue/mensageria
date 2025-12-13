import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters'
import axios from 'axios'

export const telegramEvents = async () => {
  const { TELEGRAM_BOT_TOKEN, SYSTEM_NAME, TELEGRAM_CALL_BACK_URL_TO_SEND_USER_ID } = process.env
  
  // Validar se o token existe e não está vazio
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.trim() === '') {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN não configurado. Bot do Telegram desabilitado.');
    return;
  }

  // Validar formato básico do token (deve ter formato: número:hash)
  const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
  if (!tokenPattern.test(TELEGRAM_BOT_TOKEN.trim())) {
    console.error('[Telegram] TELEGRAM_BOT_TOKEN inválido. Formato esperado: número:hash');
    console.error('[Telegram] Exemplo: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
    return;
  }

  try {
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN.trim())
    
    bot.start((ctx) => {
      ctx.reply(`Olá ${ctx.from.first_name}! Por favor, nos informe seu e-mail de login no sistema ${SYSTEM_NAME}`)
    })
    
    bot.on(message('text'), async (ctx) => {
      if (ctx?.message?.text?.includes('@')) {
        const telegramUserId = ctx.from.id
        const parts = ctx.message.text.split(' ')
        const email = parts.find(e => e.includes('@'))
        if (email) {
          try {
            await axios.post(TELEGRAM_CALL_BACK_URL_TO_SEND_USER_ID ?? '', {
              email,
              telegramUserId
            })
            ctx.reply(`Bem vindo ${ctx.from.first_name}! A partir de agora você passará a receber nossas notificações via Telegram`)
          } catch (err) {
            console.log(`Não foi possível enviar call back de ${email} para ${TELEGRAM_CALL_BACK_URL_TO_SEND_USER_ID}`)
            ctx.reply(`Não conseguimos contactar nossos sistemas. Por favor, tente novamente mais tarde.`)
          }
        } else {
          ctx.reply(`Por favor, nos informe seu e-mail de login no sistema ${SYSTEM_NAME} corretamente`)
        }
      } else {
        ctx.reply(`Por favor, nos informe seu e-mail de login no sistema ${SYSTEM_NAME}`)
      }
    })

    // Inicializar bot com tratamento de erro
    await bot.launch();
    console.log('[Telegram] Bot inicializado com sucesso!');
    
    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
  } catch (error: any) {
    console.error('[Telegram] Erro ao inicializar bot:', error.message);
    
    if (error.response?.statusCode === 404 || error.message?.includes('404')) {
      console.error('[Telegram] Token inválido ou bot não encontrado.');
      console.error('[Telegram] Verifique se o TELEGRAM_BOT_TOKEN está correto no arquivo .env');
      console.error('[Telegram] Para obter um token válido, acesse @BotFather no Telegram');
    } else if (error.response?.statusCode === 401) {
      console.error('[Telegram] Token não autorizado. Verifique se o token está correto.');
    } else {
      console.error('[Telegram] Erro desconhecido:', error);
    }
  }
}
