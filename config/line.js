// config/line.js
import line from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

if (!config.channelAccessToken || !config.channelSecret) {
  throw new Error('LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET missing');
}

export const client = new line.Client(config);

// 包一層回覆加強 log
export async function reply(replyToken, messages) {
  try {
    const size = Buffer.byteLength(JSON.stringify(messages));
    console.log(`[line.reply] messages=${Array.isArray(messages) ? messages.length : 1}, bytes=${size}`);
    await client.replyMessage(replyToken, Array.isArray(messages) ? messages : [messages]);
  } catch (err) {
    const body = err?.originalError?.response?.data || err?.response?.data || err?.message;
    console.error('[line.reply] ERROR', body);
    // 為了除錯，把第一則訊息的結構也印一份（截斷）
    const dump = JSON.stringify(Array.isArray(messages) ? messages[0] : messages, null, 2);
    console.error('[line.reply] first message dump (truncated 4KB)=\n', dump.slice(0, 4096));
    throw err;
  }
}
