// src/controller/message.js
import service from '../service/index.js';
import { restaurantsCarousel, restaurantBubble, quickReply, moreQuickItem } from '../util/lineFlex.js';
import bulkUpsertRestaurants from '../service/bulkUpsertRestaurants.js';
import exploreRestaurant from '../service/exploreRestaurant.js';

export default async function onMessage(client, event) {
  const msg = event.message;

  // 位置訊息：寫入 DB
  if (msg?.type === 'location') {
    const r = await service.updateUserLocation(event);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // 非文字就略過
  if (msg?.type !== 'text') return null;

  const raw = (msg.text || '').trim();
  const lower = raw.toLowerCase();
  const is = (...keys) => keys.some(k => lower === k || raw === k);

  // 我的餐廳 / get
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

  // 隨機 / random：若沒帶數字先給半徑選單
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

    // 把本次搜到的都寫入 DB
    const ownerUserId = event.source?.groupId || event.source?.roomId || event.source?.userId;
    await bulkUpsertRestaurants(ownerUserId, resp.results);

    // 從結果中隨機挑 1 家
    const picked = resp.results[Math.floor(Math.random() * resp.results.length)];
    const bubble = restaurantBubble(picked);
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `今天就吃：${picked.name}`,
      contents: bubble,
      quickReply: quickReply()
    });
  }

  // 探索 / explore 半徑
  if (lower.startsWith('explore') || raw.startsWith('探索')) {
    const parts = raw.split(/\s+/);
    const radius = Number(parts[1]) || 1500;
    const lineUserId = event.source.userId;

    const r = await exploreRestaurant(lineUserId, radius, { limit: 10 });
    if (!r.ok) {
      return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
    }

    // 寫入資料庫（本頁的 10 間）
    const ownerUserId = event.source?.groupId || event.source?.roomId || event.source?.userId;
    await bulkUpsertRestaurants(ownerUserId, r.results);

    // 若有 nextPageToken，附上「再 10 間」
    const extras = r.nextPageToken ? [moreQuickItem(r.nextPageToken, lineUserId)] : [];
    const flex = restaurantsCarousel(r.results);
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `找到 ${r.meta?.total ?? r.results.length} 家餐廳`,
      contents: flex,
      quickReply: quickReply(extras)
    });
  }

  // 選擇 / choose 店名
  if (lower.startsWith('choose') || raw.startsWith('選擇')) {
    const name = raw.replace(/^(choose|選擇)\s*/i, '').trim();
    if (!name) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '請在「選擇」後面加店名，例如：選擇 八方雲集', quickReply: quickReply() });
    }
    const r = await service.chooseRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // 新增 / add / 加到 店名
  if (lower.startsWith('add') || raw.startsWith('新增') || raw.startsWith('加到')) {
    const name = raw.replace(/^(add|新增|加到)\s*/i, '').trim();
    const r = await service.addRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // 移除 / remove 店名
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
