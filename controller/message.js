// 在檔頭多加
import { restaurantsCarousel, restaurantBubble, quickReply } from '../util/lineFlex.js';

// ...內文替換探索那段：
  if (lower.startsWith('explore') || raw.startsWith('探索')) {
    const parts = raw.split(/\s+/);
    const radius = Number(parts[1]) || 1500;
    const lineUserId = event.source.userId;

    const r = await service.exploreRestaurant(lineUserId, radius, { limit: 10 });
    if (!r.ok) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: r.text,
        quickReply: quickReply()
      });
    }

    const flex = restaurantsCarousel(r.results);
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `找到 ${r.meta?.total ?? r.results.length} 家餐廳`,
      contents: flex,
      quickReply: quickReply()
    });
  }

// ...隨機那段改成：
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
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: r.text,
      quickReply: quickReply()
    });
  }

// ...get / add / remove 的回覆也可帶上 quickReply（選配）
