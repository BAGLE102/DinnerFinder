// service/exploreRestaurant.js
// - 統一產生合法 Flex 訊息
// - 並提供 sendExplore / sendRandom 讓 controller/postback.js 可直接呼叫

import { buildFlexMessage, placeToBubble } from '../util/lineFlex.js';

/**
 * 建立探索清單 Flex 訊息
 */
export async function buildExploreMessage({ places = [] } = {}) {
  const msg = buildFlexMessage({ places, altText: `找到 ${places.length} 家餐廳` });
  try {
    const payloadStr = JSON.stringify(msg);
    console.log(
      `[buildExploreMessage] places=${places.length}, bytes=${Buffer.byteLength(payloadStr)}`
    );
  } catch (e) {
    console.warn('[buildExploreMessage] stringify error:', e?.message || e);
  }
  return [msg];
}

/**
 * 建立隨機推薦 Flex 訊息
 */
export function buildRandomMessage(places = []) {
  if (!places.length) {
    return [{ type: 'text', text: '找不到可以隨機的餐廳，換個範圍或關鍵字？' }];
  }
  const pick = places[Math.floor(Math.random() * places.length)];
  const bubble = placeToBubble(pick);
  return [{
    type: 'flex',
    altText: `推薦：${pick?.name || '隨機餐廳'}`,
    contents: { type: 'carousel', contents: [bubble] }
  }];
}

/**
 * 供 postback.js 舊程式呼叫：直接送出探索訊息
 * 用法預期：await sendExplore(client, replyToken, { places })
 */
export async function sendExplore(client, replyToken, args = {}) {
  const messages = await buildExploreMessage(args);
  try {
    await client.replyMessage(replyToken, messages);
  } catch (e) {
    console.error('[LINE reply error]', e.response?.status, JSON.stringify(e.response?.data || e.message));
    throw e;
  }
}

/**
 * 供 postback.js 舊程式呼叫：直接送出隨機訊息
 * 用法預期：await sendRandom(client, replyToken, places)
 */
export async function sendRandom(client, replyToken, places = []) {
  const messages = buildRandomMessage(places);
  try {
    await client.replyMessage(replyToken, messages);
  } catch (e) {
    console.error('[LINE reply error]', e.response?.status, JSON.stringify(e.response?.data || e.message));
    throw e;
  }
}
