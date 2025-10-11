// service/exploreRestaurant.js
import { getUser } from './user.js';
import { nearbySearch, saveRestaurants, enrichWithDistance } from './places.js';
import { toCarouselMessage } from '../util/flex.js';

function buildQuickReply(nextToken, userId) {
  const items = [
    { type: 'action', action: { type: 'message', label: '探索 1500', text: '探索 1500' } },
    { type: 'action', action: { type: 'message', label: '探索 3000', text: '探索 3000' } },
    { type: 'action', action: { type: 'message', label: '探索 5000', text: '探索 5000' } },
    { type: 'action', action: { type: 'message', label: '隨機', text: '隨機' } },
    { type: 'action', action: { type: 'message', label: '我的餐廳', text: '我的餐廳' } },
    { type: 'action', action: { type: 'location', label: '傳位置' } },
  ];
  if (nextToken) {
    items.push({
      type: 'action',
      action: {
        type: 'postback', label: '再 10 間',
        data: `action=explore_more&token=${encodeURIComponent(nextToken)}&user=${userId}`,
        displayText: '再 10 間'
      }
    });
  }
  return { items };
}

export default async function exploreRestaurant(client, replyToken, lineUserId, radius = 1500) {
  const user = await getUser(lineUserId);
  if (!user?.lastLocation) {
    return client.replyMessage(replyToken, { type: 'text', text: '請先分享定位，再用「探索 1500」之類的指令唷！' });
  }
  const { lat, lng } = user.lastLocation;

  const api = await nearbySearch({ lat, lng, radius });
  if (api.status !== 'OK' && api.status !== 'ZERO_RESULTS') {
    return client.replyMessage(replyToken, { type: 'text', text: `Google 回傳：${api.status || '未知錯誤'}` });
  }

  const withDist = enrichWithDistance(api.results || [], { lat, lng });
  await saveRestaurants(withDist);

  const quickReply = buildQuickReply(api.next_page_token, lineUserId);
  const msg = toCarouselMessage(`找到 ${withDist.length} 家餐廳`, withDist, quickReply);
  try {
    return await client.replyMessage(replyToken, msg);
  } catch (e) {
    console.error('[LINE reply error]', e.statusCode, e.statusMessage, e.originalError?.response?.data || e.originalError || e);
  }
}

export async function exploreByNextToken(client, replyToken, lineUserId, token) {
  const user = await getUser(lineUserId);
  if (!user?.lastLocation) {
    return client.replyMessage(replyToken, { type: 'text', text: '請先分享定位，再用探索功能唷！' });
  }
  const { lat, lng } = user.lastLocation;

  const api = await nearbySearch({ pagetoken: token });
  if (api.status !== 'OK' && api.status !== 'ZERO_RESULTS') {
    return client.replyMessage(replyToken, { type: 'text', text: `Google 回傳：${api.status || '未知錯誤'}` });
  }

  const withDist = enrichWithDistance(api.results || [], { lat, lng });
  await saveRestaurants(withDist);

  const quickReply = buildQuickReply(api.next_page_token, lineUserId);
  const msg = toCarouselMessage(`再給你 ${withDist.length} 間`, withDist, quickReply);
  try {
    return await client.replyMessage(replyToken, msg);
  } catch (e) {
    console.error('[LINE reply error]', e.statusCode, e.statusMessage, e.originalError?.response?.data || e.originalError || e);
  }
}
