// service/randomRestaurant.js
import fetch from 'node-fetch';
import User from '../model/user.js';
import Restaurant from '../model/restaurant.js';

const USE_PLACES_FALLBACK_WHEN_EMPTY =
  (process.env.USE_PLACES_FALLBACK_WHEN_EMPTY || 'true').toLowerCase() === 'true';

async function sampleOne(ownerUserId) {
  const docs = await Restaurant.aggregate([
    { $match: { ownerUserId } },
    { $sample: { size: 1 } }
  ]);
  return docs[0] || null;
}

async function pickFromPlaces(last, radius = 1500) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${last.lat},${last.lng}`);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('keyword', 'restaurant');
  url.searchParams.set('language', 'zh-TW');
  url.searchParams.set('key', key);

  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json();
  const list = data?.results || [];
  if (!list.length) return null;

  const p = list[Math.floor(Math.random() * list.length)];
  return {
    name: p.name,
    address: p.vicinity || p.formatted_address || '',
    rating: p.rating,
    placeId: p.place_id,
    location: { lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng },
    source: 'places'
  };
}

export default async function randomRestaurant(source) {
  const ownerUserId = source?.groupId || source?.roomId || source?.userId;
  if (!ownerUserId) return { ok: false, text: '來源不明，請在 1:1 視窗使用。' };

  // 先從自己的清單抽
  const picked = await sampleOne(ownerUserId);
  if (picked) {
    const addr = picked.address ? `\n📍 ${picked.address}` : '';
    return { ok: true, text: `今天就吃：${picked.name}${addr}`, restaurant: picked };
  }

  // 清單為空 → 可選擇用 Google Places 當候補
  if (!USE_PLACES_FALLBACK_WHEN_EMPTY) {
    return { ok: false, text: '清單沒有餐廳，先用「新增 店名」加幾家吧～' };
  }

  // 走附近候補要看使用者 lastLocation（不是 user.location）
  const lineUserId = source?.userId || ownerUserId;
  const user = await User.findOne({ lineUserId }).lean();
  const last = user?.lastLocation;
  if (!last || typeof last.lat !== 'number' || typeof last.lng !== 'number') {
    return { ok: false, text: '清單沒有餐廳；若要幫你附近挑一間，請先傳一則「位置訊息」。' };
  }

  const nearby = await pickFromPlaces(last, 1500);
  if (!nearby) return { ok: false, text: '附近暫時找不到餐廳，換個地點或加大半徑試試。' };

  const hint = '（清單空白，先幫你從附近挑一間）';
  const addr = nearby.address ? `\n📍 ${nearby.address}` : '';
  const star = nearby.rating ? `（⭐️${nearby.rating}）` : '';
  return { ok: true, text: `今天就吃：${nearby.name}${star}${addr}\n${hint}`, restaurant: nearby };
}
