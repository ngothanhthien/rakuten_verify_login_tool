import TelegramBot from 'node-telegram-bot-api';
import IUiNotifier from '../../application/ports/IUiNotifier';
import { NotifyOptions } from '../../types/core';

export default class TelegramNotifier implements IUiNotifier {
  private bot: TelegramBot;
  private channelId: string;

  constructor() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '8510751142:AAETyniNU22xF5O8WNulIb1CpheEE-dA5yY';
    const channelId = process.env.TELEGRAM_CHANNEL_ID || '-1003470779641';
    
    this.bot = new TelegramBot(botToken, { polling: false });
    this.channelId = channelId;
  }

  notify(message: string, options?: NotifyOptions): void {
    // Format message with color indicators if provided
    let formattedMessage = message;
    
    if (options?.color === 'green') {
      formattedMessage = `✅ ${message}`;
    } else if (options?.color === 'red') {
      formattedMessage = `❌ ${message}`;
    }

    // Send message asynchronously without blocking
    this.bot.sendMessage(this.channelId, formattedMessage, {
      parse_mode: 'HTML'
    }).catch((error) => {
      console.error('Failed to send Telegram notification:', error.message);
    });
  }
}
