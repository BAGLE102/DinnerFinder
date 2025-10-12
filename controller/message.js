// src/controller/message.js
import service from '../service/index.js';
import { restaurantsCarousel, restaurantBubble, quickReply } from '../util/lineFlex.js';

export default async function onMessage(client, event) {
  const msg = event.message;

  // 位置訊息：寫入 DB
  if (msg?.type === 'location') {
    const r = await service.updateUserLocation(event);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // 非文字就略過
  if (msg?.type !== 'text') {
    return null;
  }

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

  // 隨機 / random
  if (is('random', '隨機')) {
    const r = await service.randomRestaurant(event.source);
    if (r.restaurant) {
      const bubble = restaurantBubble(r.restaurant);
      return client.replyMessage(event.replyToken, {
        type: 'flex',
        altText: r.text,
        contents: bubble,
        quickReply: quickReply()
      });
    }
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // 探索 / explore 半徑
  if (lower.startsWith('explore') || raw.startsWith('探索')) {
    const parts = raw.split(/\s+/);
    const radius = Number(parts[1]) || 1500;
    const lineUserId = event.source.userId;

    const r = await service.exploreRestaurant(lineUserId, radius, { limit: 10 });
    if (!r.ok) {
      return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
    }

    const flex = restaurantsCarousel(r.results);
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `找到 ${r.meta?.total ?? r.results.length} 家餐廳`,
      contents: flex,
      quickReply: quickReply()
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

  // 新增 / add 店名
  if (lower.startsWith('add') || raw.startsWith('新增')) {
    const name = raw.replace(/^(add|新增)\s*/i, '').trim();
    const r = await service.addRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // 移除 / remove 店名
  if (lower.startsWith('remove') || raw.startsWith('移除')) {
    const name = raw.replace(/^(remove|移除)\s*/i, '').trim();
    const r = await service.removeRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // 其他
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '輸入：探索 1500 / 隨機 / 我的餐廳 / 新增 店名',
    quickReply: quickReply()
  });
}
