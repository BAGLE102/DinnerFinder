// controller/message.js
import exploreRestaurant from '../service/exploreRestaurant.js';
import randomRestaurant from '../service/randomRestaurant.js';
import { updateUserLocation, getMyRestaurants } from '../service/user.js';
import { toCarouselMessage } from '../util/flex.js';

export default async function onMessage(event, client) {
  const replyToken = event.replyToken;
  const userId = event.source?.userId;

  if (event.message?.type === 'location') {
    const { latitude, longitude } = event.message;
    await updateUserLocation(userId, latitude, longitude);
    return client.replyMessage(replyToken, { type: 'text', text: '位置更新成功！接著可以用「探索 1500」看看附近餐廳～' });
  }

  if (event.message?.type === 'text') {
    const text = (event.message.text || '').trim();

    // 探索 半徑
    const m = text.match(/^探索\s*(\d+)/);
    if (m) {
      const radius = parseInt(m[1], 10) || 1500;
      return exploreRestaurant(client, replyToken, userId, radius);
    }

    // 隨機 [半徑]
    const r = text.match(/^隨機(?:\s*(\d+))?/);
    if (r) {
      const radius = r[1] ? parseInt(r[1], 10) : 1500;
      return randomRestaurant(client, replyToken, userId, radius);
    }

    // 我的餐廳（顯示收藏清單）
    if (text === '我的餐廳') {
      const docs = await getMyRestaurants(userId, 10);
      if (!docs.length) {
        return client.replyMessage(replyToken, { type: 'text', text: '清單目前是空的，去「探索」或「隨機」加一些吧！' });
      }
      const msg = toCarouselMessage(`我的餐廳（${docs.length}）`, docs);
      return client.replyMessage(replyToken, msg);
    }

    // 手動關鍵字 "add <place_id>"（可選）
    if (/^add\s+/i.test(text)) {
      return client.replyMessage(replyToken, { type: 'text', text: '要加入清單請點每張卡片上的「加入清單」按鈕喔！' });
    }

    // 幫助
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '指令：\n1) 傳位置\n2) 探索 1500 / 3000 / 5000\n3) 隨機 [1500]\n4) 我的餐廳'
    });
  }

  return Promise.resolve();
}
