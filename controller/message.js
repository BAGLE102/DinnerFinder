// src/controller/message.js
import service from '../service/index.js';
import exploreRestaurant from '../service/exploreRestaurant.js';
import bulkUpsertRestaurants from '../service/bulkUpsertRestaurants.js';
import { restaurantsCarousel, restaurantBubble, quickReply, moreQuickItem, randomMoreQuickItem } from '../util/lineFlex.js';

export default async function onMessage(client, event) {
  const msg = event.message;

  // 位置訊息：寫入 DB
  if (msg?.type === 'location') {
    const r = await service.updateUserLocation(event);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  if (msg?.type !== 'text') return null;

  const raw = (msg.text || '').trim();
  const lower = raw.toLowerCase();
  const is = (...keys) => keys.some(k => lower === k || raw === k);

  // 我的餐廳
  if (is('get', '我的餐廳')) {
    try {
      const list = await service.getMyRestaurant(event.source);
      const text = list.length
        ? list.map(r => `• ${r.name}${r.address ? ' - ' + r.address : ''}`).join('\n')
        : '目前清單是空的，用「新增 店名」先加幾家吧～';
      return client.replyMessage(event.replyToken, { type: 'text', text, quickReply: quickReply() });
    } catch (e) {
      console.error(e);
      return client.replyMessage(event.replyToken, { type: 'text', text: '讀取清單失敗。', quickReply: quickReply() });
    }
  }

  // 隨機：若沒帶數字，先提供半徑選單
  if (is('random', '隨機') || lower.startsWith('random ') || raw.startsWith('隨機 ')) {
    const m = raw.match(/(?:random|隨機)\s+(\d+)/i);
    if (!m) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請選擇搜尋半徑（公尺）',
        quickReply: quickReply([
          { type: 'action', action: { type: 'message', label: '1500', text: 'random 1500' } },
          { type: 'action', action: { type: 'message', label: '3000', text: 'random 3000' } },
          { type: 'action', action: { type: 'message', label: '5000', text: 'random 5000' } }
        ])
      });
    }

    const radius = Number(m[1]);
    const lineUserId = event.source.userId;
    const resp = await exploreRestaurant(lineUserId, radius, { limit: 20 });
    if (!resp.ok) {
      return client.replyMessage(event.replyToken, { type: 'text', text: resp.text, quickReply: quickReply() });
    }

    // 寫進 DB（本次結果）
    try {
      const ownerUserId = event.source?.groupId || event.source?.roomId || event.source?.userId;
      await bulkUpsertRestaurants(ownerUserId, resp.results);
    } catch (e) {
      console.error('[bulkUpsert random]', e?.message);
    }

    // 隨機挑 1 間並回 1 張卡
    const picked = resp.results[Math.floor(Math.random() * resp.results.length)];
    const bubble = restaurantBubble(picked);
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `今天就吃：${picked?.name || '這間'}`,
      contents: bubble,
      quickReply: quickReply([randomMoreQuickItem(radius)]) // ← 再選一間
    });
  }

  // 探索：回 10 張 + 「再 10 間」
  if (lower.startsWith('explore') || raw.startsWith('探索')) {
    const parts = raw.split(/\s+/);
    const radius = Number(parts[1]) || 1500;
    const lineUserId = event.source.userId;

    const r = await exploreRestaurant(lineUserId, radius, { limit: 10 });
    if (!r.ok) {
      return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
    }

    // 寫進 DB（這 10 間）
    try {
      const ownerUserId = event.source?.groupId || event.source?.roomId || event.source?.userId;
      await bulkUpsertRestaurants(ownerUserId, r.results);
    } catch (e) {
      console.error('[bulkUpsert explore]', e?.message);
    }

    const extras = r.nextPageToken ? [moreQuickItem(r.nextPageToken, lineUserId)] : [];
    const flex = restaurantsCarousel(r.results);
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `找到 ${r.meta?.total ?? r.results.length} 家餐廳`,
      contents: flex,
      quickReply: quickReply(extras)
    });
  }

  // 選擇 / 新增 / 移除
  if (lower.startsWith('choose') || raw.startsWith('選擇')) {
    const name = raw.replace(/^(choose|選擇)\s*/i, '').trim();
    if (!name) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '請在「選擇」後面加店名，例如：選擇 八方雲集', quickReply: quickReply() });
    }
    const r = await service.chooseRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  if (lower.startsWith('add') || raw.startsWith('新增') || raw.startsWith('加到')) {
    const name = raw.replace(/^(add|新增|加到)\s*/i, '').trim();
    const r = await service.addRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  if (lower.startsWith('remove') || raw.startsWith('移除')) {
    const name = raw.replace(/^(remove|移除)\s*/i, '').trim();
    const r = await service.removeRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '輸入：探索 1500 / 隨機 / 我的餐廳 / 新增 店名',
    quickReply: quickReply()
  });
}
