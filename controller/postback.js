// src/controller/postback.js
import service from '../service/index.js';
import { restaurantsCarousel, quickReply, moreQuickItem, randomMoreQuickItem, restaurantBubble } from '../util/lineFlex.js';
import { exploreByNextToken } from '../service/exploreRestaurant.js';
import exploreRestaurant from '../service/exploreRestaurant.js';
import bulkUpsertRestaurants from '../service/bulkUpsertRestaurants.js';

export default async function onPostback(client, event) {
  const raw = event?.postback?.data || '';
  let data = {};
  try { data = JSON.parse(raw); }
  catch { try { data = Object.fromEntries(new URLSearchParams(raw).entries()); } catch { data = { raw }; } }

  const action = (data.action || '').toLowerCase();
  const name = data.name ? decodeURIComponent(data.name) : '';

  if (action === 'add') {
    const r = await service.addRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  if (action === 'choose') {
    const r = await service.chooseRestaurant(event.source, name);
    return client.replyMessage(event.replyToken, { type: 'text', text: r.text, quickReply: quickReply() });
  }

  // explore → 再 10 間
  if (action === 'explore_more') {
    const token = data.token;
    const lineUserId = data.user || event.source.userId;
    const resp = await exploreByNextToken(lineUserId, token, 10);
    if (!resp.ok) {
      return client.replyMessage(event.replyToken, { type: 'text', text: resp.text, quickReply: quickReply() });
    }

    try {
      const ownerUserId = event.source?.groupId || event.source?.roomId || event.source?.userId;
      await bulkUpsertRestaurants(ownerUserId, resp.results);
    } catch (e) {
      console.error('[bulkUpsert explore_more]', e?.message);
    }

    const extras = resp.nextPageToken ? [moreQuickItem(resp.nextPageToken, lineUserId)] : [];
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `更多餐廳（${resp.results.length} 間）`,
      contents: restaurantsCarousel(resp.results),
      quickReply: quickReply(extras)
    });
  }

  // random → 再選一間（沿用同半徑再抽）
  if (action === 'random_more') {
    const radius = Number(data.radius) || 1500;
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
    const bubble = restaurantBubble(picked);
    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: `再選一間：${picked?.name || '這間'}`,
      contents: bubble,
      quickReply: quickReply([randomMoreQuickItem(radius)])
    });
  }

  return client.replyMessage(event.replyToken, { type: 'text', text: `postback: ${JSON.stringify(data)}`, quickReply: quickReply() });
}
