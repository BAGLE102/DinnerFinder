// controller/message.js
import { client as lineClient } from '../config/line.js';
import { getPlacesCached } from '../service/cachePlaces.js';
import { buildExploreMessage, buildRandomMessage } from '../service/exploreRestaurant.js';

const defaultLoc = { lat: 23.5636, lng: 120.4723 }; // 中正大學附近
const userLoc = new Map(); // userId -> {lat,lng}

function parseRadius(text) {
  const m = text.match(/探索\s*(\d{3,5})/);
  if (m) return Math.max(300, Math.min(5000, parseInt(m[1], 10)));
  return null;
}

export default async function handleMessage(event) {
  const replyToken = event.replyToken;
  const userId = event.source?.userId;

  if (event.message?.type === 'location') {
    const { latitude, longitude } = event.message;
    userLoc.set(userId, { lat: latitude, lng: longitude });
    await lineClient.replyMessage(replyToken, [
      { type: 'text', text: '已記住你的定位，試試「探索 1500」或「隨機」' }
    ]);
    return;
  }

  if (event.message?.type !== 'text') {
    await lineClient.replyMessage(replyToken, [
      { type: 'text', text: '請輸入「探索 1500/3000/5000」或傳送定位，或輸入「隨機」' }
    ]);
    return;
  }

  const text = (event.message.text || '').trim();

  // 探索指令
  const r = parseRadius(text);
  if (r) {
    const loc = userLoc.get(userId) || defaultLoc;
    const { places, source } = await getPlacesCached({ ...loc, radius: r });
    const msg = buildExploreMessage(places.slice(0, 10)); // 限制最多 10 筆
    await lineClient.replyMessage(replyToken, [msg]);
    console.log(`[explore] ${source} key, total=${places.length}, sent=${Math.min(10, places.length)}`);
    return;
  }

  // 隨機指令
  if (text === '隨機' || text.toLowerCase() === 'random') {
    const loc = userLoc.get(userId) || defaultLoc;
    const radius = 1500;
    const { places, source } = await getPlacesCached({ ...loc, radius });
    const msg = buildRandomMessage(places);
    await lineClient.replyMessage(replyToken, [msg]);
    console.log(`[random] ${source} key, total=${places.length}`);
    return;
  }

  // 說明
  await lineClient.replyMessage(replyToken, [
    {
      type: 'text',
      text: '指令：\n1) 傳位置\n2) 探索 1500/3000/5000\n3) 隨機'
    }
  ]);
}
