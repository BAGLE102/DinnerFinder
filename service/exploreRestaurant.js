// service/exploreRestaurant.js
import fetch from 'node-fetch';
import { User } from '../models/user.js';           // 依你的實際路徑
// 如果你用的是 default export：import User from '../models/User.js'

const PLACES_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

function toNumber(n, def) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

/**
 * 依使用者最後上傳的位置，探索附近餐廳
 * @param {string} lineUserId - LINE 的 userId（1:1 對話）；若在群組需改用 groupId/roomId 的策略
 * @param {number|string} radiusMeters - 半徑（公尺）
 * @param {string} keyword - 關鍵字（預設 restaurant）
 * @returns {Promise<Array>} 精簡的餐廳陣列
 * @throws {Error} 'NO_USER' | 'NO_LOCATION' | 'PLACES_ERROR'
 */
export async function exploreRestaurant(lineUserId, radiusMeters = 1500, keyword = 'restaurant') {
  // 1) 取使用者
  const user = await User.findOne({ lineUserId }).lean();

  if (!user) {
    const e = new Error('NO_USER');
    e.explain = '找不到使用者資料，請先跟機器人對話一次或重新加入。';
    throw e;
  }

  // 2) 取最後位置（注意欄位是 lastLocation，不是 location）
  const last = user.lastLocation;
  if (!last || typeof last.lat !== 'number' || typeof last.lng !== 'number') {
    const e = new Error('NO_LOCATION');
    e.explain = '尚未設定所在位置，請先在 LINE 傳送一則「位置訊息」給我。';
    throw e;
  }

  const radius = toNumber(radiusMeters, 1500);
  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    const e = new Error('PLACES_ERROR');
    e.explain = '伺服器尚未設定 GOOGLE_API_KEY。';
    throw e;
  }

  // 3) 呼叫 Google Places Nearby Search
  const url = new URL(PLACES_ENDPOINT);
  url.searchParams.set('location', `${last.lat},${last.lng}`);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('keyword', keyword);      // 也可改成 type=restaurant
  url.searchParams.set('language', 'zh-TW');
  url.searchParams.set('key', key);

  const r = await fetch(url);
  if (!r.ok) {
    const e = new Error('PLACES_ERROR');
    e.explain = `Google API HTTP ${r.status}`;
    throw e;
  }
  const data = await r.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    const e = new Error('PLACES_ERROR');
    e.explain = `Google Places: ${data.status} ${data.error_message || ''}`;
    throw e;
  }

  // 4) 精簡輸出
  return (data.results || []).map(p => ({
    placeId: p.place_id,
    name: p.name,
    rating: p.rating,
    reviews: p.user_ratings_total,
    priceLevel: p.price_level,
    lat: p.geometry?.location?.lat,
    lng: p.geometry?.location?.lng,
    address: p.vicinity || p.formatted_address
  }));
}
