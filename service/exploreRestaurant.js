// service/exploreRestaurant.js
// - 輸出 buildExploreMessage / buildRandomMessage（給 message controller 用）
// - 輸出 sendExplore / sendRandom（給 postback controller 用）
// - 只專心把「已經準備好的 places 陣列」包成合法 Flex 並回覆

import { buildFlexMessage, placeToBubble } from '../util/lineFlex.js';

/** 建立探索清單 Flex 訊息陣列 */
export async function buildExploreMessage({ places = [] } = {}) {
  const msg = buildFlexMessage({ places, altText: `找到 ${places.length} 家餐廳` });
  try {
    const payloadStr = JSON.stringify(msg);
    console.log(`[buildExploreMessage] places=${places.length}, bytes=${Buffer.byteLength(payloadStr)}`);
  } catch (_) {}
  return [msg];
}

/** 建立隨機推薦 Flex 訊息陣列 */
export function buildRandomMessage(places = []) {
  if (!places || places.length === 0) {
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

/** 直接回覆探索清單（給 controller/postback.js 舊程式呼叫） */
export async function sendExplore(client, replyToken, { places = [] } = {}) {
  const messages = await buildExploreMessage({ places });
  try {
    await client.replyMessage(replyToken, messages);
  } catch (e) {
    console.error('[LINE reply error]', e.response?.status, JSON.stringify(e.response?.data || e.message));
    throw e;
  }
}

/** 直接回覆隨機推薦（給 controller/postback.js 舊程式呼叫） */
export async function sendRandom(client, replyToken, places = []) {
  const messages = buildRandomMessage(places);
  try {
    await client.replyMessage(replyToken, messages);
  } catch (e) {
    console.error('[LINE reply error]', e.response?.status, JSON.stringify(e.response?.data || e.message));
    throw e;
  }
}
