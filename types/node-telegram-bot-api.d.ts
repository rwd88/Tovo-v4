// src/types/node-telegram-bot-api.d.ts
declare module 'node-telegram-bot-api' {
  interface SendMessageOptions {
    parse_mode?: string;
    disable_web_page_preview?: boolean;
    // add other options as you need them
  }
  class TelegramBot {
    constructor(token: string, options?: { polling: boolean });
    sendMessage(chatId: string | number, text: string, opts?: SendMessageOptions): Promise<any>;
    // add other methods you use (sendPhoto, etc.)
  }
  export default TelegramBot;
}
