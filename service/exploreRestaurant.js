// service/exploreRestaurant.js
// 匯出 buildExploreMessage / buildRandomMessage（呼叫 util/lineFlex 產生合法 Flex）

import { buildFlexMessage, placeToBubble } from '../util/lineFlex.js';

/**
 * 建立探索清單的 Flex 訊息
 * @param {Object} args
 * @param {string=} args.userId
 * @param {number=} args.lat
 * @param {number=} args.lng
 * @param {number=} args.radius
 * @param {Array<Object>} args.places  // 你查到的地點資料（已經整理成 name/rating/distance/addr/photoUrl/mapUrl）
 * @param {string=} args.nextPageToken // 目前不再塞進 postback（避免 >300 bytes），由文字 "再 10 間" 事件去處理
 * @returns {Array<Object>} LINE messages
 */
export async function buildExploreMessage({
  userId, lat, lng, radius, places = [], nextPageToken
} = {}) {
  // 這裡不把 nextPageToken 放進 postback（曾導致 400），請在 controller 的文字事件 "再 10 間" 去讀取下一頁
  const msg = buildFlexMessage({
    places,
    altText: `找到 ${places.length} 家餐廳`
  });

  // 簡單紀錄（避免 payload 太大時不好追）
  try {
    const payloadStr = JSON.stringify(msg);
    console.log(`[buildExploreMessage] places=${places.length}, bytes=${Buffer.byteLength(payloadStr)}`);
  } catch (e) {
    console.warn('[buildExploreMessage] stringify error:', e?.message || e);
  }

  return [msg];
}

/**
 * 隨機推薦一間
 * @param {Array<Object>} places
 * @returns {Array<Object>} LINE messages
 */
export function buildRandomMessage(places = []) {
  if (!places.length) {
    return [{
      type: 'text',
      text: '找不到可以隨機的餐廳，換個範圍或關鍵字？'
    }];
  }
  const pick = places[Math.floor(Math.random() * places.length)];
  // 單獨 bubble 也可以直接當作一則 flex
  const bubble = placeToBubble(pick);
  const msg = {
    type: 'flex',
    altText: `推薦：${pick?.name || '隨機餐廳'}`,
    contents: { type: 'carousel', contents: [bubble] }
  };
  return [msg];
}
