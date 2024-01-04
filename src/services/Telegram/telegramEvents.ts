import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters'
import axios from 'axios'

export const telegramEvents = async () => {
  const { TELEGRAM_BOT_TOKEN, SYSTEM_NAME, TELEGRAM_CALL_BACK_URL_TO_SEND_USER_ID } = process.env
  if (TELEGRAM_BOT_TOKEN) {
    const bot = new Telegraf(TELEGRAM_BOT_TOKEN)
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
    bot.launch()
  }
}
