// src/config/line.js
import line from '@line/bot-sdk';

// 允許多種環境變數名稱，至少要有這兩個
const channelAccessToken =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  process.env.CHANNEL_ACCESS_TOKEN ||
  process.env.LINE_ACCESS_TOKEN;

const channelSecret =
  process.env.LINE_CHANNEL_SECRET ||
  process.env.CHANNEL_SECRET ||
  process.env.LINE_SECRET;

if (!channelAccessToken) {
  throw new Error('LINE_CHANNEL_ACCESS_TOKEN is required');
}
if (!channelSecret) {
  throw new Error('LINE_CHANNEL_SECRET is required');
}

// LINE SDK 用戶端
export const client = new line.Client({ channelAccessToken, channelSecret });
export const lineClient = client; // 給可能用到的別名

// middleware（如果你的 index.js 有用到）
export const middleware = line.middleware({ channelSecret });

// 方便呼叫的封裝
export function reply(replyToken, messages, notificationDisabled = false) {
  const arr = Array.isArray(messages) ? messages : [messages];
  return client.replyMessage(replyToken, arr, { notificationDisabled });
}

export function push(to, messages, notificationDisabled = false) {
  const arr = Array.isArray(messages) ? messages : [messages];
  return client.pushMessage(to, arr, { notificationDisabled });
}
