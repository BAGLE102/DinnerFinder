// src/config/line.js
import line from '@line/bot-sdk';

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

export { client };

// 小工具：統一回覆（單筆或陣列都可）
export async function reply(replyToken, messages) {
  const arr = Array.isArray(messages) ? messages : [messages];
  return client.replyMessage(replyToken, arr);
}
