import { Telegraf } from 'telegraf'

const { TELEGRAM_BOT_TOKEN } = process.env

interface PropsInterface {
  telegramUserId: string
  message: string
}

export const sendMessage = async ({
  telegramUserId, message
}: PropsInterface) => {
  if (!TELEGRAM_BOT_TOKEN) {
    return
  }
  const bot = new Telegraf(TELEGRAM_BOT_TOKEN)
  await bot.telegram.sendMessage(telegramUserId, message, {
      parse_mode: 'Markdown',
  })
}
