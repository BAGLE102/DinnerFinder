// src/controller/postback.js
import service from '../service/index.js';
import {
  restaurantsCarousel,
  quickReply,
  moreQuickItem,
  randomMoreQuickItem,
  restaurantBubble,
} from '../util/lineFlex.js';
import exploreRestaurant, { exploreByNextToken } from '../service/exploreRestaurant.js';
import bulkUpsertRestaurants from '../service/bulkUpsertRestaurants.js';
import { loadPostback, savePostback } from '../model/postbackState.js';

// 注意：本函式簽名是 (client, event)
// 若你的 index.js 目前是呼叫 controller.postback(event)，請改為 controller.postback(client, event)
export default async function onPostback(client, event) {
  // ---- 安全解析 postback.data：先嘗試 URLSearchParams，不行再 JSON ----
  const raw = event?.postback?.data || '';
  let payload = {};
  try {
    // 多數情況是 querystring 格式：action=xxx&key=yyy
    payload = Object.fromEntries(new URLSearchParams(raw));
  } catch { /* ignore */ }
  if (!payload || Object.keys(payload).length === 0) {
    try { payload = JSON.parse(raw); } catch { payload = {}; }
  }

  const action = (payload.action || '').toLowerCase();
  const name = payload.name ? decodeURIComponent(payload.name) : '';

  // === 加入清單 ===
  if (action === 'add') {
    const r = await service.addRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // === 就吃這間（選擇）===
  if (action === 'choose') {
    const r = await service.chooseRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // === 探索 → 再 10 間（用短 key 取回 next_page_token）===
  if (action === 'explore_more') {
    const state = await loadPostback(payload.key);
    if (!state) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '列表已過期，請重新輸入「探索 1500」之類的指令 🙏',
        quickReply: quickReply()
      });
    }

    const resp = await exploreByNextToken(state.userId || event.source.userId, state.nextPageToken, 10);
    if (!resp.ok) {
      return client.replyMessage(event.replyToken, { type: 'text', text: resp.text, quickReply: quickReply() });
    }

    // 寫入 DB（這 10 間）
    try {
      const ownerUserId = event.source?.groupId || event.source?.roomId || event.source?.userId;
      await bulkUpsertRestaurants(ownerUserId, resp.results);
    } catch (e) {
      console.error('[bulkUpsert explore_more]', e?.message);
    }

    // 還有下一頁 → 再存一次短 key
    const extras = [];
    if (resp.nextPageToken) {
      const key = await savePostback({
        type: 'explore_more',
        nextPageToken: resp.nextPageToken,
        radius: state.radius,
        keyword: state.keyword,
        lat: state.lat,
        lng: state.lng,
        userId: event.source.userId,
      }, { userId: event.source.userId, ttlSec: 600 });

      extras.push(moreQuickItem(key, event.source.userId));
    }

    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `更多餐廳（${resp.results.length} 間）`,
      contents: restaurantsCarousel(resp.results),
      quickReply: extras.length ? { items: extras } : undefined
    });
  }

  // === 隨機 → 再選一間（用同半徑重新抽）===
  if (action === 'random_more') {
    const radius = Number(payload.radius) || 1500;
    const lineUserId = event.source.userId;

    const resp = await exploreRestaurant(lineUserId, radius, { limit: 20 });
    if (!resp.ok) {
      return client.replyMessage(event.replyToken, { type: 'text', text: resp.text, quickReply: quickReply() });
    }

    try {
      const ownerUserId = event.source?.groupId || event.source?.roomId || event.source?.userId;
      await bulkUpsertRestaurants(ownerUserId, resp.results);
    } catch (e) {
      console.error('[bulkUpsert random_more]', e?.message);
    }

    const picked = resp.results[Math.floor(Math.random() * resp.results.length)];
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `再選一間：${picked?.name || '這間'}`,
      contents: restaurantBubble(picked),
      quickReply: { items: [randomMoreQuickItem(radius)] }
    });
  }

  // 其他未處理 action：回傳內容幫你偵錯
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `postback: ${JSON.stringify(payload)}`,
    quickReply: quickReply()
  });
}
